export const metadata = { title: "Lab: crop" };

/**
 * A viewport that puts an existing lab scene's pixel (`x`, `y`) at (0, 0), so the standalone crop
 * files in `references/` get a lab of their own without anything being drawn twice.
 *
 * Several captures are not whole frames: `references/ios/captures/tapback-bar-crop.png` is a 402 x 160
 * band, `context-menu-crop.png` a 276.67 x 200 window, `references/macos/captures/ctxmenu-with-edit-
 * light-2x.png` a 305 x 330 one. `compare.ts` reads the reference from the *same* rectangle it clips
 * the page to, so a standalone crop can only be diffed against a page whose origin is already the
 * crop's origin. This route is that page: it loads `src` in an iframe at its own natural size and
 * slides it, which means the scene is still rendered by whichever lab owns it, in the same browser, at
 * the same device pixel ratio — nothing is reimplemented here and no scene is copied.
 *
 *   /lab/crop?src=<URI-encoded lab path>&sw=<scene width>&sh=<scene height>&x=&y=&w=&h=
 *
 * Pairings measured with it (region is the whole viewport, so pass none to `compare.ts`):
 *
 *   tapback-bar-crop.png       src=/lab/tapback?scene=longpress-first  sw=402 sh=874
 *                              x=0 y=126.333 w=402 h=160               dpr 3
 *   context-menu-crop.png      src=/lab/tapback?scene=longpress-first  sw=402 sh=874
 *                              x=41.667 y=185 w=276.667 h=200          dpr 3
 *
 * The offsets are not guesses: each was found by sliding the capture over a render of that scene and
 * taking the row/column pair with the lowest mean absolute error, which is a sharp minimum (the next
 * row is worse) because both images carry the same hard glass edges.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers \
 *     bun scripts/measure/compare.ts \
 *       'http://localhost:3100/lab/crop?src=%2Flab%2Ftapback%3Fscene%3Dlongpress-first&sw=402&sh=874&x=0&y=126.333&w=402&h=160' \
 *       references/ios/captures/tapback-bar-crop.png 3 402 160 /tmp/out
 *
 * `src` must be same-origin and is used as an iframe URL only.
 */
export default async function CropLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const str = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const num = (key: string, fallback: number) => {
    const value = Number(str(key));
    return Number.isFinite(value) ? value : fallback;
  };
  const raw = str("src") ?? "/lab";
  // Same-origin only: a leading slash, and no scheme or protocol-relative escape hatch.
  const src = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/lab";
  const sw = num("sw", 402);
  const sh = num("sh", 874);
  const x = num("x", 0);
  const y = num("y", 0);
  const w = num("w", sw);
  const h = num("h", sh);
  return (
    <>
      <style>{"body > header, body > footer, body > a, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <div data-testid="lab" style={{ width: w, height: h, position: "relative", overflow: "hidden" }}>
        <iframe title="scene" src={src} scrolling="no" style={{ position: "absolute", left: -x, top: -y, width: sw, height: sh, border: 0, colorScheme: "normal" }} />
      </div>
    </>
  );
}
