import { PhotoPickerScene, type PickerScene } from "./scene";

/** Kept here, not in the client module: a server component only sees client references for its exports. */
const scenes: PickerScene[] = ["screen", "panel", "badge"];

export const metadata = { title: "Lab: iOS photo picker" };

/**
 * Pixel lab for the Photos picker under the iOS 26 composer, reconstructing
 * `references/ios/captures/photo-picker-light.png` at its native 402x874 so
 * `scripts/measure/compare.ts` can diff it:
 *
 *   /lab/photo-picker?scene=screen|panel|badge&theme=light|dark
 *   &progress=0..1   scrubs the entrance (or, with open=0, the exit) instead of playing it
 *   &progress=live   hands the panel its own clock
 *   &detent=collapsed|expanded   which of the two heights it rests at
 *   &selected=bloom,falls        pre-selects tiles, which also puts chips over the composer
 *   &open=0          poses the exit instead of the entrance; with no progress it plays and reports
 *   &count=300       repeats the six placeholders, so the row windowing has something to window
 *
 * `scene=screen` is the capture: the whole 402x874 frame with the mirrored conversation, the
 * unknown-sender notice, the full composer and the panel. `scene=panel` drops everything but the
 * panel onto the capture's own backdrop grey. `scene=badge` is a 26x26 frame holding nothing but the
 * selection badge, so the SVG can be diffed against the badge PhotosUICore itself draws.
 *
 * The tiles are the registry's gradient placeholders, never Apple's sample photographs, so a
 * whole-frame diff will always disagree inside the grid. The regions that mean something are the
 * ones both sides draw the same way:
 *
 *   panel bottom band   x 0 y 810 w 402 h 64    the inset, the bottom corners, the panel's own edge
 *   grabber             x 178 y 486 w 46 h 12   the pill's box and its 5.0 top
 *   left / right seam   x 0 y 500 w 12 h 320    the 5.3333 inset against the backdrop
 */
export default async function PhotoPickerLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const scene = scenes.includes(query.scene as PickerScene) ? (query.scene as PickerScene) : "screen";
  const theme = query.theme === "dark" ? "dark" : "light";
  const live = query.progress === "live";
  const raw = typeof query.progress === "string" ? Number(query.progress) : Number.NaN;
  const progress = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : undefined;
  const detent = query.detent === "expanded" ? "expanded" : "collapsed";
  const selected = typeof query.selected === "string" && query.selected.length > 0 ? query.selected.split(",") : [];
  const open = query.open !== "0";
  const count = typeof query.count === "string" ? Number(query.count) : Number.NaN;
  return (
    <>
      <style>{"body > header, body > footer, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <PhotoPickerScene scene={scene} theme={theme} progress={progress} live={live} detent={detent} selected={selected} open={open} count={Number.isFinite(count) ? count : undefined} />
    </>
  );
}
