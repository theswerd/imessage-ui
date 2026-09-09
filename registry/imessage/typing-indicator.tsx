"use client";

import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { usePlatform, type Platform } from "@/registry/imessage/platform";
import { bodyClipPath, tailBox, tailPath, tailSeamOverlap } from "@/registry/imessage/bubble-shape";
import { bubbleMetrics, palettes } from "@/registry/imessage/tokens";

/**
 * The "someone is typing" balloon.
 *
 * NOT MEASURED. No capture in `references/` shows a typing indicator: every iOS and macOS still, both
 * 60 fps recordings and every motion contact sheet were checked on 2026-09-08 and none contains one.
 *
 * What is anchored to a capture is the balloon itself. It is an incoming bubble, so it takes the
 * measured incoming geometry rather than numbers of its own: the one-line body height
 * (2 x paddingY + lineHeight), the measured corner radius, the traced tail on the bottom-left, and
 * the incoming screen-space fill, all read from `bubbleMetrics` and `bubble-shape` so it can never
 * drift from a real bubble. The message list insets it by the same measured edge inset as a bubble.
 *
 * Only the dots are invented: diameter, spacing and the 1.2 s pulse are provisional, and the dot
 * colour reuses the platform's measured secondary-label gray because no capture shows the real one.
 * The pulse is a CSS animation with negative delays, so every dot is inside its active phase at every
 * time: pausing `document.getAnimations()` and setting `currentTime` pins the balloon to a frame, and
 * that frozen frame is the one the animation shows while running.
 */
export type TypingIndicatorMetrics = {
  /** Body box, both derived from the measured one-line incoming bubble. */
  width: number;
  height: number;
  /** Provisional: dot diameter and the gap between two dots. */
  dot: number;
  dotGap: number;
  /** Measured bubble radius and tail scale, carried through so the balloon matches a bubble exactly. */
  radius: number;
  tailScale: number;
};

/** The only free numbers in the balloon. Everything else falls out of the measured bubble. */
const dotSizes: Record<Platform, { dot: number; dotGap: number }> = {
  ios: { dot: 10, dotGap: 5 },
  macos: { dot: 7, dotGap: 3.5 },
};

function metricsFor(platform: Platform): TypingIndicatorMetrics {
  const b = bubbleMetrics[platform];
  const { dot, dotGap } = dotSizes[platform];
  return {
    width: 2 * b.paddingX + 3 * dot + 2 * dotGap,
    height: 2 * b.paddingY + b.lineHeight,
    dot,
    dotGap,
    radius: b.radius,
    tailScale: b.tailScale,
  };
}

export const typingIndicatorMetrics: Record<Platform, TypingIndicatorMetrics> = {
  ios: metricsFor("ios"),
  macos: metricsFor("macos"),
};

/** Dot loop and the stagger between two dots. Provisional; no capture times the pulse. */
export const typingLoopMs = 1200;
export const typingStaggerMs = 200;

/**
 * The delays are negative so a dot is never in its "before" phase: at time 0 dot 1 is already
 * `typingStaggerMs` into the loop instead of sitting on its unanimated base style, which is what made
 * a frozen frame at t = 0 disagree with the running animation.
 */
const dotDelayMs = (index: number) => index * typingStaggerMs - typingLoopMs;

const keyframes = `
@keyframes im-typing-dot { 0%, 60%, 100% { opacity: .35; transform: translateY(0) scale(1); } 30% { opacity: 1; transform: translateY(-1px) scale(1.06); } }
[data-slot="typing-indicator"] > span[data-dot] { animation: im-typing-dot ${typingLoopMs}ms ease-in-out infinite both; }
@media (prefers-reduced-motion: reduce) { [data-slot="typing-indicator"] > span[data-dot] { animation: none; opacity: .7; } }
`;

export type TypingIndicatorProps = ComponentProps<"div"> & {
  label?: string;
  /** The balloon is always the last thing in the transcript, so it carries a tail like any last bubble. */
  tail?: boolean;
  /**
   * Screen-space y of the body's bottom edge, in px, for the position-dependent incoming fill. The
   * message list tracks this element too, so it is only needed outside a list: pass it to keep a macOS
   * dark balloon exactly on the incoming ramp; the iOS grays are flat and never need it.
   */
  screenBottom?: number;
  platform?: Platform;
};

export function TypingIndicator({
  label = "Someone is typing", tail = true, screenBottom, platform: platformProp, className, style, ...props
}: TypingIndicatorProps) {
  const contextPlatform = usePlatform();
  const platform = platformProp ?? contextPlatform;
  const t = typingIndicatorMetrics[platform];
  const tailW = tailBox.width * t.tailScale;
  const tailH = tailBox.height * t.tailScale;
  const hang = tailBox.hang * t.tailScale;

  // Same screen-space fill an incoming bubble paints: one gradient in screen coordinates, anchored to
  // the body's bottom so the body and the tail (which hangs `hang` lower) share the same image. The
  // fallbacks only matter when the balloon is used outside a palette; inside one they never apply.
  const screen = `var(--im-screen-h, ${palettes[platform].light.incoming.screenHeight}px)`;
  const bottomVar = screenBottom === undefined ? `var(--bubble-bottom, calc(${screen} * 0.55))` : `${screenBottom}px`;
  const fill: CSSProperties = {
    backgroundImage: "linear-gradient(var(--im-fill-top), var(--im-fill-bottom))",
    backgroundSize: `100% ${screen}`,
    backgroundRepeat: "no-repeat",
    backgroundColor: "var(--im-fill-bottom)",
  };
  const bodyFill: CSSProperties = { ...fill, backgroundPosition: `0 calc(100% + (${screen} - ${bottomVar}))` };
  const tailFill: CSSProperties = { ...fill, backgroundPosition: `0 calc(100% + (${screen} - ${bottomVar} - ${hang}px))` };
  const vars = {
    "--im-fill-top": "var(--im-gray-top, #e9e9eb)",
    "--im-fill-bottom": "var(--im-gray-bottom, #e9e9eb)",
    ...(screenBottom === undefined ? {} : { "--bubble-bottom": `${screenBottom}px` }),
  } as CSSProperties;

  return (
    <div role="status" aria-label={label} data-slot="typing-indicator" data-platform={platform}
      className={cn("relative flex shrink-0 items-center justify-center", className)}
      style={{ width: t.width, height: t.height, gap: t.dotGap, ...vars, ...style }} {...props}>
      <style>{keyframes}</style>
      {/* The fill sits behind the dots so clipping the tail corner never clips a dot. */}
      <div aria-hidden="true" data-slot="fill" className="pointer-events-none absolute inset-0"
        style={{ borderRadius: t.radius, clipPath: tail ? bodyClipPath("left", t.tailScale, tailSeamOverlap[platform]) : undefined, ...bodyFill }} />
      {tail && <div aria-hidden="true" data-slot="tail" className="pointer-events-none absolute" style={{
        left: 0, bottom: -hang, width: tailW, height: tailH + hang, clipPath: `path("${tailPath("left", t.tailScale)}")`, ...tailFill,
      }} />}
      {[0, 1, 2].map(index => (
        <span key={index} aria-hidden="true" data-dot={index} className="relative block rounded-full"
          style={{ width: t.dot, height: t.dot, background: "var(--im-secondary, #8a8a8e)", animationDelay: `${dotDelayMs(index)}ms` }} />
      ))}
    </div>
  );
}
