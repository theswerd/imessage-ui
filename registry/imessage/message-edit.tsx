"use client";

import { useEffect, useId, useLayoutEffect, useRef, type ComponentProps, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { usePlatform, type Platform } from "@/registry/imessage/platform";
import { bubbleMetrics, fontStack, type Direction, type Service } from "@/registry/imessage/tokens";
import { bodyClipPath, tailBox, tailPath, tailSeamOverlap } from "@/registry/imessage/bubble-shape";

/**
 * Edit a sent message in place, and undo sending one.
 *
 * MEASURED, and only this: the macOS context menu's **Edit** row, traced off
 * `references/macos/captures/ctxmenu-with-edit-light-2x.png` (2x; the menu's top border is device row
 * 9 and its trailing border device column 604, so the menu is 302.5 wide and every number below is in
 * points from its top-left). The row is its own separated block between "Attach Sticker…" and
 * "Forward…": separator lines at 158.75 and 193.75, an 11 pt separator block each, so the row spans
 * 164.25 to 188.25 and its centre is 176.25 down, on the menu's own 24 pt row pitch. Label "Edit",
 * no ellipsis, 13 pt, ink left edge 41.75 in from the leading edge like every other row. Icon is
 * SF Symbol `pencil`: ink 8.5 x 8.5, centred 25.5 in from the leading edge and on the row's centre
 * (device box x 42-58, y 354-370). Cross-checked against the same capture's other rows, which land on
 * the same model: Attach Sticker… centre 141.25, Forward… 211.25, both within 0.25 of their ink.
 *
 * That row is data in `context-menu.tsx` (`macosMessageMenu`, `MenuIconName`), which does not carry it
 * yet. `canEdit` below is the gate for showing it.
 *
 * NOT MEASURED: everything else in this file. No capture shows the editor, a caret or a selection
 * inside a balloon, or the undo-send removal. So the editable bubble is the measured bubble (same
 * metrics, clip, seam overlap and screen-space fill as `message-bubble.tsx`), the "Edited" label is
 * the measured status label in the measured edited blue, and the behaviour follows Apple's documented
 * rules: 15 minutes and five edits, an "Edited" label with its history, Undo Send for two minutes.
 */
export const editWindowMs = 15 * 60 * 1000;
export const undoSendWindowMs = 2 * 60 * 1000;
export const maxEdits = 5;

export function canEdit(sentAt: Date | number, edits = 0, now: Date | number = Date.now()): boolean {
  return edits < maxEdits && +now - +sentAt <= editWindowMs;
}
export function canUndoSend(sentAt: Date | number, now: Date | number = Date.now()): boolean {
  return +now - +sentAt <= undoSendWindowMs;
}

/**
 * Text selection inside the field. UNVERIFIED: no capture shows a selection in a balloon. These are
 * the measured colours Messages paints over a *selected balloon* (SPEC "Selected outgoing bubble
 * (flat)", "Selected incoming bubble (flat)", "Selected SMS green bubble"), the only measured
 * selection colours that sit on a bubble. The values repeat `selectionOverlayClass` in
 * `message-bubble.tsx` instead of importing it because message-edit does not depend on message-bubble
 * in the registry; if one moves, move both.
 */
export const editSelectionClass =
  "[--im-edit-sel-blue:#1b60d8] [--im-edit-sel-gray:#c6c6c7] [--im-edit-sel-green:#0a0a7833] " +
  "dark:[--im-edit-sel-blue:#0b50c8] dark:[--im-edit-sel-gray:#55555c]";

export type EditableBubbleProps = Omit<ComponentProps<"div">, "onSubmit" | "children"> & {
  value: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
  direction?: Direction;
  service?: Service;
  tail?: boolean;
  /**
   * Screen-space y of the body's bottom edge, in px, for the measured position-dependent fill. The
   * shared sweep in `use-screen-space.ts` only visits `[data-slot="message-bubble"]`, so a bubble
   * being edited inside a scrolling list has to be given this.
   */
  screenBottom?: number;
  /** Widest the bubble may grow. Defaults to the same native rule `MessageBubble` uses. */
  maxWidth?: number | string;
  platform?: Platform;
  autoFocus?: boolean;
};

/**
 * The bubble turned into a field. Return commits, Escape cancels, and the bubble keeps the measured
 * shape, padding, line box and fill while editing so nothing shifts.
 */
export function EditableBubble({
  value, onChange, onSubmit, onCancel, direction = "outgoing", service = "imessage", tail = false,
  screenBottom, maxWidth, platform: platformProp, autoFocus = true, className, style, onKeyDown, ...props
}: EditableBubbleProps) {
  const contextPlatform = usePlatform();
  const platform = platformProp ?? contextPlatform;
  const m = bubbleMetrics[platform];
  const outgoing = direction === "outgoing";
  const side = outgoing ? "right" : "left";
  const field = useRef<HTMLTextAreaElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const sizer = useRef<HTMLSpanElement>(null);
  const composing = useRef(false);
  const hintId = useId();
  const hang = tailBox.hang * m.tailScale;
  const key = direction === "incoming" ? "gray" : service === "sms" ? "green" : "blue";
  const ink = outgoing ? "var(--im-outgoing-text)" : "var(--im-incoming-text)";

  // One gradient in screen coordinates, anchored to the body's bottom, exactly as MessageBubble does
  // it: the tail hangs `hang` lower, so it needs its own background-position or its fill steps out of
  // register with the body's.
  const bottomVar = screenBottom === undefined ? "var(--bubble-bottom, calc(var(--im-screen-h) * 0.55))" : `${screenBottom}px`;
  const fill: CSSProperties = {
    backgroundImage: "linear-gradient(var(--im-fill-top), var(--im-fill-bottom))",
    backgroundSize: "100% var(--im-screen-h)",
    backgroundRepeat: "no-repeat",
    backgroundColor: "var(--im-fill-bottom)",
  };
  const bodyFill: CSSProperties = { ...fill, backgroundPosition: `0 calc(100% + (var(--im-screen-h) - ${bottomVar}))` };
  const tailFill: CSSProperties = { ...fill, backgroundPosition: `0 calc(100% + (var(--im-screen-h) - ${bottomVar} - ${hang}px))` };

  useEffect(() => {
    if (!autoFocus) return;
    const element = field.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, [autoFocus]);

  // MessageBubble's `useNativeTextFit`, run against a hidden mirror of the value: native hugs the
  // longest wrapped line, a textarea has no text node to range over, and `field-sizing: content`
  // stretches to the wrap width instead. Without it an iOS bubble jumped from 250.73 to 280.5 the
  // moment it became editable (measured on /lab/reply, "Every detail, down to the last bubble.").
  useLayoutEffect(() => {
    const frameEl = frame.current, textEl = sizer.current, fieldEl = field.current;
    if (!frameEl || !textEl || !fieldEl) return;
    const container = frameEl.parentElement;
    let raf = 0;
    const measure = () => {
      frameEl.style.width = "";
      const range = document.createRange();
      range.selectNodeContents(textEl);
      const lines: Array<{ top: number; left: number; right: number }> = [];
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width === 0 && rect.height === 0) continue;
        const line = lines.find(l => Math.abs(l.top - rect.top) < 1);
        if (line) { line.left = Math.min(line.left, rect.left); line.right = Math.max(line.right, rect.right); }
        else lines.push({ top: rect.top, left: rect.left, right: rect.right });
      }
      if (!lines.length) return;
      const longest = Math.max(...lines.map(l => l.right - l.left));
      fieldEl.style.textAlign = lines.length === 1 && longest < m.minWidth - 2 * m.paddingX ? "center" : "";
      const hug = Math.ceil((longest + 2 * m.paddingX) * 100) / 100 + 0.05;
      if (lines.length > 1 && hug < frameEl.getBoundingClientRect().width - 0.1) frameEl.style.width = `${hug}px`;
    };
    measure();
    const observer = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });
    if (container) observer.observe(container);
    document.fonts?.ready.then(() => measure()).catch(() => {});
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [value, m.paddingX, m.minWidth, platform, maxWidth]);

  return (
    // Escape is handled on the root, not the field, so it still cancels while focus is on Cancel or
    // Done. Return stays on the field: on a button it means "press this button".
    <div data-slot="editable-bubble" data-direction={direction} role="group" aria-label="Edit message"
      className={cn("flex w-full min-w-0 flex-col", editSelectionClass, outgoing ? "items-end" : "items-start", className)}
      style={{
        fontFamily: fontStack,
        ...(screenBottom === undefined ? {} : { ["--bubble-bottom" as string]: `${screenBottom}px` }),
        ["--im-fill-top" as string]: `var(--im-${key}-top)`,
        ["--im-fill-bottom" as string]: `var(--im-${key}-bottom)`,
        ["--im-edit-sel" as string]: `var(--im-edit-sel-${key})`,
        ...style,
      } as CSSProperties}
      onKeyDown={event => {
        if (event.key === "Escape" && onCancel) { event.preventDefault(); event.stopPropagation(); onCancel(); }
        onKeyDown?.(event);
      }}
      {...props}>
      <div ref={frame} data-slot="bubble-frame" className="relative max-w-full" style={{ maxWidth: maxWidth ?? (platform === "ios" ? m.maxWidth : `${m.maxWidthRatio * 100}%`) }}>
        <div data-slot="bubble" className="relative" style={{ padding: `${m.paddingY}px ${m.paddingX}px`, minWidth: m.minWidth }}>
          {/* The fill lives behind the text so clipping the tail corner never clips glyphs. */}
          <div aria-hidden="true" data-slot="fill" className="pointer-events-none absolute inset-0"
            style={{ borderRadius: m.radius, clipPath: tail ? bodyClipPath(side, m.tailScale, tailSeamOverlap[platform]) : undefined, ...bodyFill }} />
          {tail && <div aria-hidden="true" data-slot="tail" className="pointer-events-none absolute" style={{
            [side]: 0, bottom: -hang, width: tailBox.width * m.tailScale, height: tailBox.height * m.tailScale + hang,
            clipPath: `path("${tailPath(side, m.tailScale)}")`, ...tailFill,
          }} />}
          <textarea ref={field} data-slot="edit-field" aria-label="Message" aria-describedby={hintId} value={value} rows={1}
            onChange={event => onChange?.(event.target.value)}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !composing.current) {
                event.preventDefault();
                onSubmit?.(value.trim());
              }
            }}
            className="relative block w-full resize-none border-0 bg-transparent outline-none [field-sizing:content] [overflow-wrap:anywhere] selection:bg-[var(--im-edit-sel)]"
            style={{
              margin: 0, padding: 0, boxSizing: "border-box", fontFamily: "inherit",
              fontSize: m.fontSize, lineHeight: `${m.lineHeight}px`, letterSpacing: m.letterSpacing,
              // UNVERIFIED: no capture shows the caret in a balloon. It takes the bubble's measured
              // text colour, which is the only ink colour measured inside a bubble.
              color: ink, caretColor: ink,
            }} />
          {/* Laid out at the field's own content width, never painted; only the hug measures it. */}
          <span ref={sizer} aria-hidden="true" data-slot="edit-sizer"
            className="pointer-events-none invisible absolute whitespace-pre-wrap [overflow-wrap:anywhere]"
            style={{ top: m.paddingY, left: m.paddingX, right: m.paddingX, fontSize: m.fontSize, lineHeight: `${m.lineHeight}px`, letterSpacing: m.letterSpacing }}>{value}</span>
          <span id={hintId} className="sr-only">Return saves the edit. Escape cancels it.</span>
        </div>
      </div>
      {/*
        UNVERIFIED: native shows no Cancel/Done pair, so the row is sized and placed from the measured
        status label (same type, same gap under the body, same inset) rather than from a new number.
      */}
      <div className="flex items-center gap-3" style={{
        fontSize: m.statusFontSize, lineHeight: `${m.statusLineHeight}px`, letterSpacing: m.statusLetterSpacing,
        fontWeight: 600, marginTop: m.statusGap,
        paddingInlineEnd: outgoing ? m.statusInset : 0, paddingInlineStart: outgoing ? 0 : m.statusInset,
      }}>
        <button type="button" data-slot="edit-cancel" aria-label="Cancel editing" onClick={onCancel} style={{ color: "var(--im-secondary)" }}>Cancel</button>
        <button type="button" data-slot="edit-done" aria-label="Done editing" onClick={() => onSubmit?.(value.trim())} style={{ color: "var(--im-edited)" }}>Done</button>
      </div>
    </div>
  );
}

/**
 * "Edited" under a message, and the edit history an app can show when it is tapped.
 *
 * The label's own geometry is not captured, so it reuses the measured status label ("Delivered"):
 * 11/13 semibold at a 4.65 gap and a 19.3 inset on iOS, 9/11 semibold at 4 and 15.9 on macOS, in the
 * measured `--im-edited` blue. `MessageBubble`'s own inline `edited` span still hardcodes the iOS
 * 11/13 and a 14 inset on both platforms; the two disagree on macOS.
 */
export function EditedLabel({ onShowHistory, direction = "outgoing", platform: platformProp, className, style, ...props }: Omit<ComponentProps<"button">, "children"> & { onShowHistory?: () => void; direction?: Direction; platform?: Platform }) {
  const contextPlatform = usePlatform();
  const platform = platformProp ?? contextPlatform;
  const m = bubbleMetrics[platform];
  const outgoing = direction === "outgoing";
  return (
    // Without a history handler the label is text, so it is disabled rather than an empty tab stop.
    <button type="button" data-slot="edited" onClick={onShowHistory} disabled={!onShowHistory}
      aria-label={onShowHistory ? "Edited. Show edit history." : undefined}
      className={cn("underline-offset-2", onShowHistory && "hover:underline", className)}
      style={{
        fontFamily: fontStack,
        fontSize: m.statusFontSize, lineHeight: `${m.statusLineHeight}px`, letterSpacing: m.statusLetterSpacing,
        fontWeight: 600, marginTop: m.statusGap,
        paddingInlineEnd: outgoing ? m.statusInset : 0, paddingInlineStart: outgoing ? 0 : m.statusInset,
        color: "var(--im-edited)",
        ...style,
      }} {...props}>
      Edited
    </button>
  );
}

/**
 * Undo Send timing. UNVERIFIED: nothing here is read off a capture, so it is one named table the
 * harness and the tests can seek rather than numbers spread through the keyframes.
 */
export const undoSendPoof = {
  duration: 420,
  /** prefers-reduced-motion: the same removal as a plain cross fade, no scale and no blur. */
  reducedDuration: 180,
  /** The bubble swells before it collapses. `offset` is a fraction of the timeline, so `progress` hits it. */
  swell: { offset: 0.35, scale: 1.06, opacity: 0.9 },
  endScale: 0.2,
  blur: 6,
  /** Per-segment, not on the effect: see the keyframes below. */
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type UndoSendPoofProps = ComponentProps<"div"> & {
  running?: boolean;
  /** 0..1: pause the poof and seek it to that fraction instead of playing it. */
  progress?: number;
  /** Fires when the bubble is gone, which is when the app should drop the message. */
  onDone?: () => void;
};

/**
 * Undo Send: the bubble swells, collapses and blurs away. Built on the Web Animations API with one
 * animation on one element, so `document.getAnimations()` reaches it and `progress` seeks it to the
 * same frame every run. A seeked poof never reports the message as gone: only a played one calls
 * `onDone`, and it calls it once.
 */
export function UndoSendPoof({ children, running = true, progress, onDone, className, style, ...props }: UndoSendPoofProps) {
  const host = useRef<HTMLDivElement>(null);
  const finished = useRef(onDone);
  useEffect(() => { finished.current = onDone; }, [onDone]);
  useEffect(() => {
    const element = host.current;
    if (!element || !running) return;
    const reduced = prefersReducedMotion();
    const duration = reduced ? undoSendPoof.reducedDuration : undoSendPoof.duration;
    // The easing sits on the keyframes, not on the effect: an effect-level easing warps the whole
    // iteration, so `swell.offset` would no longer be the fraction of the timeline the swell happens
    // at and `progress` would not map linearly onto it. Measured at 0.35 with the easing on the
    // effect, the frame was already past the swell (scale 0.862); on the keyframes it is scale 1.06.
    const frames: Keyframe[] = reduced
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
        { offset: 0, transform: "scale(1)", opacity: 1, filter: "blur(0px)", easing: undoSendPoof.easing },
        { offset: undoSendPoof.swell.offset, transform: `scale(${undoSendPoof.swell.scale})`, opacity: undoSendPoof.swell.opacity, filter: "blur(0px)", easing: undoSendPoof.easing },
        { offset: 1, transform: `scale(${undoSendPoof.endScale})`, opacity: 0, filter: `blur(${undoSendPoof.blur}px)` },
      ];
    const animation = element.animate(frames, { duration, easing: "linear", fill: "both" });
    if (progress !== undefined) {
      // Seeked, not played: a scrubbed checkpoint has to land on the same frame every run.
      animation.pause();
      animation.currentTime = Math.max(0, Math.min(1, progress)) * duration;
      return () => animation.cancel();
    }
    // `finish` rather than the `finished` promise: it fires once, it never fires on a cancel, and the
    // cleanup below takes the animation's fill off the element on the way out.
    const done = () => finished.current?.();
    animation.addEventListener("finish", done);
    return () => { animation.removeEventListener("finish", done); animation.cancel(); };
  }, [running, progress]);
  return (
    <div ref={host} data-slot="undo-send"
      data-state={running ? (progress === undefined ? "running" : "seeking") : "idle"}
      data-progress={progress === undefined ? undefined : Math.max(0, Math.min(1, progress)).toFixed(3)}
      className={cn("origin-center", running && "pointer-events-none", className)} style={style} {...props}>
      {children}
    </div>
  );
}

/** Countdown an app can show while Undo Send is still possible. */
export function undoSendRemaining(sentAt: Date | number, now: Date | number = Date.now()): number {
  return Math.max(0, undoSendWindowMs - (+now - +sentAt));
}
