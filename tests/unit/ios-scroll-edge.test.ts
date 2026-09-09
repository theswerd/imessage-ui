import { describe, expect, test } from "bun:test";
import { iosScrollEdge, iosScrollEdgeVars } from "../../registry/imessage/ios-scroll-edge";

/**
 * `iosScrollEdgeVars` has to spell its four lengths out as literal text — Tailwind scans source and
 * cannot see a class assembled from a template literal — so nothing in the type system keeps it in
 * step with `iosScrollEdge`, which is where the measurement lives. This is that guard.
 */
describe("the iOS scroll-edge tokens", () => {
  const read = (name: string) => {
    const found = [...iosScrollEdgeVars.matchAll(/(dark:)?\[--ios-se-(full|zero):([\d.]+)px\]/g)]
      .find(match => `${match[1] ? "dark:" : ""}${match[2]}` === name);
    return found ? Number(found[3]) : null;
  };

  test("carries every stop the ramp defines, and only those", () => {
    expect(read("full")).toBe(iosScrollEdge.light.full);
    expect(read("zero")).toBe(iosScrollEdge.light.zero);
    expect(read("dark:full")).toBe(iosScrollEdge.dark.full);
    expect(read("dark:zero")).toBe(iosScrollEdge.dark.zero);
    expect(iosScrollEdgeVars.split(" ").filter(Boolean)).toHaveLength(4);
  });

  test("ramps downward in both themes, so the wash lets go below the bar rather than above it", () => {
    for (const ramp of [iosScrollEdge.light, iosScrollEdge.dark]) {
      expect(ramp.zero).toBeGreaterThan(ramp.full);
      // The bar's own bottom edge is the 54 pt status bar plus its 94: a ramp that ended above that
      // would leave a hard step where the glass ends, which is the defect this exists to fix.
      expect(ramp.zero).toBeGreaterThan(54 + 94);
    }
  });

  /**
   * The slopes the fits produced, kept here so a later edit that "tidies" one endpoint has to face
   * the number it changes. Light: −0.01025 per pt over 97.53. Dark: −0.01212 over 82.54.
   */
  test("keeps the two measured spans, which do not agree with each other", () => {
    expect(iosScrollEdge.light.zero - iosScrollEdge.light.full).toBeCloseTo(97.54, 1);
    expect(iosScrollEdge.dark.zero - iosScrollEdge.dark.full).toBeCloseTo(82.54, 1);
  });
});
