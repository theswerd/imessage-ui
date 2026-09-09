import { TapbackDetailsLabScene } from "./scene";

export const metadata = { title: "Tapback details lab" };

/**
 * Pixel lab for the Tapback Details platter, rendered at native geometry for
 * `scripts/measure/compare.ts`.
 *
 * /lab/tapback-details?scene=…&theme=light|dark&progress=0..1&filter=type:love
 *
 * Scenes:
 *   `ios`         402 × 874, the platter over the `conv3` fixture at the message it belongs to.
 *   `ios-many`    the same frame with eight reactors over seven kinds, which overflows and fades.
 *   `ios-one`     one reactor, the case `references/ios/captures/longpress-ok-selected-*.png` holds
 *                 in its collapsed form, so the two can be put side by side.
 *   `macos`       630 × 470 of the pane, the platter anchored under the message.
 *   `platter`     the platter alone on a flat ground at 402 × 120 / 500 × 120, for measuring it.
 */
export default async function TapbackDetailsLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const scene = typeof query.scene === "string" ? query.scene : "ios";
  const theme = query.theme === "dark" ? "dark" : "light";
  const filter = typeof query.filter === "string" ? query.filter : null;
  const progress = typeof query.progress === "string" ? Number(query.progress) : undefined;
  return (
    <>
      <style>{"body > header, body > footer, body > a, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <TapbackDetailsLabScene scene={scene} theme={theme} filter={filter} progress={Number.isFinite(progress) ? progress : undefined} />
    </>
  );
}
