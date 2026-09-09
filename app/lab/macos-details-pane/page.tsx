import { MacDetailsPaneScene, type MacDetailsPaneSceneProps } from "./scene";

export const metadata = { title: "Lab: macOS details pane" };

/**
 * Pixel lab for the macOS 26 details inspector, fitted to a capture.
 *
 * The capture is a **private screenshot of the user's own Messages** — real people, real messages —
 * so it is not in this repo and must not be copied into it. `references/macos/details-pane.md`
 * records every number read off it. This route renders the same arrangement with fixture people so
 * the two can be diffed:
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers \
 *     bun scripts/measure/compare.ts \
 *       'http://localhost:3100/lab/macos-details-pane?scene=window&theme=dark' \
 *       <the capture, converted to sRGB, outside the repo> 1 960 640 /tmp/out 660 0 300 640
 *
 * The capture survives only as a 1x, 960 × 640 downscale, so the diff runs at dpr 1 and 1 px = 1 pt.
 * Convert it out of the display's ICC profile into sRGB first — untouched, its accent row reads
 * #ffd044 rather than the #ffd600 that is `systemYellow`.
 *
 * /lab/macos-details-pane
 *   ?scene=window|pane          window is the whole 960 × 640 frame; pane crops to the 300 pt column
 *   &theme=dark|light           the capture is dark; light is derived, not measured
 *   &tab=info|backgrounds|photos|links|location|documents
 *   &sidebar=1                  keep the conversation list, which is NOT what the capture shows —
 *                               opening the inspector collapses it
 *   &people=0                   drop the participants, so only the Add circle is left
 *   &open=0  &progress=0..1     seek the presentation instead of playing it
 *   &width=280..400             the resizable column
 */
export default async function MacDetailsPaneLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const str = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const tabParam = str("tab");
  const tab: MacDetailsPaneSceneProps["tab"] =
    tabParam === "backgrounds" || tabParam === "photos" || tabParam === "links" || tabParam === "location" || tabParam === "documents"
      ? tabParam : "info";
  const width = str("width") !== undefined ? Number(str("width")) : undefined;
  const progress = str("progress") !== undefined ? Number(str("progress")) : undefined;
  return (
    <>
      <style>{"body > header, body > footer, body > a, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <MacDetailsPaneScene
        scene={str("scene") === "pane" ? "pane" : "window"}
        theme={str("theme") === "light" ? "light" : "dark"}
        tab={tab}
        sidebar={str("sidebar") === "1"}
        people={str("people") !== "0"}
        open={str("open") !== "0"}
        progress={progress}
        width={width}
      />
    </>
  );
}
