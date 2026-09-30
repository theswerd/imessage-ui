/**
 * Pull one frame out of a recording and import it as a native reference.
 *
 *   bun scripts/reference/checkpoint.ts --case send-dark --ms 417 \
 *     --platform ios --scene outgoing --theme dark --os 'iOS 26.0 (23A343)'
 *
 * `record.ts` leaves a `frames.json` whose every frame carries a real presentation timestamp and an
 * `ms` measured from the first frame that moved. This is the step that turns one of those frames into
 * a baseline, and it is the only way the suite can check *motion*: a screenshot suite can assert the
 * bubble's resting shape and nothing about the 417 ms it spends getting there.
 *
 * ## Which frame answers "at 417 ms"
 *
 * `simctl` records variable-frame-rate video: a frame exists only where the screen changed. So there
 * are two defensible answers and this prints both every time.
 *
 *   --pick nearest   (default) the frame whose timestamp is closest to the request.
 *   --pick displayed the last frame drawn at or before the request, i.e. the pixels that were
 *                    actually on the glass at that instant. During a hold these differ: `nearest` can
 *                    hand back a frame from the *future*, which is a lie about the requested time,
 *                    and `displayed` cannot.
 *
 * Whichever is chosen, the gap between the request and the frame's own timestamp is written into the
 * reference's `source` string, and a gap over `--tolerance` stops the import rather than quietly
 * filing a frame from the wrong moment under a checkpoint's name.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { platforms, type Platform } from "../../harness/scenarios";
import { importReference } from "./import";

type RecordedFrame = { index: number; file: string; pts: number; ms: number; changedFromRest: number };
type Recording = { case: string; udid: string; recordedAt: string; drive: string | null; video: string; zeroIndex: number; zeroPts: number; threshold: number; frames: RecordedFrame[] };

const { values } = parseArgs({ args: process.argv.slice(2), options: {
  case: { type: "string" }, ms: { type: "string" }, recordings: { type: "string" },
  platform: { type: "string" }, scene: { type: "string" }, theme: { type: "string", default: "light" },
  at: { type: "string" }, os: { type: "string" }, note: { type: "string" },
  pick: { type: "string", default: "nearest" }, tolerance: { type: "string", default: "34" },
  scale: { type: "string" }, root: { type: "string" }, "dry-run": { type: "boolean" },
} });
if (!values.case || values.ms === undefined || !values.platform || !(values.platform in platforms) || !values.scene || !values.os)
  throw new Error("Required: --case NAME --ms MS --platform ios|macos --scene NAME --os 'exact OS version' [--theme light|dark] [--at CHECKPOINT-MS] [--pick nearest|displayed] [--tolerance 34] [--recordings DIR] [--root references] [--note '...'] [--dry-run]");
if (values.pick !== "nearest" && values.pick !== "displayed") throw new Error("--pick is nearest or displayed.");

const platform = values.platform as Platform;
const target = Number(values.ms);
if (!Number.isFinite(target)) throw new Error(`--ms must be a number of milliseconds. Received ${values.ms}.`);
// The checkpoint the reference is filed under is a separate number from the moment in the recording:
// our timeline's 690 ms may sit at 687 ms of a capture that started on a slightly different frame.
const checkpoint = values.at === undefined ? target : Number(values.at);

const directory = `${values.recordings ?? "/private/tmp/imessage-recordings"}/${values.case}`;
const recording: Recording = JSON.parse(await readFile(`${directory}/frames.json`, "utf8"));
if (!recording.frames?.length) throw new Error(`${directory}/frames.json has no frames.`);
if (!recording.zeroIndex) console.error(`WARNING: ${values.case} has t=0 at frame 0, so nothing in it ever moved by more than ${recording.threshold}. Its timeline is anchored on the resting frame, not on a motion.`);

const first = recording.frames[0]!, last = recording.frames.at(-1)!;
if (target < first.ms || target > last.ms) throw new Error(`${target} ms is outside ${values.case}, which runs ${first.ms} … ${last.ms} ms. A reference cannot be extrapolated past the recording.`);

const nearest = recording.frames.reduce((best, frame) => Math.abs(frame.ms - target) < Math.abs(best.ms - target) ? frame : best);
// Every frame at or before the request; the last of them is what the screen was showing.
const displayed = recording.frames.filter(frame => frame.ms <= target).at(-1) ?? first;
const chosen = values.pick === "displayed" ? displayed : nearest;
const off = chosen.ms - target;
console.log(`${values.case}: ${recording.frames.length} frames, ${first.ms} … ${last.ms} ms, t=0 at frame ${recording.zeroIndex} (pts ${recording.zeroPts.toFixed(3)}s)`);
console.log(`  nearest  to ${target} ms: frame ${nearest.index} at ${nearest.ms} ms (${nearest.ms - target >= 0 ? "+" : ""}${nearest.ms - target})`);
console.log(`  displayed at ${target} ms: frame ${displayed.index} at ${displayed.ms} ms (${displayed.ms - target >= 0 ? "+" : ""}${displayed.ms - target})`);
if (nearest.index !== displayed.index) console.log(`  the two differ: the screen still held frame ${displayed.index} at ${target} ms.`);
const tolerance = Number(values.tolerance);
if (Math.abs(off) > tolerance) throw new Error(`Frame ${chosen.index} is ${Math.abs(off)} ms from the requested ${target} ms, over the ${tolerance} ms tolerance. The screen drew nothing nearer; raise --tolerance deliberately, or re-record, rather than filing this frame as ${target} ms.`);

const source = [
  `native recording "${recording.case}" frame ${chosen.index} (--pick ${values.pick})`,
  `pts ${chosen.pts.toFixed(6)}s, t+${chosen.ms} ms, requested ${target} ms, off by ${off >= 0 ? "+" : ""}${off} ms`,
  `t=0 at frame ${recording.zeroIndex} (pts ${recording.zeroPts.toFixed(6)}s), the first frame differing from rest by >${recording.threshold}`,
  `video ${recording.video} recorded ${recording.recordedAt} on simulator ${recording.udid}`,
  `driven by: ${recording.drive ?? "(nothing; resting state)"}`,
  values.note,
].filter(Boolean).join("; ");

if (values["dry-run"]) {
  console.log(`--dry-run: would import ${chosen.file}\n  as ${platform}/${values.theme}/${values.scene}-${checkpoint}.png\n  source: ${source}`);
  process.exit(0);
}
const imported = await importReference({
  platform, scene: values.scene, theme: values.theme!, time: checkpoint,
  file: chosen.file, os: values.os, source,
  scale: values.scale === undefined ? undefined : Number(values.scale), root: values.root,
});
console.log(`Imported native reference: ${platform}/${imported.image} (${values.os}, ${imported.pixels.width}x${imported.pixels.height} @${imported.scale}x) from frame ${chosen.index} at t+${chosen.ms} ms`);
