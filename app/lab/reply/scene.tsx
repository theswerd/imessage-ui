"use client";

import type { CSSProperties } from "react";
import { MessageBubble } from "@/registry/imessage/message-bubble";
import { PlatformProvider, type Platform } from "@/registry/imessage/platform";
import { palettes, paletteVars, bubbleMetrics } from "@/registry/imessage/tokens";
import { ReplyCount, ReplyMessage, ReplyThread } from "@/registry/imessage/message-reply";
import { MessageImages } from "@/registry/imessage/message-image";
import { MessageAudio } from "@/registry/imessage/message-audio";
import { EditableBubble, EditedLabel, UndoSendPoof } from "@/registry/imessage/message-edit";

/** Reply lab: /lab/reply?platform=ios&theme=light&thread=1 */
const photos = [
  { src: "/fixtures/shore.jpg", alt: "Shore" },
  { src: "/fixtures/ridge.jpg", alt: "Ridge" },
  { src: "/fixtures/bloom.jpg", alt: "Bloom" },
  { src: "/fixtures/frost.jpg", alt: "Frost" },
  { src: "/fixtures/dusk.jpg", alt: "Dusk" },
];

export function ReplyScene({ platform, theme, thread, photoCount, audio, edit }: { platform: Platform; theme: "light" | "dark"; thread?: boolean; photoCount?: number; audio?: boolean; edit?: boolean }) {
  const vars = paletteVars(palettes[platform][theme]) as CSSProperties;
  const size = platform === "ios" ? { width: 402, height: 874 } : { width: 630, height: 640 };
  const m = bubbleMetrics[platform];
  const quote = { id: "m5", text: "Tuesday morning at 9?", direction: "incoming" as const, sender: "Alex Morgan" };

  return (
    <PlatformProvider platform={platform}>
      <div data-testid="reply-lab" className={theme}
        style={{ ...vars, ...size, position: "relative", overflow: "hidden", background: "var(--im-bg)", color: "var(--im-incoming-text)" }}>
        {/* A macOS bubble's max width is a percentage, and MessageBubble resolves it against its own
            box. A shrink-wrapped parent therefore collapses the cap onto the text, one word per line.
            `bubbleRow` stretches each bubble to the row, which is what message-list.tsx does. */}
        <div style={{ position: "absolute", top: 120, left: m.edgeInset, right: m.edgeInset, display: "flex", flexDirection: "column", gap: m.gapBetweenGroups }}>
          <div className="flex w-full flex-col items-start">
            <MessageBubble direction="incoming" tail style={{ width: "100%" }}>Tuesday morning at 9?</MessageBubble>
            <ReplyCount count={2} />
          </div>
          <ReplyMessage quote={quote} direction="outgoing" tail status="Delivered">Works for me.</ReplyMessage>
          <ReplyMessage quote={{ ...quote, id: "m3", text: "Every detail, down to the last bubble.", direction: "outgoing" }} direction="incoming" tail>
            That is the one I meant.
          </ReplyMessage>
          {photoCount ? <div className="flex w-full justify-end"><MessageImages images={photos.slice(0, photoCount)} direction="outgoing" tail /></div> : null}
          {edit ? (
            <>
              <EditableBubble value="Every detail, down to the last bubble." tail autoFocus={false} />
              <div className="flex w-full flex-col items-end">
                <MessageBubble direction="outgoing" tail style={{ width: "100%" }}>Every detail, down to the last bubble.</MessageBubble>
                <EditedLabel />
              </div>
              <div className="flex w-full justify-end"><UndoSendPoof running={false}><MessageBubble direction="outgoing" tail style={{ width: "100%" }}>This one is going away.</MessageBubble></UndoSendPoof></div>
            </>
          ) : null}
          {audio ? (
            <>
              <div className="flex w-full justify-end"><MessageAudio duration={17} position={6} playing direction="outgoing" tail /></div>
              <div className="flex w-full justify-start"><MessageAudio duration={9} direction="incoming" tail /></div>
            </>
          ) : null}
        </div>
        {thread && (
          <ReplyThread onClose={() => {}}>
            <MessageBubble direction="incoming" tail>Tuesday morning at 9?</MessageBubble>
            <MessageBubble direction="outgoing" tail status="Delivered">Works for me.</MessageBubble>
          </ReplyThread>
        )}
      </div>
    </PlatformProvider>
  );
}
