"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { MessageBubble } from "@/registry/imessage/message-bubble";
import { PlatformProvider, type Platform } from "@/registry/imessage/platform";
import { bubbleMetrics, palettes, paletteVars } from "@/registry/imessage/tokens";
import { balloonSlot, Tapback, tapbackVars } from "@/registry/imessage/tapback";
import { TapbackDetailsPlatter, tapbackDetailsPlatterMetrics, type TapbackReactor } from "@/registry/imessage/tapback-details";

type Item = { id: string; text: string; tail?: boolean; status?: string; group?: "new" };

/** The same fixture as `references/ios/captures/conv3-light.png`, which every tapback capture uses. */
const conv3: Item[] = [
  { id: "aaaa", text: "Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", tail: true },
  { id: "v1", text: "V", group: "new" },
  { id: "v2", text: "V" },
  { id: "v3", text: "V", tail: true },
  { id: "details", text: "It’s all in the little details. ✨ A longer message should wrap naturally without stretching the conversation.", tail: true, group: "new" },
  { id: "ok", text: "Ok", group: "new" },
  { id: "every", text: "Every detail, down to the last bubble.", tail: true, status: "Delivered" },
];

const macPane: Item[] = [
  { id: "first", text: "First of two, sent back to back", tail: true },
  { id: "second", text: "Second of two" },
  { id: "third", text: "Text right before a link" },
];

/** See `app/lab/tapback/scene.tsx`: native's first body top in this thread is y 205.00 exactly. */
const IOS_FIRST_BODY_TOP = 205;
/** The macOS crop starts 28 pt below the window origin the bubble gradient is anchored to. */
const MACOS_PANE_OFFSET = 28;

/** Fixture people only. The two numbers are the simulator's own sample contacts, as everywhere else. */
const one: TapbackReactor[] = [
  { id: "kb", name: "Kate Bishop", initials: "KB", reaction: "love" },
];
const few: TapbackReactor[] = [
  { id: "kb", name: "Kate Bishop", initials: "KB", reaction: "love" },
  { id: "ja", name: "Jack Aubrey", initials: "JA", reaction: "like" },
  { id: "me", name: "Ben", initials: "B", reaction: "love", own: true },
];
const many: TapbackReactor[] = [
  { id: "kb", name: "Kate Bishop", initials: "KB", reaction: "love" },
  { id: "ja", name: "Jack Aubrey", initials: "JA", reaction: "like" },
  { id: "sm", name: "Stephen Maturin", initials: "SM", reaction: "laugh" },
  { id: "aw", name: "Ada Wong", initials: "AW", reaction: "emphasize" },
  { id: "bp", name: "Barbara Pym", initials: "BP", reaction: "question" },
  { id: "cd", name: "Cyrus Dane", initials: "CD", reaction: "dislike" },
  { id: "em", name: "Elin Marsh", initials: "EM", emoji: "🎉" },
  { id: "me", name: "Ben", initials: "B", reaction: "love", own: true },
];

type SceneSpec = {
  platform: Platform;
  width: number; height: number;
  reactors: TapbackReactor[];
  /** No transcript behind it: the platter alone on the ground, for measuring. */
  bare?: boolean;
  /** Where the platter's box goes, in the frame's own coordinates. */
  top?: number;
  left?: number;
};

const scenes: Record<string, SceneSpec> = {
  // The "Ok" bubble carries the balloon in every tapback capture; the platter opens at its own top,
  // which is measured off the rendered balloon rather than typed in, so it stays ChatKit's own rule.
  ios: { platform: "ios", width: 402, height: 874, reactors: few },
  "ios-many": { platform: "ios", width: 402, height: 874, reactors: many },
  "ios-one": { platform: "ios", width: 402, height: 874, reactors: one },
  macos: { platform: "macos", width: 630, height: 470, reactors: few, left: 24 },
  platter: { platform: "ios", width: 402, height: 120, reactors: few, bare: true, top: 8 },
  "platter-macos": { platform: "macos", width: 560, height: 120, reactors: few, bare: true, top: 6 },
  "platter-many": { platform: "ios", width: 402, height: 120, reactors: many, bare: true, top: 8 },
};

export function TapbackDetailsLabScene({ scene, theme, filter, progress }: { scene: string; theme: "light" | "dark"; filter: string | null; progress?: number }) {
  const spec = scenes[scene] ?? scenes.ios;
  const platform = spec.platform;
  const m = bubbleMetrics[platform];
  const metrics = tapbackDetailsPlatterMetrics[platform];
  const vars = { ...paletteVars(palettes[platform][theme]), ...tapbackVars(theme, platform) } as CSSProperties;
  const items = platform === "ios" ? conv3 : macPane;
  const slot = balloonSlot[platform];
  const [held, setHeld] = useState<string | null>(filter);
  const frame = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<number | null>(null);

  /**
   * ChatKit's own placement: `-[CKFullScreenBalloonViewControllerPhone votingViewTargetFrame]` returns
   * y = max(`attributionViewMinPadding`, the tapback's own frame origin y). So the lab reads the
   * balloon's rendered top rather than typing a number in.
   */
  useLayoutEffect(() => {
    if (spec.bare || spec.top !== undefined) return;
    const box = frame.current;
    const balloon = box?.querySelector('[data-slot="tapback"]');
    if (!box || !balloon) return;
    setAnchor(balloon.getBoundingClientRect().top - box.getBoundingClientRect().top);
  }, [spec.bare, spec.top, scene]);

  return (
    <PlatformProvider platform={platform}>
      <div ref={frame} data-testid="lab" className={theme}
        style={{ ...vars, width: spec.width, height: spec.height, position: "relative", overflow: "hidden", background: spec.bare && theme === "dark" ? "#000000" : spec.bare ? "#ffffff" : "var(--im-bg)" }}>
        {/* The macOS scene is not diffing a pane capture — none of this platter exists — so its
            transcript just sits where a pane's first cluster does, MACOS_PANE_OFFSET below the
            window origin the bubble gradient is anchored to. */}
        {!spec.bare && (
          <div style={{ position: "absolute", top: platform === "ios" ? IOS_FIRST_BODY_TOP : MACOS_PANE_OFFSET, left: 0, right: m.edgeInset, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            {items.map((item, index) => (
              <MessageBubble key={item.id} direction="outgoing" service={platform === "ios" ? "sms" : "imessage"} tail={item.tail ?? false} status={item.status}
                maxWidth={platform === "macos" ? m.maxWidth : undefined}
                reactions={item.id === (platform === "ios" ? "ok" : "second") ? <Tapback reaction="love" own side="left" count={spec.reactors.length} /> : undefined}
                style={{ width: "100%", marginTop: index === 0 ? 0 : item.group === "new" ? m.gapBetweenGroups : m.gapInGroup }}>
                {item.text}
              </MessageBubble>
            ))}
          </div>
        )}
        {/* `top` is ChatKit's own placement rule: max(minPadding, the tapback's own frame origin y). */}
        <TapbackDetailsPlatter
          reactors={spec.reactors}
          platform={platform}
          modal={platform === "ios" && !spec.bare}
          top={Math.max(metrics.minPadding, spec.top ?? anchor ?? metrics.minPadding)}
          left={spec.left}
          filter={held}
          onFilterChange={setHeld}
          onRemove={() => {}}
          onClose={() => {}}
          progress={progress ?? 1}
          autoFocus={false}
        />
        {/* Keeps the balloon slot honest when the fixture carries one. */}
        <span hidden>{slot.marginTop}</span>
      </div>
    </PlatformProvider>
  );
}
