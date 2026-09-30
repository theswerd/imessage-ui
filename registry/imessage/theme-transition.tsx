import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * **Switching appearance is a crossfade, it takes about half a second, and it is not symmetric.**
 *
 * Recorded off a real iPhone 17 Pro on iOS 26 by driving `xcrun simctl ui <udid> appearance dark`
 * (and back) with the Messages conversation list on screen, then reading a flat region out of every
 * frame — `references/simulator-cases.md` §2.6 has the recordings, and
 * `references/ios/motion/simulator-checkpoints.json` carries the samples as assertions.
 *
 * Two things the recording settles that a guess would get wrong:
 *
 * 1. **It is not instant.** This kit swapped the `.dark` class and had the new colour in the same
 *    frame. The device takes 492 ms into dark and 495 ms back.
 * 2. **The two directions are different curves.** Going dark is *decelerating* — 66% done at half
 *    time. Coming back to light is *accelerating* — 38.5% done at half time. One `transition:
 *    background-color 490ms ease` matches one direction and misses the other, which is exactly the
 *    trap this table exists to avoid. The asymmetry survives conversion to linear light, so it is not
 *    a colour-space artifact of the measurement.
 *
 * The ramps below are the recorded samples, as `[ms, progress]`, where progress is how far the
 * region's colour had travelled between its own first and last frame. Nothing is fitted: a curve
 * fitted to eleven samples would be a claim about the frames in between that the recording does not
 * make, so `themeCrossfadeProgress` interpolates linearly between the samples it has and says so.
 *
 * **Not measured, and visible in the same recording:** the list's search pill does *not* follow this
 * ramp. It leads it — 0.380 against the background's 0.275 at 104 ms, 0.625 against 0.545 at 199 ms,
 * converging by the end. A translucent material over a ground that is itself changing would do that,
 * and this kit's pill is a flat token rather than a live material, so it will follow the ground
 * exactly and be *behind* the device through the middle of the switch. That is a real difference and
 * it is left visible in the evaluation rather than papered over.
 */
export const iosThemeCrossfade = {
  toDark: {
    duration: 492,
    ramp: [
      [0, 0], [47, 0.115], [104, 0.275], [152, 0.42], [199, 0.545], [242, 0.66],
      [292, 0.78], [359, 0.9], [409, 0.965], [442, 0.99], [492, 1],
    ],
  },
  toLight: {
    duration: 495,
    ramp: [
      [0, 0], [55, 0.0423], [105, 0.108], [155, 0.1925], [193, 0.2676], [247, 0.385],
      [292, 0.5117], [343, 0.6479], [393, 0.8028], [445, 0.9718], [495, 1],
    ],
  },
} as const;

export type ThemeName = "light" | "dark";

/**
 * How far the crossfade has travelled at `ms`, straight off the recorded samples.
 *
 * Linear between samples on purpose. The recording gives eleven frames; anything smoother would be
 * inventing the frames it does not show, and the samples are close enough together (43–67 ms) that
 * the error from joining them with straight lines is well under the 4/255 the assertions allow.
 */
export function themeCrossfadeProgress(to: ThemeName, ms: number): number {
  const { ramp, duration } = to === "dark" ? iosThemeCrossfade.toDark : iosThemeCrossfade.toLight;
  if (ms <= 0) return 0;
  if (ms >= duration) return 1;
  for (let index = 1; index < ramp.length; index++) {
    const [beforeMs, beforeValue] = ramp[index - 1]!;
    const [afterMs, afterValue] = ramp[index]!;
    if (ms > afterMs) continue;
    const span = afterMs - beforeMs;
    return span <= 0 ? afterValue : beforeValue + ((ms - beforeMs) / span) * (afterValue - beforeValue);
  }
  return 1;
}

/**
 * The switch, as two stacked copies of the same UI with the destination fading in over the origin.
 *
 * It has to be layered rather than a palette interpolation, and the reason is structural: this kit
 * does not have one palette. `--im-*` carries the bubbles, but the conversation list has its own
 * `--ios-list-*`, the sidebar `--sb-*`, and eight more components define their own family, each
 * switched by the `.dark` class and none of them reachable from a single map. Interpolating `--im-*`
 * alone moved the bubbles and left the list exactly where it was — measured: 13.4 mean red at 0 ms,
 * 246 ms and 492 ms alike. Cross-fading the rendered result covers every family at once and cannot
 * fall out of step with a component that adds a new one.
 *
 * How each layer picks its appearance is worth spelling out, because the obvious way does not work.
 * The dark variant here is
 *
 *     &:where(.dark, .dark *):not(:where([data-preview-theme="light"], [data-preview-theme="light"] *))
 *
 * so `.dark` on an ancestor turns dark *on* and `data-preview-theme="light"` on an ancestor turns it
 * back *off* — and the second wins wherever it appears, from anywhere above. A layer therefore cannot
 * opt out of a wrapper that has already declared itself light, which is why simply adding `.dark` to
 * the arriving layer painted nothing: the harness wrapper was marked light and cancelled it. Each
 * layer states both, so it is self-contained and does not care what it is mounted inside.
 *
 * **What this does not reproduce, and the recording is clear about it:** native's elements do not all
 * travel together. The list's search pill runs *ahead* of the background — 0.380 against 0.275 at
 * 104 ms, 0.625 against 0.545 at 199 ms, converging by the end — which is what a translucent material
 * over a ground that is itself changing does. A cross-fade of two rendered copies moves every pixel
 * by the same fraction by construction, so the pill will lag the device through the middle of the
 * switch. That difference is left standing in the evaluation instead of being tuned away.
 */
export function ThemeCrossfade({ to, ms, enabled = true, children }: { to: ThemeName; ms: number; enabled?: boolean; children: ReactNode }) {
  // A scene that is not switching appearance renders one copy and no wrapper at all, so nothing here
  // costs anything — or changes the DOM — outside the two scenes that seek the switch.
  if (!enabled) return <>{children}</>;
  const progress = themeCrossfadeProgress(to, ms);
  const from: ThemeName = to === "dark" ? "light" : "dark";
  const layer = (appearance: ThemeName) => ({
    className: cn("absolute inset-0", appearance === "dark" && "dark"),
    "data-preview-theme": appearance,
  });
  return (
    <div data-slot="theme-crossfade" data-progress={progress.toFixed(4)} className="relative isolate size-full">
      <div aria-hidden={progress >= 1 ? "true" : undefined} {...layer(from)}>{children}</div>
      {/* The arriving appearance. At progress 0 it is fully transparent and costs only a repaint; at 1
          it is the only thing visible, which is the resting state the rest of the kit paints. */}
      <div aria-hidden={progress <= 0 ? "true" : undefined} {...layer(to)} style={{ opacity: progress }}>{children}</div>
    </div>
  );
}
