"use client";

import { useRef, type CSSProperties } from "react";
import { useBubbleScreenSpace } from "@/registry/imessage/use-screen-space";
import { DateSeparator } from "@/registry/imessage/date-separator";
import { iosScreen } from "@/registry/imessage/ios-messages-app";
import { MessageBubble } from "@/registry/imessage/message-bubble";
import { PlatformProvider, type Platform } from "@/registry/imessage/platform";
import { bubbleMetrics, palettes, paletteVars } from "@/registry/imessage/tokens";

type Item = { text: string; tail?: boolean; status?: string; group?: "new" };

/**
 * The moment `conv3-light.png` was taken, so the header reads "iMessage / Today 1:25 AM" the way the
 * capture does. Fixed rather than read from the clock: the lab has to render the same pixels twice.
 */
const conv3SentAt = new Date(2026, 8, 8, 1, 25);

/** iOS reference `references/ios/captures/conv3-light.png`: outgoing SMS bubbles under a date header. */
const iosConv3: Item[] = [
  { text: "A" + "a".repeat(32), tail: true },
  { text: "V", group: "new" },
  { text: "V" },
  { text: "V", tail: true },
  { text: "It’s all in the little details. ✨ A longer message should wrap naturally without stretching the conversation.", tail: true, group: "new" },
  { text: "Ok", group: "new" },
  { text: "Every detail, down to the last bubble.", tail: true, status: "Delivered" },
];

export function LabScene({ scene, theme }: { scene: string; theme: "light" | "dark" }) {
  const platform: Platform = scene.startsWith("macos") ? "macos" : "ios";
  const m = bubbleMetrics[platform];
  const vars = paletteVars(palettes[platform][theme]) as CSSProperties;
  const size = platform === "ios" ? { width: 402, height: 874 } : { width: 960, height: 640 };
  const frame = useRef<HTMLDivElement>(null);
  useBubbleScreenSpace(frame);
  return (
    <PlatformProvider platform={platform}>
      <div ref={frame} data-testid="lab" className={theme} style={{ ...vars, ...size, position: "relative", overflow: "hidden", background: "var(--im-bg)" }}>
        {/* The capture opens with the date header, so the lab draws it and lets the column's top fall
            out of the same chain the app uses (`iosScreen.listTop` plus the header's own block) rather
            than restating a first-body top. Native's is device row 615 at 3x, y 205.00, measured
            sub-pixel and reproduced in conv4-light, grouped-light, sent-1-light and conv2-dark; the
            205.33 this lab used to hardcode was a third of a point low and every bubble inherited it. */}
        {scene === "ios-conv3" && (
          <div style={{ position: "absolute", top: iosScreen.listTop, left: m.edgeInset, right: m.edgeInset }}>
            <DateSeparator variant="first" service="iMessage" date={conv3SentAt} now={conv3SentAt} platform="ios" />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              {iosConv3.map((item, index) => (
                <MessageBubble key={index} direction="outgoing" service="sms" tail={item.tail ?? false} status={item.status}
                  style={{ width: "100%", marginTop: index === 0 ? 0 : item.group === "new" ? m.gapBetweenGroups : m.gapInGroup }}>
                  {item.text}
                </MessageBubble>
              ))}
            </div>
          </div>
        )}
      </div>
    </PlatformProvider>
  );
}
