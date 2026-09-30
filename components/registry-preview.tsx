"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MessageBubble } from "@/registry/imessage/message-bubble";
import { PaletteStyle } from "@/registry/imessage/palette";
import { Tapback, tapbackTypes, type TapbackType } from "@/registry/imessage/tapback";
import { TypingIndicator } from "@/registry/imessage/typing-indicator";
import { MessageAttachment } from "@/registry/imessage/message-attachment";
import { IosMessagesApp, photoRun } from "@/registry/imessage/ios-messages-app";
import { MessageImages } from "@/registry/imessage/message-image";
import { ImageViewer, type ImageViewerRect } from "@/registry/imessage/image-viewer";
import { LinkPreview } from "@/registry/imessage/link-preview";
import { Avatar } from "@/registry/imessage/avatar";
import { DateSeparator } from "@/registry/imessage/date-separator";
import type { Message } from "@/registry/imessage/message-list";
import type { TapbackSelection } from "@/registry/imessage/tapback-bar";
import { bubbleMetrics, type Direction } from "@/registry/imessage/tokens";
import { showcasePhotos } from "@/lib/showcase";
import { AudioPreview } from "./audio-preview";
import { usePhonePreview } from "./use-phone-preview";
import type { PreviewSize } from "@/lib/preview-sizes";
import type { DemoThread } from "@/lib/home-inbox";
import type { IosConversation } from "@/registry/imessage/ios-conversation-list";
import { IosNewMessageSheet } from "@/registry/imessage/ios-new-message-sheet";
import { IosComposer } from "@/registry/imessage/ios-composer";

export function PreviewSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div data-im-platform="ios" className={`component-surface ${className}`}><PaletteStyle platform="ios" />{children}</div>;
}

export type PreviewOptions = { direction: Direction; platform: "ios"; tail: boolean; text: string; photo: number; photoCount: number; richLink: boolean };
const defaultOptions: PreviewOptions = { direction: "outgoing", platform: "ios", tail: true, text: "Meet me where the mountains are. 🏔️", photo: 0, photoCount: 1, richLink: true };

function PhotosPreview({ options }: { options: PreviewOptions }) {
  const host = useRef<HTMLDivElement>(null);
  const [photoFeedback, setPhotoFeedback] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [viewer, setViewer] = useState<{ index: number; rect: ImageViewerRect; open: boolean; host: HTMLElement } | null>(null);
  const photos = Array.from({ length: options.photoCount }, (_, i) => showcasePhotos[(options.photo + i) % showcasePhotos.length]);
  return <div ref={host} className="photo-example">
    <div className="photo-example-scroll"><MessageBubble direction="incoming" platform={options.platform} tail>Okay, this was worth the early start.</MessageBubble><MessageImages images={photos} direction={options.direction} platform={options.platform} tail={options.tail} maxWidth={280} style={{ alignSelf: options.direction === "outgoing" ? "flex-end" : "flex-start" }} onOpenImage={(index, rect) => {
      const target = host.current!.closest<HTMLElement>(".component-stage")!;
      const bounds = target.getBoundingClientRect();
      setViewer({ index, rect: { x: rect.x - bounds.x, y: rect.y - bounds.y, width: rect.width, height: rect.height }, open: true, host: target });
    }} /></div>
    {viewer && createPortal(<ImageViewer photos={photos} index={viewer.index} onIndexChange={index => setViewer({ ...viewer, index })} sourceRect={viewer.rect} open={viewer.open} onClose={() => setViewer({ ...viewer, open: false })} onExited={() => setViewer(null)} platform={options.platform} autoHideChrome={false} statusBar={false} safeArea={{ top: 16, bottom: 16 }}
      onSave={() => {
        const link = document.createElement("a"); link.href = photos[viewer.index].src; link.download = photos[viewer.index].src.split("/").pop()!; link.click();
        setSaved(current => [...current, photos[viewer.index].src]);
      }} saved={saved.includes(photos[viewer.index].src)}
      onShare={async () => {
        const url = new URL(photos[viewer.index].src, window.location.origin).href;
        try {
          if (navigator.share) await navigator.share({ url, title: photos[viewer.index].alt });
          else { await navigator.clipboard.writeText(url); setPhotoFeedback("Photo link copied"); }
        } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setPhotoFeedback("Couldn’t share the photo. Try saving it instead."); }
      }} />, viewer.host)}
    {photoFeedback && <p role="status" className="photo-feedback">{photoFeedback}</p>}
  </div>;
}

export function ComponentPreview({ name, options = defaultOptions, typingPaused = false }: { name: string; options?: PreviewOptions; typingPaused?: boolean }) {
  const [reaction, setReaction] = useState<TapbackType | undefined>("love");
  const bubble = { direction: options.direction, tail: options.tail, platform: options.platform };
  if (name === "message-bubble") return <div className="bubble-example"><MessageBubble direction="incoming" platform={options.platform} tail>Any plans for the weekend?</MessageBubble><MessageBubble {...bubble} status="Delivered">{options.text || "Hey, you made it."}</MessageBubble></div>;
  if (name === "tapback") return <div className="reaction-example"><div className="reaction-options" aria-label="Choose a reaction">{tapbackTypes.map(type => <Tapback platform={options.platform} key={type} reaction={type} selected={reaction === type} onClick={() => setReaction(reaction === type ? undefined : type)} />)}</div><MessageBubble {...bubble} reactions={reaction ? <Tapback platform={options.platform} reaction={reaction} side={options.direction === "incoming" ? "right" : "left"} /> : undefined}>{options.text}</MessageBubble></div>;
  if (name === "typing-indicator") return <div className="typing-example" role="log" aria-label="Messages" data-typing-paused={typingPaused} style={{ gap: bubbleMetrics[options.platform].gapBetweenGroups }}>
    <div className="typing-messages" style={{ gap: bubbleMetrics[options.platform].gapInGroup }}>
      <MessageBubble direction="incoming" platform={options.platform} tail={false}>Oh my god.</MessageBubble>
      <MessageBubble direction="incoming" platform={options.platform} tail>Dad just called</MessageBubble>
    </div>
    <TypingIndicator platform={options.platform} label="Jamie is typing" />
  </div>;
  if (name === "message-audio") return <div className="voice-example"><MessageBubble direction="incoming" tail platform={options.platform}>You have to hear this one.</MessageBubble><AudioPreview {...bubble} /></div>;
  if (name === "message-attachment") return <div className={`attachment-example ${options.direction}`}><MessageAttachment {...bubble} name="weekend-plans.txt" kind="Text document" size="2 KB" href="/design-notes.txt" download /></div>;
  if (name === "message-image" || name === "image-viewer") return <PhotosPreview key={`${options.photo}-${options.photoCount}`} options={options} />;
  if (name === "link-preview") return <div className={`link-example ${options.direction}`}><MessageBubble direction="incoming" tail platform={options.platform}>Found our next adventure.</MessageBubble><LinkPreview platform={options.platform} href="https://www.visitdolomites.com/" title={options.text} image={options.richLink ? showcasePhotos[options.photo].src : undefined} imageAlt={showcasePhotos[options.photo].alt} target="_blank" /><MessageBubble direction="outgoing" tail platform={options.platform}>Already packing. ✈️</MessageBubble></div>;
  if (name === "avatar") return <div className="avatar-example"><Avatar name="Jamie Lee" initials="JL" size={64} /><Avatar name="Alex" initials="AM" size={48} /><Avatar name="Sam" initials="SK" size={36} /></div>;
  if (name === "date-separator") return <DateSeparator platform={options.platform}>Today 9:41 AM</DateSeparator>;
  return null;
}

const now = Date.UTC(2026, 8, 29, 16, 41);
const initialMessages: Message[] = [
  { id: "intro-1", direction: "incoming", text: "I think we found our weekend plans.", sentAt: now - 60000 },
  { id: "intro-photo", direction: "incoming", text: "", kind: "image", images: [showcasePhotos[0]], sentAt: now - 50000 },
  { id: "intro-2", direction: "outgoing", text: "No way. Where is this?", sentAt: now - 40000 },
  { id: "intro-3", direction: "incoming", text: "The Dolomites. Italy 🇮🇹", sentAt: now - 30000, reactions: [{ type: "love", byMe: true }] },
  { id: "intro-4", direction: "outgoing", text: "Okay, let’s go. ✈️", sentAt: now - 5000, status: "delivered" },
];

export function ConversationDemo({ palette, theme = "light", composerDemo = false, contactDemo = false, viewerPhoto, size = "auto", layout = "playground", inbox }: { palette?: CSSProperties; theme?: "light" | "dark" | "system"; composerDemo?: boolean; contactDemo?: boolean; viewerPhoto?: number; size?: PreviewSize; layout?: "playground" | "standalone"; inbox?: readonly DemoThread[] }) {
  const viewerDemo = viewerPhoto !== undefined;
  const previewTheme = theme === "system" ? undefined : theme;
  const { frame, screenHeight, screenWidth } = usePhonePreview(viewerDemo || contactDemo, layout === "standalone", size, true, layout);
  const [contactOpen, setContactOpen] = useState(contactDemo);
  const appFrame = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<IosConversation[]>(() => inbox?.map(thread => thread.contact) ?? []);
  const [selected, setSelected] = useState<IosConversation>(inbox?.[0]?.contact ?? { id: "jamie", name: "Jamie Lee", initials: "JL", preview: "", time: "9:41 AM" });
  const [chatOpen, setChatOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newDraft, setNewDraft] = useState("");
  const [firstSend, setFirstSend] = useState<{ id: string } | null>(null);
  const [threads, setThreads] = useState<Record<string, Message[]>>(() => inbox ? Object.fromEntries(inbox.map(thread => [thread.contact.id, thread.messages])) : { jamie: viewerDemo
    ? showcasePhotos.map((photo, i) => ({ id: `viewer-photo-${i}`, direction: "incoming", text: "", kind: "image", images: [photo], sentAt: now }))
    : composerDemo ? [initialMessages[0]] : initialMessages.slice(1, 4) });
  const messages = threads[selected.id] ?? [];
  function setMessages(update: (current: Message[]) => Message[]) {
    setThreads(current => ({ ...current, [selected.id]: update(current[selected.id] ?? []) }));
  }
  function openConversation(conversation: IosConversation) {
    setSelected(conversation);
    setChatOpen(true);
    setSearchOpen(false);
    setActive(null);
    setConversations(current => current.map(item => item.id === conversation.id ? { ...item, unread: false } : item));
  }
  function sendTo(conversation: IosConversation, sent: Message[]) {
    if (!sent.length) return;
    sent[sent.length - 1].status = "delivered";
    setThreads(current => ({ ...current, [conversation.id]: [...(current[conversation.id] ?? []).map(message => ({ ...message, status: undefined })), ...sent] }));
    setDrafts(current => ({ ...current, [conversation.id]: "" }));
    setConversations(current => [{ ...conversation, preview: sent.at(-1)!.text || "Sent a photo", time: "9:41 AM", unread: false }, ...current.filter(item => item.id !== conversation.id)]);
  }
  const [photoViewer, setPhotoViewer] = useState<{ id: string; index: number } | null>(viewerDemo ? { id: `viewer-photo-${viewerPhoto}`, index: viewerPhoto! } : null);
  const [photoFeedback, setPhotoFeedback] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const lastMessageId = messages.at(-1)?.id;
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => {
      const log = appFrame.current?.querySelector<HTMLElement>('[data-slot="message-list"]');
      if (log) log.scrollTop = log.scrollHeight - log.clientHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [screenHeight, lastMessageId]);
  function react(id: string, selection: TapbackSelection) {
    setMessages(current => current.map(message => {
      if (message.id !== id) return message;
      const next = { type: "type" in selection ? selection.type : "love", emoji: "emoji" in selection ? selection.emoji : undefined, byMe: true };
      const mine = message.reactions?.find(reaction => reaction.byMe);
      return { ...message, reactions: mine?.type === next.type && mine?.emoji === next.emoji ? [] : [next] };
    }));
    setActive(null);
  }
  function photoAt(id: string, index: number) { return messages.find(message => message.id === id)?.images?.[index]; }
  function savePhoto(id: string, index: number) {
    const photo = photoAt(id, index);
    if (!photo) return;
    const link = document.createElement("a");
    link.href = photo.src;
    link.download = photo.src.split("/").pop()!;
    link.click();
  }
  async function sharePhoto(id: string, index: number) {
    const photo = photoAt(id, index);
    if (!photo) return;
    const url = new URL(photo.src, window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ url, title: photo.alt });
      else { await navigator.clipboard.writeText(url); setPhotoFeedback("Photo link copied"); }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setPhotoFeedback("Couldn’t share the photo. Try saving it instead.");
    }
  }
  return <div ref={frame} className="conversation-demo"><div className="phone-frame"><div data-preview-theme={previewTheme} className={`phone-content ${previewTheme ?? ""}`} style={{ colorScheme: previewTheme, height: screenHeight }}>
    <div className="absolute inset-0" inert={composing || undefined} aria-hidden={composing || undefined}>
    <IosMessagesApp frameRef={appFrame} width={screenWidth} height={screenHeight} photos={showcasePhotos.map((photo, i) => ({ ...photo, id: String(i) }))} style={palette} contact={selected} participants={selected.members} now={now} messages={messages}
    screen={chatOpen ? "conversation" : "list"} conversations={conversations}
    onBack={inbox ? () => { setChatOpen(false); setActive(null); } : undefined} onSelectConversation={openConversation}
    sendAnimation={firstSend ?? undefined} onSendAnimationEnd={() => setFirstSend(null)}
    search={searchOpen ? { query, sections: [{ kind: "conversations", results: conversations.filter(item => `${item.name} ${item.preview}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) }] } : null}
    onOpenSearch={() => { setQuery(""); setSearchOpen(true); }} onSearchQueryChange={setQuery} onCloseSearch={() => setSearchOpen(false)}
    onSearchSelect={result => { const conversation = conversations.find(item => item.id === result.id); if (conversation) openConversation(conversation); }}
    onCompose={() => { setRecipient(""); setNewDraft(""); setComposing(true); }}
    details={contactDemo ? (contactOpen ? {} : null) : undefined}
    onDetails={contactDemo ? () => setContactOpen(true) : undefined}
    onCloseDetails={contactDemo ? () => setContactOpen(false) : undefined}
    detailsContent={contactDemo ? { phone: "+1 (415) 555-0142", phoneLabel: "mobile" } : undefined}
    photoViewer={viewerDemo ? photoViewer : undefined}
    onOpenPhoto={viewerDemo ? (id, index) => {
      const run = photoRun(messages, id);
      setPhotoViewer({ id, index: (run.offsets[run.ids.indexOf(id)] ?? 0) + index });
    } : undefined}
    onPhotoIndexChange={index => setPhotoViewer(current => current ? { ...current, index } : null)}
    onClosePhoto={() => setPhotoViewer(null)} onSharePhoto={sharePhoto} onSavePhoto={savePhoto}
    longPress={active ? { id: active } : null} onLongPress={setActive} onLongPressClose={() => setActive(null)} onTapback={react} composer={{ value: inbox ? drafts[selected.id] ?? "" : undefined, onChange: inbox ? text => setDrafts(current => ({ ...current, [selected.id]: text })) : undefined, onSend: (text, photos) => {
    const sent: Message[] = photos.flatMap(photo => photo.src ? [{ id: crypto.randomUUID(), direction: "outgoing", text: "", kind: "image", images: [{ src: photo.src, alt: photo.alt ?? "Photo" }], sentAt: now }] : []);
    if (text) sent.push({ id: crypto.randomUUID(), direction: "outgoing", text, sentAt: now });
    sendTo(selected, sent);
  } }} />
    </div>
    {composing && <IosNewMessageSheet value={recipient} onChange={setRecipient} onAddContact={() => setRecipient(conversations[0]?.name ?? "Jamie Lee")} onClose={() => setComposing(false)}>
      <IosComposer value={newDraft} onChange={setNewDraft} disabled={!recipient.trim()} onSend={text => {
        const conversation = conversations.find(item => item.name.toLocaleLowerCase() === recipient.trim().toLocaleLowerCase())
          ?? { id: crypto.randomUUID(), name: recipient.trim(), preview: text, time: "9:41 AM" };
        const message: Message = { id: crypto.randomUUID(), direction: "outgoing", text, sentAt: now };
        setFirstSend({ id: message.id }); sendTo(conversation, [message]); setComposing(false); openConversation(conversation);
      }} />
    </IosNewMessageSheet>}
    <span className="sr-only" role="status">{photoFeedback}</span></div></div></div>;
}
