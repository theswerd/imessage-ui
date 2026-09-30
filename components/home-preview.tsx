"use client";

import { ConversationDemo } from "./registry-preview";
import { homeInbox } from "@/lib/home-inbox";

export function HomePreview() {
  return <div className="home-preview" aria-label="Try a conversation">
    <ConversationDemo theme="system" size="standard" layout="standalone" inbox={homeInbox} />
  </div>;
}
