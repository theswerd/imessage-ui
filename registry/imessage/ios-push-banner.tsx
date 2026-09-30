"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fontStack } from "@/registry/imessage/tokens";

/**
 * The iOS 26 notification banner — the thing that arrives when a message comes in while you are
 * somewhere else.
 *
 * ## What is measured, and it is one thing: the box over time
 *
 * `references/ios/motion/simulator-checkpoints.json` holds three recordings of a real iPhone 17 Pro
 * on iOS 26 (`xcrun simctl push $UDID com.apple.MobileSMS …`), one per banner shape, and every
 * assertion in them is a **box**: `[x, y, width, height]` in DEVICE pixels on the 1206 × 2622 screen,
 * at a stated millisecond, with t = 0 the first frame whose change from rest passes the recording's
 * own `zeroThreshold` of 0.02. Those numbers are transcribed verbatim into `iosPushBannerFrames`
 * below — device pixels, not points, so the table and the recording can be diffed by eye — and
 * `tests/unit/push-banner.test.ts` reads the JSON and asserts the two are identical.
 *
 * Three things the boxes say, none of which a hand-written ease would have produced:
 *
 * 1. **The banner does not slide down. It expands out of the Dynamic Island.** The short banner's
 *    first frame is 622 × 204 device px at x = 300 — a stub near the top centre — and it grows
 *    outward in both directions to the full 1206 by 183 ms. A `translateY(-100%)` entrance, which is
 *    what every web notification component does, is the wrong animation for this surface.
 * 2. **Width and height do not run together.** The short banner is at 80% of its final height by
 *    85 ms (525 of 528 px) while it is still 73 px short of full width, and it then spends 100 ms
 *    finishing the width with the height essentially done. One duration and one curve cannot say
 *    that, which is why this is a table.
 * 3. **It clamps.** Settled heights are 528 / 569 / 543 device px = 176 / 189.67 / 181 pt for the
 *    one-line, the long-body and the group banner. A three-or-more-line body buys **41 device px,
 *    13.67 pt** over the short banner and a group subtitle **15 px, 5 pt** — not a line's worth each.
 *    (The recording's own note rounds the first to 14 pt; the pixels say 41, so 13.67 is what this
 *    file carries.) So the height here is never computed from the content: it is the recorded height
 *    for that shape, and the content is clipped by it. A banner that grew per line would be a
 *    different component from this one.
 *
 * The recording also times the hold: the short banner's first *retraction* frame is at **7132 ms**,
 * so it stays up for 7.1 s, not the 5 s that is usually quoted.
 *
 * ## What is NOT measured, and must not be read as if it were
 *
 * - **Everything inside the box.** The recordings are frame diffs; they bound the banner's region and
 *   say nothing about what is drawn in it. The icon, the type sizes, the insets and the fill in
 *   `iosPushBannerLayout` / `bannerVars` are judgement, marked as such on each field. **The copy is
 *   not measured either** — what the pushed payloads said was not recorded, so the defaults here are
 *   deliberately plain. The geometry is the claim; the text is a placeholder for it.
 * - **The corner radius.** Nothing in a bounding box carries one.
 * - **Where the retraction ends.** 7132 ms is the first frame of it and the last frame recorded.
 * - **The x = 0 / y = 0 edges.** The recorded box reaches the screen's top and, once settled, both
 *   its sides. This component's own layout box *is* that box, so it draws no shadow: a shadow would
 *   put ink outside the region the recording bounds, and there is nothing in the recording that
 *   separates a card from its shadow.
 * - **The t = 0 width, against the island this kit already draws.** The recording's note calls
 *   622 px "the Dynamic Island's width, 207 pt", but `ios-status-bar.tsx` measures the island itself
 *   at 125.33 pt from the still captures. The two disagree by 82 pt and this file does not reconcile
 *   them: it reproduces the box that was recorded and flags the discrepancy.
 * - **Whether the box is the card.** A box is a *region* bound, and 176 pt is a lot of room for one
 *   line of body — the component fills the top of it and leaves the rest empty, because the height
 *   is the recording's and the content is not. It is entirely possible the region the recording
 *   bounds is larger than the card iOS paints in it. Nothing here can tell: a bounding box has no
 *   inside. A still capture of a banner would settle it in one measurement, and `references/` holds
 *   none — that is the next thing to shoot, and until it exists the interior stays marked as
 *   judgement rather than quietly hardening into a claim.
 */

export type PushBannerKind = "short" | "long" | "group";

export type PushBannerFrame = {
  /** Milliseconds from the recording's t = 0. */
  at: number;
  /** `[x, y, width, height]` in DEVICE pixels on the 1206 × 2622 screen, as recorded. */
  px: readonly [number, number, number, number];
  /** A frame of the recording, or a keyframe this file adds. Only one of the latter exists. */
  measured: boolean;
  note?: string;
};

/** Device pixels per point on the recorded device (iPhone 17 Pro, 1206 × 2622 over 402 × 874). */
export const pushBannerScale = 3;

/**
 * The recorded frames, verbatim. Each row is one `box` assertion of the matching case in
 * `references/ios/motion/simulator-checkpoints.json`, in the order the recording lists them.
 */
export const iosPushBannerFrames: Record<PushBannerKind, readonly PushBannerFrame[]> = {
  /**
   * One line of body. `push-banner-short`, duration 200 ms, settled 176 pt.
   */
  short: [
    { at: 0, px: [300, 0, 622, 204], measured: true, note: "the recording calls this the Dynamic Island's own width, 207 pt" },
    { at: 17, px: [258, 0, 710, 320], measured: true },
    { at: 33, px: [221, 0, 767, 327], measured: true },
    { at: 55, px: [180, 0, 904, 330], measured: true },
    { at: 68, px: [154, 0, 933, 371], measured: true },
    { at: 85, px: [59, 0, 1133, 525], measured: true, note: "80% of the final height already, and 73 px short of full width" },
    { at: 102, px: [32, 0, 1160, 525], measured: true },
    { at: 133, px: [23, 0, 1167, 521], measured: true },
    { at: 150, px: [0, 0, 1199, 521], measured: true },
    { at: 183, px: [0, 0, 1206, 521], measured: true, note: "full width" },
    { at: 200, px: [0, 0, 1206, 528], measured: true, note: "settled, 176 pt tall" },
    /**
     * The only row in this file that is not a recorded frame. The recording says 7132 ms is the
     * *first* retraction frame, which at 60 fps puts the last settled frame one frame earlier and
     * bounds the start of the retraction to the 16.67 ms between the two. Without this row the
     * interpolation below would drift the banner across the whole 7 s hold instead of holding it.
     */
    { at: 7132 - 1000 / 60, px: [0, 0, 1206, 528], measured: false, note: "not a recorded frame: the frame before the first retraction frame, which is what bounds the hold" },
    { at: 7132, px: [12, 0, 1117, 521], measured: true, note: "first retraction frame — it holds for 7.1 s, not 5" },
  ],
  /**
   * A three-or-more-line body. `push-banner-long`, duration 200 ms, settled 189.67 pt.
   *
   * Its early frames are not monotonic: the recorded width goes 1125 → 1084 → 1076 before it opens
   * to 1189. That is reproduced rather than smoothed. The recording's `zeroThreshold` is a change
   * threshold, not a start-of-animation detector, and on this payload it first fired with the banner
   * already most of the way out — so t = 0 here is a late frame, and the case has only six assertions
   * where the short one has twelve.
   */
  long: [
    { at: 0, px: [59, 0, 1125, 525], measured: true },
    { at: 50, px: [100, 0, 1084, 521], measured: true },
    { at: 116, px: [59, 0, 1076, 521], measured: true },
    { at: 150, px: [10, 0, 1189, 528], measured: true },
    { at: 183, px: [0, 0, 1205, 568], measured: true },
    { at: 200, px: [0, 0, 1206, 569], measured: true, note: "settled, 189.67 pt — 41 px over the short banner, not three lines' worth" },
  ],
  /**
   * A group message, which carries a subtitle. `push-banner-group`, duration 215 ms, settled 181 pt:
   * 15 ms slower to full width than the one-line banner, and 5 pt taller.
   */
  group: [
    { at: 0, px: [356, 0, 599, 316], measured: true },
    { at: 15, px: [323, 0, 632, 319], measured: true },
    { at: 31, px: [228, 0, 744, 320], measured: true },
    { at: 66, px: [201, 0, 798, 328], measured: true },
    { at: 100, px: [146, 0, 942, 414], measured: true },
    { at: 133, px: [96, 0, 1046, 452], measured: true },
    { at: 165, px: [56, 0, 1128, 506], measured: true },
    { at: 198, px: [6, 0, 1199, 543], measured: true },
    { at: 215, px: [0, 0, 1206, 543], measured: true, note: "settled, 181 pt — a subtitle buys 5 pt" },
  ],
} as const;

/**
 * The three recordings' own clocks, in milliseconds and points. `duration` is the entrance; `hold` is
 * measured for the short banner alone (7132 ms to the first retraction frame) and is not recorded for
 * the other two, which were stopped at the settle.
 */
export const iosPushBannerMotion = {
  short: { duration: 200, settledHeight: 528 / pushBannerScale, hold: 7132 },
  long: { duration: 200, settledHeight: 569 / pushBannerScale, hold: undefined },
  group: { duration: 215, settledHeight: 543 / pushBannerScale, hold: undefined },
} as const;

export type PushBannerBox = { x: number; y: number; width: number; height: number };

/**
 * The banner's box in POINTS at `ms`.
 *
 * Between two recorded frames this **interpolates linearly, per component** — x, y, width and height
 * each on their own straight line between the frames that bracket the time. That is a choice, and it
 * is the conservative one: the recordings sample the entrance every 15–35 ms, which is dense enough
 * that a straight line between samples never strays far, and any curve fitted through them would put
 * numbers on screen that nothing measured. Before the first frame and after the last, the box is held
 * — so the short banner's retraction, whose end was never recorded, stops at the one frame of it that
 * was.
 */
export function pushBannerBoxAt(kind: PushBannerKind, ms: number): PushBannerBox {
  const frames = iosPushBannerFrames[kind];
  const t = Math.max(0, ms);
  const toPoints = ([x, y, width, height]: readonly [number, number, number, number]): PushBannerBox =>
    ({ x: x / pushBannerScale, y: y / pushBannerScale, width: width / pushBannerScale, height: height / pushBannerScale });
  const index = frames.findIndex(frame => frame.at >= t);
  if (index < 0) return toPoints(frames[frames.length - 1]!.px);
  if (index === 0) return toPoints(frames[0]!.px);
  const before = frames[index - 1]!;
  const after = frames[index]!;
  const fraction = (t - before.at) / (after.at - before.at);
  const at = (channel: 0 | 1 | 2 | 3) => before.px[channel] + (after.px[channel] - before.px[channel]) * fraction;
  return toPoints([at(0), at(1), at(2), at(3)]);
}

/** How far the box has opened, 0 at the first recorded frame and 1 at full width. Used for the reveal. */
export function pushBannerOpenness(kind: PushBannerKind, ms: number): number {
  const frames = iosPushBannerFrames[kind];
  const start = frames[0]!.px[2];
  const full = 1206;
  return Math.max(0, Math.min(1, (pushBannerBoxAt(kind, ms).width * pushBannerScale - start) / (full - start)));
}

/**
 * The interior, in points. **NONE of this is measured** — a bounding box carries no type size, no
 * inset and no radius, and no still capture of an iOS 26 banner exists in `references/`. It is here
 * so the component draws something coherent inside the box it does claim, and every value is a
 * judgement that a capture would overrule.
 *
 * The one number with a thread back to a measurement is `contentTop`: it clears the Dynamic Island,
 * whose bottom edge `ios-status-bar.tsx` measures at y 50.67 from the still captures. How much
 * clearance it takes is still a choice.
 */
export const iosPushBannerLayout = {
  /** UNMEASURED. Between the island's 18.33 pt corner and the fully open banner's much wider one. */
  cornerRadius: 28,
  /** UNMEASURED, but anchored: the island's measured bottom is 50.67, so content starts below it. */
  contentTop: 62,
  /** UNMEASURED. */
  contentInline: 20,
  iconSize: 38,
  iconRadius: 9,
  iconGap: 12,
  titleSize: 15,
  titleLeading: 20,
  subtitleSize: 13,
  subtitleLeading: 17,
  bodySize: 15,
  bodyLeading: 20,
  /**
   * UNMEASURED. The content is not drawn until the box is most of the way open — natively it is not
   * legible in the stub either — and is at full strength by the time the width is done.
   */
  revealFrom: 0.55,
  revealTo: 0.95,
} as const;

/** UNMEASURED: no frame of the recordings was sampled for colour, and no still capture holds a banner. */
const bannerVars =
  "[--ios-pb-fill:#f7f7faf2] [--ios-pb-title:#000000] [--ios-pb-body:#3c3c43] [--ios-pb-icon:#34c759] " +
  "dark:[--ios-pb-fill:#1c1c1ef2] dark:[--ios-pb-title:#ffffff] dark:[--ios-pb-body:#ebebf5] dark:[--ios-pb-icon:#30d158]";

/** Generic stand-in copy. NOT MEASURED — the pushed payloads' text was not recorded. */
const defaultCopy: Record<PushBannerKind, { title: string; subtitle?: string; body: string }> = {
  short: { title: "Messages", body: "New message" },
  long: { title: "Messages", body: "New message. This one runs long enough to need more than a single line, which is the case the taller banner was recorded on." },
  group: { title: "Messages", subtitle: "Group", body: "New message" },
};

export type IosPushBannerProps = Omit<ComponentProps<"div">, "title"> & {
  /** Which recorded table drives the geometry. */
  kind?: PushBannerKind;
  /** Milliseconds on that table. The banner is seeked, not played: this is the whole clock. */
  t: number;
  title?: ReactNode;
  /** The second line a group banner carries. */
  subtitle?: ReactNode;
  body?: ReactNode;
  /** The app icon. Defaults to a plain placeholder mark — the real icon art is not this kit's. */
  icon?: ReactNode;
};

/**
 * A notification banner, posed at `t`. It has no clock of its own: the geometry is a pure function of
 * `(kind, t)`, so the harness can seek it to an exact millisecond and the eval can measure the box it
 * lands on. Position it inside the device frame; it places itself.
 */
export function IosPushBanner({ kind = "short", t, title, subtitle, body, icon, className, style, ...props }: IosPushBannerProps) {
  const layout = iosPushBannerLayout;
  const box = pushBannerBoxAt(kind, t);
  const copy = defaultCopy[kind];
  const openness = pushBannerOpenness(kind, t);
  const reveal = Math.max(0, Math.min(1, (openness - layout.revealFrom) / (layout.revealTo - layout.revealFrom)));
  const shownTitle = title ?? copy.title;
  const shownSubtitle = subtitle ?? copy.subtitle;
  const shownBody = body ?? copy.body;
  return (
    <div data-slot="ios-push-banner" data-kind={kind} data-t={Math.round(t)} role="status" aria-live="polite"
      className={cn("absolute z-50 select-none overflow-hidden", bannerVars, className)}
      style={{
        left: box.x, top: box.y, width: box.width, height: box.height,
        borderRadius: layout.cornerRadius, background: "var(--ios-pb-fill)",
        backdropFilter: "blur(30px) saturate(1.8)", WebkitBackdropFilter: "blur(30px) saturate(1.8)",
        fontFamily: fontStack, ...style,
      }} {...props}>
      {/*
        The content is clipped by the box rather than sizing it: the recorded heights say the banner
        clamps (14 pt for a long body, 5 pt for a subtitle), so a body that does not fit is cut off
        exactly as native cuts it off, and nothing in here may push the box taller.
      */}
      <div data-slot="push-banner-content" className="flex items-start overflow-hidden"
        style={{ paddingTop: layout.contentTop, paddingInline: layout.contentInline, gap: layout.iconGap, height: "100%", opacity: reveal }}>
        <div data-slot="push-banner-icon" aria-hidden="true" className="flex shrink-0 items-center justify-center"
          style={{ width: layout.iconSize, height: layout.iconSize, borderRadius: layout.iconRadius, background: icon ? undefined : "var(--ios-pb-icon)" }}>
          {icon ?? (
            <svg width={layout.iconSize * 0.62} height={layout.iconSize * 0.62} viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
              <path d="M12 3.2c-5.1 0-9.2 3.3-9.2 7.4 0 2.4 1.4 4.5 3.6 5.9-.2 1.2-.8 2.4-1.7 3.4 1.7-.2 3.3-.9 4.6-1.9 .9.2 1.8.3 2.7.3 5.1 0 9.2-3.3 9.2-7.7S17.1 3.2 12 3.2Z" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div data-slot="push-banner-title" className="truncate"
            style={{ fontSize: layout.titleSize, lineHeight: `${layout.titleLeading}px`, fontWeight: 600, color: "var(--ios-pb-title)" }}>
            {shownTitle}
          </div>
          {shownSubtitle !== undefined && (
            <div data-slot="push-banner-subtitle" className="truncate"
              style={{ fontSize: layout.subtitleSize, lineHeight: `${layout.subtitleLeading}px`, fontWeight: 400, color: "var(--ios-pb-body)", opacity: 0.75 }}>
              {shownSubtitle}
            </div>
          )}
          <div data-slot="push-banner-body"
            style={{ fontSize: layout.bodySize, lineHeight: `${layout.bodyLeading}px`, color: "var(--ios-pb-body)" }}>
            {shownBody}
          </div>
        </div>
      </div>
    </div>
  );
}
