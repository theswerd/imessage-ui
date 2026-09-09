"use client";

import { IosConversationList } from "@/registry/imessage/ios-conversation-list";
import { IosStatusBar } from "@/registry/imessage/ios-status-bar";
import { IosSearch, type IosSearchSection } from "@/registry/imessage/ios-search";

const list = [
  { id: "alex", name: "Alex Morgan", initials: "AM", preview: "Sounds good 👍", time: "9:39 AM" },
  { id: "design", name: "Design Crit", initials: "DC", preview: "Sam Rivera: Tuesday morning at 9?", time: "9:21 AM" },
  { id: "jamie", name: "Jamie Chen", initials: "JC", preview: "You loved “Next week!”", time: "Yesterday" },
  { id: "sam", name: "Sam Rivera", initials: "SR", preview: "But have failed to deliver on performance using it", time: "Yesterday" },
  { id: "riley", name: "Riley Park", initials: "RP", preview: "Risky-signup alerts are still on, so heads up, one just landed.", time: "Yesterday" },
  { id: "freestyle", name: "Freestyle", initials: "F", preview: "See you at demo day.", time: "Monday" },
];

const sections: IosSearchSection[] = [
  { kind: "conversations", results: [
    { id: "design", name: "Design Crit", initials: "DC", preview: "Sam Rivera: Tuesday morning at 9?", time: "9:21 AM" },
    { id: "sam", name: "Sam Rivera", initials: "SR", preview: "But have failed to deliver on performance using it", time: "Yesterday" },
  ] },
  { kind: "messages", results: [
    { id: "m1", name: "Sam Rivera", initials: "SR", conversation: "Design Crit", text: "Tuesday morning at 9 works for the design review.", time: "9:21 AM" },
    { id: "m2", name: "You", initials: "BS", conversation: "Alex Morgan", text: "I moved the design notes into the shared folder this morning.", time: "Yesterday", fromMe: true },
    { id: "m3", name: "Jamie Chen", initials: "JC", text: "Can you send the design file again? The link expired and the design tokens changed.", time: "Monday" },
    { id: "m4", name: "Riley Park", initials: "RP", text: "Design day is on.", time: "Monday" },
    { id: "m5", name: "Freestyle", initials: "F", text: "Design review notes are up.", time: "Sunday" },
  ] },
  { kind: "photos", results: [
    { id: "p1", src: "/fixtures/shore.jpg", name: "Alex Morgan", time: "Yesterday" },
    { id: "p2", src: "/fixtures/ridge.jpg", name: "Jamie Chen", time: "Monday" },
    { id: "p3", src: "/fixtures/bloom.jpg", name: "Sam Rivera", time: "Monday" },
    { id: "p4", src: "/fixtures/dusk.jpg", name: "Riley Park", time: "Sunday" },
    { id: "p5", src: "/fixtures/frost.jpg", name: "Freestyle", time: "Sunday" },
  ] },
  { kind: "links", results: [
    { id: "l1", title: "Design systems at scale", domain: "freestyle.sh", time: "Monday", src: "/fixtures/frost.jpg" },
    { id: "l2", title: "The design of everyday tools", domain: "example.com", time: "Sunday" },
    { id: "l3", title: "Type design notes", domain: "example.org", time: "Sunday" },
  ] },
];

export function SearchVerify({ theme, scene, progress }: { theme: "light" | "dark"; scene: string; progress?: string }) {
  const frame = { width: 402, height: 874, position: "relative", overflow: "hidden", background: theme === "dark" ? "#000000" : "#ffffff" } as const;
  const seek = progress === undefined ? undefined : Number(progress);
  const query = scene === "empty" ? "" : scene === "none" ? "zzzz" : "design";
  return (
    <div data-testid="lab" className={theme} style={frame}>
      <IosConversationList conversations={list} className="absolute inset-0" />
      <IosStatusBar time="9:41" className="absolute left-0 top-0 z-20" />
      <IosSearch
        query={query}
        sections={scene === "none" || scene === "empty" ? [] : scene === "strips" ? [sections[2], sections[3]] : sections}
        progress={seek}
        open={scene !== "closing"}
        onSeeAll={() => {}}
        noResultsDetail={scene === "none" ? "Try a different search." : undefined}
      />
    </div>
  );
}
