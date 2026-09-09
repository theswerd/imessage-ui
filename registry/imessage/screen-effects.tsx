"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { ScreenEffectKind } from "@/registry/imessage/message-effects";

/**
 * Full-screen send effects, drawn on a canvas that covers the device frame.
 *
 * NOT MEASURED. No native recording of a screen effect exists in `references/`, so the particle
 * counts, colours and timings follow the well-known look rather than a capture. Re-derive them from a
 * recording before claiming fidelity.
 *
 * Every effect is a pure function of `t` (0..1) and the anchor rect: no wall clock, no `Math.random`,
 * no state carried between frames. The same `t` therefore paints the same pixels on every run and in
 * every engine, which is what makes the harness scrubbable and its screenshots stable.
 */
export const screenEffectDuration: Record<ScreenEffectKind, number> = {
  echo: 2400, spotlight: 2600, balloons: 4200, confetti: 4200, love: 2600,
  lasers: 3000, fireworks: 3600, celebration: 3600,
};

/**
 * The one frame each effect holds under `prefers-reduced-motion`: its fullest, calmest pose. The
 * canvas is painted once and never repainted, so nothing on screen moves.
 */
const stillFrame: Record<ScreenEffectKind, number> = {
  echo: 0.5, spotlight: 0.5, balloons: 0.62, confetti: 0.5, love: 0.55,
  lasers: 0.5, fireworks: 0.45, celebration: 0.5,
};

export type Anchor = { x: number; y: number; width: number; height: number };

type Frame = { context: CanvasRenderingContext2D; width: number; height: number; t: number; anchor: Anchor };

const TAU = Math.PI * 2;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** 0 → 1 → 0, rising over the first `rise` of the effect and falling over the last `fall`. */
function envelope(t: number, rise: number, fall: number): number {
  return Math.min(1, clamp01(t) / rise) * Math.min(1, (1 - clamp01(t)) / fall);
}

function easeOut(value: number): number {
  const v = 1 - clamp01(value);
  return 1 - v * v * v;
}

/**
 * Deterministic value in [0,1) from an index and a channel. Integer operations only, so every engine
 * returns the same bits. The previous `fract(sin(seed) * 43758.5453)` did not: `Math.sin` is only
 * implementation-approximated, and measured across 600 seeds Chromium and WebKit disagreed on 15 of
 * them (worst delta 7.3e-12), which is enough to flip a `> 0.5` branch. `channel` keeps each stream
 * independent; the old code reused one seed with different offsets, so streams overlapped (fireworks'
 * angle jitter equalled its own spark reach on the first burst, which visibly clumped it).
 */
function hash(index: number, channel: number): number {
  let h = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(channel + 0x27d4eb2f, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** `roundRect` is recent in WebKit; `arcTo` draws the same path everywhere. */
function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

/** Effects that happen against a night sky: the screen dims under them, as it does natively. */
const dims: Partial<Record<ScreenEffectKind, number>> = { fireworks: 0.82, lasers: 0.78 };

function drawBackdrop(kind: ScreenEffectKind, { context, width, height, t }: Frame) {
  const peak = dims[kind];
  if (!peak) return;
  // Holds until the last particle is gone, then lifts, rather than fading out from 83% while
  // fireworks are still bursting.
  const fade = envelope(t, 1 / 6, 0.08);
  context.fillStyle = `rgba(4,6,18,${(peak * fade).toFixed(3)})`;
  context.fillRect(0, 0, width, height);
}

const confettiColors = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#0088ff", "#af52de", "#ff2d55"];
const balloonColors = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#0088ff", "#af52de"];
const laserColors: ReadonlyArray<readonly [number, number, number]> = [
  [255, 45, 85], [255, 149, 0], [255, 214, 10], [52, 199, 89], [0, 199, 255], [0, 136, 255], [175, 82, 222],
];

/** `hsl()` rounds to bytes differently between engines; laser beams mix their own rgba instead. */
function rgba(color: readonly [number, number, number], alpha: number): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha.toFixed(3)})`;
}

function drawConfetti({ context, width, height, t }: Frame) {
  const count = 160;
  for (let i = 0; i < count; i++) {
    const local = t - hash(i, 1) * 0.35;
    if (local <= 0) continue;
    const x = hash(i, 2) * width + Math.sin((local * 3 + i) * 1.6) * 22;
    const y = -30 + local * (height + 160) * (0.75 + hash(i, 3) * 0.55);
    if (y > height + 30) continue;
    const size = 5 + hash(i, 4) * 5;
    context.save();
    context.translate(x, y);
    context.rotate((local * 6 + hash(i, 5) * 6) * (hash(i, 6) < 0.5 ? -1 : 1));
    context.globalAlpha = clamp01((1 - local) * 3);
    context.fillStyle = confettiColors[i % confettiColors.length];
    context.fillRect(-size / 2, -size / 4, size, size / 2);
    context.restore();
  }
}

function drawBalloons({ context, width, height, t }: Frame) {
  const count = 22;
  for (let i = 0; i < count; i++) {
    const local = t - hash(i, 11) * 0.3;
    if (local <= 0) continue;
    const x = 20 + hash(i, 12) * (width - 40) + Math.sin((local * 2 + i) * 1.2) * 14;
    const y = height + 80 - local * (height + 220) * (0.8 + hash(i, 13) * 0.5);
    if (y < -120) continue;
    const w = 26 + hash(i, 14) * 16;
    const h = w * 1.22;
    context.save();
    context.globalAlpha = Math.min(1, local * 6) * Math.min(1, (1 - local) * 4);
    context.fillStyle = balloonColors[i % balloonColors.length];
    context.beginPath();
    context.ellipse(x, y, w / 2, h / 2, 0, 0, TAU);
    context.fill();
    context.globalAlpha *= 0.22;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.ellipse(x - w * 0.17, y - h * 0.2, w * 0.16, h * 0.2, -0.4, 0, TAU);
    context.fill();
    context.restore();
    context.save();
    context.globalAlpha = Math.min(1, local * 6) * Math.min(1, (1 - local) * 4);
    context.beginPath();
    context.moveTo(x, y + h / 2);
    context.quadraticCurveTo(x + 5, y + h / 2 + 22, x, y + h / 2 + 44);
    context.strokeStyle = "rgba(0,0,0,0.25)";
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }
}

function heartPath(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 32;
  context.beginPath();
  context.moveTo(x, y + 10 * s);
  context.bezierCurveTo(x - 18 * s, y - 6 * s, x - 8 * s, y - 22 * s, x, y - 10 * s);
  context.bezierCurveTo(x + 8 * s, y - 22 * s, x + 18 * s, y - 6 * s, x, y + 10 * s);
  context.closePath();
}

function drawLove({ context, width, height, t, anchor }: Frame) {
  const originX = anchor.x + anchor.width / 2;
  const originY = anchor.y + anchor.height / 2;
  const size = 26 + easeOut(t / 0.42) * 210;
  // The heart grows out of the bubble and lifts, but it settles at a point that keeps it framed: the
  // old rise carried it off the top of the screen well before the effect ended.
  const lift = easeOut((t - 0.28) / 0.46);
  const centerX = originX + (width / 2 - originX) * lift;
  const centerY = originY + (Math.max(size * 0.55, height * 0.34) - originY) * lift;
  const out = clamp01((t - 0.78) / 0.22);
  // Continuous: the old beat switched off at t = 0.5 mid-swing and popped.
  const beat = 1 + Math.sin(t * 26) * 0.035 * (1 - clamp01(t / 0.7));
  const scale = beat * (1 + out * 0.18);
  context.save();
  context.globalAlpha = 1 - out;
  context.translate(centerX, centerY);
  context.scale(scale, scale);
  heartPath(context, 0, 0, size);
  context.fillStyle = "#ff2d55";
  context.fill();
  context.restore();
}

function drawFireworks({ context, width, height, t }: Frame) {
  const bursts = 8;
  for (let b = 0; b < bursts; b++) {
    // The last burst now closes at t = 0.999, so the sky is busy until the dim lifts and empty after.
    const local = (t - b * 0.0885) / 0.38;
    if (local <= 0 || local >= 1) continue;
    // Stratified by the golden ratio, then jittered: six raw hashes clumped in the upper left.
    const cx = width * (0.15 + (((b * 0.618034 + 0.18) % 1) * 0.7 + (hash(b, 21) - 0.5) * 0.05));
    const cy = height * (0.12 + (((b * 0.381966 + 0.4) % 1) * 0.44 + (hash(b, 22) - 0.5) * 0.05));
    const color = confettiColors[b % confettiColors.length];
    if (local < 0.2) {
      // The shell, before the sparks separate. White read as a gray smudge over the dim, so it burns
      // in the burst's own colour.
      const flash = 1 - local / 0.2;
      const glow = context.createRadialGradient(cx, cy, 0, cx, cy, 26 * (0.4 + local * 3));
      glow.addColorStop(0, `rgba(255,255,255,${(0.7 * flash).toFixed(3)})`);
      glow.addColorStop(0.45, `${color}${Math.round(0.55 * flash * 255).toString(16).padStart(2, "0")}`);
      glow.addColorStop(1, `${color}00`);
      context.globalAlpha = 1;
      context.fillStyle = glow;
      context.fillRect(cx - 90, cy - 90, 180, 180);
    }
    const sparks = 40;
    for (let i = 0; i < sparks; i++) {
      const seed = b * 128 + i;
      const angle = (i / sparks) * TAU + hash(seed, 23) * 0.14;
      const reach = (70 + hash(seed, 24) * 92) * easeOut(local);
      const x = cx + Math.cos(angle) * reach;
      const y = cy + Math.sin(angle) * reach + local * local * 48;
      context.globalAlpha = Math.pow(1 - local, 0.7);
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, 2.7, 0, TAU);
      context.fill();
    }
  }
  context.globalAlpha = 1;
}

function drawCelebration({ context, width, height, t }: Frame) {
  const streams = 3;
  for (let s = 0; s < streams; s++) {
    const originX = width * (0.22 + s * 0.28);
    for (let i = 0; i < 64; i++) {
      const seed = s * 128 + i;
      const local = t - (s * 0.07 + hash(seed, 31) * 0.34);
      if (local <= 0) continue;
      // Split into horizontal and vertical speed: the old single speed with a shallow gravity term
      // peaked around 200 px, so every stream stayed inside the bottom quarter of the screen.
      const vx = (hash(seed, 32) - 0.5) * 420;
      const vy = 1750 + hash(seed, 33) * 1250;
      const x = originX + vx * local;
      const y = height + 12 - vy * local + 2600 * local * local;
      if (y > height + 40 || y < -40 || x < -40 || x > width + 40) continue;
      context.globalAlpha = clamp01((1 - local) * 2.4);
      context.fillStyle = i % 3 === 0 ? "#ffd60a" : confettiColors[i % confettiColors.length];
      context.beginPath();
      context.arc(x, y, 2.1 + hash(seed, 34) * 1.4, 0, TAU);
      context.fill();
    }
  }
  context.globalAlpha = 1;
}

function drawLasers({ context, width, height, t, anchor }: Frame) {
  // Anchored: the beams leave the message and sweep out to the edges of the screen.
  const cx = anchor.x + anchor.width / 2;
  const cy = anchor.y + anchor.height / 2;
  const reach = Math.hypot(width, height);
  const beams = 12;
  const fade = envelope(t, 0.12, 0.14);
  if (fade <= 0) return;
  context.save();
  context.globalCompositeOperation = "lighter";
  // Beams leave the edge of the bubble rather than its centre, so the message stays readable.
  const inset = Math.max(anchor.width, anchor.height) * 0.42;
  for (let i = 0; i < beams; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const lane = Math.floor(i / 2) / (beams / 2 - 1) - 0.5;
    const angle = lane * 0.92 + Math.sin((t * 1.7 + i / beams) * TAU) * 0.34 * side;
    const dirX = Math.cos(angle) * side;
    const dirY = Math.sin(angle) * side;
    const startX = cx + dirX * inset;
    const startY = cy + dirY * inset;
    const endX = cx + dirX * reach;
    const endY = cy + dirY * reach;
    const color = laserColors[i % laserColors.length];
    const gradient = context.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, rgba(color, 0.9 * fade));
    gradient.addColorStop(0.55, rgba(color, 0.5 * fade));
    gradient.addColorStop(1, rgba(color, 0));
    context.strokeStyle = gradient;
    context.lineCap = "round";
    context.lineWidth = 9;
    context.globalAlpha = 0.3;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.lineWidth = 2.2;
    context.globalAlpha = 1;
    context.stroke();
  }
  const halo = context.createRadialGradient(cx, cy, inset * 0.5, cx, cy, inset + 70);
  halo.addColorStop(0, `rgba(255,255,255,${(0.16 * fade).toFixed(3)})`);
  halo.addColorStop(1, "rgba(255,255,255,0)");
  context.globalAlpha = 1;
  context.fillStyle = halo;
  context.fillRect(cx - inset - 80, cy - inset - 80, (inset + 80) * 2, (inset + 80) * 2);
  context.restore();
}

function drawSpotlight({ context, width, height, t, anchor }: Frame) {
  const fade = envelope(t, 0.25, 0.25);
  if (fade <= 0) return;
  const cx = anchor.x + anchor.width / 2;
  const cy = anchor.y + anchor.height / 2;
  // The beam opens wide and closes onto the bubble.
  const radius = (Math.max(anchor.width, anchor.height) * 0.75 + 90) * (1.45 - 0.45 * easeOut(t / 0.45));
  context.save();
  context.fillStyle = `rgba(0,0,0,${(0.72 * fade).toFixed(3)})`;
  context.fillRect(0, 0, width, height);
  // Punched at full alpha. Sharing the dim's alpha here left the middle of the beam 20% black, so the
  // message under the spotlight came out darker than the rest of the conversation.
  context.globalCompositeOperation = "destination-out";
  const beam = context.createRadialGradient(cx, cy, radius * 0.34, cx, cy, radius);
  beam.addColorStop(0, "rgba(0,0,0,1)");
  beam.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = beam;
  context.beginPath();
  context.arc(cx, cy, radius, 0, TAU);
  context.fill();
  context.restore();
}

function drawEcho({ context, width, height, t, anchor }: Frame) {
  const copies = 18;
  const spread = Math.hypot(width, height) * 0.46;
  const w = anchor.width;
  const h = anchor.height;
  const radius = Math.min(19, h / 2);
  for (let i = 0; i < copies; i++) {
    const local = (t - i * 0.021) / 0.62;
    if (local <= 0 || local >= 1) continue;
    // Golden angle: random angles clumped the copies on one side of the bubble.
    const angle = i * 2.39996 + hash(i, 51) * 0.6;
    const drift = easeOut(local) * spread * (0.5 + hash(i, 52) * 0.7);
    // Each copy keeps its own size and grows a little, so they still read as bubbles; scaling to 2.4x
    // turned the late ones into bars wider than the screen.
    const scale = (0.6 + hash(i, 54) * 0.5) * (0.85 + local * 0.75);
    context.save();
    context.globalAlpha = Math.min(1, local * 6) * (1 - local) * 0.6;
    context.translate(anchor.x + w / 2 + Math.cos(angle) * drift, anchor.y + h / 2 + Math.sin(angle) * drift);
    context.rotate((hash(i, 53) - 0.5) * 0.3);
    context.scale(scale, scale);
    context.fillStyle = "#0088ff";
    roundedRect(context, -w / 2, -h / 2, w, h, radius);
    context.fill();
    context.restore();
  }
}

const painters: Record<ScreenEffectKind, (frame: Frame) => void> = {
  confetti: drawConfetti, balloons: drawBalloons, love: drawLove, fireworks: drawFireworks,
  celebration: drawCelebration, lasers: drawLasers,
  spotlight: drawSpotlight, echo: drawEcho,
};

export type ScreenEffectProps = {
  kind: ScreenEffectKind;
  /** Scrub position 0..1. Omit to play once. */
  progress?: number;
  /** Bump to replay. */
  replay?: number;
  /**
   * The bubble the effect radiates from, in frame coordinates. Echo, spotlight, lasers and love use
   * it. Without one the bubble named by `anchorMessageId` is measured, then the last outgoing bubble
   * in the frame, then a point above the composer.
   */
  anchor?: Anchor;
  /** The message the effect was sent with, when the host would rather name it than measure it. */
  anchorMessageId?: string;
  onDone?: () => void;
  className?: string;
  style?: CSSProperties;
};

/** Absolutely positioned canvas; put it inside the device frame with `inset-0`. */
export function ScreenEffect({ kind, progress, replay, anchor, anchorMessageId, onDone, className, style }: ScreenEffectProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  const anchorRef = useRef(anchor);
  // The clock lives outside the effect so a re-render (a new `anchor` object, a parent state change)
  // re-syncs the canvas without restarting the animation from zero.
  const startedAt = useRef(0);
  const finished = useRef(false);

  // Declared first, so both are current before the painting effect below re-runs.
  useEffect(() => { done.current = onDone; anchorRef.current = anchor; });
  useEffect(() => { startedAt.current = 0; finished.current = false; }, [kind, replay]);

  const anchorKey = anchor ? `${anchor.x},${anchor.y},${anchor.width},${anchor.height}` : "";
  useEffect(() => {
    const element = canvas.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const context = element.getContext("2d");
    if (!context) return;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    let raf = 0;
    let width = 0, height = 0;
    let fallback: Anchor = { x: 0, y: 0, width: 120, height: 40 };

    /** Where the effect radiates from when the host passes no anchor. */
    const measureAnchor = (frameRect: DOMRect): Anchor => {
      const named = anchorMessageId
        ? parent.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(anchorMessageId)}"] [data-slot="bubble"]`)
        : null;
      const outgoing = parent.querySelectorAll<HTMLElement>('[data-slot="message-bubble"][data-direction="outgoing"] [data-slot="bubble"]');
      const rect = (named ?? outgoing[outgoing.length - 1])?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        return { x: rect.left - frameRect.left, y: rect.top - frameRect.top, width: rect.width, height: rect.height };
      }
      return { x: width * 0.5 - 60, y: height * 0.62, width: 120, height: 40 };
    };

    const size = () => {
      // The frame, not the canvas: a canvas is a replaced element, so `inset-0` alone leaves it at its
      // intrinsic size. The explicit CSS size below is what stretches it over the frame.
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const backingWidth = Math.round(width * dpr);
      const backingHeight = Math.round(height * dpr);
      // Assigning `width` resets the bitmap even when the value is unchanged, which would blank the
      // canvas for a frame every time this effect re-runs.
      if (element.width !== backingWidth || element.height !== backingHeight) {
        element.width = backingWidth;
        element.height = backingHeight;
      }
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      fallback = measureAnchor(rect);
    };

    const paint = (value: number) => {
      context.clearRect(0, 0, width, height);
      const frame: Frame = { context, width, height, t: clamp01(value), anchor: anchorRef.current ?? fallback };
      context.save();
      drawBackdrop(kind, frame);
      painters[kind](frame);
      context.restore();
    };

    size();
    // Scrubbed by the harness: one frame, no clock, no callback.
    if (progress !== undefined) { paint(progress); return; }

    const duration = screenEffectDuration[kind];
    if (reduced) {
      // Static and calm: one representative frame, held. A single timer still retires the effect so
      // the host clears the overlay, and it is cleared on unmount.
      paint(stillFrame[kind]);
      if (finished.current) return;
      if (!startedAt.current) startedAt.current = performance.now();
      const remaining = Math.max(0, duration - (performance.now() - startedAt.current));
      const timer = window.setTimeout(() => { finished.current = true; done.current?.(); }, remaining);
      return () => window.clearTimeout(timer);
    }
    if (finished.current) { paint(1); return; }

    const step = (now: number) => {
      if (!startedAt.current) startedAt.current = now;
      const t = (now - startedAt.current) / duration;
      paint(t);
      if (t < 1) { raf = requestAnimationFrame(step); return; }
      finished.current = true;
      done.current?.();
    };
    // Repaint the frame the clock is already on, so a re-run never shows an empty canvas.
    if (startedAt.current) paint((performance.now() - startedAt.current) / duration);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [kind, progress, replay, anchorKey, anchorMessageId]);

  return <canvas ref={canvas} aria-hidden="true" data-slot="screen-effect" data-effect={kind} className={cn("pointer-events-none absolute inset-0", className)} style={style} />;
}
