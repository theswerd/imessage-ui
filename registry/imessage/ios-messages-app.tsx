"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { PlatformProvider } from "@/registry/imessage/platform";
import { PaletteStyle } from "@/registry/imessage/palette";
import { IosStatusBar } from "@/registry/imessage/ios-status-bar";
import { IosNavBar } from "@/registry/imessage/ios-nav-bar";
import { IosComposer } from "@/registry/imessage/ios-composer";
import { IosConversationList, type IosConversation } from "@/registry/imessage/ios-conversation-list";
import { IosNewMessageSheet } from "@/registry/imessage/ios-new-message-sheet";
import { MessageList, messageListMetrics, type Message, type MessageListHandle } from "@/registry/imessage/message-list";
import { isEmojiOnly, MessageBubble } from "@/registry/imessage/message-bubble";
import { LinkPreview } from "@/registry/imessage/link-preview";
import { MessageAttachment } from "@/registry/imessage/message-attachment";
import { MessageAudio } from "@/registry/imessage/message-audio";
import { MessageImages } from "@/registry/imessage/message-image";
import { bubbleMetrics, emojiFontStack, fontStack } from "@/registry/imessage/tokens";
import { ReplyThread, replyThreadMetrics, replyThreadMotion } from "@/registry/imessage/message-reply";
import { Tapback, type TapbackType } from "@/registry/imessage/tapback";
import { MessageActions, type Rect } from "@/registry/imessage/message-actions";
import { useArrivalAnimation, type ArrivalAnimation } from "@/registry/imessage/message-motion";
import { IosEffectsPicker, type EffectsPickerSelection } from "@/registry/imessage/ios-effects-picker";
import type { TapbackSelection } from "@/registry/imessage/tapback-bar";

/**
 * `listTop` puts the first date header's ink at y 172.67 (conv3-light.png). `listBottom` is the composer's
 * 68pt band plus the 28pt it keeps clear: in the one scrolled iOS capture (dateheader-mid-light.png) the
 * last row's ink bottom is at 778 with the composer field starting at 806.
 */
export const iosScreen = { width: 402, height: 874, statusBar: 54, navBar: 94, listTop: 169.5, composer: 68, listBottom: 96 } as const;

export type IosScreen = "list" | "conversation" | "new-message";

/**
 * Moving between screens. A conversation is pushed in from the trailing edge while the list follows
 * it part of the way out and dims under it; going back plays that backwards; the New Message sheet
 * comes up from the bottom while its dim fades in.
 *
 * UNVERIFIED. Nothing in `references/` captures a screen change, so not one of these numbers is
 * measured. They are kept in the family of the motion that is: the send flight that settles by
 * ~520 ms, the 380 ms long-press entrance, the 260 ms effects screen and its 320 ms move. Replace
 * them from a recording before describing any of it as measured.
 *
 * Each one is a Web Animations timeline rather than a transition or a rAF loop, so
 * `screenTransition.progress` can seek a frame instead of playing it, and `document.getAnimations()`
 * reaches it (which is how the harness freezes a checkpoint).
 */
export const iosScreenTransition = {
  push: 350,
  pop: 320,
  present: 400,
  dismiss: 280,
  /** How far the screen underneath follows the one on top, as a share of the screen width. */
  parallax: 0.3,
  /** Black over the screen that slid back, at the end of the push. */
  dim: 0.14,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

export type IosScreenTransitionKind = "push" | "pop" | "present" | "dismiss";

/**
 * Which transition takes the app from one screen to another. The list and a conversation are a
 * navigation stack; the sheet is presented over whichever of them is showing. Going from the sheet
 * straight into a conversation (a recipient was chosen) pushes from the list underneath it, so the
 * sheet leaves with the screen it was presented over.
 */
export function screenTransitionKind(from: IosScreen, to: IosScreen): IosScreenTransitionKind | null {
  if (from === to) return null;
  if (to === "new-message") return "present";
  if (from === "new-message" && to === "list") return "dismiss";
  return to === "conversation" ? "push" : "pop";
}

export type IosMessagesAppProps = {
  width?: number;
  height?: number;
  /** Status bar clock. */
  time?: string;
  screen?: IosScreen;
  conversations?: IosConversation[];
  contact: { name: string; initials?: string };
  group?: boolean;
  messages: Message[];
  typing?: boolean | { sender?: string };
  /** Reference time for "Today"/"Yesterday". */
  now?: Date | number;
  composer?: { value?: string; placeholder?: string; disabled?: boolean; onChange?: (value: string) => void; onSend?: (text: string) => void | Promise<void>; onAttach?: () => void };
  /**
   * Scrub a screen change instead of playing it: the app is on `screen`, arriving from `from`, and
   * `progress` (0..1) seeks the push, the pop or the sheet. Leave it out and the app runs the
   * transition itself whenever `screen` changes, which is what an application wants; a harness that
   * renders one frame at a time has nothing to observe changing and states it instead.
   */
  screenTransition?: { from: IosScreen; progress: number } | null;
  onBack?: () => void;
  onSelectConversation?: (conversation: IosConversation) => void;
  onCompose?: () => void;
  onCloseNewMessage?: () => void;
  onDetails?: () => void;
  /**
   * The open thread: the message whose replies are showing. The conversation blurs behind it. Its
   * members are the message itself and every message replying to it, so the caller only names the
   * root. `progress` (0..1) seeks the entrance rather than playing it.
   */
  thread?: { rootId: string; progress?: number } | null;
  /** The reply count under a message was activated. */
  onOpenThread?: (id: string) => void;
  /** The thread was dismissed. The overlay stays up for its exit after `thread` clears. */
  onCloseThread?: () => void;
  /**
   * That message was just sent: the composer's text row becomes its bubble and flies to its slot.
   * With `progress` the animation is seeked to `progress * duration` instead of played.
   */
  sendAnimation?: ArrivalAnimation | null;
  /** That message just arrived: it pops in from the typing indicator's position. */
  receiveAnimation?: ArrivalAnimation | null;
  /** Called when a played (not seeked) send animation finishes. */
  onSendAnimationEnd?: () => void;
  /** Open the long-press overlay on a message; `progress` scrubs the entrance (0–1). */
  longPress?: { id: string; progress?: number } | null;
  onLongPress?: (id: string) => void;
  onLongPressClose?: () => void;
  onTapback?: (id: string, selection: TapbackSelection) => void;
  onMenuAction?: (id: string, action: string) => void;
  /**
   * The "Send with effect" screen. iOS opens it on a press and hold of the send button, which is what
   * `onEffectsPickerOpen` reports; pass the state back here to show it.
   */
  effectsPicker?: { tab?: "bubble" | "screen"; selection?: EffectsPickerSelection; draft?: string; progress?: number } | null;
  onEffectsPickerOpen?: (draft: string) => void;
  onEffectsTabChange?: (tab: "bubble" | "screen") => void;
  onEffectSelect?: (selection: EffectsPickerSelection) => void;
  onSendWithEffect?: (text: string, selection: EffectsPickerSelection) => void;
  onEffectsPickerClose?: () => void;
  /** Extra overlays (details screen, plus menu, selection toolbar) rendered above everything. */
  overlay?: ReactNode;
  /** Render reactions for a message; defaults to the message's `reactions` as Tapback balloons. */
  renderReactions?: (message: Message) => ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Exposes the device frame element (for screen-space measurements and overlays). */
  frameRef?: RefObject<HTMLDivElement | null>;
};

/**
 * Several people reacting to one message is **one** balloon, not one per person.
 *
 * ChatKit collapses them into a `CKAggregateAcknowledgmentChatItem`, and that item carries a single
 * `acknowledgmentImageName` and `acknowledgmentImageColor` next to `latestTapback`,
 * `latestAcknowledgmentType`, `latestIsFromMe` and `includesMultiple`. One image name means one
 * glyph: the transcript shows the most recent reaction, tinted by whether that one is yours, and
 * says how many there are. Two glyphs would need two names, and there is no second name.
 *
 * `-[CKUIBehaviorPhone aggregateAcknowledgmentTranscriptBalloonSize]` is `{46, 40}` against
 * `messageAcknowledgmentTranscriptBalloonSize` `{36, 36}` for a single, so the aggregate balloon is
 * 10 wider and 4 taller. `Tapback`'s count pill grows the width and not the height; the extra 4 pt
 * is not applied yet, and no capture of a multi-person reaction exists to settle how the count is
 * set inside it.
 */
export function defaultReactions(message: Message): ReactNode {
  const all = message.reactions;
  if (!all?.length) return undefined;
  const outgoing = message.direction === "outgoing";
  const latest = all[all.length - 1];
  return (
    <div data-slot="reaction-stack" className="flex">
      <Tapback reaction={latest.emoji ? undefined : (latest.type as TapbackType)} emoji={latest.emoji}
        own={latest.byMe ?? true} side={outgoing ? "left" : "right"} count={all.length > 1 ? all.length : undefined} />
    </div>
  );
}

/**
 * A message's body box, whichever kind it is. Every kind draws its own slot and only a text or audio
 * message has a `bubble`, so measuring that alone left an emoji-only message, a photo, a link card and
 * a file card with no rect at all, and the long-press overlay never opened on any of them.
 * `ios-select-mode.tsx`, `ios-swipe-times.tsx` and `message-motion.tsx` measure the same way.
 */
const messageBodySelector = ['[data-slot="bubble"]', '[data-slot="emoji"]', '[data-slot="image-grid"]', '[data-slot="link-preview"]', '[data-slot="message-attachment"]'].join(", ");

/**
 * What the lifted copy replaces, so the original is not drawn twice. One entry per body above, taking
 * the whole wrapper where the body has one (`bubble-frame` carries the tail and the balloons,
 * `message-images` carries the photo tail), plus the delivery label, which the overlay does not lift.
 */
const messageBodyHiddenSlots = ["bubble-frame", "emoji", "message-images", "link-preview", "message-attachment", "status"];

/**
 * A quoted reply stub draws a scaled copy of the quoted message, tail and all, above the message that
 * replies. It is the row's first `[data-slot="bubble"]`, so the overlay used to lift the quotation
 * instead of the message: measured on the harness's `reply` scene, the stub's 157.97×30.39 box at
 * y 570.36 instead of the message's own 133.44×40 at y 605.08.
 */
const insideQuotedStub = (element: HTMLElement) => Boolean(element.closest("[data-stub]"));

/**
 * The whole iOS 26 Messages app in a 402×874 frame: status bar, the conversation list, the conversation
 * screen (nav bar, message log, composer), the New Message sheet, and the long-press overlay.
 * Data and navigation stay with the caller; this component only draws state.
 */
export function IosMessagesApp({
  width = iosScreen.width, height = iosScreen.height, time = "9:41", screen = "conversation", conversations = [], contact, group = false,
  messages, typing = false, now, composer, screenTransition, onBack, onSelectConversation, onCompose, onCloseNewMessage, onDetails,
  thread, onOpenThread, onCloseThread,
  sendAnimation, receiveAnimation, onSendAnimationEnd,
  longPress, onLongPress, onLongPressClose, onTapback, onMenuAction,
  effectsPicker, onEffectsPickerOpen, onEffectsTabChange, onEffectSelect, onSendWithEffect, onEffectsPickerClose,
  overlay, renderReactions = defaultReactions, className, style, frameRef,
}: IosMessagesAppProps) {
  const localFrame = useRef<HTMLDivElement>(null);
  const frame = frameRef ?? localFrame;
  const list = useRef<MessageListHandle>(null);
  const [pressedRect, setPressedRect] = useState<{ id: string; rect: Rect; tail: boolean } | null>(null);
  const pressed = longPress ? messages.find(message => message.id === longPress.id) : undefined;
  const pressedId = pressed?.id;
  // The overlay stays mounted for its exit timeline after `longPress` clears. Deriving this during
  // render rather than in an effect matters: an effect would leave one committed frame with the
  // overlay already gone, and the dismissal would never be seen.
  const [seenPressedId, setSeenPressedId] = useState<string | null>(pressedId ?? null);
  const [closing, setClosing] = useState<string | null>(null);
  if (seenPressedId !== (pressedId ?? null)) {
    setSeenPressedId(pressedId ?? null);
    setClosing(pressedId ? null : seenPressedId);
  }
  const overlayId = pressedId ?? closing;
  const overlayMessage = overlayId ? messages.find(message => message.id === overlayId) : undefined;

  // Same derive-during-render rule as the long-press overlay: the effects screen has to outlive the
  // prop that opened it or its exit never gets a committed frame to run in.
  const pickerOpen = effectsPicker != null;
  const [seenPickerOpen, setSeenPickerOpen] = useState(pickerOpen);
  const [pickerClosing, setPickerClosing] = useState(false);
  const [capturedDraft, setCapturedDraft] = useState("");
  if (seenPickerOpen !== pickerOpen) {
    setSeenPickerOpen(pickerOpen);
    setPickerClosing(!pickerOpen && seenPickerOpen);
  }
  const draft = effectsPicker?.draft ?? composer?.value ?? capturedDraft;

  // A screen change is a transition, not a cut, so the screen that is leaving has to outlive the
  // prop that dismissed it. Same rule as the two overlays above: the previous screen is captured
  // during render, because an effect would leave one committed frame with it already unmounted and
  // the push out would never run.
  const [seenScreen, setSeenScreen] = useState<IosScreen>(screen);
  const [nav, setNav] = useState<{ from: IosScreen; to: IosScreen; run: number } | null>(null);
  if (seenScreen !== screen) {
    setSeenScreen(screen);
    setNav(screenTransition ? null : current => ({ from: seenScreen, to: screen, run: (current?.run ?? 0) + 1 }));
  }
  // A stated transition replaces a derived one. Leaving the derived one behind would replay it the
  // moment the caller stopped stating transitions.
  if (screenTransition && nav) setNav(null);
  const moving = screenTransition
    ? { from: screenTransition.from, kind: screenTransitionKind(screenTransition.from, screen), run: -1, progress: screenTransition.progress }
    : nav
      ? { from: nav.from, kind: screenTransitionKind(nav.from, nav.to), run: nav.run, progress: undefined }
      : null;
  const kind = moving?.kind ?? null;
  const from = kind ? moving!.from : null;
  const showList = screen === "list" || screen === "new-message" || from === "list" || from === "new-message";
  const showConversation = screen === "conversation" || from === "conversation";
  const showSheet = screen === "new-message" || kind === "dismiss";
  const listLayer = useRef<HTMLDivElement>(null);
  const conversationLayer = useRef<HTMLDivElement>(null);
  const screenDim = useRef<HTMLDivElement>(null);
  const movingRun = moving?.run;
  const movingProgress = moving?.progress;
  useLayoutEffect(() => {
    if (!kind) return;
    const t = iosScreenTransition;
    const duration = t[kind];
    const running: Animation[] = [];
    const play = (element: Element | null | undefined, keyframes: Keyframe[]) => {
      if (element) running.push(element.animate(keyframes, { duration, easing: t.ease, fill: "both" }));
    };
    // A pop is the push played backwards and a dismissal is the sheet's presentation played
    // backwards, so each pair is written once, in the forward direction, and the frames are swapped.
    const forward = kind === "push" || kind === "present";
    const order = (a: Keyframe, b: Keyframe) => (forward ? [a, b] : [b, a]);
    if (kind === "push" || kind === "pop") {
      play(conversationLayer.current, order({ transform: "translateX(100%)" }, { transform: "translateX(0%)" }));
      play(listLayer.current, order({ transform: "translateX(0%)" }, { transform: `translateX(${-100 * t.parallax}%)` }));
      play(screenDim.current, order({ opacity: 0 }, { opacity: t.dim }));
    } else {
      // The sheet paints its own dim on its root and holds the panel inside it, so the panel slides
      // and the dim fades separately. Reading the resting colour keeps the fade theme-correct
      // without this file knowing what the sheet's dim is.
      const sheet = frame.current?.querySelector<HTMLElement>('[data-slot="ios-new-message-sheet"]');
      const panel = sheet?.querySelector<HTMLElement>('[data-slot="sheet"]');
      const dim = sheet ? getComputedStyle(sheet).backgroundColor : "rgba(0, 0, 0, 0)";
      play(panel, order({ transform: "translateY(100%)" }, { transform: "translateY(0%)" }));
      play(sheet, order({ backgroundColor: "rgba(0, 0, 0, 0)" }, { backgroundColor: dim }));
    }
    if (movingProgress !== undefined) {
      // Seeked, not played: a scrubbed checkpoint has to land on the same frame every run.
      const at = Math.max(0, Math.min(1, movingProgress)) * duration;
      for (const animation of running) { animation.pause(); animation.currentTime = at; }
      return () => { for (const animation of running) animation.cancel(); };
    }
    const last = running[running.length - 1];
    const done = () => setNav(null);
    last?.addEventListener("finish", done);
    // Reduced motion cuts to the destination: the same timelines, jumped to their end, so the screen
    // that is leaving still unmounts through the same finish.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      for (const animation of running) animation.finish();
    }
    return () => {
      last?.removeEventListener("finish", done);
      for (const animation of running) animation.cancel();
    };
  }, [kind, from, movingRun, movingProgress, frame]);

  // The thread overlay follows the same derive-during-render rule so its exit gets a frame to run in.
  const threadRootId = thread?.rootId ?? null;
  const [seenThread, setSeenThread] = useState<string | null>(threadRootId);
  const [threadClosing, setThreadClosing] = useState<string | null>(null);
  if (seenThread !== threadRootId) {
    setSeenThread(threadRootId);
    setThreadClosing(threadRootId ? null : seenThread);
  }
  const threadId = threadRootId ?? threadClosing;
  const threadRoot = threadId ? messages.find(message => message.id === threadId) : undefined;
  const threadReplies = threadId ? messages.filter(message => message.replyTo?.id === threadId) : [];
  const threadOpen = threadRootId !== null;
  const threadShown = Boolean(threadRoot);
  const threadProgress = thread?.progress;
  // The thread's blur belongs to the conversation, not to the overlay. `ReplyThread` blurs either a
  // copy of the conversation passed as `backdrop` or, with neither, whatever `backdrop-filter`
  // samples, and it documents why the second is unreliable in a capture. This is the third way: the
  // conversation is already its own layer here, so blurring that layer is a real filter with no
  // second copy of the log in the DOM (a copy would duplicate every `data-message-id`, which the
  // long-press measurement below looks up by). `blur={0}` on the overlay leaves the job here, and
  // the ramp copies the overlay's own: the dim's duration, seeked on the entrance's clock.
  useLayoutEffect(() => {
    const element = conversationLayer.current;
    if (!element || !threadShown) return;
    const blur = replyThreadMetrics.ios.blur;
    const animation = threadOpen
      ? element.animate([{ filter: "blur(0px)" }, { filter: `blur(${blur}px)` }], { duration: replyThreadMotion.dim, easing: "ease-out", fill: "both" })
      : element.animate([{ filter: `blur(${blur}px)` }, { filter: "blur(0px)" }], { duration: replyThreadMotion.exit, easing: replyThreadMotion.exitEase, fill: "both" });
    if (threadOpen && threadProgress !== undefined) {
      animation.pause();
      animation.currentTime = Math.max(0, Math.min(1, threadProgress)) * replyThreadMotion.enter;
    } else if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // The overlay jumps to its settled frame under reduced motion; the blur goes with it.
      animation.finish();
    }
    return () => animation.cancel();
  }, [threadShown, threadOpen, threadProgress]);

  useArrivalAnimation({ frame, send: sendAnimation, receive: receiveAnimation, onSendEnd: onSendAnimationEnd });

  // Measure the pressed bubble's body inside the frame so the overlay can lift a copy of it in place.
  // The first render after `longPress` opens has no layout yet, so measure on the next frame; the
  // observer keeps the rect right when the list scrolls, wraps, or fonts settle.
  useLayoutEffect(() => {
    if (!pressedId) return;
    let raf = 0;
    const measure = () => {
      const root = frame.current;
      const row = root?.querySelector<HTMLElement>(`[data-message-id="${pressedId}"]`);
      if (!root || !row) return;
      // Every body this message drew, minus anything inside its quoted stub. A file message can carry
      // several cards, so take the union rather than the first: the lift covers all of them.
      const bodies = Array.from(row.querySelectorAll<HTMLElement>(messageBodySelector)).filter(element => !insideQuotedStub(element));
      if (!bodies.length) return;
      const f = root.getBoundingClientRect();
      const boxes = bodies.map(element => element.getBoundingClientRect());
      const left = Math.min(...boxes.map(b => b.left)), top = Math.min(...boxes.map(b => b.top));
      const rect = { x: left - f.left, y: top - f.top, width: Math.max(...boxes.map(b => b.right)) - left, height: Math.max(...boxes.map(b => b.bottom)) - top };
      // Read the tail off the message rather than assuming one: a bubble in the middle of a cluster
      // has none, and an emoji-only message has no bubble to hang one from.
      const tail = Array.from(row.querySelectorAll<HTMLElement>('[data-slot="tail"]')).some(element => !insideQuotedStub(element));
      setPressedRect(current => (current?.id === pressedId && current.tail === tail && Math.abs(current.rect.x - rect.x) < 0.5 && Math.abs(current.rect.y - rect.y) < 0.5 && Math.abs(current.rect.width - rect.width) < 0.5 ? current : { id: pressedId, rect, tail }));
    };
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    // Measure synchronously so the overlay is on screen at the first paint after the press. Deferring
    // it to a frame makes the opened menu appear one frame late, which is invisible to a person but
    // makes a screenshot of the opening checkpoint depend on timing.
    measure();
    const observer = new ResizeObserver(schedule);
    if (frame.current) observer.observe(frame.current);
    document.fonts?.ready.then(schedule).catch(() => {});
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [pressedId, frame, messages]);
  const pressedBody = pressedRect && pressedRect.id === overlayId ? pressedRect : null;

  return (
    <PlatformProvider platform="ios">
      <PaletteStyle platform="ios" />
      <div ref={frame} data-slot="ios-messages-app" data-im-platform="ios" data-screen={screen} data-transition={kind ?? undefined}
        className={cn("relative isolate overflow-hidden select-none", className)}
        style={{ width, height, background: "var(--im-bg)", color: "var(--im-incoming-text)", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", ...style }}>
        {/* Each screen is its own layer so a transition has something to move. At rest a layer
            carries no transform: a transform node makes Chrome snap its descendants to whole CSS px,
            which would move text by a fraction of a point against the captures. */}
        {showList && (
          <div ref={listLayer} data-slot="screen-list" className="absolute inset-0" style={{ pointerEvents: screen === "conversation" ? "none" : undefined }}>
            <IosConversationList conversations={conversations} onSelect={onSelectConversation} onCompose={onCompose} topInset={iosScreen.statusBar} className="absolute inset-0" />
            {(kind === "push" || kind === "pop") && <div ref={screenDim} aria-hidden="true" data-slot="screen-dim" className="pointer-events-none absolute inset-0" style={{ background: "#000000", opacity: 0 }} />}
          </div>
        )}
        {showConversation && (
          <div ref={conversationLayer} data-slot="screen-conversation" className="absolute inset-0" style={{ pointerEvents: screen === "conversation" ? undefined : "none" }}>
            <MessageList ref={list} frameRef={frame} messages={messages} typing={typing} group={group} now={now} anchor="top"
              insetTop={iosScreen.listTop} insetBottom={iosScreen.listBottom} renderReactions={renderReactions} messageActions={Boolean(onLongPress)}
              onOpenThread={onOpenThread} className="absolute inset-0" />
            <IosNavBar name={contact.name} initials={contact.initials} onBack={onBack} onDetails={onDetails} className="absolute left-0" style={{ top: iosScreen.statusBar }} />
            <IosComposer className="absolute bottom-0 left-0" value={composer?.value} placeholder={composer?.placeholder} disabled={composer?.disabled}
              onChange={composer?.onChange} onSend={composer?.onSend} onAttach={composer?.onAttach} />
            {onLongPress && <LongPressLayer frame={frame} onLongPress={onLongPress} />}
            {onEffectsPickerOpen && (
              <SendHoldLayer
                frame={frame}
                onHold={value => {
                  setCapturedDraft(value);
                  onEffectsPickerOpen(value);
                }}
              />
            )}
          </div>
        )}
        {(pickerOpen || pickerClosing) && (
          <IosEffectsPicker
            tab={effectsPicker?.tab}
            selection={effectsPicker?.selection ?? null}
            open={pickerOpen}
            progress={effectsPicker?.progress}
            onExited={() => setPickerClosing(false)}
            onTabChange={onEffectsTabChange}
            onSelect={onEffectSelect}
            onSend={selection => onSendWithEffect?.(draft, selection)}
            onClose={onEffectsPickerClose}
            preview={<MessageBubble direction="outgoing" tail>{draft}</MessageBubble>}
          />
        )}
        {/* The thread the reply count opened: the message it hangs off, then every message replying
            to it, over the conversation layer the effect above blurs. Its bubbles are laid out by
            the overlay rather than by the log, so they carry no screen-space fill position and take
            the mid-screen colour; no capture shows a thread, so that is provisional with the rest. */}
        {threadRoot && (
          <ReplyThread open={threadOpen} progress={threadProgress} onExited={() => setThreadClosing(null)} onClose={onCloseThread} blur={0}
            root={<ThreadRow message={threadRoot} tail />}>
            {threadReplies.map((message, index) => (
              // The measured cluster rule: only the last bubble of a run by one sender is tailed.
              <ThreadRow key={message.id} message={message} tail={index === threadReplies.length - 1 || threadReplies[index + 1].direction !== message.direction} />
            ))}
          </ReplyThread>
        )}
        {/* The status bar stays crisp above the effects screen, the way it does natively. */}
        <IosStatusBar time={time} className="absolute left-0 top-0" />
        {showSheet && (
          <IosNewMessageSheet onClose={onCloseNewMessage} caret style={{ pointerEvents: screen === "new-message" ? undefined : "none" }}>
            <IosComposer placeholder="" value={composer?.value} onChange={composer?.onChange} onSend={composer?.onSend} />
          </IosNewMessageSheet>
        )}
        {/* The overlay lifts a copy of the pressed message at the same spot, so hide the original. */}
        {overlayMessage && pressedBody && <style>{messageBodyHiddenSlots.map(slot => `[data-message-id="${overlayMessage.id}"] [data-slot="${slot}"]`).join(",")}{"{visibility:hidden}"}</style>}
        {overlayMessage && pressedBody && (
          <MessageActions rect={pressedBody.rect} frame={{ width, height }} direction={overlayMessage.direction} service={overlayMessage.service ?? "imessage"}
            progress={longPress?.progress} autoFocus={longPress?.progress === undefined && !closing}
            open={!closing} onExited={() => setClosing(null)}
            // The menu's glass picks up the bubble behind it, and a message with no bubble has none to
            // give: an emoji-only message, a photo, a link card and a file card all take the plain glass.
            wash={liftsABubble(overlayMessage) ? undefined : null}
            selected={overlayMessage.reactions?.find(r => r.byMe) ? (overlayMessage.reactions.find(r => r.byMe)!.emoji ? { emoji: overlayMessage.reactions.find(r => r.byMe)!.emoji! } : { type: overlayMessage.reactions.find(r => r.byMe)!.type as TapbackType }) : undefined}
            onSelect={selection => onTapback?.(overlayMessage.id, selection)} onAction={action => onMenuAction?.(overlayMessage.id, action)} onClose={onLongPressClose}>
            <LiftedMessage message={overlayMessage} tail={pressedBody.tail} screenBottom={pressedBody.rect.y + pressedBody.rect.height} />
          </MessageActions>
        )}
        {overlay}
      </div>
    </PlatformProvider>
  );
}

/**
 * Which of the log's row shapes a message takes. `message-list.tsx` picks in exactly this order, so a
 * photo whose caption happens to be one emoji is still a photo, and this has to agree with it or the
 * overlay would lift something the log never drew.
 */
type MessageShape = "link" | "image" | "audio" | "attachment" | "emoji" | "bubble";

function messageShape(message: Message): MessageShape {
  if (message.kind === "link" && message.link) return "link";
  if (message.kind === "image" && message.images?.length) return "image";
  if (message.kind === "audio" && message.audio) return "audio";
  if (message.kind === "attachment" && message.attachments?.length) return "attachment";
  return message.kind !== "link" && isEmojiOnly(message.text) ? "emoji" : "bubble";
}

/** Only these two shapes draw a coloured bubble; the rest carry their own surface, or none at all. */
function liftsABubble(message: Message): boolean {
  const shape = messageShape(message);
  return shape === "bubble" || shape === "audio";
}

/**
 * The copy the long-press overlay lifts. It has to be the same thing the log drew, so it is built the
 * same way `message-list.tsx` builds a row: a photo message lifts its photos, a file message its cards,
 * an emoji-only message a bare glyph at the log's emoji metrics, and only text and audio lift a bubble.
 * Lifting `message.text` as a bubble for every kind put a balloon reading "Photos" where the picture is.
 *
 * The glyph drops the log's `emojiShift`: the shift moves the whole element box, the overlay measured
 * the box after it moved, and the copy is placed at that measured box, so re-applying it would double it.
 */
function LiftedMessage({ message, tail, screenBottom }: { message: Message; tail: boolean; screenBottom: number }) {
  const outgoing = message.direction === "outgoing";
  switch (messageShape(message)) {
    case "link":
      return <LinkPreview href={message.link!.url} title={message.link!.title} host={message.link!.host} image={message.link!.image} />;
    case "image":
      return <MessageImages images={message.images!} direction={message.direction} tail={tail} />;
    case "audio":
      return <MessageAudio duration={message.audio!.duration} peaks={message.audio!.peaks} direction={message.direction} tail={tail} />;
    case "attachment":
      return (
        <>
          {message.attachments!.map((file, index) => (
            <MessageAttachment key={file.name + index} name={file.name} size={file.size} href={file.href}
              direction={message.direction} tail={tail && index === message.attachments!.length - 1}
              style={index ? { marginTop: bubbleMetrics.ios.gapInGroup } : undefined} />
          ))}
        </>
      );
    case "emoji":
      return (
        <div data-slot="message-bubble" data-direction={message.direction} data-platform="ios" data-emoji-only="true"
          className={cn("flex min-w-0 flex-col", outgoing ? "items-end" : "items-start")} style={{ width: "100%", fontFamily: fontStack }}>
          <div data-slot="emoji" style={{ fontSize: messageListMetrics.ios.emojiSize, lineHeight: `${messageListMetrics.ios.emojiLineHeight}px`, fontFamily: emojiFontStack, padding: `0 ${messageListMetrics.ios.emojiPadX}px`, whiteSpace: "nowrap" }}>
            <span className="sr-only">{outgoing ? "You: " : `${message.sender ?? "Contact"}: `}</span>{message.text.trim()}
          </div>
        </div>
      );
    default:
      return <MessageBubble direction={message.direction} service={message.service ?? "imessage"} tail={tail} screenBottom={screenBottom}>{message.text}</MessageBubble>;
  }
}

/** One message inside the thread overlay, on its own edge. */
function ThreadRow({ message, tail }: { message: Message; tail: boolean }) {
  return (
    <div data-slot="thread-row" data-direction={message.direction} className={cn("flex w-full", message.direction === "outgoing" ? "justify-end" : "justify-start")}>
      <MessageBubble direction={message.direction} service={message.service ?? "imessage"} tail={tail}>{message.text}</MessageBubble>
    </div>
  );
}

/**
 * Turns a press and hold on the composer's send button into `onHold(draft)`, and swallows the click
 * that a pointer release would otherwise fire so the message is not also sent.
 */
function SendHoldLayer({ frame, onHold }: { frame: RefObject<HTMLDivElement | null>; onHold: (draft: string) => void }) {
  const latest = useRef(onHold);
  useEffect(() => { latest.current = onHold; }, [onHold]);
  useEffect(() => {
    const composer = frame.current?.querySelector<HTMLElement>('[data-slot="ios-composer"]');
    if (!composer) return;
    // Delegate from the form, not the button: the send button only exists while the field has text,
    // so a listener bound to it at mount would never see the composer's first message.
    const sendAt = (target: EventTarget | null) => (target as HTMLElement | null)?.closest?.('[data-slot="send"]') ?? null;
    const draft = () => composer.querySelector<HTMLTextAreaElement>("textarea")?.value ?? "";
    let timer: ReturnType<typeof setTimeout> | null = null;
    let held = false;
    const cancel = () => { if (timer) clearTimeout(timer); timer = null; };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !sendAt(event.target)) return;
      held = false;
      cancel();
      timer = setTimeout(() => { cancel(); held = true; latest.current(draft()); }, 500);
    };
    const onClick = (event: MouseEvent) => {
      if (!held || !sendAt(event.target)) return;
      // The hold already opened the effects screen; do not also send the message.
      event.preventDefault();
      event.stopPropagation();
      held = false;
    };
    const onContextMenu = (event: MouseEvent) => {
      if (!sendAt(event.target)) return;
      event.preventDefault();
      cancel();
      latest.current(draft());
    };
    composer.addEventListener("pointerdown", onPointerDown);
    composer.addEventListener("pointerup", cancel);
    composer.addEventListener("pointercancel", cancel);
    composer.addEventListener("pointerleave", cancel);
    composer.addEventListener("click", onClick, true);
    composer.addEventListener("contextmenu", onContextMenu);
    return () => {
      cancel();
      composer.removeEventListener("pointerdown", onPointerDown);
      composer.removeEventListener("pointerup", cancel);
      composer.removeEventListener("pointercancel", cancel);
      composer.removeEventListener("pointerleave", cancel);
      composer.removeEventListener("click", onClick, true);
      composer.removeEventListener("contextmenu", onContextMenu);
    };
  }, [frame]);
  return null;
}

/** Turns a long press (or right-click / double-click) on any bubble in the frame into `onLongPress(id)`. */
function LongPressLayer({ frame, onLongPress }: { frame: RefObject<HTMLDivElement | null>; onLongPress: (id: string) => void }) {
  const latest = useRef(onLongPress);
  useEffect(() => { latest.current = onLongPress; }, [onLongPress]);
  // Bind from an effect, not from a ref callback: React attaches a child's ref before its ancestors',
  // so `frame.current` is still null while this layer's ref runs and the listeners would never land.
  // The effect also removes them again, so a remounted log is not left with a stale binding.
  useEffect(() => {
    const log = frame.current?.querySelector<HTMLElement>('[data-slot="message-list"]');
    if (!log) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let target: string | null = null;
    let origin = { x: 0, y: 0 };
    const cancel = () => { if (timer) clearTimeout(timer); timer = null; target = null; };
    const idAt = (element: EventTarget | null) => (element as HTMLElement | null)?.closest?.("[data-message-id]")?.getAttribute("data-message-id") ?? null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const id = idAt(event.target);
      if (!id) return;
      cancel(); target = id; origin = { x: event.clientX, y: event.clientY };
      timer = setTimeout(() => { const pressedId = target; cancel(); if (pressedId) latest.current(pressedId); }, 500);
    };
    const onPointerMove = (event: PointerEvent) => { if (timer && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8) cancel(); };
    const onContextMenu = (event: MouseEvent) => { const id = idAt(event.target); if (id) { event.preventDefault(); cancel(); latest.current(id); } };
    const onDoubleClick = (event: MouseEvent) => { const id = idAt(event.target); if (id) latest.current(id); };
    // The keyboard equivalent of the hold: the log's arrow keys focus a message, and these keys open
    // its actions. Without this the overlay would be reachable by pointer only.
    const onKeyDown = (event: KeyboardEvent) => {
      const row = event.target as HTMLElement | null;
      if (!row?.matches?.('[data-slot="message-row"][data-message-id]')) return;
      if (event.key !== "Enter" && event.key !== " " && event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
      const id = idAt(row);
      if (!id) return;
      event.preventDefault();
      cancel();
      latest.current(id);
    };
    log.addEventListener("pointerdown", onPointerDown);
    log.addEventListener("pointermove", onPointerMove);
    log.addEventListener("pointerup", cancel);
    log.addEventListener("pointercancel", cancel);
    log.addEventListener("contextmenu", onContextMenu);
    log.addEventListener("dblclick", onDoubleClick);
    log.addEventListener("keydown", onKeyDown);
    return () => {
      cancel();
      log.removeEventListener("pointerdown", onPointerDown);
      log.removeEventListener("pointermove", onPointerMove);
      log.removeEventListener("pointerup", cancel);
      log.removeEventListener("pointercancel", cancel);
      log.removeEventListener("contextmenu", onContextMenu);
      log.removeEventListener("dblclick", onDoubleClick);
      log.removeEventListener("keydown", onKeyDown);
    };
  }, [frame]);
  return <div data-slot="long-press-layer" className="absolute inset-0" style={{ pointerEvents: "none" }} />;
}
