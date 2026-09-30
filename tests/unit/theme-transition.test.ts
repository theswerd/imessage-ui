import { describe, expect, test } from "bun:test";
import { iosThemeCrossfade, themeCrossfadeProgress } from "../../registry/imessage/theme-transition";

/**
 * The appearance switch, against the frames it was recorded from.
 *
 * Every number here is a sample from `references/ios/motion/simulator-checkpoints.json`, which came
 * off a real iPhone 17 Pro on iOS 26. The point of the file is that the two directions are *different
 * curves*, so the tests that matter are the ones at half time.
 */
describe("the appearance crossfade", () => {
  test("reproduces every recorded sample exactly", () => {
    for (const [ms, progress] of iosThemeCrossfade.toDark.ramp) {
      expect(themeCrossfadeProgress("dark", ms)).toBeCloseTo(progress, 6);
    }
    for (const [ms, progress] of iosThemeCrossfade.toLight.ramp) {
      expect(themeCrossfadeProgress("light", ms)).toBeCloseTo(progress, 6);
    }
  });

  test("takes 492 ms into dark and 495 ms back, not one duration for both", () => {
    expect(iosThemeCrossfade.toDark.duration).toBe(492);
    expect(iosThemeCrossfade.toLight.duration).toBe(495);
  });

  /**
   * The asymmetry, which is the whole reason this is a table and not a `transition` shorthand. Going
   * dark is decelerating and coming back is accelerating; a single eased duration cannot be both.
   */
  test("going dark decelerates and coming back accelerates", () => {
    const intoDark = themeCrossfadeProgress("dark", iosThemeCrossfade.toDark.duration / 2);
    const intoLight = themeCrossfadeProgress("light", iosThemeCrossfade.toLight.duration / 2);
    expect(intoDark).toBeGreaterThan(0.6);
    expect(intoLight).toBeLessThan(0.45);
    // And they are not reverses of one another, which is the shape a naive implementation would give.
    expect(intoDark + intoLight).not.toBeCloseTo(1, 1);
  });

  test("is clamped at both ends", () => {
    expect(themeCrossfadeProgress("dark", -50)).toBe(0);
    expect(themeCrossfadeProgress("dark", 10_000)).toBe(1);
  });



});
