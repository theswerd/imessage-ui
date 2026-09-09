import { PhotoViewerLabLive, PhotoViewerLabReadout, PhotoViewerLabScene, type ViewerScene } from "./scene";

/** Kept here, not in the client module: a server component only sees client references for its exports. */
const scenes: ViewerScene[] = ["chrome", "fit", "chrome-photo", "picker", "reaction", "zoom", "drop", "open", "page", "macos"];

export const metadata = { title: "Lab: photo viewer" };

/**
 * Pixel lab for the full-screen photo viewer, at the native geometry the captures were taken at
 * (402 x 874 for iOS, 960 x 640 for macOS), so `scripts/measure/compare.ts` can diff it.
 *
 *   /lab/photoviewer?scene=chrome   -> references/ios/captures/image-viewer-chrome-dark.png
 *   /lab/photoviewer?scene=fit      -> references/ios/captures/image-viewer-fit-dark.png
 *
 * Those are the only two scenes a capture exists for. The rest reconstruct states the captures
 * could not reach from outside Messages: `chrome-photo` puts the chrome over the fitted photo,
 * `picker` opens the tapback pill, `reaction` shows an applied balloon and its attribution, `zoom`
 * is the double-tap pose, `drop` is the ground at its dismissal dimming, `open` seeks the entrance
 * (`&progress=0..1`), `page` picks an item (`&index=n`) and `macos` frames it in a window.
 * `?scene=live` mounts a viewer with every handler wired, for driving the gestures by hand.
 *
 * Diffing the two capture scenes:
 *   PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers bun scripts/measure/compare.ts \
 *     "http://localhost:3100/lab/photoviewer?scene=chrome" \
 *     references/ios/captures/image-viewer-chrome-dark.png 3 402 874 /tmp/viewer-chrome
 *
 * `scene=chrome` has one known, permanent difference from its capture: the simulator draws its own
 * "◀ Messages" return-to-app breadcrumb under the clock, at roughly x 26-180, y 76-104. Diff around
 * it with the optional crop arguments, or read the mismatch with that band in mind.
 */
export default async function PhotoViewerLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const requested = typeof query.scene === "string" ? query.scene : "chrome";
  const raw = typeof query.progress === "string" ? Number(query.progress) : Number.NaN;
  const progress = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : undefined;
  const indexRaw = typeof query.index === "string" ? Number(query.index) : Number.NaN;
  const index = Number.isFinite(indexRaw) ? indexRaw : 1;
  const readout = query.readout === "1";
  const style = "body > header, body > footer, body > a, nextjs-portal { display: none !important; } body { margin: 0; background: #000; }";

  if (requested === "live") {
    return (
      <>
        <style>{style}</style>
        <PhotoViewerLabLive />
      </>
    );
  }

  const scene = scenes.includes(requested as ViewerScene) ? (requested as ViewerScene) : "chrome";
  return (
    <>
      <style>{style}</style>
      <PhotoViewerLabScene scene={scene} progress={progress} index={index} />
      {readout && <PhotoViewerLabReadout platform={scene === "macos" ? "macos" : "ios"} />}
    </>
  );
}
