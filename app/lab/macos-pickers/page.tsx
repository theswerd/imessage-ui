import { PickerScene, paneSize, type PickerScene as Scene } from "./scene";

export const metadata = { title: "Lab: macOS attachment popovers" };

const scenes: Scene[] = ["photos", "stickers"];

/**
 * Pixel lab for the two popovers the macOS "+" menu opens, standing on their own outside
 * `macos-messages-app.tsx`.
 *
 *   /lab/macos-pickers?scene=photos|stickers&theme=light|dark&progress=0..1&open=0|1&plus=<px>
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers \
 *     bun scripts/measure/compare.ts \
 *       'http://localhost:3100/lab/macos-pickers?scene=stickers' <ref.png> 2 630 640 /tmp/out
 *
 * There is **no reference capture to diff against**: `references/macos/captures` holds no Messages
 * attachment popover, which is why this file's own numbers come from ChatKit at idiom 5 and from the
 * plus menu's measured chrome rather than from a frame. What this route is for is the geometry that
 * *can* be checked without one — the box against `stickerPopoverSize` / `popOverWidth`, the corner
 * and the rim against `plus-menu-{light,dark}-2x.png`, the arrow's tip against the "+" button, and
 * `hairline-scan.ts` over the whole pane.
 */
export default async function MacPickersLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const str = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const scene = scenes.includes(str("scene") as Scene) ? (str("scene") as Scene) : "photos";
  const theme = str("theme") === "dark" ? "dark" : "light";
  const progress = str("progress") === undefined ? undefined : Number(str("progress"));
  const plus = str("plus") === undefined ? undefined : Number(str("plus"));
  return (
    <>
      <style>{"body > header, body > footer, body > a, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <div style={{ width: paneSize.width, height: paneSize.height }}>
        <PickerScene
          scene={scene}
          theme={theme}
          progress={Number.isFinite(progress) ? progress : undefined}
          open={str("open") !== "0"}
          plus={Number.isFinite(plus) ? plus : undefined}
        />
      </div>
    </>
  );
}
