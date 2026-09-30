/**
 * Record a headless iOS simulator and cut the recording into frames with real timestamps.
 *
 *   bun scripts/reference/record.ts --udid <UDID> --case <name> --drive '<shell>' [--seconds 8] [--settle 1500]
 *
 * The simulator is driven by `--drive`, a shell command run while the recording is live —
 * `xcrun simctl launch`, `openurl`, `ui appearance`, or a tap injected by whatever input path is
 * working. Nothing here brings a window to the front: `simctl boot` starts the runtime with no
 * Simulator.app, `simctl io recordVideo` records the device off-screen, and every driver command is a
 * `simctl` call. If you find yourself reaching for `osascript ... activate`, stop — this file exists
 * so that is never needed.
 *
 * ## Why a recording and not a screenshot
 *
 * `simctl io screenshot` can only catch a settled state, so a screenshot suite can measure geometry
 * and never motion. A recording carries every frame the device drew, each with a presentation
 * timestamp, which is what makes a *timed* checkpoint measurable: "the bubble is at 1.07 scale at
 * 467 ms" is a claim about a frame, and this is what produces that frame.
 *
 * `simctl` records variable-frame-rate video — it emits a frame when the screen changes, not on a
 * clock — so the frame index means nothing and the PTS means everything. Every time below is read
 * out of the container with ffprobe, never inferred from a frame number.
 *
 * ## Where t = 0 is
 *
 * The recording starts before the driver runs, so the first frames are the resting state. t = 0 is
 * defined the way `references/ios/motion/effects.md` already defines it: the first frame that differs
 * from the resting one by more than `--threshold` of its pixels. That anchor is written into
 * `frames.json` along with every frame's absolute PTS, so a later step can ask for "the frame nearest
 * 233 ms after the motion started" and get an answer that does not depend on when the recorder
 * happened to start.
 */
import { mkdir, writeFile, readdir, readFile, rm } from "node:fs/promises";
import { parseArgs } from "node:util";
import { spawn, spawnSync } from "node:child_process";
import { PNG } from "pngjs";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    udid: { type: "string" },
    case: { type: "string" },
    drive: { type: "string" },
    out: { type: "string" },
    seconds: { type: "string", default: "8" },
    settle: { type: "string", default: "1500" },
    threshold: { type: "string", default: "0.002" },
  },
});
if (!values.udid || !values.case) throw new Error("Required: --udid <UDID> --case <name> [--drive '<shell>'] [--seconds 8] [--settle 1500]");

const root = values.out ?? `/private/tmp/imessage-recordings/${values.case}`;
const video = `${root}/capture.mp4`;
const frames = `${root}/frames`;
// Emptied, not just created: ffmpeg names frames by index, so a shorter recording leaves the tail of
// a longer previous one in place and `readdir` hands back frames from two different videos.
await rm(frames, { recursive: true, force: true });
await mkdir(frames, { recursive: true });

const sh = (command: string, timeout = 120_000) =>
  spawnSync("/bin/sh", ["-c", command], { encoding: "utf8", timeout });

/** Nothing is recorded until the device has stopped drawing whatever the last command left behind. */
const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// The recording lock is device-wide, so litter from a previous *case* stops this one. Clear it first.
await finishRecording();

console.log(`recording ${values.case} on ${values.udid}`);
// stderr is captured rather than discarded: every way this fails announces itself there and nowhere
// else, and throwing it away turned "the device is holding a stale recording lock" into "No frames in
// capture.mp4", which sends the next person looking at ffmpeg.
const recorder = spawn("xcrun", ["simctl", "io", values.udid, "recordVideo", "--codec", "h264", "--force", video], { stdio: ["ignore", "ignore", "pipe"] });
let recorderErrors = "";
recorder.stderr?.on("data", chunk => { recorderErrors += String(chunk); });
// A moment of the resting state at the head of every recording: that is what t = 0 is measured against.
await settle(Number(values.settle));
if (values.drive) {
  const driven = sh(values.drive);
  if (driven.status !== 0) console.error(`driver exited ${driven.status}: ${driven.stderr?.trim()}`);
}
await settle(Number(values.seconds) * 1000);
recorder.kill("SIGINT");
// SIGINT makes simctl finalise the container; killing harder truncates the file and ffprobe reports
// a duration of zero, which is the failure this wait exists to avoid. But SIGINT is a request, and a
// `simctl` client that ignores it keeps the display attached and silently truncates the *next*
// recording — the failure mode there is six frames out of a four-second window, with no error at all.
// So: wait for it to go, and escalate if it does not. Escalating on the client is safe; the container
// is written by a separate host process, which `finishRecording` deals with.
await Promise.race([
  new Promise(resolve => recorder.once("exit", resolve)),
  settle(5000).then(() => {
    if (recorder.exitCode === null) {
      console.error("recorder ignored SIGINT; terminating it");
      recorder.kill("SIGKILL");
    }
  }),
]);
await settle(1500);
await finishRecording();

/**
 * Stop the process that is actually recording.
 *
 * `recorder.kill("SIGINT")` stops the `simctl` *client*, and that is not who holds the file. The
 * recording is owned by a `SimRenderingServices.sim` host process, which keeps writing, never
 * finalises the container, and holds a **device-wide** lock — so the next `recordVideo` on this
 * simulator fails with `Resource busy … Host recording is already in progress` even though no
 * `recordVideo` process exists any more. That is a poisoned device, not a poisoned run: every later
 * case fails until somebody finds the orphan by hand.
 *
 * The tell is the sandbox temp `capture.mp4.sb-*` sitting beside the output. `lsof` names the host
 * that has it open, and SIGINT — never SIGKILL, which would leave the container truncated — makes it
 * finish the file and release the lock.
 */
async function finishRecording() {
  for (let attempt = 0; attempt < 24; attempt++) {
    const temps = (await readdir(root)).filter(name => name.startsWith("capture.mp4.sb-"));
    if (!temps.length) return;
    // `lsof -t` prints just the pids, which is all that is wanted here.
    const holders = sh(`lsof -t ${temps.map(name => JSON.stringify(`${root}/${name}`)).join(" ")} 2>/dev/null`)
      .stdout.split("\n").map(line => Number(line.trim())).filter(pid => Number.isInteger(pid) && pid > 0);
    if (!holders.length) {
      // Nobody has it open, so it is not a live recording holding the device — it is litter the host
      // left behind, and leaving it makes the *next* run think a recording is still in progress.
      for (const name of temps) await rm(`${root}/${name}`, { force: true });
      return;
    }
    // Eight seconds of simply waiting first, because in the ordinary case the client's own SIGINT has
    // already finalised the container and the host is doing its last writes. Cutting that short
    // produced a `capture.mp4` with no frames at all — the cure being worse than the disease.
    if (attempt === 16) {
      console.error(`recording host still running (${holders.join(", ")}); asking it to finish`);
      for (const pid of holders) { try { process.kill(pid, "SIGINT"); } catch { /* already gone */ } }
    }
    await settle(500);
  }
  console.error(`WARNING: ${root} still holds a sandbox temp; the next recording on this device may report "Host recording is already in progress".`);
}

const probe = sh(`ffprobe -v error -select_streams v:0 -show_entries frame=pts_time -of csv=p=0 ${JSON.stringify(video)}`);
// Two things this parse has to survive, both of which silently corrupted the timeline before:
// the first row carries a trailing comma (`0.000000,`) so a row must be split rather than parsed
// whole, and the output ends in a newline, so the empty last line becomes `Number("") === 0` — a
// finite value that passes any `isFinite` filter and lands at the end of an ascending list.
const times = probe.stdout.split("\n")
  .map(line => line.split(",")[0]?.trim())
  .filter((field): field is string => Boolean(field))
  .map(Number);
if (!times.length) {
  // The device-wide one, which is worth naming because the cure is not obvious and the message the
  // recorder prints scrolls past: a previous recording's host never let go, and every recording on
  // this simulator fails until it does. `simctl shutdown` + `boot` clears it, headlessly.
  if (/Host recording is already in progress/i.test(recorderErrors)) {
    throw new Error(`${values.udid} is holding a stale recording lock ("Host recording is already in progress"), so nothing was captured.`
      + ` Clear it with: xcrun simctl shutdown ${values.udid} && xcrun simctl boot ${values.udid}`);
  }
  throw new Error(`No frames in ${video}. The recorder said:\n${recorderErrors.trim() || "(nothing)"}`);
}
if (times.some((value, index) => index > 0 && value < times[index - 1]!))
  throw new Error(`Timestamps out of order in ${video}.`);

// One PNG per frame, named by index, so the PTS list above indexes straight into them.
const extract = sh(`ffmpeg -v error -y -i ${JSON.stringify(video)} -vsync 0 ${JSON.stringify(`${frames}/f%05d.png`)}`, 300_000);
if (extract.status !== 0) throw new Error(`ffmpeg failed: ${extract.stderr?.trim()}`);
const files = (await readdir(frames)).filter(name => name.endsWith(".png")).sort();
// The whole file downstream assumes `files[i]` was drawn at `times[i]`. If those two ever disagree
// every `ms` in the manifest is wrong by an unknown amount, and the checkpoints read off it are
// wrong quietly. So: refuse, rather than emit a plausible-looking timeline.
if (files.length !== times.length)
  throw new Error(`${files.length} extracted frames but ${times.length} timestamps in ${video}; the two cannot be aligned.`);

/** Fraction of pixels that differ from the resting frame by more than a level of noise. */
async function changed(a: string, b: string): Promise<number> {
  const [first, second] = await Promise.all([readFile(a), readFile(b)]);
  const left = PNG.sync.read(first);
  const right = PNG.sync.read(second);
  if (left.width !== right.width || left.height !== right.height) return 1;
  let differing = 0;
  for (let index = 0; index < left.data.length; index += 4) {
    const delta = Math.abs(left.data[index] - right.data[index])
      + Math.abs(left.data[index + 1] - right.data[index + 1])
      + Math.abs(left.data[index + 2] - right.data[index + 2]);
    if (delta > 12) differing++;
  }
  return differing / (left.width * left.height);
}

const resting = `${frames}/${files[0]}`;
let startIndex = 0;
const moved: number[] = [];
for (let index = 1; index < files.length; index++) {
  const fraction = await changed(resting, `${frames}/${files[index]}`);
  moved.push(fraction);
  if (!startIndex && fraction > Number(values.threshold)) startIndex = index;
}
const zero = times[startIndex] ?? times[0]!;

const manifest = {
  case: values.case,
  udid: values.udid,
  recordedAt: new Date().toISOString(),
  drive: values.drive ?? null,
  video,
  // The frame the motion starts on, and what it is measured against: without both, a time in this
  // file cannot be checked by anyone else.
  zeroIndex: startIndex,
  zeroPts: zero,
  threshold: Number(values.threshold),
  frames: files.map((name, index) => ({
    index,
    file: `${frames}/${name}`,
    pts: times[index]!,
    ms: Math.round((times[index]! - zero) * 1000),
    changedFromRest: index === 0 ? 0 : Number((moved[index - 1] ?? 0).toFixed(5)),
  })),
};
await writeFile(`${root}/frames.json`, JSON.stringify(manifest, null, 2) + "\n");

const last = manifest.frames.at(-1);
console.log(`${files.length} frames, ${(times.at(-1)! - times[0]!).toFixed(2)}s`);
console.log(`t=0 at frame ${startIndex} (pts ${zero.toFixed(3)}s); timeline runs ${manifest.frames[0]!.ms} … ${last?.ms} ms`);
// A recording where the screen never changed is a driver that did nothing, not a case with no motion.
if (!startIndex) console.error(`WARNING: nothing changed by more than ${values.threshold}; the driver may not have taken effect.`);
console.log(`wrote ${root}/frames.json`);
