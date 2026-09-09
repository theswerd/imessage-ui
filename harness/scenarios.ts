import type { Direction, Service } from "@/registry/imessage/tokens";
import type { FaceTimeState } from "@/registry/imessage/facetime-card";
import type { BubbleEffectKind, ScreenEffectKind } from "@/registry/imessage/message-effects";

export type Platform = "ios" | "macos";
export const platforms = { ios: { title: "iOS 26", width: 402, height: 874, scale: 3 }, macos: { title: "macOS 26", width: 960, height: 640, scale: 2 } } as const;

/** Motion timings measured from native 60 fps recordings (see references/SPEC.md). */
export const nativeMotion = {
  /** Return pressed → bubble settled in its slot. */
  send: 350,
  /** Hold before the menu opens, then the menu/bar transition. */
  longPressHold: 500,
  longPressOpen: 380,
  /** Menu dissolve → balloon pop when applying a tapback (macOS measured; iOS assumed equal). */
  tapbackApply: 420,
  /** Incoming bubble pop after the typing indicator. */
  receive: 300,
  /** Swipe-to-reveal times spring back. */
  swipeRelease: 300,
} as const;

/**
 * Motion with no capture behind it. UNVERIFIED: nothing in `references/` records a screen change or
 * a reply thread, so none of these is a reading. They mirror the components' own provisional
 * numbers (`iosScreenTransition` in `ios-messages-app.tsx`, `replyThreadMotion` in
 * `message-reply.tsx`) and have to move with them; they are copied rather than imported so this
 * file, which the unit tests load on its own, stays free of component code.
 */
export const unverifiedMotion = {
  /** Pushing into a conversation, and the pop back to the list. */
  push: 350,
  pop: 320,
  /** The New Message sheet coming up from the bottom. */
  sheet: 400,
  /** The thread overlay arriving, and leaving. */
  threadOpen: 260,
  threadClose: 200,
} as const;

export type Reaction = { type: "love" | "like" | "dislike" | "laugh" | "emphasize" | "question" | "emoji"; emoji?: string; byMe: boolean };
export type FixtureMessage = {
  id: string;
  text: string;
  direction: Direction;
  /** Minutes before "now" (9:41 AM). */
  minutesAgo: number;
  service?: Service;
  sender?: string;
  senderInitials?: string;
  status?: "sending" | "delivered" | "read";
  readMinutesAgo?: number;
  edited?: boolean;
  reactions?: Reaction[];
  link?: { url: string; host: string; title?: string };
  attachment?: { name: string; size: string; href: string };
  images?: Array<{ src: string; alt: string }>;
  audio?: { duration: number };
  replyTo?: { id: string; text: string; direction: Direction; sender?: string };
  replyCount?: number;
  effect?: "slam" | "loud" | "gentle" | "invisible-ink";
  failed?: boolean;
};

export const contact = { name: "Alex Morgan", initials: "AM", handle: "alex.morgan@example.com" } as const;
export const now = new Date("2026-09-08T09:41:00-07:00");

/** The default two-person conversation. Messages are grouped into clusters by their timestamps. */
export const conversation: FixtureMessage[] = [
  { id: "m1", direction: "incoming", text: "Hey! How’s the new project going?", minutesAgo: 95 },
  { id: "m2", direction: "outgoing", text: "It’s starting to feel pretty familiar.", minutesAgo: 94, status: "read", readMinutesAgo: 93 },
  { id: "m3", direction: "outgoing", text: "Every detail, down to the last bubble.", minutesAgo: 94 },
  { id: "m4", direction: "incoming", text: "It’s all in the little details. ✨", minutesAgo: 31 },
  { id: "m5", direction: "incoming", text: "Tuesday morning at 9?", minutesAgo: 31 },
  { id: "m6", direction: "outgoing", text: "Sounds good 👍", minutesAgo: 2, status: "delivered" },
];

/**
 * The same conversation with a thread hanging off "Tuesday morning at 9?": that message carries a
 * reply count and two messages reply to it. It is the one fixture that drives the reply surfaces
 * through the real log rather than through a lab page, so the quoted stub above a reply, the count
 * under the message it belongs to, and the thread the count opens all have something to render.
 */
export const threadConversation: FixtureMessage[] = [
  ...conversation.slice(0, 5).map(message => (message.id === "m5" ? { ...message, replyCount: 2 } : message)),
  { id: "r1", direction: "outgoing", text: "Works for me.", minutesAgo: 30,
    replyTo: { id: "m5", text: "Tuesday morning at 9?", direction: "incoming", sender: contact.name } },
  { id: "r2", direction: "incoming", text: "Great, I will send an invite.", minutesAgo: 29,
    replyTo: { id: "m5", text: "Tuesday morning at 9?", direction: "incoming", sender: contact.name } },
  ...conversation.slice(5),
];

export const scenarios = [
  { id: "conversation", title: "Conversation", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "outgoing", title: "Send a message", group: "Messages", duration: 1400, checkpoints: [0, 17, 130, 200, 350, 1200] },
  { id: "incoming", title: "Receive a message", group: "Messages", duration: 1600, checkpoints: [0, 700, 850, 1000, 1500] },
  { id: "grouped", title: "Clusters and tails", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "long-text", title: "Long text and wrapping", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "emoji", title: "Emoji only", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "group-chat", title: "Group chat", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "sms", title: "Text message (SMS)", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "link-preview", title: "Link preview", group: "Previews", duration: 0, checkpoints: [0] },
  { id: "attachment", title: "File preview", group: "Previews", duration: 0, checkpoints: [0] },
  { id: "photos", title: "Photos", group: "Previews", duration: 0, checkpoints: [0] },
  { id: "audio", title: "Audio message", group: "Previews", duration: 0, checkpoints: [0] },
  { id: "reply", title: "Inline reply", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "failed", title: "Not delivered", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "pressed", title: "Press and hold", group: "Interactions", duration: 500, checkpoints: [0, 250, 500] },
  { id: "long-press", title: "Tapback menu", group: "Interactions", duration: 880, checkpoints: [0, 500, 560, 630, 700, 880] },
  { id: "tapback", title: "Apply a Tapback", group: "Interactions", duration: 600, checkpoints: [0, 150, 300, 450, 600] },
  { id: "reactions", title: "Reactions on bubbles", group: "Interactions", duration: 0, checkpoints: [0] },
  { id: "swipe-times", title: "Swipe for times", group: "Interactions", duration: 400, checkpoints: [0, 200, 400] },
  { id: "select-mode", title: "Select messages", group: "Interactions", duration: 0, checkpoints: [0] },
  { id: "selected-message", title: "Click to select", group: "Interactions", duration: 0, checkpoints: [0], only: "macos" },
  { id: "typing", title: "Typing indicator", group: "Interactions", duration: 1200, checkpoints: [0, 200, 400, 800] },
  // The transitions all ride the iOS sheet curve, which spends most of its travel in the first
  // third, so the checkpoints are packed there rather than spread evenly over the duration.
  { id: "thread-open", title: "Open a thread", group: "Interactions", duration: 260, checkpoints: [0, 30, 70, 140, 260], only: "ios" },
  { id: "thread-close", title: "Close a thread", group: "Interactions", duration: 200, checkpoints: [0, 100, 150, 180, 200], only: "ios" },
  { id: "list", title: "Conversation list", group: "Screens", duration: 0, checkpoints: [0] },
  { id: "push-conversation", title: "Push a conversation", group: "Screens", duration: 350, checkpoints: [0, 40, 90, 180, 350], only: "ios" },
  { id: "push-back", title: "Back to the list", group: "Screens", duration: 320, checkpoints: [0, 40, 90, 180, 320], only: "ios" },
  { id: "new-message", title: "New message", group: "Screens", duration: 0, checkpoints: [0] },
  { id: "new-message-sheet", title: "Present New Message", group: "Screens", duration: 400, checkpoints: [0, 50, 100, 200, 400], only: "ios" },
  { id: "details", title: "Conversation details", group: "Screens", duration: 0, checkpoints: [0] },
  { id: "plus-menu", title: "Plus menu", group: "Screens", duration: 0, checkpoints: [0] },
  { id: "context-menu", title: "Context menu", group: "Screens", duration: 0, checkpoints: [0], only: "macos" },
  { id: "effect-slam", title: "Slam", group: "Effects", duration: 700, checkpoints: [0, 120, 260, 460, 700] },
  { id: "effect-loud", title: "Loud", group: "Effects", duration: 900, checkpoints: [0, 130, 300, 560, 900] },
  { id: "effect-gentle", title: "Gentle", group: "Effects", duration: 800, checkpoints: [0, 160, 400, 800] },
  { id: "effect-invisible-ink", title: "Invisible Ink", group: "Effects", duration: 1200, checkpoints: [0, 600, 1200] },
  { id: "effect-confetti", title: "Confetti", group: "Effects", duration: 4200, checkpoints: [0, 900, 1900, 3000, 4200] },
  { id: "effect-love", title: "Love", group: "Effects", duration: 2600, checkpoints: [0, 600, 1200, 2000, 2600] },
  { id: "effect-fireworks", title: "Fireworks", group: "Effects", duration: 3600, checkpoints: [0, 800, 1600, 2600, 3600] },
  { id: "effects-picker", title: "Send with effect", group: "Effects", duration: 2400, checkpoints: [0, 400, 760, 1400, 2400], only: "ios" },
  { id: "effects-picker-screen", title: "Send with effect: Screen", group: "Effects", duration: 1600, checkpoints: [0, 600, 1600], only: "ios" },
  { id: "facetime", title: "FaceTime invitation", group: "FaceTime", duration: 3200, checkpoints: [0, 600, 1800, 3200] },
  { id: "facetime-missed", title: "Missed FaceTime", group: "FaceTime", duration: 0, checkpoints: [0] },
] as const;
export type ScenarioId = typeof scenarios[number]["id"];
/** A scenario with `only` exists on that platform alone; the other shell has no such surface. */
export function scenarioRuns(id: ScenarioId, platform: Platform): boolean {
  const only = (scenarios.find(scenario => scenario.id === id) as { only?: Platform } | undefined)?.only;
  return only === undefined || only === platform;
}
export const scenarioGroups = ["Messages", "Previews", "Interactions", "Screens", "Effects", "FaceTime"] as const;

export type SceneFrame = {
  messages: FixtureMessage[];
  /** Group chat metadata when the scene is a group. */
  group?: { name: string; participants: string[] };
  typing: boolean;
  /** A message currently animating in (send or receive) and how far along it is (0–1). */
  arrival?: { id: string; progress: number; kind: "send" | "receive" };
  /** Press-and-hold feedback progress (0–1) on a message. */
  pressed?: { id: string; progress: number };
  /** Long-press menu open progress (0–1) on a message; 1 = settled. */
  longPress?: { id: string; progress: number };
  /** A tapback being applied: balloon pop progress (0–1). */
  tapbackApply?: { id: string; reaction: Reaction; progress: number };
  /** Swipe-to-reveal-times progress (0–1). */
  swipe: number;
  selectMode?: { selected: string[] };
  /** macOS click-to-select: the messages a click has left selected. iOS has no such state. */
  selectedMessageIds?: string[];
  screen: "conversation" | "list" | "new-message" | "details";
  /**
   * A screen change in flight: the shell is on `screen`, arriving `from`, scrubbed to `progress`.
   * A scrubbed frame has no change to observe, so the transition is stated rather than derived.
   */
  screenTransition?: { from: "conversation" | "list" | "new-message"; progress: number };
  /** The reply thread on a message is open, its entrance scrubbed to `progress` (0..1). */
  thread?: { rootId: string; progress: number };
  menu?: "plus" | "context";
  call?: FaceTimeState;
  composerDraft?: string;
  /** A send effect playing on `id`, scrubbed to `progress` (0..1). */
  effect?: { id: string; progress: number; bubble?: BubbleEffectKind; screen?: ScreenEffectKind };
  /** The "Send with effect" screen is up, with this tab and this choice. */
  effectsPicker?: { tab: "bubble" | "screen"; bubble?: BubbleEffectKind; screen?: ScreenEffectKind; progress: number };
};

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function clone(messages: FixtureMessage[]) { return messages.map(message => ({ ...message, reactions: message.reactions?.map(reaction => ({ ...reaction })) })); }

export function frameAt(id: ScenarioId, milliseconds: number): SceneFrame {
  const t = Math.max(0, milliseconds);
  const frame: SceneFrame = { messages: clone(conversation), typing: false, swipe: 0, screen: "conversation" };
  switch (id) {
    case "outgoing": {
      frame.composerDraft = t < 17 ? "Blue for iMessage." : undefined;
      if (t >= 17) {
        frame.messages.push({ id: "new-outgoing", direction: "outgoing", text: "Blue for iMessage.", minutesAgo: 0, status: t >= 1200 ? "delivered" : "sending" });
        frame.messages = frame.messages.map(message => message.id === "m6" && t >= 1200 ? { ...message, status: undefined } : message);
        frame.arrival = { id: "new-outgoing", progress: clamp01((t - 17) / (nativeMotion.send - 17)), kind: "send" };
      }
      break;
    }
    case "incoming": {
      frame.typing = t < 800;
      if (t >= 800) {
        frame.messages.push({ id: "new-incoming", direction: "incoming", text: "That’s the one. 💙", minutesAgo: 0 });
        frame.arrival = { id: "new-incoming", progress: clamp01((t - 800) / nativeMotion.receive), kind: "receive" };
      }
      break;
    }
    case "grouped":
      frame.messages = [
        { id: "g1", direction: "incoming", text: "One more thing…", minutesAgo: 12 },
        { id: "g2", direction: "incoming", text: "The corners should connect.", minutesAgo: 12 },
        { id: "g3", direction: "incoming", text: "And only the last message gets a tail.", minutesAgo: 11 },
        { id: "g4", direction: "outgoing", text: "Blue for iMessage.", minutesAgo: 10 },
        { id: "g5", direction: "outgoing", text: "Ok", minutesAgo: 10 },
        { id: "g6", direction: "outgoing", text: "Every detail, down to the last bubble.", minutesAgo: 9, status: "delivered" },
      ];
      break;
    case "long-text":
      frame.messages = [
        { id: "long", direction: "incoming", text: "A longer message should wrap naturally without stretching the conversation.\n\nLine breaks stay exactly where you put them. So do emoji 👋 and punctuation.", minutesAgo: 20 },
        { id: "unbroken", direction: "outgoing", text: "averylongunbrokentoken_that_should_never_overflow_the_message_bubble_or_the_viewport", minutesAgo: 18, status: "delivered" },
      ];
      break;
    case "emoji":
      frame.messages = [
        { id: "e1", direction: "outgoing", text: "👋", minutesAgo: 5 },
        { id: "e2", direction: "incoming", text: "🎉🎉", minutesAgo: 4 },
        { id: "e3", direction: "outgoing", text: "Emoji stay big until there are more than three.", minutesAgo: 3, status: "delivered" },
      ];
      break;
    case "group-chat":
      frame.group = { name: "Design Crit", participants: ["Alex Morgan", "Jamie Chen", "Sam Rivera"] };
      frame.messages = [
        { id: "gc1", direction: "incoming", sender: "Alex Morgan", senderInitials: "AM", text: "Hey! How’s the new project going?", minutesAgo: 40 },
        { id: "gc2", direction: "incoming", sender: "Jamie Chen", senderInitials: "JC", text: "Looks promising so far.", minutesAgo: 39 },
        { id: "gc3", direction: "incoming", sender: "Jamie Chen", senderInitials: "JC", text: "The bubbles feel right.", minutesAgo: 39 },
        { id: "gc4", direction: "outgoing", text: "It’s all in the little details. ✨", minutesAgo: 38, status: "delivered" },
        { id: "gc5", direction: "incoming", sender: "Sam Rivera", senderInitials: "SR", text: "Tuesday morning at 9?", minutesAgo: 20 },
      ];
      break;
    case "sms":
      frame.messages = [
        { id: "s1", direction: "incoming", text: "Hey! How’s the new project going?", minutesAgo: 30, service: "sms" },
        { id: "s2", direction: "outgoing", text: "Green for text messages.", minutesAgo: 28, service: "sms", status: "delivered" },
      ];
      break;
    case "photos":
      frame.messages.push({ id: "ph", direction: "outgoing", minutesAgo: 1, text: "Photos",
        images: [{ src: "/fixtures/shore.jpg", alt: "Shore" }, { src: "/fixtures/ridge.jpg", alt: "Ridge" }, { src: "/fixtures/bloom.jpg", alt: "Bloom" }] });
      break;
    case "audio":
      frame.messages.push({ id: "au1", direction: "incoming", minutesAgo: 2, text: "Audio message", audio: { duration: 9 } });
      frame.messages.push({ id: "au2", direction: "outgoing", minutesAgo: 1, text: "Audio message", audio: { duration: 17 }, status: "delivered" });
      break;
    case "reply":
      frame.messages = frame.messages.map(message => message.id === "m5" ? { ...message, replyCount: 2 } : message);
      frame.messages.push({ id: "rp", direction: "outgoing", minutesAgo: 1, text: "Works for me.", status: "delivered",
        replyTo: { id: "m5", text: "Tuesday morning at 9?", direction: "incoming", sender: contact.name } });
      break;
    case "failed":
      frame.messages.push({ id: "fx", direction: "outgoing", minutesAgo: 1, text: "This one did not go through.", failed: true });
      break;
    case "link-preview":
      frame.messages.push({ id: "link", direction: "incoming", text: "https://ui.shadcn.com", minutesAgo: 1, link: { url: "https://ui.shadcn.com", host: "ui.shadcn.com", title: "Build your component library." } });
      break;
    case "attachment":
      frame.messages.push({ id: "file", direction: "incoming", text: "design-notes.txt", minutesAgo: 1, attachment: { name: "design-notes.txt", size: "2 KB", href: "/design-notes.txt" } });
      break;
    case "pressed":
      frame.pressed = { id: "m6", progress: clamp01(t / nativeMotion.longPressHold) };
      break;
    case "long-press":
      if (t < nativeMotion.longPressHold) frame.pressed = { id: "m6", progress: clamp01(t / nativeMotion.longPressHold) };
      else frame.longPress = { id: "m6", progress: clamp01((t - nativeMotion.longPressHold) / nativeMotion.longPressOpen) };
      break;
    case "tapback":
      frame.tapbackApply = { id: "m5", reaction: { type: "love", byMe: true }, progress: clamp01(t / nativeMotion.tapbackApply) };
      if (t >= nativeMotion.tapbackApply) frame.messages = frame.messages.map(message => message.id === "m5" ? { ...message, reactions: [{ type: "love", byMe: true }] } : message);
      break;
    case "reactions":
      frame.messages = frame.messages.map(message => {
        if (message.id === "m1") return { ...message, reactions: [{ type: "love", byMe: true }] };
        if (message.id === "m3") return { ...message, reactions: [{ type: "laugh", byMe: false }, { type: "emphasize", byMe: true }] };
        if (message.id === "m5") return { ...message, reactions: [{ type: "emoji", emoji: "🔥", byMe: true }] };
        return message;
      });
      break;
    case "swipe-times":
      frame.swipe = clamp01(t / 400);
      break;
    case "select-mode":
      frame.selectMode = { selected: ["m6"] };
      break;
    // One outgoing and one incoming, so both measured overlays are in the same frame: a plain click
    // gives the first, cmd-clicking the second adds it.
    case "selected-message":
      frame.selectedMessageIds = ["m3", "m5"];
      break;
    case "typing":
      frame.typing = true;
      break;
    case "thread-open":
      frame.messages = clone(threadConversation);
      // t = 0 is the conversation before the tap. The overlay's own first frame is invisible but
      // still covers the screen, so leaving it out keeps the reply count clickable at the start.
      if (t > 0) frame.thread = { rootId: "m5", progress: clamp01(t / unverifiedMotion.threadOpen) };
      break;
    case "thread-close":
      frame.messages = clone(threadConversation);
      // The way out is the way in, run backwards. That is what a seekable animation buys: every
      // checkpoint here is a real frame of the overlay's own timeline rather than a sample of a
      // wall clock. The live path still plays `ReplyThread`'s own exit, which is shorter.
      frame.thread = { rootId: "m5", progress: 1 - clamp01(t / unverifiedMotion.threadClose) };
      break;
    case "list":
      frame.screen = "list";
      break;
    case "push-conversation":
      frame.screenTransition = { from: "list", progress: clamp01(t / unverifiedMotion.push) };
      break;
    case "push-back":
      frame.screen = "list";
      frame.screenTransition = { from: "conversation", progress: clamp01(t / unverifiedMotion.pop) };
      break;
    case "new-message":
      frame.screen = "new-message";
      break;
    case "new-message-sheet":
      frame.screen = "new-message";
      frame.screenTransition = { from: "list", progress: clamp01(t / unverifiedMotion.sheet) };
      break;
    case "details":
      frame.screen = "details";
      break;
    case "plus-menu":
      frame.menu = "plus";
      break;
    case "context-menu":
      frame.menu = "context";
      break;
    case "effect-slam":
    case "effect-loud":
    case "effect-gentle":
    case "effect-invisible-ink": {
      const kind = id.replace("effect-", "") as BubbleEffectKind;
      const duration = scenarios.find(scenario => scenario.id === id)!.duration;
      frame.effect = { id: "m6", progress: clamp01(t / duration), bubble: kind };
      // Invisible Ink is a state, not a timeline: mark the message so the list draws the cover too.
      if (kind === "invisible-ink") {
        const message = frame.messages.find(item => item.id === "m6");
        if (message) message.effect = "invisible-ink";
      }
      break;
    }
    case "effect-confetti":
    case "effect-love":
    case "effect-fireworks": {
      const kind = id.replace("effect-", "") as ScreenEffectKind;
      const duration = scenarios.find(scenario => scenario.id === id)!.duration;
      frame.effect = { id: "m6", progress: clamp01(t / duration), screen: kind };
      break;
    }
    case "effects-picker":
      // Hold the send button, the screen comes up empty, then Slam is chosen and the preview rises.
      frame.composerDraft = "Every detail, down to the last bubble.";
      if (t >= 400) frame.effectsPicker = { tab: "bubble", bubble: t >= 1200 ? "slam" : undefined, progress: clamp01((t - 400) / 260) };
      break;
    case "effects-picker-screen":
      frame.composerDraft = "Every detail, down to the last bubble.";
      // The Bubble scenario covers the entrance, so this one starts settled.
      frame.effectsPicker = { tab: "screen", screen: t >= 600 ? "echo" : undefined, progress: 1 };
      break;
    case "facetime":
      frame.call = t < 500 ? "invitation" : t < 1600 ? "ringing" : t < 3000 ? "connected" : "ended";
      break;
    case "facetime-missed":
      frame.call = "missed";
      break;
  }
  return frame;
}

/** Conversation list fixtures shared by the iOS list and the macOS sidebar. */
export const conversationList = [
  { id: "alex", name: "Alex Morgan", initials: "AM", preview: "Sounds good 👍", time: "9:39 AM", pinned: false },
  { id: "design", name: "Design Crit", initials: "DC", preview: "Sam Rivera: Tuesday morning at 9?", time: "9:21 AM", pinned: false },
  { id: "jamie", name: "Jamie Chen", initials: "JC", preview: "You loved “Next week!”", time: "Yesterday", pinned: false },
  { id: "sam", name: "Sam Rivera", initials: "SR", preview: "But have failed to deliver on performance using it", time: "Yesterday", pinned: false },
  { id: "riley", name: "Riley Park", initials: "RP", preview: "Risky-signup alerts are still on, so heads up, one just landed.", time: "Yesterday", pinned: false, muted: true },
  { id: "freestyle", name: "Freestyle", initials: "F", preview: "See you at demo day.", time: "Monday", pinned: true },
] as const;
