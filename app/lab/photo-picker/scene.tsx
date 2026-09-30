"use client";

import { useState, type CSSProperties } from "react";
import { DateSeparator } from "@/registry/imessage/date-separator";
import { IosComposer } from "@/registry/imessage/ios-composer";
import { IosNavBar } from "@/registry/imessage/ios-nav-bar";
import { IosStatusBar } from "@/registry/imessage/ios-status-bar";
import { UnknownSenderNotice } from "@/registry/imessage/ios-notices";
import { MessageBubble } from "@/registry/imessage/message-bubble";
import {
  PhotoPicker,
  PhotoPickerAttachments,
  PhotoPickerSelectionBadge,
  photoPickerMetrics,
  photoPickerSamples,
  type PhotoPickerDetent,
} from "@/registry/imessage/photo-picker";
import { PlatformProvider } from "@/registry/imessage/platform";
import { palettes, paletteVars } from "@/registry/imessage/tokens";

export type PickerScene = "screen" | "panel" | "badge";

/**
 * The mirrored (incoming) conversation `photo-picker-light.png` is scrolled to, copied verbatim from
 * the capture so the pixel diff compares like with like. The picker capture puts the last body
 * ("Hi there") at 280.67 instead of 663.33, which is what the -181.6667 top is.
 */
const NNBSP = " ";
const LONG = "It’s all in the little details. ✨ A longer message should wrap naturally without stretching the conversation.";
const thread = [
  { id: "a", text: "A" + "a".repeat(32), tail: true },
  { id: "v1", text: "V", cluster: true },
  { id: "v2", text: "V" },
  { id: "v3", text: "V", tail: true },
  { id: "long", text: LONG, tail: true, cluster: true },
  { id: "ok", text: "Ok", cluster: true },
  { id: "every", text: "Every detail, down to the last bubble." , tail: true },
  { id: "hi", text: "Hi there", tail: true, cluster: true },
];

const GAP_IN = 4.3333;
const GAP_BETWEEN = 10.3333;
const INCOMING_TOP = -181.6667;

export function PhotoPickerScene({
  scene = "screen",
  theme,
  progress,
  detent: detentProp,
  selected: selectedProp,
  live = false,
  open = true,
  count,
}: {
  scene?: PickerScene;
  theme: "light" | "dark";
  progress?: number;
  detent?: PhotoPickerDetent;
  selected?: string[];
  live?: boolean;
  open?: boolean;
  /** Repeats the six placeholders up to this many tiles, so the windowing has something to window. */
  count?: number;
}) {
  const [selected, setSelected] = useState<string[]>(selectedProp ?? []);
  const [detent, setDetent] = useState<PhotoPickerDetent>(detentProp ?? "collapsed");
  /** Counted, not just called, so a test can prove the exit reports exactly once per close. */
  const [exits, setExits] = useState(0);
  const vars = paletteVars(palettes.ios[theme]) as CSSProperties;
  const m = photoPickerMetrics;

  if (scene === "badge") {
    /*
     * Nothing but the selection badge, on white, so it can be diffed on its own.
     *
     * The box used to be PhotosUICore's `+[PXSelectionBadgeUIViewTile preferredSize]` {26, 26} with a
     * 21.9873 ink inside it. The device measures the ink at 23.0 and does not put it in a 26 box at
     * all (see `badge` in `photo-picker.tsx`), so this scene is now exactly the ink: the box is
     * `badge.size` and the badge fills it. The old diff target - that `preferredSize` image rendered
     * at 3x - no longer applies, because it is a different badge from the one this sheet draws.
     */
    return (
      <div
        data-testid="lab"
        className={theme}
        style={{
          width: m.badge.size,
          height: m.badge.size,
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // The badge reads its colours off the picker's custom properties, which the panel would
          // normally supply.
          ["--ios-pp-badge" as string]: m.badge.fill,
          ["--ios-pp-glyph" as string]: "#ffffff",
        }}
      >
        <PhotoPickerSelectionBadge />
      </div>
    );
  }

  const library = count && count > photoPickerSamples.length
    ? Array.from({ length: count }, (_, index) => ({ ...photoPickerSamples[index % photoPickerSamples.length], id: `p${index}` }))
    : photoPickerSamples;
  const frame: CSSProperties = { ...vars, width: 402, height: 874, position: "relative", overflow: "hidden", background: "var(--im-bg)" };
  const picker = (
    <PhotoPicker
      photos={library}
      selected={selected}
      onSelectionChange={next => setSelected(next)}
      detent={detent}
      onDetentChange={setDetent}
      open={open}
      onExited={() => setExits(value => value + 1)}
      progress={live ? undefined : progress}
    />
  );

  if (scene === "panel") {
    // The panel alone on the capture's own backdrop grey, for a diff that does not have to carry the
    // conversation. The backdrop is the flat 244-246 the capture reads outside the panel.
    return (
      <PlatformProvider platform="ios">
        <div data-testid="lab" data-exits={exits} className={theme} data-im-platform="ios" style={{ ...frame, background: "#f4f4f4" }}>
          {picker}
        </div>
      </PlatformProvider>
    );
  }

  const chosen = library.filter(photo => selected.includes(photo.id ?? ""));
  return (
    <PlatformProvider platform="ios">
      <div data-testid="lab" data-exits={exits} className={theme} data-im-platform="ios" style={frame}>
        <div style={{ position: "absolute", left: 0, right: 0, top: INCOMING_TOP - 35 }}>
          <DateSeparator service="iMessage" dateTime="2026-09-08T01:25">
            <><span style={{ fontWeight: 500 }}>Today</span>{` 1:25${NNBSP}AM`}</>
          </DateSeparator>
        </div>
        <div style={{ position: "absolute", top: INCOMING_TOP, left: 0, right: 0 }}>
          {thread.map((row, index) => (
            <MessageBubble
              key={row.id}
              direction="incoming"
              service="imessage"
              tail={row.tail ?? false}
              style={{ width: "100%", marginTop: index === 0 ? 0 : row.cluster ? GAP_BETWEEN : GAP_IN, paddingLeft: 16 }}
            >
              {row.text}
            </MessageBubble>
          ))}
        </div>
        <div style={{ position: "absolute", left: 16, right: 16, top: INCOMING_TOP + 502 }}>
          <UnknownSenderNotice />
        </div>
        <IosStatusBar time="3:26" className="absolute left-0 top-0" />
        <IosNavBar name="+1 (555) 564-8583" initials="KB" className="absolute left-0 top-[54px]" />
        {/*
          The capture keeps the composer whole - `+`, "iMessage" and the mic - with its field ending
          at 463.6667, 21.3333 above the panel. `top: 424` is what puts it there.
        */}
        <IosComposer className="absolute left-0" style={{ top: 424 }} />
        {chosen.length > 0 ? (
          <div style={{ position: "absolute", left: 16, top: 424 - 62 }}>
            <PhotoPickerAttachments photos={chosen} onRemove={id => setSelected(prev => prev.filter(entry => entry !== id))} />
          </div>
        ) : null}
        {picker}
      </div>
    </PlatformProvider>
  );
}
