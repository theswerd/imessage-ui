import registry from "@/registry.json";

export const catalog = registry.items.filter(item => item.name !== "index");
export const components = catalog.filter(item => item.type === "registry:ui");
export const blocks = catalog.filter(item => item.type === "registry:block");

export const usage: Record<string, string> = {
  "ios-details": `"use client";

import { IosDetails } from "@/components/message-ui/ios-details";

export function ContactView({ onBack }: { onBack: () => void }) {
  return <div className="relative h-[874px] w-[402px] max-w-full overflow-hidden">
    <IosDetails
      name="Jamie Lee"
      initials="JL"
      phoneLabel="mobile"
      phone="+1 (415) 555-0142"
      actions={[
        { id: "call", label: "Call", icon: "phone", disabled: true },
        { id: "video", label: "FaceTime", icon: "video", disabled: true },
        { id: "mail", label: "Mail", icon: "mail", disabled: true },
      ]}
      onBack={onBack}
    />
  </div>;
}`,

  "ios-conversation-list": `"use client";

import {
  IosConversationList,
  IosConversationRow,
  type IosConversationListProps,
} from "@/components/message-ui/ios-conversation-list";

const conversations = [
  { id: "jamie", name: "Jamie Lee", initials: "JL",
    preview: "The Dolomites. Italy 🇮🇹", time: "9:41 AM", unread: true },
  { id: "alex", name: "Alex Morgan", initials: "AM",
    preview: "See you Saturday!", time: "Yesterday" },
];

export function Inbox(props: Pick<IosConversationListProps, "onSelect" | "onSearch" | "onCompose">) {
  return <div className="relative h-[680px] w-full max-w-[402px] overflow-hidden">
    <IosConversationList conversations={conversations} {...props} />
  </div>;
}

// Use the same rows inside your own list layout.
export function CustomList({ onSelect }: Pick<IosConversationListProps, "onSelect">) {
  return <ul className="m-0 max-w-[402px] list-none p-0">
    {conversations.map(conversation => <li key={conversation.id}>
      <IosConversationRow conversation={conversation} onSelect={onSelect} />
    </li>)}
  </ul>;
}`,
  avatar: `import { Avatar } from "@/components/message-ui/avatar";

<Avatar initials="JL" />`,
  "image-viewer": `"use client";

import { useState } from "react";
import { ImageViewer, type ImageViewerPhoto } from "@/components/message-ui/image-viewer";

export function PhotoPreview({ photos }: { photos: ImageViewerPhoto[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  return <div className="relative h-[874px] w-full max-w-[402px] overflow-hidden">
    <button onClick={() => { setMounted(true); setOpen(true); }}>Open photos</button>
    {mounted && <ImageViewer photos={photos} platform="ios" open={open}
      onClose={() => setOpen(false)} onExited={() => setMounted(false)} />}
  </div>;
}`,
  "message-bubble": `import { MessageBubble } from "@/components/message-ui/message-bubble";

<MessageBubble direction="outgoing" status="Delivered">
  Hey, you made it. 👋
</MessageBubble>`,
  tapback: `import { Tapback } from "@/components/message-ui/tapback";

<Tapback reaction="love" />
<Tapback reaction="like" selected={liked}
  onClick={() => setLiked(!liked)} />`,
  "typing-indicator": `import { TypingIndicator } from "@/components/message-ui/typing-indicator";

<TypingIndicator label="Alex is typing" />`,
  "message-audio": `"use client";

import { useRef, useState } from "react";
import { MessageAudio } from "@/components/message-ui/message-audio";

export function AudioExample({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  return <>
    <audio ref={audio} src={src} preload="metadata"
      onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
      onTimeUpdate={e => setPosition(e.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onError={() => { setPlaying(false); setError("Audio unavailable."); }} />
    <MessageAudio duration={duration} position={position} playing={playing}
      onSeek={seconds => { if (audio.current) audio.current.currentTime = seconds; }}
      onPlayChange={async next => {
        if (!audio.current) return;
        setError("");
        if (!next) return audio.current.pause();
        if (audio.current.ended) audio.current.currentTime = 0;
        try { await audio.current.play(); }
        catch { setError("Playback failed. Please try again."); }
      }} />
    {error && <p role="alert">{error}</p>}
  </>;
}`,
  palette: `import { PaletteStyle } from "@/components/message-ui/palette";

<div data-im-platform="ios">
  <PaletteStyle platform="ios" />
  {/* Your Messages components */}
</div>`,
  "ios-composer": `import { IosComposer } from "@/components/message-ui/ios-composer";

<IosComposer
  onSend={async (text) => {
    await sendMessage(text);
  }}
/>`,
  "ios-nav-bar": `import { IosNavBar } from "@/components/message-ui/ios-nav-bar";

<IosNavBar name="Alex Morgan" onBack={() => history.back()} />`,
  "ios-messages-app": `import { IosMessagesApp } from "@/components/message-ui/ios-messages-app";

<IosMessagesApp
  contact={{ name: "Alex Morgan" }}
  messages={messages}
  composer={{ onSend: sendMessage }}
/>`,
  "macos-messages-app": `import { MacMessagesApp } from "@/components/message-ui/macos-messages-app";

<MacMessagesApp
  contact={{ name: "Alex Morgan" }}
  conversations={conversations}
  selectedId="alex"
  messages={messages}
  composer={{ onSend: sendMessage }}
/>`,
  "date-separator": `import { DateSeparator } from "@/components/message-ui/date-separator";

<DateSeparator dateTime="2026-09-08T09:41:00-07:00">
  Today 9:41 AM
</DateSeparator>`,
  "link-preview": `import { LinkPreview } from "@/components/message-ui/link-preview";

<LinkPreview
  href="https://ui.shadcn.com"
  title="Build your component library."
  description="Beautifully designed components you can customize."
  image="/your-preview-image.jpg"
  imageAlt="A preview of the component collection"
/>`,
  "message-attachment": `import { MessageAttachment } from "@/components/message-ui/message-attachment";

<MessageAttachment
  name="design-notes.txt"
  size="2 KB · Text document"
  href="/design-notes.txt"
  download
/>`,
  conversation: `"use client";

import { useState } from "react";
import { Conversation } from "@/components/message-ui/conversation";
import type { Message } from "@/components/message-ui/message-list";

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", direction: "incoming", text: "Hey, you made it. 👋", sentAt: Date.now() - 60_000 },
  ]);

  return (
    <Conversation
      platform="ios"
      name="Alex Morgan"
      messages={messages}
      onSend={(text) => setMessages(current => [
        ...current,
        { id: crypto.randomUUID(), direction: "outgoing", text, sentAt: Date.now() },
      ])}
    />
  );
}`,
};
