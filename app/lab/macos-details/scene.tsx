"use client";

import { useState } from "react";
import { MacWindow, macWindowMetrics } from "@/registry/imessage/macos-window";
import { MacSidebar, type SidebarConversation } from "@/registry/imessage/macos-sidebar";
import { MacHeader } from "@/registry/imessage/macos-header";
import { MacComposer } from "@/registry/imessage/macos-composer";
import {
  MacDetails, macDetailsMetrics,
  type MacDetailsAction, type MacDetailsAttachment, type MacDetailsHandle,
  type MacDetailsLink, type MacDetailsParticipant, type MacDetailsPhoto, type MacDetailsTab,
} from "@/registry/imessage/macos-details";

/** The same fixture conversations `/lab/macos-chrome` uses, so the two scenes are comparable. */
const conversations: SidebarConversation[] = [
  { id: "freestyle", name: "Freestyle", initials: "F", preview: "Deploy finished. Every detail, down to the last bubble.", time: "1:47 AM", pinned: true },
  { id: "ben", name: "Ben", initials: "B", preview: "Every detail, down to the last bubble.", time: "1:47 AM" },
  { id: "alex", name: "Alex Morgan", initials: "AM", preview: "Hey! How’s the new project going? It’s all in the little details.", time: "Yesterday" },
  { id: "jamie", name: "Jamie Chen", initials: "JC", preview: "Sounds good 👍", time: "Tuesday" },
  { id: "sam", name: "Sam Rivera", initials: "SR", preview: "Tuesday morning at 9?", time: "Monday", muted: true },
];

/**
 * Flat tiles rather than photographs: a capture diff wants the grid's geometry, not its content, and
 * a bitmap here would be one more thing that has to match. The fills are arbitrary.
 */
const photos: MacDetailsPhoto[] = [
  "#9fb7d4", "#c9a9b8", "#a8c3a4", "#d3c39a", "#a5a9c8", "#c0b0a0",
  "#8fb0c6", "#bda4c4", "#9cc0b2", "#cbb894",
].map((fill, index) => ({ id: `p${index}`, fill, alt: `Shared photo ${index + 1}` }));

const links: MacDetailsLink[] = [
  { id: "l1", title: "Every detail, down to the last bubble", host: "freestyle.sh" },
  { id: "l2", title: "SF Symbols 7", host: "developer.apple.com" },
  { id: "l3", title: "Human Interface Guidelines — Materials", host: "developer.apple.com" },
  { id: "l4", title: "Tuesday’s agenda", host: "notes.example.com" },
];

const attachments: MacDetailsAttachment[] = [
  { id: "a1", name: "Kickoff notes.pdf", meta: "1.2 MB · Yesterday" },
  { id: "a2", name: "Bubble geometry.sketch", meta: "8.4 MB · Monday" },
  { id: "a3", name: "measurements.csv", meta: "14 KB · Monday" },
  { id: "a4", name: "Transcript.txt", meta: "3 KB · Last week" },
];

const handles: MacDetailsHandle[] = [
  { id: "h1", label: "iMessage", value: "alex.morgan@example.com" },
  { id: "h2", label: "phone", value: "+1 (555) 010-0100" },
];

const groupPeople: MacDetailsParticipant[] = [
  { id: "alex", name: "Alex Morgan", initials: "AM", subtitle: "alex.morgan@example.com" },
  { id: "jamie", name: "Jamie Chen", initials: "JC", subtitle: "+1 (555) 010-0142" },
  { id: "sam", name: "Sam Rivera", initials: "SR", subtitle: "+1 (555) 010-0177" },
];

/** `CommunicationDetails.loctable`'s own action titles. The third disc is the envelope the one
 *  capture of this view draws; `message` is the fourth glyph the component carries. */
const actions: MacDetailsAction[] = [
  { id: "call", label: "Call", icon: "phone" },
  { id: "facetime", label: "FaceTime", icon: "video" },
  { id: "mail", label: "Mail", icon: "mail", disabled: true },
];

export type MacDetailsSceneProps = {
  scene: "window" | "panel" | "pushed";
  theme: "light" | "dark";
  tab: MacDetailsTab;
  group: boolean;
  people: boolean;
  empty: boolean;
  mode: "push" | "overlay";
  width?: number;
  open: boolean;
  progress?: number;
};

export function MacDetailsScene({ scene, theme, tab, group, people, empty, mode, width, open, progress }: MacDetailsSceneProps) {
  const [selected, setSelected] = useState("alex");
  const [hideAlerts, setHideAlerts] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [sharedWithYou, setSharedWithYou] = useState(true);
  const [activeTab, setActiveTab] = useState<MacDetailsTab>(tab);
  const [columnWidth, setColumnWidth] = useState(width ?? macDetailsMetrics.width);

  const m = macDetailsMetrics;
  // Panel box in window coordinates: inset 8 from the trailing edge, top and bottom.
  const panelLeft = macWindowMetrics.width - m.inset - columnWidth;
  const panelHeight = macWindowMetrics.height - m.inset * 2;

  // MacComposer's field is the measured 530 inside a 630 pane, i.e. 50 of margin each side; the
  // pushed pane is narrower, so the field follows it.
  const paneWidth = macWindowMetrics.width - (scene === "pushed" ? 0 : macWindowMetrics.sidebarWidth) - (mode === "push" ? m.inset + columnWidth + m.gapToPane : 0);

  const size = scene === "panel"
    ? { width: columnWidth, height: panelHeight }
    : { width: macWindowMetrics.width, height: macWindowMetrics.height };
  const ox = scene === "panel" ? -panelLeft : 0;
  const oy = scene === "panel" ? -m.inset : 0;

  const details = (
    <MacDetails
      name={group ? "Design" : "Alex Morgan"}
      initials={group ? "D" : "AM"}
      subtitle={group ? "3 People" : "alex.morgan@example.com"}
      participants={group ? groupPeople : undefined}
      actions={actions}
      handles={group ? [] : handles}
      onCreateContact={group ? undefined : () => {}}
      onAddToContact={group ? undefined : () => {}}
      photos={empty ? [] : photos}
      links={empty ? [] : links}
      attachments={empty ? [] : attachments}
      hideAlerts={hideAlerts}
      onHideAlertsChange={setHideAlerts}
      readReceipts={readReceipts}
      onReadReceiptsChange={setReadReceipts}
      sharedWithYou={sharedWithYou}
      onSharedWithYouChange={setSharedWithYou}
      onLeave={group ? () => {} : undefined}
      onBlock={group ? undefined : () => {}}
      onDelete={() => {}}
      onClose={() => {}}
      defaultParticipantsOpen={people}
      tab={activeTab}
      onTabChange={setActiveTab}
      mode={mode}
      width={columnWidth}
      onWidthChange={setColumnWidth}
      open={open}
      progress={progress}
      conversation={
        <div data-slot="pane" className="relative size-full bg-white dark:bg-[#1e1e1e]">
          {/* The sidebar edge casts a soft shadow onto the pane (measured: 12/255 at x 0 fading out
              by x 25) — the same treatment `/lab/macos-chrome` uses. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-[25px]"
            style={{ background: theme === "dark" ? "linear-gradient(to right, rgba(0,0,0,0.07), rgba(0,0,0,0))" : "linear-gradient(to right, rgba(0,0,0,0.045), rgba(0,0,0,0))" }} />
          <MacHeader name={group ? "Design" : "Alex Morgan"} initials={group ? "D" : "AM"} />
          <MacComposer onSend={() => {}} fieldWidth={Math.max(120, paneWidth - 100)} />
        </div>
      }
    />
  );

  return (
    <div data-testid="lab" className={theme} style={{ ...size, position: "relative", overflow: "hidden", background: theme === "dark" ? "#1a1d21" : "#d4d4d4" }}>
      <div style={{ position: "absolute", left: ox, top: oy }}>
        {scene === "pushed" ? (
          // No window chrome and no sidebar: the whole 960×640 is the conversation plus the
          // inspector, which is the cleanest read of the push inset (8 + width + 2).
          <div style={{ width: macWindowMetrics.width, height: macWindowMetrics.height, position: "relative", overflow: "hidden" }}>
            {details}
          </div>
        ) : (
          <MacWindow
            sidebar={<MacSidebar conversations={conversations} selectedId={selected} onSelect={setSelected} footer="Syncing with iCloud Paused" />}
            content={details}
          />
        )}
      </div>
    </div>
  );
}
