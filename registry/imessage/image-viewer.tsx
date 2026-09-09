"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import { usePlatform, type Platform } from "@/registry/imessage/platform";
import { bubbleMetrics, fontStack } from "@/registry/imessage/tokens";
import { Tapback, TapbackGlyph, balloonGeometry, balloonSlot, pickerBalloonGeometry, tapbackVars } from "@/registry/imessage/tapback";
import { SmileyIcon, TapbackBar, tapbackBarMetrics, type TapbackSelection } from "@/registry/imessage/tapback-bar";

/**
 * The full-screen photo viewer: what a photo in a bubble opens into.
 *
 * NO CAPTURE OF THIS SCREEN EXISTS, and none can be made from here, so every number below says where
 * it actually came from. Three kinds, and each value repeats its own:
 *
 * FRAMEWORK. Read out of the binaries shipped on this Mac (macOS 26.5.2, Messages 26.0) by dlopen-ing
 * the macCatalyst frameworks from a macCatalyst process and reading the live Objective-C objects, plus
 * `dyld_info` over the same images. The class and selector is named on every value.
 *   - Messages does not draw a photo browser of its own: it opens QuickLook.
 *     `ChatKit.CKQLPreviewController` is a `QLPreviewController` subclass, and its members say what the
 *     screen holds: `numberOfPreviewItemsInPreviewController:` and `currentPreviewItemIndex` (paging
 *     over the message's own items), `replyButton`, `tapbackButton`, `saveTapped:`, `replyTapped:`,
 *     `tapbackTapped:` and `updateBarButtonItems` (the bars). That is the shape this component copies.
 *   - The reaction picker over a full-screen item is `ChatKit.CKFullScreenBalloonViewController`,
 *     anchored on the toolbar's tapback button
 *     (`CKQLPreviewController -tapbackButtonFrameForFullScreenBalloonViewController:`) and drawn with a
 *     downward tail (`-fullScreenBalloonViewControllerPickerViewUsesBottomTail:`). Hence the picker pill
 *     floats above the footer with its thought bubble pointing back down at that button.
 *   - Colour and type come from `PhotosUIPrivate.PUBlackOneUpInterfaceTheme`, the theme the photo
 *     browser runs under. Durations, zoom factors and the page gap come from
 *     `PhotosUIPrivate.PUOneUpSettings` and `PUTilingViewSettings`.
 *   - The accessible names are ChatKit's own, from
 *     `AccessibilityBundles/ChatKitFramework.axbundle/Contents/Resources/Accessibility.loctable`:
 *     `photo.attachment` = "Photo", `messages.attachment.stack.view.format` = "attachment %1$d of %2$d",
 *     `save.photo.button` = "Save photo", `delete.button.label` = "Delete", `balloon.message.reply` = "Reply".
 *
 * MEASURED, from `references/SPEC.md`: the iOS safe area. SPEC's iOS frame is 402x874 with the status
 * bar over y 0-54 (Dynamic Island 14-50.67) and records "Home indicator: none in simulator captures".
 * So the default inset is 54 top and 0 bottom, and `safeArea` is the prop for a device that does show a
 * gesture bar. The chrome is laid out inside those insets and never under them.
 *
 * JUDGEMENT, with no framework symbol and no capture behind it (each one says so again where it lives):
 * the thresholds that commit a swipe or a dismissal, the scale the photo shrinks to while it is being
 * flung away, the bar heights (UIKit's stock 44 and 49), the gradient behind the bars, where an applied
 * tapback balloon sits on a full-screen photo, and the whole macOS presentation.
 *
 * macOS ASSUMPTION. Messages on macOS is the same Catalyst binary, so the same QuickLook viewer opens,
 * but into a 960x640 window instead of over a phone screen. This component keeps one API and changes
 * only the framing: no safe-area inset, shorter bars, the macOS two-row tapback picker in a floating
 * panel instead of the iOS pill, and pointer and keyboard paths (double click, trackpad pinch, arrow
 * keys, plus and minus) carrying what touch carries on iOS. None of that is measured.
 *
 * SEEKABLE. The entrance and the exit are one Web Animations timeline per layer, so
 * `document.getAnimations()` reaches them and `progress` pauses and seeks instead of playing. With
 * `progress` set, every CSS transition in the tree is switched off too, so a checkpoint renders the
 * same frame every run.
 */
export const imageViewerMetrics = {
  /**
   * The viewer's ground. `PUBlackOneUpInterfaceTheme -photoBrowserChromeVisibleBackgroundColor` and
   * `-photoBrowserChromeHiddenBackgroundColor` both resolve to opaque black in the light AND the dark
   * trait collection, so the viewer does not follow the theme: it is black either way.
   */
  ground: "#000000",
  /** `PUBlackOneUpInterfaceTheme -photoBrowserTitleViewTextColor` (and `-photoBrowserTitleViewTappableTextColor`): white in both themes. */
  chromeInk: "#ffffff",
  /** `-photoBrowserPhotoPrimaryTitleFont` is ".SFNS-Regular 15.00 pt". */
  title: { fontSize: 15, weight: 400 },
  /** `-photoBrowserPhotoSubtitleFont` is ".SFNS-Regular 11.00 pt". The opacity is JUDGEMENT: the theme gives one white for both lines. */
  subtitle: { fontSize: 11, weight: 400, opacity: 0.72 },
  /** `PUBlackOneUpInterfaceTheme -topToolbarToolButtonGlyphSize` = 21. */
  glyph: 21,
  /** `-topToolbarToolButtonFont` is ".SFNS-Regular 15.00 pt"; the Done button takes it. */
  button: { fontSize: 15, weight: 400 },
  /**
   * Bar heights. UIKit's stock navigation bar and toolbar for a phone in portrait, and a guess for a
   * window. NOT measured, and not a framework value I could read: platform default, not Messages' own.
   */
  bars: { ios: { header: 44, footer: 49 }, macos: { header: 38, footer: 44 } },
  /** `PUOneUpSettings -barsAreaVerticalOutset` = 10: how far the bars' area runs past the bars themselves. */
  barsOutset: 10,
  /** `PUOneUpSettings -interpageSpacing` = 100. The gap is the viewer's ground, so it reads as black. */
  interpageSpacing: 100,
  /** `PUOneUpSettings -doubleTapZoomFactor` = 2.5. */
  doubleTapZoom: 2.5,
  /** `PUOneUpSettings -defaultZoomInFactor` = 6, the pinch ceiling. */
  maxZoom: 6,
  /** `PUOneUpSettings -allowDoubleTapZoom`, `-allowChromeHiding` and `-allowUserTransform` are all 1. */
  allowDoubleTapZoom: true,
  allowChromeHiding: true,
  /**
   * `PUOneUpSettings -parallaxFactor` = 12.5 with `-allowParallax` = 1: while a page moves, its photo
   * lags by 1/12.5 of that page's offset, so the strip does not slide as one sheet.
   */
  parallaxFactor: 12.5,
  /** `PUOneUpSettings -chromeAutoHideDelay` = 3 s. Messages does not auto-hide, so nothing here uses it; recorded because it is the framework's number. */
  chromeAutoHideDelay: 3000,
  /**
   * Rubber band. UIScrollView's documented resistance constant, which every Apple scroll view uses and
   * the one-up pager is one. NOT read out of PhotosUI: platform default, not a measurement.
   */
  rubberBand: 0.55,
  /**
   * Committing a swipe. JUDGEMENT, no framework value: the page flips when the drag passes a third of
   * the frame or the flick is faster than 500 pt/s.
   */
  pageCommit: { distance: 1 / 3, velocity: 500 },
  /**
   * Committing a drag-to-dismiss, and how far the photo shrinks on the way down. JUDGEMENT:
   * `PUOneUpSettings` carries no dismissal threshold. 120 pt of travel or a 700 pt/s flick, with the
   * photo scaling to 0.6 across that travel while the ground fades out under it.
   */
  dismiss: { distance: 120, velocity: 700, minScale: 0.6 },
  /** How far a pointer has to move before a drag stops being a tap. JUDGEMENT. */
  slop: 6,
  /** How long a second tap counts as a double tap, and how far it may land from the first. JUDGEMENT. */
  doubleTap: { window: 300, slop: 24 },
  timing: {
    /** `PUTilingViewSettings -springAnimationDuration` = 0.3, with `-useSpringAnimations` = 1. The open zoom, and the exit that reverses it. */
    zoom: 300,
    /** `PUTilingViewSettings -transitionDuration` = 0.2: the ground coming up behind the zoom. */
    backdrop: 200,
    /** `PUOneUpSettings -chromeDefaultAnimationDuration` = 0.2. */
    chrome: 200,
    /** `PUTilingViewSettings -transitionChromeDelay` = 0: the chrome arrives with the zoom, not after it. */
    chromeDelay: 0,
    /** `PUOneUpSettings -finalFadeOutDuration` = 0.2. Used when there is no tile to zoom out of. */
    fade: 200,
    /** `PUOneUpSettings -bounceDuration` = 0.5 with `-bounceSpringDamping` = 1, i.e. critically damped, no overshoot. The snap back from an overscrolled pan. */
    bounce: 500,
    /** Paging under its own steam, e.g. an arrow key. `PUTilingViewSettings -springAnimationDuration`. */
    page: 300,
    /** `ChatKit.CKUIBehaviorPhone -tapbackDismissalDuration` = 0.5: how long the picker takes to leave. */
    tapbackDismiss: 500,
  },
  /**
   * The easing on the zoom. `PUTilingViewSettings` says spring, overshoot allowed
   * (`-useOvershootingSpringAnimations` = 1), but carries no stiffness or damping to read, so this is
   * the standard curve the rest of the kit uses. JUDGEMENT.
   */
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
  /**
   * The iOS safe area, from SPEC: the status bar occupies y 0-54 and no gesture bar appears in any
   * capture. A device that shows one passes its own inset through `safeArea`.
   */
  safeArea: { ios: { top: 54, bottom: 0 }, macos: { top: 0, bottom: 0 } },
  /**
   * The wash under each bar, so white ink stays legible over a bright photo. JUDGEMENT: the theme gives
   * an opaque black ground for the chrome, which is the colour behind the bars once the photo is
   * letterboxed, but nothing says what covers the photo itself.
   */
  barScrim: "rgba(0,0,0,0.55)",
} as const;

export type ImageViewerRect = { x: number; y: number; width: number; height: number };
export type ImageViewerPhoto = { src: string; alt?: string; width?: number; height?: number };
export type ImageViewerSize = { width: number; height: number };

export type ImageViewerProps = Omit<ComponentProps<"div">, "children" | "onSelect"> & {
  /** The photos of the message that was tapped. Paging runs over exactly these. */
  photos: ImageViewerPhoto[];
  /** Which one is showing. Controlled when given, otherwise the viewer keeps its own. */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /**
   * The tapped tile's box in the viewer's OWN coordinates, i.e. relative to the element this viewer
   * fills. A caller holding a viewport `DOMRect` (which is what `MessageImages onOpenImage` hands over)
   * subtracts the viewer host's own `getBoundingClientRect()` first. The open zoom starts here and the
   * exit returns to it; null falls back to a fade, which is what a viewer opened from a keyboard or a
   * deep link should do.
   */
  sourceRect?: ImageViewerRect | null;
  /** The tile's corner radius, so the zoom starts with the bubble's corner and squares off on the way out. */
  sourceRadius?: number;
  /** False plays the exit and then calls `onExited`. Derive it during render, never in an effect. */
  open?: boolean;
  onExited?: () => void;
  onClose?: () => void;
  /** Seek the entrance to this fraction (0..1) instead of playing it, and freeze every transition. */
  progress?: number;
  /** Header lines: who sent it above, when below. */
  title?: string;
  subtitle?: string;
  /** Show "2 of 5" beside the subtitle. Off by default: neither `PUOneUpSettings` nor QuickLook has a page indicator. */
  pageIndicator?: boolean;
  /** Header and footer visibility. Controlled when given; tapping the photo toggles it either way. */
  chrome?: boolean;
  onChromeChange?: (visible: boolean) => void;
  /** Fit is 1. Controlled when given. */
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  /** The reaction on the photo that is showing, and the picker over it. */
  reaction?: TapbackSelection | null;
  onReact?: (selection: TapbackSelection) => void;
  tapbackOpen?: boolean;
  onTapbackOpenChange?: (open: boolean) => void;
  recent?: string[];
  onShare?: () => void;
  onDelete?: () => void;
  onReply?: () => void;
  /** Insets the chrome stays inside. Defaults to the platform's measured ones. */
  safeArea?: { top?: number; bottom?: number };
  /** The viewer's own size before it can measure itself, e.g. during a server render. */
  frame?: ImageViewerSize;
  platform?: Platform;
};

/** The largest box of `aspect` that fits inside `frame`, centred. Native fits a photo, it does not fill. */
export function fitPhotoRect(aspect: number, frame: ImageViewerSize): ImageViewerRect {
  const width = Math.min(frame.width, frame.height * aspect);
  const height = width / aspect;
  return { x: (frame.width - width) / 2, y: (frame.height - height) / 2, width, height };
}

/**
 * UIScrollView's resistance: the first point of overscroll moves almost one for one and the curve
 * flattens from there, never passing `c * dimension`.
 */
export function rubberBand(distance: number, dimension: number, c: number = imageViewerMetrics.rubberBand): number {
  if (!dimension) return 0;
  const magnitude = Math.abs(distance);
  return Math.sign(distance) * (1 - 1 / (magnitude / (c * dimension) + 1)) * c * dimension;
}

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * The two poses of the open zoom, in the zoom layer's own coordinates with `transform-origin: 0 0`.
 * The end pose is the identity, because the photo is already fitted in the frame. The start pose scales
 * the whole frame down until the fitted photo covers `source` exactly, clips away everything outside
 * it, and divides the tile's corner radius by the same scale so it lands at `radius` on screen. Both
 * poses are `inset()` clips of the same shape, which is what makes the pair animatable.
 */
export function zoomPose(source: ImageViewerRect | null, fit: ImageViewerRect, frame: ImageViewerSize, radius: number) {
  const settled = { transform: "translate(0px, 0px) scale(1)", clipPath: "inset(0px 0px 0px 0px round 0px)", opacity: 1 };
  if (!source || !fit.width || !fit.height) {
    return { start: { transform: "translate(0px, 0px) scale(0.94)", clipPath: settled.clipPath, opacity: 0 }, end: settled };
  }
  const scale = Math.max(source.width / fit.width, source.height / fit.height);
  const tx = source.x + source.width / 2 - scale * (fit.x + fit.width / 2);
  const ty = source.y + source.height / 2 - scale * (fit.y + fit.height / 2);
  const left = (source.x - tx) / scale;
  const top = (source.y - ty) / scale;
  const width = source.width / scale;
  const height = source.height / scale;
  return {
    start: {
      transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
      clipPath: `inset(${top}px ${frame.width - left - width}px ${frame.height - top - height}px ${left}px round ${radius / scale}px)`,
      opacity: 1,
    },
    end: settled,
  };
}

/** SF Symbol "square.and.arrow.up" look-alike. */
function ShareIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <path d="M10.5 1.6v11.2M6.9 5.1l3.6-3.5 3.6 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.6 8.1H4.3a1.9 1.9 0 0 0-1.9 1.9v7.6a1.9 1.9 0 0 0 1.9 1.9h12.4a1.9 1.9 0 0 0 1.9-1.9V10a1.9 1.9 0 0 0-1.9-1.9h-1.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** SF Symbol "trash" look-alike. */
function TrashIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <path d="M3.4 5.3h14.2M8.2 5.3V3.9a1.3 1.3 0 0 1 1.3-1.3h2a1.3 1.3 0 0 1 1.3 1.3v1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.2 5.3l.8 11.4a1.9 1.9 0 0 0 1.9 1.8h5.2a1.9 1.9 0 0 0 1.9-1.8l.8-11.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.9 8.6v6.6M12.1 8.6v6.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** SF Symbol "arrowshape.turn.up.left" look-alike, the reply control `CKQLPreviewController -replyButton` puts in the bars. */
function ReplyIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <path d="M8.6 4.2 2.9 9.3l5.7 5.1v-2.9c4 0 6.7 1.1 8.4 4.3.3-5.1-2.1-8.3-8.4-8.7V4.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

type Point = { x: number; y: number };

type Gesture = {
  pointers: Map<number, Point>;
  mode: "none" | "undecided" | "page" | "dismiss" | "pan" | "pinch";
  start: Point;
  startPan: Point;
  startZoom: number;
  startSpread: number;
  startMid: Point;
  last: Point;
  lastTime: number;
  velocity: Point;
  tapTime: number;
  tapPoint: Point;
};

function spreadOf(points: Point[]) {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function midpointOf(points: Point[]): Point {
  return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
}

export function ImageViewer({
  photos,
  index: indexProp,
  defaultIndex = 0,
  onIndexChange,
  sourceRect = null,
  sourceRadius,
  open = true,
  onExited,
  onClose,
  progress,
  title,
  subtitle,
  pageIndicator = false,
  chrome: chromeProp,
  onChromeChange,
  zoom: zoomProp,
  onZoomChange,
  reaction = null,
  onReact,
  tapbackOpen: tapbackOpenProp,
  onTapbackOpenChange,
  recent,
  onShare,
  onDelete,
  onReply,
  safeArea,
  frame: frameProp,
  platform: platformProp,
  className,
  style,
  ...props
}: ImageViewerProps) {
  const contextPlatform = usePlatform();
  const platform = platformProp ?? contextPlatform;
  const m = imageViewerMetrics;
  const bars = m.bars[platform];
  const inset = { ...m.safeArea[platform], ...safeArea };
  const radius = sourceRadius ?? bubbleMetrics[platform].radius;
  const scrubbed = progress !== undefined;
  const count = photos.length;

  const root = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const zoomLayer = useRef<HTMLDivElement>(null);
  const chromeLayer = useRef<HTMLDivElement>(null);
  const tapbackButton = useRef<HTMLButtonElement>(null);
  const exited = useRef(false);
  const chromeTimer = useRef<number | undefined>(undefined);

  // The viewer lays out in its own coordinates, so it has to know its own box before it can fit a photo
  // or read `sourceRect`. `frame` covers the render before the observer has fired.
  const [measuredFrame, setMeasuredFrame] = useState<ImageViewerSize | null>(null);
  const frame = useMemo(
    () => measuredFrame ?? frameProp ?? (platform === "ios" ? { width: 402, height: 874 } : { width: 960, height: 640 }),
    [measuredFrame, frameProp, platform],
  );
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const sync = () => setMeasuredFrame({ width: node.clientWidth, height: node.clientHeight });
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const index = clamp(indexProp ?? internalIndex, 0, Math.max(0, count - 1));
  const setIndex = useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, Math.max(0, count - 1));
      if (indexProp === undefined) setInternalIndex(bounded);
      onIndexChange?.(bounded);
    },
    [indexProp, onIndexChange, count],
  );

  const [internalChrome, setInternalChrome] = useState(true);
  const chromeVisible = chromeProp ?? internalChrome;
  const setChrome = useCallback(
    (next: boolean) => {
      if (chromeProp === undefined) setInternalChrome(next);
      onChromeChange?.(next);
    },
    [chromeProp, onChromeChange],
  );

  const [internalZoom, setInternalZoom] = useState(1);
  const zoom = clamp(zoomProp ?? internalZoom, 1, m.maxZoom);
  const setZoom = useCallback(
    (next: number) => {
      const bounded = clamp(next, 1, m.maxZoom);
      if (zoomProp === undefined) setInternalZoom(bounded);
      onZoomChange?.(bounded);
    },
    [zoomProp, onZoomChange, m.maxZoom],
  );

  const [internalTapback, setInternalTapback] = useState(false);
  const tapbackOpen = tapbackOpenProp ?? internalTapback;
  const setTapbackOpen = useCallback(
    (next: boolean) => {
      if (tapbackOpenProp === undefined) setInternalTapback(next);
      onTapbackOpenChange?.(next);
    },
    [tapbackOpenProp, onTapbackOpenChange],
  );
  // The same derive-during-render rule the shells use for the long-press overlay: the picker has to
  // outlive the flag that opened it, because an effect would leave one committed frame with it already
  // gone and its dismissal would never be seen.
  const [seenTapbackOpen, setSeenTapbackOpen] = useState(tapbackOpen);
  const [tapbackClosing, setTapbackClosing] = useState(false);
  if (seenTapbackOpen !== tapbackOpen) {
    setSeenTapbackOpen(tapbackOpen);
    setTapbackClosing(!tapbackOpen && seenTapbackOpen);
  }

  // Where the footer's tapback button actually sits, so the picker's thought bubble points at it
  // rather than at the middle of the bar: the footer spreads its controls, and how many it has depends
  // on whether the caller wired a reply handler.
  const [tapbackCentre, setTapbackCentre] = useState<number | null>(null);
  useLayoutEffect(() => {
    const node = tapbackButton.current;
    if (!node) return;
    const sync = () => setTapbackCentre(node.offsetLeft + node.offsetWidth / 2);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [frame.width]);

  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragX, setDragX] = useState(0);
  const [drop, setDrop] = useState<Point>({ x: 0, y: 0 });
  const [settling, setSettling] = useState(false);
  const [aspects, setAspects] = useState<Record<string, number>>({});

  const aspectOf = useCallback(
    (photo: ImageViewerPhoto | undefined) => (photo && photo.width && photo.height ? photo.width / photo.height : (photo && aspects[photo.src]) || 4 / 3),
    [aspects],
  );
  const fit = useMemo(() => fitPhotoRect(aspectOf(photos[index]), frame), [aspectOf, photos, index, frame]);

  const pitch = frame.width + m.interpageSpacing;
  const trackX = -index * pitch + dragX;

  // How far the drag has carried the dismissal: 0 at rest, 1 where it commits.
  const dropProgress = clamp(Math.abs(drop.y) / m.dismiss.distance, 0, 1);
  const dropScale = 1 - (1 - m.dismiss.minScale) * dropProgress;

  /* ------------------------------------------------------------------ entrance and exit */

  const pose = useMemo(() => zoomPose(sourceRect, fit, frame, radius), [sourceRect, fit, frame, radius]);
  // The keyframes are read from a ref inside the timeline effect, so a re-render that only moves the
  // page or the pan cannot restart the entrance mid-flight.
  const poseRef = useRef(pose);
  // Written in a layout effect rather than in render: layout effects all run before the passive effect
  // below, so the timeline still reads the pose this render computed.
  useLayoutEffect(() => {
    poseRef.current = pose;
  });
  // `sourceRect` is a fresh object on every parent render, so the timeline keys off its values instead.
  const sourceKey = sourceRect ? `${sourceRect.x},${sourceRect.y},${sourceRect.width},${sourceRect.height}` : "";

  // Callers normally pass `onExited` inline, and it must not be an effect dependency: a parent
  // re-render mid-exit would cancel the exit and start it again, and it would never finish.
  const onExitedRef = useRef(onExited);
  useLayoutEffect(() => {
    onExitedRef.current = onExited;
  });

  useEffect(() => {
    exited.current = false;
    return () => window.clearTimeout(chromeTimer.current);
  }, []);

  useEffect(() => {
    const stage = zoomLayer.current;
    const ground = backdrop.current;
    const chromeNode = chromeLayer.current;
    if (!stage || !ground) return;
    const reduced = prefersReducedMotion();
    const duration = sourceKey ? m.timing.zoom : m.timing.fade;
    const { start, end } = poseRef.current;

    const finish = () => {
      if (exited.current) return;
      exited.current = true;
      onExitedRef.current?.();
    };

    if (open) {
      if (reduced && !scrubbed) return;
      const running = [
        stage.animate([start, end], { duration, easing: m.ease, fill: "both" }),
        ground.animate([{ opacity: 0 }, { opacity: 1 }], { duration: m.timing.backdrop, easing: "linear", fill: "both" }),
        chromeNode?.animate([{ opacity: 0 }, { opacity: 1 }], { duration, delay: m.timing.chromeDelay, easing: "linear", fill: "both" }),
      ].filter(Boolean) as Animation[];
      if (scrubbed) {
        // Seeked, not played: a scrubbed checkpoint has to land on the same frame every run.
        const at = clamp(progress ?? 0, 0, 1) * duration;
        for (const animation of running) {
          animation.pause();
          animation.currentTime = Math.min(at, Number(animation.effect?.getTiming().duration ?? duration));
        }
      }
      return () => running.forEach(animation => animation.cancel());
    }

    if (reduced) {
      finish();
      return;
    }
    // The exit reverses the entrance: back down into the tile it came out of, with the ground fading
    // out under it.
    const running = [
      stage.animate([end, start], { duration, easing: m.ease, fill: "forwards" }),
      ground.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: "linear", fill: "forwards" }),
      chromeNode?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: m.timing.chrome, easing: "linear", fill: "forwards" }),
    ].filter(Boolean) as Animation[];
    running[0].addEventListener("finish", finish);
    return () => {
      running[0].removeEventListener("finish", finish);
      running.forEach(animation => animation.cancel());
    };
  }, [open, scrubbed, progress, sourceKey, m.ease, m.timing.zoom, m.timing.fade, m.timing.backdrop, m.timing.chrome, m.timing.chromeDelay]);

  // Modal, so it takes focus when it opens. A scrubbed entrance does not: the harness seeks frames and
  // must not move the caret.
  useEffect(() => {
    if (!open || scrubbed) return;
    root.current?.focus({ preventScroll: true });
  }, [open, scrubbed]);

  /* ------------------------------------------------------------------ zoom, pan and paging */

  const panLimit = useCallback(
    (currentZoom: number) => ({
      x: Math.max(0, (fit.width * currentZoom - frame.width) / 2),
      y: Math.max(0, (fit.height * currentZoom - frame.height) / 2),
    }),
    [fit.width, fit.height, frame.width, frame.height],
  );

  const settle = useCallback(
    (nextZoom: number, nextPan: Point) => {
      const limit = panLimit(nextZoom);
      setSettling(true);
      setZoom(nextZoom);
      setPan({ x: clamp(nextPan.x, -limit.x, limit.x), y: clamp(nextPan.y, -limit.y, limit.y) });
    },
    [panLimit, setZoom],
  );

  const zoomAbout = useCallback(
    (nextZoom: number, point: Point) => {
      // Keep whatever is under the finger under the finger: the photo's centre moves by the change in
      // scale taken about that point.
      const centre = { x: frame.width / 2, y: frame.height / 2 };
      const ratio = nextZoom / zoom;
      const next = {
        x: point.x - centre.x - ratio * (point.x - centre.x - pan.x),
        y: point.y - centre.y - ratio * (point.y - centre.y - pan.y),
      };
      settle(nextZoom, nextZoom <= 1 ? { x: 0, y: 0 } : next);
    },
    [frame.width, frame.height, pan.x, pan.y, zoom, settle],
  );

  const page = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next > count - 1) return;
      setSettling(true);
      setDragX(0);
      setPan({ x: 0, y: 0 });
      setZoom(1);
      setIndex(next);
    },
    [index, count, setIndex, setZoom],
  );

  /* ------------------------------------------------------------------ gestures */

  const gesture = useRef<Gesture>({
    pointers: new Map(),
    mode: "none",
    start: { x: 0, y: 0 },
    startPan: { x: 0, y: 0 },
    startZoom: 1,
    startSpread: 0,
    startMid: { x: 0, y: 0 },
    last: { x: 0, y: 0 },
    lastTime: 0,
    velocity: { x: 0, y: 0 },
    tapTime: 0,
    tapPoint: { x: 0, y: 0 },
  });

  const localPoint = useCallback((clientX: number, clientY: number): Point => {
    const box = root.current?.getBoundingClientRect();
    return { x: clientX - (box?.left ?? 0), y: clientY - (box?.top ?? 0) };
  }, []);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const g = gesture.current;
    const point = localPoint(event.clientX, event.clientY);
    g.pointers.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSettling(false);
    if (g.pointers.size === 2) {
      const points = [...g.pointers.values()];
      g.mode = "pinch";
      g.startSpread = spreadOf(points) || 1;
      g.startMid = midpointOf(points);
      g.startZoom = zoom;
      g.startPan = { ...pan };
      return;
    }
    if (g.pointers.size > 2) return;
    // Always undecided to begin with, even zoomed in: a tap on a zoomed photo still has to reach the
    // double-tap and chrome paths, so the pan only starts once the pointer has moved past the slop.
    g.mode = "undecided";
    g.start = point;
    g.startPan = { ...pan };
    g.last = point;
    g.lastTime = event.timeStamp;
    g.velocity = { x: 0, y: 0 };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g.pointers.has(event.pointerId)) return;
    const point = localPoint(event.clientX, event.clientY);
    g.pointers.set(event.pointerId, point);

    if (g.mode === "pinch") {
      const points = [...g.pointers.values()].slice(0, 2);
      if (points.length < 2) return;
      const next = clamp((spreadOf(points) / g.startSpread) * g.startZoom, 1, m.maxZoom);
      const mid = midpointOf(points);
      const centre = { x: frame.width / 2, y: frame.height / 2 };
      const ratio = next / g.startZoom;
      setZoom(next);
      setPan({
        x: mid.x - centre.x - ratio * (g.startMid.x - centre.x - g.startPan.x),
        y: mid.y - centre.y - ratio * (g.startMid.y - centre.y - g.startPan.y),
      });
      return;
    }

    const dx = point.x - g.start.x;
    const dy = point.y - g.start.y;
    const dt = Math.max(1, event.timeStamp - g.lastTime);
    g.velocity = { x: ((point.x - g.last.x) / dt) * 1000, y: ((point.y - g.last.y) / dt) * 1000 };
    g.last = point;
    g.lastTime = event.timeStamp;

    if (g.mode === "undecided") {
      if (Math.hypot(dx, dy) < m.slop) return;
      // A zoomed photo pans in both axes; at fit, sideways is paging and downwards is a dismissal.
      g.mode = zoom > 1 ? "pan" : Math.abs(dx) > Math.abs(dy) ? "page" : "dismiss";
    }

    if (g.mode === "page") {
      // Rubber band at the two ends, where there is no page to bring on.
      const atStart = index === 0 && dx > 0;
      const atEnd = index === count - 1 && dx < 0;
      setDragX(atStart || atEnd ? rubberBand(dx, frame.width) : dx);
      return;
    }

    if (g.mode === "dismiss") {
      setDrop({ x: dx, y: dy });
      return;
    }

    if (g.mode === "pan") {
      const limit = panLimit(zoom);
      const wanted = { x: g.startPan.x + dx, y: g.startPan.y + dy };
      const band = (value: number, edge: number, dimension: number) =>
        Math.abs(value) > edge ? Math.sign(value) * edge + rubberBand(value - Math.sign(value) * edge, dimension) : value;
      setPan({ x: band(wanted.x, limit.x, frame.width), y: band(wanted.y, limit.y, frame.height) });
    }
  }

  function endGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    const point = g.pointers.get(event.pointerId);
    if (!point) return;
    g.pointers.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);

    if (g.mode === "pinch") {
      if (g.pointers.size >= 2) return;
      g.mode = "none";
      g.pointers.clear();
      const collapsed = zoom < 1.05;
      settle(collapsed ? 1 : zoom, collapsed ? { x: 0, y: 0 } : pan);
      return;
    }

    const mode = g.mode;
    g.mode = "none";

    if (mode === "page") {
      const commit = Math.abs(dragX) > frame.width * m.pageCommit.distance || Math.abs(g.velocity.x) > m.pageCommit.velocity;
      setSettling(true);
      setDragX(0);
      if (commit) page(dragX < 0 ? 1 : -1);
      return;
    }

    if (mode === "dismiss") {
      if (drop.y > m.dismiss.distance || g.velocity.y > m.dismiss.velocity) {
        onClose?.();
        return;
      }
      setSettling(true);
      setDrop({ x: 0, y: 0 });
      return;
    }

    if (mode === "pan") {
      settle(zoom, pan);
      return;
    }

    if (mode !== "undecided") return;

    // A tap. Two in a row toggle the zoom; one on its own toggles the chrome, after waiting out the
    // window in which a second tap could still arrive.
    const doubled = event.timeStamp - g.tapTime < m.doubleTap.window && Math.hypot(point.x - g.tapPoint.x, point.y - g.tapPoint.y) < m.doubleTap.slop;
    g.tapTime = doubled ? 0 : event.timeStamp;
    g.tapPoint = point;
    window.clearTimeout(chromeTimer.current);
    if (doubled) {
      if (m.allowDoubleTapZoom) zoomAbout(zoom > 1 ? 1 : m.doubleTapZoom, point);
      return;
    }
    if (!m.allowChromeHiding) return;
    const stamp = event.timeStamp;
    chromeTimer.current = window.setTimeout(() => {
      if (gesture.current.tapTime === stamp) setChrome(!chromeVisible);
    }, m.doubleTap.window);
  }

  // A trackpad pinch arrives as a ctrl-wheel, which is how a photo zooms on macOS. React attaches
  // `wheel` passively, so preventing the page from zooming needs a listener of our own.
  useEffect(() => {
    const node = zoomLayer.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      zoomAbout(clamp(zoom * (1 - event.deltaY / 100), 1, m.maxZoom), localPoint(event.clientX, event.clientY));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoom, zoomAbout, localPoint, m.maxZoom]);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (tapbackOpen) {
        setTapbackOpen(false);
        root.current?.focus({ preventScroll: true });
      } else onClose?.();
      return;
    }
    if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && zoom === 1) {
      event.preventDefault();
      page(event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomAbout(clamp(zoom * 1.5, 1, m.maxZoom), { x: frame.width / 2, y: frame.height / 2 });
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomAbout(clamp(zoom / 1.5, 1, m.maxZoom), { x: frame.width / 2, y: frame.height / 2 });
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      settle(1, { x: 0, y: 0 });
    }
  }

  /* ------------------------------------------------------------------ chrome geometry */

  const headerHeight = inset.top + bars.header;
  const footerHeight = inset.bottom + bars.footer;
  // The picker floats above the footer far enough that its thought bubble, which hangs half a Ø44 blob
  // below the pill, lands on the tapback button rather than under it.
  const pickerBottom = footerHeight + m.barsOutset + pickerBalloonGeometry.main / 2;
  const pickerInset = tapbackBarMetrics.ios.edgeInset;

  // The balloon's measured slot hangs it outside the bubble's trailing edge, which works over a bubble
  // and does not over a photo whose trailing edge can be the screen's. Keep the slot, then pull it back
  // inside the frame by the same edge inset a bubble keeps, and below the header.
  const balloon = balloonSlot[platform];
  const balloonSize = balloonGeometry[platform].main;
  const balloonLeft = Math.min(fit.x + fit.width + balloon.side, frame.width - balloonSize - bubbleMetrics[platform].edgeInset);
  const balloonTop = Math.max(headerHeight + m.barsOutset, fit.y + balloon.top);

  const chromeAlpha = chromeVisible && dropProgress === 0 ? 1 : 0;
  const barTransition = scrubbed ? "none" : `opacity ${m.timing.chrome}ms linear`;
  const trackTransition = scrubbed || !settling ? "none" : `transform ${m.timing.page}ms ${m.ease}`;
  const photoTransition = scrubbed || !settling ? "none" : `transform ${m.timing.bounce}ms ${m.ease}`;

  const ink = m.chromeInk;
  // The ground under the picker is measured black in both themes, so its glass takes the dark tokens
  // whatever the page's theme is.
  const vars = tapbackVars("dark", platform) as CSSProperties;

  const barButton: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: 0,
    background: "transparent",
    color: ink,
    padding: 0,
    fontFamily: "inherit",
    cursor: "default",
    minWidth: bars.footer,
    height: bars.footer,
  };

  const photo = photos[index];
  const position = count > 1 ? `attachment ${index + 1} of ${count}` : "";

  return (
    <div
      ref={root}
      data-slot="image-viewer"
      data-platform={platform}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Photo"}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn("absolute inset-0 select-none overflow-hidden outline-none", className)}
      style={{ fontFamily: fontStack, touchAction: "none", ...vars, ...style }}
      {...props}
    >
      {/* The ground: measured black in both themes, so it does not follow the palette. */}
      <div
        ref={backdrop}
        aria-hidden="true"
        data-slot="viewer-ground"
        style={{ position: "absolute", inset: 0, background: m.ground, opacity: 1 - dropProgress }}
      />

      <div ref={zoomLayer} data-slot="viewer-zoom" style={{ position: "absolute", inset: 0, transformOrigin: "0 0" }}>
        <div
          data-slot="viewer-stage"
          role="group"
          aria-label={["Photo", position].filter(Boolean).join(", ")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          style={{ position: "absolute", inset: 0 }}
        >
          <div
            data-slot="viewer-track"
            style={{ position: "absolute", inset: 0, transform: `translateX(${trackX}px)`, transition: trackTransition, willChange: "transform" }}
          >
            {photos.map((item, i) => {
              const active = i === index;
              // Every page's photo lags its own page by 1/parallaxFactor of that page's offset, so a
              // swipe does not slide the whole strip as one sheet. At rest the active page's is 0.
              const parallax = -(trackX + i * pitch) / m.parallaxFactor;
              const box = fitPhotoRect(aspectOf(item), frame);
              const offset = active
                ? { x: pan.x + drop.x + parallax, y: pan.y + drop.y, scale: zoom * dropScale }
                : { x: parallax, y: 0, scale: 1 };
              return (
                <div key={`${item.src}-${i}`} data-slot="viewer-page" style={{ position: "absolute", left: i * pitch, top: 0, width: frame.width, height: frame.height }}>
                  <div
                    data-slot="viewer-photo"
                    style={{
                      position: "absolute",
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.height,
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${offset.scale})`,
                      transformOrigin: "center center",
                      transition: active ? photoTransition : "none",
                      willChange: "transform",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.src}
                      alt={item.alt ?? "Photo"}
                      draggable={false}
                      decoding="async"
                      onLoad={event => {
                        const image = event.currentTarget;
                        if (!image.naturalWidth || !image.naturalHeight) return;
                        setAspects(known => (known[item.src] ? known : { ...known, [item.src]: image.naturalWidth / image.naturalHeight }));
                      }}
                      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div ref={chromeLayer} data-slot="viewer-chrome" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* A reaction on the photo: the same balloon a bubble carries, on the photo's top trailing
            corner and clamped so it never rides under the header or off the frame. The slot is the
            measured bubble one, because nothing captures a balloon on a full-screen photo, so its
            placement here is JUDGEMENT. It lives in the chrome layer so it fades up with the rest of
            the overlay instead of hanging in the air while the photo is still zooming. */}
        {reaction && (
          <div data-slot="viewer-reaction" style={{ position: "absolute", left: balloonLeft, top: balloonTop, opacity: 1 - dropProgress }}>
            <Tapback
              platform={platform}
              side="left"
              own
              reaction={"type" in reaction ? reaction.type : undefined}
              emoji={"emoji" in reaction ? reaction.emoji : undefined}
            />
          </div>
        )}

        <div
          data-slot="viewer-header"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: headerHeight,
            paddingTop: inset.top,
            display: "flex",
            alignItems: "center",
            color: ink,
            opacity: chromeAlpha,
            transition: barTransition,
            pointerEvents: chromeAlpha ? "auto" : "none",
            background: `linear-gradient(to bottom, ${m.barScrim}, transparent)`,
          }}
        >
          <button
            type="button"
            data-slot="viewer-done"
            onClick={onClose}
            style={{ ...barButton, height: bars.header, paddingInline: 16, fontSize: m.button.fontSize, fontWeight: m.button.weight }}
          >
            Done
          </button>
          <div
            data-slot="viewer-title"
            style={{ position: "absolute", left: 0, right: 0, top: inset.top, height: bars.header, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
          >
            <span style={{ fontSize: m.title.fontSize, fontWeight: m.title.weight, lineHeight: 1.2, color: ink }}>{title ?? "Photo"}</span>
            {(subtitle || (pageIndicator && count > 1)) && (
              <span style={{ display: "flex", gap: 6, fontSize: m.subtitle.fontSize, fontWeight: m.subtitle.weight, lineHeight: 1.2, color: ink, opacity: m.subtitle.opacity }}>
                {subtitle && <span>{subtitle}</span>}
                {pageIndicator && count > 1 && <span>{`${index + 1} of ${count}`}</span>}
              </span>
            )}
          </div>
        </div>

        <div
          data-slot="viewer-footer"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: footerHeight,
            paddingBottom: inset.bottom,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingInline: 16,
            color: ink,
            opacity: chromeAlpha,
            transition: barTransition,
            pointerEvents: chromeAlpha ? "auto" : "none",
            background: `linear-gradient(to top, ${m.barScrim}, transparent)`,
          }}
        >
          <button type="button" data-slot="viewer-share" aria-label="Share" onClick={onShare} style={barButton}>
            <ShareIcon size={m.glyph} />
          </button>
          {onReply && (
            <button type="button" data-slot="viewer-reply" aria-label="Reply" onClick={onReply} style={barButton}>
              <ReplyIcon size={m.glyph} />
            </button>
          )}
          <button
            type="button"
            ref={tapbackButton}
            data-slot="viewer-tapback"
            aria-label={reaction ? "Change reaction" : "Add a reaction"}
            aria-expanded={tapbackOpen}
            onClick={() => setTapbackOpen(!tapbackOpen)}
            style={barButton}
          >
            {reaction ? (
              <TapbackGlyph type={"type" in reaction ? reaction.type : undefined} emoji={"emoji" in reaction ? reaction.emoji : undefined} size={m.glyph} />
            ) : (
              <SmileyIcon size={m.glyph} color={ink} strokeWidth={1.6} />
            )}
          </button>
          <button type="button" data-slot="viewer-delete" aria-label="Delete" onClick={onDelete} style={barButton}>
            <TrashIcon size={m.glyph} />
          </button>
        </div>

        {(tapbackOpen || tapbackClosing) && (
          <ViewerTapbackPicker
            platform={platform}
            open={tapbackOpen}
            scrubbed={scrubbed}
            selected={reaction ?? undefined}
            recent={recent}
            width={frame.width - pickerInset * 2}
            bottom={pickerBottom}
            left={pickerInset}
            pickerX={(tapbackCentre ?? frame.width / 2) - pickerInset}
            onSelect={selection => {
              onReact?.(selection);
              setTapbackOpen(false);
              root.current?.focus({ preventScroll: true });
            }}
            onClose={() => {
              setTapbackOpen(false);
              root.current?.focus({ preventScroll: true });
            }}
            onExited={() => setTapbackClosing(false)}
          />
        )}
      </div>

      <span aria-live="polite" className="sr-only">{[photo?.alt || "Photo", position].filter(Boolean).join(", ")}</span>
    </div>
  );
}

/**
 * The reaction picker over a full-screen photo: the same `TapbackBar` a bubble gets, floated above the
 * footer instead of above a balloon, because a full-screen photo has no bubble to hang off.
 * `CKQLPreviewController -tapbackButtonFrameForFullScreenBalloonViewController:` anchors it on the
 * toolbar's tapback button and `-fullScreenBalloonViewControllerPickerViewUsesBottomTail:` points its
 * thought bubble down at that button, which is the placement here. Its dismissal takes
 * `CKUIBehaviorPhone -tapbackDismissalDuration`, 0.5 s. Its entrance has no framework value: JUDGEMENT,
 * the same 0.2 s the chrome fades in over.
 */
function ViewerTapbackPicker({
  platform,
  open,
  scrubbed,
  selected,
  recent,
  width,
  bottom,
  left,
  pickerX,
  onSelect,
  onClose,
  onExited,
}: {
  platform: Platform;
  open: boolean;
  scrubbed: boolean;
  selected?: TapbackSelection;
  recent?: string[];
  width: number;
  bottom: number;
  left: number;
  pickerX: number;
  onSelect: (selection: TapbackSelection) => void;
  onClose: () => void;
  onExited: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const m = imageViewerMetrics;
  // Same reason as the viewer's own exit: an inline `onExited` must not restart the dismissal.
  const onExitedRef = useRef(onExited);
  useLayoutEffect(() => {
    onExitedRef.current = onExited;
  });

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const reduced = prefersReducedMotion();
    if (open) {
      done.current = false;
      if (reduced || scrubbed) return;
      const animation = node.animate(
        [
          { opacity: 0, transform: "translateY(8px) scale(0.92)" },
          { opacity: 1, transform: "translateY(0px) scale(1)" },
        ],
        { duration: m.timing.chrome, easing: m.ease, fill: "both" },
      );
      return () => animation.cancel();
    }
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onExitedRef.current();
    };
    if (reduced) {
      finish();
      return;
    }
    const animation = node.animate(
      [
        { opacity: 1, transform: "translateY(0px) scale(1)" },
        { opacity: 0, transform: "translateY(8px) scale(0.92)" },
      ],
      { duration: m.timing.tapbackDismiss, easing: m.ease, fill: "forwards" },
    );
    animation.addEventListener("finish", finish);
    return () => {
      animation.removeEventListener("finish", finish);
      animation.cancel();
    };
  }, [open, scrubbed, m.timing.chrome, m.timing.tapbackDismiss, m.ease]);

  if (platform === "macos") {
    // UNVERIFIED, like the rest of the macOS presentation: the two-row picker lives in a context menu
    // natively, so over a photo it is given the menu's own surface as a floating panel, centred on the
    // same tapback button the iOS pill points at. The panel keeps its own centring transform and the
    // host carries the entrance, because one element cannot hold both: an animated `transform` replaces
    // the inline one outright.
    return (
      <div
        ref={host}
        data-slot="viewer-tapback-picker"
        style={{ position: "absolute", bottom, left: 0, right: 0, height: 0, pointerEvents: "none", transformOrigin: `${left + pickerX}px 100%` }}
      >
        <div
          data-slot="viewer-tapback-panel"
          style={{
            position: "absolute",
            bottom: 0,
            left: left + pickerX,
            transform: "translateX(-50%)",
            borderRadius: 12,
            background: "var(--im-menu-bg, rgba(30,34,39,0.92))",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5), inset 0 0 0 0.5px var(--im-menu-rim, rgba(255,255,255,0.28))",
            backdropFilter: "blur(30px) saturate(1.6)",
            WebkitBackdropFilter: "blur(30px) saturate(1.6)",
            color: "var(--im-menu-text, #dcddde)",
            pointerEvents: "auto",
          }}
        >
          <TapbackBar layout="macos" selected={selected} recent={recent} onSelect={onSelect} onClose={onClose} autoFocus={!scrubbed} />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={host}
      data-slot="viewer-tapback-picker"
      style={{ position: "absolute", bottom, left, width, pointerEvents: "auto", transformOrigin: `${pickerX}px 100%` }}
    >
      <TapbackBar layout="ios" selected={selected} recent={recent} onSelect={onSelect} onClose={onClose} autoFocus={!scrubbed} pickerX={pickerX} pickerSide="left" width={width} />
    </div>
  );
}
