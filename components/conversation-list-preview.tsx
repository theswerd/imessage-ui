"use client";

import { useState } from "react";
import type { IosConversation } from "@/registry/imessage/ios-conversation-list";
import { IosMessagesApp } from "@/registry/imessage/ios-messages-app";
import type { IosSearchSection } from "@/registry/imessage/ios-search";
import { IosNewMessageSheet } from "@/registry/imessage/ios-new-message-sheet";
import { IosComposer } from "@/registry/imessage/ios-composer";
import { PaletteStyle } from "@/registry/imessage/palette";
import type { Message } from "@/registry/imessage/message-list";
import { usePhonePreview } from "./use-phone-preview";
import type { PreviewSize } from "@/lib/preview-sizes";

const now = Date.UTC(2026, 8, 29, 16, 41);
const fixtures: IosConversation[] = [
  { id: "jamie", name: "Jamie Lee", initials: "JL", preview: "The Dolomites. Italy 🇮🇹", time: "9:41 AM", unread: true },
  { id: "weekend", name: "Weekend plans", preview: "Sam: I’ll bring the coffee. Who’s driving?", time: "9:38 AM", unread: true, members: [{ name: "Sam Kim", initials: "SK" }, { name: "Alex Morgan", initials: "AM" }, { name: "Jamie Lee", initials: "JL" }] },
  { id: "alex", name: "Alex Morgan", initials: "AM", preview: "That light was worth the early start.", time: "9:24 AM" },
  { id: "sam", name: "Sam Kim", initials: "SK", preview: "Sent you the playlist 🎶", time: "Yesterday" },
  { id: "taylor", name: "Taylor Park", initials: "TP", preview: "See you Saturday!", time: "Yesterday" },
  { id: "morgan", name: "Morgan Chen", initials: "MC", preview: "Made it home. Thanks for a lovely weekend.", time: "Monday" },
];

export function ConversationListPreview({ theme, unread, groups, count, size = "auto" }: {
  theme: "light" | "dark"; unread: boolean; groups: boolean; count: number; size?: PreviewSize;
}) {
  const { frame, screenHeight, screenWidth } = usePhonePreview(false, true, size);
  const [conversations, setConversations] = useState(fixtures);
  const [threads, setThreads] = useState<Record<string, Message[]>>(() => Object.fromEntries(fixtures.map(item => [item.id, [
    { id: `${item.id}-1`, direction: "incoming", text: item.preview, sentAt: now - 60_000 },
  ]])));
  // Retain the contact and transcript while the conversation slides back out.
  const [selected, setSelected] = useState<IosConversation>(fixtures[0]);
  const [chatOpen, setChatOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [draft, setDraft] = useState("");
  const [firstSend, setFirstSend] = useState<{ id: string } | null>(null);
  const visible = conversations.filter(item => groups || !item.members).slice(0, count).map(item => ({ ...item, unread: unread && item.unread }));
  const matches = visible.filter(item => `${item.name} ${item.preview}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const sections: IosSearchSection[] = [{ kind: "conversations", results: matches }];

  function open(conversation: IosConversation) {
    setSelected(conversation);
    setChatOpen(true);
    setConversations(current => current.map(item => item.id === conversation.id ? { ...item, unread: false } : item));
    setSearch(false);
  }
  function send(conversation: IosConversation, text: string) {
    const message: Message = { id: crypto.randomUUID(), direction: "outgoing", text, sentAt: now, status: "delivered" };
    // The first send replaces the selected thread, so identify it explicitly instead of treating
    // every conversation opened from the list as a newly sent message.
    if (composing) setFirstSend({ id: message.id });
    setThreads(current => ({ ...current, [conversation.id]: [...(current[conversation.id] ?? []).map(item => ({ ...item, status: undefined })), message] }));
    setConversations(current => [{ ...conversation, preview: text, time: "9:41 AM", unread: false }, ...current.filter(item => item.id !== conversation.id)]);
  }

  return <div ref={frame} className="conversation-demo" data-slot="conversation-list-demo"><div className="phone-frame">
    <div data-im-platform="ios" data-preview-theme={theme} className={`phone-content ${theme}`} style={{ colorScheme: theme, height: screenHeight }}>
      <PaletteStyle platform="ios" />
      <div className="absolute inset-0" inert={composing || undefined} aria-hidden={composing || undefined}>
        <IosMessagesApp width={screenWidth} height={screenHeight} screen={chatOpen ? "conversation" : "list"}
          sendAnimation={firstSend ?? undefined} onSendAnimationEnd={() => setFirstSend(null)}
          conversations={visible} contact={selected} participants={selected.members} messages={threads[selected.id] ?? []} now={now}
          onSelectConversation={open} onBack={() => setChatOpen(false)} composer={{ onSend: text => send(selected, text) }}
          search={search ? { query, sections, maxResults: 20 } : null} onSearchQueryChange={setQuery} onCloseSearch={() => setSearch(false)}
          onOpenSearch={() => { setQuery(""); setSearch(true); }}
          onSearchSelect={result => { const item = conversations.find(item => item.id === result.id); if (item) open(item); }}
          onCompose={() => { setRecipient(""); setDraft(""); setComposing(true); }} />
      </div>
      {composing && <IosNewMessageSheet value={recipient} onChange={setRecipient} onAddContact={() => setRecipient("Jamie Lee")} onClose={() => setComposing(false)}>
        <IosComposer value={draft} onChange={setDraft} disabled={!recipient.trim()} onSend={text => {
          const conversation = conversations.find(item => item.name.toLocaleLowerCase() === recipient.trim().toLocaleLowerCase())
            ?? { id: crypto.randomUUID(), name: recipient.trim(), preview: text, time: "9:41 AM" };
          send(conversation, text); setComposing(false); open(conversation);
        }} />
      </IosNewMessageSheet>}
    </div>
  </div></div>;
}
