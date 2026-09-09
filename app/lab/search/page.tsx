import { SearchLab } from "./scene";

export const metadata = { title: "Search lab" };

/**
 * iOS search lab: reconstructs `references/ios/captures/search-active-light.png` and
 * `search-noresults-dark.png` at native geometry (402 x 874) so Playwright can diff them, and poses
 * the sections and the transition, which no capture holds.
 *
 * `/lab/search?scene=<scene>&theme=light|dark&progress=<0..1>`
 *
 * | scene | what it reconstructs |
 * |---|---|
 * | `active`    | the measured focused-empty screen. Diff against `search-active-light.png`. |
 * | `noresults` | the measured "No Results" screen, query "Detail". Diff against `search-noresults-dark.png` at `theme=dark`. |
 * | `resting`   | the conversation list alone, for the handoff check against `list-light.png`. |
 * | `results`   | all five sections. Nothing measures this; it is here to be looked at. |
 * | `open`      | the open transition over the list; add `progress` to seek it. |
 * | `close`     | the close transition; add `progress` to seek it. |
 *
 * `theme` defaults to light; the "No Results" capture is dark, so that scene needs `&theme=dark`
 * spelled out to match it.
 */
export default async function SearchLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]);
  const progress = one("progress");
  return (
    <>
      <style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style>
      <SearchLab scene={one("scene") ?? "active"} theme={one("theme") === "dark" ? "dark" : "light"} progress={progress === undefined ? undefined : Number(progress)} />
    </>
  );
}
