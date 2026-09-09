"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/registry/imessage/avatar";
import { usePlatform, type Platform } from "@/registry/imessage/platform";
import { BalloonTrail, TapbackGlyph, balloonGeometry, macosBalloonRim, tapbackLabels, type BalloonGeometry, type TapbackType } from "@/registry/imessage/tapback";
import { fontStack } from "@/registry/imessage/tokens";

/**
 * "Tapback Details…", the surface both context menus open: who reacted, with what, and a way to take
 * your own reaction back.
 *
 * **NO CAPTURE EXISTS.** Nothing in `references/` records this surface on either platform, so not one
 * number below was read off a frame. They come from ChatKit 26.5 instead, the framework macOS
 * Messages is built on, read out of the live runtime on 2026-09-08 with a Mac Catalyst probe
 * (`clang -target arm64-apple-ios26.0-macabi`, `dlopen` of
 * `/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit`, then `objc_msgSend`
 * on the class and instance getters named below). Every value states its selector.
 *
 * ChatKit calls this the **voting view**: `-[CKUIBehavior messageAcknowledgementVotingViewHeight]`
 * and its neighbours size the platter, and the Swift type `ChatKit.StyleSupport` carries the interior
 * as class constants (`+votingViewCellWidth` and the rest). The strings are ChatKit's own, from
 * `ChatKit.framework/Resources/ChatKit.loctable` (`en`): `TAPBACK_DETAILS_ELLIPSIS` = "Tapback
 * Details…" is the menu row, `TAPBACK_DETAILS` = "Tapback Details" the title, and
 * `ACCESSIBILITY_TAPBACK_LABEL` = "%@ reacted with %@" plus
 * `ACCESSIBILITY_EXPANDED_TAPBACK_FORMAT` = "%lu %@ reactions from %@" are the accessibility texts
 * this file reproduces.
 *
 * **The native layout is a horizontal platter, not a table.** `votingViewPlatterCornerRadius` = 34
 * round, `messageAcknowledgementVotingViewHeight` = 72 tall on iOS and 80 on Mac, holding one
 * `votingViewCellWidth` = 64 wide cell per reactor: a `votingViewAvatarDiameter` = 44 avatar badged
 * with the reaction in a `votingViewAvatarViewGlyphFrame` 20 square, then
 * `votingViewAvatarToTextSpacing` = 4 and a `votingViewAvatarViewLabelHeight` = 18 name. The count
 * leads it as a `votingViewExpandedTally` 27 square per reaction kind with its total beside it
 * (`votingViewTallyLabelSpacing` = 0). This file reproduces that shape rather than a vertical list.
 *
 * **Mac numbers go through Catalyst's 0.77.** ChatKit is a UIKit framework and Messages a Catalyst
 * app, so one Mac-idiom point is 0.77 of an AppKit point. Two of ChatKit's own constants pin that
 * factor against measurements already in SPEC.md:
 * `+[ChatKit.StyleSupport transcriptTitleViewAvatarButtonDiameter]` = 52 lands on the macOS header's
 * measured Ø40 avatar (52 × 0.77 = 40.04), and `+transcriptTitleViewHeight` = 87 lands on the 67 that
 * capture's avatar and name pill span together (87 × 0.77 = 66.99). Neither matches iOS, whose nav
 * bar avatar is Ø60. Every macOS number here is therefore its ChatKit value times `catalystScale`,
 * and is unverified against a capture.
 *
 * **What is JUDGEMENT, and is marked so below:** the presentation's durations, the close button's
 * size, using the macOS knockout rim on the iOS badge, and presenting the platter as a bottom sheet
 * on iOS and an anchored popover on macOS (ChatKit has one platter and does not say how either host
 * presents it). The platter's fill, rim and shadow are not judgement: they reuse the glass solved
 * from `references/ios/captures/longpress-*.png` in `tapback.tsx`'s `tapbackVars`, and the balloon
 * artwork is the traced geometry from the same file, scaled.
 *
 * Not to be confused with `message-actions.tsx`'s `TapbackDetails`, which is a different ChatKit
 * surface: `CKTapbackAttributionView`, the card that floats above a long-pressed message you have
 * already reacted to (`-[CKUIBehavior attributionViewHeight]` = 132, `attributionViewMaxWidth` = 400
 * on iOS and 500 on Mac).
 */

/** One Mac-idiom UIKit point is this much of an AppKit point. See the header for the two constants that fix it. */
export const catalystScale = 0.77;

export type TapbackDetailsMetrics = {
  /** `-[CKUIBehavior messageAcknowledgementVotingViewHeight]`: 72 iOS, 80 Mac. */
  height: number;
  /** `+[ChatKit.StyleSupport votingViewPlatterCornerRadius]` = 34. */
  radius: number;
  /** `+votingViewHorizontalPadding` = 24. */
  paddingX: number;
  /** `+votingViewItemSpacing` = 24, between the tallies and between the cells. */
  itemSpacing: number;
  /** `+votingViewAdditionalTopInset` = 4. */
  topInset: number;
  /** `-[CKUIBehavior messageAcknowledgementVotingViewMaxWidth]`: 400 iOS, 500 Mac. */
  maxWidth: number;
  /** `-messageAcknowledgementVotingViewMinPadding`: 8 iOS, 6 Mac, from the presenting edge. */
  minPadding: number;
  /** `+votingViewCellWidth` = 64. */
  cellWidth: number;
  /** `+votingViewAvatarDiameter` = 44. */
  avatar: number;
  /** `+votingViewAvatarViewGlyphFrameWidth` and `…Height`, both 20: the reaction badged on the avatar. */
  glyphFrame: number;
  /** `+votingViewAvatarToTextSpacing` = 4. */
  avatarToText: number;
  /** `+votingViewAvatarViewLabelHeight` = 18. */
  labelHeight: number;
  /** `-[CKUIBehavior avatarNameFont]`: SFNS Regular 12 iOS, 16 Mac. */
  nameFontSize: number;
  /** `-[CKUIBehavior messageAcknowledgmentVoteCountFont]`: SFNS Regular 12 iOS, 16 Mac. */
  countFontSize: number;
  /** `+votingViewExpandedTallyWidth` and `…Height`, both 27. */
  tally: number;
  /** `+votingViewTallyLabelSpacing` = 0, between a tally and its count. */
  tallyLabelSpacing: number;
  /** `+votingViewBlurWidth` = 88: how far the platter fades its scrolling content at each end. */
  blurWidth: number;
  /** `+votingViewCloseButtonLeftPadding` = 22. The button's own size is judgement; see `closeSize`. */
  closeLeftPadding: number;
  /** JUDGEMENT: ChatKit gives the close button a left padding but no size, so it takes the tally's box. */
  closeSize: number;
};

const mac = (points: number) => Number((points * catalystScale).toFixed(4));

export const tapbackDetailsMetrics: Record<Platform, TapbackDetailsMetrics> = {
  ios: {
    height: 72, radius: 34, paddingX: 24, itemSpacing: 24, topInset: 4, maxWidth: 400, minPadding: 8,
    cellWidth: 64, avatar: 44, glyphFrame: 20, avatarToText: 4, labelHeight: 18,
    nameFontSize: 12, countFontSize: 12, tally: 27, tallyLabelSpacing: 0,
    blurWidth: 88, closeLeftPadding: 22, closeSize: 27,
  },
  macos: {
    height: mac(80), radius: mac(34), paddingX: mac(24), itemSpacing: mac(24), topInset: mac(4), maxWidth: mac(500), minPadding: mac(6),
    cellWidth: mac(64), avatar: mac(44), glyphFrame: mac(20), avatarToText: mac(4), labelHeight: mac(18),
    nameFontSize: mac(16), countFontSize: mac(16), tally: mac(27), tallyLabelSpacing: 0,
    blurWidth: mac(88), closeLeftPadding: mac(22), closeSize: mac(27),
  },
};

/**
 * The presentation. `scale` is ChatKit's own (`+[ChatKit.StyleSupport tapbackStartingScaleX]` and
 * `…ScaleY`, both 0.3). Everything else is JUDGEMENT, borrowed from motion this kit has already
 * measured rather than invented: `enter` and `ease` are the sheet duration and curve `ios-details.tsx`
 * uses for its own rise, and `exit`/`exitEase` are the long-press overlay's measured 220 ms dismissal
 * (`messageActionsTiming.exit`). ChatKit does carry `-[CKUIBehavior tapbackDismissalDuration]` = 0.5 s,
 * but it belongs to the picker rather than to this platter, so it is recorded and not used.
 */
export const tapbackDetailsMotion = {
  enter: 320,
  exit: 220,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
  exitEase: "cubic-bezier(0.4, 0, 1, 1)",
  scale: 0.3,
  /** ChatKit's `-[CKUIBehavior tapbackDismissalDuration]` in ms. Recorded, not used; see above. */
  frameworkDismissal: 500,
} as const;

/**
 * Light values ride the root's inline style so the platter renders correctly with no Tailwind at all;
 * the dark set rides a `dark:` class, the way `avatar.tsx` splits its own gradient.
 *
 * The platter's fill, rim and shadow are the glass `tapback.tsx` solved from the long-press captures
 * (`--im-glass-solid` #ededef light and #1f1e21 dark, with its rim and shadow). `--im-td-label` is
 * ChatKit's `-[CKUITheme messageAcknowledgmentVotingTextColor]`, which resolves to
 * `secondaryLabelColor`: rgba(0,0,0,0.498) light, rgba(255,255,255,0.549) dark, the same colour
 * `-attributionCountViewFontColor` returns for the count. The dim behind the iOS sheet is the 20%
 * black measured on `references/ios/captures/newmsg-light.png` (`ios-new-message-sheet.tsx`), and the
 * close button's fill is the segmented-control track measured on `effects-picker-light.png`.
 */
const lightVars = {
  "--im-td-platter": "#ededef",
  "--im-td-rim": "rgba(255,255,255,0.55)",
  "--im-td-shadow": "0 6px 24px rgba(0,0,0,0.10)",
  "--im-td-label": "rgba(0,0,0,0.498)",
  "--im-td-dim": "rgba(0,0,0,0.2)",
  "--im-td-fill": "rgba(120,120,128,0.16)",
  "--im-td-theirs": "#e9e9eb",
} as const;

const darkVars =
  "dark:[--im-td-platter:#1f1e21] dark:[--im-td-rim:rgba(255,255,255,0.10)] dark:[--im-td-shadow:0_6px_24px_rgba(0,0,0,0.5)] " +
  "dark:[--im-td-label:rgba(255,255,255,0.549)] dark:[--im-td-dim:rgba(0,0,0,0.5)] dark:[--im-td-fill:rgba(120,120,128,0.24)] " +
  "dark:[--im-td-theirs:#262629]";

/** Which corner of the popover its entrance grows out of. */
const transformOrigins: Record<"top-left" | "top-right" | "bottom-left" | "bottom-right", string> = {
  "top-left": "0% 0%",
  "top-right": "100% 0%",
  "bottom-left": "0% 100%",
  "bottom-right": "100% 100%",
};

export type TapbackReactor = {
  id: string;
  /** Full name, used for the accessible text. The cell truncates it to one line. */
  name: string;
  /** What the 64 wide cell shows under the avatar; the first word of `name` when absent. */
  shortName?: string;
  /** One or two letters for the avatar; derived from `name` when absent. */
  initials?: string;
  /** A photo instead of initials. */
  avatar?: string;
  /** One of the six classics. Ignored when `emoji` is set. */
  reaction?: TapbackType;
  /** A custom emoji reaction. */
  emoji?: string;
  /** Your own reaction: the one cell that can be activated to take it back. */
  own?: boolean;
};

export type TapbackDetailsProps = Omit<ComponentProps<"div">, "children"> & {
  reactors: TapbackReactor[];
  platform?: Platform;
  /** Called when the own cell is activated. ChatKit's own name for this action is "Remove Tapback". */
  onRemove?: (reactor: TapbackReactor) => void;
  /** Dismiss: Escape, the close button, the iOS dim, or a click outside the macOS popover. */
  onClose?: () => void;
  /** False plays the dismissal; the platter stays mounted until it is over, then calls `onExited`. */
  open?: boolean;
  onExited?: () => void;
  /**
   * Seek the presentation to this fraction (0..1) instead of playing it, which is what the harness
   * does. It seeks whichever direction `open` selects, and a seeked dismissal never fires `onExited`:
   * scrubbing a timeline is not a dismissal, and a checkpoint has to land on the same frame every run.
   */
  progress?: number;
  /** macOS: the popover's top-left corner in the containing block, and the corner it grows out of. */
  left?: number;
  top?: number;
  origin?: keyof typeof transformOrigins;
  /** Move focus into the platter when it opens (keyboard users). */
  autoFocus?: boolean;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

const reducedMotionQuery = () => (typeof window === "undefined" ? null : window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null);
function subscribeReducedMotion(onChange: () => void) {
  const query = reducedMotionQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}
/** `macos-plus-menu.tsx` has the same hook; this file keeps its own copy so it installs on its own. */
function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, () => reducedMotionQuery()?.matches ?? false, () => false);
}

function initialsOf(reactor: TapbackReactor) {
  if (reactor.initials) return reactor.initials;
  return reactor.name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? "").join("").toUpperCase();
}

function reactionKey(reactor: TapbackReactor) {
  return reactor.emoji ? `emoji:${reactor.emoji}` : `type:${reactor.reaction ?? "love"}`;
}

function reactionName(reactor: TapbackReactor) {
  return reactor.emoji ?? tapbackLabels[reactor.reaction ?? "love"];
}

/**
 * The balloon geometry from `tapback.tsx`, measured on `tapback-love-light.png` (iOS, Ø34) and on
 * both `tapback-love-*-2x.png` (macOS, Ø27.98), scaled so the whole balloon fills the ChatKit frame
 * it is given. Scaling the traced artwork keeps the glyph, the neck and both trailing circles in the
 * proportions the captures fix; only the overall size comes from the framework.
 */
export function scaledBalloonGeometry(platform: Platform, frame: number): BalloonGeometry {
  const g = balloonGeometry[platform];
  const k = frame / g.main;
  return {
    main: frame,
    medium: g.medium * k,
    small: g.small * k,
    mediumOffset: [g.mediumOffset[0] * k, g.mediumOffset[1] * k],
    smallOffset: [g.smallOffset[0] * k, g.smallOffset[1] * k],
    glyph: g.glyph * k,
    glyphOffsetY: (g.glyphOffsetY ?? 0) * k,
  };
}

/**
 * One reaction balloon at an arbitrary size, built from the scaled measured geometry. `Tapback`
 * itself is fixed at the balloon's own measured diameter, so the badge and the tally rebuild the
 * artwork here rather than scaling that component with a transform, which would scale its rim too.
 */
function Balloon({ geometry, own, side, rim = false, children, style }: { geometry: BalloonGeometry; own: boolean; side: "left" | "right"; rim?: boolean; children?: ReactNode; style?: CSSProperties }) {
  const fill = own ? "var(--im-tapback-own, #0088ff)" : "var(--im-td-theirs, #e9e9eb)";
  return (
    <span
      aria-hidden="true"
      data-slot="tapback-details-balloon"
      data-own={own}
      style={{
        position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
        width: geometry.main, height: geometry.main, borderRadius: "50%", background: fill,
        boxShadow: rim ? `0 0 0 ${macosBalloonRim}px var(--im-td-platter, #ededef)` : undefined,
        ...style,
      }}
    >
      {children}
      <BalloonTrail geometry={geometry} side={side} color={fill} />
    </span>
  );
}

/**
 * JUDGEMENT: the cell shows a first name. ChatKit sizes the label at `votingViewCellWidth` 64 with
 * `avatarNameFont` at 12, which fits a first name and truncates almost every full one; native avatar
 * stacks label themselves the same way. The whole name stays in the accessible text, and a caller
 * with a better short form passes `shortName`.
 */
function shortNameOf(reactor: TapbackReactor) {
  return reactor.shortName ?? reactor.name.trim().split(/\s+/)[0] ?? reactor.name;
}

export function TapbackDetails({
  reactors, platform: platformProp, onRemove, onClose, open = true, onExited, progress,
  left, top, origin = "top-left", autoFocus = false, className, style, ...props
}: TapbackDetailsProps) {
  const contextPlatform = usePlatform();
  const platform = platformProp ?? contextPlatform;
  const m = tapbackDetailsMetrics[platform];
  const t = tapbackDetailsMotion;
  const id = useId().replace(/:/g, "");
  const reduced = usePrefersReducedMotion();
  const platter = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  /**
   * The dismissal is derived DURING RENDER, not in an effect: an effect leaves one committed frame
   * with the platter already unmounted and the exit never gets to run. `macos-plus-menu.tsx` and
   * `ios-details.tsx` derive theirs the same way.
   */
  const [seenOpen, setSeenOpen] = useState(open);
  const [shown, setShown] = useState(open);
  const [settled, setSettled] = useState(open && reduced);
  if (seenOpen !== open) {
    setSeenOpen(open);
    if (open) { setShown(true); setSettled(reduced); }
    // Under reduced motion there is no dismissal to wait for, so it goes in the same frame.
    else if (reduced) setShown(false);
  }
  const closing = shown && !open;
  const state = closing ? "closing" : reduced || settled || (progress !== undefined && clamp01(progress) === 1) ? "open" : "entering";

  const exited = useRef(onExited);
  const close = useRef(onClose);
  useEffect(() => { exited.current = onExited; close.current = onClose; });

  // One place fires `onExited`, whether the platter left on its animation or under reduced motion.
  const wasShown = useRef(shown);
  useEffect(() => {
    if (wasShown.current && !shown) exited.current?.();
    wasShown.current = shown;
  }, [shown]);

  /**
   * Web Animations, not a transition or a rAF loop, so `document.getAnimations()` can reach the
   * timeline and a `progress` frame is a seek rather than a replay. iOS rises off the bottom edge the
   * way a sheet does; macOS pops out of the corner it is anchored by, from ChatKit's own 0.3.
   */
  useEffect(() => {
    const element = platter.current;
    if (!element || !shown || reduced) return;
    const poses: Keyframe[] = platform === "ios"
      ? [{ opacity: 0, transform: `translateY(${m.height + m.minPadding}px)` }, { opacity: 1, transform: "translateY(0px)" }]
      : [{ opacity: 0, transform: `scale(${t.scale})` }, { opacity: 1, transform: "scale(1)" }];
    const animation = open
      ? element.animate(poses, { duration: t.enter, easing: t.ease, fill: "both" })
      : element.animate([poses[1], poses[0]], { duration: t.exit, easing: t.exitEase, fill: "both" });
    if (progress !== undefined) {
      // Seeked, not played: a scrubbed checkpoint has to land on the same frame every run.
      animation.pause();
      try { animation.currentTime = clamp01(progress) * (open ? t.enter : t.exit); } catch { /* no timeline yet */ }
      return () => animation.cancel();
    }
    const done = () => (open ? setSettled(true) : setShown(false));
    animation.addEventListener("finish", done);
    return () => {
      animation.removeEventListener("finish", done);
      // Reopened mid-dismissal: drop the fold so it cannot hold a stale pose under the entrance.
      if (animation.playState !== "finished") animation.cancel();
    };
  }, [shown, open, progress, reduced, platform, m.height, m.minPadding, t.enter, t.exit, t.ease, t.exitEase, t.scale]);

  // The dim rides the same timeline, so a scrubbed frame is consistent with the platter's.
  useEffect(() => {
    const element = dim.current;
    if (!element || !shown || reduced) return;
    const animation = open
      ? element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: t.enter, easing: "ease-out", fill: "both" })
      : element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: t.exit, easing: "ease-out", fill: "both" });
    if (progress !== undefined) {
      animation.pause();
      try { animation.currentTime = clamp01(progress) * (open ? t.enter : t.exit); } catch { /* no timeline yet */ }
    }
    return () => { try { animation.cancel(); } catch { /* already gone */ } };
  }, [shown, open, progress, reduced, t.enter, t.exit]);

  // Escape from wherever focus is, and on macOS a click anywhere outside the popover.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !close.current) return;
      event.preventDefault();
      close.current();
    };
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node | null;
      if (platform !== "macos" || !close.current || !target || platter.current?.contains(target)) return;
      // The control that opened it owns the toggle; closing here would let its own click reopen it.
      if (target instanceof Element && target.closest('[aria-haspopup="dialog"]')) return;
      close.current();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, platform]);

  useEffect(() => {
    // A scrubbed entrance must not move the caret: the harness seeks frames, it does not open dialogs.
    if (!open || !autoFocus || progress !== undefined) return;
    platter.current?.querySelector<HTMLElement>("button, [tabindex]:not([tabindex='-1'])")?.focus({ preventScroll: true });
  }, [open, autoFocus, progress]);

  /**
   * ChatKit fades the platter's content over `votingViewBlurWidth` at each end, which only means
   * anything once there is more than fits. Keyboard users get the scroller itself as a focus stop
   * when that happens, which is the accessible pattern for a scrollable region.
   */
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    const hidden = node.scrollWidth - node.clientWidth;
    const next = { start: node.scrollLeft > 0.5, end: hidden > 0.5 && node.scrollLeft < hidden - 0.5 };
    setEdges(current => (current.start === next.start && current.end === next.end ? current : next));
  }, []);
  useLayoutEffect(() => {
    measure();
    const node = scroller.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure, reactors.length]);
  const overflowing = edges.start || edges.end;

  if (!shown || reactors.length === 0) return null;

  // Tallies keep first-appearance order, and one counts as yours if any reaction in it is yours.
  const tallies: Array<{ key: string; reactor: TapbackReactor; count: number; own: boolean; names: string[] }> = [];
  for (const reactor of reactors) {
    const key = reactionKey(reactor);
    const found = tallies.find(entry => entry.key === key);
    if (found) { found.count += 1; found.own = found.own || Boolean(reactor.own); found.names.push(reactor.name); }
    else tallies.push({ key, reactor, count: 1, own: Boolean(reactor.own), names: [reactor.name] });
  }

  const badge = scaledBalloonGeometry(platform, m.glyphFrame);
  const fade = `linear-gradient(to right, transparent 0, #000 ${m.blurWidth}px, #000 calc(100% - ${m.blurWidth}px), transparent 100%)`;

  /**
   * Hover, focus and pressed feedback on the one cell that does something. Driven from CSS so a
   * pointer crossing the platter never touches React state, and gated on `data-state` so nothing
   * lights up while the platter is still growing under a stationary cursor. The scroller hides its
   * bar: native fades its content instead, and a bar would eat the cells' bottom edge.
   */
  const platterCss = `[data-slot="tapback-details"] [data-slot="tapback-details-cell-fill"]{opacity:0;transition:opacity 80ms linear}
[data-slot="tapback-details"][data-state="open"] [data-slot="tapback-details-remove"]:hover [data-slot="tapback-details-cell-fill"]{opacity:1}
[data-slot="tapback-details"] [data-slot="tapback-details-remove"]:focus-visible [data-slot="tapback-details-cell-fill"]{opacity:1}
[data-slot="tapback-details"] [data-slot="tapback-details-remove"]:active [data-slot="tapback-details-cell-fill"]{opacity:1}
[data-slot="tapback-details-scroller"]::-webkit-scrollbar{display:none}
@media (prefers-reduced-motion: reduce){[data-slot="tapback-details"] [data-slot="tapback-details-cell-fill"]{transition:none}}`;

  const cellBody = (reactor: TapbackReactor) => (
    <>
      <span
        aria-hidden="true"
        data-slot="tapback-details-cell-fill"
        style={{ position: "absolute", left: 0, right: 0, top: -m.topInset / 2, bottom: -m.topInset / 2, borderRadius: m.avatar / 2, background: "var(--im-td-fill, rgba(120,120,128,0.16))" }}
      />
      <span style={{ position: "relative", display: "block", width: m.avatar, height: m.avatar, marginInline: "auto" }}>
        <Avatar size={m.avatar} initials={initialsOf(reactor)} src={reactor.avatar} role="presentation" aria-hidden="true" style={{ position: "absolute", inset: 0 }} />
        {/* The badge sits on the avatar's trailing-bottom with its trail pointing away, the way a
            balloon points away from its bubble. Its 0.5 knockout rim is measured on macOS
            (`macosBalloonRim`); using it on iOS too, where a balloon over a bubble has none, is
            JUDGEMENT: an avatar is not a bubble and the badge needs the separation. */}
        <Balloon geometry={badge} own={Boolean(reactor.own)} side="right" rim style={{ position: "absolute", right: -m.glyphFrame * 0.1, bottom: -m.glyphFrame * 0.1 }}>
          <TapbackGlyph
            type={reactor.emoji ? undefined : reactor.reaction ?? "love"}
            emoji={reactor.emoji}
            size={badge.glyph}
            onAccent={Boolean(reactor.own)}
            style={{ marginTop: reactor.emoji ? 0 : 2 * (badge.glyphOffsetY ?? 0) }}
          />
        </Balloon>
      </span>
      <span
        data-slot="tapback-details-name"
        style={{
          position: "relative", display: "block", marginTop: m.avatarToText, width: m.cellWidth, height: m.labelHeight,
          lineHeight: `${m.labelHeight}px`, fontSize: m.nameFontSize, fontWeight: 400, letterSpacing: 0,
          color: "var(--im-td-label, rgba(0,0,0,0.498))", textAlign: "center",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {shortNameOf(reactor)}
      </span>
    </>
  );

  const cells = reactors.map((reactor, index) => {
    // ChatKit's own accessibility string is "%@ reacted with %@"; the action that takes one back is
    // "Remove Tapback".
    const reacted = `${reactor.name} reacted with ${reactionName(reactor)}`;
    const box: CSSProperties = { position: "relative", display: "block", width: m.cellWidth, textAlign: "center" };
    return (
      <li key={reactor.id} data-slot="tapback-details-cell" data-own={reactor.own || undefined}
        style={{ listStyle: "none", margin: 0, padding: 0, marginLeft: index === 0 ? 0 : m.itemSpacing, flex: "0 0 auto" }}>
        {reactor.own && onRemove ? (
          <button type="button" data-slot="tapback-details-remove" aria-label={`${reacted}. Remove Tapback`} onClick={() => onRemove(reactor)}
            // The ring is inset: the scroller has to clip on the cross axis, so an outset one is cut.
            style={{ ...box, border: 0, background: "transparent", padding: 0, margin: 0, cursor: "default", font: "inherit", color: "inherit", outlineOffset: -2 }}>
            {cellBody(reactor)}
          </button>
        ) : (
          <span data-slot="tapback-details-person" role="img" aria-label={reacted} style={box}>
            {cellBody(reactor)}
          </span>
        )}
      </li>
    );
  });

  // The platter hugs its content and only then runs into `maxWidth`, which is what ChatKit's pair of
  // a max width and a minimum padding from the presenting edge describes. On macOS an absolutely
  // positioned box with an auto width already shrink-wraps; on iOS a centring row does it instead,
  // because setting both `left` and `right` would stretch it.
  const platterStyle: CSSProperties = {
    ...(platform === "ios"
      ? { position: "relative", maxWidth: `min(${m.maxWidth}px, 100%)` }
      : { position: "absolute", left, top, maxWidth: m.maxWidth }),
    boxSizing: "border-box",
    height: m.height,
    borderRadius: m.radius,
    paddingTop: m.topInset,
    paddingInline: m.paddingX,
    display: "flex",
    alignItems: "center",
    background: "var(--im-td-platter, #ededef)",
    boxShadow: "var(--im-td-shadow, 0 6px 24px rgba(0,0,0,0.10)), inset 0 0 0 0.5px var(--im-td-rim, rgba(255,255,255,0.55))",
    transformOrigin: transformOrigins[origin],
    // Nothing is clickable while it folds away, so a dismissal cannot pick a cell by accident.
    pointerEvents: closing ? "none" : undefined,
  };

  const inside = (
    <>
      <span id={`${id}-title`} style={{ position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap", border: 0 }}>Tapback Details</span>

      {/* The count and the people scroll together, which is what one fade at each end of the platter
          (`votingViewBlurWidth`) describes; only the close button is pinned. */}
      <div ref={scroller} data-slot="tapback-details-scroller"
        role={overflowing ? "group" : undefined} aria-label={overflowing ? "Reactions" : undefined} tabIndex={overflowing ? 0 : undefined}
        style={{
          flex: "0 1 auto", minWidth: 0, overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none",
          WebkitMaskImage: overflowing ? fade : undefined, maskImage: overflowing ? fade : undefined,
        }}>
        <div style={{ display: "flex", alignItems: "center", width: "max-content" }}>
          {/* ChatKit calls the count the expanded tally: one per reaction kind with its total beside
              it at `votingViewTallyLabelSpacing` 0, named with ChatKit's own
              ACCESSIBILITY_EXPANDED_TAPBACK_FORMAT, "%lu %@ reactions from %@". */}
          <div data-slot="tapback-details-tallies" style={{ display: "flex", alignItems: "center", flex: "0 0 auto", marginRight: m.itemSpacing }}>
            {tallies.map((entry, index) => (
              <span key={entry.key} data-slot="tapback-details-tally" role="img"
                aria-label={`${entry.count} ${reactionName(entry.reactor)} ${entry.count === 1 ? "reaction" : "reactions"} from ${entry.names.join(", ")}`}
                style={{ display: "inline-flex", alignItems: "center", marginLeft: index === 0 ? 0 : m.itemSpacing }}>
                {/* The tally is the bare glyph in ChatKit's `votingViewExpandedTally` box, not a
                    balloon: a balloon's neck and trail point at the bubble it belongs to, and a
                    summary has no bubble. */}
                <span aria-hidden="true" style={{ width: m.tally, height: m.tally, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <TapbackGlyph type={entry.reactor.emoji ? undefined : entry.reactor.reaction ?? "love"} emoji={entry.reactor.emoji} size={m.tally} />
                </span>
                <span aria-hidden="true" data-slot="tapback-details-count"
                  style={{ marginLeft: m.tallyLabelSpacing, fontSize: m.countFontSize, lineHeight: 1, fontWeight: 400, letterSpacing: 0, color: "var(--im-td-label, rgba(0,0,0,0.498))" }}>
                  {entry.count}
                </span>
              </span>
            ))}
          </div>
          <ul data-slot="tapback-details-list" style={{ display: "flex", alignItems: "center", margin: 0, padding: 0, listStyle: "none" }}>
            {cells}
          </ul>
        </div>
      </div>

      {onClose && (
        <button type="button" data-slot="tapback-details-close" aria-label="Close" onClick={onClose}
          style={{
            flex: "0 0 auto", marginLeft: m.closeLeftPadding, width: m.closeSize, height: m.closeSize,
            borderRadius: m.closeSize / 2, border: 0, padding: 0, cursor: "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--im-td-fill, rgba(120,120,128,0.16))", color: "var(--im-td-label, rgba(0,0,0,0.498))",
            outlineOffset: -2,
          }}>
          {/* The cross is 0.394 of its button, the ratio between the 17.33 cross and the Ø44 glass
              circle measured on `newmsg-light.png` in `ios-new-message-sheet.tsx`. */}
          <svg aria-hidden="true" width={m.closeSize * 0.394} height={m.closeSize * 0.394} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M1 1 11 11M11 1 1 11" />
          </svg>
        </button>
      )}
    </>
  );

  // macOS: the popover is the root, positioned by the caller against the message it belongs to.
  if (platform === "macos") {
    return (
      <div ref={platter} data-slot="tapback-details" data-platform="macos" data-state={state}
        role="dialog" aria-labelledby={`${id}-title`}
        className={cn("select-none", darkVars, className)}
        style={{ fontFamily: fontStack, zIndex: 40, ...lightVars, ...platterStyle, ...style } as CSSProperties}
        {...props}>
        <style>{platterCss}</style>
        {inside}
      </div>
    );
  }

  // iOS: the platter comes up over the dimmed conversation, so the dim is the root.
  return (
    <div data-slot="tapback-details" data-platform="ios" data-state={state}
      className={cn("absolute inset-0 z-40 select-none", darkVars, className)}
      style={{ fontFamily: fontStack, ...lightVars, ...style } as CSSProperties}
      {...props}>
      <style>{platterCss}</style>
      {/* The dim is the 20% black measured on `newmsg-light.png`; tapping it dismisses, as a sheet does. */}
      <div ref={dim} data-slot="tapback-details-dim" aria-hidden="true" onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "var(--im-td-dim, rgba(0,0,0,0.2))" }} />
      <div style={{ position: "absolute", left: m.minPadding, right: m.minPadding, bottom: m.minPadding, display: "flex", justifyContent: "center" }}>
        <div ref={platter} data-slot="tapback-details-platter" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} style={platterStyle}>
          {inside}
        </div>
      </div>
    </div>
  );
}
