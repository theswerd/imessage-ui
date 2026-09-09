// Colour statistics for two same-size RGBA rasters: the error pixelmatch cannot express.
//
// pixelmatch answers "how many pixels moved?" and is deliberately blind to a small uniform colour
// shift: at threshold 0.1 a whole surface can sit 11/255 off and still score clean. These answer
// "how far off is the colour?", over ours - ref (negative = ours is darker than the capture):
//
//   mean signed   averaged ours - ref. A tint has a large |mean signed|; anti-aliasing cancels out.
//   mean abs      averaged |ours - ref|.
//   p95 abs       95th percentile of the per-pixel absolute error, nearest-rank.
//   worst blob    the largest 8-connected run of pixels whose absolute error exceeds blobThreshold.
//
// Per-pixel error is the mean over R, G and B; the per-channel signed means are reported beside it,
// so a neutral shift (all three equal) reads differently from a hue shift. Alpha is not compared;
// the count of non-opaque pixels is reported instead, because a translucent pixel's colour depends
// on what it was composited over and neither raster carries that.
//
// Every statistic is reported three ways: the whole region, its interior, and its edges. A pixel is
// an edge pixel when it lies within `erode` device px of a place where either raster's colour steps
// by more than `edgeThreshold` between neighbours, or within `erode` px of the region border (what
// lies outside the crop is unknown). Anti-aliasing lives on edges; a tint lives in interiors.
//
// usage: bun scripts/measure/shift.ts <ref.png> <ours.png> [out-dir] [--flag=value ...]
//   flags: --heat-scale (16) --edge-threshold (8) --erode (3) --blob-threshold (4) --threshold (0.1)
//   Compares two PNGs already on disk, with the same pixelmatch settings compare.ts uses, and writes
//   heat.png into out-dir when one is given.
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "node:fs";

export interface ShiftOptions {
  /** Per-channel step between neighbouring pixels that counts as a feature edge. */
  edgeThreshold?: number;
  /** How far, in device px, the edge set is grown before the rest is called interior. */
  erode?: number;
  /** Per-pixel absolute error a pixel must exceed to join a blob. */
  blobThreshold?: number;
}

export interface BlobStats {
  count: number;
  share: number;
  meanSigned: number;
  meanAbs: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SetStats {
  name: string;
  count: number;
  share: number;
  meanSigned: number;
  meanSignedRgb: [number, number, number];
  meanAbs: number;
  p95Abs: number;
  maxAbs: number;
  blob: BlobStats | null;
}

export interface ShiftReport {
  width: number;
  height: number;
  total: number;
  nonOpaque: number;
  edgeThreshold: number;
  erode: number;
  blobThreshold: number;
  all: SetStats;
  interior: SetStats;
  edge: SetStats;
  /** Per-pixel mean signed error, ours - ref, in raster order. */
  signed: Float32Array;
  /** Per-pixel mean absolute error, in raster order. */
  abs: Float32Array;
  /** 1 where the pixel is within `erode` px of a feature edge or the region border. */
  isEdge: Uint8Array;
}

const channelStep = (a: Uint8Array, p: number, q: number) =>
  Math.max(Math.abs(a[p] - a[q]), Math.abs(a[p + 1] - a[q + 1]), Math.abs(a[p + 2] - a[q + 2]));

/** 1 for every pixel within `radius` device px of a colour step over `threshold`, or of the border. */
function markEdges(
  ref: Uint8Array,
  ours: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  radius: number,
): Uint8Array {
  const seed = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const p = i * 4;
      if (x + 1 < width && (channelStep(ref, p, p + 4) > threshold || channelStep(ours, p, p + 4) > threshold)) {
        seed[i] = 1;
        seed[i + 1] = 1;
      }
      const down = p + width * 4;
      if (y + 1 < height && (channelStep(ref, p, down) > threshold || channelStep(ours, p, down) > threshold)) {
        seed[i] = 1;
        seed[i + width] = 1;
      }
    }
  }
  // Chebyshev dilation by `radius`, as two separable passes.
  const wide = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = 0;
      for (let k = -radius; k <= radius && !hit; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < width && seed[y * width + xx]) hit = 1;
      }
      wide[y * width + x] = hit;
    }
  }
  const grown = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = 0;
      for (let k = -radius; k <= radius && !hit; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < height && wide[yy * width + x]) hit = 1;
      }
      grown[y * width + x] = hit;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < radius || y < radius || x >= width - radius || y >= height - radius) grown[y * width + x] = 1;
    }
  }
  return grown;
}

/** The largest 8-connected component of `mask`, with its own error means. */
function largestBlob(
  mask: Uint8Array,
  width: number,
  height: number,
  signed: Float32Array,
  abs: Float32Array,
  population: number,
): BlobStats | null {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  let best: BlobStats | null = null;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let count = 0;
    let sumSigned = 0;
    let sumAbs = 0;
    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;
    while (top > 0) {
      const i = stack[--top];
      const x = i % width;
      const y = (i - x) / width;
      count++;
      sumSigned += signed[i];
      sumAbs += abs[i];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue;
          const j = ny * width + nx;
          if (mask[j] && !seen[j]) {
            seen[j] = 1;
            stack[top++] = j;
          }
        }
      }
    }
    if (!best || count > best.count) {
      best = { count, share: population ? count / population : 0, meanSigned: sumSigned / count, meanAbs: sumAbs / count, x0, y0, x1, y1 };
    }
  }
  return best;
}

/** Nearest-rank percentile: the smallest value at or above `q` of the sorted population. */
function percentile(sorted: Float32Array, q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const rank = Math.max(1, Math.ceil(q * sorted.length));
  return sorted[rank - 1];
}

function subsetStats(
  name: string,
  select: Uint8Array | null,
  want: number,
  ref: Uint8Array,
  ours: Uint8Array,
  signed: Float32Array,
  abs: Float32Array,
  width: number,
  height: number,
  total: number,
  blobThreshold: number,
): SetStats {
  let count = 0;
  let sumSigned = 0;
  let sumAbs = 0;
  let maxAbs = 0;
  const sumRgb: [number, number, number] = [0, 0, 0];
  const mask = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (select && select[i] !== want) continue;
    const p = i * 4;
    count++;
    sumSigned += signed[i];
    sumAbs += abs[i];
    if (abs[i] > maxAbs) maxAbs = abs[i];
    sumRgb[0] += ours[p] - ref[p];
    sumRgb[1] += ours[p + 1] - ref[p + 1];
    sumRgb[2] += ours[p + 2] - ref[p + 2];
    if (abs[i] > blobThreshold) mask[i] = 1;
  }
  const values = new Float32Array(count);
  let n = 0;
  for (let i = 0; i < total; i++) {
    if (select && select[i] !== want) continue;
    values[n++] = abs[i];
  }
  values.sort();
  return {
    name,
    count,
    share: total ? count / total : 0,
    meanSigned: count ? sumSigned / count : Number.NaN,
    meanSignedRgb: count
      ? [sumRgb[0] / count, sumRgb[1] / count, sumRgb[2] / count]
      : [Number.NaN, Number.NaN, Number.NaN],
    meanAbs: count ? sumAbs / count : Number.NaN,
    p95Abs: percentile(values, 0.95),
    maxAbs,
    blob: largestBlob(mask, width, height, signed, abs, count),
  };
}

export function analyzeShift(
  ref: Uint8Array,
  ours: Uint8Array,
  width: number,
  height: number,
  options: ShiftOptions = {},
): ShiftReport {
  const edgeThreshold = options.edgeThreshold ?? 8;
  const erode = options.erode ?? 3;
  const blobThreshold = options.blobThreshold ?? 4;
  const total = width * height;
  if (ref.length < total * 4 || ours.length < total * 4) throw new Error("shift: rasters are smaller than width x height");
  const signed = new Float32Array(total);
  const abs = new Float32Array(total);
  let nonOpaque = 0;
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const dr = ours[p] - ref[p];
    const dg = ours[p + 1] - ref[p + 1];
    const db = ours[p + 2] - ref[p + 2];
    signed[i] = (dr + dg + db) / 3;
    abs[i] = (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
    if (ref[p + 3] !== 255 || ours[p + 3] !== 255) nonOpaque++;
  }
  const isEdge = markEdges(ref, ours, width, height, edgeThreshold, erode);
  return {
    width,
    height,
    total,
    nonOpaque,
    edgeThreshold,
    erode,
    blobThreshold,
    all: subsetStats("all", null, 1, ref, ours, signed, abs, width, height, total, blobThreshold),
    interior: subsetStats("interior", isEdge, 0, ref, ours, signed, abs, width, height, total, blobThreshold),
    edge: subsetStats("edge", isEdge, 1, ref, ours, signed, abs, width, height, total, blobThreshold),
    signed,
    abs,
    isEdge,
  };
}

/** Diverging heatmap of the signed error: blue where ours is darker, red where ours is lighter. */
export function heatmap(signed: Float32Array, width: number, height: number, scale: number): PNG {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const t = Math.max(-1, Math.min(1, signed[i] / scale));
    const target = t < 0 ? [0, 90, 255] : [230, 40, 20];
    const m = Math.abs(t);
    const p = i * 4;
    png.data[p] = Math.round(255 + (target[0] - 255) * m);
    png.data[p + 1] = Math.round(255 + (target[1] - 255) * m);
    png.data[p + 2] = Math.round(255 + (target[2] - 255) * m);
    png.data[p + 3] = 255;
  }
  return png;
}

const f2 = (v: number) => (Number.isNaN(v) ? "n/a" : v.toFixed(2));
const pct = (v: number) => `${(100 * v).toFixed(1)}%`;

function statLine(s: SetStats): string {
  const rgb = s.meanSignedRgb.map((v) => (Number.isNaN(v) ? "n/a" : v.toFixed(1))).join(",");
  const blob = s.blob
    ? `${s.blob.count}px ${pct(s.blob.share)} signed ${f2(s.blob.meanSigned)} at ${s.blob.x0},${s.blob.y0}-${s.blob.x1},${s.blob.y1}`
    : "none";
  return [
    s.name.padEnd(9),
    String(s.count).padStart(9),
    pct(s.share).padStart(7),
    f2(s.meanSigned).padStart(8),
    `(${rgb})`.padEnd(20),
    f2(s.meanAbs).padStart(8),
    f2(s.p95Abs).padStart(8),
    f2(s.maxAbs).padStart(8),
    "  ",
    blob,
  ].join(" ");
}

/**
 * The report as text. `mismatchRatio` (0-1) is pixelmatch's own number, quoted so the tint verdict
 * can point at a large colour error sitting behind a small geometry one.
 */
export function formatShiftReport(report: ShiftReport, mismatchRatio: number | null, heatScale: number): string {
  const lines: string[] = [];
  lines.push(
    `signed error = ours - ref, per pixel the mean over R,G,B. edge = within ${report.erode}px of a step over ${report.edgeThreshold}/255 or of the border; blob = 8-connected, abs > ${report.blobThreshold}`,
  );
  lines.push(
    `${"set".padEnd(9)} ${"px".padStart(9)} ${"share".padStart(7)} ${"signed".padStart(8)} ${"(R,G,B)".padEnd(20)} ${"abs".padStart(8)} ${"p95abs".padStart(8)} ${"maxabs".padStart(8)}   worst blob`,
  );
  for (const s of [report.all, report.interior, report.edge]) lines.push(statLine(s));
  const tint = Math.abs(report.interior.meanSigned) >= 2 && (report.interior.blob?.share ?? 0) >= 0.1;
  const geometry = mismatchRatio === null ? "" : `, geometry ${(100 * mismatchRatio).toFixed(2)}%`;
  lines.push(
    tint
      ? `TINT: the interior is off by ${f2(report.interior.meanSigned)} on average and ${pct(report.interior.blob?.share ?? 0)} of it is one connected blob${geometry}`
      : `no tint: interior mean signed ${f2(report.interior.meanSigned)}, largest interior blob ${pct(report.interior.blob?.share ?? 0)} (flagged at 2.0 and 10%)${geometry}`,
  );
  if (report.nonOpaque > 0) {
    lines.push(`note: ${report.nonOpaque} pixels are not opaque; alpha is not compared, so those colours are read as stored`);
  }
  lines.push(`heatmap +/-${heatScale}: blue = ours darker, red = ours lighter`);
  return lines.join("\n");
}

/** Splits `--name=number` flags out of argv so the positional arguments keep their old order. */
export function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, number> } {
  const positional: string[] = [];
  const flags: Record<string, number> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const named = /^--([a-z-]+)=(.*)$/.exec(arg);
    const value = named ? Number(named[2]) : Number.NaN;
    if (!named || !Number.isFinite(value)) throw new Error(`shift: ${arg} is not a --name=number flag`);
    flags[named[1]] = value;
  }
  return { positional, flags };
}

if (import.meta.main) {
  const { positional, flags } = parseFlags(process.argv.slice(2));
  const [refPath, oursPath, out] = positional;
  if (!refPath || !oursPath) {
    console.error("usage: bun scripts/measure/shift.ts <ref.png> <ours.png> [out-dir] [--heat-scale=16] [--edge-threshold=8] [--erode=3] [--blob-threshold=4] [--threshold=0.1]");
    process.exit(1);
  }
  const heatScale = flags["heat-scale"] ?? 16;
  const ref = PNG.sync.read(fs.readFileSync(refPath));
  const ours = PNG.sync.read(fs.readFileSync(oursPath));
  if (ref.width !== ours.width || ref.height !== ours.height) {
    console.error(`shift: sizes differ, ${ref.width}x${ref.height} vs ${ours.width}x${ours.height}`);
    process.exit(1);
  }
  const mismatched = pixelmatch(ref.data, ours.data, undefined, ref.width, ref.height, {
    threshold: flags["threshold"] ?? 0.1,
    includeAA: false,
  });
  const report = analyzeShift(ref.data, ours.data, ref.width, ref.height, {
    edgeThreshold: flags["edge-threshold"],
    erode: flags["erode"],
    blobThreshold: flags["blob-threshold"],
  });
  const ratio = mismatched / (ref.width * ref.height);
  console.log(`mismatch ${mismatched}px of ${ref.width * ref.height} = ${(100 * ratio).toFixed(2)}%`);
  console.log(formatShiftReport(report, ratio, heatScale));
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(`${out}/heat.png`, PNG.sync.write(heatmap(report.signed, ref.width, ref.height, heatScale)));
    console.log(`-> ${out}/heat.png`);
  }
}
