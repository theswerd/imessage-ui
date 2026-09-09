"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useBubbleScreenSpace } from "@/registry/imessage/use-screen-space";
import { MessageBubble } from "@/registry/imessage/message-bubble";
import { PlatformProvider, type Platform } from "@/registry/imessage/platform";
import { bubbleMetrics, palettes, paletteVars } from "@/registry/imessage/tokens";
import { balloonSlot, Tapback, tapbackVars } from "@/registry/imessage/tapback";
import { TapbackBar } from "@/registry/imessage/tapback-bar";
import { ContextMenu, macosMessageMenu } from "@/registry/imessage/context-menu";
import { MessageActions, type Rect } from "@/registry/imessage/message-actions";

type Item = { id: string; text: string; tail?: boolean; status?: string; group?: "new" };

/** Same fixture as `references/ios/captures/conv3-light.png`; the balloon and long-press captures share it. */
const conv3: Item[] = [
  { id: "aaaa", text: "Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", tail: true },
  { id: "v1", text: "V", group: "new" },
  { id: "v2", text: "V" },
  { id: "v3", text: "V", tail: true },
  { id: "details", text: "It’s all in the little details. ✨ A longer message should wrap naturally without stretching the conversation.", tail: true, group: "new" },
  { id: "ok", text: "Ok", group: "new" },
  { id: "every", text: "Every detail, down to the last bubble.", tail: true, status: "Delivered" },
];
/** The captures with a trailing "Hi there" (`longpress-last-bubble-dark.png`, `incoming-*.png`, `longpress-incoming-light.png`). */
const conv3Hi: Item[] = [...conv3.slice(0, 6), { id: "every", text: "Every detail, down to the last bubble.", tail: true }, { id: "hi", text: "Hi there", tail: true, group: "new", status: "Delivered" }];
/** The macOS pane fixture (`references/macos/captures/tapback-love-*-2x.png`, cropped to the pane's right 260 pt). */
const macPane: Item[] = [
  { id: "first", text: "First of two, sent back to back", tail: true },
  { id: "second", text: "Second of two" },
  { id: "third", text: "Text right before a link" },
];

type SceneSpec = {
  items: Item[]; direction: "incoming" | "outgoing"; top: number; balloon?: string; press?: string;
  /** Show the picker's selected state and the tapback-details popover (re-opening your own reaction). */
  selected?: boolean;
};
/**
 * Native's first body top in this thread, measured sub-pixel: the fill's edge lands on device row 615
 * at 3x, i.e. y 205.00 exactly, in `conv3-light.png`, `conv4-light.png`, `grouped-light.png`,
 * `sent-1-light.png` and `conv2-dark.png` alike. The app reaches the same place through
 * `iosScreen.listTop` plus the opening date header; this lab has no header, so it states the number.
 * The 205.33 it used to carry was a third of a point low and every bubble below inherited it.
 */
const IOS_FIRST_BODY_TOP = 205;

const scenes: Record<string, SceneSpec> = {
  balloon: { items: conv3, direction: "outgoing", top: IOS_FIRST_BODY_TOP, balloon: "ok" },
  longpress: { items: conv3, direction: "outgoing", top: IOS_FIRST_BODY_TOP, press: "ok" },
  "longpress-two-line": { items: conv3, direction: "outgoing", top: IOS_FIRST_BODY_TOP, balloon: "ok", press: "every" },
  // Both "Hi there" captures were taken after the Love was applied to "Ok", so the list carries the slot.
  "longpress-last": { items: conv3Hi, direction: "outgoing", top: IOS_FIRST_BODY_TOP, balloon: "ok", press: "hi" },
  "longpress-selected": { items: conv3, direction: "outgoing", top: IOS_FIRST_BODY_TOP, balloon: "ok", press: "ok", selected: true },
  "incoming-balloon": { items: conv3Hi, direction: "incoming", top: 201, balloon: "ok" },
  "longpress-incoming": { items: conv3Hi, direction: "incoming", top: 201, balloon: "ok", press: "hi" },
  "macos-balloon": { items: macPane, direction: "outgoing", top: 6.03, balloon: "second" },
};

/** The macOS crop starts 28 pt below the window origin the bubble gradient is anchored to. */
const MACOS_PANE_OFFSET = 28;

export function TapbackLabScene({ scene, theme, progress }: { scene: string; theme: "light" | "dark"; progress?: number }) {
  const platform: Platform = scene.startsWith("macos") ? "macos" : "ios";
  const m = bubbleMetrics[platform];
  const vars = { ...paletteVars(palettes[platform][theme]), ...tapbackVars(theme, platform) } as CSSProperties;
  const size = platform === "ios" ? { width: 402, height: 874 } : scene === "macos-balloon" ? { width: 260, height: 150 } : { width: 315, height: 295 };
  const frame = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const pressedBubble = useRef<HTMLDivElement>(null);
  const [pressedRect, setPressedRect] = useState<Rect | null>(null);
  useBubbleScreenSpace(frame, screen);
  const spec = scenes[scene];

  useLayoutEffect(() => {
    if (!spec?.press || !frame.current || !pressedBubble.current) return;
    const body = pressedBubble.current.querySelector<HTMLElement>('[data-slot="bubble"]');
    if (!body) return;
    const f = frame.current.getBoundingClientRect();
    const r = body.getBoundingClientRect();
    setPressedRect({ x: r.left - f.left, y: r.top - f.top, width: r.width, height: r.height });
  }, [scene, spec?.press]);

  const pressed = spec?.press ? spec.items.find(item => item.id === spec.press) : undefined;
  const outgoing = spec?.direction !== "incoming";
  const slot = balloonSlot[platform];
  const balloon = (own: boolean) => <Tapback reaction="love" own={own} side={outgoing ? "left" : "right"} />;

  return (
    <PlatformProvider platform={platform}>
      <div ref={frame} data-testid="lab" className={theme} style={{ ...vars, ...size, position: "relative", overflow: "hidden", background: platform === "ios" || scene === "macos-balloon" ? "var(--im-bg)" : theme === "light" ? "#e6e6e6" : "#2c2c2e" }}>
        {/* The screen frame the bubble gradient is measured from; on macOS the crop sits below the window origin. */}
        <div ref={screen} aria-hidden="true" style={{ position: "absolute", left: 0, top: platform === "macos" ? -MACOS_PANE_OFFSET : 0, width: 0, height: 0 }} />
        {spec && (
          <div style={{ position: "absolute", top: spec.top, left: outgoing ? 0 : m.edgeInset, right: outgoing ? m.edgeInset : 0, display: "flex", flexDirection: "column", alignItems: outgoing ? "flex-end" : "flex-start" }}>
            {spec.items.map((item, index) => {
              const hasBalloon = spec.balloon === item.id;
              const isPressed = spec.press === item.id;
              return (
                <MessageBubble key={item.id} ref={isPressed ? pressedBubble : undefined} direction={spec.direction} service={outgoing && platform === "ios" ? "sms" : "imessage"} tail={item.tail ?? false} status={item.status}
                  maxWidth={platform === "macos" ? m.maxWidth : undefined} reactions={hasBalloon ? balloon(outgoing) : undefined}
                  style={{ width: "100%", marginTop: index === 0 ? 0 : item.group === "new" ? m.gapBetweenGroups : m.gapInGroup, visibility: isPressed && pressedRect ? "hidden" : undefined }}>
                  {item.text}
                </MessageBubble>
              );
            })}
          </div>
        )}
        {pressed && pressedRect && (
          <MessageActions rect={pressedRect} frame={size} direction={spec.direction} service={outgoing ? "sms" : "imessage"} tail={pressed.tail ?? false} progress={progress ?? 1} autoFocus={false} onClose={() => {}}
            selected={spec.selected ? { type: "love" } : undefined} details={spec.selected ? { initials: "KB" } : undefined}>
            {/* The lifted copy carries the same balloon; its frame reserves the slot again, so take it back. */}
            <div style={{ marginTop: spec.balloon === pressed.id ? -slot.marginTop : 0 }}>
              <MessageBubble direction={spec.direction} service={outgoing ? "sms" : "imessage"} tail={pressed.tail ?? false} screenBottom={pressedRect.y + pressedRect.height}
                reactions={spec.balloon === pressed.id ? balloon(outgoing) : undefined} style={{ width: "100%" }}>{pressed.text}</MessageBubble>
            </div>
          </MessageActions>
        )}
        {/* `left: 6` puts the menu's outer edge on the capture's 5.5: the 0.5 pt border is an outer
            box-shadow, so it lands outside the box, on the same device pixel column as the capture. */}
        {scene === "macos-menu" && (
          <ContextMenu variant="macos" items={macosMessageMenu} style={{ position: "absolute", left: 6, top: 2 }}
            header={<TapbackBar layout="macos" recent={["😮", "🥲", "😭", "👍", "🥹"]} />} />
        )}
      </div>
    </PlatformProvider>
  );
}
