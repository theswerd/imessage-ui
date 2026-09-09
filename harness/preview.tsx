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
import type { IosSearchSection } from "@/registry/imessage/ios-search";
import { contact, frameAt, iosConversations, macConversations, now, platforms, type FixtureMessage, type Platform, type Reaction, type ScenarioId, type SceneFrame } from "./scenarios";
import { cn } from "@/lib/utils";

function toMessage(fixture: FixtureMessage): Message {
  const sentAt = now.getTime() - fixture.minutesAgo * 60_000;
  return {
    id: fixture.id, text: fixture.text, direction: fixture.direction, service: fixture.service, sentAt, sender: fixture.sender, senderInitials: fixture.senderInitials,
    status: fixture.failed ? "failed" : fixture.status, readAt: fixture.readMinutesAgo === undefined ? undefined : now.getTime() - fixture.readMinutesAgo * 60_000, edited: fixture.edited,
    reactions: fixture.reactions?.map(reaction => ({ type: reaction.type, byMe: reaction.byMe, emoji: reaction.emoji, by: reaction.by, byInitials: reaction.byInitials })),
    // A status line is a kind of its own: it draws as one of `system-message.tsx`'s centred grey
    // sentences rather than a balloon, so it is checked before every balloon kind.
    kind: fixture.system ? "system" : fixture.link ? "link" : fixture.attachment ? "attachment" : fixture.images ? "image" : fixture.audio ? "audio" : "text",
    system: fixture.system,
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

/** "Alex Morgan" → "AM": the monogram a face falls back to when the fixture carries only a name. */
function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? "").join("").toUpperCase();
}

/**
 * The group's people, in the shape both shells take: two or more turn the nav bar's (or the header's)
 * avatar slot into `group-avatar.tsx`'s Snowglobe stack, give the transcript its sender gutter, and
 * fill the details screen's participant list. The iOS shell wants `{ name, initials, src }` and the
 * macOS one `{ initials, name, photo }`, so one object satisfies both.
 */
function participantsOf(frame: SceneFrame) {
  return frame.group?.participants.map(name => ({ name, initials: initialsOf(name) }));
}

/**
 * What the details surfaces show below the name. Both screens draw a cell (or, on the Mac, a tab)
 * only for a section that has something in it, so without this the inspector is Info alone and the
 * `details-photos` scenario would be indistinguishable from `details`. The five photos are the same
 * files the transcript and the photo viewer use, so one conversation's shared media is one set.
 */
const sharedPhotos = [
  { id: "sh1", src: "/fixtures/shore.jpg", alt: "Shore" },
  { id: "sh2", src: "/fixtures/ridge.jpg", alt: "Ridge" },
  { id: "sh3", src: "/fixtures/bloom.jpg", alt: "Bloom" },
  { id: "sh4", src: "/fixtures/dusk.jpg", alt: "Dusk" },
  { id: "sh5", src: "/fixtures/frost.jpg", alt: "Frost" },
];
const sharedLinks = [
  { id: "ln1", title: "Design systems at scale", host: "freestyle.sh", domain: "freestyle.sh" },
  { id: "ln2", title: "The design of everyday tools", host: "example.com", domain: "example.com" },
  { id: "ln3", title: "Type design notes", host: "example.org", domain: "example.org" },
];
const sharedFiles = [
  { id: "at1", name: "Design brief.pdf", title: "Design brief.pdf", meta: "1.2 MB", detail: "1.2 MB" },
  { id: "at2", name: "Design tokens.csv", title: "Design tokens.csv", meta: "8 KB", detail: "8 KB" },
];
/** The iOS details screen's shape: a titled, countable section per kind. */
const iosDetailsContent = {
  phoneLabel: "iPhone",
  phone: "+1 (555) 010-0100",
  photos: { title: "Photos", count: sharedPhotos.length, items: sharedPhotos.map(photo => ({ id: photo.id, src: photo.src, alt: photo.alt })) },
  sharedLinks: { title: "Links", count: sharedLinks.length, items: sharedLinks.map(link => ({ id: link.id, title: link.title, detail: link.domain })) },
  attachments: { title: "Attachments", count: sharedFiles.length, items: sharedFiles.map(file => ({ id: file.id, title: file.title, detail: file.detail })) },
};
/** The macOS inspector's shape: flat arrays, one tab each. */
const macDetailsContent = {
  handles: [{ id: "h1", label: "iMessage", value: contact.handle }, { id: "h2", label: "phone", value: "+1 (555) 010-0100" }],
  photos: sharedPhotos.map(photo => ({ id: photo.id, src: photo.src, alt: photo.alt })),
  links: sharedLinks.map(link => ({ id: link.id, title: link.title, host: link.host })),
  attachments: sharedFiles.map(file => ({ id: file.id, name: file.name, meta: file.meta })),
};

/**
 * The search results fixture. Copied from `app/lab/search/scene.tsx` on purpose, in particular the
 * first message: its match falls well past the end of a one-line balloon, so it is the row that
 * proves the balloon anchors its visible window on the match rather than on its own start. A short
 * message would pass whether the anchoring worked or not.
 */
const searchSections: IosSearchSection[] = [
  { kind: "conversations", results: [
    { id: "design", name: "Design Crit", initials: "DC", preview: "Sam Rivera: Tuesday morning at 9?", time: "9:21 AM" },
    { id: "sam", name: "Sam Rivera", initials: "SR", preview: "But have failed to deliver on performance using it", time: "Yesterday" },
  ] },
  { kind: "messages", results: [
    { id: "sm1", name: "Sam Rivera", initials: "SR", conversation: "Design Crit", text: "Tuesday morning at 9 works for the design review.", time: "9:21 AM" },
    { id: "sm2", name: "You", initials: "BS", conversation: "Alex Morgan", text: "I moved the design notes into the shared folder this morning.", time: "Yesterday", fromMe: true },
    { id: "sm3", name: "Jamie Chen", initials: "JC", text: "Can you send the design file again? The link expired and the design tokens changed.", time: "Monday" },
    { id: "sm4", name: "Riley Park", initials: "RP", text: "Design day is on.", time: "Monday" },
  ] },
  { kind: "photos", results: [
    { id: "sp1", src: "/fixtures/shore.jpg", name: "Alex Morgan", time: "Yesterday" },
    { id: "sp2", src: "/fixtures/ridge.jpg", name: "Jamie Chen", time: "Monday" },
    { id: "sp3", src: "/fixtures/bloom.jpg", name: "Sam Rivera", time: "Monday" },
    { id: "sp4", src: "/fixtures/dusk.jpg", name: "Riley Park", time: "Sunday" },
  ] },
  { kind: "links", results: [
    { id: "sl1", title: "Design systems at scale", domain: "freestyle.sh", time: "Monday", src: "/fixtures/frost.jpg" },
    { id: "sl2", title: "The design of everyday tools", domain: "example.com", time: "Sunday" },
  ] },
  { kind: "documents", results: [
    { id: "sd1", title: "Design brief.pdf", time: "Monday" },
    { id: "sd2", title: "Design tokens.csv", time: "Sunday" },
  ] },
];

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

  /** Messages the toolbar's Delete has taken out, so the button does what it says. */
  const [deleted, setDeleted] = useState<string[]>([]);

  const messages = useMemo(() => [...frame.messages, ...extra].filter(message => !deleted.includes(message.id)).map(message => {
    const applied = reactions[message.id];
    return applied ? { ...message, reactions: applied } : message;
  }).map(toMessage), [frame.messages, extra, reactions, deleted]);

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
  /*
   * The presented surfaces. Each shell owns its own copy of every one of them while the matching
   * prop is `undefined` — that is how the composer's `+`, its mic, the nav bar's name pill, a tap on
   * a photo or on a tapback balloon, and the list's search field all keep working with nothing wired
   * — so a scenario that does not state a surface must pass `undefined` rather than `null`, which
   * would take it away from the shell and freeze it shut. Everything below therefore reads
   * "the frame's value, if it has one, otherwise nothing at all".
   */
  const participants = participantsOf(frame);
  const plusMenuState = frame.plusMenu ?? undefined;
  // iOS select mode. `{ progress }` with no number is the settled mode; with one, the shell seeks
  // `IosSelectMode`'s single `--ios-sel-t` timeline instead of playing it. Left `undefined` the shell
  // owns the mode, which is what keeps the long-press menu's "Select" row working with nothing wired.
  /**
   * The scenario states the mode for a checkpoint, and a live "Done" takes it back — without that
   * second half the toolbar's ✕, Delete and Forward were all inert on the one scene that shows them:
   * the frame kept re-asserting the mode every render, so the shell's own close could never win.
   * A scrub onto a different `selectMode` frame drops the live close, so the timeline still rules.
   */
  const [leftSelectMode, setLeftSelectMode] = useState(false);
  const framedSelect = frame.selectMode ? { progress: frame.selectMode.progress } : undefined;
  const lastFramedSelect = useRef(framedSelect?.progress);
  if (lastFramedSelect.current !== framedSelect?.progress) { lastFramedSelect.current = framedSelect?.progress; if (leftSelectMode) setLeftSelectMode(false); }
  const selectMode = interactive && leftSelectMode ? undefined : framedSelect;
  const photoViewer = frame.photoViewer ?? undefined;
  const photoPicker = frame.photoPicker ? { selected: frame.photoPicker.selected, detent: frame.photoPicker.detent, progress: frame.photoPicker.progress } : undefined;
  const stickerPicker = frame.stickerPicker ? { tab: frame.stickerPicker.tab, progress: frame.stickerPicker.progress, drag: frame.stickerPicker.drag } : undefined;
  // `enter` is the entrance; `position` and `transition` are the take and the state-change spring.
  // Handing any of them over is what stops the row's own clock, so two runs of one checkpoint draw
  // the same waveform, the same timer and the same bar heights.
  const audioRecorder = frame.audioRecorder
    ? { state: frame.audioRecorder.state, position: frame.audioRecorder.position, progress: frame.audioRecorder.enter, transition: frame.audioRecorder.transition }
    : undefined;
  const search = frame.search
    ? { query: frame.search.query, sections: frame.search.results ? searchSections : [], progress: frame.search.progress, closing: frame.search.closing }
    : undefined;
  const systemArrival = frame.systemArrival ?? null;
  // The switch states which conversation the pane is on; the group flag already picks the same row,
  // so the two agree and a group frame and a switched-to-group frame are the same frame.
  /**
   * Which conversation the sidebar has. The frame decides it while the timeline is scrubbing - a
   * checkpoint has to render the row the scenario says - and a click takes it over from there, the
   * way `plusMenu` takes over the frame's menu. Without the second half the Mac's sidebar was inert:
   * `onSelectConversation` reported an event and nothing on screen moved, so every row but the
   * selected one looked dead to a click.
   */
  const framedConversation = frame.conversationSwitch?.to ?? frame.selectedConversation ?? (frame.group ? "design" : "alex");
  const [pickedConversation, setPickedConversation] = useState<string | null>(null);
  const selectedConversation = (interactive ? pickedConversation : null) ?? framedConversation;
  // A scrub back onto a scenario that names its own row drops the click, so the timeline still wins.
  const lastFramed = useRef(framedConversation);
  if (lastFramed.current !== framedConversation) { lastFramed.current = framedConversation; if (pickedConversation) setPickedConversation(null); }
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
    // Two or more people put the Snowglobe stack in the avatar slot the details screen's entrance
    // morphs out of, and give the transcript its sender gutter.
    participants,
    systemArrival,
    onTapback: react,
    // Same rule as `defaultReactions`: several people's tapbacks are one aggregate balloon showing
    // the latest, not one balloon each. This copy exists only to carry `animateIn` for a reaction
    // applied in this session.
    renderReactions: (message: Message) => {
      const all = message.reactions;
      if (!all?.length) return undefined;
      const latest = all[all.length - 1];
      return (
        <div data-slot="reaction-stack" className="flex">
          <Tapback reaction={latest.emoji ? undefined : (latest.type as TapbackType)} emoji={latest.emoji}
            own={latest.byMe ?? true} side={message.direction === "outgoing" ? "left" : "right"}
            count={all.length > 1 ? all.length : undefined} animateIn={poppedIn.has(message.id)} />
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
          conversations={iosConversations(frame.conversations)}
          composer={{ value: composerValue, onChange: setDraft, onSend: send, onAttach: () => onEvent?.("attachment.picker"), onMic: () => onEvent?.("audio.record") }}
          screenTransition={screenTransition}
          thread={thread}
          onOpenThread={id => { setThreadId(id); setDismissedThread(false); onEvent?.(`thread.open ${id}`); }}
          onCloseThread={() => { setThreadId(null); setDismissedThread(true); onEvent?.("thread.close"); }}
          onBack={() => { setScreen("list"); onEvent?.("navigation.back"); }}
          onSelectConversation={item => { setScreen("conversation"); onEvent?.(`navigation.open ${item.id}`); }}
          onCompose={() => { setScreen("new-message"); onEvent?.("navigation.new-message"); }}
          onCloseNewMessage={() => { setScreen("list"); onEvent?.("navigation.close-new-message"); }}
          // Every surface below is stated only when the scenario states it; left `undefined` the
          // shell holds it, so the gesture that opens it natively still opens it in the workbench.
          // See the block that derives these values for why `undefined` and not `null`.
          plusMenu={plusMenuState}
          onPlusMenuSelect={id => onEvent?.(`menu.plus.${id}`)}
          onPlusMenuClose={() => onEvent?.("menu.plus.close")}
          photoViewer={photoViewer}
          onOpenPhoto={(id, index) => onEvent?.(`photo.open ${id} ${index}`)}
          onPhotoIndexChange={index => onEvent?.(`photo.page ${index}`)}
          onClosePhoto={() => onEvent?.("photo.close")}
          onSharePhoto={(id, index) => onEvent?.(`photo.share ${id} ${index}`)}
          onSavePhoto={(id, index) => onEvent?.(`photo.save ${id} ${index}`)}
          photoPicker={photoPicker}
          onPhotoPickerSelectionChange={selected => onEvent?.(`photos.select ${selected.join(",") || "none"}`)}
          onPhotoPickerDetentChange={detent => onEvent?.(`photos.detent ${detent}`)}
          onPhotoPickerClose={() => onEvent?.("photos.close")}
          stickerPicker={stickerPicker}
          onStickerPickerTab={tab => onEvent?.(`stickers.tab ${tab}`)}
          onStickerPickerClose={() => onEvent?.("stickers.close")}
          onStickerSelect={sticker => onEvent?.(`stickers.select ${sticker.id}`)}
          onStickerEdit={() => onEvent?.("stickers.edit")}
          audioRecorder={audioRecorder}
          onAudioRecorderClose={() => onEvent?.("audio.close")}
          onAudioSend={take => onEvent?.(`audio.send ${take.duration.toFixed(2)}s`)}
          details={frame.details ?? undefined}
          detailsContent={{ ...iosDetailsContent,
            // A contact with a phone number can be called and FaceTimed; Mail has no address here,
            // so it stays in the tertiary state the capture shows for an action that is not offered.
            onAudioCall: () => onEvent?.("details.call"),
            onFaceTime: () => onEvent?.("details.facetime"),
            onBlock: () => onEvent?.("details.block") }}
          onDetails={() => onEvent?.("navigation.details")}
          onCloseDetails={() => onEvent?.("navigation.details.close")}
          onGroupEvent={event => onEvent?.(`group.${event.type}`)}
          tapbackDetails={frame.tapbackDetails ?? undefined}
          onOpenTapbackDetails={id => onEvent?.(`reactions.details ${id}`)}
          onCloseTapbackDetails={() => onEvent?.("reactions.details.close")}
          onRemoveTapback={(id, reactor) => onEvent?.(`reactions.remove ${id} ${reactor.id}`)}
          search={search}
          onOpenSearch={() => onEvent?.("search.open")}
          onCloseSearch={() => onEvent?.("search.close")}
          onSearchQueryChange={query => onEvent?.(`search.query ${query || "(empty)"}`)}
          onSearchSelect={(result, kind) => onEvent?.(`search.select ${kind} ${result.id}`)}
          onSearchSeeAll={kind => onEvent?.(`search.see-all ${kind}`)}
          // Select mode. The selection is stated only when the scenario states the mode; the rest of
          // the time the shell holds both, so choosing "Select" in the long-press menu enters the
          // mode and ticking a row works without the workbench owning any of it.
          selectMode={selectMode}
          // A tick made by hand wins over the scenario's, the same way a live selection does on the
          // Mac; both shells read the one piece of state, and only one of them is ever mounted.
          selectedMessageIds={selectedMessages ?? frame.selectMode?.selected}
          onOpenSelectMode={id => onEvent?.(`selection.mode ${id}`)}
          onCloseSelectMode={() => { setSelectedMessages(null); setLeftSelectMode(true); onEvent?.("selection.mode.close"); }}
          onSelectMessage={(ids, context) => { setSelectedMessages(ids); onEvent?.(`selection.select ${context.id ?? "none"} (${ids.length})`); }}
          onDeleteMessages={ids => { setDeleted(current => [...current, ...ids]); setSelectedMessages(null); setLeftSelectMode(true); onEvent?.(`selection.delete ${ids.join(",") || "none"}`); }}
          // Forwarding opens a compose sheet this kit does not own, so it leaves the mode and reports.
          onForwardMessages={ids => { setSelectedMessages(null); setLeftSelectMode(true); onEvent?.(`selection.forward ${ids.join(",") || "none"}`); }}
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
          conversations={macConversations(frame.conversations)}
          selectedId={selectedConversation}
          onSelectConversation={id => { if (interactive) setPickedConversation(id); onEvent?.(`navigation.open ${id}`); }}
          composer={{ value: composerValue, onChange: setDraft, onSend: send, onAttach: () => { setPlusMenu(current => !(current ?? frame.menu === "plus")); onEvent?.("menu.plus"); }, onAudio: () => onEvent?.("audio.record") }}
          plusMenu={plusMenu ?? frame.menu === "plus"} onPlusMenuSelect={id => { setPlusMenu(false); onEvent?.(`menu.plus.${id}`); }} onPlusMenuClose={() => setPlusMenu(false)}
          // `menuTransition` seeks whichever popover is presenting. Only state it while the timeline
          // is scrubbing the "+" menu, or a live context menu would be frozen on its first frame.
          menuTransition={frame.plusMenu ? { progress: frame.plusMenu.progress } : null}
          // The Mac has no in-window photo viewer: a photo there is a Quick Look, an AppKit panel
          // this kit cannot own, so the shell selects the message and reports.
          onQuickLook={(id, index) => onEvent?.(`photo.quicklook ${id} ${index}`)}
          photoPicker={photoPicker}
          onPhotoPickerSelectionChange={selected => onEvent?.(`photos.select ${selected.join(",") || "none"}`)}
          onPhotoPickerClose={() => onEvent?.("photos.close")}
          stickerPicker={stickerPicker}
          onStickerPickerTab={tab => onEvent?.(`stickers.tab ${tab}`)}
          onStickerPickerClose={() => onEvent?.("stickers.close")}
          onStickerSelect={sticker => onEvent?.(`stickers.select ${sticker.id}`)}
          details={frame.detailsPane ?? undefined}
          detailsContent={macDetailsContent}
          onDetailsClose={() => onEvent?.("navigation.details.close")}
          onDetailsTabChange={tab => onEvent?.(`details.tab ${tab}`)}
          onDetailsWidthChange={next => onEvent?.(`details.width ${Math.round(next)}`)}
          searchQuery={frame.sidebarSearch} onSearch={query => onEvent?.(`search.query ${query || "(empty)"}`)}
          // The pane's crossfade, seeked. The shell derives the *leaving* conversation from a real
          // change of `selectedId`, so a frame loaded straight at mid-transition has nothing to cross
          // with — see the `switch-conversation` scenario's own comment.
          conversationTransition={frame.conversationSwitch ? { progress: frame.conversationSwitch.progress } : null}
          onCompose={() => onEvent?.("navigation.new-message")} onVideoCall={beginCall} onDetails={() => onEvent?.("navigation.details")}
          // `undefined`, not `[]`, when nothing states a selection: click-to-select is always on in
          // the macOS pane now and the shell holds the set itself, so handing it an empty array
          // would take that state away and freeze every row unselected. Same rule as every other
          // surface here — state it only when the scenario states it.
          selectedMessageIds={selectedMessages ?? frame.selectedMessageIds}
          onSelectMessage={interactive ? (ids, context) => { setSelectedMessages(ids); onEvent?.(`selection.select ${context.id ?? "none"}`); } : undefined}
          contextMenu={contextMenu ?? (frame.menu === "context" ? { id: "m6", x: 420, y: 470 } : null)}
          onContextMenu={interactive ? (id, x, y) => { setContextMenu({ id, x, y }); onEvent?.(`reactions.open ${id}`); } : undefined}
          onContextMenuClose={() => { setContextMenu(null); onEvent?.("reactions.close"); }}
          footer="Syncing with iCloud Paused" overlay={<>{callCard}{effectOverlay}</>} />
      )}
    </div>
  );
}
