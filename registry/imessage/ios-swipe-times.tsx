"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * "Swipe left to reveal times", measured from `references/ios/captures/swipe-timestamps-light.png`
 * (402×874 @3x).
 *
 * - Every bubble shifts left by exactly 58 (the last one's body right edge goes 386 → 328).
 * - The per-message time is 11pt secondary (#8a8a8e light / #8d8d93 dark), right-aligned with its
 *   ink ending at x 385, and its ink is centred on the bubble body's centre (measured on all eight
 *   bubbles: 235.17 / 295.5 / 339.83 / 384.17 / 464 / 572.5 / 626.5 / 686.67).
 * - iOS formats the time with a narrow no-break space before AM/PM.
 *
 * The drag rubber-bands past full reveal and past zero, and releasing runs a ~300 ms spring
 * (ζ 0.9, ω 20 rad/s). `prefers-reduced-motion` snaps instead. Keyboard users get ArrowLeft /
 * ArrowRight (and Enter/Space to toggle) on the element the hook's `handlers` are spread onto.
 */

const font = "-apple-system, BlinkMacSystemFont, sans-serif";

/** Measured reveal geometry, in points. `timeInset` is from the screen's trailing edge. */
/** `baselineNudge` corrects Chrome's baseline, which sits two thirds of a point below native's. */
export const swipeTimesMetrics = { distance: 58, timeInset: 16, fontSize: 11, lineHeight: 13, letterSpacing: 0.1, baselineNudge: -0.6667 } as const;

export type SwipeToRevealOptions = {
  /** How far the bubbles travel at full reveal. */
  distance?: number;
  /** Controlled 0..1. When set, dragging is disabled and the value is used verbatim. */
  progress?: number;
  /** Fraction of `distance` past which a release settles open. */
  threshold?: number;
  onChange?: (open: boolean) => void;
};

export type SwipeToRevealTimes = {
  /** 0 = hidden, 1 = fully revealed. May exceed 1 slightly while rubber-banding. */
  progress: number;
  /** Signed px shift for the bubble column (negative moves left). */
  offset: number;
  open: boolean;
  setOpen: (next: boolean) => void;
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    tabIndex: number;
    role: string;
    "aria-label": string;
    style: { touchAction: "pan-y" };
  };
};

/** Rubber band: full travel inside [0, 1], a quarter of it outside. */
function band(raw: number) {
  if (raw < 0) return raw * 0.25;
  if (raw > 1) return 1 + (raw - 1) * 0.25;
  return raw;
}

export function useSwipeToRevealTimes({ distance = swipeTimesMetrics.distance, progress: controlled, threshold = 0.4, onChange }: SwipeToRevealOptions = {}): SwipeToRevealTimes {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  const drag = useRef<{ id: number; startX: number; base: number; lastX: number; time: number; velocity: number } | null>(null);
  const spring = useRef({ raf: 0, target: 0, velocity: 0, last: 0 });

  const write = useCallback((next: number) => { current.current = next; setValue(next); }, []);
  const stop = useCallback(() => { cancelAnimationFrame(spring.current.raf); spring.current.raf = 0; }, []);
  useEffect(() => stop, [stop]);

  const settle = useCallback((target: number, velocity: number) => {
    stop();
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) { write(target); return; }
    const s = spring.current;
    s.target = target; s.velocity = velocity; s.last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - s.last) / 1000);
      s.last = now;
      // ζ 0.9, ω 20 rad/s: about 300 ms to rest with no visible overshoot.
      s.velocity += (400 * (s.target - current.current) - 36 * s.velocity) * dt;
      const next = current.current + s.velocity * dt;
      if (Math.abs(s.target - next) < 0.0008 && Math.abs(s.velocity) < 0.01) { write(s.target); s.raf = 0; return; }
      write(next);
      s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  }, [stop, write]);

  const setOpen = useCallback((next: boolean) => { settle(next ? 1 : 0, 0); onChange?.(next); }, [settle, onChange]);

  const locked = controlled !== undefined;
  const progress = locked ? controlled : value;

  const handlers: SwipeToRevealTimes["handlers"] = {
    tabIndex: 0,
    role: "group",
    "aria-label": "Conversation. Swipe left, or press the left arrow key, to show message times.",
    style: { touchAction: "pan-y" },
    onPointerDown(event) {
      if (locked || event.button !== 0) return;
      stop();
      drag.current = { id: event.pointerId, startX: event.clientX, base: current.current, lastX: event.clientX, time: performance.now(), velocity: 0 };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove(event) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      const now = performance.now();
      const dt = Math.max(1, now - d.time);
      d.velocity = ((d.lastX - event.clientX) / distance / dt) * 1000;
      d.lastX = event.clientX; d.time = now;
      write(band(d.base + (d.startX - event.clientX) / distance));
    },
    onPointerUp(event) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      drag.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      const next = current.current + d.velocity * 0.12 > threshold;
      settle(next ? 1 : 0, d.velocity);
      onChange?.(next);
    },
    onPointerCancel(event) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      drag.current = null;
      settle(0, 0);
      onChange?.(false);
    },
    onKeyDown(event) {
      if (locked) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); setOpen(true); }
      else if (event.key === "ArrowRight" || event.key === "Escape") { event.preventDefault(); setOpen(false); }
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen(progress < 0.5); }
    },
  };

  return { progress, offset: -progress * distance, open: progress > 0.5, setOpen, handlers };
}

export type SwipeTimesProps = Omit<ComponentProps<"div">, "children"> & {
  /** Already formatted, e.g. "1:25 AM" with a narrow no-break space. */
  time: ReactNode;
  /** 0..1 from `useSwipeToRevealTimes`. */
  progress?: number;
  distance?: number;
  /** Ink inset from the container's trailing edge. */
  timeInset?: number;
  children: ReactNode;
};

/**
 * One message row of the reveal: shifts its message left and slides the time in from the trailing
 * edge, vertically centred on the bubble body. Clip the scrolling container: at rest the time column
 * sits one full `distance` off-screen.
 */
export function SwipeTimes({ time, progress = 0, distance = swipeTimesMetrics.distance, timeInset = swipeTimesMetrics.timeInset, className, style, children, ...props }: SwipeTimesProps) {
  const t = Math.max(0, progress);
  const row = useRef<HTMLDivElement>(null);
  // Native centres the time on the bubble *body*, not on the row: a reaction balloon or a status
  // line grows the row without moving the body, and the time stays put.
  useLayoutEffect(() => {
    const root = row.current;
    if (!root) return;
    const measure = () => {
      const body = root.querySelector<HTMLElement>('[data-slot="bubble"], [data-slot="emoji"]');
      const box = root.getBoundingClientRect();
      const centre = body ? body.getBoundingClientRect().top + body.getBoundingClientRect().height / 2 - box.top : box.height / 2;
      root.style.setProperty("--swipe-centre", `${centre.toFixed(2)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [children, time]);
  return (
    <div ref={row} data-slot="swipe-times" data-progress={t.toFixed(3)}
      className={cn("relative w-full [--ios-sw-secondary:#8a8a8e] dark:[--ios-sw-secondary:#8d8d93]", className)}
      style={{ fontFamily: font, ...style }} {...props}>
      <div data-slot="swipe-content" style={{ transform: `translateX(${(-t * distance).toFixed(2)}px)`, willChange: "transform" }}>{children}</div>
      <span data-slot="time" aria-hidden={t < 0.5 || undefined} className="pointer-events-none absolute whitespace-nowrap text-right"
        style={{
          // The column travels with the bubbles: it starts one full `distance` off the trailing edge.
          right: timeInset, top: "var(--swipe-centre, 50%)",
          transform: `translate(${((1 - Math.min(1, t)) * distance).toFixed(2)}px, calc(-50% + ${swipeTimesMetrics.baselineNudge}px))`,
          fontSize: swipeTimesMetrics.fontSize, lineHeight: `${swipeTimesMetrics.lineHeight}px`, letterSpacing: swipeTimesMetrics.letterSpacing,
          color: "var(--ios-sw-secondary)", opacity: Math.max(0, Math.min(1, t * 4)),
        }}>
        {time}
      </span>
    </div>
  );
}
