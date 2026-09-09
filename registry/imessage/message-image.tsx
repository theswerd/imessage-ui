"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePlatform, type Platform } from "@/registry/imessage/platform";
import { bubbleMetrics, fontStack, type Direction } from "@/registry/imessage/tokens";
import { bodyClipPath, tailBox, tailPath } from "@/registry/imessage/bubble-shape";

/**
 * Photos and videos sent in a conversation. A photo takes the bubble's shape, tail included, so the
 * same traced outline in `bubble-shape.ts` clips the image instead of filling it.
 *
 * NOT MEASURED against a native photo message: the corner radius and tail come from the measured text
 * bubble, and the multi-photo grid follows the documented layout. The tile gap is provisional.
 *
 * The single photo's box, on the other hand, is now read out of ChatKit rather than guessed: see
 * `photoBox` below. So are the accessible names: ChatKit's own accessibility bundle
 * (`/System/iOSSupport/System/Library/AccessibilityBundles/ChatKitFramework.axbundle`,
 * `Accessibility.loctable`) calls one attachment `photo.attachment` = "Photo", counts them with
 * `attachment.count` = "%d attachments" and positions each one with
 * `messages.attachment.stack.view.format` = "attachment %1$d of %2$d".
 *
 * A photo sent together with text is NOT one balloon with a caption under the photo. ChatKit splits a
 * message into parts (`-[CKMessagePartChatItem messagePartRange]`, `CKTextMessagePartChatItem` vs
 * `CKAttachmentMessagePartChatItem`), and each part is its own balloon chat item, so native draws the
 * photo balloon and the text balloon as two bubbles of one cluster. "Caption" exists nowhere in the
 * image balloon; in ChatKit it belongs to Business Chat rich cards
 * (`-[CKBalloonView didTapTruncatedCaptionForRichCard:]`). The message list therefore renders the two,
 * passing `tail` to whichever comes last; this component stays a photo group.
 */
export type MessageImage = { src: string; alt: string; width?: number; height?: number };

export type MessageImagesProps = Omit<ComponentProps<"div">, "children"> & {
  images: MessageImage[];
  direction?: Direction;
  tail?: boolean;
  /** Longest edge of the group, in px. Defaults to the platform's maximum bubble width. */
  maxWidth?: number;
  /** Tallest the group may grow, in px. Defaults to the native cap (see `photoBox`). */
  maxHeight?: number;
  /** The transfer has not arrived yet: hold every tile on the placeholder. */
  loading?: boolean;
  /**
   * Open the full-screen viewer at `index`. The second argument is the tile's own box in viewport
   * coordinates, so the viewer can zoom out of the tile the way native does instead of fading in.
   */
  onOpenImage?: (index: number, rect: DOMRect) => void;
  /** @deprecated Use `onOpenImage`, which also hands over the tile's box. */
  onOpen?: (index: number) => void;
  /** Tapback balloons; positioned on the group's top corner away from the screen edge. */
  reactions?: ReactNode;
  platform?: Platform;
};

/** Native shows at most four tiles and counts the rest. */
const MAX_TILES = 4;

/** Gap between tiles. Provisional: no native capture of a multi-photo message exists. */
const TILE_GAP = 2;

/**
 * How big one photo's balloon is, read out of ChatKit instead of a screenshot.
 * `-[CKUIBehaviorPhone thumbnailFillSizeForWidth:imageSize:]`, swept over widths 100…600 against
 * extreme image sizes, fills the balloon width and then clamps the shape: anything wider than 16:9
 * comes back at `width x 0.5625` and anything taller than 3:4 at `width x 1.3333`, in both cases
 * cropped, since the answer is a *fill* size (its sibling `unconstrainedAspectFillSizeForWidth:`
 * returns the unclamped fit). It never returns a height over 500; past that the width shrinks to hold
 * the ratio (w 400, a 1:4 photo → 375 x 500).
 *
 * `-[CKUIBehaviorMac thumbnailFillSizeForWidth:imageSize:]` overrides it and applies no shape clamp at
 * all: it returns the true aspect fit, capped at the same height of 500 (a 1:6 photo → 83.5 x 500).
 * Native rounds each result to the device pixel grid (it answers 158.0 where 280.5 x 0.5625 is
 * 157.78); the fractions are kept here for the same reason `tileSize` keeps its own.
 */
export const photoBox: Record<Platform, { minRatio: number; maxRatio: number; maxHeight: number }> = {
  ios: { minRatio: 0.5625, maxRatio: 4 / 3, maxHeight: 500 },
  macos: { minRatio: 0, maxRatio: Number.POSITIVE_INFINITY, maxHeight: 500 },
};

/**
 * Where a tapback balloon sits against the group's top corner. Measured on text bubbles and carried
 * over: a photo group takes a tapback like any other balloon, and native anchors it to the balloon's
 * frame, which is what this box is. Numbers from `tapback.tsx`'s `balloonSlot` (the corrected pair),
 * not from `message-bubble.tsx`'s older copy. A photo has no measured slot of its own; ChatKit does
 * carry `-[CKUIBehavior messageAcknowledgmentPhotoGridXOffsetScalar]` = 0 / `…YOffsetScalar` = 0.2 on
 * iPhone and 0.35 / 0.35 on Mac, but those are fractions of a frame this component does not build (a
 * photo *grid* view), so they are recorded rather than used.
 */
const reactionSlot: Record<Platform, { marginTop: number; top: number; side: number }> = {
  ios: { marginTop: 28, top: -27.39, side: -13.85 },
  macos: { marginTop: 27.4, top: -22.05, side: -11.79 },
};

/**
 * What native offers on an attachment it has not fetched: ChatKit's `TAP_TO_DOWNLOAD` = "Tap to
 * Download" and `CLICK_TO_DOWNLOAD` = "Click to Download" (`ChatKit.framework/Resources/ChatKit.loctable`).
 * The tile keeps the same copy when the fetch fails, and activating it asks for the photo again.
 */
const downloadLabel: Record<Platform, string> = { ios: "Tap to Download", macos: "Click to Download" };

/**
 * Aspect ratios already learned this session, so a photo that has been seen once never opens at the
 * 4:3 placeholder again. A remount (the viewer closing, a list re-render) would otherwise lay the
 * bubble out at the wrong height and snap when the image decodes. Empty during hydration, because
 * nothing can have loaded by then, so the first client render still matches the server's.
 */
const aspectMemo = new Map<string, number>();

type Phase = "ready" | "failed";

/**
 * Average colour of the corner of `image` that the tail meets, so the tail reads as a continuation of
 * the photo rather than a gray stub. The tile is `object-cover`, so the visible corner is not the
 * source's own corner: map the tail's footprint back through the cover crop before reading it.
 * Returns null when the image has not loaded, is not laid out, or taints the canvas (a cross-origin
 * photo), and the caller keeps its fallback fill.
 */
function sampleCorner(image: HTMLImageElement, side: "left" | "right", boxWidth: number, boxHeight: number): string | null {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  if (!image.complete || !naturalWidth || !naturalHeight) return null;
  const rect = image.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const cover = Math.max(rect.width / naturalWidth, rect.height / naturalHeight);
  const visibleWidth = Math.min(naturalWidth, rect.width / cover);
  const visibleHeight = Math.min(naturalHeight, rect.height / cover);
  const patchWidth = Math.max(1, Math.min(visibleWidth, boxWidth / cover));
  const patchHeight = Math.max(1, Math.min(visibleHeight, boxHeight / cover));
  const left = (naturalWidth - visibleWidth) / 2;
  const sx = side === "right" ? left + visibleWidth - patchWidth : left;
  const sy = (naturalHeight - visibleHeight) / 2 + visibleHeight - patchHeight;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, sx, sy, patchWidth, patchHeight, 0, 0, 8, 8);
    const data = context.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
    const pixels = data.length / 4;
    return `rgb(${Math.round(r / pixels)}, ${Math.round(g / pixels)}, ${Math.round(b / pixels)})`;
  } catch {
    return null; // a cross-origin photo taints the canvas
  }
}

export function MessageImages({
  images, direction = "outgoing", tail = false, maxWidth, maxHeight, loading = false,
  onOpenImage, onOpen, reactions, platform: platformProp, className, style, ...props
}: MessageImagesProps) {
  const contextPlatform = usePlatform();
  const platform = platformProp ?? contextPlatform;
  const m = bubbleMetrics[platform];
  const side = direction === "outgoing" ? "right" : "left";
  const width = maxWidth ?? m.maxWidth;
  const tiles = images.slice(0, MAX_TILES);
  const overflow = images.length - tiles.length;
  const single = tiles.length === 1;
  const groupKey = tiles.map(image => image.src).join("|");

  // Tiles are square, so one number sets both axes: half the group, less the gap. Keep the fraction
  // instead of rounding it, or they stop being square: 280.5 halves to 139.25, and two of those plus
  // the gap is the group's 280.5 again.
  const tileSize = (width - TILE_GAP) / 2;

  // One photo keeps its aspect ratio: the caller's dimensions when it gave any, otherwise the image's
  // own once it has loaded. 4:3 is only the placeholder until then, and only for a photo whose size
  // this session has never seen; declaring `width`/`height` is what keeps the bubble from resizing at
  // all on a cold load.
  const [measured, setMeasured] = useState<{ src: string; aspect: number } | null>(null);
  const first: MessageImage | undefined = tiles[0];
  const firstSrc = first?.src ?? "";
  const declaredAspect = single && first?.width && first.height ? first.width / first.height : null;
  const learnedAspect = single ? (measured?.src === firstSrc ? measured.aspect : aspectMemo.get(firstSrc)) : undefined;
  const aspect = declaredAspect ?? learnedAspect ?? 4 / 3;

  // The clamp is the native one, so a very tall photo stops at 4:3 of its width and a very wide one at
  // 16:9, both cropped by `object-cover`; the group never grows past `maxHeight`, and when the clamped
  // shape would, the width comes in with it rather than the photo stretching.
  const box = photoBox[platform];
  const ceiling = maxHeight ?? box.maxHeight;
  const ratio = Math.min(Math.max(1 / aspect, box.minRatio), box.maxRatio);
  const groupWidth = single ? Math.min(width, ceiling / ratio) : width;
  const height = single ? groupWidth * ratio : tiles.length === 2 ? tileSize : tileSize * 2 + TILE_GAP;

  const grid = useMemo<CSSProperties>(() => {
    if (single) return { display: "block" };
    return { display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: tiles.length === 2 ? "1fr" : "1fr 1fr", gap: TILE_GAP };
  }, [single, tiles.length]);

  const hang = tailBox.hang * m.tailScale;
  // The tail continues the photo, so it is filled from the tile that touches it: the bottom tile on
  // the tail's side. Three photos put a full-height tile first, so on an incoming message that first
  // tile is the one the tail meets; the 2x2 grid meets tile 3 on the left and tile 4 on the right.
  const tailIndex = side === "right" ? tiles.length - 1 : tiles.length === MAX_TILES ? 2 : 0;
  const [tailFill, setTailFill] = useState<{ key: string; color: string } | null>(null);
  // A tile is on the placeholder until its own <img> says otherwise, so the bubble is never a hole.
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [attempt, setAttempt] = useState<Record<string, number>>({});
  const gridRef = useRef<HTMLDivElement>(null);

  // Runs on mount as well as on load: a server-rendered <img> is normally already complete by the
  // time React attaches its handlers, and then `onLoad` never fires at all, the tail stays gray and
  // every tile looks unloaded. It is a layout effect so a photo the browser already has is laid out
  // at its real shape in the same frame, instead of painting 4:3 once and resizing.
  const measure = useCallback(() => {
    const element = gridRef.current;
    if (!element) return;
    const rendered = element.querySelectorAll("img");
    // By tile index, not by position in the list: a tile that failed renders no <img> at all, and
    // counting elements would then sample the wrong photo for the tail.
    const edge = element.querySelector<HTMLImageElement>(`img[data-tile="${tailIndex}"]`);
    // Only ever replace a real colour with a real colour: a half-decoded image reads as null, and
    // dropping back to gray for a frame would flash the tail.
    const sampled = tail && edge ? sampleCorner(edge, side, tailBox.width * m.tailScale, tailBox.height * m.tailScale) : null;
    if (sampled) setTailFill(previous => (previous?.key === groupKey && previous.color === sampled ? previous : { key: groupKey, color: sampled }));
    setPhase(previous => {
      let next = previous;
      rendered.forEach(image => {
        if (!image.complete) return;
        const src = image.getAttribute("data-src") ?? image.src;
        const value: Phase = image.naturalWidth > 0 ? "ready" : "failed";
        if (previous[src] === value) return;
        if (next === previous) next = { ...previous };
        next[src] = value;
      });
      return next;
    });
    const photo = element.querySelector<HTMLImageElement>('img[data-tile="0"]');
    if (single && photo?.naturalWidth && photo.naturalHeight) {
      const value = photo.naturalWidth / photo.naturalHeight;
      aspectMemo.set(firstSrc, value);
      setMeasured(previous => (previous?.src === firstSrc && previous.aspect === value ? previous : { src: firstSrc, aspect: value }));
    }
  }, [single, tail, tailIndex, side, m.tailScale, groupKey, firstSrc, setMeasured, setPhase, setTailFill]);
  useLayoutEffect(() => { measure(); }, [measure]);

  const retry = useCallback((src: string) => {
    setPhase(previous => { const next = { ...previous }; delete next[src]; return next; });
    setAttempt(previous => ({ ...previous, [src]: (previous[src] ?? 0) + 1 }));
  }, []);

  const open = onOpenImage ?? (onOpen ? (index: number) => onOpen(index) : undefined);
  const busy = loading || tiles.some(image => phase[image.src] === undefined);
  const slot = reactionSlot[platform];
  // No photos is not an empty balloon: without this the group would paint a bare gray square the size
  // of a four-tile grid.
  if (!tiles.length) return null;

  return (
    <div data-slot="message-images" data-direction={direction} data-count={images.length}
      // ChatKit's `attachment.count` reads "%d attachments"; the group is named with the photo noun
      // its own `PHOTO_ATTACHMENT_STATUS_PHOTOS_TITLE_FORMAT` ("%tu Photos") uses. One photo needs no
      // group at all: the tile's own name already says everything.
      role={images.length > 1 ? "group" : undefined}
      aria-label={images.length > 1 ? `${images.length} Photos` : undefined}
      aria-busy={busy || undefined}
      className={cn("relative", className)}
      style={{ width: groupWidth, fontFamily: fontStack, marginTop: reactions ? slot.marginTop : undefined, ...style }} {...props}>
      <div ref={gridRef} data-slot="image-grid" style={{ ...grid, width: groupWidth, height, borderRadius: m.radius, overflow: "hidden", clipPath: tail ? bodyClipPath(side, m.tailScale) : undefined, background: "var(--im-gray-top)" }}>
        {tiles.map((image, index) => {
          const spanFirst = tiles.length === 3 && index === 0;
          const state = phase[image.src];
          const failed = state === "failed";
          const last = index === MAX_TILES - 1 && overflow > 0;
          const name = image.alt?.trim() || "Photo";
          // "Photo, 2 of 5" follows ChatKit's own `messages.attachment.stack.view.format`
          // ("attachment %1$d of %2$d"); the counted tile has to say what its "+N" opens.
          const position = images.length > 1 ? `${name}, ${index + 1} of ${images.length}` : name;
          // ChatKit's `attachment.count` carries a real plural rule ("%d attachment" / "%d attachments"),
          // so the counted tile gets one too rather than reading "1 more photos".
          const more = `Show ${overflow} more photo${overflow === 1 ? "" : "s"}.`;
          const label = failed ? `${position}. ${downloadLabel[platform]}.` : last ? `${position}. ${more}` : position;
          // A tile that cannot be fetched offers the fetch again, the way native's undownloaded
          // attachment does. Otherwise it opens the viewer, handing over its own box so the viewer can
          // grow out of this tile.
          const activate: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined = failed
            ? () => retry(image.src)
            : open
              ? event => open(index, event.currentTarget.getBoundingClientRect())
              : undefined;
          // A button is a control for the pointer and the keyboard both, for free. With nothing to
          // open it would be a dead tab stop that reads out "dimmed", so the tile becomes a named
          // image instead: the photo keeps its accessible name either way.
          const shell = {
            "data-slot": "photo-tile", "data-index": index,
            "data-state": failed ? "failed" : state === "ready" ? "ready" : "loading",
            "aria-label": label,
            className: "relative block h-full w-full overflow-hidden p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff]",
            style: spanFirst ? { gridRow: "span 2" } : undefined,
          } as const;
          const inner = (
            <>
              {failed ? (
                // The placeholder the grid already paints, plus native's own copy for a photo it does
                // not have. Type size is not measured.
                <span data-slot="photo-failed" aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center px-[8px] text-center font-medium"
                  style={{ fontSize: platform === "ios" ? 15 : 13, lineHeight: 1.2, color: "var(--im-incoming-text)" }}>
                  {downloadLabel[platform]}
                </span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={attempt[image.src] ?? 0} src={image.src} data-src={image.src} data-tile={index} alt="" loading="lazy" decoding="async"
                  onLoad={measure} onError={measure}
                  className="h-full w-full object-cover" style={{ opacity: loading ? 0 : 1 }} />
              )}
              {last && (
                <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-semibold text-white"
                  style={{ background: "rgba(0,0,0,0.42)", fontSize: platform === "ios" ? 22 : 17 }}>+{overflow}</span>
              )}
            </>
          );
          return activate
            ? <button key={image.src + index} type="button" onClick={activate} {...shell}>{inner}</button>
            : <div key={image.src + index} role="img" {...shell}>{inner}</div>;
        })}
      </div>
      {tail && (
        <div aria-hidden="true" data-slot="tail" className="pointer-events-none absolute"
          style={{ [side]: 0, bottom: -hang, width: tailBox.width * m.tailScale, height: tailBox.height * m.tailScale + hang, clipPath: `path("${tailPath(side, m.tailScale)}")`, background: tailFill?.key === groupKey ? tailFill.color : "var(--im-gray-bottom)" }} />
      )}
      {/* Outside the grid on purpose: the grid clips to the balloon's outline, and a balloon that laps
          the photo's rounded corner would lose its own edge to that clip. */}
      {reactions && (
        <div data-slot="reactions" className="absolute z-10" style={{ top: slot.top, [direction === "outgoing" ? "left" : "right"]: slot.side }}>{reactions}</div>
      )}
    </div>
  );
}

/** Override the sampled tail colour, e.g. when the image is cross-origin and cannot be read back. */
export function photoTailFill(color: string): CSSProperties {
  return { ["--im-gray-bottom" as string]: color } as CSSProperties;
}
