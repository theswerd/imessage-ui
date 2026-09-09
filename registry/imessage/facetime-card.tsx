"use client";

import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { usePlatform, type Platform } from "@/registry/imessage/platform";
import { fontStack } from "@/registry/imessage/tokens";

/**
 * A FaceTime link shared into a conversation, and the call states an app may want to show around it.
 *
 * Messages does not render a live call inline: an active FaceTime call lives in its own window, and
 * call history lives in the Phone and FaceTime apps. What genuinely appears in a transcript is a
 * FaceTime *link* card, which SPEC.md records as "the same gray card as a link preview".
 *
 * **No capture in this repo shows a FaceTime card, in either state.** Nothing below was measured off
 * one. What the card does inherit is the link card's own measured geometry, so that "the same gray
 * card" is true of the pixels and not only of the prose (`references/macos/captures/conversation-pane-light.png`,
 * via `link-preview.tsx`): the fill #e9e9eb light / #3b3b3d dark, the 14 radius, the 10 side padding,
 * and the caption at 10pt on a 12pt pitch in #808084 / #a6a6a9. iOS takes the same parts from the
 * numbers iOS itself measures, exactly as `link-preview.tsx` does: the 19 bubble radius, the 280.5
 * widest bubble, the incoming gray, and the secondary label. Everything else here is invented: the
 * icon, the greens and the red, the button, and every gap. The four states other than `invitation`
 * are app surfaces, not reproductions of a native element. Do not quote any of it as measured.
 */
export type FaceTimeState = "invitation" | "ringing" | "connected" | "ended" | "missed";

type Metrics = { width: number; radius: number; padX: number; padY: number; icon: number; iconRadius: number; title: number; titleLine: number; sub: number; subLine: number; gap: number; button: number; buttonText: number; rowGap: number };

const metrics: Record<Platform, Metrics> = {
  ios: { width: 280.5, radius: 19, padX: 14, padY: 12, icon: 44, iconRadius: 11, title: 17, titleLine: 20, sub: 14, subLine: 17, gap: 11, button: 36, buttonText: 15, rowGap: 12 },
  macos: { width: 240, radius: 14, padX: 10, padY: 10, icon: 34, iconRadius: 8.5, title: 13, titleLine: 16, sub: 10, subLine: 12, gap: 9, button: 28, buttonText: 12, rowGap: 9 },
};

/**
 * The link card's fill and caption colour, copied from `link-preview.tsx` so the two cards match.
 * macOS is measured off the apple.com card; iOS swaps in its own measured incoming gray and secondary
 * label, because #3b3b3d is the macOS gray and reads wrong beside iOS bubbles.
 */
const cardVars: Record<Platform, string> = {
  macos: "[--im-card:#e9e9eb] [--im-card-fg:#808084] [--im-card-title:#000000] dark:[--im-card:#3b3b3d] dark:[--im-card-fg:#a6a6a9] dark:[--im-card-title:#ffffff]",
  ios: "[--im-card:#e9e9eb] [--im-card-fg:#8a8a8e] [--im-card-title:#000000] dark:[--im-card:#262629] dark:[--im-card-fg:#8d8d93] dark:[--im-card-title:#ffffff]",
};

/** Unverified: no capture holds a FaceTime card, so these are the system colours, not measured ones. */
const facetimeGreen = "#30c653";
const missedRed = "#ff453a";

function VideoGlyph({ size }: { size: number }) {
  // SF Symbol "video.fill": a rounded rectangle body with a wedge lens on the trailing side.
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="8" width="15" height="12" rx="3.6" fill="currentColor" />
      <path d="M19.4 12.6 23.4 9.9c.7-.5 1.6 0 1.6.8v6.6c0 .8-.9 1.3-1.6.8l-4-2.7z" fill="currentColor" />
    </svg>
  );
}

export type FaceTimeCardProps = Omit<ComponentProps<"div">, "children"> & {
  state?: FaceTimeState;
  /** Shown while connected, e.g. "12:04". */
  duration?: string;
  /** Line under the title. Defaults to a sensible label for the state. */
  caption?: string;
  onJoin?: () => void;
  onEnd?: () => void;
  platform?: Platform;
};

export function FaceTimeCard({ state = "invitation", duration = "00:00", caption, onJoin, onEnd, platform: platformProp, className, style, ...props }: FaceTimeCardProps) {
  const contextPlatform = usePlatform();
  const platform = platformProp ?? contextPlatform;
  const m = metrics[platform];
  const active = state === "connected" || state === "ringing";
  const missed = state === "missed";
  const label = caption ?? (state === "invitation" ? "FaceTime Link" : state === "ringing" ? "Calling" : state === "connected" ? duration : missed ? "Missed FaceTime" : "FaceTime ended");
  const action = active ? onEnd : onJoin;
  const actionLabel = active ? "Leave" : state === "invitation" ? "Join" : "Call Back";
  // The button's visible word is one syllable; out of context it needs to say what it calls.
  const actionName = active ? "Leave the FaceTime call" : state === "invitation" ? "Join the FaceTime call" : "Call back on FaceTime";
  const card: CSSProperties = {
    width: m.width, maxWidth: "100%", borderRadius: m.radius, padding: `${m.padY}px ${m.padX}px`,
    background: "var(--im-card)", color: "var(--im-card-title)", fontFamily: fontStack,
  };
  return (
    <div data-slot="facetime-card" data-call-state={state} data-platform={platform} className={cn("select-none", cardVars[platform], className)} style={{ ...card, ...style }} {...props}>
      <div className="flex items-center" style={{ gap: m.gap }}>
        <span aria-hidden="true" className="flex shrink-0 items-center justify-center text-white"
          style={{ width: m.icon, height: m.icon, borderRadius: m.iconRadius, background: missed ? missedRed : facetimeGreen }}>
          <VideoGlyph size={m.icon * 0.62} />
        </span>
        <span className="min-w-0">
          <span className="block truncate" style={{ fontSize: m.title, lineHeight: `${m.titleLine}px`, fontWeight: 600 }}>FaceTime</span>
          {/* A live region only while the call is one: "FaceTime Link" is a caption, not an update. */}
          <span role={state === "invitation" ? undefined : "status"} className="block truncate" style={{ fontSize: m.sub, lineHeight: `${m.subLine}px`, color: "var(--im-card-fg)" }}>{label}</span>
        </span>
      </div>
      {action && (
        <button type="button" onClick={action} aria-label={actionName}
          className="flex w-full items-center justify-center font-semibold text-white transition-[filter] active:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088ff]"
          style={{ marginTop: m.rowGap, height: m.button, borderRadius: m.button / 2, fontSize: m.buttonText, background: active ? missedRed : facetimeGreen }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
