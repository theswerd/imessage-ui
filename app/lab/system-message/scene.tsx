"use client";

import type { CSSProperties } from "react";
import { PlatformProvider, type Platform } from "@/registry/imessage/platform";
import { palettes, paletteVars } from "@/registry/imessage/tokens";
import { SystemMessage, systemMessageMetrics, type SystemMessageEvent } from "@/registry/imessage/system-message";

/**
 * The bottom edge of the last incoming bubble's body in `references/ios/captures/incoming-light.png`,
 * measured for this lab: scanning every row for non-white ink, the body's full-width run ends after
 * device row 2108 and only the tail survives into 2109 (n falls 173 -> 34). 2108/3 = 702.6667, which
 * is the number `ios-notices.tsx` already records.
 *
 * The notice's spacing is expressed *from* that edge, so `scene=notice` reproduces the capture with
 * one spacer instead of the seven bubbles above it: the band being diffed (y 712-752) holds nothing
 * but the two lines of grey text.
 */
export const incomingBodyBottom = 702.6667;

const groupEvents: SystemMessageEvent[] = [
  { type: "conversationNamed", name: "Design Crew" },
  { type: "participantAdded", actor: "Alex Morgan", participant: "Sam Rivera" },
  { type: "participantRemoved", participant: "Sam Rivera" },
  { type: "participantLeft", actor: "Alex Morgan" },
  { type: "groupPhotoChanged", actor: "Alex Morgan" },
  { type: "groupPhotoRemoved", actor: null },
  { type: "backgroundChanged" },
  { type: "messageUnsent", actor: "Alex Morgan" },
  { type: "phoneNumberChanged", actor: "Alex Morgan" },
  { type: "messageKept", actor: "Alex Morgan", what: "a photo", from: "Sam Rivera" },
  { type: "addFailed", participant: "Sam Rivera" },
  { type: "removeFailed", participant: "Sam Rivera" },
  { type: "unknownSender" },
];

export type SystemMessageSceneName = "notice" | "family" | "run";

export function SystemMessageScene({
  scene, theme, platform, progress, letterSpacing, gapAbove,
}: { scene: SystemMessageSceneName; theme: "light" | "dark"; platform: Platform; progress?: number; letterSpacing?: number; gapAbove?: number }) {
  const vars = paletteVars(palettes[platform][theme]) as CSSProperties;
  const size = platform === "ios" ? { width: 402, height: 874 } : { width: 960, height: 640 };
  const m = systemMessageMetrics[platform];
  const frame: CSSProperties = { ...vars, ...size, position: "relative", overflow: "hidden", background: "var(--im-bg)" };
  // Fitting aids, so the tracking and the space above can be re-fitted against a capture without
  // editing the component: `&ls=0.11&gap=13.17`. Both are off unless the query names them.
  const tuning = letterSpacing === undefined ? null : (
    // `!important`, because the component sets the tracking inline and an inline style wins.
    <style>{`[data-slot="system-message-text"]{letter-spacing:${letterSpacing}px !important}`}</style>
  );

  // `scene=notice` is the one that reconstructs a capture: the notice sits under a spacer whose
  // bottom edge is the measured body bottom, so `compare.ts <url> incoming-light.png 3 402 874 <out>
  // 0 712 402 40` diffs our two lines of text against native's.
  if (scene === "notice") {
    return (
      <PlatformProvider platform={platform}>
        <div data-testid="lab" className={theme} style={frame}>
          {tuning}
          {/* Flex, so the line's own top margin cannot collapse into this box and move the ink. */}
          <div style={{ position: "absolute", top: incomingBodyBottom, left: 0, right: 0, display: "flex", flexDirection: "column" }}>
            <SystemMessage event={{ type: "unknownSender" }} platform={platform} gapAbove={gapAbove} />
          </div>
        </div>
      </PlatformProvider>
    );
  }

  // `scene=run` is the double-gap check: three consecutive lines. The gaps are margins, so the space
  // between two of them is one gap, not the sum of a bottom and a top padding.
  if (scene === "run") {
    return (
      <PlatformProvider platform={platform}>
        <div data-testid="lab" className={theme} style={frame}>
          <div style={{ position: "absolute", top: 120, left: 0, right: 0, display: "flex", flexDirection: "column" }}>
            <SystemMessage event={{ type: "conversationNamed", name: "Design Crew" }} platform={platform} animateIn={progress === undefined ? undefined : { progress }} />
            <SystemMessage event={{ type: "participantAdded", actor: "Alex Morgan", participant: "Sam Rivera" }} platform={platform} animateIn={progress === undefined ? undefined : { progress }} />
            <SystemMessage event={{ type: "participantLeft" }} platform={platform} animateIn={progress === undefined ? undefined : { progress }} />
          </div>
          {/* The measured spacing, so a screenshot can be read with a ruler rather than guessed at. */}
          <div data-testid="metrics" style={{ position: "absolute", bottom: 8, left: 8, fontSize: 10, color: "var(--im-secondary)" }}>
            gapAbove {m.gapAbove} · padTop {m.padTop} · padBottom {m.padBottom} · {m.fontSize}/{m.lineHeight} · tracking {m.letterSpacing}
          </div>
        </div>
      </PlatformProvider>
    );
  }

  return (
    <PlatformProvider platform={platform}>
      <div data-testid="lab" className={theme} style={{ ...vars, width: size.width, position: "relative", background: "var(--im-bg)", paddingBlock: 24 }}>
        {groupEvents.map((event, index) => (
          <SystemMessage key={index} event={event} platform={platform} animateIn={progress === undefined ? undefined : { progress }} />
        ))}
      </div>
    </PlatformProvider>
  );
}
