import type { Direction, Service } from "@/registry/imessage/tokens";
import type { FaceTimeState } from "@/registry/imessage/facetime-card";
import type { BubbleEffectKind, ScreenEffectKind } from "@/registry/imessage/message-effects";
import type { SystemMessageEvent } from "@/registry/imessage/system-message";

export type Platform = "ios" | "macos";
export const platforms = { ios: { title: "iOS 26", width: 402, height: 874, scale: 3 }, macos: { title: "macOS 26", width: 960, height: 640, scale: 2 } } as const;

/**
 * Motion timings measured from native 60 fps recordings (see references/SPEC.md). Every number in
 * this table was read off a frame of a recording in `references/ios/motion/`.
 */
export const nativeMotion = {
  /**
   * Return pressed → bubble settled in its slot. **690, not 520 and not 350.** Re-measured frame by
   * frame off `references/ios/motion/send-60fps.mp4` with t = 0 at f73, the first frame that moves:
   * the bubble overshoots its slot by 5.0 pt at 417 ms (f98), is inside 0.25 pt of rest at 633 ms
   * (f111) and is settled at 690 ms (f114). The times this file used to carry came from f71, two
   * frames early, and stopped at the point the scale finishes rather than the point the spring does.
   * `messageMotion.send.duration` in `message-motion.tsx` is the same 690 and has to move with it.
   */
  send: 690,
  /** Hold before the menu opens, then the menu/bar transition. */
  longPressHold: 500,
  longPressOpen: 380,
  /** Menu dissolve → balloon pop when applying a tapback (macOS measured; iOS assumed equal). */
  tapbackApply: 420,
  /** Incoming bubble pop after the typing indicator. */
  receive: 300,
  /** Swipe-to-reveal times spring back. */
  swipeRelease: 300,
  /**
   * ⌘F on the conversation list → the search screen settled, and Escape → the list back in place.
   * Measured off 60-frame recordings (`references/ios/motion/search-open.mov`, `search-close.mov`).
   * The close is **not** the open reversed: it is a longer ease-in-out fall that begins with the
   * surface already gone, which is why the two have separate durations and separate tables.
   */
  searchOpen: 267,
  searchClose: 292,
} as const;

/**
 * Durations read out of Apple's own frameworks rather than off a recording: a Catalyst probe's
 * reading of a ChatKit or PhotoKit constant. They are not captures and they are not guesses — the
 * number is Apple's, and what it drives on screen is this kit's. Copied rather than imported, like
 * every other value here, so the unit tests can load this file on its own.
 */
export const frameworkMotion = {
  /**
   * `PUTilingViewSettings -springAnimationDuration` = 0.3: the photo viewer's open zoom, the exit
   * that reverses it, and every page settle. Its `-transitionDuration` (the ground coming up) is
   * 0.2 and finishes inside this, so the whole entrance is over at 300.
   */
  photoViewer: 300,
  /**
   * `AudioMessageRecordingView.stateChangeAnimationDuration` = 0.6 with `.stateChangeSpringDamping`
   * 0.86: the recording row rearranging into the stopped one, overshoot included.
   */
  audioStateChange: 600,
  /**
   * The sticker carry, laid end to end: 500 ms of lift (judgement — nothing measures the delay
   * before the shrink starts), then `-[CKBrowserDragStickerView animateScaleDown]`'s own 0.91 s at
   * speed 0.8 = 1137.5, then `springAnimationWithKeyPath:speed:` at speed 1 = 910. 2547.5 in all.
   */
  stickerDrag: 2548,
  /**
   * `-[CKUIBehavior* scrollInNewMessageAnimationDuration]` = 0.3, the same on Phone, Pad and Mac:
   * how long a group's sender face takes to slide down to the bubble that just joined its cluster.
   * Recorded here because the surface exists; no scenario can seek it yet (see the report).
   */
  senderAvatarHandoff: 300,
} as const;

/**
 * How far the details header collapses, in **points, not milliseconds**: `iosDetailsCollapse.travel`.
 * The collapse has no clock — one millisecond of its paused timeline per point scrolled — so a
 * scenario seeks it with a scroll offset. UNMEASURED: no capture holds that screen scrolled, but
 * both ends of it are measured (the nav bar it lands on, and the header it leaves).
 */
export const detailsCollapseTravel = 120.3333;

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
  /**
   * The iOS `+` sheet growing out of the composer's `+`, and folding back into it. Mirrors
   * `usePlusMenuSpring`: ζ 0.86 / ω 15 opening (0.90 of the way there at 200 ms, settled by 350) and
   * a stiffer ζ 1 / ω 24 closing (back inside the `+` in about 200), both chosen to sit in the family
   * of the long-press menu's *measured* 380 / 220 pair. The macOS popover runs its own shorter
   * `macPlusMenuMetrics.motion` (160 / 120) off the same normalised progress — see `plus-menu-open`.
   */
  plusMenuOpen: 350,
  plusMenuClose: 200,
  /**
   * The Photos picker rising under the composer, and the sticker sheet doing the same.
   * `photoPickerMetrics.timing` and `stickerPickerMetrics.timing` both carry 380 / 220, and both
   * borrowed that pair from the long-press menu rather than measuring it; `detent` is invented
   * outright. Nothing in `references/` records either sheet moving.
   */
  photoPickerOpen: 380,
  photoPickerDetent: 320,
  stickerSheetOpen: 380,
  /** The voice recorder taking the composer's place. `audioRecorderMotion.enter`, itself borrowed
   *  from the measured iOS effects screen. Nothing measures this row appearing. */
  audioRecorderEnter: 260,
  /**
   * The iOS details screen presenting (`iosDetailsMotion.enter`), which `group-details.tsx` imports
   * rather than restating, so the one-to-one and the group screen cannot drift apart.
   */
  detailsOpen: 360,
  /**
   * The macOS details inspector sliding in from the trailing edge. `macDetailsMotion.enter` / `.exit`.
   * No capture records it, and `CKUIBehaviorMac` vends no inspector-named duration — all 28 of its
   * `*duration*` selectors were scanned.
   */
  macDetailsOpen: 300,
  macDetailsClose: 250,
  /**
   * The Tapback Details platter arriving. `tapbackDetailsPlatterMotion.enter`: judgement, borrowed
   * from the `CKFullScreenBalloonViewController` overlay the long press already uses, whose exit
   * (220) *is* measured. ChatKit's own `tapbackDismissalDuration` of 0.5 s belongs to the picker.
   */
  tapbackDetails: 200,
  /** A transcript status line rising into place. `systemMessageMotion.duration`. */
  systemArrival: 260,
  /**
   * The macOS conversation switch: the pane crossfades while the arriving content rises 6 pt and the
   * sidebar's selected row travels. `macTransitions.conversation.duration`.
   */
  conversationSwitch: 140,
} as const;

export type Reaction = {
  type: "love" | "like" | "dislike" | "laugh" | "emphasize" | "question" | "emoji";
  emoji?: string;
  byMe: boolean;
  /** Who left it. Only a group needs it; a 1:1 falls back to `contact.name` / "You". */
  by?: string;
  byInitials?: string;
};
export type FixtureMessage = {
  id: string;
  text: string;
  direction: Direction;
  /** Minutes before "now" (9:41 AM). */
  minutesAgo: number;
  service?: Service;
  sender?: string;
  senderInitials?: string;
  /**
   * One thing that happened *to* the conversation rather than in it: a rename, a join, a leave, the
   * group photo. It draws as a centred grey line instead of a balloon, so `text` stays "" —
   * `systemMessageText(event)` is the sentence and nothing has to keep a second copy of it.
   */
  system?: SystemMessageEvent;
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

/**
 * The people in the group fixture, named once so a group conversation, its details screen, its nav
 * bar photo and the Tapback Details platter all name the same three. `MessageImages` draws at most
 * four tiles, so `groupCast` staying at three keeps the Snowglobe stack's three-circle row.
 */
export const groupCast = [
  { name: "Alex Morgan", initials: "AM" },
  { name: "Jamie Chen", initials: "JC" },
  { name: "Sam Rivera", initials: "SR" },
] as const;
export const groupName = "Design Crit";

/** The five messages every group scenario opens with, so a group frame always names the same people. */
export const groupChat: FixtureMessage[] = [
  { id: "gc1", direction: "incoming", sender: "Alex Morgan", senderInitials: "AM", text: "Hey! How’s the new project going?", minutesAgo: 40 },
  { id: "gc2", direction: "incoming", sender: "Jamie Chen", senderInitials: "JC", text: "Looks promising so far.", minutesAgo: 39 },
  { id: "gc3", direction: "incoming", sender: "Jamie Chen", senderInitials: "JC", text: "The bubbles feel right.", minutesAgo: 39 },
  { id: "gc4", direction: "outgoing", text: "It’s all in the little details. ✨", minutesAgo: 38, status: "delivered" },
  { id: "gc5", direction: "incoming", sender: "Sam Rivera", senderInitials: "SR", text: "Tuesday morning at 9?", minutesAgo: 20 },
];

/**
 * The photos the viewer pages through. Five, not three: `pageWindow` keeps two either side of the
 * one showing, so a five-photo message is the smallest set where paging has somewhere to go in both
 * directions. Only the first four have a tile in the log (`MessageImages`' MAX_TILES), so the fifth
 * is also the case where `rectForIndex` returns null and the viewer fades instead of flying.
 */
export const viewerPhotos: Array<{ src: string; alt: string }> = [
  { src: "/fixtures/shore.jpg", alt: "Shore" },
  { src: "/fixtures/ridge.jpg", alt: "Ridge" },
  { src: "/fixtures/bloom.jpg", alt: "Bloom" },
  { src: "/fixtures/dusk.jpg", alt: "Dusk" },
  { src: "/fixtures/frost.jpg", alt: "Frost" },
];

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
  // Every checkpoint here is a frame of `references/ios/motion/send-60fps.mp4`, re-measured with
  // t = 0 at f73: 17 is f74, where the rect is still full width and the collapse has not started;
  // 130 is f81, where the pale rect and the saturated bubble have coincided; 183 (f84) is the
  // collapse's minimum, scale 0.772; 417 (f98) is the visible overshoot, 5.0 pt above the slot; 690
  // (f114) is settled. 1017 (f134) is where "Delivered" moves off the bubble above onto this one,
  // and it is the last frame of the interaction this fixture can express: the 15 pt slot rise that
  // follows it over f134-f147 is a relayout, not a state the scene states.
  { id: "outgoing", title: "Send a message", group: "Messages", duration: 1017, checkpoints: [0, 17, 130, 183, 417, 690, 1017] },
  // Typing until 800, then the measured 300 ms pop: 850 and 950 sample it, 1100 is settled.
  { id: "incoming", title: "Receive a message", group: "Messages", duration: 1100, checkpoints: [0, 700, 800, 850, 950, 1100] },
  { id: "grouped", title: "Clusters and tails", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "long-text", title: "Long text and wrapping", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "emoji", title: "Emoji only", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "group-chat", title: "Group chat", group: "Messages", duration: 0, checkpoints: [0] },
  // Two consecutive status lines back to back is the point of this one: it is the case that used to
  // render at twice the gap, and `groupPhotoChanged` with no actor is the first-person "You" form.
  { id: "group-events", title: "Group status lines", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "sms", title: "Text message (SMS)", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "link-preview", title: "Link preview", group: "Previews", duration: 0, checkpoints: [0] },
  { id: "attachment", title: "File preview", group: "Previews", duration: 0, checkpoints: [0] },
  { id: "photos", title: "Photos", group: "Previews", duration: 0, checkpoints: [0] },
  // The photo viewer. 300 is `PUTilingViewSettings -springAnimationDuration`, which the open zoom,
  // the exit and every page settle all run for; the checkpoints are packed early because the easing
  // is cubic-bezier(0.32, 0.72, 0, 1), which spends most of its travel in the first third. macOS has
  // no in-window viewer at all — a photo there is a Quick Look, an AppKit panel this kit cannot own.
  { id: "photo-viewer", title: "Open a photo", group: "Previews", duration: 300, checkpoints: [0, 60, 120, 200, 300], only: "ios" },
  { id: "photo-viewer-page", title: "Swipe between photos", group: "Previews", duration: 300, checkpoints: [0, 100, 200, 300], only: "ios" },
  { id: "photo-viewer-dismiss", title: "Drag a photo away", group: "Previews", duration: 300, checkpoints: [0, 100, 200, 300], only: "ios" },
  { id: "audio", title: "Audio message", group: "Previews", duration: 0, checkpoints: [0] },
  // 260 + 2140 + 600 = 3000, and every checkpoint is one of those three phases. The entrance is a
  // spring that has done most of its travel by 90 ms (the row measures 285.18 pt wide at 0, 288.03
  // at 30, 292.32 at 70 and 293.60 at 130), so 30 and 70 sample it and 130 is dropped as a duplicate
  // of 260. 1200 and 2100 are 0.94 s and 1.84 s into the take, 11 and 22 bars. 2400 is the instant
  // stop is pressed; 2400 → 3000 is the framework's own 600 ms / ζ 0.86 state-change spring, so 2700
  // catches its overshoot (the waveform box measures 181.27 → 111.30 → 108.91 pt at 2400/2700/3000).
  { id: "audio-record", title: "Record a voice message", group: "Previews", duration: 3000, checkpoints: [0, 30, 70, 260, 1200, 2100, 2400, 2700, 3000], only: "ios" },
  { id: "audio-playback", title: "Play a voice message back", group: "Previews", duration: 1600, checkpoints: [0, 400, 800, 1200, 1600], only: "ios" },
  { id: "reply", title: "Inline reply", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "failed", title: "Not delivered", group: "Messages", duration: 0, checkpoints: [0] },
  { id: "pressed", title: "Press and hold", group: "Interactions", duration: 500, checkpoints: [0, 250, 500] },
  { id: "long-press", title: "Tapback menu", group: "Interactions", duration: 880, checkpoints: [0, 500, 560, 630, 700, 880] },
  { id: "tapback", title: "Apply a Tapback", group: "Interactions", duration: 600, checkpoints: [0, 150, 300, 450, 600] },
  { id: "reactions", title: "Reactions on bubbles", group: "Interactions", duration: 0, checkpoints: [0] },
  // Four reactors over two kinds: it exercises the tally counts, the "own" cell with its Remove
  // Tapback label, and — at 402 pt, where the platter clamps to 386 — the end fade and the scroll.
  // 200 is `tapbackDetailsPlatterMotion.enter`. macOS has the platter in ChatKit but the macOS shell
  // does not present it, so there is nothing to drive there.
  { id: "tapback-details", title: "Tapback Details", group: "Interactions", duration: 200, checkpoints: [0, 60, 120, 200], only: "ios" },
  // The three phases laid end to end: 0 lift, 500 the shrink starts, 1638 it is done and the landing
  // starts, 2548 landed at ChatKit's 48. Only iOS: the macOS popover takes no `dragPreview`, so the
  // carry there can be driven by hand but not posed.
  { id: "sticker-drag", title: "Drag a sticker onto a bubble", group: "Interactions", duration: 2548, checkpoints: [0, 500, 1100, 1638, 2100, 2548], only: "ios" },
  { id: "group-event-arrival", title: "A status line arrives", group: "Interactions", duration: 260, checkpoints: [0, 60, 130, 200, 260] },
  { id: "swipe-times", title: "Swipe for times", group: "Interactions", duration: 400, checkpoints: [0, 200, 400] },
  { id: "select-mode", title: "Select messages", group: "Interactions", duration: 0, checkpoints: [0] },
  { id: "selected-message", title: "Click to select", group: "Interactions", duration: 0, checkpoints: [0], only: "macos" },
  // One turn of `typingLoopMs`. The dots are the component's own CSS loop rather than a state this
  // file states, so the scene is identical at every checkpoint and the harness pins the animation to
  // the checkpoint's own time instead; 0 and 1200 are the same frame of the loop, which is the point.
  { id: "typing", title: "Typing indicator", group: "Interactions", duration: 1200, checkpoints: [0, 200, 400, 800, 1200] },
  // The transitions all ride the iOS sheet curve, which spends most of its travel in the first
  // third, so the checkpoints are packed there rather than spread evenly over the duration.
  { id: "thread-open", title: "Open a thread", group: "Interactions", duration: 260, checkpoints: [0, 30, 70, 140, 260], only: "ios" },
  { id: "thread-close", title: "Close a thread", group: "Interactions", duration: 200, checkpoints: [0, 100, 150, 180, 200], only: "ios" },
  { id: "list", title: "Conversation list", group: "Screens", duration: 0, checkpoints: [0] },
  { id: "push-conversation", title: "Push a conversation", group: "Screens", duration: 350, checkpoints: [0, 40, 90, 180, 350], only: "ios" },
  { id: "push-back", title: "Back to the list", group: "Screens", duration: 320, checkpoints: [0, 40, 90, 180, 320], only: "ios" },
  { id: "new-message", title: "New message", group: "Screens", duration: 0, checkpoints: [0] },
  { id: "new-message-sheet", title: "Present New Message", group: "Screens", duration: 400, checkpoints: [0, 50, 100, 200, 400], only: "ios" },
  // Search over the list. Both durations are measured off 60 fps recordings and the two tables are
  // different animations, so the checkpoints are read off each curve rather than mirrored: opening,
  // 45 is where the compose glyph is halfway out, 130 the alpha midpoint where the ✕ arrives, 200
  // leaves the list at 0.155. Closing, 4 is the one-frame cut that proves the exit is not the
  // entrance reversed — the surface is already gone while the list is still at alpha 0.858.
  { id: "search-open", title: "Open search", group: "Screens", duration: 267, checkpoints: [0, 45, 130, 200, 267], only: "ios" },
  { id: "search-close", title: "Close search", group: "Screens", duration: 292, checkpoints: [0, 4, 113, 208, 292], only: "ios" },
  { id: "search-results", title: "Search results", group: "Screens", duration: 0, checkpoints: [0], only: "ios" },
  // On the Mac, `searchControllerObscuresConversationList` is NO: the results *are* the list, so
  // there is no overlay to seek — only a filtered sidebar.
  { id: "sidebar-search", title: "Filter the sidebar", group: "Screens", duration: 0, checkpoints: [0], only: "macos" },
  { id: "details", title: "Conversation details", group: "Screens", duration: 0, checkpoints: [0] },
  // The macOS inspector. Packed early for the same reason the push rows are: its easing is the same
  // cubic-bezier(0.32, 0.72, 0, 1). At progress 1 the component cancels its own timeline, so the
  // settled checkpoint screenshots plain styles.
  { id: "details-open", title: "Open the inspector", group: "Screens", duration: 300, checkpoints: [0, 45, 100, 180, 300], only: "macos" },
  { id: "details-photos", title: "Inspector: Photos", group: "Screens", duration: 0, checkpoints: [0], only: "macos" },
  // The iOS details screen for a group. The one-to-one screen is `details` above; the two take the
  // same progress/scroll/open contract, and `group-details.tsx` imports `iosDetailsMotion` rather
  // than restating it, so 360 covers both. `scroll` is points, not milliseconds.
  { id: "group-details", title: "Group details", group: "Screens", duration: 0, checkpoints: [0], only: "ios" },
  { id: "group-details-open", title: "Group details opening", group: "Screens", duration: 360, checkpoints: [0, 80, 200, 360], only: "ios" },
  { id: "group-details-scrolled", title: "Group details scrolled", group: "Screens", duration: 0, checkpoints: [0], only: "ios" },
  { id: "plus-menu", title: "Plus menu", group: "Screens", duration: 0, checkpoints: [0] },
  // The scrubber's milliseconds are the iOS sheet's (`usePlusMenuSpring`, settled by 350, back in
  // the `+` by 200). Both shells take the same normalised 0..1, so a macOS checkpoint reads the
  // fraction rather than the millisecond: its own popover runs a shorter 160 / 120
  // (`macPlusMenuMetrics.motion`). Neither pair is measured — see `unverifiedMotion`.
  { id: "plus-menu-open", title: "Open the plus menu", group: "Screens", duration: 350, checkpoints: [0, 45, 100, 175, 350] },
  { id: "plus-menu-close", title: "Close the plus menu", group: "Screens", duration: 200, checkpoints: [0, 40, 90, 140, 200] },
  // 0 is the away pose, 190 half of the 380 ms entrance, 380 settled; then a first tile is picked at
  // 700 and a second at 1000, and 1400 gives the 150 ms badge transition room to finish. 380 and 220
  // are the long-press menu's measured pair, borrowed — treat these as a regression net, not as
  // evidence of fidelity. The Mac shows the same picker in a 252 × 400 popover, always collapsed.
  { id: "photo-picker", title: "Photos picker", group: "Screens", duration: 1400, checkpoints: [0, 190, 380, 700, 1000, 1400] },
  { id: "photo-picker-expanded", title: "Photos picker: expanded", group: "Screens", duration: 700, checkpoints: [0, 380, 700], only: "ios" },
  // Same borrowed 380. The entrance curve is heavily front-loaded, so 60 / 140 / 240 sample it at
  // roughly 0.52, 0.87 and 0.98 of travel rather than at even thirds.
  { id: "sticker-picker", title: "Sticker picker", group: "Screens", duration: 380, checkpoints: [0, 60, 140, 240, 380] },
  // Only its two ends are checkpointed, and that is deliberate: `MacMessagesApp` *derives* the
  // leaving conversation from a real change of `selectedId` rather than taking it as a prop the way
  // `screenTransition` takes `from`, so a frame loaded straight at mid-transition has nothing to
  // cross with. 0 is the conversation it leaves and 140 the one it lands on, both settled and both
  // true; press play (or click a sidebar row) to see the crossfade itself.
  { id: "switch-conversation", title: "Switch conversation", group: "Screens", duration: 140, checkpoints: [0, 140], only: "macos" },
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
  /**
   * The `+` menu over the composer, its entrance scrubbed to `progress` (0..1). Both shells take the
   * same normalised value and seek their own timeline with it; on macOS it is the `+` popover's.
   */
  plusMenu?: { progress: number };
  /**
   * The full-screen photo viewer is up on this message, seeked to `progress` (0..1) of its entrance
   * and showing item `index`. `dismiss` holds the drag-to-dismiss pose instead of synthesising a
   * drag, and `chrome` states whether the bars are up. iOS only: a photo on the Mac is a Quick Look.
   */
  photoViewer?: { id: string; index: number; progress: number; chrome?: boolean; dismiss?: number };
  /**
   * The Photos picker: its entrance scrubbed to `progress`, which detent it is at, and what is
   * picked. The Mac shows the same component in a popover and ignores `detent`, which has no sheet
   * to drag there.
   */
  photoPicker?: { progress: number; detent: "collapsed" | "expanded"; selected: string[] };
  /**
   * The sticker sheet is up. `progress` scrubs its entrance; `drag` poses one sticker in flight as a
   * pure function of its own progress over the measured 2547.5 ms (lift 500, shrink 1137.5, land
   * 910), so a seeked checkpoint gets the carry without a pointer.
   */
  stickerPicker?: { tab?: string; progress: number; drag?: { id: string; to: { x: number; y: number }; progress: number } };
  /**
   * The voice recorder is up in place of the composer. `state` is its pose, `position` is seconds
   * into the take, `enter` seeks its entrance, and `transition` seeks the framework's own 600 ms
   * state-change spring out of `from`. Every field is scrubbed, never run.
   */
  audioRecorder?: { state: "recording" | "stopped" | "playing"; position: number; enter?: number; transition?: { from: "recording" | "stopped" | "playing"; progress: number } };
  /**
   * The iOS details screen's own seekable state: `progress` scrubs its presentation (0..1) and
   * `scroll`, in POINTS, scrubs the header collapse. `IosDetails` and `GroupDetails` both take them.
   */
  details?: { progress?: number; scroll?: number };
  /**
   * The macOS details inspector. `progress` scrubs its slide (0 closed, 1 settled); omit it to let
   * the shell play the transition. iOS has no inspector — it pushes `screen: "details"` instead.
   */
  detailsPane?: { open: boolean; progress?: number; tab?: "info" | "photos" | "links" | "documents" };
  /** The Tapback Details platter is open on this message, its entrance scrubbed to `progress`. */
  tapbackDetails?: { id: string; progress: number; filter?: string | null };
  /**
   * The search screen is up over the list, its transition scrubbed to `progress` (0..1). `closing`
   * picks the measured close table rather than playing the open one backwards; the recordings say
   * they are different animations, so a scrubbed close without this flag would be wrong.
   */
  search?: { query: string; progress: number; closing?: boolean; results?: boolean };
  /** What has been typed into the macOS sidebar's search field, which filters the list in place. */
  sidebarSearch?: string;
  /** A status line arriving in the transcript, its entrance scrubbed to `progress` (0..1). */
  systemArrival?: { id: string; progress: number };
  /**
   * The macOS conversation switch. `to` is the conversation the pane is drawing; `progress` seeks
   * the crossfade. The shell derives the *leaving* copy from a real change of `to`, so a frame
   * loaded straight at mid-transition renders `to` settled — see the `switch-conversation` entry.
   */
  conversationSwitch?: { from: string; to: string; progress: number };
};

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function clone(messages: FixtureMessage[]) { return messages.map(message => ({ ...message, reactions: message.reactions?.map(reaction => ({ ...reaction })) })); }

/**
 * Puts the group fixture on a frame: the same name, the same three people and the same five
 * messages, so a group conversation, its details screen and the Tapback Details platter all name
 * the same cast and the nav bar's Snowglobe stack starts from the faces the details header lands on.
 */
function makeGroup(frame: SceneFrame) {
  frame.group = { name: groupName, participants: groupCast.map(person => person.name) };
  frame.messages = clone(groupChat);
}

/** The five photos, on one outgoing message, which every photo-viewer scenario opens from. */
function photoMessage(): FixtureMessage {
  return { id: "ph", direction: "outgoing", minutesAgo: 1, text: "Photos", images: viewerPhotos.map(photo => ({ ...photo })) };
}

export function frameAt(id: ScenarioId, milliseconds: number): SceneFrame {
  const t = Math.max(0, milliseconds);
  const frame: SceneFrame = { messages: clone(conversation), typing: false, swipe: 0, screen: "conversation" };
  switch (id) {
    case "outgoing": {
      frame.composerDraft = t < 17 ? "Blue for iMessage." : undefined;
      if (t >= 17) {
        // 1017 ms is f134, the frame the recording shows "Delivered" moving off the bubble above.
        const delivered = t >= 1017;
        frame.messages.push({ id: "new-outgoing", direction: "outgoing", text: "Blue for iMessage.", minutesAgo: 0, status: delivered ? "delivered" : "sending" });
        frame.messages = frame.messages.map(message => message.id === "m6" && delivered ? { ...message, status: undefined } : message);
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
    // Three participants, so the nav bar and the sidebar row draw the Snowglobe stack rather than a
    // monogram and the transcript spends its sender gutter with a face on each cluster's last bubble.
    case "group-chat":
      makeGroup(frame);
      break;
    // The two status lines back to back (ge2, ge3) are the case that used to render at twice the
    // gap; ge5 has no actor, so it is the first-person form and bolds "You" rather than a name.
    case "group-events":
      makeGroup(frame);
      frame.messages = [
        frame.messages[0],
        { id: "ge2", direction: "incoming", text: "", minutesAgo: 39, system: { type: "conversationNamed", actor: "Alex Morgan", name: groupName } },
        { id: "ge3", direction: "incoming", text: "", minutesAgo: 39, system: { type: "participantAdded", actor: "Alex Morgan", participant: "Sam Rivera" } },
        frame.messages[4],
        { id: "ge5", direction: "incoming", text: "", minutesAgo: 19, system: { type: "groupPhotoChanged" } },
        { id: "ge6", direction: "incoming", text: "", minutesAgo: 19, system: { type: "participantLeft", actor: "Jamie Chen" } },
        { id: "ge7", direction: "outgoing", text: "It’s all in the little details. ✨", minutesAgo: 18, status: "delivered" },
      ];
      break;
    case "group-event-arrival":
      makeGroup(frame);
      frame.messages.push({ id: "new-system", direction: "incoming", text: "", minutesAgo: 0,
        system: { type: "participantAdded", actor: "Alex Morgan", participant: "Riley Park" } });
      frame.systemArrival = { id: "new-system", progress: clamp01(t / unverifiedMotion.systemArrival) };
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
    // The viewer opens out of the third tile, which is the case worth checking: `rectForIndex` is
    // what stops photo 3 flying back into photo 1's thumbnail on the way out.
    case "photo-viewer":
      frame.messages.push(photoMessage());
      frame.photoViewer = { id: "ph", index: 2, progress: clamp01(t / frameworkMotion.photoViewer) };
      break;
    // Settled, paging from item 1 to item 2. The track's own transition is `timing.page` = 300, and
    // the shell hands the viewer a new `index` rather than a scrubbed offset, so the halfway point
    // is where the page commits: before it the track is on 1, after it on 2.
    case "photo-viewer-page":
      frame.messages.push(photoMessage());
      frame.photoViewer = { id: "ph", index: t < frameworkMotion.photoViewer / 2 ? 1 : 2, progress: 1 };
      break;
    // `dismissProgress` holds the drop pose without a synthesised drag: the photo runs to
    // `dismiss.minScale` 0.6 and the ground dims to `interactiveTransitionBackgroundDimming` 0.5.
    // Chrome off, because `hideChromeOnZoom` has already taken it by the time a drag starts.
    case "photo-viewer-dismiss":
      frame.messages.push(photoMessage());
      frame.photoViewer = { id: "ph", index: 1, progress: 1, chrome: false, dismiss: clamp01(t / frameworkMotion.photoViewer) };
      break;
    case "audio":
      frame.messages.push({ id: "au1", direction: "incoming", minutesAgo: 2, text: "Audio message", audio: { duration: 9 } });
      frame.messages.push({ id: "au2", direction: "outgoing", minutesAgo: 1, text: "Audio message", audio: { duration: 17 }, status: "delivered" });
      break;
    // The row appears, a take is made, stop is pressed at 2400 and the framework's own state-change
    // spring rearranges the row into the stopped one over the next 600 ms.
    case "audio-record":
      if (t < unverifiedMotion.audioRecorderEnter) {
        frame.audioRecorder = { state: "recording", position: 0, enter: clamp01(t / unverifiedMotion.audioRecorderEnter) };
      } else if (t < 2400) {
        frame.audioRecorder = { state: "recording", position: (t - unverifiedMotion.audioRecorderEnter) / 1000 };
      } else if (t < 2400 + frameworkMotion.audioStateChange) {
        frame.audioRecorder = { state: "stopped", position: 0, transition: { from: "recording", progress: clamp01((t - 2400) / frameworkMotion.audioStateChange) } };
      } else {
        frame.audioRecorder = { state: "stopped", position: 0 };
      }
      break;
    // The playhead walks a ~3.2 s take across the scenario. The played/unplayed split is
    // `max(1, floor(fraction × barCount))` bars, so it moves visibly at every checkpoint.
    case "audio-playback":
      frame.audioRecorder = { state: "playing", position: (t / 1000) * 2 };
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
    // Four reactors over two kinds, on the group fixture, because a "who reacted" platter is
    // meaningless without names. It reads out 3 Love and 1 Like, the own cell carries Remove
    // Tapback, and `messageAcknowledgmentVotingStackSize` is 4, so this is the largest set that
    // still names everybody before ChatKit's "Others" takes over.
    case "tapback-details":
      makeGroup(frame);
      frame.messages = frame.messages.map(message => message.id === "gc4" ? { ...message, reactions: [
        { type: "love", byMe: false, by: "Alex Morgan", byInitials: "AM" },
        { type: "love", byMe: false, by: "Jamie Chen", byInitials: "JC" },
        { type: "like", byMe: false, by: "Sam Rivera", byInitials: "SR" },
        { type: "love", byMe: true, by: "You", byInitials: "B" },
      ] as Reaction[] } : message);
      frame.tapbackDetails = { id: "gc4", progress: clamp01(t / unverifiedMotion.tapbackDetails) };
      break;
    // The joy emoji off the Emoji tab, carried onto "Tuesday morning at 9?". `to` is in the picker
    // root's own coordinates, which are the device frame's: (150, 300) lands on the incoming bubble
    // in the default fixture at 402 × 874. If `message-list.tsx` moves that bubble, move this.
    case "sticker-drag":
      frame.stickerPicker = { tab: "emoji", progress: 1, drag: { id: "e-joy", to: { x: 150, y: 300 }, progress: clamp01(t / frameworkMotion.stickerDrag) } };
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
    // The query is empty for both transitions on purpose: the recordings were made by pressing ⌘F on
    // an empty field, so at t = 0 the pill still shows the mic and the placeholder, and the clear
    // button only appears once there is text.
    case "search-open":
      frame.screen = "list";
      frame.search = { query: "", progress: clamp01(t / nativeMotion.searchOpen) };
      break;
    case "search-close":
      frame.screen = "list";
      frame.search = { query: "", progress: clamp01(t / nativeMotion.searchClose), closing: true };
      break;
    case "search-results":
      frame.screen = "list";
      frame.search = { query: "design", progress: 1, results: true };
      break;
    case "sidebar-search":
      frame.screen = "list";
      frame.sidebarSearch = "sam";
      break;
    // iOS pushes its details screen; macOS opens the inspector beside the transcript. Both settled.
    case "details":
      frame.screen = "details";
      frame.details = { progress: 1 };
      frame.detailsPane = { open: true, progress: 1 };
      break;
    case "details-open":
      frame.screen = "details";
      frame.detailsPane = { open: true, progress: clamp01(t / unverifiedMotion.macDetailsOpen) };
      break;
    case "details-photos":
      frame.screen = "details";
      frame.detailsPane = { open: true, progress: 1, tab: "photos" };
      break;
    case "group-details":
      makeGroup(frame);
      frame.screen = "details";
      frame.details = { progress: 1 };
      break;
    case "group-details-open":
      makeGroup(frame);
      frame.screen = "details";
      frame.details = { progress: clamp01(t / unverifiedMotion.detailsOpen) };
      break;
    // `scroll` is points, not milliseconds: at `detailsCollapseTravel` the header has fully collapsed
    // into the conversation's own measured nav bar, which is the far end of the morph.
    case "group-details-scrolled":
      makeGroup(frame);
      frame.screen = "details";
      frame.details = { progress: 1, scroll: detailsCollapseTravel };
      break;
    case "plus-menu":
      frame.menu = "plus";
      frame.plusMenu = { progress: 1 };
      break;
    case "plus-menu-open":
      frame.menu = "plus";
      frame.plusMenu = { progress: clamp01(t / unverifiedMotion.plusMenuOpen) };
      break;
    // The sheet folding back into the `+`. Stated as a separate scenario rather than the open played
    // backwards because the component runs a stiffer spring on the way out (ζ 1 / ω 24 against
    // ζ 0.86 / ω 15), and `progress` here seeks the open table from 1 down to 0, which is the shape
    // that spring settles on. See the report: neither end is measured.
    case "plus-menu-close":
      frame.menu = "plus";
      frame.plusMenu = { progress: 1 - clamp01(t / unverifiedMotion.plusMenuClose) };
      break;
    case "photo-picker":
      frame.photoPicker = {
        progress: clamp01(t / unverifiedMotion.photoPickerOpen),
        detent: "collapsed",
        selected: t >= 1000 ? ["bloom", "falls"] : t >= 700 ? ["bloom"] : [],
      };
      break;
    case "photo-picker-expanded":
      frame.photoPicker = { progress: 1, detent: t >= unverifiedMotion.photoPickerOpen ? "expanded" : "collapsed", selected: ["bloom"] };
      break;
    case "sticker-picker":
      frame.stickerPicker = { tab: "recents", progress: clamp01(t / unverifiedMotion.stickerSheetOpen) };
      break;
    // From Alex Morgan to Design Crit: a different transcript, a different name in the pill, a
    // monogram crossing to the Snowglobe stack, and the sidebar's selected row travelling one place
    // down. Only the two ends render on a fresh load, because the shell derives the leaving copy
    // from a real change of the selected conversation — see the scenario's own entry above.
    case "switch-conversation":
      if (t > 0) makeGroup(frame);
      frame.conversationSwitch = { from: "alex", to: t > 0 ? "design" : "alex", progress: clamp01(t / unverifiedMotion.conversationSwitch) };
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
