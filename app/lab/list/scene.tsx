"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { PlatformProvider, type Platform } from "@/registry/imessage/platform";
import { bubbleMetrics, fontStack, palettes, paletteVars } from "@/registry/imessage/tokens";
import { MessageList, type Message, type MessageListHandle } from "@/registry/imessage/message-list";
import { TypingIndicator } from "@/registry/imessage/typing-indicator";
import { LinkPreview } from "@/registry/imessage/link-preview";
import { messageMotion, playReceiveAnimation, playSendAnimation, type MotionHandle } from "@/registry/imessage/message-motion";
import { IosMessagesApp } from "@/registry/imessage/ios-messages-app";
import { MacMessagesApp, macScreen } from "@/registry/imessage/macos-messages-app";

/** Fixture clock: the iOS captures show "Today 1:25 AM" with the status bar at 1:48. */
const base = new Date(2026, 8, 8, 1, 25).getTime();
const now = new Date(2026, 8, 8, 1, 48).getTime();
const at = (seconds: number) => base + seconds * 1000;

/** references/ios/captures/conv3-light.png: outgoing SMS bubbles; clusters by the 60 s rule. */
const iosConv3: Message[] = [
  // 33 characters: the capture breaks them 28 + 5, which is what "a" at 17pt does in a 280.33 bubble.
  { id: "a", direction: "outgoing", service: "sms", sentAt: at(0), text: "Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { id: "v1", direction: "outgoing", service: "sms", sentAt: at(120), text: "V" },
  { id: "v2", direction: "outgoing", service: "sms", sentAt: at(130), text: "V" },
  { id: "v3", direction: "outgoing", service: "sms", sentAt: at(140), text: "V" },
  { id: "details", direction: "outgoing", service: "sms", sentAt: at(260), text: "It’s all in the little details. ✨ A longer message should wrap naturally without stretching the conversation." },
  { id: "ok", direction: "outgoing", service: "sms", sentAt: at(380), text: "Ok" },
  { id: "every", direction: "outgoing", service: "sms", sentAt: at(390), text: "Every detail, down to the last bubble.", status: "delivered" },
];

/**
 * references/macos/captures/conversation-pane-dark-2.png (self chat). Tails are set explicitly to match the
 * capture (only the two- and four-line bubbles have one); the tailed two-line bubble is followed by an 8pt
 * gap (3 + the 4.7pt tail hang), also reproduced explicitly.
 *
 * `?platform=macos&theme=dark` over 0 115 630 470 scores 2.60%, the worst row in SPEC's fidelity table.
 * It is anti-aliasing, not geometry or colour; measured, so nobody has to re-open it:
 *
 *   - interior mean signed +0.02 (0.1, 0.0, -0.0), largest interior blob 0.3% -> no tint. The pane ground
 *     reads #1e1e1e in both at every probe and the bubble fill (67,145,247) differs by one level in G.
 *   - 68.6% of the region is bare pane in the capture; over exactly those pixels our error is mean +0.028,
 *     mean abs 0.029, with 510 px (0.04%) past 8/255 and every one of them an AA fringe outside a bubble.
 *     The scene reconstructs.
 *   - 30 844 of the 30 844 mismatched pixels: 99.8% lie within 3 device px of a colour step in the capture.
 *     Exactly 62 px (0.005% of the region) sit away from every edge.
 *   - Bubble geometry agrees within 1 device px (0.5pt). Blue runs, ref vs ours: y 2-59/2-58, 66-123/66-122,
 *     469-526/470-526, 533-628/534-628, 636-751/636-751, 758-912/758-912; the trailing edge is x 1219 in
 *     both, every leading edge within 3 device px. "Second of two" is the widest miss at 1.5pt, which SPEC
 *     already attributes to that string's advance in Chrome.
 *   - 👋 is the only non-text contributor: same ink bbox in both (143 x 142 device px), ours one device px
 *     lower, its interior shading off by -6.47 over 2 580 px. Worth 740 mismatched pixels, 2.4% of the total.
 *   - The residual is our glyphs being thinner than the capture's: white ink measures 15.0-15.6% lighter in
 *     every one of the six bubbles, uniformly, because app/globals.css sets `-webkit-font-smoothing:
 *     antialiased` on body. Injecting `-webkit-font-smoothing: auto` takes this row to 1.99%, but overshoots
 *     the other way (+13.4% ink) and moves every other row in the table, so it is a repo-wide call, not one
 *     this lab should make.
 *   - The capture also carries the sidebar's shadow on the pane's leading edge (#1c1c1c to x 6pt, #1d1d1d to
 *     18.5pt, then #1e1e1e). /lab/macos-chrome?scene=pane reproduces it; this lab draws the message area with
 *     no sidebar, so it cannot. At two levels deep it costs zero mismatched pixels.
 */
const macPane2: Message[] = [
  { id: "m1", direction: "outgoing", sentAt: at(0), text: "First of two, sent back to back", tail: false },
  { id: "m2", direction: "outgoing", sentAt: at(2), text: "Second of two", tail: false },
  { id: "m3", direction: "outgoing", sentAt: at(20), text: "Text right before a link", tail: false },
  { id: "m4", direction: "outgoing", sentAt: at(22), text: "https://apple.com", kind: "link", link: { url: "https://apple.com", host: "apple.com" } },
  { id: "m5", direction: "outgoing", sentAt: at(30), text: "👋" },
  { id: "m6", direction: "outgoing", sentAt: at(40), text: "Text right after an emoji", tail: false },
  { id: "m7", direction: "outgoing", sentAt: at(42), text: "A two line message that should wrap onto a second line for the test", tail: true },
  { id: "m8", direction: "outgoing", sentAt: at(44), text: "Three lines without any emoji at all. This message keeps going so that it wraps onto a third line inside the bubble for the tail test.", tail: false, gapBefore: 8 },
  { id: "m9", direction: "outgoing", sentAt: at(46), text: "Four lines now. This one is even longer so that it wraps onto a fourth line inside the bubble, which lets us see whether the tail disappears once a bubble is tall enough, or whether something else is going on.", tail: true, status: "delivered" },
];

/**
 * references/ios/captures/dateheader-mid-{light,dark}.png: an hour-long gap drops a one-line header between
 * the incoming "Hi there" (body 565.0-605.0) and the outgoing "Good morning" (body top 639.0). The bubble
 * above starts the region at 494.67, so the between-cluster gap lands "Hi there" without any nudging.
 */
const midHeader: Message[] = [
  { id: "every", direction: "incoming", service: "sms", sentAt: at(0), text: "Every detail, down to the last bubble." },
  { id: "hi", direction: "incoming", service: "sms", sentAt: at(120), text: "Hi there" },
  { id: "morning", direction: "outgoing", service: "sms", sentAt: at(9120), text: "Good morning", status: "delivered" },
];

const grouped: Message[] = [
  { id: "g1", direction: "incoming", sender: "Alex Morgan", sentAt: at(0), text: "Hey! How’s the new project going?" },
  { id: "g2", direction: "incoming", sender: "Alex Morgan", sentAt: at(5), text: "The corners should connect." },
  { id: "g3", direction: "incoming", sender: "Sam Rivera", sentAt: at(9), text: "And only the last message gets a tail." },
  { id: "g4", direction: "outgoing", sentAt: at(60), text: "Blue for iMessage.", status: "read", readAt: at(70) },
  { id: "g5", direction: "incoming", sender: "Alex Morgan", sentAt: at(4000), text: "Sounds good 👍" },
  { id: "g6", direction: "incoming", sender: "Alex Morgan", sentAt: at(4003), text: "👋" },
];

const sendBase: Message[] = [
  { id: "ok", direction: "outgoing", service: "sms", sentAt: at(380), text: "Ok" },
  { id: "every", direction: "outgoing", service: "sms", sentAt: at(390), text: "Every detail, down to the last bubble.", status: "delivered" },
];

const shellBase: Message[] = [
  { id: "s1", direction: "incoming", sender: "Alex Morgan", sentAt: at(0), text: "Hey! How’s the new project going?" },
  { id: "s2", direction: "outgoing", sentAt: at(390), text: "Every detail, down to the last bubble.", status: "delivered" },
];

type LabApi = { send?: () => MotionHandle; receive?: () => MotionHandle; seek: (ms: number) => void; play: () => void; handle: () => MotionHandle | null; duration: number };
declare global { interface Window { __lab?: LabApi } }

export function ListLab({ platform, theme, scene }: { platform: Platform; theme: "light" | "dark"; scene: string }) {
  const m = bubbleMetrics[platform];
  const vars = paletteVars(palettes[platform][theme]) as CSSProperties;
  const size = platform === "ios" ? { width: 402, height: 874 } : { width: 630, height: 640 };
  const frame = useRef<HTMLDivElement>(null);
  const list = useRef<MessageListHandle>(null);
  const insetTop = platform === "ios" ? 169.5 : 84.3;
  const conversation = platform === "ios" ? iosConv3 : macPane2;

  // The shells bring their own frame and palette, so they replace the lab's wrapper entirely.
  if (scene === "shell") return <div className={theme} style={{ colorScheme: theme }}><ShellScene platform={platform} /></div>;

  return (
    <PlatformProvider platform={platform}>
      <div ref={frame} data-testid="lab" className={theme} style={{ ...vars, ...size, position: "relative", overflow: "hidden", background: "var(--im-bg)", fontFamily: fontStack }}>
        {scene === "conversation" && (
          <MessageList ref={list} frameRef={frame} messages={conversation} now={now} insetTop={insetTop} insetBottom={platform === "ios" ? 0 : macScreen.listBottom}
            anchor={platform === "ios" ? "top" : "bottom"} serviceLabel="iMessage" firstDateHeader={platform === "ios"} style={{ position: "absolute", inset: 0 }} />
        )}
        {scene === "dateheader" && (
          <MessageList ref={list} frameRef={frame} messages={midHeader} now={now + 9120_000} insetTop={494.67} insetBottom={0}
            firstDateHeader={false} style={{ position: "absolute", inset: 0 }} />
        )}
        {scene === "grouped" && (
          <MessageList ref={list} frameRef={frame} messages={grouped} group now={now} insetTop={insetTop} typing={{ sender: "Alex Morgan" }} style={{ position: "absolute", inset: 0 }} />
        )}
        {scene === "typing" && (
          <div style={{ position: "absolute", left: m.edgeInset, top: 200 }}><TypingIndicator label="Alex Morgan is typing" /></div>
        )}
        {scene === "link" && (
          <div style={{ position: "absolute", right: m.edgeInset, top: 200, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
            <LinkPreview href="https://apple.com" />
            <LinkPreview href="https://ui.shadcn.com" title="Build your component library." image="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='382' height='200'%3E%3Crect width='382' height='200' fill='%2309090b'/%3E%3C/svg%3E" />
          </div>
        )}
        {scene === "send" && <SendScene frame={frame} platform={platform} />}
        {scene === "receive" && <ReceiveScene frame={frame} platform={platform} />}
      </div>
    </PlatformProvider>
  );
}

/**
 * The same send and receive motion driven through the app shells' `sendAnimation` / `receiveAnimation`
 * props, so the wiring is checked against the real composer rather than the lab's stand-in field.
 */
function ShellScene({ platform }: { platform: Platform }) {
  const [messages, setMessages] = useState<Message[]>(shellBase);
  const [send, setSend] = useState<{ id: string; progress?: number } | null>(null);
  const [receive, setReceive] = useState<{ id: string; progress?: number } | null>(null);

  const startSend = (progress?: number) => {
    const id = `sent-${Date.now()}`;
    setMessages(current => [...current.map(message => ({ ...message, status: undefined })), { id, direction: "outgoing", sentAt: at(400), text: "Hi there" }]);
    setSend({ id, progress });
  };
  const startReceive = (progress?: number) => {
    const id = `in-${Date.now()}`;
    setMessages(current => [...current, { id, direction: "incoming", sender: "Alex Morgan", sentAt: at(420), text: "That’s the one. 💙" }]);
    setReceive({ id, progress });
  };

  useEffect(() => {
    window.__lab = {
      send: () => { startSend(0); return null as unknown as MotionHandle; },
      receive: () => { startReceive(0); return null as unknown as MotionHandle; },
      seek: ms => {
        setSend(current => (current ? { ...current, progress: ms / messageMotion.send.duration } : current));
        setReceive(current => (current ? { ...current, progress: ms / messageMotion.receive.duration } : current));
      },
      play: () => { setSend(current => (current ? { id: current.id } : current)); setReceive(current => (current ? { id: current.id } : current)); },
      handle: () => null,
      duration: messageMotion.send.duration,
    };
    return () => { delete window.__lab; };
  });

  const contact = { name: "Alex Morgan", initials: "AM" };
  if (platform === "macos") {
    return (
      <MacMessagesApp contact={contact} messages={messages} now={now} sendAnimation={send} receiveAnimation={receive} onSendAnimationEnd={() => setSend(null)}
        conversations={[{ id: "a", name: "Alex Morgan", initials: "AM", preview: "Hi there", time: "1:25 AM" }]} selectedId="a" />
    );
  }
  return (
    <IosMessagesApp contact={contact} messages={messages} now={now} sendAnimation={send} receiveAnimation={receive} onSendAnimationEnd={() => setSend(null)}
      composer={{ value: "" }} />
  );
}

/**
 * Composer geometry read off references/ios/motion/send-60fps.mp4. The field's text row is x 82-374, y 811-858
 * (the frame after Return paints the tinted rect over exactly that box, 292 x 47, radius 23.5) and the send
 * button is a 38 x 28 pill centred (349, 831), the same pill SPEC.md measures 5pt higher in `conv3-light.png`.
 */
function SendScene({ frame, platform }: { frame: React.RefObject<HTMLDivElement | null>; platform: Platform }) {
  const [messages, setMessages] = useState<Message[]>(sendBase);
  const [draft, setDraft] = useState("Hi there");
  const pending = useRef<string | null>(null);
  const handle = useRef<MotionHandle | null>(null);
  const field = useRef<HTMLDivElement>(null);
  const placeholder = useRef<HTMLSpanElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const paused = useRef(false);

  function send(pause = false) {
    const id = `sent-${Date.now()}`;
    pending.current = id;
    paused.current = pause;
    setDraft("");
    // More than a minute after "Every detail", so it opens its own cluster: the recording's final frames put
    // "Hi there" 10.33 below that bubble's body, and the bubble above keeps the tail it has in the capture.
    setMessages(current => [...current, { id, direction: "outgoing", service: "sms", sentAt: at(460), text: "Hi there" }]);
  }

  useLayoutEffect(() => {
    const id = pending.current;
    if (!id || !frame.current || !field.current) return;
    pending.current = null;
    const bubble = frame.current.querySelector<HTMLElement>(`[data-message-id="${id}"] [data-slot="message-bubble"]`);
    if (!bubble) return;
    handle.current?.cancel();
    handle.current = playSendAnimation({ frame: frame.current, field: field.current.getBoundingClientRect(), bubble, placeholder: placeholder.current, sendButton: sendButton.current, fieldRadius: platform === "ios" ? 23.5 : 17, ghostParent: field.current, paused: paused.current });
    const h = handle.current;
    void h.finished.then(() => {
      setTimeout(() => setMessages(current => current.map(message => (message.id === id ? { ...message, status: "delivered" } : { ...message, status: undefined }))), messageMotion.delivery - h.duration);
    });
  }, [messages, frame, platform]);

  useEffect(() => {
    window.__lab = {
      send: () => { send(true); return handle.current!; },
      seek: ms => handle.current?.seek(ms),
      play: () => handle.current?.play(),
      handle: () => handle.current,
      duration: messageMotion.send.duration,
    };
    return () => { delete window.__lab; };
  });

  const fieldStyle: CSSProperties = platform === "ios"
    ? { position: "absolute", left: 82, top: 811, width: 291.5, height: 47, borderRadius: 23.5, background: "var(--im-bg)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--im-incoming-text) 12%, transparent)" }
    : { position: "absolute", left: 50, top: 596, width: 528, height: 34, borderRadius: 17, background: "var(--im-bg)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--im-incoming-text) 18%, transparent)" };
  return (
    <>
      {/* The recording rests "Hi there" with its body bottom at 727.25 (frames 120 to 130, before "Delivered" moves to it),
          so the list's 802pt box needs 74.75 below it. The bubbles above then land 2.5 to 3pt high, because a "Delivered"
          row with a message under it takes 27.98pt here (10.33 cluster gap + 4.65 + a 13pt line box) and 25.3 in the
          recording. No still capture shows a status label with a message below it, so that gap stays unverified. */}
      <MessageList frameRef={frame} messages={messages} now={now} anchor="bottom" insetTop={platform === "ios" ? 169.5 : 84.3} insetBottom={platform === "ios" ? 74.75 : 30}
        serviceLabel="iMessage" firstDateHeader={false} style={{ position: "absolute", left: 0, right: 0, top: 0, height: platform === "ios" ? 802 : 596 }} />
      {platform === "ios" && <div aria-hidden="true" style={{ position: "absolute", left: 26, top: 812, width: 44, height: 44, borderRadius: 22, background: "var(--im-bg)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--im-incoming-text) 12%, transparent)", display: "grid", placeItems: "center", fontSize: 26, fontWeight: 300, color: "var(--im-incoming-text)" }}>+</div>}
      <div ref={field} data-slot="lab-field" style={fieldStyle}>
        <span ref={placeholder} data-slot="lab-placeholder" aria-hidden="true" style={{ position: "absolute", left: 15, top: 0, lineHeight: `${fieldStyle.height}px`, fontSize: platform === "ios" ? 17 : 13, color: "var(--im-secondary)", opacity: draft ? 0 : 1 }}>{platform === "ios" ? "iMessage" : "Message"}</span>
        <span data-slot="lab-draft" style={{ position: "absolute", left: 15, top: 0, lineHeight: `${fieldStyle.height}px`, fontSize: platform === "ios" ? 17 : 13, color: "var(--im-incoming-text)" }}>{draft}</span>
        {platform === "ios" && draft && (
          <button ref={sendButton} type="button" aria-label="Send" onClick={() => send(false)} style={{ position: "absolute", right: 5.5, top: 6, width: 38, height: 28, borderRadius: 14, border: 0, background: "#0088ff", color: "#fff", display: "grid", placeItems: "center", padding: 0 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        )}
      </div>
    </>
  );
}

function ReceiveScene({ frame, platform }: { frame: React.RefObject<HTMLDivElement | null>; platform: Platform }) {
  const [typing, setTyping] = useState(true);
  const [messages, setMessages] = useState<Message[]>([{ id: "r1", direction: "outgoing", sentAt: at(0), text: "Every detail, down to the last bubble.", status: "delivered" }]);
  const pending = useRef<{ id: string; from: DOMRect | null } | null>(null);
  const handle = useRef<MotionHandle | null>(null);
  const paused = useRef(false);

  function receive(pause = false) {
    const indicator = frame.current?.querySelector<HTMLElement>('[data-slot="typing-indicator"]');
    const id = `in-${Date.now()}`;
    pending.current = { id, from: indicator?.getBoundingClientRect() ?? null };
    paused.current = pause;
    setTyping(false);
    setMessages(current => [...current, { id, direction: "incoming", sentAt: at(20), text: "That’s the one. 💙" }]);
  }

  useLayoutEffect(() => {
    const info = pending.current;
    if (!info || !frame.current) return;
    pending.current = null;
    const bubble = frame.current.querySelector<HTMLElement>(`[data-message-id="${info.id}"] [data-slot="message-bubble"]`);
    if (!bubble) return;
    handle.current?.cancel();
    handle.current = playReceiveAnimation({ bubble, from: info.from, paused: paused.current });
  }, [messages, frame, platform]);

  useEffect(() => {
    window.__lab = { receive: () => { receive(true); return handle.current!; }, seek: ms => handle.current?.seek(ms), play: () => handle.current?.play(), handle: () => handle.current, duration: messageMotion.receive.duration };
    return () => { delete window.__lab; };
  });

  return (
    <>
      <MessageList frameRef={frame} messages={messages} typing={typing ? { sender: "Alex Morgan" } : false} now={now} anchor="bottom" insetTop={platform === "ios" ? 169.5 : 84.3} insetBottom={8} firstDateHeader={false} style={{ position: "absolute", left: 0, right: 0, top: 0, height: platform === "ios" ? 802 : 596 }} />
      <button type="button" onClick={() => receive(false)} style={{ position: "absolute", right: 16, bottom: 16, fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid #8884", background: "var(--im-bg)", color: "var(--im-incoming-text)" }}>Receive</button>
    </>
  );
}
