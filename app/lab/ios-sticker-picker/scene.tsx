"use client";

import { useState, type CSSProperties } from "react";
import { StickerPicker, stickerPickerMetrics, stickerPickerTabs } from "@/registry/imessage/sticker-picker";
import { MessageBubble } from "@/registry/imessage/message-bubble";
import { PlatformProvider } from "@/registry/imessage/platform";
import { bubbleMetrics, palettes, paletteVars } from "@/registry/imessage/tokens";

export type StickerScene = "capture" | "grid" | "drag" | "conversation";

/**
 * The backdrop the capture was made against: a white page carrying four flat 402x60 bands at y 100,
 * 160, 220 and 280 (white, 50% grey, black, red). They are what pinned the sheet's dimming — all four
 * come back multiplied by 0.8 — and reproducing them is what makes a whole-frame diff of
 * `sticker-picker-light.png` mean anything above the sheet.
 */
function CaptureBackdrop() {
  const bands = ["#ffffff", "#808080", "#000000", "#ff0000"];
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "#ffffff" }}>
      {bands.map((background, index) => (
        <div key={background} style={{ position: "absolute", left: 0, width: 402, top: 100 + index * 60, height: 60, background }} />
      ))}
    </div>
  );
}

/** Enough of the fixture conversation for a sticker to land on a bubble. */
function Transcript({ theme }: { theme: "light" | "dark" }) {
  const m = bubbleMetrics.ios;
  return (
    <div style={{ position: "absolute", top: 120, left: m.edgeInset, right: m.edgeInset, display: "flex", flexDirection: "column", gap: m.gapBetweenGroups }}>
      <div className="flex w-full justify-start"><MessageBubble direction="incoming" tail>Hey! How’s the new project going?</MessageBubble></div>
      <div className="flex w-full justify-end"><MessageBubble direction="outgoing" tail>It’s starting to feel pretty familiar.</MessageBubble></div>
      <div className="flex w-full justify-start" data-testid="target-bubble"><MessageBubble direction="incoming" tail>Tuesday morning at 9?</MessageBubble></div>
      <div className="flex w-full justify-end"><MessageBubble direction="outgoing" tail service={theme === "dark" ? "imessage" : "imessage"}>Sounds good 👍</MessageBubble></div>
    </div>
  );
}

/**
 * The capture's own strip: Recents, Emoji and the two packs the simulator had installed, then the
 * EDIT pill. The kit's default list carries five categories, which would push the pill 51.33 to the
 * right of where the PNG puts it and make the strip band's diff meaningless.
 */
const captureTabs = ["recents", "emoji", "memoji", "doodles"].flatMap(id => {
  const tab = stickerPickerTabs.find(entry => entry.id === id);
  // The capture was taken on a fresh simulator, so Recents is empty and the card shows its empty
  // state. Reproducing that is the whole point of the scene.
  return tab ? [id === "recents" ? { ...tab, stickers: [] } : tab] : [];
});

export function StickerPickerScene({
  scene,
  theme,
  tab,
  progress,
  open,
  dragProgress,
}: {
  scene: StickerScene;
  theme: "light" | "dark";
  tab: string;
  progress?: number;
  open: boolean;
  dragProgress?: number;
}) {
  const [placed, setPlaced] = useState<Array<{ id: string; glyph: string; x: number; y: number; rotation: number; size: number }>>([]);
  const [log, setLog] = useState("");
  const [exited, setExited] = useState(false);
  const vars = paletteVars(palettes.ios[theme]) as CSSProperties;
  const m = stickerPickerMetrics;

  // The posed drag travels to the middle of the "Tuesday morning at 9?" bubble, which is where a
  // sticker reaction would land in the transcript behind the sheet.
  const dragTo = { x: 150, y: 300 };

  return (
    <PlatformProvider platform="ios">
      <div
        data-testid="lab"
        data-log={log}
        data-exited={exited ? "yes" : "no"}
        className={theme}
        style={{ ...vars, position: "relative", width: 402, height: 874, overflow: "hidden", background: scene === "capture" || scene === "grid" || scene === "drag" ? "#ffffff" : "var(--im-bg)" }}
      >
        {scene === "conversation" ? <Transcript theme={theme} /> : <CaptureBackdrop />}

        {placed.map((entry, index) => (
          <span
            key={`${entry.id}-${index}`}
            aria-hidden="true"
            data-slot="landed-sticker"
            style={{
              position: "absolute",
              left: entry.x - entry.size / 2,
              top: entry.y - entry.size / 2,
              width: entry.size,
              height: entry.size,
              transform: `rotate(${entry.rotation}deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: entry.size * 0.78,
              lineHeight: 1,
            }}
          >
            {entry.glyph}
          </span>
        ))}

        <StickerPicker
          tabs={scene === "capture" ? captureTabs : stickerPickerTabs}
          defaultTab={scene === "grid" || scene === "drag" ? "emoji" : tab}
          progress={progress}
          open={open}
          dragPreview={scene === "drag" ? { id: "e-joy", to: dragTo, progress: dragProgress ?? 0.5 } : null}
          onSelect={sticker => setLog(`select:${sticker.id}`)}
          onEdit={() => setLog("edit")}
          onDismiss={() => setLog("dismiss")}
          onExited={() => setExited(true)}
          onPlace={(sticker, placement) => {
            setLog(`place:${sticker.id}:${Math.round(placement.x)},${Math.round(placement.y)}:${placement.rotation.toFixed(2)}:${placement.size}`);
            setPlaced(current => [...current, { id: sticker.id, glyph: sticker.glyph, x: placement.x, y: placement.y, rotation: placement.rotation, size: placement.size }]);
          }}
        />

        {/* The measured sheet box, drawn as a hairline so a reviewer can see where the capture puts it. */}
        {scene === "capture" ? (
          <div
            aria-hidden="true"
            data-slot="measured-box"
            hidden
            style={{ position: "absolute", left: m.sheet.inset, top: m.sheet.top, width: m.sheet.width, height: m.sheet.height, outline: "1px solid #ff00ff" }}
          />
        ) : null}
      </div>
    </PlatformProvider>
  );
}

export { stickerPickerTabs };
