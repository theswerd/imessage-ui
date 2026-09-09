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
import { DateSeparator, dateSeparatorMetrics } from "@/registry/imessage/date-separator";
import { IosStatusBar } from "@/registry/imessage/ios-status-bar";
import { IosNavBar } from "@/registry/imessage/ios-nav-bar";
import { IosComposer } from "@/registry/imessage/ios-composer";

type Item = { id: string; text: string; tail?: boolean; status?: string; group?: "new" };

/**
 * The thread body of `conv3-light.png` and every long-press capture taken over it. The first message
 * is 33 characters, not the 37 this fixture used to carry: at 402 pt both strings break after the
 * same 30, so the error only showed on the second line, which the captures render as "aaaaa" and the
 * lab rendered as "aaaaaaaaa". `/lab/list`'s copy of the same fixture already had it right.
 */
const AAAA = "Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const conv3: Item[] = [
  { id: "aaaa", text: AAAA, tail: true },
  { id: "v1", text: "V", group: "new" },
  { id: "v2", text: "V" },
  { id: "v3", text: "V", tail: true },
  { id: "details", text: "It’s all in the little details. ✨ A longer message should wrap naturally without stretching the conversation.", tail: true, group: "new" },
  { id: "ok", text: "Ok", group: "new" },
  { id: "every", text: "Every detail, down to the last bubble.", tail: true, status: "Delivered" },
];
/** The captures with a trailing "Hi there" (`longpress-last-bubble-dark.png`, `incoming-*.png`, `longpress-incoming-light.png`, `longpress-two-line-light.png`). */
const conv3Hi: Item[] = [...conv3.slice(0, 6), { id: "every", text: "Every detail, down to the last bubble.", tail: true }, { id: "hi", text: "Hi there", tail: true, group: "new", status: "Delivered" }];
/**
 * `sent-1-light.png` and the three long-press captures taken over it (`longpress-dark.png`,
 * `longpress-light.png`, `longpress-light-settled.png`): the thread is one sent message and its
 * Delivered label, nothing else. Those three press THAT message, near the top of the screen.
 */
const sent1: Item[] = [{ id: "aaaa", text: AAAA, tail: true, status: "Delivered" }];
/** The macOS pane fixture (`references/macos/captures/tapback-love-*-2x.png`, cropped to the pane's right 260 pt). */
const macPane: Item[] = [
  { id: "first", text: "First of two, sent back to back", tail: true },
  { id: "second", text: "Second of two" },
  { id: "third", text: "Text right before a link" },
];

type Peer = { name: string; initials: string };
const JA: Peer = { name: "+1 (888) 555-1212", initials: "JA" };
const KB: Peer = { name: "+1 (555) 564-8583", initials: "KB" };

type SceneSpec = {
  items: Item[]; direction: "incoming" | "outgoing"; top: number; balloon?: string; press?: string;
  /** Show the picker's selected state and the tapback-details popover (re-opening your own reaction). */
  selected?: boolean;
  /** The clock in the capture this scene reconstructs, read off its status bar. */
  time?: { light: string; dark: string };
  peer?: Peer;
};
/**
 * Native's first body top in this thread, measured sub-pixel: the fill's edge lands on device row 615
 * at 3x, i.e. y 205.00 exactly, in `conv3-light.png`, `conv4-light.png`, `grouped-light.png`,
 * `sent-1-light.png` and `conv2-dark.png` alike.
 *
 * The opening date header sits directly above it and is what the app reaches that number through, so
 * this lab now draws it: two 14 pt lines plus the header's own 7.6 gap below put its box top at
 * 169.40. `conv3-light.png` agrees — "iMessage" inks device rows 518-548 and "Today 1:25 AM" 561-589,
 * i.e. 172.7-182.7 and 187.0-196.3 in points, which is where an 11pt/14 line box at 169.40 and 183.40
 * puts them.
 */
const IOS_FIRST_BODY_TOP = 205;
const IOS_HEADER_HEIGHT = 2 * dateSeparatorMetrics.ios.lineHeight + dateSeparatorMetrics.ios.gapBelow;
/** The conversation's opening timestamp, fixed so the header always reads "Today 1:25 AM". */
const OPENED_AT = new Date(2025, 0, 1, 1, 25);

const scenes: Record<string, SceneSpec> = {
  balloon: { items: conv3, direction: "outgoing", top: IOS_FIRST_BODY_TOP, balloon: "ok", time: { light: "2:13", dark: "2:14" } },
  longpress: { items: conv3, direction: "outgoing", top: IOS_FIRST_BODY_TOP, press: "ok", time: { light: "2:12", dark: "2:12" } },
  // `longpress-dark.png`, `longpress-light.png` and `longpress-light-settled.png` press the FIRST
  // message of a one-message thread. They are not the `longpress` scene with the theme flipped: that
  // one presses "Ok" near the bottom of a seven-message thread, so at the SPEC region the capture is
  // bare dimmed ground while the lab draws the menu. Own scene, own fixture.
  "longpress-first": { items: sent1, direction: "outgoing", top: IOS_FIRST_BODY_TOP, press: "aaaa", time: { light: "1:29", dark: "1:35" } },
  // Two-line runs on the "Hi there" thread, not on `conv3`. The capture proves it: the menu's glass
  // carries a 93 x 40 green pill at x 297-390, y 660-700 that no `conv3` layout has anything to put
  // behind it, and that is exactly where "Hi there" sits once "Every detail…" is lifted out.
  "longpress-two-line": { items: conv3Hi, direction: "outgoing", top: IOS_FIRST_BODY_TOP, balloon: "ok", press: "every", time: { light: "3:08", dark: "3:08" } },
  // Both "Hi there" captures were taken after the Love was applied to "Ok", so the list carries the slot.
  "longpress-last": { items: conv3Hi, direction: "outgoing", top: IOS_FIRST_BODY_TOP, balloon: "ok", press: "hi", time: { light: "3:15", dark: "3:15" } },
  "longpress-selected": { items: conv3, direction: "outgoing", top: IOS_FIRST_BODY_TOP, balloon: "ok", press: "ok", selected: true, time: { light: "3:43", dark: "2:15" } },
  "incoming-balloon": { items: conv3Hi, direction: "incoming", top: 201, balloon: "ok", time: { light: "3:33", dark: "3:34" }, peer: KB },
  "longpress-incoming": { items: conv3Hi, direction: "incoming", top: 201, balloon: "ok", press: "hi", time: { light: "3:39", dark: "3:39" }, peer: KB },
  "macos-balloon": { items: macPane, direction: "outgoing", top: 6.03, balloon: "second" },
};

/** The macOS crop starts 28 pt below the window origin the bubble gradient is anchored to. */
const MACOS_PANE_OFFSET = 28;

/**
 * The pressed message leaves its slot open in the list, but keeps its status label: every long-press
 * capture with a Delivered label on the pressed message (`longpress-dark.png`,
 * `longpress-light-settled.png`) still shows it, dimmed, under the lift. So hide the bubble frame,
 * which is the balloon and the body, and not the whole row.
 */
const pressedStyle = '[data-pressed="true"] > [data-slot="bubble-frame"] { visibility: hidden; }';

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
  // The status bar, nav bar and composer go under the overlay's dim with the list, unblurred and not
  // re-drawn above it; see the fit in `app/lab/ios-chrome/scene.tsx`. Without them the frame's top
  // 168 pt and its bottom composer band are flat dim over the page colour, which is the whole of the
  // "+2.66 … +7.05 over the nav band" the sweep reads off every long-press pair.
  const chrome = platform === "ios" && spec !== undefined;
  const peer = spec?.peer ?? JA;

  return (
    <PlatformProvider platform={platform}>
      <div ref={frame} data-testid="lab" className={theme} style={{ ...vars, ...size, position: "relative", overflow: "hidden", background: platform === "ios" || scene === "macos-balloon" ? "var(--im-bg)" : theme === "light" ? "#e6e6e6" : "#2c2c2e" }}>
        <style>{pressedStyle}</style>
        {/* The screen frame the bubble gradient is measured from; on macOS the crop sits below the window origin. */}
        <div ref={screen} aria-hidden="true" style={{ position: "absolute", left: 0, top: platform === "macos" ? -MACOS_PANE_OFFSET : 0, width: 0, height: 0 }} />
        {chrome && (
          <>
            <IosStatusBar time={spec.time?.[theme] ?? "9:41"} style={{ position: "absolute", left: 0, top: 0 }} />
            <IosNavBar name={peer.name} initials={peer.initials} style={{ position: "absolute", left: 0, top: 54 }} />
            <IosComposer style={{ position: "absolute", left: 0, bottom: 0 }} />
            <DateSeparator service="iMessage" date={OPENED_AT} now={OPENED_AT} style={{ position: "absolute", left: 0, right: 0, top: spec.top - IOS_HEADER_HEIGHT }} />
          </>
        )}
        {spec && (
          <div style={{ position: "absolute", top: spec.top, left: outgoing ? 0 : m.edgeInset, right: outgoing ? m.edgeInset : 0, display: "flex", flexDirection: "column", alignItems: outgoing ? "flex-end" : "flex-start" }}>
            {spec.items.map((item, index) => {
              const hasBalloon = spec.balloon === item.id;
              const isPressed = spec.press === item.id;
              return (
                <MessageBubble key={item.id} ref={isPressed ? pressedBubble : undefined} direction={spec.direction} service={outgoing && platform === "ios" ? "sms" : "imessage"} tail={item.tail ?? false} status={item.status}
                  maxWidth={platform === "macos" ? m.maxWidth : undefined} reactions={hasBalloon ? balloon(outgoing) : undefined}
                  data-pressed={isPressed && pressedRect ? "true" : undefined}
                  style={{ width: "100%", marginTop: index === 0 ? 0 : item.group === "new" ? m.gapBetweenGroups : m.gapInGroup }}>
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
