"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { DateSeparator } from "@/registry/imessage/date-separator";
import { IosComposer } from "@/registry/imessage/ios-composer";
import { IosDetails } from "@/registry/imessage/ios-details";
import { IosNavBar } from "@/registry/imessage/ios-nav-bar";
import { IosPlusMenu, PhotoPickerGrid } from "@/registry/imessage/ios-plus-menu";
import { IosSelectionCloseButton, IosSelectionToolbar, MessageSelectionRow } from "@/registry/imessage/ios-select-mode";
import { IosStatusBar } from "@/registry/imessage/ios-status-bar";
import { SwipeTimes, useSwipeToRevealTimes } from "@/registry/imessage/ios-swipe-times";
import { FailedSendBadge, NotDelivered, UnknownSenderNotice } from "@/registry/imessage/ios-notices";
import { MessageAttachment } from "@/registry/imessage/message-attachment";
import { MessageBubble } from "@/registry/imessage/message-bubble";
import { PlatformProvider } from "@/registry/imessage/platform";
import { Tapback } from "@/registry/imessage/tapback";
import { palettes, paletteVars } from "@/registry/imessage/tokens";

export type ScreenScene = "details" | "plus-menu" | "select-mode" | "swipe-times" | "notice" | "attachment" | "photo-picker";

/** Fixture strings taken verbatim from the captures so the pixel diff compares like with like. */
const LONG = "It’s all in the little details. ✨ A longer message should wrap naturally without stretching the conversation.";
const NNBSP = " ";

type Row = { id: string; text: string; tail?: boolean; cluster?: boolean; tapback?: boolean; status?: string; time: string };

const thread: Row[] = [
  { id: "a", text: "A" + "a".repeat(32), tail: true, time: `1:25${NNBSP}AM` },
  { id: "v1", text: "V", cluster: true, time: `1:36${NNBSP}AM` },
  { id: "v2", text: "V", time: `1:36${NNBSP}AM` },
  { id: "v3", text: "V", tail: true, time: `1:37${NNBSP}AM` },
  { id: "long", text: LONG, tail: true, cluster: true, time: `1:44${NNBSP}AM` },
  { id: "ok", text: "Ok", cluster: true, tapback: true, time: `1:48${NNBSP}AM` },
  { id: "every", text: "Every detail, down to the last bubble.", tail: true, time: `1:48${NNBSP}AM` },
  { id: "hi", text: "Hi there", tail: true, cluster: true, status: "Delivered", time: `2:24${NNBSP}AM` },
];

const GAP_IN = 4.3333;
const GAP_BETWEEN = 10.3333;
/** The tapback balloon pushes its bubble down by 28 (SPEC.md); MessageBubble adds that itself. */

function gapFor(row: Row, index: number) {
  if (index === 0) return 0;
  return row.cluster ? GAP_BETWEEN : GAP_IN;
}

/**
 * The outgoing SMS thread that sits behind every iOS screen here (`swipe-timestamps-light.png`,
 * `plus-menu-open-light.png`, `select-mode-dark.png`, and blurred under `details-light.png`).
 * First body top 205.33, 4.33 inside a cluster, 10.33 between clusters.
 */
function Thread({
  top = 205.0, direction = "outgoing", renderRow, showStatus = true,
}: {
  top?: number;
  direction?: "incoming" | "outgoing";
  renderRow?: (row: Row, node: ReactNode) => ReactNode;
  showStatus?: boolean;
}) {
  const outgoing = direction === "outgoing";
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0 }}>
      {thread.map((row, index) => {
        const bubble = (
          <MessageBubble key={row.id} direction={direction} service={outgoing ? "sms" : "imessage"} tail={row.tail ?? false}
            status={showStatus ? row.status : undefined}
            reactions={row.tapback ? <Tapback reaction="love" own={outgoing} side={outgoing ? "left" : "right"} /> : undefined}
            style={{ width: "100%", marginTop: gapFor(row, index), paddingRight: outgoing ? 16 : 0, paddingLeft: outgoing ? 0 : 16 }}>
            {row.text}
          </MessageBubble>
        );
        return renderRow ? <div key={row.id}>{renderRow(row, bubble)}</div> : bubble;
      })}
    </div>
  );
}

function Header({ service = "iMessage", firstTop = 205 }: { service?: string; firstTop?: number }) {
  // Blink rounds a text box to a whole CSS px before painting, so the header box lands on 170 / 166.
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: firstTop - 35 }}>
      <DateSeparator service={service} dateTime="2026-09-08T01:25">
        <><span style={{ fontWeight: 500 }}>Today</span>{` 1:25${NNBSP}AM`}</>
      </DateSeparator>
    </div>
  );
}

export function IosScreensScene({ scene, theme, progress, live = false }: { scene: ScreenScene; theme: "light" | "dark"; progress?: number; live?: boolean }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({ hi: true });
  const [hideAlerts, setHideAlerts] = useState(false);
  // `?progress=live` drops the controlled value so the drag, spring and keyboard path run for real.
  const swipe = useSwipeToRevealTimes({ progress: live ? undefined : (progress ?? 1) });
  const platform = scene === "attachment" ? "macos" : "ios";
  const vars = paletteVars(palettes[platform][theme]) as CSSProperties;
  const dark = theme === "dark";

  if (scene === "attachment") {
    // 340×220 pt = the macOS crop `attachment-not-delivered-dark-2x.png` at 2x.
    return (
      <PlatformProvider platform="macos">
        <div data-testid="lab" className={theme} data-im-platform="macos"
          style={{ ...vars, width: 340, height: 220, position: "relative", overflow: "hidden", background: dark ? "#1e1e1e" : "#ffffff" }}>
          {[{ name: "design-notes.txt", kind: "Text Document", size: "275 bytes", top: 5.5 },
            { name: "fixture-photo.png", kind: "PNG Image", size: "5 KB", top: 113 }].map(card => (
            <div key={card.name} style={{ position: "absolute", left: 17, top: Math.floor(card.top), transform: `translateY(${card.top - Math.floor(card.top)}px)` }}>
              <MessageAttachment name={card.name} kind={card.kind} size={card.size} tail direction="outgoing" />
              <div style={{ position: "absolute", display: "flex", left: 284.5, top: 36 }}><FailedSendBadge /></div>
              <div style={{ position: "absolute", left: 0, top: 88.25, width: 301.5 }}><NotDelivered /></div>
            </div>
          ))}
        </div>
      </PlatformProvider>
    );
  }

  const frame: CSSProperties = { ...vars, width: 402, height: 874, position: "relative", overflow: "hidden", background: "var(--im-bg)" };

  if (scene === "details") {
    return (
      <PlatformProvider platform="ios">
        <div data-testid="lab" className={theme} data-im-platform="ios" style={frame}>
          <IosDetails
            name="+1 (888) 555-1212" initials="JA" phone="+1 (888) 555-1212" tag="RECENT"
            progress={live ? undefined : (progress ?? 1)}
            hideAlerts={hideAlerts} onHideAlertsChange={setHideAlerts}
            actions={[
              { id: "call", label: "Call", icon: "phone" },
              { id: "facetime", label: "FaceTime", icon: "video", disabled: true },
              { id: "mail", label: "Mail", icon: "mail", disabled: true },
            ]}
            links={[{ id: "create", label: "Create New Contact" }, { id: "existing", label: "Add to Existing Contact" }]}
            backdrop={<div style={{ position: "absolute", inset: 0, background: "var(--im-bg)" }}><Thread /></div>}
          />
          <IosStatusBar time={dark ? "3:14" : "3:10"} className="absolute left-0 top-0" />
        </div>
      </PlatformProvider>
    );
  }

  if (scene === "plus-menu") {
    return (
      <PlatformProvider platform="ios">
        <div data-testid="lab" className={theme} data-im-platform="ios" style={frame}>
          <Header />
          <Thread />
          <IosStatusBar time="3:05" className="absolute left-0 top-0" />
          <IosNavBar name="+1 (888) 555-1212" initials="JA" className="absolute left-0 top-[54px]" />
          <IosPlusMenu progress={live ? undefined : (progress ?? 1)} composer={<IosComposer placeholder="Message" />} />
        </div>
      </PlatformProvider>
    );
  }

  if (scene === "select-mode") {
    return (
      <PlatformProvider platform="ios">
        <div data-testid="lab" className={theme} data-im-platform="ios" style={frame}>
          {/* Select mode drops the nav bar's back button; the ✕ takes the trailing corner. */}
          <style>{`[data-slot="ios-nav-bar"] [data-slot="back"]{display:none}`}</style>
          <Header />
          <Thread showStatus={false} renderRow={(row, node) => (
            <MessageSelectionRow selected={!!selected[row.id]} label={row.text}
              onChange={next => setSelected(prev => ({ ...prev, [row.id]: next }))}>
              {node}
            </MessageSelectionRow>
          )} />
          <IosStatusBar time="3:16" className="absolute left-0 top-0" />
          <IosNavBar name="+1 (888) 555-1212" initials="JA" className="absolute left-0 top-[54px]" />
          <IosSelectionCloseButton />
          <IosSelectionToolbar count={Object.values(selected).filter(Boolean).length} />
        </div>
      </PlatformProvider>
    );
  }

  if (scene === "swipe-times") {
    return (
      <PlatformProvider platform="ios">
        <div data-testid="lab" className={theme} data-im-platform="ios" {...swipe.handlers} style={{ ...frame, ...swipe.handlers.style }}>
          <Header />
          <Thread renderRow={(row, node) => <SwipeTimes time={row.time} progress={swipe.progress}>{node}</SwipeTimes>} />
          <IosStatusBar time="3:09" className="absolute left-0 top-0" />
          <IosNavBar name="+1 (888) 555-1212" initials="JA" className="absolute left-0 top-[54px]" />
          <IosComposer className="absolute bottom-0 left-0" />
        </div>
      </PlatformProvider>
    );
  }

  // notice + photo-picker share the mirrored (incoming) conversation; the picker capture is scrolled
  // so the last body ("Hi there") sits at 280.67 instead of 663.33.
  const incomingTop = scene === "photo-picker" ? -181.6667 : 201;
  const noticeTop = incomingTop + 502;
  return (
    <PlatformProvider platform="ios">
      <div data-testid="lab" className={theme} data-im-platform="ios" style={frame}>
        <Header firstTop={incomingTop} />
        <Thread top={incomingTop} direction="incoming" showStatus={false} />
        <div style={{ position: "absolute", left: 16, right: 16, top: noticeTop }}>
          <UnknownSenderNotice />
        </div>
        <IosStatusBar time={scene === "photo-picker" ? "3:26" : dark ? "3:33" : "3:33"} className="absolute left-0 top-0" />
        <IosNavBar name="+1 (555) 564-8583" initials="KB" className="absolute left-0 top-[54px]" />
        {scene === "photo-picker" ? (
          <>
            <IosComposer className="absolute left-0" style={{ top: 424 }} />
            <div style={{ position: "absolute", left: 5.3333, top: 485 }}><PhotoPickerGrid /></div>
          </>
        ) : (
          <IosComposer className="absolute bottom-0 left-0" />
        )}
      </div>
    </PlatformProvider>
  );
}
