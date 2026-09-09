"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { PlatformProvider } from "@/registry/imessage/platform";
import { PaletteStyle } from "@/registry/imessage/palette";
import { MacWindow, macWindowMetrics } from "@/registry/imessage/macos-window";
import { MacSidebar, macSidebarMetrics, type SidebarConversation } from "@/registry/imessage/macos-sidebar";
import { MacHeader, macHeaderMetrics } from "@/registry/imessage/macos-header";
import { MacComposer } from "@/registry/imessage/macos-composer";
import { MessageList, type Message, type MessageListHandle } from "@/registry/imessage/message-list";
import { ContextMenu, macosMessageMenu } from "@/registry/imessage/context-menu";
import { TapbackBar, type TapbackSelection } from "@/registry/imessage/tapback-bar";
import { MacPlusMenu } from "@/registry/imessage/macos-plus-menu";
import { defaultReactions } from "@/registry/imessage/ios-messages-app";
import { prefersReducedMotion, useArrivalAnimation, type ArrivalAnimation } from "@/registry/imessage/message-motion";

/**
 * The pane's log is anchored to the bottom. `listBottom` 58.2 puts "Delivered" ink at y 573 with the
 * composer field starting at 596, matching conversation-pane-dark-2.png; the 52 it replaces pushed the
 * whole log 5pt down (8.6% pixel mismatch against that capture instead of 2.8%).
 */
export const macScreen = { width: macWindowMetrics.width, height: macWindowMetrics.height, sidebar: macWindowMetrics.sidebarWidth, listTop: 84.3, listBottom: 58.2 } as const;

/**
 * The window's own transitions: switching conversation, and the two popovers appearing.
 *
 * **NOT MEASURED.** `references/` holds no capture or recording of a macOS conversation switch, of the
 * "+" popover opening, or of a window losing key, so every number below is chosen to sit in the family
 * of the macOS motion that *is* measured: the 183 ms menu dissolve of
 * `tapback-apply-frames-100-123.png`, the 120 ms dismissal `context-menu.tsx` already ships, and the
 * 110 ms tapback rise. They sit at the short end of that range on purpose, because a switch moves
 * nothing but the pane's content: the window, the sidebar and the composer all stay where they are.
 * The one number here that came from a capture is the inactive panel fill below.
 */
export const macTransitions = {
  /** Conversation switch: the pane dissolves while the arriving content rises `shift` points into place. */
  conversation: { duration: 140, shift: 6, dissolve: 0.62 },
  /** The sidebar's selected row travels to its new place; its text crosses to the selected colour sooner. */
  selection: { duration: 140, text: 110 },
  /**
   * The context menu appearing. Its dismissal is the 120 ms `context-menu.tsx` already owns, and the
   * plus popover owns both ends of its own presentation (`macPlusMenuMetrics.motion`), which grows
   * from this same 0.96 on this same curve.
   */
  menu: { open: 110, scale: 0.96 },
} as const;

/**
 * Rules the app needs on elements it does not own: a sidebar row (`macos-sidebar.tsx`), the header it
 * clones while a conversation is leaving (`macos-header.tsx`), and the chrome of a window that is not
 * key. Everything is keyed on this component's own root or on a node only this file renders, so a
 * second app on the same page is untouched.
 *
 * The inactive window is half measured: **#292929** is the panel fill of an inactive dark window, read
 * off a full-window frame held outside the repo (SPEC, "Still unverified"), and the rest is AppKit's
 * convention rather than a capture: an inactive window draws its toolbar glyphs at about half strength,
 * and its accents (the traffic lights and the selected row) already go neutral in `macos-window.tsx`
 * and `macos-sidebar.tsx`. No capture of an inactive *light* window exists, so light keeps its fill.
 */
const macAppStyles = `
[data-im-platform="macos"][data-switching="true"] [data-slot="sidebar-row"][data-selected="true"] > button{background-color:transparent!important}
[data-slot="header-outgoing"] [data-slot="header-glass"],[data-slot="header-outgoing"] [data-slot="compose-button"],[data-slot="header-outgoing"] [data-slot="video-button"]{display:none}
:where(.dark,.dark *) [data-slot="macos-messages-app"][data-active="false"] [data-slot="mac-sidebar"]:not(:where([data-preview-theme="light"] *)){--sb-fill:#292929}
[data-slot="macos-messages-app"][data-active="false"] :is([data-slot="compose-button"],[data-slot="video-button"],[data-slot="attach-button"],[data-slot="emoji-button"],[data-slot="sidebar-options"]){opacity:0.5}
`;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Click-to-select, the way a Mac list behaves: a plain click replaces the selection, cmd toggles one
 * message, and shift extends from the anchor, which is whichever message a plain or cmd click last
 * touched. `order` is the conversation in display order.
 */
export function nextMessageSelection(order: readonly string[], selected: readonly string[], id: string, modifiers: { shiftKey?: boolean; metaKey?: boolean }, anchor: string | null): string[] {
  if (modifiers.metaKey) return selected.includes(id) ? selected.filter(other => other !== id) : [...selected, id];
  if (modifiers.shiftKey) {
    const from = order.indexOf(anchor ?? id);
    const to = order.indexOf(id);
    if (from < 0 || to < 0) return [id];
    return order.slice(Math.min(from, to), Math.max(from, to) + 1);
  }
  return [id];
}

export type MacMessagesAppProps = {
  width?: number;
  height?: number;
  /** Key window: colored traffic lights and the blue selection. */
  active?: boolean;
  conversations?: SidebarConversation[];
  selectedId?: string;
  onSelectConversation?: (id: string) => void;
  contact: { name: string; initials?: string; photo?: string };
  group?: boolean;
  messages: Message[];
  typing?: boolean | { sender?: string };
  now?: Date | number;
  composer?: { value?: string; disabled?: boolean; onChange?: (value: string) => void; onSend?: (text: string) => void | Promise<void>; onAttach?: () => void; onEmoji?: () => void; onAudio?: () => void };
  onCompose?: () => void;
  onVideoCall?: () => void;
  onDetails?: () => void;
  /**
   * That message was just sent: the composer's text row becomes its bubble and flies to its slot.
   * With `progress` the animation is seeked to `progress * duration` instead of played.
   */
  sendAnimation?: ArrivalAnimation | null;
  /** That message just arrived: it pops in from the typing indicator's position. */
  receiveAnimation?: ArrivalAnimation | null;
  /** Called when a played (not seeked) send animation finishes. */
  onSendAnimationEnd?: () => void;
  /**
   * Messages a click has selected, newest state owned by the caller. Passing this (even empty) turns
   * on click-to-select in the pane: a click selects one message, cmd toggles, shift extends, a click
   * on anything else in the pane clears, and so does Escape. iOS has no equivalent; its multi-select
   * is the checkbox mode in `ios-select-mode.tsx`.
   */
  selectedMessageIds?: readonly string[];
  /** The selection a click, a right click or an arrow key just produced. `id` is the message it acted on. */
  onSelectMessage?: (ids: string[], context: { id: string | null; shiftKey: boolean; metaKey: boolean }) => void;
  /** Right-click menu anchored at a point inside the pane (pane coordinates). */
  contextMenu?: { id: string; x: number; y: number } | null;
  onContextMenu?: (id: string, x: number, y: number) => void;
  onContextMenuClose?: () => void;
  onTapback?: (id: string, selection: TapbackSelection) => void;
  onMenuAction?: (id: string, action: string) => void;
  /** The plus-button popover. */
  plusMenu?: boolean;
  onPlusMenuSelect?: (id: string) => void;
  onPlusMenuClose?: () => void;
  /**
   * The conversation switch a change of `selectedId` starts: the pane crossfades, the header's name
   * pill crosses with it and the sidebar's selected row travels. With `progress` (0 to 1) it is seeked
   * to that fraction of `macTransitions.conversation.duration` and paused instead of played, which is
   * what makes a checkpoint of it reproducible; a seeked switch stays on that frame until the next one.
   */
  conversationTransition?: { progress?: number } | null;
  /**
   * The same, for the two popovers: it seeks the context menu's appearance (`macTransitions.menu`) and
   * whichever end of the plus popover's own presentation is running (`macPlusMenuMetrics.motion`).
   */
  menuTransition?: { progress?: number } | null;
  footer?: string;
  renderReactions?: (message: Message) => ReactNode;
  overlay?: ReactNode;
  className?: string;
  style?: CSSProperties;
  frameRef?: RefObject<HTMLDivElement | null>;
};

/** What the pane was drawing before a switch, kept mounted so the two conversations can cross. */
type OutgoingPane = {
  messages: Message[];
  contact: MacMessagesAppProps["contact"];
  group: boolean;
  /** Indices of the row it left and the row it landed on, when both are unpinned sidebar rows. */
  rows: { from: number; to: number } | null;
};

/**
 * The whole macOS 26 Messages window: sidebar, header, message log, composer, and the right-click menu.
 * The caller owns data and navigation; this component only draws state.
 *
 * Changing `selectedId` crossfades the pane and travels the sidebar's selected row; the plus and context
 * menus fade in and out. Every one of those timings is unmeasured, see `macTransitions`.
 */
export function MacMessagesApp({
  width = macScreen.width, height = macScreen.height, active = true, conversations = [], selectedId, onSelectConversation, contact, group = false,
  messages, typing = false, now, composer, onCompose, onVideoCall, onDetails, sendAnimation, receiveAnimation, onSendAnimationEnd,
  selectedMessageIds, onSelectMessage, contextMenu, onContextMenu, onContextMenuClose, onTapback, onMenuAction,
  plusMenu = false, onPlusMenuSelect, onPlusMenuClose, conversationTransition, menuTransition,
  footer, renderReactions = defaultReactions, overlay, className, style, frameRef,
}: MacMessagesAppProps) {
  const shell = useRef<HTMLDivElement>(null);
  const localPane = useRef<HTMLDivElement>(null);
  const pane = frameRef ?? localPane;
  const list = useRef<MessageListHandle>(null);
  // A popover that is already open on the app's first commit did not just appear, so it is not
  // animated: the same rule a Tapback balloon follows for a reaction that predates the session. It is
  // also what keeps a scenario checkpoint of an open menu a still frame instead of a mid-fade one.
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  // Keep the menu mounted through its dismissal; derived during render so no committed frame is
  // missing it (an effect would drop it for a frame and the fade would never be seen).
  const [seenMenu, setSeenMenu] = useState<typeof contextMenu>(contextMenu ?? null);
  const [closingMenu, setClosingMenu] = useState<typeof contextMenu>(null);
  // A menu opened from the keyboard takes focus; one opened by a right click does not, which is what
  // the platform does and what keeps the pointer path's rendering identical.
  const [keyboardMenu, setKeyboardMenu] = useState(false);
  if ((seenMenu?.id ?? null) !== (contextMenu?.id ?? null)) {
    setSeenMenu(contextMenu ?? null);
    setClosingMenu(contextMenu ? null : seenMenu);
  }
  const menu = contextMenu ?? closingMenu;
  const target = menu ? messages.find(message => message.id === menu.id) : undefined;
  // A native menu closes on Escape and on a click anywhere outside it, whether or not it holds focus.
  const closeMenu = useRef(onContextMenuClose);
  useEffect(() => { closeMenu.current = onContextMenuClose; }, [onContextMenuClose]);
  useEffect(() => {
    if (!contextMenu) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); closeMenu.current?.(); } };
    const onPointer = (event: PointerEvent) => {
      if (!(event.target as HTMLElement | null)?.closest?.('[data-slot="context-menu"]')) closeMenu.current?.();
    };
    document.addEventListener("keydown", onKey, true);
    // Capture on the next tick so the right-click that opened it does not immediately close it.
    const timer = setTimeout(() => document.addEventListener("pointerdown", onPointer, true), 0);
    return () => { document.removeEventListener("keydown", onKey, true); clearTimeout(timer); document.removeEventListener("pointerdown", onPointer, true); };
  }, [contextMenu]);

  // `MacPlusMenu` owns the popover's presentation, but it can only play the dismissal while it is
  // still in the tree, so the app keeps it mounted until `onExited`. Derived during render for the
  // same reason the context menu's closing state is: an effect would leave one committed frame with
  // the popover already gone, and the dismissal would never be seen.
  const [seenPlusMenu, setSeenPlusMenu] = useState(plusMenu);
  const [closingPlusMenu, setClosingPlusMenu] = useState(false);
  if (seenPlusMenu !== plusMenu) {
    setSeenPlusMenu(plusMenu);
    setClosingPlusMenu(!plusMenu && seenPlusMenu);
  }
  const menuProgress = menuTransition?.progress;

  // The context menu fades and grows out of the pointer. Only its appearance is animated here, because
  // `context-menu.tsx` already owns the dismissal; the transform origin set here is the corner that
  // dismissal then folds back into.
  const openMenuId = contextMenu?.id ?? null;
  useLayoutEffect(() => {
    if (!openMenuId || !mounted.current || prefersReducedMotion()) return;
    const element = pane.current?.querySelector<HTMLElement>('[data-slot="context-menu"]');
    if (!element) return;
    element.style.transformOrigin = "left top";
    const animation = element.animate(
      [{ opacity: 0, transform: `scale(${macTransitions.menu.scale})` }, { opacity: 1, transform: "scale(1)" }],
      { duration: macTransitions.menu.open, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)", fill: "both" },
    );
    if (menuProgress !== undefined) { animation.pause(); animation.currentTime = clamp01(menuProgress) * macTransitions.menu.open; }
    return () => { try { animation.cancel(); } catch { /* already gone */ } };
  }, [openMenuId, pane, menuProgress]);

  // Selection is off until the caller owns it, and it draws even without a handler so a screenshot of
  // a fixed selection needs no interaction. The anchor is what a shift-click extends from.
  const selecting = selectedMessageIds !== undefined;
  const anchorId = useRef<string | null>(null);
  function select(id: string | null, modifiers: { shiftKey: boolean; metaKey: boolean }) {
    if (!selecting || !onSelectMessage) return;
    if (id === null) { anchorId.current = null; onSelectMessage!([], { id: null, ...modifiers }); return; }
    const next = nextMessageSelection(messages.map(message => message.id), selectedMessageIds!, id, modifiers, anchorId.current);
    if (!modifiers.shiftKey) anchorId.current = id;
    onSelectMessage!(next, { id, ...modifiers });
  }
  const mine = target?.reactions?.find(reaction => reaction.byMe);
  const selected: TapbackSelection | undefined = mine ? (mine.emoji ? { emoji: mine.emoji } : { type: mine.type as never }) : undefined;
  useArrivalAnimation({ frame: pane, send: sendAnimation, receive: receiveAnimation, onSendEnd: onSendAnimationEnd });

  /**
   * The conversation the pane is leaving. It cannot be derived during render the way the menus'
   * closing state is, because by then `messages` and `contact` are already the new conversation's and
   * the old ones live in a ref, which a render may not read. A **layout** effect is the one place that
   * can hold them: React flushes the state it sets before the browser paints, so the frame where the
   * arriving conversation is alone in the pane is never shown. A passive effect would lose exactly
   * that frame, which is why nothing here uses one.
   */
  const committed = useRef({ id: selectedId, messages, contact, group });
  const [outgoingPane, setOutgoingPane] = useState<OutgoingPane | null>(null);
  useLayoutEffect(() => {
    const before = committed.current;
    committed.current = { id: selectedId, messages, contact, group };
    // Opening the first conversation is an arrival, not a switch: there is nothing to cross with.
    if (before.id === selectedId || before.id === undefined || selectedId === undefined) return;
    const rows = conversations.filter(conversation => !conversation.pinned);
    const from = rows.findIndex(row => row.id === before.id);
    const to = rows.findIndex(row => row.id === selectedId);
    setOutgoingPane({ messages: before.messages, contact: before.contact, group: before.group, rows: from >= 0 && to >= 0 && from !== to ? { from, to } : null });
  }, [selectedId, messages, contact, group, conversations]);

  const switchProgress = conversationTransition?.progress;
  useLayoutEffect(() => {
    if (!outgoingPane) return;
    const root = pane.current;
    const clear = () => setOutgoingPane(current => (current === outgoingPane ? null : current));
    if (!root || prefersReducedMotion()) { clear(); return; }
    const D = macTransitions.conversation.duration;
    const animations: Animation[] = [];
    const add = (element: Element | null | undefined, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      if (element) animations.push(element.animate(frames, { fill: "both", ...options }));
    };
    // The pane's content and the header's name pill cross together; the composer, the header's glass
    // and its two buttons belong to the window rather than to the conversation, so they hold still.
    const contacts = Array.from(root.querySelectorAll<HTMLElement>('[data-slot="header-contact"]'));
    const enter: Keyframe[] = [{ opacity: 0, transform: `translateY(${macTransitions.conversation.shift}px)` }, { opacity: 1, transform: "translateY(0px)" }];
    const leave: Keyframe[] = [{ opacity: 1, offset: 0 }, { opacity: 0, offset: macTransitions.conversation.dissolve }, { opacity: 0, offset: 1 }];
    const arriving = { duration: D, easing: "cubic-bezier(0.25, 0.8, 0.3, 1)" };
    const leaving = { duration: D, easing: "linear" };
    add(root.querySelector('[data-slot="pane-content"]'), enter, arriving);
    add(contacts.find(element => !element.closest('[data-slot="header-outgoing"]')), enter, arriving);
    add(root.querySelector('[data-slot="pane-outgoing"]'), leave, leaving);
    add(contacts.find(element => element.closest('[data-slot="header-outgoing"]')), leave, leaving);

    // The sidebar's selection is one highlight that moves, not two that swap: the row it leaves drops
    // its own fill, the row it lands on has its fill suppressed by `macAppStyles` for as long as this
    // runs, and this chip travels between them. It is inserted as the list's first child so the rows'
    // avatars and text keep painting over it, the way the real fill does.
    let chip: HTMLElement | null = null;
    const travel = outgoingPane.rows;
    const list = travel ? shell.current?.querySelector<HTMLElement>('[data-slot="sidebar-rows"]') : null;
    const items = list?.querySelectorAll<HTMLElement>('[data-slot="sidebar-row"]');
    const fromRow = travel && items ? items[travel.from] : undefined;
    const toRow = travel && items ? items[travel.to] : undefined;
    if (travel && list && fromRow && toRow) {
      // Geometry comes from the sidebar's own metrics, not from the DOM: `offsetTop` and
      // `offsetHeight` are integers, and a row is 80.5 tall, so a chip built from them would sit half
      // a point off the row it is standing in for. Rows stack from the list's top with no gaps.
      const row = macSidebarMetrics.row;
      chip = document.createElement("div");
      chip.dataset.slot = "sidebar-selection-travel";
      chip.setAttribute("aria-hidden", "true");
      Object.assign(chip.style, {
        position: "absolute", left: "0px", top: `${travel.from * row.height}px`,
        width: `${row.width}px`, height: `${row.height}px`, borderRadius: `${row.radius}px`,
        background: active ? "#3478f6" : getComputedStyle(list).getPropertyValue("--sb-inactive").trim() || "#3a3a3a",
        // A transient element must never become a scroll anchor: scrubbing rebuilds it every frame.
        pointerEvents: "none", overflowAnchor: "none",
      } satisfies Partial<CSSStyleDeclaration>);
      // The same continuous corner `macos-sidebar.tsx` gives the row it is standing in for.
      if (CSS.supports?.("corner-shape: superellipse(1.4)")) { chip.style.borderRadius = "10px"; chip.style.setProperty("corner-shape", "superellipse(1.4)"); }
      list.insertBefore(chip, list.firstChild);
      // `top`, not a transform: a transformed layer rasterizes at its own subpixel offset and lands a
      // device pixel above the row it is standing in for, which shows at both ends of the travel.
      add(chip, [{ top: `${(travel.from * row.height).toFixed(2)}px` }, { top: `${(travel.to * row.height).toFixed(2)}px` }],
        { duration: macTransitions.selection.duration, easing: arriving.easing });
      // The row text crosses with the fill, and a little sooner, so the name is already white by the
      // time the highlight is under it. Driven here rather than by a CSS transition so that the whole
      // switch answers to one `progress`. An inactive window's selected row keeps the plain colours
      // (`macos-sidebar.tsx`), so there is nothing to cross then.
      const ink = getComputedStyle(list);
      const plain = { name: ink.getPropertyValue("--sb-name").trim() || "#000000", secondary: ink.getPropertyValue("--sb-secondary").trim() || "#6e6e6d" };
      const chosen = active ? { name: "#ffffff", secondary: "#d6e4fd" } : plain;
      const crossText = (row: HTMLElement, toSelected: boolean) => {
        for (const [slot, from, to] of [
          ['[data-slot="row-name"]', plain.name, chosen.name],
          ['[data-slot="row-time"]', plain.secondary, chosen.secondary],
          ['[data-slot="row-preview"]', plain.secondary, chosen.secondary],
        ] as const) {
          add(row.querySelector(slot), toSelected ? [{ color: from }, { color: to }] : [{ color: to }, { color: from }],
            { duration: macTransitions.selection.text, easing: "linear" });
        }
      };
      crossText(fromRow, false);
      crossText(toRow, true);
    }

    if (switchProgress === undefined) void Promise.all(animations.map(animation => animation.finished.catch(() => undefined))).then(clear);
    else { const t = clamp01(switchProgress) * D; animations.forEach(animation => { animation.pause(); animation.currentTime = t; }); }
    return () => {
      chip?.remove();
      animations.forEach(animation => { try { animation.cancel(); } catch { /* already gone */ } });
    };
  }, [outgoingPane, pane, switchProgress, active]);

  return (
    <PlatformProvider platform="macos">
      <PaletteStyle platform="macos" />
      <div ref={shell} data-im-platform="macos" data-switching={outgoingPane?.rows ? "true" : undefined} className={cn("relative", className)} style={{ width, height, ...style }}>
        <style>{macAppStyles}</style>
        <MacWindow width={width} height={height} active={active} data-slot="macos-messages-app"
          sidebar={<MacSidebar conversations={conversations} selectedId={selectedId} onSelect={onSelectConversation} active={active} footer={footer} className="absolute inset-0" />}
          content={
            <div ref={pane} data-slot="pane" className="absolute inset-0 overflow-hidden" style={{ background: "var(--im-bg)" }}
              // A single click selects the message it lands on and deselects the rest; a click on the
              // rest of the pane clears. Right-clicking selects first, then opens the menu.
              onClick={event => {
                const hit = (event.target as HTMLElement).closest?.('[data-message-id], [data-slot="context-menu"]');
                // The menu acts on the message it opened over, so using it must not clear the selection.
                if (hit?.getAttribute("data-slot") === "context-menu") return;
                select(hit?.getAttribute("data-message-id") ?? null, { shiftKey: event.shiftKey, metaKey: event.metaKey });
              }}
              onContextMenu={event => {
                const id = (event.target as HTMLElement).closest?.("[data-message-id]")?.getAttribute("data-message-id");
                if (id) select(id, { shiftKey: false, metaKey: false });
                if (!id || !onContextMenu || !pane.current) return;
                event.preventDefault();
                setKeyboardMenu(false);
                const rect = pane.current.getBoundingClientRect();
                onContextMenu(id, event.clientX - rect.left, event.clientY - rect.top);
              }}
              // The keyboard equivalent of the right click: the log's arrow keys focus a message and
              // these keys open its menu, anchored to the message rather than to a pointer.
              onKeyDown={event => {
                if (selecting && onSelectMessage) {
                  // Escape only clears once nothing else has claimed it, so an open menu still closes first.
                  if (event.key === "Escape" && !event.defaultPrevented && selectedMessageIds!.length) { event.preventDefault(); select(null, { shiftKey: false, metaKey: false }); return; }
                  // The log's own arrow keys have already moved focus by the time this bubbles up (and
                  // have called preventDefault on the way), so following the focused row here is what
                  // makes selection reachable without a pointer.
                  if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
                    const focused = (document.activeElement as HTMLElement | null)?.closest?.("[data-message-id]")?.getAttribute("data-message-id");
                    if (focused) select(focused, { shiftKey: event.shiftKey, metaKey: false });
                  }
                }
                const row = event.target as HTMLElement;
                if (!row.matches?.('[data-slot="message-row"][data-message-id]')) return;
                if (event.key !== "Enter" && event.key !== " " && event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
                const id = row.getAttribute("data-message-id");
                if (!id || !onContextMenu || !pane.current) return;
                event.preventDefault();
                setKeyboardMenu(true);
                const rect = pane.current.getBoundingClientRect();
                const at = row.getBoundingClientRect();
                onContextMenu(id, at.left + at.width / 2 - rect.left, at.bottom - rect.top);
              }}>
              <div data-slot="pane-content" className="absolute inset-0">
                <MessageList ref={list} frameRef={pane} messages={messages} typing={typing} group={group} now={now} anchor="bottom" selectedIds={selectedMessageIds}
                  insetTop={macScreen.listTop} insetBottom={macScreen.listBottom} renderReactions={renderReactions} messageActions={Boolean(onContextMenu)} className="absolute inset-0" />
              </div>
              {/* The conversation that is leaving, under the header's glass so it is washed like the one
                  arriving. It carries no composer and nothing interactive: it is a picture for 140 ms. */}
              {outgoingPane && (
                <div data-slot="pane-outgoing" aria-hidden="true" inert className="pointer-events-none absolute inset-0">
                  <MessageList frameRef={pane} messages={outgoingPane.messages} group={outgoingPane.group} now={now} anchor="bottom"
                    insetTop={macScreen.listTop} insetBottom={macScreen.listBottom} renderReactions={renderReactions} className="absolute inset-0" />
                </div>
              )}
              <MacHeader name={contact.name} initials={contact.initials} photo={contact.photo} onCompose={onCompose} onVideoCall={onVideoCall} onOpenDetails={onDetails} className="absolute left-0 top-0 w-full" style={{ height: macHeaderMetrics.height }} />
              {/* The name pill it is leaving, over the live header so the two cross where the real one
                  sits. `macAppStyles` drops this copy's glass and buttons: only the contact is leaving. */}
              {outgoingPane && (
                <div data-slot="header-outgoing" aria-hidden="true" inert className="pointer-events-none absolute left-0 top-0 w-full">
                  <MacHeader name={outgoingPane.contact.name} initials={outgoingPane.contact.initials} photo={outgoingPane.contact.photo} style={{ height: macHeaderMetrics.height }} />
                </div>
              )}
              <MacComposer className="absolute bottom-0 left-0 w-full" value={composer?.value} disabled={composer?.disabled} onChange={composer?.onChange}
                onSend={composer?.onSend ?? (() => {})} onAttach={composer?.onAttach} onEmoji={composer?.onEmoji} onAudio={composer?.onAudio} />
              {target && menu && (
                <ContextMenu variant="macos" items={macosMessageMenu} open={!closingMenu} onExited={() => setClosingMenu(null)} autoFocus={keyboardMenu}
                  style={{ position: "absolute", left: Math.min(menu.x, width - macScreen.sidebar - 310), top: Math.min(menu.y, height - 300), zIndex: 30 }}
                  onAction={action => onMenuAction?.(target.id, action)} onClose={onContextMenuClose}
                  header={<TapbackBar layout="macos" selected={selected} onSelect={selection => onTapback?.(target.id, selection)} />} />
              )}
              {overlay}
            </div>
          } />
        {/* Kept in the tree while it is leaving: `MacPlusMenu` plays its own dismissal and says when
            it is over. A seeked one never reports, so a scrubbed frame holds. */}
        {(plusMenu || closingPlusMenu) && (
          <MacPlusMenu open={plusMenu} progress={menuProgress} onExited={() => setClosingPlusMenu(false)}
            onSelect={onPlusMenuSelect} onClose={onPlusMenuClose} style={{ position: "absolute", zIndex: 40 }} left={macScreen.sidebar + 9} top={626} />
        )}
      </div>
    </PlatformProvider>
  );
}
