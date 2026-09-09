import { GroupDetailsScene, type GroupDetailsScene as Scene } from "./scene";

/** Kept here, not in the client module: a server component only sees client references for its exports. */
const scenes: Scene[] = ["settled", "scrolled", "editing", "long", "photo"];

export const metadata = { title: "Lab: iOS group details" };

/**
 * Pixel lab for the iOS 26 group conversation details screen, at the captures' own geometry
 * (402 × 874 pt, rendered at 3x by `scripts/measure/compare.ts`).
 *
 * `/lab/group-details?scene=settled|scrolled|editing|long|photo&theme=light|dark`
 *
 * - `settled` — the screen at rest: the Snowglobe group photo in the measured Ø80 slot, the name, the
 *   two glass circles, the member list with Add Contact, Hide Alerts, Leave this Conversation. This
 *   is the frame to diff: with no shared content the cell stack is the measured one-to-one screen's,
 *   cell for cell, so `details-light.png` still rules every number the two screens share.
 * - `scrolled` — the same screen with shared content, seeked with `&scroll=<points>` so the header
 *   collapse into the nav bar pill can be checkpointed. `&scroll=120.3333` is fully collapsed.
 * - `editing` — the name as `CKDetailsAddGroupNameView`'s editable field.
 * - `long` — six members truncated behind a "See All" row, with the group-count subtitle.
 * - `photo` — every shared-content section at once, so the grid and both lists are on one frame.
 *
 * `&progress=0..1` scrubs the presentation; `&progress=live` hands the screen its own timeline and a
 * real drag-to-dismiss.
 */
export default async function GroupDetailsLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const scene = scenes.includes(query.scene as Scene) ? (query.scene as Scene) : "settled";
  const theme = query.theme === "dark" ? "dark" : "light";
  const live = query.progress === "live";
  const rawProgress = typeof query.progress === "string" ? Number(query.progress) : Number.NaN;
  const progress = Number.isFinite(rawProgress) ? Math.max(0, Math.min(1, rawProgress)) : undefined;
  const rawScroll = typeof query.scroll === "string" ? Number(query.scroll) : Number.NaN;
  const scroll = Number.isFinite(rawScroll) ? Math.max(0, rawScroll) : scene === "scrolled" ? 120.3333 : undefined;
  return (
    <>
      <style>{"body > header, body > footer, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <GroupDetailsScene scene={scene} theme={theme} progress={progress} scroll={scroll} live={live} />
    </>
  );
}
