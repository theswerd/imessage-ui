"use client";

import { useState } from "react";
import { IosConversationList, type IosConversation } from "@/registry/imessage/ios-conversation-list";
import { IosStatusBar } from "@/registry/imessage/ios-status-bar";
import { MacSidebar, type SidebarConversation } from "@/registry/imessage/macos-sidebar";
import { MacWindow } from "@/registry/imessage/macos-window";
import { MacHeader } from "@/registry/imessage/macos-header";
import { IosMessagesApp } from "@/registry/imessage/ios-messages-app";
import { MacMessagesApp } from "@/registry/imessage/macos-messages-app";
import type { Message } from "@/registry/imessage/message-list";
import { chatkitIndicatorFrame, chatkitUnread } from "./chatkit";

export type UnreadScene = "list" | "shell" | "row";

/**
 * Fixtures for the unread lab. They are not the harness's `conversationList`: they exist to put every
 * unread case ChatKit distinguishes on one screen at once, in a fixed order, so a diff has something
 * to line up against. Row by row:
 *
 *  1. read, one-to-one — the control. Nothing about it may change when its neighbours go unread.
 *  2. unread, one-to-one — the plain dot.
 *  3. unread, group — the dot sits in the same gutter beside the Snowglobe stack, which is 45 on the
 *     phone and 40 on the Mac; the dot does not move to make room for a wider avatar because it is
 *     placed off `conversationListCellLeftMargin`, the gutter *left* of the avatar, not off the avatar.
 *  4. unread, muted — the same blue dot. ChatKit ships an `unreadIndicatorMutedImage` (a 19 × 20.5
 *     glyph at black 23.9% / #3a3a3a 22.7%) and it is dead: a BL-instruction scan of ChatKit's whole
 *     11.7 MB `__TEXT,__text` finds **zero** call sites for that selector, and
 *     `unreadIndicatorImageForVisibility:withMuteState:` never reads its `withMuteState:` argument —
 *     the disassembly branches on `w2` (visibility) and on nothing else. A muted unread row is a
 *     plain unread row plus the row's own mute glyph.
 *  5. unread, two-line preview — the dot is centred on the row, not on the first line, so a taller
 *     preview must not move it.
 *  6. unread with a count — `-[CKConversationListCell unreadMessageCount]` is read by five call sites
 *     and none of them draws: no row on either platform paints a number. It is announced only.
 *  7. read, long name — a truncation control, so a diff catches a dot that pushes text.
 */
const iosFixtures: IosConversation[] = [
  { id: "read", name: "Alex Morgan", initials: "AM", preview: "Sounds good 👍", time: "9:39 AM" },
  { id: "unread", name: "Jamie Chen", initials: "JC", preview: "Are we still on for tomorrow?", time: "9:41 AM", unread: true },
  { id: "group", name: "Design Crit", preview: "Sam Rivera: Tuesday morning at 9?", time: "9:21 AM", unread: true,
    members: [{ name: "Sam Rivera", initials: "SR" }, { name: "Riley Park", initials: "RP" }, { name: "Jamie Chen", initials: "JC" }] },
  { id: "muted", name: "Riley Park", initials: "RP", preview: "Risky-signup alerts are still on.", time: "Yesterday", unread: true },
  { id: "twoline", name: "Sam Rivera", initials: "SR", unread: true, time: "Yesterday",
    preview: "But have failed to deliver on performance using it, so the preview runs to a second line and the dot must not follow it." },
  { id: "count", name: "Freestyle", initials: "F", preview: "See you at demo day.", time: "Monday", unread: true },
  { id: "long", name: "Alexandra Constantinople", initials: "AC", preview: "A name long enough to truncate.", time: "Monday" },
];

const macFixtures: SidebarConversation[] = [
  { id: "pinned", name: "Freestyle", initials: "F", preview: "See you at demo day.", time: "Monday", pinned: true, unread: true },
  { id: "read", name: "Alex Morgan", initials: "AM", preview: "Sounds good 👍", time: "9:39 AM" },
  { id: "unread", name: "Jamie Chen", initials: "JC", preview: "Are we still on for tomorrow?", time: "9:41 AM", unread: true },
  { id: "group", name: "Design Crit", initials: "DC", preview: "Tuesday morning at 9?", sender: "Sam Rivera", time: "9:21 AM", unread: true,
    members: [{ name: "Sam Rivera", initials: "SR" }, { name: "Riley Park", initials: "RP" }, { name: "Jamie Chen", initials: "JC" }] },
  { id: "muted", name: "Riley Park", initials: "RP", preview: "Risky-signup alerts are still on.", time: "Yesterday", unread: true, muted: true },
  { id: "twoline", name: "Sam Rivera", initials: "SR", time: "Yesterday", unread: true,
    preview: "But have failed to deliver on performance using it, so the preview runs to a second line and the dot must not follow it." },
  { id: "count", name: "Morgan Ellis", initials: "ME", preview: "Three of these are unread.", time: "Monday", unread: 3 },
  { id: "long", name: "Alexandra Constantinople", initials: "AC", preview: "A name long enough to truncate.", time: "Monday" },
];

/** The rows the sidebar actually lays out: a pinned conversation leaves the list for the pinned strip. */
const macRows = macFixtures.filter(item => !item.pinned);

/**
 * A fixed clock, not `Date.now()`: the shell renders a `<time dateTime>` off it and a wall clock
 * ticks between the server render and hydration, which React reports as a mismatch and which would
 * make this lab log an error on every load. 2026-09-08 09:41 matches the status bar the iOS scene
 * draws, so the transcript's date separator reads "Today" against the fixtures' own times.
 */
const shellNow = new Date(2026, 8, 8, 9, 41).getTime();

const shellMessages: Message[] = [
  { id: "s1", direction: "incoming", text: "Are we still on for tomorrow?", sentAt: shellNow - 120_000 },
];

/**
 * The frame ChatKit would give the dot, drawn as a 1-device-pixel outline over the component's own.
 * A component whose dot lands on the framework's frame shows one ring and no blue outside it; one
 * that does not shows the two boxes apart, and the offset is readable straight off the screenshot.
 * Kept out of the default render (`?frames=1`) so the plain scene stays byte-comparable to a capture.
 *
 * It anchors itself to the list's own rows at attach time rather than to a hard-coded top, because
 * both list components are being edited by other agents while this lab exists and a constant here
 * would silently drift a whole point off the moment one of them moves a large title or a pinned
 * strip. A ref callback measuring the real `<ul>` is exact by construction, and it is a plain DOM
 * write — no state, so no effect and no cascading render.
 */
function IndicatorFrames({ platform, rows, unreadAt }: {
  platform: "ios" | "macos";
  rows: number;
  unreadAt: (index: number) => boolean;
}) {
  const spec = chatkitUnread[platform];
  const rowsSelector = platform === "ios" ? '[data-slot="rows"]' : '[data-slot="sidebar-rows"]';
  const hair = 1 / spec.scale;
  const anchor = (node: HTMLDivElement | null) => {
    if (!node) return;
    const host = node.parentElement;
    const list = host?.querySelector(rowsSelector);
    if (!host || !list) return;
    const a = host.getBoundingClientRect(), b = list.getBoundingClientRect();
    node.style.left = `${b.left - a.left}px`;
    node.style.top = `${b.top - a.top}px`;
  };
  return (
    <div ref={anchor} aria-hidden="true" className="pointer-events-none absolute" style={{ left: 0, top: 0 }}>
      {Array.from({ length: rows }, (_, index) => index).filter(unreadAt).map(index => {
        // Every row is the same height here, so one frame serves them all; recomputed per row anyway
        // so a component that ever varies row height shows it.
        const rowHeight = spec.rowHeight;
        const frame = chatkitIndicatorFrame({ leftMargin: spec.leftMargin, size: spec.size, rowHeight, screenScale: spec.scale, displayScale: spec.scale });
        return (
          <span key={index} data-slot="chatkit-frame" data-frame={`${frame.x},${frame.y},${frame.width},${frame.height}`}
            className="absolute rounded-full"
            style={{ left: frame.x, top: index * rowHeight + frame.y, width: frame.width, height: frame.height, boxShadow: `0 0 0 ${hair}px #ff2d55` }} />
        );
      })}
    </div>
  );
}

export type UnreadSceneProps = {
  platform: "ios" | "macos";
  theme: "light" | "dark";
  scene: UnreadScene;
  /** Which row starts selected. On the Mac this is what turns its dot white. */
  selected: string;
  /** Draw ChatKit's computed indicator frames over the component's dots. */
  frames: boolean;
  /** Key window, macOS only: an inactive window keeps the gray selection and a blue dot. */
  active: boolean;
};

export function UnreadScene({ platform, theme, scene, selected, frames, active }: UnreadSceneProps) {
  const [selectedId, setSelectedId] = useState(selected);
  const dark = theme === "dark";

  if (platform === "ios") {
    const frame = { width: 402, height: 874, position: "relative", overflow: "hidden", background: dark ? "#000000" : "#ffffff" } as const;
    if (scene === "shell") {
      return (
        <div data-testid="lab" className={theme} style={frame}>
          <IosMessagesApp screen="list" conversations={iosFixtures} contact={{ name: "Jamie Chen", initials: "JC" }}
            messages={shellMessages} now={shellNow} time="9:41" onSelectConversation={item => setSelectedId(item.id)} />
        </div>
      );
    }
    // `row` crops to the first four rows at 3x-friendly geometry, for a close diff of the dot alone.
    const cropped = scene === "row";
    return (
      <div data-testid="lab" className={theme} style={cropped ? { ...frame, height: Math.round(169.5 + 4 * 86.6667) } : frame}>
        <IosConversationList conversations={iosFixtures} onSelect={item => setSelectedId(item.id)} />
        <IosStatusBar time="9:41" className="absolute left-0 top-0" />
        {frames && <IndicatorFrames platform="ios" rows={iosFixtures.length} unreadAt={index => !!iosFixtures[index]?.unread} />}
        <span className="sr-only" data-slot="lab-selection">{selectedId}</span>
      </div>
    );
  }

  if (scene === "shell") {
    return (
      <div data-testid="lab" className={theme} style={{ width: 960, height: 640, position: "relative", overflow: "hidden", background: dark ? "#1a1d21" : "#d4d4d4" }}>
        <MacMessagesApp active={active} conversations={macFixtures} selectedId={selectedId} onSelectConversation={setSelectedId}
          contact={{ name: "Jamie Chen", initials: "JC" }} messages={shellMessages} now={shellNow} footer="Syncing with iCloud Paused" />
      </div>
    );
  }
  // The sidebar in the window it lives in, so the panel's inset, rim and shadow are the real ones:
  // every sidebar number is in *window* coordinates, and a bare sidebar would put them all 8 off.
  return (
    <div data-testid="lab" className={theme} style={{ width: scene === "row" ? 330 : 960, height: 640, position: "relative", overflow: "hidden", background: dark ? "#1a1d21" : "#d4d4d4" }}>
      <MacWindow
        active={active}
        sidebar={<MacSidebar conversations={macFixtures} selectedId={selectedId} onSelect={setSelectedId} active={active} footer="Syncing with iCloud Paused" />}
        content={<div data-slot="pane" className="relative h-full w-full"><MacHeader name="Jamie Chen" initials="JC" /></div>}
      />
      {frames && <IndicatorFrames platform="macos" rows={macRows.length} unreadAt={index => !!macRows[index]?.unread} />}
    </div>
  );
}
