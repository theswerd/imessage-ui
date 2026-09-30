import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { iosSheetDismissal, iosSheetDismissKeyframes } from "../../registry/imessage/ios-new-message-sheet";
import { frameAt, nativeMotion, scenarios } from "../../harness/scenarios";

/**
 * The compose sheet's dismissal against the recording it came from.
 *
 * `references/ios/motion/simulator-checkpoints.json` is the source of truth here, not a copy of it:
 * these tests read the file. A sample edited in the component and not in the recording — or a
 * checkpoint quietly moved off a sampled time — fails here rather than turning up as a passing
 * evaluation of a claim nobody made.
 */
type EdgeAssertion = { at: number; kind: string; edge?: string; y?: number; tol?: number };
const checkpoints = JSON.parse(readFileSync("references/ios/motion/simulator-checkpoints.json", "utf8")) as {
  device: { px: [number, number]; scale: number };
  cases: Array<{ case: string; duration: number; checkpoints: number[]; assertions: EdgeAssertion[] }>;
};
const caseFor = (name: string) => checkpoints.cases.find(item => item.case === name)!;
/** Widen a `as const` constant to a plain number, so it can be compared with one the JSON supplies. */
const plain = (value: number) => value;
const plainList = (values: readonly number[]) => [...values];
const dismiss = caseFor("sheet-dismiss");
const edges = dismiss.assertions.filter(assertion => assertion.kind === "edge" && assertion.edge === "sheet.top");

describe("the measured dismissal", () => {
  test("every sample in the component is a sample the recording took", () => {
    expect(iosSheetDismissal.samples.map(sample => `${sample.t}:${sample.y}`).join(" "))
      .toBe(edges.map(assertion => `${assertion.at}:${assertion.y}`).join(" "));
    expect(plain(iosSheetDismissal.duration)).toBe(dismiss.duration);
    expect(plain(iosSheetDismissal.screenHeight)).toBe(checkpoints.device.px[1]);
  });

  test("the panel rests at the sheet's own 62 pt top edge", () => {
    // 186 device px at 3x is the `top: 62` the capture measured. If the sheet's geometry moves, the
    // recording's first sample stops describing it and this is where that shows up.
    expect(iosSheetDismissal.samples[0]!.y / checkpoints.device.scale).toBe(62);
    expect(iosSheetDismissal.samples.at(-1)!.y).toBe(iosSheetDismissal.screenHeight);
  });

  /**
   * `translateY(100%)` is the panel's own height, and the panel spans its resting top edge to the
   * bottom of the screen — so a keyframe's percentage is the share of the recorded travel, and a
   * frame seeked to a sampled millisecond lands on the sample. Anything else means the offsets and
   * the recording have come apart.
   */
  test("each keyframe puts the edge back on the pixel it was recorded at", () => {
    const frames = iosSheetDismissKeyframes();
    expect(frames).toHaveLength(iosSheetDismissal.samples.length);
    const rest = iosSheetDismissal.samples[0]!.y;
    const travel = iosSheetDismissal.screenHeight - rest;
    for (const [index, keyframe] of frames.entries()) {
      const sample = iosSheetDismissal.samples[index]!;
      expect(keyframe.offset).toBeCloseTo(sample.t / iosSheetDismissal.duration, 10);
      const percent = Number(/translateY\(([-\d.]+)%\)/.exec(String(keyframe.transform))![1]);
      expect(rest + (percent / 100) * travel).toBeCloseTo(sample.y, 1);
    }
  });

  /**
   * The reason this is a table and not a duration plus an ease. A straight line over the same 200 ms
   * hits both ends and is outside the recording's own tolerance at 15 and 31 ms — and inside it at
   * every later sample, which is worth knowing too: the curve is pinned by its slow start, and a
   * checkpoint set that skipped the first 31 ms would not have caught a linear slide at all.
   */
  test("a linear slide fails exactly the first two samples, on the recording's own tolerances", () => {
    const rest = iosSheetDismissal.samples[0]!.y;
    const travel = iosSheetDismissal.screenHeight - rest;
    const missed = edges.filter(assertion => {
      const linear = rest + travel * (assertion.at / iosSheetDismissal.duration);
      return Math.abs(linear - assertion.y!) > (assertion.tol ?? 0);
    });
    expect(missed.map(assertion => assertion.at)).toEqual([15, 31]);
  });
});

describe("the two scenes", () => {
  test("sheet-dismiss checkpoints every time the recording asserts an edge at", () => {
    const scene = scenarios.find(item => item.id === "sheet-dismiss")!;
    expect(plain(scene.duration)).toBe(nativeMotion.sheetDismiss);
    expect(plainList(scene.checkpoints)).toEqual(dismiss.checkpoints);
    // Every asserted time must be seekable, or the evaluation cannot ask about it.
    for (const assertion of edges) expect(plainList(scene.checkpoints)).toContain(assertion.at);
  });

  test("sheet-dismiss states the shell's dismissal, scrubbed by the millisecond", () => {
    expect(frameAt("sheet-dismiss", 0).screen).toBe("list");
    expect(frameAt("sheet-dismiss", 0).screenTransition).toEqual({ from: "new-message", progress: 0 });
    expect(frameAt("sheet-dismiss", 98).screenTransition!.progress).toBeCloseTo(0.49, 10);
    expect(frameAt("sheet-dismiss", 200).screenTransition!.progress).toBe(1);
  });

  /**
   * The re-present is a claim about *nothing happening*: `duration: 0`, one checkpoint, and a frame
   * that tells the shell this sheet has been built before — which is the only thing that makes it a
   * represent rather than a presentation.
   */
  test("sheet-represent is a still, and says the sheet is already built", () => {
    const scene = scenarios.find(item => item.id === "sheet-represent")!;
    expect(plain(scene.duration)).toBe(0);
    expect(plainList(scene.checkpoints)).toEqual(caseFor("sheet-represent").checkpoints);
    const frame = frameAt("sheet-represent", 0);
    expect(frame.screen).toBe("new-message");
    expect(frame.screenTransition).toEqual({ from: "list", progress: 1, represent: true });
  });
});
