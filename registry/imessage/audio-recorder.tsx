"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { usePlatform, type Platform } from "@/registry/imessage/platform";
import { fontStack } from "@/registry/imessage/tokens";

/**
 * Recording an audio message: the composer's field becomes a row with a live waveform, a timer and
 * the stop control, and once you stop, a play control and a send button.
 *
 * ## Where these numbers come from
 *
 * **No capture in `references/` holds this screen on either platform.** Everything geometric below
 * was instead read out of ChatKit itself, which is the framework macOS Messages runs on: a Mac
 * Catalyst probe (`clang -target arm64-apple-ios18.0-macabi`) dlopens
 * `/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit`, swizzles
 * `-[UIDevice userInterfaceIdiom]` so `+[CKUIBehavior sharedBehaviors]` vends the Phone or the Mac
 * behaviour, and then **builds the real view**: `-[CKAudioMessageRecordingView initWithFrame:service:]`
 * (a Swift class, `ChatKit.AudioMessageRecordingView`), feeds it levels through
 * `-addToWaveformWithIntensity:`, walks `-setState:` 0 to 3 and reads every subview's frame back.
 * So the frames below are the frames Messages lays out, not a reading of a screenshot and not a guess.
 *
 * Read off `CKUIBehavior` (shared by both idioms unless noted):
 *
 * | Selector | Value |
 * |---|---|
 * | `audioRecordingViewDurationSpacing` | 12, and it is the only gap the row uses |
 * | `audioRecordingViewButtonSpacing` | 16, the waveform's leading inset with no play button |
 * | `audioWaveformViewHeight` / `audioWaveformHeight` | 39 / 35 |
 * | `waveformPowerLevelWidth` / `audioWaveformGapWidth` | 2 / 2, so the bar pitch is 4 |
 * | `minimumWaveformHeight` | 4 |
 * | `audioRecordingViewTimeBetweenWaveformSegments` | 0.0833333 s, i.e. 12 bars a second |
 * | `minAudioRecordingDuration` / `maxAudioRecordingDuration` | 0.25 / 60 |
 * | `audioRecordingViewMinimumDBLevel` / `MaximumDBLevel` | -60 / -10 |
 * | `audioBalloonTimeFont` | SF Regular **13** on Phone, **16** on Mac: the timer's type |
 * | `audioMessagePeakAnimationDuration` | 0.5 |
 *
 * Read off the built view (`-[CKAudioMessageRecordingView sizeThatFits:]` and its subviews' frames,
 * Phone idiom in a 294-wide box, which is the measured width of the iOS composer field):
 *
 * - the row is **52** tall (Mac: **49**), and every child is centred in it;
 * - play/pause: a **34** circle 9 in from the leading edge (Mac: **31**), fill `#767680` at 12%,
 *   `play.fill` / `pause.fill`;
 * - stop: a **34** circle 9 in from the trailing edge (Mac: 31), fill `#FF383C` at 19%, `stop.fill`;
 * - send: `CKGlassSendButton`, **30 x 22, radius 11**, 15 in from the trailing edge (Mac: 13.5),
 *   `#0088ff` with `arrow.up`;
 * - the timer: `ChatKit.AudioMessageRecordingAppendButton`, **29.5 x 16 radius 8** while recording
 *   (Mac 35 x 19 radius 9.5) and **61 x 26 radius 13** once stopped (Mac 62.5 x 27 radius 13.5),
 *   where it also carries a `plus` and appends to the take;
 * - the waveform box: 39 tall in the 52 row and 36.75 in the Mac 49, i.e. **0.75 of the row** both
 *   times, its leading edge 16 while recording and (button + 12) once the play control is there.
 *
 * Those four layouts reproduce exactly: leading inset + parts + 12 between each + trailing inset add
 * up to the framework's own subview frames to the pixel, on both idioms and in both states.
 *
 * Bar height is **not** linear in the level: feeding known intensities and reading the segment views
 * back gives `height = level^2 * waveformHeight`, floored at the 4 above (0.111 -> 4.333, 0.222 ->
 * 7.704, 0.444 -> 17.333, 1 -> 39, all at 39 of box). The bars are 2 wide with a radius of 1.
 *
 * Colours, resolved through `-resolvedColorWithTraitCollection:` in both styles:
 * recording bars `#FF383C` light / `#FF4245` dark; played-back bars `rgba(0,0,0,0.5)` /
 * `rgba(255,255,255,0.55)` with the part that has not played yet at half that alpha; the timer red
 * while recording and 85% label ink afterwards.
 *
 * The `x` that replaces the composer's `+` is `CKGlassCancelAudioRecordingButton`: **41** across on
 * Phone and **35** on Mac, its `xmark` ink 17 x 16 centred. Each glyph outline here was traced from
 * the framework's own rendering: the probe rasterised `xmark`, `stop.fill`, `play.fill`,
 * `pause.fill`, `plus` and `arrow.up` at 17 pt (arrow Bold) at 8x and measured the ink -- stop 14
 * square with a 1.5 corner, pause two 4.25 x 14 bars 2 apart, play a 12.5 x 14 triangle, plus and
 * xmark 1.5 of stroke over 14 and 13.5, arrow 13.5 x 16 with a 2.44 stem. The arrow is the same
 * glyph the composer's send pill draws, and the two agree: 2.44 of stroke here against the 2.41
 * traced from `conv3-light.png`.
 *
 * ## What is not from the framework
 *
 * - **Where the row sits.** It reuses the composer's measured geometry so it lands on the field:
 *   iOS 28 of padding, the leading circle, a 12 gap, then the row across the field's 294 with its
 *   bottom edge on the field's (`ios-composer.tsx`); macOS the field's own left 49, width 530 and
 *   bottom 11 (`macos-composer.tsx`). The row is taller than the field it replaces (52 against
 *   40.33, 49 against 31), so it grows upward. **Judgement**: nothing says the row is centred on the
 *   field's box rather than resting on its bottom edge.
 * - **The row's corner radius**: half its height, i.e. a capsule, because both composer fields are
 *   capsules at one line (iOS 20 on 40.33, macOS 15.5 on 31, both measured). Judgement.
 * - **The row's fill**: the composer's own glass (iOS) and field fill (macOS), copied from those two
 *   files rather than imported, so this stays a registry item with no dependency on either.
 * - **The stopped pill's fill and the play glyph's ink**: reused from the play button's measured fill
 *   and the pill's own label colour. The framework builds them from a `UIBackgroundConfiguration`
 *   that resolves to nothing outside a window, so the probe could not read them. Judgement.
 * - **Playback windowing.** While recording, the newest bar's right edge is the waveform box's right
 *   edge (framework). Once stopped, the framework resamples the take to the bars that fit
 *   (`waveformMinPowerLevelsCount` 25, `waveformMaxPowerLevelsCount` 50, and the built view showed
 *   27 bars in a 109-wide box), which is what this does; that the whole take spans the box rather
 *   than scrolling under a playhead is judgement.
 * - **Motion.** The state change is the framework's own `stateChangeAnimationDuration` **0.6** and
 *   `stateChangeSpringDamping` **0.86` (Swift ivars of `AudioMessageRecordingView`, read at the
 *   constructor's trap), but the spring frequency UIKit derives from that pair is not stored
 *   anywhere, so the `linear()` easing here samples a spring settled to 0.1% at 0.6 s: judgement.
 *   The entrance and exit reuse the measured 260/200 ms and `cubic-bezier(0.32, 0.72, 0, 1)` of the
 *   iOS effects screen (`effectsPickerMetrics.timing`), which is a reuse, not a measurement of this.
 *
 * Every animation is seekable rather than merely playable: the scroll is one linear Web Animations
 * timeline whose offset is linear in time, so `progress` pauses and seeks it to a frame that renders
 * identically on every run, and the state change takes `transition={{ from, progress }}` the way
 * `MacComposer` takes `grow`. `prefers-reduced-motion` builds no timeline at all and poses the row.
 */
export const audioRecorderMetrics = {
  /** Both sets are ChatKit's, read per idiom. Points equal CSS px. */
  ios: {
    /** `-[CKAudioMessageRecordingView sizeThatFits:]`, Phone idiom. */
    rowHeight: 52,
    /** Composer geometry (`ios-composer.tsx`): the row takes the field's box and its bottom edge. */
    composer: { padding: 28, leading: 41, leadingGap: 12, fieldWidth: 294 },
    button: { size: 34, inset: 9 },
    send: { width: 30, height: 22, radius: 11, inset: 15 },
    timer: { width: 29.5, height: 16, radius: 8, fontSize: 13 },
    append: { width: 61, height: 26, radius: 13 },
    waveform: { leadingInset: 16, gap: 12, heightRatio: 0.75, barWidth: 2, barGap: 2, minBarHeight: 4 },
  },
  macos: {
    rowHeight: 49,
    /** `macos-composer.tsx`: field left 49, width 530, 11 above the pane's bottom. */
    composer: { bottom: 11, left: 49, fieldWidth: 530, leading: 35, leadingInset: 8.5 },
    button: { size: 31, inset: 9 },
    send: { width: 30, height: 22, radius: 11, inset: 13.5 },
    timer: { width: 35, height: 19, radius: 9.5, fontSize: 16 },
    append: { width: 62.5, height: 27, radius: 13.5 },
    waveform: { leadingInset: 16, gap: 12, heightRatio: 0.75, barWidth: 2, barGap: 2, minBarHeight: 4 },
  },
} as const;

/** Timings. The first four are ChatKit's; the last two are borrowed, see the note above. */
export const audioRecorderMotion = {
  /** `audioRecordingViewTimeBetweenWaveformSegments`: one bar every 83.33 ms. */
  segment: 1000 / 12,
  /** `minAudioRecordingDuration` / `maxAudioRecordingDuration`, in seconds. */
  minDuration: 0.25,
  maxDuration: 60,
  /** `AudioMessageRecordingView.stateChangeAnimationDuration` and `.stateChangeSpringDamping`. */
  stateChange: 600,
  stateChangeDamping: 0.86,
  /** Reused from the measured iOS effects screen; nothing measures this row appearing. */
  enter: 260,
  exit: 200,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

export type AudioRecorderState = "recording" | "stopped" | "playing";

export type AudioRecorderProps = Omit<ComponentProps<"div">, "onChange" | "children"> & {
  platform?: Platform;
  /** Which pose the row is in. */
  state?: AudioRecorderState;
  /**
   * Levels 0..1, oldest first, one per 83.33 ms segment. Leave it out for a deterministic stand-in:
   * this never touches a microphone, and a screenshot has to land on the same bars every run.
   */
  levels?: number[];
  /** Length of the take in seconds. Defaults to `levels.length / 12`. */
  duration?: number;
  /** Seconds into the take, controlled. */
  position?: number;
  /**
   * Seeks the clock to this fraction of `duration` instead of running it, which is what the harness
   * does. It also stops the internal clock, so a checkpoint is a pure function of its props.
   */
  progress?: number;
  /** Seek the state change instead of playing it, the way `MacComposer` takes `grow`. */
  transition?: { from: AudioRecorderState; progress: number };
  /** False plays the exit and then calls `onExited`. */
  open?: boolean;
  onExited?: () => void;
  onCancel?: () => void;
  onStop?: () => void;
  onSend?: () => void;
  /** The `+` inside the timer pill, which appends to the take. */
  onAppend?: () => void;
  onPlayChange?: (playing: boolean) => void;
  onSeek?: (seconds: number) => void;
  /** Width of the row. Defaults to the platform's measured composer field. */
  width?: number;
  /** Takes focus when it opens. Off by default so a seeked frame never moves the caret. */
  autoFocus?: boolean;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** m:ss, the way the framework's own label reads ("0:00", "0:12"). */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * A stand-in take. Deterministic on purpose: no `Math.random` may reach a render, and the harness
 * screenshots this row. The shape is the one `message-audio.tsx` uses for its own stand-in peaks.
 */
function fallbackLevels(count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const a = Math.sin(i * 0.7) * 0.5 + 0.5;
    const b = Math.sin(i * 1.9 + 1.1) * 0.5 + 0.5;
    return 0.35 + Math.min(1, a * 0.6 + b * 0.55) * 0.65;
  });
}

/**
 * The whole take, averaged down to the bars that fit, which is what the framework does once
 * recording stops (it holds between `waveformMinPowerLevelsCount` and `waveformMaxPowerLevelsCount`
 * levels for a balloon). Averaging, not sampling, so the summary does not flicker with the bucket.
 */
function resample(levels: number[], count: number): number[] {
  if (count <= 0) return [];
  if (levels.length === 0) return Array.from({ length: count }, () => 0);
  return Array.from({ length: count }, (_, i) => {
    const from = Math.floor((i * levels.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / count));
    let sum = 0;
    for (let j = from; j < to; j++) sum += levels[j] ?? 0;
    return sum / (to - from);
  });
}

/**
 * A damped spring as a `linear()` easing, so the state change can be a single seekable timeline.
 * The damping ratio is the framework's 0.86; the frequency is not stored anywhere, so this picks
 * the one that settles to 0.1% exactly at the framework's 600 ms, which is a fit, not a reading.
 */
function springEasing(damping: number, steps = 24): string {
  const omega = -Math.log(0.001) / damping;
  const damped = omega * Math.sqrt(Math.max(0.0001, 1 - damping * damping));
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const value = 1 - Math.exp(-damping * omega * t) * (Math.cos(damped * t) + ((damping * omega) / damped) * Math.sin(damped * t));
    return `${value.toFixed(4)} ${(t * 100).toFixed(2)}%`;
  });
  return `linear(${points.join(", ")})`;
}

/**
 * Web Animations rejects an easing it cannot parse, and `linear()` needs a 2023 engine, so a browser
 * without it falls back to the measured decelerating curve rather than losing the animation.
 */
function animateWithSpring(element: Element, frames: Keyframe[], duration: number, easing: string): Animation {
  try {
    return element.animate(frames, { duration, easing });
  } catch {
    return element.animate(frames, { duration, easing: audioRecorderMotion.ease });
  }
}

const reducedMotionQuery = () => (typeof window === "undefined" ? null : window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null);
function subscribeReducedMotion(onChange: () => void) {
  const query = reducedMotionQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}
/** True when the viewer asked for less motion; false while server rendering. Its own copy, as in `macos-composer.tsx`. */
function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, () => reducedMotionQuery()?.matches ?? false, () => false);
}

/* Glyphs. Every box below is the ink the framework's own 17 pt symbol renders at 8x, measured. */

/** `xmark`, ink 13.5 square, 1.5 of stroke with round caps. */
function XmarkGlyph({ size = 13.5 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 13.5 13.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M0.75 0.75 12.75 12.75M12.75 0.75 0.75 12.75" />
    </svg>
  );
}

/** `stop.fill`, a 14 square with a 1.5 corner (fitted to the rendered coverage at two depths). */
function StopGlyph() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="0" y="0" width="14" height="14" rx="1.5" />
    </svg>
  );
}

/** `play.fill`, ink 12.5 x 14, its corners rounded by ~1.3 (the stroke rounds the joins). */
function PlayGlyph() {
  return (
    <svg aria-hidden="true" width="12.5" height="14" viewBox="0 0 12.5 14" fill="currentColor" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      <path d="M0.65 0.9 11.2 7 0.65 13.1Z" />
    </svg>
  );
}

/** `pause.fill`, two 4.25 x 14 bars 2 apart, corner ~1.2. */
function PauseGlyph() {
  return (
    <svg aria-hidden="true" width="10.5" height="14" viewBox="0 0 10.5 14" fill="currentColor">
      <rect x="0" y="0" width="4.25" height="14" rx="1.2" />
      <rect x="6.25" y="0" width="4.25" height="14" rx="1.2" />
    </svg>
  );
}

/** `plus`, 14 across each way at 1.5 of stroke. */
function PlusGlyph() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M0.75 7H13.25M7 0.75V13.25" />
    </svg>
  );
}

/** `arrow.up` Bold, ink 13.5 x 16: 2.44 of stem, arms 5.28 across per 5.88 down. */
function ArrowUpGlyph() {
  return (
    <svg aria-hidden="true" width="13.5" height="16" viewBox="0 0 13.5 16" fill="none" stroke="currentColor" strokeWidth="2.44" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.47 7.1 6.75 1.22 12.03 7.1M6.75 1.22V14.78" />
    </svg>
  );
}

const vars =
  // iOS glass, copied from `ios-composer.tsx` (measured), and the framework's own recording colours.
  "[--ar-glass:rgba(255,255,255,0.9)] [--ar-rim:none] [--ar-shadow:0_6px_36px_4px_rgba(0,0,0,0.065)] [--ar-round-shadow:0_5px_20px_6px_rgba(0,0,0,0.055)] " +
  "[--ar-red:#ff383c] [--ar-ink:rgba(0,0,0,0.85)] [--ar-glyph:#1a1919] [--ar-wave:rgba(0,0,0,0.5)] [--ar-fill:rgba(118,118,128,0.12)] " +
  "dark:[--ar-glass:rgba(28,28,28,0.9)] dark:[--ar-rim:inset_0_0_0_1px_rgba(255,255,255,0.09)] dark:[--ar-shadow:none] dark:[--ar-round-shadow:none] " +
  "dark:[--ar-red:#ff4245] dark:[--ar-ink:rgba(255,255,255,0.85)] dark:[--ar-glyph:#f4f3f4] dark:[--ar-wave:rgba(255,255,255,0.55)]";

const macVars =
  // macOS field fill, rim and shadow, copied from `macos-composer.tsx` (measured).
  "[--ar-glass:#ffffff] [--ar-rim:none] [--ar-shadow:0_5px_25px_rgba(0,0,0,0.07)] [--ar-round-shadow:0_5px_25px_rgba(0,0,0,0.07)] [--ar-glyph:#010101] " +
  "dark:[--ar-glass:#232323] dark:[--ar-rim:inset_0.774px_0.774px_0_0_#424242,inset_-0.774px_-0.774px_0_0_#424242] dark:[--ar-shadow:0_5px_25px_rgba(0,0,0,0.05)] dark:[--ar-round-shadow:0_5px_25px_rgba(0,0,0,0.05)] dark:[--ar-glyph:#f1f1f1]";

type Geometry = {
  waveLeft: number;
  waveRight: number;
  timerRight: number;
  timerWidth: number;
  timerHeight: number;
  timerRadius: number;
  stop: number;
  send: number;
  play: number;
};

export function AudioRecorder({
  platform: platformProp,
  state = "recording",
  levels,
  duration: durationProp,
  position: positionProp,
  progress,
  transition,
  open = true,
  onExited,
  onCancel,
  onStop,
  onSend,
  onAppend,
  onPlayChange,
  onSeek,
  width,
  autoFocus = false,
  className,
  style,
  ...props
}: AudioRecorderProps) {
  const contextPlatform = usePlatform();
  const platform = platformProp ?? contextPlatform;
  const ios = platform === "ios";
  const m = audioRecorderMetrics[platform];
  const motion = audioRecorderMotion;
  const reduced = usePrefersReducedMotion();

  const rowWidth = width ?? m.composer.fieldWidth;
  const take = useMemo(() => (levels?.length ? levels : fallbackLevels(60)), [levels]);
  const duration = durationProp ?? take.length / 12;
  const recording = state === "recording";

  const root = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const waveBox = useRef<HTMLDivElement>(null);
  const timerBox = useRef<HTMLDivElement>(null);
  const stopButton = useRef<HTMLButtonElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const laidOut = useRef<AudioRecorderState | null>(null);
  const exited = useRef(false);
  /** The callback lives in a ref so an inline arrow cannot restart the exit it just reported. */
  const exitedCallback = useRef(onExited);
  useEffect(() => {
    exitedCallback.current = onExited;
  });

  /**
   * The clock, for a caller that passes neither a position nor a seek. The elapsed time is stamped
   * with the run it belongs to, so a new run reads as zero during render instead of needing the
   * effect to write zero into state before the first tick lands.
   */
  const live = progress === undefined && positionProp === undefined;
  const run = `${live}|${open}|${state}`;
  const [tick, setTick] = useState({ run: "", seconds: 0 });
  const ticking = tick.run === run ? tick.seconds : 0;
  useEffect(() => {
    if (!live || !open) return;
    if (state !== "recording" && state !== "playing") return;
    const started = performance.now();
    const id = window.setInterval(() => {
      const seconds = (performance.now() - started) / 1000;
      setTick({ run, seconds: Math.min(seconds, duration) });
    }, motion.segment);
    return () => window.clearInterval(id);
  }, [live, open, state, duration, motion.segment, run]);

  const position = Math.max(0, Math.min(duration, positionProp ?? (progress !== undefined ? clamp01(progress) * duration : ticking)));

  const geometry = useMemo(() => {
    const build = (which: AudioRecorderState): Geometry => {
      const isRecording = which === "recording";
      const trailing = isRecording ? m.button.inset + m.button.size : m.send.inset + m.send.width;
      const timerWidth = isRecording ? m.timer.width : m.append.width;
      return {
        waveLeft: isRecording ? m.waveform.leadingInset : m.button.inset + m.button.size + m.waveform.gap,
        waveRight: trailing + m.waveform.gap + timerWidth + m.waveform.gap,
        timerRight: trailing + m.waveform.gap,
        timerWidth,
        timerHeight: isRecording ? m.timer.height : m.append.height,
        timerRadius: isRecording ? m.timer.radius : m.append.radius,
        stop: isRecording ? 1 : 0,
        send: isRecording ? 0 : 1,
        play: isRecording ? 0 : 1,
      };
    };
    return { recording: build("recording"), stopped: build("stopped"), playing: build("playing") };
  }, [m]);

  const pose = geometry[state];
  const waveWidth = Math.max(0, rowWidth - pose.waveLeft - pose.waveRight);
  const waveHeight = m.rowHeight * m.waveform.heightRatio;
  const pitch = m.waveform.barWidth + m.waveform.barGap;

  /**
   * While recording the strip carries the whole take and scrolls under the box's right edge, so the
   * bar for "now" is always flush with it and the ones still to come are clipped. Once it stops, the
   * take is averaged down to the bars that fit and the whole of it is in view.
   */
  const bars = recording ? take : resample(take, Math.max(1, Math.floor((waveWidth + m.waveform.barGap) / pitch)));
  const played = duration > 0 ? position / duration : 0;
  const stripOffset = (take.length - 1) * pitch;

  /**
   * The scroll. One linear timeline: the offset is `(N - 1) * pitch - 48 * t`, which is linear in
   * time because the framework adds a bar every 83.33 ms at a pitch of 4. That makes it seekable to
   * an exact frame, and it needs no measurement of the box, since the strip hangs off its right edge.
   */
  useLayoutEffect(() => {
    const element = strip.current;
    if (!element || !recording) return;
    const total = duration * 1000;
    const to = stripOffset - (total / motion.segment) * pitch;
    if (reduced || total <= 0) {
      const at = stripOffset - (position * 1000 / motion.segment) * pitch;
      element.style.transform = `translateX(${at}px)`;
      return () => { element.style.transform = ""; };
    }
    const animation = element.animate(
      [{ transform: `translateX(${stripOffset}px)` }, { transform: `translateX(${to}px)` }],
      { duration: total, easing: "linear", fill: "both" },
    );
    if (progress !== undefined || positionProp !== undefined) {
      // Seeked, not played: a scrubbed checkpoint has to land on the same frame every run.
      animation.pause();
      animation.currentTime = Math.max(0, Math.min(total, position * 1000));
    }
    return () => animation.cancel();
  }, [recording, duration, stripOffset, pitch, position, progress, positionProp, reduced, motion.segment]);

  /**
   * The state change. It is a transient override of the layout the render already put in place (no
   * `fill`), so the end of it is the settled row rather than a copy of it, and `transition` seeks it
   * instead of playing it. Which direction it runs is read from the props during render.
   */
  const transitionFrom = transition?.from;
  const transitionProgress = transition?.progress;
  useLayoutEffect(() => {
    const from = transitionFrom ?? laidOut.current;
    laidOut.current = state;
    if (from === null || from === undefined || from === state || reduced) return;
    const a = geometry[from];
    const b = geometry[state];
    const easing = springEasing(motion.stateChangeDamping);
    const animations: Animation[] = [];
    const move = (element: Element | null, frames: Keyframe[]) => {
      if (element) animations.push(animateWithSpring(element, frames, motion.stateChange, easing));
    };
    move(waveBox.current, [{ left: `${a.waveLeft}px`, right: `${a.waveRight}px` }, { left: `${b.waveLeft}px`, right: `${b.waveRight}px` }]);
    move(timerBox.current, [
      { right: `${a.timerRight}px`, width: `${a.timerWidth}px`, height: `${a.timerHeight}px`, borderRadius: `${a.timerRadius}px` },
      { right: `${b.timerRight}px`, width: `${b.timerWidth}px`, height: `${b.timerHeight}px`, borderRadius: `${b.timerRadius}px` },
    ]);
    move(stopButton.current, [{ opacity: a.stop }, { opacity: b.stop }]);
    move(sendButton.current, [{ opacity: a.send }, { opacity: b.send }]);
    move(playButton.current, [{ opacity: a.play }, { opacity: b.play }]);
    if (transitionProgress !== undefined) {
      const at = clamp01(transitionProgress) * motion.stateChange;
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = at;
      }
    }
    return () => { for (const animation of animations) animation.cancel(); };
  }, [state, transitionFrom, transitionProgress, geometry, reduced, motion.stateChange, motion.stateChangeDamping]);

  /**
   * Entrance and exit, one timeline run forwards or backwards. `open` is read during render, so the
   * closing pose gets its committed frames before `onExited` lets the caller unmount the row.
   */
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (open) exited.current = false;
    const closing = !open;
    const finish = () => {
      if (exited.current) return;
      exited.current = true;
      exitedCallback.current?.();
    };
    // Scrubbing is inspection, not a dismissal: a seeked exit poses the row and reports nothing.
    const reports = closing && progress === undefined;
    if (reduced) {
      element.style.opacity = closing ? "0" : "";
      if (!reports) return;
      const frame = requestAnimationFrame(finish);
      return () => cancelAnimationFrame(frame);
    }
    const away = { opacity: 0, transform: "scale(0.97)" };
    const settled = { opacity: 1, transform: "scale(1)" };
    const animation = element.animate(closing ? [settled, away] : [away, settled], {
      duration: closing ? motion.exit : motion.enter,
      easing: closing ? "ease-out" : motion.ease,
      fill: "both",
    });
    if (progress !== undefined) {
      animation.pause();
      animation.currentTime = closing ? motion.exit : motion.enter;
      return () => animation.cancel();
    }
    if (!closing) return () => animation.cancel();
    animation.addEventListener("finish", finish);
    return () => animation.removeEventListener("finish", finish);
  }, [open, progress, reduced, motion.enter, motion.exit, motion.ease]);

  useEffect(() => {
    if (!autoFocus || !open || progress !== undefined) return;
    (recording ? stopButton.current : playButton.current)?.focus({ preventScroll: true });
  }, [autoFocus, open, progress, recording]);

  const seek = (clientX: number) => {
    const element = waveBox.current;
    if (!element || !onSeek || recording) return;
    const rect = element.getBoundingClientRect();
    onSeek(clamp01((clientX - rect.left) / rect.width) * duration);
  };

  const timeText = recording || state === "playing" ? clock(position) : clock(duration);
  const circle = "absolute flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088ff]";

  const row = (
    <div
      data-slot="recording-row"
      className="relative select-none"
      style={{
        width: rowWidth,
        height: m.rowHeight,
        borderRadius: m.rowHeight / 2,
        background: "var(--ar-glass)",
        boxShadow: "var(--ar-rim), var(--ar-shadow)",
        backdropFilter: ios ? "blur(24px)" : undefined,
        WebkitBackdropFilter: ios ? "blur(24px)" : undefined,
      }}
    >
      <button
        ref={playButton}
        type="button"
        data-slot="play"
        aria-label={state === "playing" ? "Pause audio message" : "Play audio message"}
        aria-pressed={state === "playing"}
        aria-hidden={recording}
        tabIndex={recording ? -1 : undefined}
        onClick={() => onPlayChange?.(state !== "playing")}
        className={circle}
        style={{
          left: m.button.inset, top: (m.rowHeight - m.button.size) / 2, width: m.button.size, height: m.button.size,
          background: "var(--ar-fill)", color: "var(--ar-ink)", opacity: pose.play, pointerEvents: recording ? "none" : undefined,
        }}
      >
        {state === "playing" ? <PauseGlyph /> : <PlayGlyph />}
      </button>

      <div
        ref={waveBox}
        data-slot="waveform"
        role={recording ? undefined : "slider"}
        aria-hidden={recording || undefined}
        tabIndex={recording ? undefined : 0}
        aria-label={recording ? undefined : "Playback position"}
        aria-valuemin={recording ? undefined : 0}
        aria-valuemax={recording ? undefined : Math.round(duration)}
        aria-valuenow={recording ? undefined : Math.round(position)}
        aria-valuetext={recording ? undefined : clock(position)}
        onPointerDown={event => { if (!recording && onSeek) { event.currentTarget.setPointerCapture(event.pointerId); seek(event.clientX); } }}
        onPointerMove={event => { if (event.buttons === 1) seek(event.clientX); }}
        onKeyDown={event => {
          if (recording || !onSeek) return;
          if (event.key === "ArrowRight") { event.preventDefault(); onSeek(Math.min(duration, position + 1)); }
          if (event.key === "ArrowLeft") { event.preventDefault(); onSeek(Math.max(0, position - 1)); }
        }}
        className="absolute overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088ff]"
        style={{ left: pose.waveLeft, right: pose.waveRight, top: (m.rowHeight - waveHeight) / 2, height: waveHeight }}
      >
        {/* Anchored to the box's trailing edge: while recording, the newest bar's right edge is that
            edge and the rest of the take is clipped to its right until the scroll brings it in. */}
        <div
          ref={strip}
          data-slot="waveform-bars"
          className="absolute flex items-center"
          style={{ right: 0, top: 0, height: waveHeight, gap: m.waveform.barGap, transform: recording ? `translateX(${stripOffset}px)` : undefined }}
        >
          {bars.map((level, index) => {
            const reached = recording || (bars.length > 0 && index / bars.length < played);
            return (
              <span
                key={index}
                aria-hidden="true"
                style={{
                  width: m.waveform.barWidth,
                  height: Math.max(m.waveform.minBarHeight, level * level * waveHeight),
                  borderRadius: m.waveform.barWidth / 2,
                  background: recording ? "var(--ar-red)" : "var(--ar-wave)",
                  opacity: reached ? 1 : 0.5,
                }}
              />
            );
          })}
        </div>
      </div>

      <div
        ref={timerBox}
        data-slot="timer"
        className="absolute flex items-center justify-center"
        style={{
          right: pose.timerRight, top: (m.rowHeight - pose.timerHeight) / 2, width: pose.timerWidth, height: pose.timerHeight,
          borderRadius: pose.timerRadius, background: recording ? "transparent" : "var(--ar-fill)",
          gap: 4, fontFamily: fontStack, fontSize: m.timer.fontSize, color: recording ? "var(--ar-red)" : "var(--ar-ink)",
          fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
        }}
      >
        {!recording && onAppend ? (
          <button type="button" data-slot="append" aria-label="Record more" onClick={onAppend}
            className="flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088ff]"
            style={{ width: 11.5, height: 11.5, color: "inherit" }}>
            <PlusGlyph />
          </button>
        ) : null}
        <span role="timer" aria-label={recording ? "Recording time" : "Audio message length"}>{timeText}</span>
      </div>

      <button
        ref={stopButton}
        type="button"
        data-slot="stop"
        aria-label="Stop recording"
        aria-hidden={!recording}
        tabIndex={recording ? undefined : -1}
        onClick={onStop}
        className={circle}
        style={{
          right: m.button.inset, top: (m.rowHeight - m.button.size) / 2, width: m.button.size, height: m.button.size,
          background: "color-mix(in srgb, var(--ar-red) 19%, transparent)", color: "var(--ar-red)",
          opacity: pose.stop, pointerEvents: recording ? undefined : "none",
        }}
      >
        <StopGlyph />
      </button>

      <button
        ref={sendButton}
        type="button"
        data-slot="send"
        aria-label="Send audio message"
        aria-hidden={recording}
        tabIndex={recording ? -1 : undefined}
        onClick={onSend}
        className="absolute flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088ff]"
        style={{
          right: m.send.inset, top: (m.rowHeight - m.send.height) / 2, width: m.send.width, height: m.send.height,
          borderRadius: m.send.radius, background: "#0088ff", color: "#ffffff",
          opacity: pose.send, pointerEvents: recording ? "none" : undefined,
        }}
      >
        <ArrowUpGlyph />
      </button>
    </div>
  );

  const cancel = (
    <button
      type="button"
      data-slot="cancel"
      aria-label="Cancel audio message"
      onClick={onCancel}
      className="flex shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088ff]"
      style={{
        width: ios ? audioRecorderMetrics.ios.composer.leading : audioRecorderMetrics.macos.composer.leading,
        height: ios ? audioRecorderMetrics.ios.composer.leading : audioRecorderMetrics.macos.composer.leading,
        background: "var(--ar-glass)", boxShadow: "var(--ar-rim), var(--ar-round-shadow)", color: "var(--ar-glyph)",
        backdropFilter: ios ? "blur(24px)" : undefined, WebkitBackdropFilter: ios ? "blur(24px)" : undefined,
      }}
    >
      <XmarkGlyph />
    </button>
  );

  if (!ios) {
    const mac = audioRecorderMetrics.macos;
    return (
      <div
        ref={root}
        data-slot="audio-recorder"
        data-state={state}
        data-platform="macos"
        role="group"
        aria-label="Audio message"
        className={cn("absolute inset-x-0 bottom-0 select-none", macVars, className)}
        style={{ height: mac.composer.bottom + mac.rowHeight + 10, fontFamily: fontStack, ...style }}
        {...props}
      >
        <div className="absolute" style={{ left: mac.composer.leadingInset, bottom: mac.composer.bottom }}>{cancel}</div>
        <div className="absolute" style={{ left: mac.composer.left, bottom: mac.composer.bottom }}>{row}</div>
      </div>
    );
  }

  const composer = audioRecorderMetrics.ios.composer;
  return (
    <div
      ref={root}
      data-slot="audio-recorder"
      data-state={state}
      data-platform="ios"
      role="group"
      aria-label="Audio message"
      className={cn("relative isolate flex w-full items-end select-none", vars, className)}
      style={{ padding: `0 ${composer.padding}px ${composer.padding}px ${composer.padding}px`, fontFamily: fontStack, ...style } as CSSProperties}
      {...props}
    >
      {cancel}
      <div style={{ marginLeft: composer.leadingGap }}>{row}</div>
    </div>
  );
}
