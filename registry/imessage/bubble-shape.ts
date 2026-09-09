/**
 * Native iMessage bubble geometry, traced from iOS 26 Messages (see references/SPEC.md and
 * references/ios/bubble-tail-beziers.json). All values are points (CSS px).
 *
 * The bubble body is a rounded rectangle with circular corners. On the sender's side the bottom
 * corner is replaced by the tail: the edge sweeps inward over the last ~19pt of height into a
 * neck, bulges back out, and ends in a point that hangs ~6.8pt below the body. The tail region is
 * a fixed 22×28pt box anchored at the body's bottom corner, so it never scales with the bubble.
 */
export type TailSide = "left" | "right" | "none";

/** Cubic Béziers relative to the body's bottom-right corner (x grows right, y grows down). */
const TAIL_SEGMENTS: Array<[number, number, number, number, number, number]> = [
  // S-curve from the straight right edge down to the neck
  [-0.442, -13.682, -3.003, -8.238, -7.457, -4.87],
  [-9.101, -3.553, -10.598, -1.75, -10.513, 0.463],
  // bulge from the neck down to the tip
  [-10.766, 2.71, -8.409, 4.088, -8.319, 6.13],
  // rounded tip
  [-8.33, 6.55, -8.6, 6.75, -9.0, 6.698],
  // underside from the tip back to the body's bottom edge
  [-14.001, 6.333, -17.413, 1.539, -22.0, 0],
];
const TAIL_START_Y = -19.203; // where the straight edge ends, relative to the body bottom
const TAIL_EDGE_START = -21.2; // clip box top: a little above so the arc/straight edge is untouched

export const tailBox = { width: 22, height: 21.2, hang: 6.8 } as const;

function fmt(n: number) {
  return Number(n.toFixed(3)).toString();
}

/**
 * SVG path for the fixed tail region. The path is in a `tailBox.width × (tailBox.height + tailBox.hang)`
 * coordinate system whose top-left is (bodyRight − 22, bodyBottom − 21.2). For a left tail it is mirrored.
 */
export function tailPath(side: Exclude<TailSide, "none">, scale = 1): string {
  const w = tailBox.width * scale;
  const h = tailBox.height * scale;
  const mx = (x: number) => (side === "right" ? w + x * scale : -x * scale);
  const my = (y: number) => h + y * scale;
  const parts = [`M${fmt(mx(-22))},${fmt(my(TAIL_EDGE_START))}`, `L${fmt(mx(0))},${fmt(my(TAIL_EDGE_START))}`, `L${fmt(mx(0))},${fmt(my(TAIL_START_Y))}`];
  for (const [x1, y1, x2, y2, x, y] of TAIL_SEGMENTS) {
    parts.push(`C${fmt(mx(x1))},${fmt(my(y1))} ${fmt(mx(x2))},${fmt(my(y2))} ${fmt(mx(x))},${fmt(my(y))}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

/**
 * clip-path polygon that removes the tail box from a plain rounded-rectangle body so the tail SVG
 * can draw that region exactly. Use with `border-radius` for the three untouched corners.
 *
 * `overlap` shrinks the removed box along its two interior edges, so the body keeps painting that
 * far *into* the tail box. Chrome rounds a `clip-path` reference box to whole CSS px before it
 * rasterizes, so a tail box that starts on a fraction (macOS: 22 × 0.7 = 15.4 wide, whose left edge
 * lands at 594.609 in the 630pt pane) is painted up to half a point away from the body's clip edge
 * and a white hairline shows through the bubble. The two edges are interior, so the body can only
 * be seen there if it reaches past the tail's own outline: keep `overlap` under the tail's straight
 * top segment, `(tailBox.height - 19.203) * scale`, and it never can.
 */
/**
 * How far the body's clip has to reach into the tail box so the two do not leave a hairline where
 * they meet. macOS needs 0.75; iOS's larger tail closes on its own.
 */
export const tailSeamOverlap: Record<"ios" | "macos", number> = { ios: 0, macos: 0.75 };

export function bodyClipPath(side: Exclude<TailSide, "none">, scale = 1, overlap = 0): string {
  const w = tailBox.width * scale - overlap;
  const h = tailBox.height * scale - overlap;
  return side === "right"
    ? `polygon(0 0, 100% 0, 100% calc(100% - ${fmt(h)}px), calc(100% - ${fmt(w)}px) calc(100% - ${fmt(h)}px), calc(100% - ${fmt(w)}px) 100%, 0 100%)`
    : `polygon(0 0, 100% 0, 100% 100%, ${fmt(w)}px 100%, ${fmt(w)}px calc(100% - ${fmt(h)}px), 0 calc(100% - ${fmt(h)}px))`;
}

/** Full bubble outline as an SVG path (for masks, effects, and tests). */
export function bubblePath(width: number, height: number, side: TailSide, radius = 19, scale = 1): string {
  const r = Math.min(radius, height / 2, width / 2);
  if (side === "none") {
    return `M${fmt(r)},0 H${fmt(width - r)} A${fmt(r)},${fmt(r)} 0 0 1 ${fmt(width)},${fmt(r)} V${fmt(height - r)} A${fmt(r)},${fmt(r)} 0 0 1 ${fmt(width - r)},${fmt(height)} H${fmt(r)} A${fmt(r)},${fmt(r)} 0 0 1 0,${fmt(height - r)} V${fmt(r)} A${fmt(r)},${fmt(r)} 0 0 1 ${fmt(r)},0 Z`;
  }
  const mx = (x: number) => (side === "right" ? width + x * scale : -x * scale);
  const my = (y: number) => height + y * scale;
  const tail: string[] = [`L${fmt(mx(0))},${fmt(my(TAIL_START_Y))}`];
  for (const [x1, y1, x2, y2, x, y] of TAIL_SEGMENTS) tail.push(`C${fmt(mx(x1))},${fmt(my(y1))} ${fmt(mx(x2))},${fmt(my(y2))} ${fmt(mx(x))},${fmt(my(y))}`);
  if (side === "right") {
    return `M${fmt(r)},0 H${fmt(width - r)} A${fmt(r)},${fmt(r)} 0 0 1 ${fmt(width)},${fmt(r)} ${tail.join(" ")} H${fmt(r)} A${fmt(r)},${fmt(r)} 0 0 1 0,${fmt(height - r)} V${fmt(r)} A${fmt(r)},${fmt(r)} 0 0 1 ${fmt(r)},0 Z`;
  }
  // left tail: walk the outline counter-clockwise so the mirrored tail segments read in order
  return `M${fmt(width - r)},0 H${fmt(r)} A${fmt(r)},${fmt(r)} 0 0 0 0,${fmt(r)} ${tail.join(" ")} H${fmt(width - r)} A${fmt(r)},${fmt(r)} 0 0 0 ${fmt(width)},${fmt(height - r)} V${fmt(r)} A${fmt(r)},${fmt(r)} 0 0 0 ${fmt(width - r)},0 Z`;
}
