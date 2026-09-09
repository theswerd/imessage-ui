"use client";

import type { CSSProperties } from "react";
import { MessageImages, type MessageImage } from "@/registry/imessage/message-image";
import { PlatformProvider, type Platform } from "@/registry/imessage/platform";
import { bubbleMetrics, palettes, paletteVars } from "@/registry/imessage/tokens";

export type PhotoLabCase = "shapes" | "counts" | "states" | "narrow" | "badges";

/**
 * The transcript column a photo balloon actually lives in. iOS is the 402 pt screen, macOS the
 * 960 pt window less its 330 pt sidebar; both then lose `edgeInset` on each side, which is the box
 * `message-list.tsx` gives every row. Nothing here is a capture — see `page.tsx`.
 */
const paneWidths: Record<Platform, number> = { ios: 402, macos: 630 };

/**
 * A photo of an exact intrinsic size, so the component's aspect handling is being fed a known
 * number rather than whatever a JPEG in `public/fixtures` happens to be. An SVG data URI is
 * same-origin, so `sampleCorner` can still read the tail's corner off it.
 */
function shape(width: number, height: number, hue: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="hsl(${hue} 52% 60%)"/>` +
    `<rect x="${width * 0.02}" y="${height * 0.02}" width="${width * 0.96}" height="${height * 0.96}" fill="none" stroke="#fff" stroke-width="${Math.max(width, height) * 0.012}"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * `-[CKUIBehaviorPhone thumbnailFillSizeForWidth:imageSize:]` and its `CKUIBehaviorMac` override,
 * read out of ChatKit with the probe the file header of `message-image.tsx` describes: dlopen the
 * framework, swizzle `-[UIDevice userInterfaceIdiom]` **before** anything latches it, then ask
 * `+sharedBehaviors` — and ask the Mac one in its own process, because `+sharedBehaviors` caches the
 * first singleton it builds and a second call in the same process hands back the phone's.
 *
 * `width` is the balloon width each platform's transcript gives a photo: 280.5 on iPhone, 382.5 on
 * Mac (`bubbleMetrics[platform].maxWidth`, both measured off captures). ChatKit rounds its answer to
 * the device pixel grid and the probe process ran at DisplayScale 2, so every number below is a
 * multiple of 0.5 and an iPhone at 3x would land within 1/6 pt of it. That tolerance is the reason
 * `probe-shapes.ts` reports a max delta rather than an equality.
 *
 * The two differ in kind, not degree: the phone *clamps the shape* (nothing wider than 16:9, nothing
 * taller than 3:4, both cropped) where the Mac returns the true aspect fit. The 500 pt ceiling is
 * portrait-only on both — a 1:1 photo at width 900 comes back 900 x 900.
 */
const chatKitBox: Record<Platform, Array<{ id: string; ratio: string; source: [number, number]; expect: [number, number] }>> = {
  ios: [
    { id: "wide-4-1", ratio: "4:1", source: [4000, 1000], expect: [280.5, 158] },
    { id: "wide-16-9", ratio: "16:9", source: [1920, 1080], expect: [280.5, 158] },
    { id: "landscape-4-3", ratio: "4:3", source: [4000, 3000], expect: [280.5, 210.5] },
    { id: "square", ratio: "1:1", source: [1000, 1000], expect: [280.5, 280.5] },
    { id: "portrait-3-4", ratio: "3:4", source: [3000, 4000], expect: [280.5, 374] },
    { id: "portrait-9-16", ratio: "9:16", source: [1080, 1920], expect: [280.5, 374] },
    { id: "tall-1-4", ratio: "1:4", source: [1000, 4000], expect: [280.5, 374] },
  ],
  macos: [
    { id: "wide-4-1", ratio: "4:1", source: [4000, 1000], expect: [382.5, 96] },
    { id: "wide-16-9", ratio: "16:9", source: [1920, 1080], expect: [382.5, 215.5] },
    { id: "landscape-4-3", ratio: "4:3", source: [4000, 3000], expect: [382.5, 287] },
    { id: "square", ratio: "1:1", source: [1000, 1000], expect: [382.5, 382.5] },
    { id: "portrait-3-4", ratio: "3:4", source: [3000, 4000], expect: [375, 500] },
    { id: "portrait-9-16", ratio: "9:16", source: [1080, 1920], expect: [281.5, 500] },
    { id: "tall-1-4", ratio: "1:4", source: [1000, 4000], expect: [125, 500] },
  ],
};

/** Container widths the `narrow` case squeezes a four-photo group through, in pane points. */
const narrowWidths = [590, 460, 360, 280, 200, 140];

const gallery: MessageImage[] = [
  { src: shape(1400, 1050, 205), alt: "Shore" },
  { src: shape(1400, 1050, 250), alt: "Ridge" },
  { src: shape(1050, 1400, 330), alt: "Bloom" },
  { src: shape(1400, 1050, 30), alt: "Dusk" },
  { src: shape(1050, 1400, 160), alt: "Frost" },
  { src: shape(1400, 1050, 95), alt: "Haze" },
];

/** A src that will never resolve, so the tile lands in `phase === "failed"` for real. */
const brokenPhoto: MessageImage = { src: "/fixtures/__no_such_photo__.jpg", alt: "Missing" };

function Row({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div data-slot="lab-row" data-label={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, lineHeight: "12px", opacity: 0.55, fontFamily: "ui-monospace, monospace" }}>
        {label}
        {note ? ` — ${note}` : ""}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>{children}</div>
    </div>
  );
}

export function PhotoLabScene({ platform, theme, scene, paneWidth }: { platform: Platform; theme: "light" | "dark"; scene: PhotoLabCase; paneWidth?: number }) {
  const m = bubbleMetrics[platform];
  const vars = paletteVars(palettes[platform][theme]) as CSSProperties;
  const pane = paneWidth ?? paneWidths[platform];
  const column = pane - m.edgeInset * 2;

  return (
    <PlatformProvider platform={platform}>
      <div
        data-testid="photo-lab"
        data-platform={platform}
        data-case={scene}
        data-pane-width={pane}
        data-column-width={column}
        className={theme}
        style={{
          ...vars,
          width: pane,
          minHeight: "100vh",
          background: "var(--im-bg)",
          color: "var(--im-incoming-text)",
          padding: `24px ${m.edgeInset}px`,
          display: "flex",
          flexDirection: "column",
          gap: 26,
          boxSizing: "border-box",
        }}
      >
        {/* One photo at each shape ChatKit was swept over. The wrapper carries the framework's own
            answer so `probe-shapes.ts` can diff the rendered box against it without a screenshot. */}
        {scene === "shapes" &&
          chatKitBox[platform].map(entry => (
            <div key={entry.id} data-slot="shape-case" data-id={entry.id} data-ck-w={entry.expect[0]} data-ck-h={entry.expect[1]}>
              <Row label={entry.ratio} note={`ChatKit ${entry.expect[0]} x ${entry.expect[1]}`}>
                <MessageImages
                  images={[{ src: shape(entry.source[0], entry.source[1], 205), alt: entry.ratio, width: entry.source[0], height: entry.source[1] }]}
                  direction="outgoing"
                  tail
                />
              </Row>
            </div>
          ))}

        {/* One through six photos: the tile grid, and the "+N" tile the fifth and sixth fall into. */}
        {scene === "counts" &&
          [1, 2, 3, 4, 5, 6].map(count => (
            <div key={count} data-slot="count-case" data-count={count}>
              <Row label={`${count} photo${count === 1 ? "" : "s"}`}>
                <MessageImages images={gallery.slice(0, count)} direction="outgoing" tail />
              </Row>
            </div>
          ))}

        {scene === "states" && (
          <>
            <div data-slot="state-case" data-id="ready">
              <Row label="ready">
                <MessageImages images={gallery.slice(0, 1)} direction="outgoing" tail />
              </Row>
            </div>
            <div data-slot="state-case" data-id="loading">
              <Row label="loading" note="transfer has not arrived">
                <MessageImages images={gallery.slice(0, 1)} direction="outgoing" tail loading />
              </Row>
            </div>
            <div data-slot="state-case" data-id="failed-single">
              <Row label="failed" note="ChatKit TAP_TO_DOWNLOAD / CLICK_TO_DOWNLOAD">
                <MessageImages images={[brokenPhoto]} direction="incoming" tail />
              </Row>
            </div>
            <div data-slot="state-case" data-id="failed-in-group">
              <Row label="failed tile in a group">
                <MessageImages images={[gallery[0], brokenPhoto, gallery[2], gallery[3]]} direction="incoming" tail />
              </Row>
            </div>
            <div data-slot="state-case" data-id="pending">
              <Row label="pending" note="never fetched, offers the download without a failed load">
                <MessageImages images={[{ ...gallery[0], pending: true }]} direction="incoming" tail />
              </Row>
            </div>
          </>
        )}

        {/* `livePhotoBadgeImage` over the tile: box and ring radii are the framework's own, its place
            in the tile is not. The second row is the badge in a group, one per Live Photo tile. */}
        {scene === "badges" && (
          <>
            <div data-slot="badge-case" data-id="live-single">
              <Row label="Live Photo" note={`ChatKit livePhotoBadgeImage ${platform === "ios" ? "21.5 x 20.5" : "28 x 28"}`}>
                <MessageImages images={[{ ...gallery[0], livePhoto: true }]} direction="outgoing" tail />
              </Row>
            </div>
            <div data-slot="badge-case" data-id="live-group">
              <Row label="Live Photos in a group">
                <MessageImages images={[{ ...gallery[0], livePhoto: true }, gallery[1], { ...gallery[2], livePhoto: true }, gallery[3]]} direction="outgoing" tail />
              </Row>
            </div>
          </>
        )}

        {/* The overflow case. Each container is narrower than the platform's balloon width, which is
            what a resized window, a two-pane layout or an open inspector does to the transcript. */}
        {scene === "narrow" &&
          narrowWidths.map(width => (
            <div key={width} data-slot="narrow-case" data-container-width={width} style={{ width, maxWidth: "100%", outline: "1px dashed rgba(255,0,255,0.5)", outlineOffset: 1 }}>
              <Row label={`container ${width}`} note={`balloon max ${m.maxWidth}`}>
                <MessageImages images={gallery.slice(0, 4)} direction="outgoing" tail />
              </Row>
            </div>
          ))}
      </div>
    </PlatformProvider>
  );
}
