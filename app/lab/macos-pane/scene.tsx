"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MacMessagesApp } from "@/registry/imessage/macos-messages-app";
import { macWindowMetrics } from "@/registry/imessage/macos-window";
import type { Message } from "@/registry/imessage/message-list";
import type { SidebarConversation } from "@/registry/imessage/macos-sidebar";

/**
 * The clock the four pane captures were taken on: their date header reads "Today 1:47 AM"
 * (`conversation-pane-light-partial.png`), which is the only timestamp any of them prints.
 */
const base = new Date(2026, 8, 8, 1, 47).getTime();
const now = new Date(2026, 8, 8, 2, 30).getTime();
/** Seconds from `base`. A step over 60 opens a new cluster, which is what puts a tail on the bubble above. */
const at = (seconds: number) => base + seconds * 1000;

/**
 * One self chat, transcribed from the captures. All four pane captures are the same conversation at
 * three moments, so they share this array and differ only in where it is cut:
 *
 *   `conversation-pane-light-partial.png`  cut after "Blue for iMessage." (index 8), window y 150-640
 *   `conversation-pane-dark.png`           cut after "Sounds good 👍"     (index 14)
 *   `conversation-pane-dark-2.png`         the whole array
 *   `conversation-pane-light.png`          the whole array + a Love on "Second of two"
 *
 * Two things are stated rather than derived, and both are read straight off the captures:
 *
 * - **The tails.** In this self chat they do not follow the 60 s rule: "Ok" and "Blue for iMessage."
 *   carry one with the next bubble 3 pt below them, and "Every detail, down to the last bubble." — a
 *   one-line bubble in the same position — carries none (`-light-partial.png` blue runs at x 600:
 *   21.0-52.0 with a tail, 126.5-153.0 without). SPEC says why: a macOS self chat mirrors every message
 *   as a hidden incoming copy, so its tails are not evidence of clustering. Stating them keeps that out
 *   of the reconstruction.
 * - **The times.** Every gap in all four captures is a 3 pt in-cluster gap (2.74-3.49), plus the 4.76
 *   hang after a tailed bubble, with the 11.5 between-cluster gap appearing only around the emoji-only
 *   message. So the whole thread is one cluster and the steps below are 2 s. Anything larger makes
 *   `buildRows` open an 11.5 gap where the capture has 7.74, which is what put the top of
 *   `-light-partial.png` 7.5 pt out before these times were set.
 */
const thread: Message[] = [
  { id: "hey", direction: "outgoing", sentAt: at(0), text: "Hey! How’s the new project going?", tail: true },
  { id: "details", direction: "outgoing", sentAt: at(2), text: "It’s all in the little details. ✨", tail: false },
  { id: "ok", direction: "outgoing", sentAt: at(4), text: "Ok", tail: true },
  { id: "every", direction: "outgoing", sentAt: at(6), text: "Every detail, down to the last bubble.", tail: false },
  { id: "wave", direction: "outgoing", sentAt: at(8), text: "👋" },
  { id: "long", direction: "outgoing", sentAt: at(10), text: "A longer message should wrap naturally without stretching the conversation. Line breaks stay exactly where you put them. So do emoji 👋 and punctuation.", tail: false },
  { id: "link", direction: "outgoing", sentAt: at(12), text: "https://ui.shadcn.com", kind: "link", link: { url: "https://ui.shadcn.com", host: "ui.shadcn.com" }, tail: false },
  { id: "blue", direction: "outgoing", sentAt: at(14), text: "Blue for iMessage.", tail: true },
];

/** What `conversation-pane-dark.png` adds under it; "Sounds good 👍" is the last bubble it shows. */
const threadRest: Message[] = [
  { id: "one-more", direction: "outgoing", sentAt: at(16), text: "One more thing…", tail: false },
  { id: "corners", direction: "outgoing", sentAt: at(18), text: "The corners should connect.", tail: false },
  { id: "tail-rule", direction: "outgoing", sentAt: at(20), text: "And only the last message gets a tail.", tail: false },
  { id: "green", direction: "outgoing", sentAt: at(22), text: "Green for text messages.", tail: false },
  { id: "tuesday", direction: "outgoing", sentAt: at(24), text: "Tuesday morning at 9?", tail: false },
  { id: "sounds", direction: "outgoing", sentAt: at(26), text: "Sounds good 👍", tail: true },
];

/**
 * The tail-test run at the end of the same thread, the one `conversation-pane-dark-2.png` and
 * `conversation-pane-light.png` are scrolled to. Same strings as the macOS fixture in
 * `app/lab/list/scene.tsx`, which was written from `-dark-2` and is the reason they agree.
 */
const tailRun: Message[] = [
  { id: "m1", direction: "outgoing", sentAt: at(28), text: "First of two, sent back to back", tail: false },
  { id: "m2", direction: "outgoing", sentAt: at(30), text: "Second of two", tail: false },
  { id: "m3", direction: "outgoing", sentAt: at(32), text: "Text right before a link", tail: false },
  { id: "m4", direction: "outgoing", sentAt: at(34), text: "https://apple.com", kind: "link", link: { url: "https://apple.com", host: "apple.com" }, tail: false },
  { id: "m5", direction: "outgoing", sentAt: at(36), text: "👋" },
  { id: "m6", direction: "outgoing", sentAt: at(38), text: "Text right after an emoji", tail: false },
  { id: "m7", direction: "outgoing", sentAt: at(40), text: "A two line message that should wrap onto a second line for the test", tail: true },
  // No `gapBefore` here, unlike the copy of this fixture in `app/lab/list/scene.tsx`: the 8 it forces is
  // what `buildRows` already computes after a tailed bubble (3 + the 4.76 hang), and stating it would
  // hide the component if it ever stopped.
  { id: "m8", direction: "outgoing", sentAt: at(42), text: "Three lines without any emoji at all. This message keeps going so that it wraps onto a third line inside the bubble for the tail test.", tail: false },
  { id: "m9", direction: "outgoing", sentAt: at(44), text: "Four lines now. This one is even longer so that it wraps onto a fourth line inside the bubble, which lets us see whether the tail disappears once a bubble is tall enough, or whether something else is going on.", tail: true },
];

export type PaneScene = "tails" | "thread" | "partial";

/** Window y the capture's first row is: only the light partial starts anywhere but the window's top. */
const cropTop: Record<PaneScene, number> = { tails: 0, thread: 0, partial: 150 };

/** Sidebar rows for the offscreen column. Nothing in a pane crop draws them; the app needs a list. */
const conversations: SidebarConversation[] = [{ id: "ben", name: "Ben", initials: "B", preview: "Four lines now.", time: "1:47 AM" }];

function messagesFor(scene: PaneScene, balloon: boolean): Message[] {
  if (scene === "partial") return thread.map((message, index) => (index === thread.length - 1 ? { ...message, status: "delivered" } : message));
  const rest = [...thread, ...threadRest];
  if (scene === "thread") return rest.map((message, index) => (index === rest.length - 1 ? { ...message, status: "delivered" } : message));
  const all = [...rest, ...tailRun];
  return all.map(message => {
    if (message.id === "m9") return { ...message, status: "delivered" as const };
    // `conversation-pane-light.png` carries one Love, on "Second of two", applied by the account that
    // sent it — so it draws in the own-reaction blue and opens the 27.4 slot above the bubble.
    if (balloon && message.id === "m2") return { ...message, reactions: [{ type: "love", byMe: true }] };
    // A reacted bubble starts its own cluster natively: "First of two" carries no tail in
    // `-dark-2.png` and grows one in `-light.png`, the only difference between those two frames being
    // the Love. `buildRows` does not model that (its `continues` never looks at `reactions`), so the
    // fixture states it; stating it took this frame from 3.33% to 3.03%. It does not close the gap:
    // ours measures 27.34 against native's 30.58, because the row's own margin collapses into the
    // slot's 27.4 marginTop instead of adding to it. See SPEC, "What these labs found", item 4.
    if (balloon && message.id === "m1") return { ...message, tail: true };
    return message;
  });
}

export type MacPaneSceneProps = { scene: PaneScene; theme: "light" | "dark"; text: string; balloon: boolean; focus: boolean };

/**
 * The pane crop, drawn by the shipping shell rather than by lab furniture: `MacMessagesApp` renders the
 * whole 960 x 640 window and the wrapper slides it so window (330, `cropTop`) lands on (0, 0), which is
 * the box every `conversation-pane-*.png` is a crop of. Nothing here positions a bubble, a header or a
 * composer; if a row lands on the wrong device line the component put it there.
 */
export function MacPaneScene({ scene, theme, text, balloon, focus }: MacPaneSceneProps) {
  const [messages] = useState(() => messagesFor(scene, balloon));
  const size = { width: macWindowMetrics.width - macWindowMetrics.sidebarWidth, height: macWindowMetrics.height - cropTop[scene] };
  // Every pane capture was taken with the composer focused: its field prints the *focused* placeholder
  // ("Message", not "iMessage") and holds a caret. `MacMessagesApp` has no `autoFocus`, so the lab does
  // it the way a user would, by focusing the field the shell already rendered.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focus) return;
    root.current?.querySelector<HTMLTextAreaElement>('[data-slot="mac-composer"] textarea')?.focus();
  }, [focus]);
  return (
    <div ref={root} data-testid="lab" className={theme} style={{ ...size, position: "relative", overflow: "hidden", colorScheme: theme } as CSSProperties}>
      <div style={{ position: "absolute", left: -macWindowMetrics.sidebarWidth, top: -cropTop[scene] }}>
        <MacMessagesApp
          contact={{ name: "Ben", initials: "B" }}
          conversations={conversations}
          selectedId="ben"
          messages={messages}
          now={now}
          composer={{ value: text, onChange: () => {}, onSend: () => {} }}
        />
      </div>
    </div>
  );
}
