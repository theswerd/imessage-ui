"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IosMessagesApp, iosScreen } from "@/registry/imessage/ios-messages-app";
import { MacMessagesApp } from "@/registry/imessage/macos-messages-app";
import type { Message } from "@/registry/imessage/message-list";
import type { TapbackSelection } from "@/registry/imessage/tapback-bar";
import { Tapback, type TapbackType } from "@/registry/imessage/tapback";
import { FaceTimeCard, type FaceTimeState } from "@/registry/imessage/facetime-card";
import { useBubbleEffectOnMessage } from "@/registry/imessage/message-effects";
import type { EffectsPickerSelection } from "@/registry/imessage/ios-effects-picker";
import { ScreenEffect } from "@/registry/imessage/screen-effects";
import { contact, conversationList, frameAt, now, platforms, type FixtureMessage, type Platform, type Reaction, type ScenarioId } from "./scenarios";
import { cn } from "@/lib/utils";

function toMessage(fixture: FixtureMessage): Message {
  const sentAt = now.getTime() - fixture.minutesAgo * 60_000;
  return {
    id: fixture.id, text: fixture.text, direction: fixture.direction, service: fixture.service, sentAt, sender: fixture.sender, senderInitials: fixture.senderInitials,
    status: fixture.failed ? "failed" : fixture.status, readAt: fixture.readMinutesAgo === undefined ? undefined : now.getTime() - fixture.readMinutesAgo * 60_000, edited: fixture.edited,
    reactions: fixture.reactions?.map(reaction => ({ type: reaction.type, byMe: reaction.byMe, emoji: reaction.emoji })),
    kind: fixture.link ? "link" : fixture.attachment ? "attachment" : fixture.images ? "image" : fixture.audio ? "audio" : "text",
    link: fixture.link ? { url: fixture.link.url, host: fixture.link.host, title: fixture.link.title } : undefined,
    attachments: fixture.attachment ? [{ name: fixture.attachment.name, size: fixture.attachment.size, href: fixture.attachment.href }] : undefined,
    images: fixture.images,
    audio: fixture.audio,
    replyTo: fixture.replyTo,
    replyCount: fixture.replyCount,
    effect: fixture.effect,
  };
}

function selectionToReaction(selection: TapbackSelection): Reaction {
  return "type" in selection ? { type: selection.type, byMe: true } : { type: "emoji", emoji: selection.emoji, byMe: true };
}

export type HarnessPreviewProps = { platform: Platform; scenario: ScenarioId; time: number; interactive?: boolean; onEvent?: (event: string) => void; width?: number; failSends?: boolean };

/** Renders one scenario checkpoint through the real app shells, and lets the user keep interacting from there. */
export function HarnessPreview({ platform, scenario, time, interactive = true, onEvent, width, failSends = false }: HarnessPreviewProps) {
  const frame = frameAt(scenario, time);
  const [extra, setExtra] = useState<FixtureMessage[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[] | undefined>>({});
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [dismissedPress, setDismissedPress] = useState(false);
  const [screen, setScreen] = useState<"list" | "conversation" | "new-message" | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [dismissedThread, setDismissedThread] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [call, setCall] = useState<FaceTimeState>();
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<string[] | null>(null);
  const [plusMenu, setPlusMenu] = useState<boolean | null>(null);
  const [liveSend, setLiveSend] = useState<string | null>(null);
  const [livePicker, setLivePicker] = useState<{ tab: "bubble" | "screen"; selection: EffectsPickerSelection } | null>(null);
  // Balloons only pop in for a reaction applied in this session; ones already on a message when the
  // scene loaded are simply there, as they are natively.
  const [poppedIn, setPoppedIn] = useState<Set<string>>(() => new Set());
  const sequence = useRef(0);
  const callGeneration = useRef(0);
  const deviceFrame = useRef<HTMLDivElement>(null);
  const size = platforms[platform];

  const messages = useMemo(() => [...frame.messages, ...extra].map(message => {
    const applied = reactions[message.id];
    return applied ? { ...message, reactions: applied } : message;
  }).map(toMessage), [frame.messages, extra, reactions]);

  const longPress = pressedId ? { id: pressedId } : frame.longPress && !dismissedPress ? { id: frame.longPress.id, progress: frame.longPress.progress } : null;
  const activeScreen = screen ?? (frame.screen === "details" ? "conversation" : frame.screen);
  // A live navigation takes the timeline's transition over: the shell then sees `screen` change and
  // runs the push itself, which is the path an application takes.
  const screenTransition = screen === null ? frame.screenTransition ?? null : null;
  // A thread opened by hand wins over the timeline's, and closing one by hand keeps it closed.
  const thread = threadId ? { rootId: threadId } : frame.thread && !dismissedThread ? frame.thread : null;
  const composerValue = draft ?? frame.composerDraft ?? "";
  const currentCall = call ?? frame.call;
  const bubbleEffect = frame.effect?.bubble ? { id: frame.effect.id, kind: frame.effect.bubble, progress: frame.effect.progress } : null;
  // The effects screen: the timeline drives it, and an interactive hold on the send button opens it.
  const timelinePicker = frame.effectsPicker
    ? { tab: frame.effectsPicker.tab, selection: frame.effectsPicker.bubble ? { bubble: frame.effectsPicker.bubble } : frame.effectsPicker.screen ? { screen: frame.effectsPicker.screen } : null, progress: frame.effectsPicker.progress }
    : null;
  const picker = livePicker ?? timelinePicker;
  useBubbleEffectOnMessage(deviceFrame, bubbleEffect);
  // The press-and-hold scenario scrubs the hold itself: grow the bubble the way use-long-press does
  // while the finger is down, so the checkpoint before the menu opens is inspectable.
  const pressed = frame.pressed;
  useEffect(() => {
    const root = deviceFrame.current;
    const target = pressed ? root?.querySelector<HTMLElement>(`[data-message-id="${pressed.id}"] [data-slot="bubble-frame"]`) : null;
    if (!target) return;
    target.style.transformOrigin = "100% 100%";
    target.style.transform = `scale(${1 + 0.03 * pressed!.progress})`;
    return () => { target.style.transform = ""; target.style.transformOrigin = ""; };
  }, [pressed]);

  function react(id: string, selection: TapbackSelection) {
    const reaction = selectionToReaction(selection);
    setReactions(current => {
      const existing = (current[id] ?? [...frame.messages, ...extra].find(message => message.id === id)?.reactions ?? []).filter(r => !r.byMe);
      const same = ([...frame.messages, ...extra].find(message => message.id === id)?.reactions ?? current[id] ?? []).some(r => r.byMe && r.type === reaction.type && r.emoji === reaction.emoji);
      return { ...current, [id]: same ? existing : [...existing, reaction] };
    });
    setPoppedIn(current => new Set(current).add(id));
    onEvent?.(`reactions.${"type" in selection ? selection.type : selection.emoji} ${id}`);
    setPressedId(null); setDismissedPress(true); setContextMenu(null);
  }
  async function send(text: string) {
    if (failSends) { onEvent?.("message.failed"); throw new Error("Fixture send failure"); }
    const id = `sent-${++sequence.current}`;
    setExtra(current => [...current, { id, direction: "outgoing", text, minutesAgo: 0, status: "delivered" }]);
    setDraft("");
    setLiveSend(id);
    onEvent?.(`message.send ${id}`);
  }
  function beginCall() {
    const generation = ++callGeneration.current;
    setCall("ringing"); onEvent?.("facetime.ringing");
    setTimeout(() => { if (generation === callGeneration.current) { setCall("connected"); onEvent?.("facetime.connected"); } }, 1100);
  }
  // Anchor the effect on the message the scenario sent it with, not on whatever bubble is last.
  const effectOverlay = frame.effect?.screen ? <ScreenEffect kind={frame.effect.screen} progress={frame.effect.progress} anchorMessageId={frame.effect.id} /> : null;
  const callCard = currentCall ? (
    <div data-slot="call-overlay" className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ bottom: platform === "ios" ? 100 : 60 }}>
      <div className="pointer-events-auto"><FaceTimeCard state={currentCall} duration="00:12" onJoin={beginCall} onEnd={() => { callGeneration.current++; setCall("ended"); onEvent?.("facetime.ended"); }} /></div>
    </div>
  ) : null;

  // A real send plays the measured animation; a scrubbed scenario seeks it to the checkpoint instead.
  const timelineArrival = frame.arrival;
  const shared = {
    sendAnimation: liveSend ? { id: liveSend } : timelineArrival?.kind === "send" ? { id: timelineArrival.id, progress: timelineArrival.progress } : null,
    receiveAnimation: timelineArrival?.kind === "receive" ? { id: timelineArrival.id, progress: timelineArrival.progress } : null,
    onSendAnimationEnd: () => setLiveSend(null),
    messages, typing: frame.typing ? { sender: contact.name } : false, now, group: !!frame.group,
    contact: frame.group ? { name: frame.group.name, initials: "DC" } : { name: contact.name, initials: contact.initials },
    onTapback: react,
    renderReactions: (message: Message) => {
      if (!message.reactions?.length) return undefined;
      const outgoing = message.direction === "outgoing";
      return (
        <div data-slot="reaction-stack" className="flex" style={{ gap: 2 }}>
          {message.reactions.map((reaction, index) => (
            <Tapback key={index} reaction={reaction.emoji ? undefined : (reaction.type as TapbackType)} emoji={reaction.emoji}
              own={reaction.byMe ?? true} side={outgoing ? "left" : "right"} animateIn={poppedIn.has(message.id)} />
          ))}
        </div>
      );
    },
    onMenuAction: (id: string, action: string) => onEvent?.(`menu.${action} ${id}`),
  };

  return (
    <div ref={deviceFrame} data-testid="device" data-platform={platform} data-scenario={scenario} data-time={time}
      className={cn("relative isolate shrink-0 overflow-hidden", platform === "ios" ? "rounded-[36px]" : "rounded-[27px]")}
      style={{ width: width ?? size.width, height: size.height, boxShadow: "0 20px 70px -25px #00000040" }}>
      {platform === "ios" ? (
        <IosMessagesApp {...shared} width={width ?? iosScreen.width} height={iosScreen.height} time="9:41" screen={activeScreen}
          conversations={conversationList.map(item => ({ id: item.id, name: item.name, initials: item.initials, preview: item.preview, time: item.time }))}
          composer={{ value: composerValue, onChange: setDraft, onSend: send, onAttach: () => onEvent?.("attachment.picker") }}
          screenTransition={screenTransition}
          thread={thread}
          onOpenThread={id => { setThreadId(id); setDismissedThread(false); onEvent?.(`thread.open ${id}`); }}
          onCloseThread={() => { setThreadId(null); setDismissedThread(true); onEvent?.("thread.close"); }}
          onBack={() => { setScreen("list"); onEvent?.("navigation.back"); }}
          onSelectConversation={item => { setScreen("conversation"); onEvent?.(`navigation.open ${item.id}`); }}
          onCompose={() => { setScreen("new-message"); onEvent?.("navigation.new-message"); }}
          onCloseNewMessage={() => { setScreen("list"); onEvent?.("navigation.close-new-message"); }}
          onDetails={() => onEvent?.("navigation.details")}
          longPress={longPress} onLongPress={interactive ? id => { setPressedId(id); onEvent?.(`reactions.open ${id}`); } : undefined}
          onLongPressClose={() => { setPressedId(null); setDismissedPress(true); onEvent?.("reactions.close"); }}
          effectsPicker={picker && { ...picker, draft: composerValue }}
          onEffectsPickerOpen={interactive ? () => { setLivePicker({ tab: "bubble", selection: null }); onEvent?.("effects.open"); } : undefined}
          onEffectsTabChange={tab => { setLivePicker({ tab, selection: null }); onEvent?.(`effects.tab ${tab}`); }}
          onEffectSelect={selection => { setLivePicker(current => ({ tab: current?.tab ?? "bubble", selection })); onEvent?.(`effects.select ${selection && "bubble" in selection ? selection.bubble : selection && "screen" in selection ? selection.screen : "none"}`); }}
          onSendWithEffect={(text, selection) => { setLivePicker(null); void send(text); onEvent?.(`effects.send ${selection && "bubble" in selection ? selection.bubble : selection && "screen" in selection ? selection.screen : "none"}`); }}
          onEffectsPickerClose={() => { setLivePicker(null); onEvent?.("effects.close"); }}
          overlay={<>{callCard}{effectOverlay}</>} />
      ) : (
        <MacMessagesApp {...shared} width={width ?? size.width} height={size.height} active
          conversations={conversationList.map(item => ({ id: item.id, name: item.name, initials: item.initials, preview: item.preview, time: item.time, pinned: item.pinned, muted: "muted" in item ? item.muted : undefined }))}
          selectedId={frame.group ? "design" : "alex"} onSelectConversation={id => onEvent?.(`navigation.open ${id}`)}
          composer={{ value: composerValue, onChange: setDraft, onSend: send, onAttach: () => { setPlusMenu(current => !(current ?? frame.menu === "plus")); onEvent?.("menu.plus"); } }}
          plusMenu={plusMenu ?? frame.menu === "plus"} onPlusMenuSelect={id => { setPlusMenu(false); onEvent?.(`menu.plus.${id}`); }} onPlusMenuClose={() => setPlusMenu(false)}
          onCompose={() => onEvent?.("navigation.new-message")} onVideoCall={beginCall} onDetails={() => onEvent?.("navigation.details")}
          selectedMessageIds={selectedMessages ?? frame.selectedMessageIds ?? []}
          onSelectMessage={interactive ? (ids, context) => { setSelectedMessages(ids); onEvent?.(`selection.select ${context.id ?? "none"}`); } : undefined}
          contextMenu={contextMenu ?? (frame.menu === "context" ? { id: "m6", x: 420, y: 470 } : null)}
          onContextMenu={interactive ? (id, x, y) => { setContextMenu({ id, x, y }); onEvent?.(`reactions.open ${id}`); } : undefined}
          onContextMenuClose={() => { setContextMenu(null); onEvent?.("reactions.close"); }}
          footer="Syncing with iCloud Paused" overlay={<>{callCard}{effectOverlay}</>} />
      )}
    </div>
  );
}
