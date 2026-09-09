"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * iOS 26 conversation details screen, measured from `references/ios/captures/details-light.png`
 * and `details-dark.png` (402×874 @3x). Every number below is a point value read off those frames:
 *
 * - Back button Ø44 glass circle centred (38, 84); avatar Ø80 centred (201, 102).
 * - Avatar initials: ink 44.00 wide by 26.67 cap, x 178.67–222.33, y 89.00–115.33. Chrome needs
 *   37.5pt at weight 650 to land there; 34pt semibold is 4.33 too narrow and 2.33 too short.
 * - Name 26pt bold centred on x 201, ink y 152.33–177.67.
 * - Three Ø54 glass action circles centred y 222.67 at x 127 / 201 / 275 (74 pitch). Glyphs are
 *   22pt SF Symbols: available ones use the label colour, unavailable ones tertiary label (30%).
 * - Grouped cells span x 16–386, radius 26 with a continuous corner, 20 between groups: phone
 *   269.67–340.33 (70.67 tall), links 360.33–464.33 (two 52 rows, 1pt separator at 411.33 inset to
 *   x 32–370), Hide Alerts 484.33–536.33, Block Contact 556.33–608.33. Row text starts at x 32.
 * - Cell and button fills are translucent: 6% black in light, 12% white in dark (over pure white
 *   that measures #efeff0, over black #1c1c1f — both read off the captures).
 * - Switch: 63×28 track (radius 14) with a 37×24 knob (radius 12) inset 2, trailing edge at x 372.
 *   The off track darkens the cell fill by 21% in light and lightens it by 28% in dark (sampled
 *   beside the knob against the bare cell on the same row).
 * - RECENT tag: 41×11.33 pill, radius 3.5, #c7c7cc in both themes, 8.5pt bold label (cap 6).
 *
 * The screen sits over the conversation, which is blurred (σ≈18) and washed out by a 49% white /
 * 59% black scrim; pass that conversation as `backdrop`.
 *
 * The presentation is a separate matter, and its timings are UNMEASURED: no capture in this repo
 * records this screen in motion, so nothing below is a reading off a frame. See `iosDetailsMotion`.
 */

const font = "-apple-system, BlinkMacSystemFont, sans-serif";

/** Light/dark values live in CSS variables so a `.dark` ancestor flips the whole screen. */
const vars =
  "[--ios-dt-label:#000000] [--ios-dt-secondary:#848488] [--ios-dt-blue:#0088ff] [--ios-dt-red:#ff383c] " +
  "[--ios-dt-fill:rgba(0,0,0,0.06)] [--ios-dt-separator:#dadadb] [--ios-dt-glyph:#000000] [--ios-dt-glyph-off:rgba(0,0,0,0.26)] [--ios-dt-glyph-blend:normal] [--ios-dt-av-top:#a9c2e1] [--ios-dt-av-bottom:#747fb9] " +
  "[--ios-dt-tag:#c7c7cc] [--ios-dt-tag-label:#ffffff] [--ios-dt-track:rgba(0,0,0,0.21)] [--ios-dt-knob:#ffffff] " +
  "[--ios-dt-scrim:rgba(255,255,255,0.573)] [--ios-dt-saturate:1] [--ios-dt-page:#ffffff] " +
  "dark:[--ios-dt-label:#ffffff] dark:[--ios-dt-secondary:#98989f] dark:[--ios-dt-blue:#0091ff] dark:[--ios-dt-red:#ff4245] " +
  "dark:[--ios-dt-fill:rgba(235,235,245,0.12)] dark:[--ios-dt-separator:#3a3a3c] dark:[--ios-dt-glyph:#ffffff] dark:[--ios-dt-glyph-off:rgba(255,255,255,0.26)] dark:[--ios-dt-glyph-blend:plus-lighter] dark:[--ios-dt-av-top:#575368] dark:[--ios-dt-av-bottom:#302649] " +
  "dark:[--ios-dt-track:rgba(255,255,255,0.28)] " +
  "dark:[--ios-dt-scrim:rgba(0,0,0,0.587)] dark:[--ios-dt-saturate:1.05] dark:[--ios-dt-page:#000000]";

/** Apple's continuous corner. Browsers without `corner-shape` fall back to a plain round corner. */
const continuous = { cornerShape: "superellipse(1.14)" } as CSSProperties;

export type IosDetailsAction = {
  id: string;
  label: string;
  icon: "phone" | "video" | "mail";
  /** Unavailable actions keep the glass circle but drop the glyph to tertiary label (measured). */
  disabled?: boolean;
  onPress?: () => void;
};

export type IosDetailsProps = Omit<ComponentProps<"div">, "children" | "onChange"> & {
  name: string;
  initials?: string;
  /** Replaces the initials avatar (an <img>, say). */
  avatar?: ReactNode;
  /** First cell: a small label ("phone") over its value, with an optional tag ("RECENT"). */
  phoneLabel?: string;
  phone?: string;
  tag?: string;
  actions?: IosDetailsAction[];
  /** Blue link rows in the second cell. */
  links?: Array<{ id: string; label: string; onPress?: () => void }>;
  hideAlerts?: boolean;
  onHideAlertsChange?: (next: boolean) => void;
  hideAlertsLabel?: string;
  blockLabel?: string;
  onBlock?: () => void;
  onBack?: () => void;
  /** The conversation behind the screen; rendered blurred and washed out. */
  backdrop?: ReactNode;
  /**
   * Seek the presentation to this fraction instead of playing it, which is what the harness does:
   * while `open`, 0 is dismissed and 1 is settled; while it is closing, 0 is settled and 1 is gone.
   * Leave it unset for the real thing.
   */
  progress?: number;
  /** False plays the dismissal; `onExited` fires when it is over, and the consumer unmounts then. */
  open?: boolean;
  onExited?: () => void;
};

/**
 * The presentation's timings. UNMEASURED, and they cannot be measured from anything in this repo:
 * no capture records this screen in motion. They sit in the family of the ones that were measured:
 *
 * - The rise takes 320 ms on `cubic-bezier(0.32, 0.72, 0, 1)`, the curve the measured effects screen
 *   (`ios-effects-picker.tsx`, 260 ms), this file's own Hide Alerts switch (220 ms) and the app
 *   shell's screen transitions (`iosScreenTransition`, 400 ms present) all already use.
 * - The scrim and the shared chrome fade over 220 ms, a little ahead of the rise, the way the
 *   long-press overlay's measured dim (150 of its 600 ms) leads its menu.
 * - The way out is 260 ms on the long-press menu's exit curve, between that menu's own 220 ms exit
 *   and the shell's 280 ms dismiss.
 *
 * What IS measured is the pose at each end. The settled pose is `details-light.png`, unchanged: the
 * timeline is cancelled once it lands, so the screen at rest carries no transform at all. The start
 * pose is the conversation's own nav bar, so the screen grows out of the control that opened it:
 * `ios-nav-bar.tsx` puts the avatar Ø60 centred (201, 92) and the name pill's 17pt text centred on
 * y 133.5 (status bar 54 + pill top 63, 32.33 tall, its span nudged 0.33 down); this screen puts the
 * avatar Ø80 centred (201, 102) and the 28pt name centred on y 162.65. So the avatar grows 60 → 80
 * (scale 0.75) across 10 pt of centre, which is the same thing as growing downward from a top edge
 * both screens put on y 62; the name grows 17 → 28 (scale 0.6071) across 29.15; and the back button
 * does not move at all, being Ø44 at (16, 62) on both. The avatar's 37.5pt initials land on 28.1pt
 * at that scale, a third of a point off the nav bar's own 28.
 *
 * The one number here that touches the capture is `backdropScale`. A sheet pushes what it covers
 * back; under σ18 of blur and a 57% scrim the capture cannot tell whether it did. Diffed against
 * `details-light.png` over 0 60 402 560 the settled screen misses 1713 px of 2,026,080 unscaled and
 * 1642 px at 0.96 (both 0.08%; dark is 3136 / 3068, both 0.15%), so the frame does not decide it and
 * this is a presentation choice, not a measurement. The blur is divided by the scale so that what
 * lands on screen is still σ18.
 */
/** The control points behind `iosDetailsMotion.ease`; the drag inverts the curve through them. */
const sheetCurve = [0.32, 0.72, 0, 1] as const;

export const iosDetailsMotion = {
  /** The whole entrance, and the sheet's own rise inside it. */
  enter: 360,
  sheet: 320,
  /** The scrim, and the chrome both screens share. */
  dim: 220,
  exit: 260,
  ease: `cubic-bezier(${sheetCurve.join(", ")})`,
  exitEase: "cubic-bezier(0.4, 0, 1, 1)",
  /** The conversation behind: its blur, and how far the sheet pushes it back. */
  blur: 18,
  backdropScale: 0.96,
  /** The three glass buttons, then the grouped cells, settle after the header in a short stagger. */
  actionStart: 60, actionStagger: 22, actionRise: 14, actionDuration: 200,
  cellStart: 80, cellStagger: 24, cellRise: 22, cellDuration: 200,
  /** A drag past this far, or released faster than this (px/ms), dismisses. */
  dragCommit: 120, dragVelocity: 0.6,
} as const;

/** Where the header comes from: the nav bar's own avatar and name pill, both measured (see above). */
export const iosDetailsMorph = {
  avatar: { dy: -10, scale: 60 / 80 },
  name: { dy: -29.15, scale: 17 / 28 },
} as const;

type Pose = Record<string, string>;
type Layer = { el: HTMLElement; from: Pose; to: Pose; duration: number; delay: number; easing: string };

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }
function stop(animation: Animation) { try { animation.cancel(); } catch { /* already gone */ } }

/**
 * Where in the rise the sheet stands `covered` of the way up: the entrance curve read backwards.
 * A drag scrubs the timeline, and `cubic-bezier(0.32, 0.72, 0, 1)` spends most of its travel in the
 * first fifth of it, so scrubbing it linearly would leave the screen nearly still under a finger
 * that has already moved 200 pt. Bisect the curve's y for its parameter, then read its x.
 */
function riseSeek(covered: number): number {
  const [x1, y1, x2, y2] = sheetCurve;
  const at = (a: number, b: number, t: number) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  let low = 0, high = 1, t = 0.5;
  for (let step = 0; step < 24; step++) { t = (low + high) / 2; if (at(y1, y2, t) < covered) low = t; else high = t; }
  return at(x1, x2, t);
}

/** What an element is holding right now, so a dismissal can start from a half-played entrance or a drag. */
function poseNow(el: HTMLElement, shape: Pose): Pose {
  const style = getComputedStyle(el);
  const pose: Pose = {};
  for (const key of Object.keys(shape)) pose[key] = style.getPropertyValue(key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)) || shape[key];
  return pose;
}

/**
 * Every layer of the presentation, as the pose it holds while dismissed and the pose it settles on.
 * The settled pose is what the element already carries at rest, so cancelling the timeline when it
 * lands leaves the measured screen with no animation, no transform and its glass intact (a held
 * animation would promote each layer and cut the glass circles off from the backdrop they blur).
 *
 * `translate` and `scale` are used rather than `transform`, so a layer whose measured position is
 * already carried by a fractional `transform` (the action circles, via `subpixel`) keeps it.
 */
function detailsLayers(content: HTMLElement, blur: HTMLElement | null, scrim: HTMLElement | null, height: number, saturate: string): Layer[] {
  const m = iosDetailsMotion;
  const layers: Layer[] = [];
  const add = (el: HTMLElement | null, from: Pose, to: Pose, duration: number, delay = 0, easing: string = m.ease) => {
    if (el) layers.push({ el, from, to, duration, delay, easing });
  };
  const own = (slot: string) => content.querySelector<HTMLElement>(`:scope > [data-slot="${slot}"]`);
  const each = (slot: string) => Array.from(content.querySelectorAll<HTMLElement>(`:scope > [data-slot="${slot}"]`));
  // The chrome that both screens share is already on screen, in the same place: it cancels the
  // sheet's rise exactly (same duration, same easing) and morphs out of the nav bar instead.
  const stay = (dy: number) => `0px ${(dy - height).toFixed(3)}px`;

  add(blur,
    { filter: `blur(0px) saturate(${saturate})`, scale: "1" },
    { filter: `blur(${(m.blur / m.backdropScale).toFixed(3)}px) saturate(${saturate})`, scale: String(m.backdropScale) },
    m.sheet);
  add(scrim, { opacity: "0" }, { opacity: "1" }, m.dim, 0, "ease-out");
  add(content, { translate: `0px ${height}px` }, { translate: "0px 0px" }, m.sheet);
  add(own("back"), { translate: stay(0) }, { translate: "0px 0px" }, m.sheet);
  add(own("back"), { opacity: "0" }, { opacity: "1" }, m.dim, 0, "ease-out");
  add(own("avatar"), { translate: stay(iosDetailsMorph.avatar.dy), scale: String(iosDetailsMorph.avatar.scale) }, { translate: "0px 0px", scale: "1" }, m.sheet);
  add(own("name"), { translate: stay(iosDetailsMorph.name.dy), scale: String(iosDetailsMorph.name.scale) }, { translate: "0px 0px", scale: "1" }, m.sheet);
  each("action").forEach((el, index) => add(el, { translate: `0px ${m.actionRise}px` }, { translate: "0px 0px" }, m.actionDuration, m.actionStart + index * m.actionStagger));
  each("cell").forEach((el, index) => add(el, { translate: `0px ${m.cellRise}px` }, { translate: "0px 0px" }, m.cellDuration, m.cellStart + index * m.cellStagger));
  return layers;
}

/** Web Animations, not a rAF loop or a transition, so `document.getAnimations()` can seek a frame. */
function runLayers(layers: Layer[], phase: "enter" | "exit"): Animation[] {
  const m = iosDetailsMotion;
  return layers.map(({ el, from, to, duration, delay, easing }) => phase === "enter"
    ? el.animate([from, to], { duration, delay, easing, fill: "both" })
    // One flat span on the way out, so the shared chrome's counter-translate still cancels the
    // sheet's exactly, and it starts from wherever the layer is now (settled, or mid-drag).
    : el.animate([poseNow(el, from), from], { duration: m.exit, easing: m.exitEase, fill: "both" }));
}

/** Swallows the click a drag would otherwise leave behind on whatever control it started on. */
function swallowClick(node: HTMLElement | null) {
  if (!node) return;
  const swallow = (event: Event) => { event.stopPropagation(); event.preventDefault(); };
  node.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => node.removeEventListener("click", swallow, true), 0);
}

type GlassCircleProps = ComponentProps<"button"> & { size: number; "data-slot"?: string; "data-action"?: string };

function GlassCircle({ size, className, style, children, ...rest }: GlassCircleProps) {
  return (
    <button type="button"
      className={cn("absolute flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088ff]", className)}
      style={{ width: size, height: size, background: "var(--ios-dt-fill)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", ...style }}
      {...rest}>
      {children}
    </button>
  );
}

/**
 * SF Symbol stand-ins, drawn at the ink sizes measured inside the Ø54 circles. Ink boxes read off
 * `details-light.png` (mean-intensity edges, so they are good to about a third of a point):
 * phone x 118.0–136.0 y 213.67–231.33, video x 190.0–213.11 y 215.02–230.33, mail x 263.67–286.33
 * y 214.67–230.67. Blink snaps each `<svg>` box to a whole CSS pixel, so glyphs whose centred
 * position lands on a half point carry the remainder in a transform, the way `subpixel` does.
 */
function ActionGlyph({ icon }: { icon: IosDetailsAction["icon"] }) {
  const id = useId();
  if (icon === "phone") {
    // 18.36 wide, not 17: at 17 the ink measures 16.67 across against the capture's 18.0.
    return (
      <svg aria-hidden="true" width="18.36" height="17.3333" viewBox="1.72 1.25 13.5 13.5" fill="currentColor">
        <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.6 17.6 0 0 0 4.168 6.608 17.6 17.6 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.68.68 0 0 0-.58-.122l-2.19.547a1.75 1.75 0 0 1-1.657-.459L5.482 8.062a1.75 1.75 0 0 1-.46-1.657l.548-2.19a.68.68 0 0 0-.122-.58z" />
      </svg>
    );
  }
  if (icon === "video") {
    // Body 16.33 wide (capture x 190.0–206.33), a 1.17 gap, then the lens wedge: its neck stands on
    // x 17.5 running y 4.60–10.70 and its outer edge on the ink's right, y 1.22–14.08. Both slanted
    // edges measure 0.615 of rise per point across, checked at x 208.0 and x 212.33 top and bottom.
    // The half-point centring is snapped away by Blink, so the third of a point comes back here.
    return (
      <svg aria-hidden="true" width="23" height="15.3333" viewBox="0 0 23 15.3333" fill="currentColor" style={{ transform: "translateY(0.3333px)" }}>
        <rect x="0" y="0" width="16.3333" height="15.3333" rx="3.6" />
        <path d="M17.969 4.312 22.531 1.508Q23 1.22 23 1.77V13.53Q23 14.08 22.531 13.792L17.969 10.988Q17.5 10.7 17.5 10.15V5.15Q17.5 4.6 17.969 4.312Z" />
      </svg>
    );
  }
  // The envelope is a 22.67 × 16 rounded rect crossed by four 0.9 wide creases, read off
  // `details-light.png`: the flap runs corner to corner through (11.33, 10.4), and a short seam
  // rises from each bottom corner to meet the flap's arm at (8.3, 7.7) / (14.37, 7.7).
  return (
    // Centred on 275 a 22.67 wide box starts on 263.667, and Blink snaps both edges inward: the
    // envelope then renders 22.0 across instead of the capture's 263.67–286.33. A whole 23 wide box
    // survives the snap (263.5 rounds to 264), the viewBox insets the 22.67 of artwork inside it,
    // and half a point of transform carries the pair onto the measured edges.
    <svg aria-hidden="true" width="23" height="16" viewBox="-0.1667 0 23 16" style={{ transform: "translateX(-0.5px)" }}>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="22.6667" height="16">
        <rect width="22.6667" height="16" rx="2.6" fill="#ffffff" />
        <path d="M-0.7 0 11.3333 10.4 23.37 0M0 16 8.3 7.7M22.6667 16 14.3667 7.7" fill="none" stroke="#000000" strokeWidth="0.9" />
      </mask>
      <rect width="22.6667" height="16" rx="2.6" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  );
}

export type IosSwitchProps = Omit<ComponentProps<"button">, "onChange"> & {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
};

/** iOS 26 switch: 63×28 track, 37×24 knob inset 2 (measured on the Hide Alerts row). */
export function IosSwitch({ checked = false, onChange, label, className, style, ...rest }: IosSwitchProps) {
  return (
    <button type="button" data-slot="ios-switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange?.(!checked)}
      className={cn("relative shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088ff] motion-reduce:!transition-none", className)}
      style={{ width: 63, height: 28, borderRadius: 14, overflow: "hidden", background: checked ? "#34c759" : "var(--ios-dt-track)", transition: "background 200ms ease", ...style }}
      {...rest}>
      {/*
        The capture shows no shadow outside the switch at all: one pixel past the track the pixels
        are already the surrounding gradient, and inside the track the knob only darkens it by ~3/255.
        The track therefore clips the knob's shadow, and that shadow is barely there.
      */}
      <span aria-hidden="true" className="absolute block motion-reduce:!transition-none" style={{
        left: 2, top: 2, width: 37, height: 24, borderRadius: 12, background: "var(--ios-dt-knob)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
        transform: `translateX(${checked ? 22 : 0}px)`, transition: "transform 220ms cubic-bezier(0.32,0.72,0,1)",
      }} />
    </button>
  );
}

/**
 * Blink snaps a painted box to whole CSS px, so a fill placed straight on a third-of-a-point edge
 * lands a device pixel off at 3x. The fill therefore sits on an integer box and a transform carries
 * the fraction; transforms are composited without snapping. `subpixel` does the same for any element
 * whose measured position is not a whole point.
 */
export function subpixel(top: number): CSSProperties {
  const whole = Math.floor(top);
  return { top: whole, transform: `translateY(${(top - whole).toFixed(4)}px)` };
}

function Cell({ top, height, children }: { top: number; height: number; children: ReactNode }) {
  const whole = Math.floor(top);
  const boxHeight = Math.max(1, Math.round(height));
  return (
    <div data-slot="cell" className="absolute" style={{ left: 16, top, width: 370, height }}>
      <span aria-hidden="true" data-slot="cell-fill" className="absolute" style={{
        left: 0, top: whole - top, width: 370, height: boxHeight, borderRadius: 26,
        background: "var(--ios-dt-fill)", transformOrigin: "0 0",
        transform: `translateY(${(top - whole).toFixed(4)}px) scaleY(${(height / boxHeight).toFixed(5)})`,
        ...continuous,
      }} />
      {children}
    </div>
  );
}

export function IosDetails({
  name, initials, avatar, phoneLabel = "phone", phone, tag, actions = [], links = [],
  hideAlerts = false, onHideAlertsChange, hideAlertsLabel = "Hide Alerts", blockLabel = "Block Contact", onBlock,
  onBack, backdrop, progress, open = true, onExited, className, style, ...props
}: IosDetailsProps) {
  const letters = initials ?? name.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? "").join("").toUpperCase();
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const blur = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const timeline = useRef<Animation[] | null>(null);
  const landed = useRef(false);
  const exited = useRef(onExited);
  useEffect(() => { exited.current = onExited; }, [onExited]);

  // The dismissal is derived during render, not in an effect: an effect leaves one committed frame
  // with the screen already gone, and the exit never runs. `closing` also separates a screen that is
  // leaving (fire `onExited`, stop taking clicks) from one mounted closed, which just sits dismissed.
  const [seenOpen, setSeenOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  if (seenOpen !== open) { setSeenOpen(open); setClosing(!open); }

  const build = (phase: "enter" | "exit"): Animation[] | null => {
    const node = content.current;
    const box = root.current;
    if (!node || !box) return null;
    const height = box.getBoundingClientRect().height;
    if (!height) return null;
    const saturate = getComputedStyle(box).getPropertyValue("--ios-dt-saturate").trim() || "1";
    return runLayers(detailsLayers(node, blur.current, scrim.current, height, saturate), phase);
  };
  const land = (list: Animation[]) => {
    if (timeline.current !== list) return;
    list.forEach(stop);
    timeline.current = null;
    landed.current = true;
  };

  // Only unmount cancels the timeline. The two phases hand over to each other without one, so a
  // dismissal can read the pose the entrance, or a drag, is still holding.
  useEffect(() => () => { timeline.current?.forEach(stop); timeline.current = null; }, []);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) { landed.current = true; return; }
    const previous = timeline.current;
    const next = build(open ? "enter" : "exit");
    previous?.forEach(stop);
    timeline.current = next;
    landed.current = false;
    // One rebuild per phase, and `build` only reads refs.
  }, [open]);

  useLayoutEffect(() => {
    // Reduced motion: the screen is simply there, and leaves at once. Its resting styles are the
    // settled pose, so there is nothing to undo.
    if (prefersReducedMotion()) { if (!open && closing) exited.current?.(); return; }
    const list = timeline.current ?? build(open ? "enter" : "exit");
    if (!list) return;
    timeline.current = list;
    const total = open ? iosDetailsMotion.enter : iosDetailsMotion.exit;
    const seek = (time: number) => list.forEach(animation => { animation.pause(); try { animation.currentTime = time; } catch { /* no timeline yet */ } });
    if (progress !== undefined) {
      const time = clamp01(progress) * total;
      seek(time);
      // A settled checkpoint is screenshotted, so drop the timeline there and let the glass breathe.
      if (open && time >= total) land(list);
      return;
    }
    // Mounted closed rather than closing: hold the dismissed pose instead of playing a dismissal.
    if (!open && !closing) { seek(total); return; }
    let dropped = false;
    list.forEach(animation => animation.play());
    Promise.allSettled(list.map(animation => animation.finished)).then(() => {
      if (dropped) return;
      if (open) land(list);
      else if (closing && timeline.current === list) exited.current?.();
    });
    return () => { dropped = true; };
  }, [open, progress, closing]);

  // The screen covers the conversation, so Escape backs out of it the way the back button does.
  useEffect(() => {
    if (!open || !onBack) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onBack(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onBack]);

  /**
   * Drag down to dismiss. It seeks the entrance backwards rather than writing its own styles, so a
   * half-dragged screen is the same pose as a half-played entrance: the blur, the scrim, the sheet
   * and the header morph all follow the finger together. Released short of the threshold, it plays
   * the rest of the entrance forward from where it is.
   */
  const drag = useRef<{ id: number; from: number; last: number; at: number; velocity: number; live: boolean } | null>(null);
  const playIn = () => {
    const list = timeline.current;
    if (!list) return;
    list.forEach(animation => animation.play());
    Promise.allSettled(list.map(animation => animation.finished)).then(() => land(list));
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!open || closing || progress !== undefined || !onBack || !landed.current || prefersReducedMotion()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    drag.current = { id: event.pointerId, from: event.clientY, last: event.clientY, at: event.timeStamp, velocity: 0, live: false };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    const dy = event.clientY - state.from;
    if (!state.live) {
      // A tap, or a drag back up, leaves the controls alone.
      if (dy < 8) return;
      state.live = true;
      event.currentTarget.setPointerCapture(state.id);
      const list = timeline.current ?? build("enter");
      if (list) { timeline.current = list; list.forEach(animation => { animation.pause(); try { animation.currentTime = iosDetailsMotion.enter; } catch { /* no timeline yet */ } }); }
    }
    const elapsed = event.timeStamp - state.at;
    if (elapsed > 0) state.velocity = (event.clientY - state.last) / elapsed;
    state.last = event.clientY;
    state.at = event.timeStamp;
    // The sheet rises by the frame's own height, so tracking the finger means seeking to wherever
    // the rise stands `1 - dy / height` of the way up.
    const height = root.current?.getBoundingClientRect().height || 1;
    const back = riseSeek(clamp01(1 - dy / height)) * iosDetailsMotion.sheet;
    timeline.current?.forEach(animation => { animation.pause(); try { animation.currentTime = back; } catch { /* no timeline yet */ } });
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    drag.current = null;
    if (!state.live) return;
    swallowClick(root.current);
    const dy = event.clientY - state.from;
    // Ask for the dismissal first: the exit builds from the pose this drag is holding. Then play the
    // entrance back in, which springs the screen home if the consumer does not take the dismissal.
    if (dy > iosDetailsMotion.dragCommit || state.velocity > iosDetailsMotion.dragVelocity) onBack?.();
    playIn();
  };

  return (
    <div ref={root} data-slot="ios-details" data-state={open ? "open" : "closing"}
      data-progress={progress === undefined ? undefined : clamp01(progress).toFixed(3)}
      role="dialog" aria-modal="true" aria-labelledby={titleId}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
      className={cn("relative isolate size-full select-none overflow-hidden", vars, className)}
      style={{ fontFamily: font, ...style }} {...props}>
      {backdrop !== undefined && (
        <div aria-hidden="true" data-slot="backdrop" className="absolute inset-0 -z-10 overflow-hidden">
          {/*
            Blurring a box larger than the screen keeps the filter's own edge falloff off-screen, and
            the same box takes the sheet's push-back: 60 of overhang is more than the 4% ever needs,
            so no edge of the conversation comes into view. The blur is divided by that scale, so
            what lands on screen is the measured σ18 either way.
          */}
          <div ref={blur} data-slot="details-blur" className="absolute"
            style={{ inset: -60, background: "var(--ios-dt-page)", scale: String(iosDetailsMotion.backdropScale), filter: `blur(${(iosDetailsMotion.blur / iosDetailsMotion.backdropScale).toFixed(3)}px) saturate(var(--ios-dt-saturate))` }}>
            <div className="absolute" style={{ inset: 60 }}>{backdrop}</div>
          </div>
          <div ref={scrim} data-slot="details-scrim" className="absolute inset-0" style={{ background: "var(--ios-dt-scrim)" }} />
        </div>
      )}

      {/* At rest the wrapper carries no transform: a transform node makes Chrome snap descendants to
          whole CSS px, and the entrance is cancelled the moment it lands for exactly that reason. */}
      <div ref={content} data-slot="details-content" className="absolute inset-0"
        style={closing ? { pointerEvents: "none" } : undefined}>
        <GlassCircle size={44} data-slot="back" aria-label="Back" onClick={onBack} style={{ left: 16, top: 62 }}>
          <svg aria-hidden="true" width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="var(--ios-dt-glyph)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M24.8 13.87 16.2 22.17 24.8 30.47" />
          </svg>
        </GlassCircle>

        <div aria-hidden="true" data-slot="avatar" className="absolute flex items-center justify-center overflow-hidden rounded-full text-white"
          style={{ left: 161, top: 62, width: 80, height: 80, fontSize: 37.5, lineHeight: 1, fontWeight: 650, background: "linear-gradient(var(--ios-dt-av-top), var(--ios-dt-av-bottom))" }}>
          {avatar ?? letters}
        </div>

        <h1 id={titleId} data-slot="name" className="absolute m-0 whitespace-nowrap text-center"
          style={{ left: 0, right: 0, top: 146.15, fontSize: 28, lineHeight: "33px", fontWeight: 700, letterSpacing: 0, color: "var(--ios-dt-label)" }}>
          {name}
        </h1>

        {actions.map((action, index) => (
          <GlassCircle key={action.id} size={54} data-slot="action" data-action={action.id} aria-label={action.label}
            aria-disabled={action.disabled || undefined} onClick={action.disabled ? undefined : action.onPress}
            style={{ ...subpixel(195.6667), left: 100 + index * 74, color: action.disabled ? "var(--ios-dt-glyph-off)" : "var(--ios-dt-glyph)", mixBlendMode: action.disabled ? "var(--ios-dt-glyph-blend)" as CSSProperties["mixBlendMode"] : undefined }}>
            <ActionGlyph icon={action.icon} />
          </GlassCircle>
        ))}

        {phone !== undefined && (
          <Cell top={269.6667} height={70.6667}>
            <span data-slot="phone-label" className="absolute" style={{ left: 16, top: 16.875, fontSize: 13, lineHeight: "16px", transform: "translateY(-0.6667px)", color: "var(--ios-dt-secondary)" }}>{phoneLabel}</span>
            <span data-slot="phone-value" className="absolute" style={{ left: 16, top: 34.375, fontSize: 17, lineHeight: "22px", color: "var(--ios-dt-label)" }}>{phone}</span>
            {tag && (
              <span data-slot="tag" className="absolute flex items-center justify-center"
                style={{ left: 312.3333, top: 19.3333, transform: "translateY(0.3333px)", width: 41, height: 11.3333, borderRadius: 3.5, background: "var(--ios-dt-tag)", color: "var(--ios-dt-tag-label)", fontSize: 8.5, lineHeight: 1, fontWeight: 700, letterSpacing: 0 }}>
                {tag}
              </span>
            )}
          </Cell>
        )}

        {links.length > 0 && (
          <Cell top={360.3333} height={links.length * 52}>
            {links.map((link, index) => (
              <div key={link.id} className="absolute" style={{ left: 0, right: 0, top: index * 52, height: 52 }}>
                {index > 0 && <span aria-hidden="true" data-slot="separator" className="absolute" style={{ left: 16, right: 16, top: -1.3333, transform: "translateY(0.3333px)", height: 1, background: "var(--ios-dt-separator)" }} />}
                <button type="button" data-slot="link" onClick={link.onPress}
                  className="absolute inset-0 flex items-center text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff]"
                  style={{ paddingLeft: 16, fontSize: 17, lineHeight: "22px", transform: "translateY(0.6667px)", color: "var(--ios-dt-blue)" }}>
                  {link.label}
                </button>
              </div>
            ))}
          </Cell>
        )}

        <Cell top={484.3333} height={52}>
          <div className="absolute inset-0 flex items-center justify-between" style={{ paddingLeft: 16, paddingRight: 14 }}>
            <span data-slot="hide-alerts-label" style={{ fontSize: 17, lineHeight: "22px", transform: "translateY(0.6667px)", color: "var(--ios-dt-label)" }}>{hideAlertsLabel}</span>
            <IosSwitch checked={hideAlerts} onChange={onHideAlertsChange} label={hideAlertsLabel} style={{ transform: "translateY(0.3333px)" }} />
          </div>
        </Cell>

        <Cell top={556.3333} height={52}>
          <button type="button" data-slot="block" onClick={onBlock}
            className="absolute inset-0 flex items-center text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff]"
            style={{ paddingLeft: 16, fontSize: 17, lineHeight: "22px", transform: "translateY(0.6667px)", color: "var(--ios-dt-red)" }}>
            {blockLabel}
          </button>
        </Cell>
      </div>
    </div>
  );
}
