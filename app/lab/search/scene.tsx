"use client";

import { useRef, type CSSProperties } from "react";
import { IosConversationList } from "@/registry/imessage/ios-conversation-list";
import { IosSearch, type IosSearchSection } from "@/registry/imessage/ios-search";
import { IosStatusBar } from "@/registry/imessage/ios-status-bar";
import { PlatformProvider } from "@/registry/imessage/platform";
import { palettes, paletteVars } from "@/registry/imessage/tokens";

/**
 * The two conversations the measured captures were taken over. `search-active-light.png` and
 * `search-noresults-dark.png` were shot on the same simulator as `list-light.png`, whose list holds
 * exactly these two threads with empty previews and a 12/31/00 date, so the resting scene lines up
 * with the captures rather than with a prettier fixture.
 */
const captureList = [
  { id: "ja", name: "+1 (888) 555-1212", initials: "JA", preview: "", time: "12/31/00" },
  { id: "kb", name: "+1 (555) 564-8583", initials: "KB", preview: "", time: "12/31/00" },
];

/** A furnished list for the transition scenes, where what the list holds does not matter. */
const demoList = [
  { id: "alex", name: "Alex Morgan", initials: "AM", preview: "Sounds good 👍", time: "9:39 AM" },
  { id: "design", name: "Design Crit", initials: "DC", preview: "Sam Rivera: Tuesday morning at 9?", time: "9:21 AM" },
  { id: "jamie", name: "Jamie Chen", initials: "JC", preview: "You loved “Next week!”", time: "Yesterday" },
  { id: "sam", name: "Sam Rivera", initials: "SR", preview: "But have failed to deliver on performance using it", time: "Yesterday" },
  { id: "riley", name: "Riley Park", initials: "RP", preview: "Risky-signup alerts are still on, so heads up, one just landed.", time: "Yesterday" },
  { id: "freestyle", name: "Freestyle", initials: "F", preview: "See you at demo day.", time: "Monday" },
];

/**
 * Every section kind, with a message whose match sits well past the end of a one-line balloon so the
 * balloon's anchoring is visible: "Tuesday morning at 9 works for the design review." only shows its
 * match because the run before it truncates from the left.
 */
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
  { kind: "documents", results: [
    { id: "d1", title: "Design brief.pdf", time: "Monday" },
    { id: "d2", title: "Design tokens.csv", time: "Sunday" },
  ] },
];

export function SearchLab({ scene, theme, progress }: { scene: string; theme: "light" | "dark"; progress?: number }) {
  const list = useRef<HTMLDivElement>(null);
  const vars = paletteVars(palettes.ios[theme]) as CSSProperties;
  const capture = scene === "active" || scene === "noresults" || scene === "resting";
  // The captures' own clocks, so a whole-frame diff does not fail on the status bar.
  const time = scene === "noresults" ? "11:33" : scene === "active" ? "11:27" : "9:41";
  // The transition scenes carry no query, because the recordings were made by pressing ⌘F on an
  // empty field: at t=0 the pill still shows the mic and the placeholder.
  const query = scene === "noresults" ? "Detail" : scene === "results" ? "design" : "";
  // `close` selects the exit timeline; `progress` seeks it rather than switching it back on.
  const open = scene !== "close";

  return (
    <PlatformProvider platform="ios">
      <div data-testid="lab" className={theme}
        style={{ ...vars, width: 402, height: 874, position: "relative", overflow: "hidden", background: "var(--im-bg)" }}>
        {/*
          The wrapper is what `listRef` moves, and the list's own bottom bar is hidden inside it: the
          search screen draws that bar itself (it is the same bar, and only its trailing glyph and the
          pill's right-hand control change), so leaving both would paint the glass and its shadow
          twice. `resting` is the one scene that keeps the list's bar, because it is the list.
        */}
        <div ref={list} className={`absolute inset-0${scene === "resting" ? "" : " [&_[data-slot=bottom-bar]]:hidden"}`}>
          <IosConversationList conversations={capture ? captureList : demoList} className="absolute inset-0" />
        </div>
        {scene !== "resting" && (
          <IosSearch
            query={query}
            sections={scene === "results" ? sections : []}
            listRef={list}
            open={open}
            progress={progress}
            onSeeAll={() => {}}
            onSelect={() => {}}
          />
        )}
        <IosStatusBar time={time} className="absolute left-0 top-0 z-30" />
      </div>
    </PlatformProvider>
  );
}
