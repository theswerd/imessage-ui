"use client";

import { useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PlatformProvider, type Platform } from "@/registry/imessage/platform";
import { PaletteStyle } from "@/registry/imessage/palette";
import { MessageList, type Message, type MessageListHandle } from "@/registry/imessage/message-list";
import { IosNavBar } from "@/registry/imessage/ios-nav-bar";
import { IosComposer } from "@/registry/imessage/ios-composer";
import { MacHeader, macHeaderMetrics } from "@/registry/imessage/macos-header";
import { MacComposer, macComposerMetrics } from "@/registry/imessage/macos-composer";
import { Tapback, type TapbackType } from "@/registry/imessage/tapback";
import { GroupAvatar, groupAvatarMetrics, type GroupParticipant } from "@/registry/imessage/group-avatar";

export type { Message as ConversationMessage };

/**
 * What the macOS log keeps clear at the bottom. The composer's field top edge sits 42 above the pane
 * bottom (`macComposerMetrics.bottom` 11 + field height 31) and the log's content box stops 16.15 above
 * that edge. Measured in `references/macos/captures/conversation-pane-light.png` (630 x 640 pane at 2x):
 * the field's top edge is at pane y 598.0, the last bubble's body bottom at 566.85 and the "Delivered"
 * ink bottom at 580.5, which is where 57.2 puts them. The same number as `macScreen.listBottom` in the
 * app shell; kept local so installing `conversation` does not pull in the whole window.
 */
const macListBottom = macComposerMetrics.bottom + macComposerMetrics.field.height + 16.15;

export type ConversationProps = Omit<ComponentProps<"section">, "children"> & {
  platform?: Platform;
  name: string;
  initials?: string;
  messages: Message[];
  typing?: boolean;
  group?: boolean;
  /**
   * The people in a group conversation. Two or more draws the Snowglobe stack in the header's own
   * avatar slot and marks the pane as a group, so the transcript spends its sender gutter.
   */
  participants?: readonly GroupParticipant[];
  now?: Date | number;
  onSend?: (text: string) => void | Promise<void>;
  onAttach?: () => void;
  onBack?: () => void;
  onVideoCall?: () => void;
  onDetails?: () => void;
  /** Called when a balloon is clicked (e.g. to remove your own reaction). */
  onReaction?: (message: Message, reaction: NonNullable<Message["reactions"]>[number]) => void;
  renderReactions?: (message: Message) => ReactNode;
  width?: number;
  height?: number;
};

/**
 * A complete conversation pane for either platform: header, the scrolling log with native clusters,
 * tails, date headers and reactions, and the composer. Bring your own data and send handler.
 */
export function Conversation({ platform = "ios", name, initials, messages, typing = false, group = false, participants, now, onSend, onAttach, onBack, onVideoCall, onDetails, onReaction, renderReactions, width, height, className, style, ...props }: ConversationProps) {
  const frame = useRef<HTMLElement>(null);
  const list = useRef<MessageListHandle>(null);
  const ios = platform === "ios";
  const reactions = renderReactions ?? ((message: Message) => message.reactions?.length ? (
    <div className="flex" style={{ gap: 2 }}>
      {message.reactions.map((reaction, index) => (
        <Tapback key={index} reaction={reaction.emoji ? undefined : (reaction.type as TapbackType)} emoji={reaction.emoji} own={reaction.byMe ?? true}
          side={message.direction === "outgoing" ? "left" : "right"} onClick={onReaction ? () => onReaction(message, reaction) : undefined} />
      ))}
    </div>
  ) : undefined);
  const size = { width: width ?? (ios ? 402 : 630), height: height ?? (ios ? 760 : 640) };
  const isGroup = group || (participants?.length ?? 0) > 1;
  // The header's avatar slot is Ø60 on iOS and `macHeaderMetrics.avatar.size` on the Mac; a group
  // fills it with its own faces rather than a monogram, which is what a Ø-slot `CKAvatarView` draws.
  const groupPhoto = participants && participants.length > 1
    ? <GroupAvatar participants={participants} name={name} size={ios ? groupAvatarMetrics.phone.groupAvatar : macHeaderMetrics.avatar.size} />
    : undefined;
  return (
    <PlatformProvider platform={platform}>
      <PaletteStyle platform={platform} />
      <section ref={frame} aria-label={`Conversation with ${name}`} data-slot="conversation" data-im-platform={platform}
        className={cn("relative isolate overflow-hidden font-sans", ios ? "rounded-[24px]" : "rounded-[12px]", className)}
        style={{ ...size, background: "var(--im-bg)", color: "var(--im-incoming-text)", ...style }} {...props}>
        <MessageList ref={list} frameRef={frame} messages={messages} typing={typing ? { sender: name } : false} group={isGroup} now={now}
          anchor={ios ? "top" : "bottom"} insetTop={ios ? 115.5 : macHeaderMetrics.height + 29.3} insetBottom={ios ? 79 : macListBottom} renderReactions={reactions} className="absolute inset-0" />
        {ios ? (
          <>
            <IosNavBar name={name} initials={initials} avatar={groupPhoto} onBack={onBack} onDetails={onDetails} className="absolute left-0 top-0" />
            {onSend && <IosComposer className="absolute bottom-0 left-0" onSend={onSend} onAttach={onAttach} />}
          </>
        ) : (
          <>
            <MacHeader name={name} initials={initials} avatar={groupPhoto} onVideoCall={onVideoCall} onOpenDetails={onDetails} className="absolute left-0 top-0 w-full" style={{ height: macHeaderMetrics.height }} />
            {onSend && <MacComposer className="absolute bottom-0 left-0 w-full" onSend={onSend} onAttach={onAttach} />}
          </>
        )}
      </section>
    </PlatformProvider>
  );
}
