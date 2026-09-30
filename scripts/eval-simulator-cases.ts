/**
 * Run this kit against the checkpoints recorded off the headless simulator.
 *
 *   bun scripts/eval-simulator-cases.ts [--base http://127.0.0.1:3100] [--case NAME] [--json out.json]
 *
 * `references/ios/motion/simulator-checkpoints.json` holds 95 assertions taken from 11 recordings of
 * a real iPhone 17 Pro running iOS 26 — every one of them a claim about a *frame at a time*, anchored
 * the way `references/ios/motion/effects.md` anchors t = 0. `references/simulator-cases.md` is the
 * long form, with how each recording was driven and what would have falsified it.
 *
 * This is the other half: it renders our own surfaces at the native scale (402 × 874 at 3×, so the
 * rectangles below are the *same device pixels* the simulator drew), samples the same regions, and
 * says which of those claims we answer.
 *
 * ## Three outcomes, and the third is the point
 *
 * `pass` and `fail` are what they sound like. The third is **`unanswerable`**, and a checkpoint gets
 * it when this kit has no surface to ask — no Dynamic Type ladder, no dismissal timeline on the
 * compose sheet. That list is not a gap in this script; it *is* the finding, and it is the honest
 * thing to print. A runner that quietly skipped those would report a much better number and tell
 * nobody what to build next. The list gets shorter as surfaces get built: the notification banner
 * was on it until `registry/imessage/ios-push-banner.tsx` existed, and its 27 checkpoints are now
 * asked and answered like any other.
 *
 * Nothing here is scored as a pass for being absent, and nothing is given a tolerance it did not come
 * with — every `tol` below is the recording's own.
 */
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    base: { type: "string", default: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100" },
    case: { type: "string" },
    json: { type: "string" },
  },
});

type Assertion = {
  at: number;
  kind: "region" | "box" | "edge" | "progress";
  region?: [number, number, number, number];
  /** `[x, y, width, height]` in device pixels: where a whole surface was, not what colour it was. */
  box?: [number, number, number, number];
  /** Which edge `y` is a reading of, e.g. `sheet.top`. */
  edge?: string;
  /** The edge's position in device pixels down the screen. */
  y?: number;
  rgb?: [number, number, number];
  tol?: number;
  differsFromSettled?: number;
  note?: string;
};
type Case = { case: string; drive: string; duration: number; checkpoints: number[]; assertions: Assertion[] };
type Checkpoints = { device: { px: [number, number]; pt: [number, number]; scale: number }; cases: Case[] };

/**
 * How to reach each recorded state in this kit — or why it cannot be reached.
 *
 * A theme change is the one family we can answer at all, and only at its two ends: our surfaces swap
 * on the `.dark` class, in one frame. The recordings say native takes 492 ms into dark and 495 ms back
 * into light, on two different curves (half done at ~180 ms one way, ~290 ms the other), so every
 * checkpoint between the ends is a question we have no timeline to answer. The endpoints are still
 * worth asking: they are a direct check of `tokens.ts` against the device, at 3x, over real content.
 */
const SUBJECTS: Record<string, { scene: string; from: "light" | "dark"; to: "light" | "dark" } | { unanswerable: string }> = {
  "appearance-light-to-dark": { scene: "list", from: "light", to: "dark" },
  "appearance-dark-to-light": { scene: "list", from: "dark", to: "light" },
  "list-light-to-dark": { scene: "list", from: "light", to: "dark" },
  "list-dark-to-light": { scene: "list", from: "dark", to: "light" },
  "content-size-l-to-xxxl": { unanswerable: "no Dynamic Type ladder in the kit: every metric in `tokens.ts` is fixed at the Large size" },
  "list-content-size-ax5": { unanswerable: "same — and the accessibility sizes restack rather than scale, which nothing here draws" },
  // sheet-* are answered by `EDGES` below: the compose sheet now carries the recorded dismissal
  // (`iosSheetDismissal` in `registry/imessage/ios-new-message-sheet.tsx`) and the shell knows that a
  // re-present is not animated.
  // push-banner-* are answered by `BOXES` below: they are geometry, not colour, and the kit now has
  // the surface to ask (`registry/imessage/ios-push-banner.tsx`).
};

/**
 * Cases whose assertions are a **box** — where a whole surface was on screen at a millisecond — and
 * the scene plus the element that has to be standing there.
 *
 * A box is a different kind of question from a region, and a much less forgiving one. A region
 * assertion can be dodged: our fixtures are not the simulator's sample conversations, so a mean over
 * a rectangle of content is not comparable and the runner says so. A box has no such escape. The
 * recording says the banner's rectangle was [300, 0, 622, 204] device pixels at t = 0 and
 * [0, 0, 1206, 528] at 200 ms, and either the element we draw is there or it is not.
 *
 * What is measured here is the element's own **layout box**, relative to the device frame, in CSS
 * pixels times the device scale — the page is opened at deviceScaleFactor 3, so those are the same
 * device pixels the simulator drew. That is not quite the same measurement the recording made: the
 * recording bounds the region that *changed* on the device, which would include a drop shadow. The
 * component draws none, for exactly that reason (see its file comment), so the two are comparable —
 * and if a shadow is ever added there, this runner starts under-reporting the box and the note here
 * is the reason why.
 */
const BOXES: Record<string, { scene: string; selector: string }> = {
  "push-banner-short": { scene: "push-banner-short", selector: '[data-slot="ios-push-banner"]' },
  "push-banner-long": { scene: "push-banner-long", selector: '[data-slot="ios-push-banner"]' },
  "push-banner-group": { scene: "push-banner-group", selector: '[data-slot="ios-push-banner"]' },
};

/**
 * Cases whose assertions are an **edge** — where one boundary of one surface was at a millisecond —
 * and the scene plus the element whose edge that is.
 *
 * The recorder tracked the compose sheet's top edge down the centre column of the screen
 * (`rec/edge.py --col 603`), which is why `sheet-dismiss` is nine readings of a single number rather
 * than a colour or a rectangle. The answer here is the top of the same element's layout box,
 * measured by `boxAt` and taken at index 1: the page is opened at deviceScaleFactor 3, so a CSS
 * pixel times the scale is the device pixel the simulator drew, and `getBoundingClientRect` reports
 * the box with the panel's running `translateY` applied — which is the whole of this animation.
 *
 * What that does NOT do is prove anything is *painted* at that edge. A scan of the centre column
 * would, and would then have to tell a white sheet from the white conversation list behind it as the
 * dim fades out. This is the layout, honestly labelled.
 *
 * The kit has one such surface, so the map is small on purpose rather than by omission — there is no
 * second edge in `simulator-checkpoints.json`.
 */
const EDGES: Record<string, { scene: string; of: Record<string, string> }> = {
  "sheet-dismiss": { scene: "sheet-dismiss", of: { "sheet.top": '[data-slot="ios-new-message-sheet"] [data-slot="sheet"]' } },
  "sheet-represent": { scene: "sheet-represent", of: { "sheet.top": '[data-slot="ios-new-message-sheet"] [data-slot="sheet"]' } },
};

/**
 * Cases that are a *seekable transition* in this kit, and the scene that plays them.
 *
 * Both directions open at `theme=dark`, which looks wrong and is not. The dark variant is cancelled by
 * `[data-preview-theme="light"]` on *any* ancestor, so a wrapper that has declared itself light kills
 * dark for everything inside it and no descendant can win it back. `ThemeCrossfade` marks its own two
 * layers, so it only needs the wrapper to leave it alone — which the dark wrapper does, in either
 * direction. Opening `theme-to-dark` at `theme=light` renders both layers light and the switch never
 * appears to happen; that is measured, not theorised (mean red 242.7 at 0, 104, 246 and 492 ms alike).
 */
const TRANSITIONS: Record<string, { scene: string; theme: "light" | "dark"; caveat?: string }> = {
  "list-light-to-dark": { scene: "theme-to-dark", theme: "dark" },
  "list-dark-to-light": { scene: "theme-to-light", theme: "dark" },
  // The `appearance-*` pair records the same switch on a different backdrop, and its window is
  // truncated at both ends: §2.1's own table gives progress **0.06** at its t = 0 and 0.99 at its
  // last moving frame. Normalising against the frames it *has* therefore stretches the middle, and a
  // correct implementation reads as consistently behind it — which is exactly the shape of the
  // failures. `references/simulator-cases.md` says as much where it tells you to take durations from
  // §2.6 and not from §2.1/2.2. They are still run, because a claim you only test where it passes is
  // not tested; they are just not the primary evidence.
  "appearance-light-to-dark": { scene: "theme-to-dark", theme: "dark", caveat: "window starts 6% in (§2.1), so its normalised middle is stretched" },
  "appearance-dark-to-light": { scene: "theme-to-light", theme: "dark", caveat: "window truncated at both ends (§2.2), as above" },
};

const IOS = { width: 402, height: 874, scale: 3 };

/**
 * Mean RGB of a device-pixel rectangle, and how flat that rectangle is.
 *
 * The flatness matters more than it looks. A mean over a region that contains rows, glyphs and
 * avatars is a claim about *content*, not about colour, and our fixtures are not the simulator's
 * sample conversations — different names, different avatars, different preview text. Comparing those
 * means would manufacture failures that say nothing about the palette. So the mean is only treated as
 * a colour when the region is flat enough for one, and the recordings' own tolerances (2 to 4 of 255)
 * say that is the kind of region they chose.
 */
function sampleRegion(png: PNG, [x, y, w, h]: [number, number, number, number]) {
  const channels: [number[], number[], number[]] = [[], [], []];
  for (let row = y; row < Math.min(y + h, png.height); row++) {
    for (let column = x; column < Math.min(x + w, png.width); column++) {
      const index = (png.width * row + column) << 2;
      channels[0].push(png.data[index]!); channels[1].push(png.data[index + 1]!); channels[2].push(png.data[index + 2]!);
    }
  }
  const mean = channels.map(values => values.reduce((total, value) => total + value, 0) / (values.length || 1)) as [number, number, number];
  const deviation = Math.max(...channels.map((values, index) =>
    Math.sqrt(values.reduce((total, value) => total + (value - mean[index]!) ** 2, 0) / (values.length || 1))));
  return { mean, deviation };
}

const data: Checkpoints = JSON.parse(await readFile("references/ios/motion/simulator-checkpoints.json", "utf8"));
const cases = data.cases.filter(item => !values.case || item.case === values.case);

const browser = await chromium.launch();
const shots = new Map<string, PNG>();

/** One screenshot per (scene, theme), at the device's own scale, reused across every assertion. */
async function shot(scene: string, theme: string) {
  const key = `${scene}/${theme}`;
  const cached = shots.get(key);
  if (cached) return cached;
  const page = await browser.newPage({ viewport: { width: IOS.width, height: IOS.height }, deviceScaleFactor: IOS.scale });
  await page.goto(`${values.base}/harness?platform=ios&scene=${scene}&theme=${theme}&embed=1`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(600);
  const png = PNG.sync.read(await page.screenshot({ scale: "device" }));
  await page.close();
  shots.set(key, png);
  return png;
}

/**
 * One screenshot of a scene seeked to `ms`, clipped to the device pixels the case actually samples.
 *
 * Clipped because the alternative is a 1206x2622 bitmap per checkpoint — about 12 MB each, and a case
 * has eleven of them — on a machine that has already had a test run killed for running out of memory.
 */
async function shotAt(scene: string, theme: string, ms: number, clip: [number, number, number, number]) {
  const page = await browser.newPage({ viewport: { width: IOS.width, height: IOS.height }, deviceScaleFactor: IOS.scale });
  await page.goto(`${values.base}/harness?platform=ios&scene=${scene}&t=${ms}&theme=${theme}&embed=1`,
    { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(250);
  const png = PNG.sync.read(await page.screenshot({
    scale: "device",
    clip: { x: clip[0] / IOS.scale, y: clip[1] / IOS.scale, width: clip[2] / IOS.scale, height: clip[3] / IOS.scale },
  }));
  await page.close();
  return png;
}

/**
 * The box of one element, in device pixels relative to the device frame, with the scene seeked to
 * `ms` — or a string saying why there is no box to report.
 *
 * One page, reused across every checkpoint of every box case: the machine this runs on has already
 * had a test run killed for memory, and a box needs no bitmap at all, only a layout.
 *
 * The `data-time` check is the guard that matters. `/harness` clamps `t` to the scenario's own
 * duration, so a scene whose duration is short of a checkpoint would silently answer with its last
 * frame — and a wrong answer that looks like an answer is worse than no answer. If the page did not
 * land on the time we asked for, this reports that instead of a box.
 */
let boxPage: Awaited<ReturnType<typeof browser.newPage>> | null = null;
async function boxAt(scene: string, ms: number, selector: string): Promise<[number, number, number, number] | string> {
  boxPage ??= await browser.newPage({ viewport: { width: IOS.width, height: IOS.height }, deviceScaleFactor: IOS.scale });
  await boxPage.goto(`${values.base}/harness?platform=ios&scene=${scene}&t=${ms}&theme=light&embed=1`,
    { waitUntil: "networkidle", timeout: 60_000 });
  const measured = await boxPage.evaluate(([css, wanted]) => {
    const device = document.querySelector<HTMLElement>('[data-testid="device"]');
    if (!device) return "the harness drew no device frame";
    if (device.dataset.time !== String(wanted)) return `the harness clamped t to ${device.dataset.time} ms — the scene is shorter than this checkpoint`;
    const element = document.querySelector<HTMLElement>(css);
    if (!element) return `nothing matches ${css} at this time`;
    const frame = device.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return [rect.left - frame.left, rect.top - frame.top, rect.width, rect.height] as [number, number, number, number];
  }, [selector, ms] as const);
  return typeof measured === "string" ? measured : measured.map(value => value * IOS.scale) as [number, number, number, number];
}

/**
 * Whether the scene's timeline is actually there to be seeked — null if it is, the reason if not.
 *
 * The screen transitions are Web Animations built in a layout effect, so they exist only on a page
 * that has hydrated. A page that has not renders the sheet **at rest at every `t`**, and that reads
 * as a component which never moves rather than as a runner pointed at the wrong server: nine
 * confident failures, all of them wrong. So each timed edge case asks its element once, and a
 * missing timeline is reported as unanswerable with the reason.
 *
 * `bun run serve:test` is a server that hydrates. A `bun run dev` one that has been up for days may
 * not be — that is measured, not hypothetical.
 */
async function seekable(scene: string, ms: number, selector: string): Promise<string | null> {
  const page = await browser.newPage({ viewport: { width: IOS.width, height: IOS.height }, deviceScaleFactor: IOS.scale });
  await page.goto(`${values.base}/harness?platform=ios&scene=${scene}&t=${ms}&theme=light&embed=1`, { waitUntil: "networkidle", timeout: 60_000 });
  const animations = await page.evaluate(css => document.querySelector<HTMLElement>(css)?.getAnimations().length ?? null, selector);
  await page.close();
  if (animations === null) return `nothing matches \`${selector}\` at ${ms} ms`;
  return animations > 0 ? null
    : `nothing is animating at ${ms} ms: either the scene has no timeline to seek, or the page never hydrated (see \`seekable\`)`;
}

type Row = { case: string; at: number; kind: string; verdict: "pass" | "fail" | "unanswerable"; expected: string; ours: string; why?: string };
const rows: Row[] = [];

for (const item of cases) {
  const transition = TRANSITIONS[item.case];
  if (transition) {
    /**
     * A transition is evaluated on **how far along the ramp it is**, not on the absolute colour.
     *
     * The recording states a mean RGB over a rectangle of the simulator's own conversation list, and
     * our fixtures are not that list — different names, different avatars, different preview text —
     * so the two means are not comparable and never will be. What *is* comparable, and what the
     * recording actually pins down, is the shape in time: at 152 ms the switch was 42.0% of the way
     * from its own first frame to its own last. So each side is normalised against its own endpoints
     * and the progresses are compared. That tests the curve, which is the claim, and is blind to the
     * content, which is not.
     */
    const regions = new Map<string, Assertion[]>();
    for (const assertion of item.assertions) {
      if (assertion.kind !== "region" || !assertion.region || !assertion.rgb) {
        rows.push({
          case: item.case, at: assertion.at, kind: assertion.kind, verdict: "unanswerable",
          expected: String(assertion.differsFromSettled ?? ""), ours: "—",
          why: `${assertion.kind} assertions need a whole-frame diff against a native still, which this runner does not do yet`,
        });
        continue;
      }
      const key = assertion.region.join(",");
      regions.set(key, [...(regions.get(key) ?? []), assertion]);
    }
    if (!regions.size) continue;

    // One clip covering every region this case samples, so each checkpoint costs one small bitmap.
    const all = [...regions.keys()].map(key => key.split(",").map(Number) as [number, number, number, number]);
    const clip: [number, number, number, number] = [
      Math.min(...all.map(r => r[0])), Math.min(...all.map(r => r[1])),
      Math.max(...all.map(r => r[0] + r[2])) - Math.min(...all.map(r => r[0])),
      Math.max(...all.map(r => r[1] + r[3])) - Math.min(...all.map(r => r[1])),
    ];
    const times = [...new Set(item.assertions.filter(a => a.kind === "region").map(a => a.at))].sort((a, b) => a - b);
    const ours = new Map<number, PNG>();
    for (const ms of times) ours.set(ms, await shotAt(transition.scene, transition.theme, ms, clip));

    for (const [key, group] of regions) {
      const region = key.split(",").map(Number) as [number, number, number, number];
      const local: [number, number, number, number] = [region[0] - clip[0], region[1] - clip[1], region[2], region[3]];
      const sorted = [...group].sort((a, b) => a.at - b.at);
      const first = sorted[0]!, last = sorted.at(-1)!;
      // The channel that travels furthest is the one the ramp is legible in; a channel that barely
      // moves would turn rounding into a progress of anything at all.
      const channel = [0, 1, 2].reduce((best, index) =>
        Math.abs(last.rgb![index]! - first.rgb![index]!) > Math.abs(last.rgb![best]! - first.rgb![best]!) ? index : best, 0);
      const nativeSpan = last.rgb![channel]! - first.rgb![channel]!;
      const mine = (ms: number) => sampleRegion(ours.get(ms)!, local).mean[channel]!;
      const mySpan = mine(last.at) - mine(first.at);

      if (Math.abs(nativeSpan) < 20 || Math.abs(mySpan) < 20) {
        for (const assertion of sorted) rows.push({
          case: item.case, at: assertion.at, kind: assertion.kind, verdict: "unanswerable",
          expected: assertion.rgb!.join(","), ours: mine(assertion.at).toFixed(1),
          why: `this region barely changes across the switch (native ${nativeSpan.toFixed(0)}/255, ours ${mySpan.toFixed(0)}/255), so a progress read off it would be noise`,
        });
        continue;
      }

      for (const assertion of sorted) {
        const nativeProgress = (assertion.rgb![channel]! - first.rgb![channel]!) / nativeSpan;
        const myProgress = (mine(assertion.at) - mine(first.at)) / mySpan;
        // The recording's own tolerance, carried across into progress by the span it was stated over.
        const tolerance = (assertion.tol ?? 4) / Math.abs(nativeSpan);
        const off = Math.abs(myProgress - nativeProgress);
        rows.push({
          case: item.case, at: assertion.at, kind: assertion.kind,
          verdict: off <= tolerance ? "pass" : "fail",
          expected: `${(nativeProgress * 100).toFixed(1)}%`,
          ours: `${(myProgress * 100).toFixed(1)}%`,
          why: off <= tolerance ? undefined
            : `${(off * 100).toFixed(1)} points off, against ${(tolerance * 100).toFixed(1)} allowed`,
        });
      }
    }
    continue;
  }

  const boxCase = BOXES[item.case];
  if (boxCase) {
    for (const assertion of item.assertions) {
      if (assertion.kind !== "box" || !assertion.box) {
        rows.push({
          case: item.case, at: assertion.at, kind: assertion.kind, verdict: "unanswerable",
          expected: String(assertion.differsFromSettled ?? ""), ours: "—",
          why: `this case is mapped to a surface by its box, and a ${assertion.kind} assertion is a different question`,
        });
        continue;
      }
      const ours = await boxAt(boxCase.scene, assertion.at, boxCase.selector);
      const expected = assertion.box.join(",");
      if (typeof ours === "string") {
        rows.push({ case: item.case, at: assertion.at, kind: assertion.kind, verdict: "unanswerable", expected, ours: "—", why: ours });
        continue;
      }
      // The recording's own tolerance, in device pixels, applied to each edge — the widest miss of
      // the four is the verdict, so a right edge that is 30 px out cannot hide behind a left edge
      // that is exact.
      const tolerance = assertion.tol ?? 12;
      const off = ours.map((value, index) => Math.abs(value - assertion.box![index]!));
      const worst = Math.max(...off);
      const channel = ["x", "y", "w", "h"][off.indexOf(worst)];
      rows.push({
        case: item.case, at: assertion.at, kind: assertion.kind,
        verdict: worst <= tolerance ? "pass" : "fail",
        expected, ours: ours.map(value => value.toFixed(1)).join(","),
        why: worst <= tolerance ? undefined : `${channel} is off by ${worst.toFixed(1)} px against a tolerance of ${tolerance}`,
      });
    }
    continue;
  }

  const edgeCase = EDGES[item.case];
  if (edgeCase) {
    // Asked once, at the case's own middle checkpoint, and only where there is a timeline to ask
    // about: `sheet-represent` is a still on purpose — the device does not animate a re-present.
    const middle = item.checkpoints[Math.floor(item.checkpoints.length / 2)] ?? 0;
    const dead = item.duration > 0 ? await seekable(edgeCase.scene, middle, Object.values(edgeCase.of)[0]!) : null;
    for (const assertion of item.assertions) {
      if (dead) {
        rows.push({ case: item.case, at: assertion.at, kind: assertion.kind, verdict: "unanswerable", expected: `${assertion.y ?? "?"} px`, ours: "—", why: dead });
        continue;
      }
      const selector = assertion.kind === "edge" && assertion.edge ? edgeCase.of[assertion.edge] : undefined;
      if (!selector || assertion.y === undefined) {
        rows.push({
          case: item.case, at: assertion.at, kind: assertion.kind, verdict: "unanswerable",
          expected: assertion.y === undefined ? String(assertion.differsFromSettled ?? "") : `${assertion.y} px`, ours: "—",
          why: assertion.kind === "edge"
            ? `nothing in the ${edgeCase.scene} scene is mapped to the edge \`${assertion.edge}\``
            : `this case is mapped to a surface by one edge, and a ${assertion.kind} assertion is a different question`,
        });
        continue;
      }
      const box = await boxAt(edgeCase.scene, assertion.at, selector);
      const expected = `${assertion.y} px`;
      if (typeof box === "string") {
        rows.push({ case: item.case, at: assertion.at, kind: assertion.kind, verdict: "unanswerable", expected, ours: "—", why: box });
        continue;
      }
      // Once the edge is past the bottom of the screen the recorder could only say "gone", and the
      // checkpoint encodes that as the screen's own height with a tolerance of zero. An edge at or
      // below the bottom is gone by the same rule; one still short of it reports where it really is,
      // and fails — which is the point of the zero tolerance and is not loosened here.
      const ours = Math.min(box[1], data.device.px[1]);
      const tolerance = assertion.tol ?? 0;
      const off = Math.abs(ours - assertion.y);
      rows.push({
        case: item.case, at: assertion.at, kind: assertion.kind,
        verdict: off <= tolerance ? "pass" : "fail",
        expected, ours: `${ours.toFixed(1)} px`,
        why: off <= tolerance ? undefined : `off by ${off.toFixed(1)} px against a tolerance of ${tolerance}`,
      });
    }
    continue;
  }

  const subject = SUBJECTS[item.case];
  if (!subject || "unanswerable" in subject) {
    for (const assertion of item.assertions) {
      rows.push({
        case: item.case, at: assertion.at, kind: assertion.kind, verdict: "unanswerable",
        expected: assertion.rgb ? assertion.rgb.join(",") : String(assertion.differsFromSettled ?? ""),
        ours: "—", why: subject ? subject.unanswerable : "no mapping",
      });
    }
    continue;
  }

  const settled = Math.max(...item.assertions.map(assertion => assertion.at));
  for (const assertion of item.assertions) {
    // Only the two ends of a theme change are answerable, because that is all our surfaces have: the
    // class swaps and the new colour is there in the same frame.
    const end = assertion.at === 0 ? "from" : assertion.at >= item.duration && assertion.at >= settled - 60 ? "to" : null;
    if (assertion.kind !== "region" || !assertion.region || !assertion.rgb || !end) {
      rows.push({
        case: item.case, at: assertion.at, kind: assertion.kind, verdict: "unanswerable",
        expected: assertion.rgb ? assertion.rgb.join(",") : String(assertion.differsFromSettled ?? ""),
        ours: "—",
        // Grouped rather than per-time, so the summary reads as one finding with a count instead of
        // thirty near-identical lines saying the same thing about the same missing timeline.
        why: assertion.kind !== "region"
          ? `${assertion.kind} assertions need a seekable timeline; the theme swap has none`
          : `mid-transition, and our theme swap is instantaneous (native takes 492 ms into dark, 495 ms back, on two different curves)`,
      });
      continue;
    }
    const png = await shot(subject.scene, end === "from" ? subject.from : subject.to);
    const { mean, deviation } = sampleRegion(png, assertion.region);
    const tolerance = assertion.tol ?? 4;
    // Twice the assertion's own tolerance: a region whose pixels vary by more than that is carrying
    // content, and its mean is not the colour claim the recording made.
    if (deviation > tolerance * 2) {
      rows.push({
        case: item.case, at: assertion.at, kind: assertion.kind, verdict: "unanswerable",
        expected: assertion.rgb.join(","), ours: mean.map(channel => channel.toFixed(1)).join(","),
        why: `the region is not flat in our render (sd ${deviation.toFixed(1)}), so its mean is content rather than colour — our fixtures are not the simulator's sample conversations`,
      });
      continue;
    }
    // A saturated target against a flat grey of ours means the *element* is missing, not that its
    // colour is wrong: the two systemBlue samples here land where our list scene draws nothing at all.
    // Reporting that as "systemBlue off by 243" would be true arithmetic and a false finding.
    const spread = (colour: readonly number[]) => Math.max(...colour) - Math.min(...colour);
    if (spread(assertion.rgb) > 20 && spread(mean) < 3) {
      rows.push({
        case: item.case, at: assertion.at, kind: assertion.kind, verdict: "unanswerable",
        expected: assertion.rgb.join(","), ours: mean.map(channel => channel.toFixed(1)).join(","),
        why: `${assertion.note ?? "a coloured element"} is at this region on the device and our ${subject.scene} scene draws nothing there`,
      });
      continue;
    }
    const delta = Math.max(...mean.map((channel, index) => Math.abs(channel - assertion.rgb![index]!)));
    rows.push({
      case: item.case, at: assertion.at, kind: assertion.kind,
      verdict: delta <= tolerance ? "pass" : "fail",
      expected: assertion.rgb.join(","),
      ours: mean.map(channel => channel.toFixed(1)).join(","),
      why: delta <= tolerance ? undefined : `off by ${delta.toFixed(1)} against a tolerance of ${tolerance}`,
    });
  }
}

await browser.close();

const tally = (verdict: Row["verdict"]) => rows.filter(row => row.verdict === verdict).length;
console.log(`\n${rows.length} native checkpoints from ${cases.length} recordings\n`);
for (const item of cases) {
  const mine = rows.filter(row => row.case === item.case);
  const pass = mine.filter(row => row.verdict === "pass").length;
  const fail = mine.filter(row => row.verdict === "fail").length;
  const open = mine.filter(row => row.verdict === "unanswerable").length;
  console.log(`  ${item.case.padEnd(26)} ${String(pass).padStart(3)} pass  ${String(fail).padStart(3)} fail  ${String(open).padStart(3)} unanswerable`);
  const caveat = TRANSITIONS[item.case]?.caveat;
  if (caveat) console.log(`      note: ${caveat}`);
  for (const row of mine.filter(candidate => candidate.verdict === "fail")) {
    console.log(`      ${String(row.at).padStart(4)} ms  want ${row.expected.padEnd(14)} got ${row.ours.padEnd(18)} ${row.why}`);
  }
}
const reasons = new Map<string, number>();
for (const row of rows.filter(candidate => candidate.verdict === "unanswerable" && candidate.why)) {
  reasons.set(row.why!, (reasons.get(row.why!) ?? 0) + 1);
}
console.log(`\nWhat we cannot be asked yet, and why:`);
for (const [why, count] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)}  ${why}`);
console.log(`\n${tally("pass")} pass, ${tally("fail")} fail, ${tally("unanswerable")} unanswerable.`);

if (values.json) {
  await writeFile(values.json, JSON.stringify({ rows, tally: { pass: tally("pass"), fail: tally("fail"), unanswerable: tally("unanswerable") } }, null, 2) + "\n");
  console.log(`wrote ${values.json}`);
}
// A failing checkpoint is a defect; an unanswerable one is work not started. Only the first is an error.
process.exit(tally("fail") ? 1 : 0);
