import { StickerPickerScene, type StickerScene } from "./scene";

/** Kept here, not in the client module: a server component only sees client references for its exports. */
const scenes: StickerScene[] = ["capture", "grid", "drag", "conversation"];

export const metadata = { title: "Lab: iOS sticker picker" };

/**
 * Pixel lab for the iOS 26 sticker picker, reconstructing
 * `references/ios/captures/sticker-picker-light.png` at its native 402x874 so
 * `scripts/measure/compare.ts` can diff it:
 *
 *   /lab/ios-sticker-picker?scene=capture|grid|drag|conversation&theme=light|dark
 *   &tab=recents|emoji|memoji|live|doodles   which category is selected
 *   &progress=0..1     scrubs the entrance (or, with open=0, the exit) instead of playing it
 *   &open=0            poses the exit instead of the entrance; with no progress it plays and reports
 *   &drag=0..1         scrubs the posed drag in `scene=drag`
 *
 * `scene=capture` is the capture: the four flat backdrop bands the sheet's dimming was solved from,
 * the 20% dim, and the sheet on Recents with its empty state — the same frame the PNG holds.
 *
 * The regions that mean something in a diff, because both sides draw them the same way:
 *
 *   sheet bottom band   x 0 y 820 w 402 h 54    the 3.1667 inset and the R 60.3333 bottom corners
 *   sheet top band      x 0 y 405 w 402 h 30    the 414.1667 top and the R 40.4167 top corners
 *   header              x 0 y 414 w 402 h 63    the title and the close button
 *   category strip      x 0 y 477 w 402 h 44    the chip, its 8 gaps and the EDIT pill
 *
 * A whole-frame number will always be dominated by the glass: the sheet blurs the four bands behind
 * it and Chromium renders every `backdrop-filter: blur()` radius on such an element alike (the same
 * limitation `ios-plus-menu.tsx` documents). Read the bands above, not the frame.
 *
 * `scene=grid` puts a populated category under the same chrome — the grid there is ChatKit's
 * attachment-browser geometry, not a measurement of this card, so it is for review and not for a
 * diff. `scene=drag` poses the lift, the shrink to 5/7 and the landing at 48 as a pure function of
 * `drag`, and `scene=conversation` puts the sheet over the fixture transcript so a real pointer drag
 * can be dropped on a bubble and land there.
 */
export default async function StickerPickerLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const scene = scenes.includes(query.scene as StickerScene) ? (query.scene as StickerScene) : "capture";
  const theme = query.theme === "dark" ? "dark" : "light";
  const tab = typeof query.tab === "string" ? query.tab : "recents";
  const raw = typeof query.progress === "string" ? Number(query.progress) : Number.NaN;
  const progress = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : undefined;
  const rawDrag = typeof query.drag === "string" ? Number(query.drag) : Number.NaN;
  const dragProgress = Number.isFinite(rawDrag) ? Math.max(0, Math.min(1, rawDrag)) : undefined;
  const open = query.open !== "0";
  return (
    <>
      <style>{"body > header, body > footer, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <StickerPickerScene scene={scene} theme={theme} tab={tab} progress={progress} open={open} dragProgress={dragProgress} />
    </>
  );
}
