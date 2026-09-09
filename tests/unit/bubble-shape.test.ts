import { describe, expect, test } from "bun:test";
import { bodyClipPath, bubblePath, tailBox, tailPath } from "../../registry/imessage/bubble-shape";
import { bubbleMetrics } from "../../registry/imessage/tokens";

/**
 * Geometry checks for the traced bubble outline. The numbers come from references/SPEC.md:
 * the tail hangs 6.8 below the body, its box is 22 wide, the body's edge starts sweeping inward
 * 19.2 above the body bottom (the clip box keeps a little more, 21.2), and the underside meets the
 * body bottom 21.7 in from the corner. macOS is the same artwork at 0.70.
 */

const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, A: 7, Z: 0 };

type Command = { letter: string; args: number[]; end: { x: number; y: number } };

/** Absolute-only SVG path parser: returns each command with the point it ends on. */
function parsePath(d: string): Command[] {
  const tokens = d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g) ?? [];
  const commands: Command[] = [];
  let cursor = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let index = 0;
  while (index < tokens.length) {
    const letter = tokens[index++];
    if (!/^[A-Za-z]$/.test(letter)) throw new Error(`expected a command letter at token ${index - 1}, got ${letter}`);
    if (!(letter in ARITY)) throw new Error(`unsupported command ${letter}`);
    if (letter !== letter.toUpperCase()) throw new Error(`relative command ${letter} is not allowed`);
    const arity = ARITY[letter];
    const args: number[] = [];
    for (let i = 0; i < arity; i++) {
      const value = Number(tokens[index++]);
      if (!Number.isFinite(value)) throw new Error(`command ${letter} has a non-numeric argument`);
      args.push(value);
    }
    if (letter === "M") cursor = start = { x: args[0], y: args[1] };
    else if (letter === "L") cursor = { x: args[0], y: args[1] };
    else if (letter === "H") cursor = { x: args[0], y: cursor.y };
    else if (letter === "V") cursor = { x: cursor.x, y: args[0] };
    else if (letter === "C") cursor = { x: args[4], y: args[5] };
    else if (letter === "A") cursor = { x: args[5], y: args[6] };
    else if (letter === "Z") cursor = start;
    commands.push({ letter, args, end: { ...cursor } });
  }
  return commands;
}

/** Every point the outline actually passes through (control points excluded). */
function endpoints(d: string) {
  return parsePath(d).filter(command => command.letter !== "Z").map(command => command.end);
}

function bounds(d: string) {
  const points = endpoints(d);
  const controls = parsePath(d).filter(command => command.letter === "C").flatMap(command => [{ x: command.args[0], y: command.args[1] }, { x: command.args[2], y: command.args[3] }]);
  const all = [...points, ...controls];
  return {
    minX: Math.min(...all.map(point => point.x)), maxX: Math.max(...all.map(point => point.x)),
    minY: Math.min(...all.map(point => point.y)), maxY: Math.max(...all.map(point => point.y)),
  };
}

describe("tail box constants", () => {
  test("match the measured numbers in SPEC.md", () => {
    expect(tailBox.width).toBe(22);
    expect(tailBox.height).toBe(21.2);
    expect(tailBox.hang).toBe(6.8);
  });

  test("the box contains the whole contour: 22 wide, hanging 6.8 below the body", () => {
    const box = bounds(tailPath("right"));
    expect(box.minX).toBeCloseTo(0, 6);
    expect(box.maxX).toBeCloseTo(tailBox.width, 6);
    expect(box.minY).toBeCloseTo(0, 6);
    // The tip is the lowest point; it must reach close to, and never past, the declared hang.
    const tipDrop = box.maxY - tailBox.height;
    expect(tipDrop).toBeGreaterThan(6.5);
    expect(tipDrop).toBeLessThanOrEqual(tailBox.hang);
  });

  test("SPEC's 19.2 sweep start and 21.7 underside both sit inside the clip box", () => {
    // The clip box is cut a little above where the straight edge starts sweeping in (19.203).
    expect(tailBox.height).toBeGreaterThan(19.203);
    expect(tailBox.height).toBeLessThan(19.203 + 2.5);
    // The underside meets the body bottom 21.7 in from the corner, so the 22 box just contains it.
    const underside = endpoints(tailPath("right")).at(-1)!;
    expect(underside.y).toBeCloseTo(tailBox.height, 6);
    expect(tailBox.width - underside.x).toBeGreaterThanOrEqual(21.7);
    expect(tailBox.width - underside.x).toBeLessThanOrEqual(22);
  });

  test("macOS reuses the iOS artwork at 0.70", () => {
    expect(bubbleMetrics.ios.tailScale).toBe(1);
    expect(bubbleMetrics.macos.tailScale).toBe(0.7);
    const box = bounds(tailPath("right", bubbleMetrics.macos.tailScale));
    expect(box.maxX).toBeCloseTo(15.4, 6);
    // SPEC: the scaled tail leaves the body 13.3 above the bottom and its tip hangs ~4.7 below it.
    expect(box.maxY - tailBox.height * bubbleMetrics.macos.tailScale).toBeCloseTo(4.7, 1);
  });
});

describe("tailPath", () => {
  test("produces closed, absolute path data", () => {
    for (const side of ["left", "right"] as const) {
      const d = tailPath(side);
      expect(d.startsWith("M")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
      expect(d).not.toMatch(/NaN|undefined|e[+-]\d/);
      const commands = parsePath(d);
      expect(commands.map(command => command.letter).join("")).toBe("MLLCCCCCZ");
    }
  });

  test("left is the mirror image of right about the box's center", () => {
    const right = endpoints(tailPath("right"));
    const left = endpoints(tailPath("left"));
    expect(left).toHaveLength(right.length);
    right.forEach((point, index) => {
      expect(left[index].x).toBeCloseTo(tailBox.width - point.x, 6);
      expect(left[index].y).toBeCloseTo(point.y, 6);
    });
  });

  test("scales as a whole, so the tail never stretches with the bubble", () => {
    const full = bounds(tailPath("right"));
    const half = bounds(tailPath("right", 0.5));
    expect(half.maxX).toBeCloseTo(full.maxX / 2, 6);
    expect(half.maxY).toBeCloseTo(full.maxY / 2, 6);
  });
});

describe("bodyClipPath", () => {
  test("cuts exactly the tail box out of the body's tailed corner", () => {
    expect(bodyClipPath("right")).toBe("polygon(0 0, 100% 0, 100% calc(100% - 21.2px), calc(100% - 22px) calc(100% - 21.2px), calc(100% - 22px) 100%, 0 100%)");
    expect(bodyClipPath("left")).toBe("polygon(0 0, 100% 0, 100% 100%, 22px 100%, 22px calc(100% - 21.2px), 0 calc(100% - 21.2px))");
  });

  test("left and right cut the same box on opposite sides", () => {
    const sizes = (value: string) => value.match(/[\d.]+px/g)!.sort();
    expect(sizes(bodyClipPath("left"))).toEqual(sizes(bodyClipPath("right")));
    expect(bodyClipPath("right", 0.7)).toContain("15.4px");
    expect(bodyClipPath("right", 0.7)).toContain("14.84px");
  });

  test("has six vertices on both sides", () => {
    for (const side of ["left", "right"] as const) {
      expect(bodyClipPath(side).split(",")).toHaveLength(6);
    }
  });
});

describe("bubblePath", () => {
  test("a tailless bubble is a closed rounded rect inside its box", () => {
    const d = bubblePath(200, 60, "none");
    expect(parsePath(d).map(command => command.letter).join("")).toBe("MHAVAHAVAZ");
    const box = bounds(d);
    expect(box.minX).toBeCloseTo(0, 6);
    expect(box.minY).toBeCloseTo(0, 6);
    expect(box.maxX).toBeCloseTo(200, 6);
    expect(box.maxY).toBeCloseTo(60, 6);
  });

  test("clamps the radius so a short bubble stays a pill", () => {
    const d = bubblePath(200, 30, "none");
    const first = parsePath(d)[0];
    expect(first.end.x).toBeCloseTo(15, 6);
    expect(bounds(d).maxY).toBeCloseTo(30, 6);
  });

  test("a tailed bubble keeps the body box and hangs only the tip below it", () => {
    const d = bubblePath(200, 60, "right");
    expect(d).not.toMatch(/NaN|undefined/);
    const box = bounds(d);
    expect(box.minX).toBeCloseTo(0, 6);
    expect(box.maxX).toBeCloseTo(200, 6);
    expect(box.minY).toBeCloseTo(0, 6);
    expect(box.maxY - 60).toBeGreaterThan(6.5);
    expect(box.maxY - 60).toBeLessThanOrEqual(tailBox.hang);
  });

  test("left and right outlines are mirror images", () => {
    const width = 200;
    const right = endpoints(bubblePath(width, 60, "right"));
    const left = endpoints(bubblePath(width, 60, "left"));
    expect(left).toHaveLength(right.length);
    right.forEach((point, index) => {
      expect(left[index].x).toBeCloseTo(width - point.x, 6);
      expect(left[index].y).toBeCloseTo(point.y, 6);
    });
    // Mirroring reverses the winding, so the arcs flip their sweep flag.
    expect(bubblePath(width, 60, "right")).toContain("0 0 1");
    expect(bubblePath(width, 60, "left")).toContain("0 0 0");
  });

  test("the outline's tail matches the standalone tail path", () => {
    const width = 200, height = 60;
    const outline = endpoints(bubblePath(width, height, "right"));
    const tail = endpoints(tailPath("right"));
    // Where the straight edge leaves the body, plus the five curve endpoints, in body coordinates.
    const fromOutline = outline.slice(3, 9);
    const fromTail = tail.slice(2).map(point => ({ x: width - (tailBox.width - point.x), y: height - (tailBox.height - point.y) }));
    expect(fromOutline).toHaveLength(fromTail.length);
    fromOutline.forEach((point, index) => {
      expect(point.x).toBeCloseTo(fromTail[index].x, 6);
      expect(point.y).toBeCloseTo(fromTail[index].y, 6);
    });
  });
});
