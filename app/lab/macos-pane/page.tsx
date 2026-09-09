import { MacPaneScene, type PaneScene } from "./scene";

export const metadata = { title: "Lab: macOS conversation pane" };

const scenes: PaneScene[] = ["tails", "thread", "partial"];

/**
 * Pixel lab for the four `references/macos/captures/conversation-pane-*.png` crops, which had no lab
 * at all: `/lab/macos-chrome?scene=pane` draws the header and the composer with an empty log, and
 * `/lab/list?platform=macos` draws the log with no header and no composer, so neither reconstructs a
 * capture and every macOS bubble number in SPEC was being checked against half a scene.
 *
 * Each scene is the whole 960 x 640 window slid so the capture's own first pixel is at (0, 0):
 *
 *   /lab/macos-pane?scene=tails             conversation-pane-dark-2.png   630x640 @2x  &theme=dark
 *   /lab/macos-pane?scene=tails&balloon=1   conversation-pane-light.png    630x640 @2x
 *   /lab/macos-pane?scene=thread&text=Every+detail
 *                                           conversation-pane-dark.png     630x640 @2x  &theme=dark
 *   /lab/macos-pane?scene=partial           conversation-pane-light-partial.png  630x490 @2x
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers \
 *     bun scripts/measure/compare.ts \
 *       'http://localhost:3100/lab/macos-pane?scene=tails&theme=dark' \
 *       references/macos/captures/conversation-pane-dark-2.png 2 630 640 /tmp/out
 *
 * Two regions of these frames can never close and are not evidence of anything: the header's avatar
 * (native shows a photograph, the kit shows initials, window x 625-665 y 8-48 = pane x 295-335) and
 * the composer's caret, which is Chrome's own and does not survive a screenshot. `&text=` fills the
 * composer, `&balloon=1` applies the Love the light capture carries.
 */
export default async function MacPaneLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const str = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const scene = scenes.includes(str("scene") as PaneScene) ? (str("scene") as PaneScene) : "tails";
  const theme = str("theme") === "dark" ? "dark" : "light";
  return (
    <>
      <style>{"body > header, body > footer, body > a, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <MacPaneScene scene={scene} theme={theme} text={str("text") ?? ""} balloon={str("balloon") === "1"} focus={str("focus") !== "0"} />
    </>
  );
}
