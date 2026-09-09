import { MacDetailsScene, type MacDetailsSceneProps } from "./scene";

export const metadata = { title: "Lab: macOS details" };

/**
 * Pixel lab for the macOS 26 details inspector. Renders the 960×640 window at native geometry, with
 * the inspector open, so `scripts/measure/compare.ts` can diff it the moment a capture of this pane
 * exists — there is none in the repo today, which is why every metric in
 * `registry/imessage/macos-details.tsx` is sourced to ChatKit rather than to a frame.
 *
 * To take that capture: open Messages, size the window to 960×640, Conversation ▸ Show Details
 * (⌥⌘I), `screencapture -o -l<windowid>` at 2x, drop it in `references/macos/captures/`, then
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers \
 *     bun scripts/measure/compare.ts \
 *       'http://localhost:3100/lab/macos-details?scene=window&theme=light' \
 *       references/macos/captures/<that>.png 2 960 640 /tmp/out
 *
 * `scene=panel` crops to the panel's own box (its width × 624 at window (952−w, 8)) so the header,
 * the tab strip and the rows can be diffed without the window around them.
 *
 * /lab/macos-details
 *   ?scene=window|panel|pushed   window is the whole 960×640 frame; pushed drops the sidebar so the
 *                                conversation's trailing inset is easy to read; panel crops the panel
 *   &theme=light|dark
 *   &tab=info|photos|links|documents
 *   &group=1                     three participants, so the header draws the 72-wide pancake
 *   &people=1                    group + the participant list expanded
 *   &empty=1                     nothing shared, so there is no tab strip — the state
 *                                references/ios/captures/details-light.png is in, one idiom over
 *   &mode=push|overlay
 *   &width=280..400              the resizable column
 *   &open=0|1  &progress=0..1    seek the presentation instead of playing it
 */
export default async function MacDetailsLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const str = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const scene: MacDetailsSceneProps["scene"] = str("scene") === "panel" ? "panel" : str("scene") === "pushed" ? "pushed" : "window";
  const theme = str("theme") === "dark" ? "dark" : "light";
  const tabParam = str("tab");
  const tab: MacDetailsSceneProps["tab"] =
    tabParam === "photos" || tabParam === "links" || tabParam === "documents" ? tabParam : "info";
  const width = str("width") !== undefined ? Number(str("width")) : undefined;
  const progress = str("progress") !== undefined ? Number(str("progress")) : undefined;
  return (
    <>
      <style>{"body > header, body > footer, body > a, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <MacDetailsScene
        scene={scene}
        theme={theme}
        tab={tab}
        group={str("group") === "1" || str("people") === "1"}
        people={str("people") === "1"}
        empty={str("empty") === "1"}
        mode={str("mode") === "overlay" ? "overlay" : "push"}
        width={width}
        open={str("open") !== "0"}
        progress={progress}
      />
    </>
  );
}
