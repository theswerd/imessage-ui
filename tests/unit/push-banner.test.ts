import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  iosPushBannerFrames, iosPushBannerMotion, pushBannerBoxAt, pushBannerScale, type PushBannerKind,
} from "../../registry/imessage/ios-push-banner";
import { frameAt, scenarios } from "../../harness/scenarios";

/**
 * The notification banner, against the recording it came from.
 *
 * The point of these tests is provenance, not behaviour. `ios-push-banner.tsx` claims its keyframes
 * are `references/ios/motion/simulator-checkpoints.json` transcribed, so the first test reads that
 * file and checks the two are the same numbers — if somebody nudges a keyframe to make a checkpoint
 * pass, this is what catches it. Everything after that tests the two things the table *says*: that
 * the banner expands out of the Dynamic Island rather than sliding down, and that its height clamps.
 */

type BoxAssertion = { at: number; kind: string; box?: [number, number, number, number]; tol?: number };
type RecordedCase = { case: string; duration: number; checkpoints: number[]; assertions: BoxAssertion[] };
const recorded: RecordedCase[] = JSON.parse(
  readFileSync("references/ios/motion/simulator-checkpoints.json", "utf8"),
).cases;
const caseFor = (kind: PushBannerKind) => recorded.find(item => item.case === `push-banner-${kind}`)!;
const kinds: PushBannerKind[] = ["short", "long", "group"];

describe("the iOS 26 notification banner", () => {
  test("every measured keyframe is a box assertion of the recording, verbatim", () => {
    for (const kind of kinds) {
      const boxes = caseFor(kind).assertions.filter(assertion => assertion.kind === "box");
      const measured = iosPushBannerFrames[kind].filter(frame => frame.measured);
      expect(`${kind}: ${measured.length}`).toBe(`${kind}: ${boxes.length}`);
      for (const [index, frame] of measured.entries()) {
        expect(`${kind} @${frame.at}: ${frame.px.join(",")}`).toBe(`${kind} @${boxes[index]!.at}: ${boxes[index]!.box!.join(",")}`);
      }
    }
  });

  /**
   * The one row in the table that is not a recorded frame — the end of the short banner's hold — is
   * bounded by the recording rather than chosen: 7132 is stated to be the *first* retraction frame,
   * so at 60 fps the last settled frame is one frame earlier.
   */
  test("the single unmeasured keyframe is the hold's end, and it is the settled box", () => {
    const invented = kinds.flatMap(kind => iosPushBannerFrames[kind].filter(frame => !frame.measured).map(frame => ({ kind, frame })));
    expect(invented.length).toBe(1);
    expect(invented[0]!.kind).toBe("short");
    expect(invented[0]!.frame.at).toBeCloseTo(7132 - 1000 / 60, 6);
    expect(invented[0]!.frame.px).toEqual([0, 0, 1206, 528]);
  });

  test("reproduces every recorded box exactly, in points", () => {
    for (const kind of kinds) {
      for (const assertion of caseFor(kind).assertions) {
        if (assertion.kind !== "box") continue;
        const [x, y, width, height] = assertion.box!;
        const box = pushBannerBoxAt(kind, assertion.at);
        expect(`${kind} @${assertion.at}`).toBe(`${kind} @${assertion.at}`);
        expect(box.x * pushBannerScale).toBeCloseTo(x, 6);
        expect(box.y * pushBannerScale).toBeCloseTo(y, 6);
        expect(box.width * pushBannerScale).toBeCloseTo(width, 6);
        expect(box.height * pushBannerScale).toBeCloseTo(height, 6);
      }
    }
  });

  /**
   * The claim that made this a component instead of a CSS transition: it does not slide down. At the
   * first recorded frame it is a stub near the top centre at the width the recording attributes to
   * the Dynamic Island, and it grows outward — the left edge falls to 0 while the right edge rises.
   */
  test("expands out of the island rather than sliding down", () => {
    const first = pushBannerBoxAt("short", 0);
    const settled = pushBannerBoxAt("short", 200);
    expect(first.y).toBe(0);
    expect(settled.y).toBe(0);
    expect(first.width * pushBannerScale).toBe(622);
    expect(settled.width * pushBannerScale).toBe(1206);
    // Outward in both directions: the leading edge moves left and the trailing edge moves right.
    expect(first.x).toBeGreaterThan(settled.x);
    expect(first.x + first.width).toBeLessThan(settled.x + settled.width);
  });

  /** Height and width do not run together: the height is nearly done while the width is not. */
  test("is at 80% of its height while still short of full width", () => {
    const at85 = pushBannerBoxAt("short", 85);
    const settled = pushBannerBoxAt("short", 200);
    expect(at85.height / settled.height).toBeGreaterThan(0.8);
    expect(at85.width).toBeLessThan(settled.width * 0.95);
  });

  /**
   * The clamp. A three-or-more-line body buys 14 pt and a group subtitle 5 pt — which is why the
   * component takes its height from the recording per shape and clips the content, rather than
   * growing to fit it.
   */
  test("clamps: a long body buys 41 device px and a subtitle 15, not a line's worth", () => {
    const px = (kind: PushBannerKind) => iosPushBannerMotion[kind].settledHeight * pushBannerScale;
    expect(px("short")).toBe(528);
    expect(px("long")).toBe(569);
    expect(px("group")).toBe(543);
    // 41 device px is 13.67 pt, not the 14 it rounds to, and 15 px is 5 pt on the nose.
    expect(px("long") - px("short")).toBe(41);
    expect((px("long") - px("short")) / pushBannerScale).toBeCloseTo(13.6667, 4);
    expect((px("group") - px("short")) / pushBannerScale).toBeCloseTo(5, 6);
    // A line of body at any plausible type size is more than 13.67 pt, so this is not "one more line".
    expect((px("long") - px("short")) / pushBannerScale).toBeLessThan(17);
  });

  test("holds for 7.1 s and only then starts back, and the hold does not drift", () => {
    expect(iosPushBannerMotion.short.hold).toBe(7132);
    const settled = pushBannerBoxAt("short", 200);
    for (const ms of [201, 1000, 3500, 6000, 7115]) {
      expect(`${ms}: ${JSON.stringify(pushBannerBoxAt("short", ms))}`).toBe(`${ms}: ${JSON.stringify(settled)}`);
    }
    expect(pushBannerBoxAt("short", 7132).width).toBeLessThan(settled.width);
  });

  test("interpolates linearly between recorded frames and holds outside them", () => {
    // Halfway between 0 ms (x 300) and 17 ms (x 258).
    expect(pushBannerBoxAt("short", 8.5).x * pushBannerScale).toBeCloseTo(279, 6);
    // Before the first frame and past the last, the box is held rather than extrapolated.
    expect(pushBannerBoxAt("short", -100)).toEqual(pushBannerBoxAt("short", 0));
    expect(pushBannerBoxAt("short", 20_000)).toEqual(pushBannerBoxAt("short", 7132));
    expect(pushBannerBoxAt("group", 400)).toEqual(pushBannerBoxAt("group", 215));
  });

  /** The recorded long banner's width dips before it opens. Reproduced, not smoothed. */
  test("the long banner's recorded non-monotonic width is kept", () => {
    const width = (ms: number) => pushBannerBoxAt("long", ms).width * pushBannerScale;
    expect(width(50)).toBeLessThan(width(0));
    expect(width(116)).toBeLessThan(width(50));
    expect(width(150)).toBeGreaterThan(width(0));
  });
});

describe("the banner scenes", () => {
  test("each scene's checkpoints are exactly the times the recording asserts a box at", () => {
    for (const kind of kinds) {
      const scenario = scenarios.find(item => item.id === `push-banner-${kind}`)!;
      const times = caseFor(kind).assertions.filter(assertion => assertion.kind === "box").map(assertion => assertion.at);
      expect(`${kind}: ${scenario.checkpoints.join(",")}`).toBe(`${kind}: ${times.join(",")}`);
      // A seeked scene has to reach its last checkpoint, or the eval cannot ask about it.
      expect(`${kind}: ${scenario.duration}`).toBe(`${kind}: ${times.at(-1)!}`);
    }
  });

  test("a scene frame carries the millisecond, not a normalized progress", () => {
    for (const time of [0, 85, 200, 7132]) {
      expect(frameAt("push-banner-short", time).pushBanner).toEqual({ kind: "short", ms: time });
    }
    expect(frameAt("push-banner-long", 116).pushBanner).toEqual({ kind: "long", ms: 116 });
    expect(frameAt("push-banner-group", 133).pushBanner).toEqual({ kind: "group", ms: 133 });
    // The banner is over a screen, and the screen is not part of what was recorded — but it has to be
    // the same one at every checkpoint, or the box would be the only thing that held still.
    for (const time of [0, 200, 7132]) expect(frameAt("push-banner-short", time).screen).toBe("list");
  });
});
