"use client";

import { useState, type CSSProperties } from "react";
import { DateSeparator } from "@/registry/imessage/date-separator";
import { GroupAvatar } from "@/registry/imessage/group-avatar";
import { GroupDetails, groupCountText, type GroupDetailsParticipant } from "@/registry/imessage/group-details";
import { IosStatusBar } from "@/registry/imessage/ios-status-bar";
import { MessageBubble } from "@/registry/imessage/message-bubble";
import { PlatformProvider } from "@/registry/imessage/platform";
import { palettes, paletteVars } from "@/registry/imessage/tokens";

export type GroupDetailsScene = "settled" | "scrolled" | "editing" | "long" | "photo";

/**
 * Fixtures. Names and the group name are the ones the other group surfaces in this repo already use,
 * so a diff between two group screens compares the same ink.
 */
const people: GroupDetailsParticipant[] = [
  { id: "ja", name: "Jamie Aldrich", initials: "JA" },
  { id: "kb", name: "Kai Bell", initials: "KB" },
  { id: "rc", name: "Rosa Chen", initials: "RC" },
  { id: "dw", name: "Dana Wu", initials: "DW" },
  { id: "nh", name: "Noor Haddad", initials: "NH" },
  { id: "rd", name: "Robin Diaz", initials: "RD" },
];

const NNBSP = " ";

type Row = { id: string; text: string; direction: "incoming" | "outgoing"; sender?: string; tail?: boolean; cluster?: boolean; status?: string };

/** The group conversation the screen sits over. It is blurred σ18 under the scrim, so it only has to be plausible. */
const thread: Row[] = [
  { id: "a", text: "Are we still on for Saturday?", direction: "incoming", sender: "Jamie Aldrich", tail: true },
  { id: "b", text: "Yes! I booked the table for seven.", direction: "outgoing", tail: true, cluster: true },
  { id: "c", text: "Perfect.", direction: "incoming", sender: "Kai Bell", cluster: true },
  { id: "d", text: "I’ll bring the cake 🎂", direction: "incoming", tail: true },
  { id: "e", text: "Every detail, down to the last bubble.", direction: "outgoing", tail: true, cluster: true, status: "Delivered" },
];

const GAP_IN = 4.3333;
const GAP_BETWEEN = 10.3333;

function Thread() {
  return (
    <div style={{ position: "absolute", top: 205, left: 0, right: 0 }}>
      {thread.map((row, index) => (
        <MessageBubble key={row.id} direction={row.direction} service="imessage" tail={row.tail ?? false}
          sender={row.sender} status={row.status}
          style={{ width: "100%", marginTop: index === 0 ? 0 : row.cluster ? GAP_BETWEEN : GAP_IN, paddingLeft: row.direction === "incoming" ? 16 : 0, paddingRight: row.direction === "outgoing" ? 16 : 0 }}>
          {row.text}
        </MessageBubble>
      ))}
    </div>
  );
}

/** The nav bar the header morphs out of: the group's Ø60 photo, which is what the collapse ends on. */
function Backdrop() {
  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--im-bg)" }}>
      <div style={{ position: "absolute", left: 171, top: 62 }}>
        <GroupAvatar size={60} participants={people.slice(0, 3).map(p => ({ name: p.name, initials: p.initials }))} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 170 }}>
        <DateSeparator service="iMessage" dateTime="2026-09-08T01:25">
          <><span style={{ fontWeight: 500 }}>Today</span>{` 1:25${NNBSP}AM`}</>
        </DateSeparator>
      </div>
      <Thread />
    </div>
  );
}

const photoTiles = [
  { id: "p1", fill: "#c9d8f0", alt: "Harbour at dusk" },
  { id: "p2", fill: "#f2ddc9", alt: "Table for seven" },
  { id: "p3", fill: "#d6ecc9", alt: "The cake" },
  { id: "p4", fill: "#e8cfe0", alt: "Walking home" },
  { id: "p5", fill: "#cfe6e8", alt: "Sunday market" },
  { id: "p6", fill: "#e6e2c9", alt: "Playlist screenshot" },
];

export function GroupDetailsScene({
  scene, theme, progress, scroll, live = false,
}: {
  scene: GroupDetailsScene;
  theme: "light" | "dark";
  progress?: number;
  scroll?: number;
  live?: boolean;
}) {
  const [hideAlerts, setHideAlerts] = useState(false);
  const [name, setName] = useState("Weekend Crew");
  const vars = paletteVars(palettes.ios[theme]) as CSSProperties;
  const frame: CSSProperties = { ...vars, width: 402, height: 874, position: "relative", overflow: "hidden", background: "var(--im-bg)" };
  const members = scene === "long" ? people : people.slice(0, 3);

  return (
    <PlatformProvider platform="ios">
      <div data-testid="lab" className={theme} data-im-platform="ios" style={frame}>
        <GroupDetails
          name={name}
          onNameChange={scene === "editing" ? setName : undefined}
          subtitle={scene === "long" ? groupCountText(members.length) : undefined}
          participants={members}
          visibleParticipants={scene === "long" ? 4 : undefined}
          onShowAllParticipants={scene === "long" ? () => undefined : undefined}
          onAddContact={() => undefined}
          hideAlerts={hideAlerts} onHideAlertsChange={setHideAlerts}
          photos={scene === "photo" || scene === "scrolled" || scene === "long"
            ? {
              items: photoTiles.map(photo => ({
                id: photo.id, alt: photo.alt,
                node: <span style={{ display: "block", width: "100%", height: "100%", background: photo.fill }} />,
              })),
              onOpen: () => undefined,
            }
            : undefined}
          sharedLinks={scene === "photo" || scene === "scrolled" || scene === "long"
            ? { items: [{ id: "l1", title: "The best cake in town", detail: "apple.com", onPress: () => undefined }], onOpen: () => undefined }
            : undefined}
          attachments={scene === "photo" || scene === "long"
            ? { items: [{ id: "a1", title: "menu.pdf", detail: "1.2 MB", onPress: () => undefined }], onOpen: () => undefined }
            : undefined}
          onLeave={() => undefined}
          onBack={() => undefined}
          progress={live ? undefined : (progress ?? 1)}
          scroll={live ? undefined : scroll}
          backdrop={<Backdrop />}
        />
        <IosStatusBar time={theme === "dark" ? "3:14" : "3:10"} className="absolute left-0 top-0" />
      </div>
    </PlatformProvider>
  );
}
