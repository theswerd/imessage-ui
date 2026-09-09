"use client";

import { useState } from "react";
import { MacWindow, macWindowMetrics } from "@/registry/imessage/macos-window";
import { MacSidebar, type SidebarConversation } from "@/registry/imessage/macos-sidebar";
import { MacHeader } from "@/registry/imessage/macos-header";
import { MacComposer } from "@/registry/imessage/macos-composer";
import {
  MacDetails, macDetailsMetrics,
  type MacDetailsAction, type MacDetailsLocationAction, type MacDetailsMapPin,
  type MacDetailsParticipant, type MacDetailsPhoto, type MacDetailsTab,
} from "@/registry/imessage/macos-details";

/**
 * Fixture people. The capture this pane is fitted to is a real conversation with real people in it
 * and is **not in this repo**; nothing here is from it. These are the same fixtures the rest of the
 * lab uses.
 */
const conversations: SidebarConversation[] = [
  { id: "freestyle", name: "Freestyle", initials: "F", preview: "Deploy finished. Every detail, down to the last bubble.", time: "1:47 AM", pinned: true },
  { id: "design", name: "Design Crit", initials: "DC", preview: "Tuesday morning at 9?", time: "9:21 AM" },
  { id: "alex", name: "Alex Morgan", initials: "AM", preview: "Sounds good 👍", time: "9:39 AM" },
  { id: "jamie", name: "Jamie Chen", initials: "JC", preview: "You loved “Next week!”", time: "Yesterday" },
  { id: "sam", name: "Sam Rivera", initials: "SR", preview: "But have failed to deliver on performance", time: "Yesterday", muted: true },
];

const people: MacDetailsParticipant[] = [
  { id: "alex", name: "Alex Morgan", initials: "AM", subtitle: "alex.morgan@example.com" },
  { id: "jamie", name: "Jamie Chen", initials: "JC", subtitle: "+1 (555) 010-0142" },
];

/** Fractions of the map card, so the pins sit where the capture puts them without carrying a map. */
const pins: MacDetailsMapPin[] = [
  { id: "alex", name: "Alex Morgan", initials: "AM", x: 0.58, y: 0.42 },
  { id: "jamie", name: "Jamie Chen", initials: "JC", x: 0.41, y: 0.58 },
];

/** `CommunicationDetails.loctable`'s own action titles; the capture draws Mail dimmed. */
const actions: MacDetailsAction[] = [
  { id: "call", label: "Call", icon: "phone" },
  { id: "facetime", label: "FaceTime", icon: "video" },
  { id: "mail", label: "Mail", icon: "mail", disabled: true },
];

const locationActions: MacDetailsLocationAction[] = [
  { id: "stop", label: "Stop Sharing My Location", tone: "red" },
  { id: "send", label: "Send My Current Location", tone: "yellow" },
];

/** Flat tiles, not photographs: a capture diff wants geometry, not content. */
const tiles = (prefix: string, fills: string[]): MacDetailsPhoto[] =>
  fills.map((fill, index) => ({ id: `${prefix}${index}`, fill, alt: `${prefix} ${index + 1}` }));

const backgrounds = tiles("bg", ["#2b3a55", "#4a3b52", "#31473a", "#4d4330", "#343a56", "#3f3a34"]);
const photos = tiles("photo", ["#9fb7d4", "#c9a9b8", "#a8c3a4", "#d3c39a", "#a5a9c8", "#c0b0a0", "#8fb0c6", "#bda4c4", "#9cc0b2"]);

const links = [
  { id: "l1", title: "Every detail, down to the last bubble", host: "freestyle.sh" },
  { id: "l2", title: "SF Symbols 7", host: "developer.apple.com" },
  { id: "l3", title: "Human Interface Guidelines — Materials", host: "developer.apple.com" },
];

/**
 * A stand-in for the Find My map. The capture's map is a real city and cannot be reproduced or
 * copied; this is a flat plate at the measured card size so the card's *geometry* is diffable and
 * nothing pretends the map itself is measured.
 */
function MapPlate() {
  return (
    <div className="size-full" style={{ background: "linear-gradient(115deg, #3d4550 0%, #39424f 46%, #2a3a6e 62%, #24357c 100%)" }} />
  );
}

export type MacDetailsPaneSceneProps = {
  scene: "window" | "pane";
  theme: "light" | "dark";
  tab: MacDetailsTab;
  /** The measured behaviour: opening the inspector collapses the conversation list. */
  sidebar: boolean;
  people: boolean;
  open: boolean;
  progress?: number;
  width?: number;
};

export function MacDetailsPaneScene({ scene, theme, tab, sidebar, people: withPeople, open, progress, width }: MacDetailsPaneSceneProps) {
  const [selected, setSelected] = useState("freestyle");
  const [activeTab, setActiveTab] = useState<MacDetailsTab>(tab);
  const columnWidth = width ?? macDetailsMetrics.width;

  // Measured: the column is flush, so it starts at window width − column width and the divider is
  // its own leading edge. `scene=pane` crops to exactly that box.
  const paneLeft = macWindowMetrics.width - columnWidth;

  const size = scene === "pane"
    ? { width: columnWidth, height: macWindowMetrics.height }
    : { width: macWindowMetrics.width, height: macWindowMetrics.height };

  const details = (
    <MacDetails
      name="Freestyle"
      initials="F"
      participants={withPeople ? people : []}
      actions={actions}
      onEdit={() => {}}
      onAddParticipant={() => {}}
      map={<MapPlate />}
      mapTitle="Freestyle"
      mapSubtitle={`${(withPeople ? people : []).length} People`}
      mapPins={withPeople ? pins : []}
      onOpenFindMy={() => {}}
      locationActions={locationActions}
      backgrounds={backgrounds}
      photos={photos}
      links={links}
      onClose={() => {}}
      tab={activeTab}
      onTabChange={setActiveTab}
      width={columnWidth}
      open={open}
      progress={progress}
      conversation={
        <div data-slot="pane" className="relative size-full bg-white dark:bg-[#1e1e1e]">
          <MacHeader name="Freestyle" initials="F" />
          <MacComposer onSend={() => {}} fieldWidth={Math.max(120, (sidebar ? paneLeft - macWindowMetrics.sidebarWidth : paneLeft) - 100)} />
        </div>
      }
    />
  );

  return (
    <div data-testid="lab" className={theme} style={{ ...size, position: "relative", overflow: "hidden", background: theme === "dark" ? "#1a1d21" : "#d4d4d4" }}>
      <div style={{ position: "absolute", left: scene === "pane" ? -paneLeft : 0, top: 0 }}>
        {sidebar ? (
          <MacWindow
            sidebar={<MacSidebar conversations={conversations} selectedId={selected} onSelect={setSelected} footer="Syncing with iCloud Paused" />}
            content={details} />
        ) : (
          // The measured arrangement: `Show Details` collapses the list, so the window is the
          // transcript plus the column and nothing else — a zero-width sidebar slot.
          <MacWindow sidebarWidth={0} content={details} />
        )}
      </div>
    </div>
  );
}
