import registry from "@/registry.json";

export const catalog = registry.items.filter(item => item.name !== "index");
export const components = catalog.filter(item => item.type === "registry:ui");
export const blocks = catalog.filter(item => item.type === "registry:block");

export const usage: Record<string, string> = {
  "message-bubble": `import { MessageBubble } from "@/components/imessage/message-bubble";

<MessageBubble direction="outgoing" status="Delivered">
  Hey, you made it. 👋
</MessageBubble>`,
  tapback: `import { Tapback } from "@/components/imessage/tapback";

<Tapback reaction="love" />
<Tapback reaction="like" selected={liked}
  onClick={() => setLiked(!liked)} />`,
  "typing-indicator": `import { TypingIndicator } from "@/components/imessage/typing-indicator";

<TypingIndicator label="Alex is typing" />`,
  "ios-composer": `import { IosComposer } from "@/components/imessage/ios-composer";

<IosComposer
  onSend={async (text) => {
    await sendMessage(text);
  }}
/>`,
  "ios-nav-bar": `import { IosNavBar } from "@/components/imessage/ios-nav-bar";

<IosNavBar name="Alex Morgan" onBack={() => history.back()} />`,
  "ios-messages-app": `import { IosMessagesApp } from "@/components/imessage/ios-messages-app";

<IosMessagesApp
  contact={{ name: "Alex Morgan" }}
  messages={messages}
  composer={{ onSend: sendMessage }}
/>`,
  "macos-messages-app": `import { MacMessagesApp } from "@/components/imessage/macos-messages-app";

<MacMessagesApp
  contact={{ name: "Alex Morgan" }}
  conversations={conversations}
  selectedId="alex"
  messages={messages}
  composer={{ onSend: sendMessage }}
/>`,
  "date-separator": `import { DateSeparator } from "@/components/imessage/date-separator";

<DateSeparator dateTime="2026-09-08T09:41:00-07:00">
  Today 9:41 AM
</DateSeparator>`,
  "link-preview": `import { LinkPreview } from "@/components/imessage/link-preview";

<LinkPreview
  href="https://ui.shadcn.com"
  title="Build your component library."
  description="Beautifully designed components you can customize."
/>`,
  "message-attachment": `import { MessageAttachment } from "@/components/imessage/message-attachment";

<MessageAttachment
  name="design-notes.txt"
  size="2 KB · Text document"
  href="/design-notes.txt"
  download
/>`,
  conversation: `"use client";

import { useState } from "react";
import { Conversation } from "@/components/imessage/conversation";
import type { Message } from "@/components/imessage/message-list";

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
