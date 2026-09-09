"use client";

import { useState, type CSSProperties } from "react";
import { PlatformProvider, type Platform } from "@/registry/imessage/platform";
import { ImageViewer, fitPhotoRect, imageViewerMetrics, type ImageViewerPhoto, type ImageViewerRect } from "@/registry/imessage/image-viewer";

export type ViewerScene = "chrome" | "fit" | "chrome-photo" | "picker" | "reaction" | "zoom" | "drop" | "open" | "page" | "macos";

/**
 * The fixture the two captures were taken with, byte for byte: the probe app wrote
 * `public/fixtures/viewer-probe.jpg` (1200 x 1600, a diagonal green gradient, a 100px white grid and
 * a "2") into its tmp directory, QuickLook displayed that file, and the same file is served here. So
 * `?scene=fit` and `references/ios/captures/image-viewer-fit-dark.png` are the same photo through two
 * different renderers and a pixel diff means something.
 */
const probe: ImageViewerPhoto = { src: "/fixtures/viewer-probe.jpg", alt: "Fixture 2", width: 1200, height: 1600 };

/** A five-photo message, so paging, the mount window and the parallax all have something to run over. */
const strip: ImageViewerPhoto[] = [
  { src: "/fixtures/ridge.jpg", alt: "Ridge", width: 900, height: 675 },
  probe,
  { src: "/fixtures/shore.jpg", alt: "Shore", width: 900, height: 675 },
  { src: "/fixtures/dusk.jpg", alt: "Dusk", width: 900, height: 675 },
  { src: "/fixtures/frost.jpg", alt: "Frost", width: 900, height: 675 },
];

/** A plausible tile in the conversation behind, so the open zoom has somewhere to come out of. */
const tile: ImageViewerRect = { x: 121.5, y: 470, width: 264.5, height: 198.4 };

const IOS: CSSProperties = { width: 402, height: 874, position: "relative", overflow: "hidden", background: "#000000" };
const MACOS: CSSProperties = { width: 960, height: 640, position: "relative", overflow: "hidden", background: "#000000" };

/** The clock the two captures were taken at, so the status bar diffs instead of always mismatching. */
const CAPTURE_TIME = "11:18";

export function PhotoViewerLabScene({ scene, progress, index = 1 }: { scene: ViewerScene; progress?: number; index?: number }) {
  const platform: Platform = scene === "macos" ? "macos" : "ios";
  const frame = scene === "macos" ? { width: 960, height: 640 } : { width: 402, height: 874 };

  // `chrome` reconstructs `image-viewer-chrome-dark.png`, which caught the viewer before QuickLook's
  // remote service had handed over a photo: black ground, chrome up, reply disabled because the probe
  // had no `ckQLPreviewControllerDelegate` to enable it. No photos, no handlers.
  const bare = scene === "chrome";
  const photos = bare ? [] : scene === "fit" || scene === "chrome-photo" || scene === "zoom" || scene === "drop" || scene === "open" ? [probe] : strip;
  const at = bare ? 0 : photos.length === 1 ? 0 : index;

  // Every scene is a still, so nothing here is left to a timer or a gesture: the states a capture
  // would show are passed in as props.
  const common = {
    photos,
    index: at,
    platform,
    frame,
    autoHideChrome: false,
    time: CAPTURE_TIME,
    chrome: scene !== "fit",
    // The measured chrome carries no title text, so no scene passes one.
    onShare: () => {},
    ...(scene === "chrome" ? {} : { onReply: () => {}, onSave: () => {}, onReact: () => {} }),
  };

  const body = (() => {
    switch (scene) {
      case "chrome":
      case "fit":
      case "chrome-photo":
        return <ImageViewer {...common} />;
      case "picker":
        return <ImageViewer {...common} tapbackOpen recent={["😂", "❤️", "👍", "🔥", "🎉", "😍"]} />;
      case "reaction":
        return <ImageViewer {...common} reaction={{ type: "love" }} reactionAttribution="Kai" />;
      case "zoom":
        // A double tap lands on `-doubleTapZoomFactor` = 2.5, and `-chromeAutoHideBehaviorOnZoom` = 2
        // takes the chrome with it, which is why this scene passes `chrome={false}`.
        return <ImageViewer {...common} chrome={false} zoom={imageViewerMetrics.doubleTapZoom} />;
      case "drop":
        // The pose at the commit threshold, held by `dismissProgress` rather than a synthesised drag:
        // the photo at `dismiss.minScale` = 0.6 and the ground at
        // `-interactiveTransitionBackgroundDimming` = 0.5, with the chrome gone because any drop
        // takes it.
        return <ImageViewer {...common} sourceRect={tile} dismissProgress={progress ?? 1} />;
      case "open":
        return <ImageViewer {...common} sourceRect={tile} sourceRadius={19} progress={progress ?? 0.5} />;
      case "page":
        return <ImageViewer {...common} index={at} />;
      case "macos":
        return <ImageViewer {...common} />;
    }
  })();

  return (
    <PlatformProvider platform={platform}>
      <div data-slot="viewer-lab" style={scene === "macos" ? MACOS : IOS}>
        {body}
      </div>
    </PlatformProvider>
  );
}

/**
 * The numbers the scene is supposed to reproduce, printed next to the render so a reader can check
 * them without a screenshot. Sources are in `references/SPEC.md`.
 */
export function PhotoViewerLabReadout({ platform = "ios" }: { platform?: Platform }) {
  const frame = platform === "ios" ? { width: 402, height: 874 } : { width: 960, height: 640 };
  const box = imageViewerMetrics.chrome[platform];
  const fit = fitPhotoRect(1200 / 1600, frame);
  const rows: Array<[string, string]> = [
    ["frame", `${frame.width} x ${frame.height}`],
    ["safe area", `top ${box.safeArea.top}, bottom ${box.safeArea.bottom}`],
    ["close disc", `${frame.width - box.header.inset - box.header.size}, ${box.safeArea.top}, ${box.header.size} square`],
    ["reply disc", `${box.footer.inset}, ${frame.height - box.footer.bottom - box.footer.size}, ${box.footer.size} square`],
    ["share disc", `${frame.width - box.footer.inset - box.footer.size}, ${frame.height - box.footer.bottom - box.footer.size}, ${box.footer.size} square`],
    ["fitted 3:4 photo", `${fit.x}, ${fit.y}, ${fit.width} x ${fit.height}`],
    ["page pitch", `${frame.width} + ${imageViewerMetrics.interpageSpacing} = ${frame.width + imageViewerMetrics.interpageSpacing}`],
  ];
  return (
    <table style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, borderCollapse: "collapse", margin: 12 }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td style={{ paddingRight: 16, opacity: 0.6 }}>{k}</td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A live viewer with every handler wired, for driving the gestures by hand. */
export function PhotoViewerLabLive() {
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(1);
  return (
    <PlatformProvider platform="ios">
      <div data-slot="viewer-lab" style={IOS}>
        {open && (
          <ImageViewer
            photos={strip}
            index={index}
            onIndexChange={setIndex}
            sourceRect={tile}
            sourceRadius={19}
            rectForIndex={i => (i === 1 ? tile : null)}
            onClose={() => setOpen(false)}
            onExited={() => setOpen(true)}
            onShare={() => {}}
            onReply={() => {}}
            onSave={() => {}}
            onReact={() => {}}
          />
        )}
      </div>
    </PlatformProvider>
  );
}
