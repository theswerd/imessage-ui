"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { ConversationDemo } from "./registry-preview";
import { homeInbox } from "@/lib/home-inbox";

export function HomePreview() {
  const [revision, setRevision] = useState(0);
  return <div className="home-preview" aria-label="Try a conversation">
    <ConversationDemo key={revision} theme="system" size="standard" layout="standalone" inbox={homeInbox} />
    <button type="button" className="home-preview-reset" aria-label="Reset preview" onClick={() => setRevision(value => value + 1)}><RotateCcw size={12} aria-hidden="true" /> Reset</button>
  </div>;
}
