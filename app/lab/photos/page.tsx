import { PhotoLabScene, type PhotoLabCase } from "./scene";

export const metadata = { title: "Photo lab" };

/** Kept here rather than imported from the scene: a server component only ever sees a client
 *  module's exports through a reference proxy, so `photoLabCases.includes` there is not a function. */
const photoLabCases: PhotoLabCase[] = ["shapes", "counts", "states", "narrow", "badges"];

/**
 * Photo lab: /lab/photos?platform=macos&case=shapes&theme=light
 *
 * There is no native capture of a photo message anywhere in `references/`, so unlike the other lab
 * routes this one has no backdrop to reconstruct and no diff to run. What it reconstructs instead is
 * the *box* a photo balloon lives in — the transcript column at the platform's real pane width and
 * edge inset — and it carries ChatKit's own answers on the elements as `data-ck-w` / `data-ck-h`, so
 * a probe can diff the rendered box against the framework rather than against a screenshot. See
 * `scene.tsx` for where each expected number came from.
 */
export default async function PhotoLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const requested = one("case");
  const scene = photoLabCases.includes(requested as PhotoLabCase) ? (requested as PhotoLabCase) : "shapes";
  const width = Number(one("width"));
  return (
    <>
      <style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style>
      <PhotoLabScene
        platform={one("platform") === "macos" ? "macos" : "ios"}
        theme={one("theme") === "dark" ? "dark" : "light"}
        scene={scene}
        paneWidth={Number.isFinite(width) && width > 0 ? width : undefined}
      />
    </>
  );
}
