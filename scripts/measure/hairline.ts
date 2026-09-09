/**
 * Hairline detector: finds one-pixel light or dark lines that no shape should produce.
 *
 * A seam between two separately rasterized layers (the bubble body's clip-path and the tail's) shows
 * up as a run of pixels that are lighter than *both* their neighbours across the run's whole length.
 * Real geometry never does that: an edge is a monotone ramp, a glyph stroke is two ramps around a
 * plateau, and neither is a single row that is brighter than the rows above and below it for tens of
 * pixels. So the test is: for every pixel, is it a strict local extremum along one axis, by more than
 * `--delta`, and is it part of a run of at least `--run` such pixels along the other axis?
 *
 * `scripts/measure/hairline-scan.ts` is the CLI over a live page; `tests/e2e/hairlines.spec.ts` is
 * the gate. This file stays free of `import.meta` so Playwright, which transpiles specs to CJS, can
 * import it.
 */
import type { PNG } from "pngjs";

export type Run = { axis: "row" | "col"; at: number; from: number; to: number; peak: number; sign: 1 | -1 };

export function findHairlines(png: PNG, delta: number, minRun: number): Run[] {
  const { width, height, data } = png;
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  const runs: Run[] = [];
  const sweep = (axis: "row" | "col") => {
    const outer = axis === "row" ? height : width;
    const inner = axis === "row" ? width : height;
    const at = (o: number, i: number) => (axis === "row" ? lum[o * width + i] : lum[i * width + o]);
    for (let o = 1; o < outer - 1; o++) {
      let start = -1;
      let peak = 0;
      let sign: 1 | -1 = 1;
      const close = (end: number) => {
        if (start >= 0 && end - start >= minRun) runs.push({ axis, at: o, from: start, to: end - 1, peak, sign });
        start = -1;
        peak = 0;
      };
      for (let i = 0; i < inner; i++) {
        const v = at(o, i);
        const a = at(o - 1, i);
        const b = at(o + 1, i);
        // Only a strict local extremum counts. A plain antialiased edge is monotone across the
        // three samples, and taking whichever of the two differences is larger would flag every one
        // of them; requiring both differences to have the same sign is what separates a hairline
        // from an edge.
        const up = Math.min(v - a, v - b);
        const down = Math.min(a - v, b - v);
        const d = up > 0 ? up : down > 0 ? -down : 0;
        const s: 1 | -1 = d >= 0 ? 1 : -1;
        if (d !== 0 && Math.abs(d) >= delta && (start < 0 || s === sign)) {
          if (start < 0) { start = i; sign = s; peak = 0; }
          peak = Math.max(peak, Math.abs(d));
        } else {
          close(i);
        }
      }
      close(inner);
    }
  };
  sweep("row");
  sweep("col");
  return runs;
}
