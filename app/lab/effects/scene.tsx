"use client";

import { useRef, type CSSProperties } from "react";
import { MessageBubble } from "@/registry/imessage/message-bubble";
import { PlatformProvider, type Platform } from "@/registry/imessage/platform";
import { palettes, paletteVars } from "@/registry/imessage/tokens";
import { BubbleEffect, InvisibleInk, type BubbleEffectKind } from "@/registry/imessage/message-effects";
import { IosEffectsPicker, type EffectsPickerSelection } from "@/registry/imessage/ios-effects-picker";
import { ScreenEffect, type Anchor } from "@/registry/imessage/screen-effects";
import type { ScreenEffectKind } from "@/registry/imessage/message-effects";

/** Effects lab: /lab/effects?platform=ios&bubble=slam&t=0.4 or ?screen=confetti&t=0.5 or ?picker=1 */
export function EffectsScene({ platform, theme, bubble, screen, progress, picker, pickerTab, pickerSelection, previewText = "Every detail, down to the last bubble." }: { platform: Platform; theme: "light" | "dark"; bubble?: string; screen?: string; progress?: number; picker?: boolean; pickerTab?: string; pickerSelection?: EffectsPickerSelection; previewText?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const vars = paletteVars(palettes[platform][theme]) as CSSProperties;
  const size = platform === "ios" ? { width: 402, height: 874 } : { width: 630, height: 640 };
  const anchor: Anchor = platform === "ios" ? { x: 168, y: 520, width: 218, height: 40 } : { x: 380, y: 400, width: 200, height: 29 };

  return (
    <PlatformProvider platform={platform}>
      <div ref={frame} data-testid="effects-lab" className={theme}
        style={{ ...vars, ...size, position: "relative", overflow: "hidden", background: "var(--im-bg)", color: "var(--im-incoming-text)" }}>
        <div style={{ position: "absolute", left: 0, right: platform === "ios" ? 16 : 20, top: anchor.y - 6, display: "flex", justifyContent: "flex-end" }}>
          <BubbleEffect kind={bubble as BubbleEffectKind | undefined} progress={progress}>
            {bubble === "invisible-ink" ? (
              <InvisibleInk revealed={progress !== undefined && progress > 0.5}>
                <MessageBubble direction="outgoing" tail screenBottom={anchor.y + anchor.height}>Sent with Invisible Ink</MessageBubble>
              </InvisibleInk>
            ) : (
              <MessageBubble direction="outgoing" tail screenBottom={anchor.y + anchor.height}>Every detail, down to the last bubble.</MessageBubble>
            )}
          </BubbleEffect>
        </div>
        {screen && <ScreenEffect kind={screen as ScreenEffectKind} progress={progress} anchor={anchor} />}
        {picker && (
          <IosEffectsPicker
            tab={pickerTab === "screen" ? "screen" : "bubble"}

            selection={pickerSelection}
            preview={<MessageBubble direction="outgoing" tail>{previewText}</MessageBubble>}
          />
        )}
      </div>
    </PlatformProvider>
  );
}
