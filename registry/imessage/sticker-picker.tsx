"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { emojiFontStack, fontStack } from "@/registry/imessage/tokens";

/**
 * The iOS 26 sticker picker, the sheet the plus menu's "Stickers" row opens.
 *
 * ## Provenance, in the order this repo prefers it
 *
 * **1. Measured, from `references/ios/captures/plus-menu-open-light.png` (402x874 @3x).** The sheet is
 * the plus menu's own sheet, so its box is the measurement `ios-plus-menu.tsx` already carries:
 * x 8.6667-331.3333, y 371-831.6667 (322.6667 x 460.6667), continuous corner 24, glass
 * rgb(255 255 255 / 0.62) light and rgb(28 28 28 / 0.72) dark over a nominal 45 blur, one soft shadow
 * fitted at 6.6% in light and a bright inset rim in dark. Nothing behind it dims. The picker is
 * presented the same way, so it inherits all of that rather than inventing a second sheet.
 * The entrance grows out of the Stickers row's own artwork: that row is the third of seven, so its
 * icon is the measured Oe39 disc centred (63.1667, 425.8333 + 2 x 66.5 = 558.8333).
 *
 * **2. From the frameworks.** macOS Messages is a Mac Catalyst app on ChatKit, so a Catalyst probe
 * (`clang -target arm64-apple-ios26.0-macabi`) can dlopen
 * `/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit`, swizzle
 * `-[UIDevice userInterfaceIdiom]` to Phone so `+[CKUIBehavior sharedBehaviors]` vends
 * `CKUIBehaviorPhone`, and read the values off the runtime. Everything below names the selector it
 * came from:
 *
 * | Value | Selector |
 * |---|---|
 * | tile corner radius 8 | `-[CKUIBehaviorPhone stickersCellCornerRadius]` |
 * | grid gaps 4 | `-[CKUIBehaviorPhone attachmentBrowserGridInterItemSpacing]` and `attachmentBrowserGridMinimumLineSpacing` |
 * | grid inset 8 on all four sides | `-[CKUIBehaviorPhone attachmentBrowserGridSectionInset]` |
 * | tab strip 38 tall | `+[CKAppStripLayout minHeight]` |
 * | tab 52 x 38, 2 between, 1 x 38 separator | `-[CKAppStripLayout _specForLayoutMode:]` mode 0 (mode 1, the magnified strip, is 84 x 68 with 4 and 6) |
 * | strip gutter 8 | `-[CKUIBehaviorPhone browserSwitcherGutterWidth]` |
 * | emoji sticker box 48 x 48 | `-[CKUIBehaviorPhone emojiStickerTranscriptBalloonSize]` |
 * | drag rotation 3 to 10 degrees | `-[CKUIBehaviorPhone minStickerReactionRotation]` / `maxStickerReactionRotation` |
 * | drag easing cubic-bezier(0.14028, 0.004662, 0.57534, 0.96737) | the `CAMediaTimingFunction` `+[CKBrowserDragStickerView springAnimationWithKeyPath:speed:]` builds, read out of ChatKit's `__const` at the four `adrp`/`ldr` pairs at +128..+156 under lldb |
 * | search row 44, field 34, field type 17pt medium | `-[UISearchBar sizeThatFits:]` at width 322.6667, `-[UISearchTextField sizeThatFits:]`, and `-[UISearchBar searchTextField].font` in the same probe |
 * | field fill rgba(118,118,128,0.12) / (0.24) | `+[UIColor tertiarySystemFillColor]` resolved against each `UIUserInterfaceStyle` |
 * | separator #c6c6c8 / #38383a | `+[UIColor opaqueSeparatorColor]`, same resolution |
 *
 * Two framework numbers that back each other up: six columns inside the measured sheet puts an emoji
 * tile at (322.6667 - 2x8 - 5x4) / 6 = 47.7778, a quarter point off the 48 x 48 ChatKit gives an emoji
 * sticker in the transcript. The column count is still a choice (see below); the tile size it lands on
 * is not an accident.
 *
 * The label colours are NOT taken from that probe. `+[UIColor labelColor]` and `separatorColor` come
 * back with the *macOS* values under Catalyst (0.847 alpha black, 0.098 alpha black), so this file
 * uses the kit's own measured iOS labels instead: #000000 / #f4f3f4 from `ios-plus-menu.tsx` and the
 * #8a8a8e / #97979d search gray from `ios-conversation-list.tsx`. The `systemFill` family does come
 * back with the iOS values (118,118,128 at 0.12 and 0.24), which is why it is used.
 *
 * **3. Reused from measurements elsewhere in the kit.** The grabber is `photo-picker.tsx`'s: 36 x 5,
 * radius 2.5, its top 4.6667 below the panel, the size itself `-[_UIGrabber intrinsicContentSize]`.
 * The magnifier is the one traced for `ios-conversation-list.tsx`'s search pill (circle r 5.883 at
 * (6.745, 7.219), stroke 1.725; handle 11.4,12.01 to 15.17,15.78, stroke 2.467), drawn here at 0.72
 * of that size to suit a 34 pt field instead of a 48 pt one. Enter 380 ms and exit 220 ms are the
 * long-press menu's measured `messageActionsTiming` open and exit, the same borrow `photo-picker.tsx`
 * makes.
 *
 * **4. Judgement, and nothing here is measured.** Marked `@unverified` on each metric as well:
 *
 * - **The column counts.** Three for art stickers (the count the Photos picker measures) and six for
 *   emoji. Nothing in `references/` captures this grid, and the picker's own UI is out of process:
 *   `_UIStickerPickerViewController` is a shell around `_UIStickerPickerServiceRemoteViewController`,
 *   and the service that draws the card (`com.apple.StickerKit.StickerPickerService`) is not
 *   installed on macOS, so no Mac-side framework holds its layout.
 * - **Which tabs exist and their order.** Recents, Emoji, Memoji, Live Stickers, then app packs, from
 *   documented behaviour. The tab artwork is drawn here, not Apple's.
 * - **The vertical stack inside the sheet**: grabber, then the search row at 14, then the grid, then
 *   the strip pinned to the bottom. Only the pieces have measured sizes; their order and the 14 are a
 *   choice.
 * - **The drag lift of 1.4.** `-[CKBrowserDragStickerView animateScaleDown]` settles the drag view at
 *   0.7142857142857143 of its scale (the `__const` double the `ldr d1, [x8, #0x770]` at +164 loads),
 *   and 1 / 0.714285... is 1.4. What that scale is relative to was not traced, so 1.4 is
 *   ChatKit-derived rather than measured, and the ghost's shadow is invented outright.
 * - **Every duration except the 380 and the 220**, and the whole empty state.
 *
 * ## Motion
 *
 * One Web Animations timeline, so `document.getAnimations()` reaches it and `progress` pauses and
 * seeks it to a frame that renders identically on every run: nothing in it reads a clock, a random
 * number or a layout. The direction is read off the `open` prop **during render**, not in an effect,
 * so a dismissal always gets committed frames before `onExited` lets the caller unmount the sheet.
 *
 * The sheet itself never moves: it is already open behind the plus menu's rows. What animates is the
 * contents, scaling up from the Stickers row's own icon centre while they fade in, with the tab strip
 * riding up from the sheet's bottom edge behind them. `prefers-reduced-motion` skips to the end pose.
 *
 * The drag ghost is an interaction, not a presentation, so it is live only: scrubbing `progress`
 * disables it. Its return to the tile is still a Web Animations run for the same reason.
 */

/** Apple's continuous corner. Browsers without `corner-shape` fall back to a plain round corner. */
const continuous = { cornerShape: "superellipse(1.14)" } as CSSProperties;

/**
 * Light values are measured or framework values; see the file comment for which is which. Written out
 * in full because Tailwind only compiles class names it can read literally in the source.
 *
 * `--ios-sp-rim` and `--ios-sp-shadow-alpha` mirror `ios-plus-menu.tsx`: `box-shadow` takes a comma
 * separated list and `none` is only legal on its own, so both slots always hold a real shadow and the
 * unused one is fully transparent.
 */
const vars =
  "[--ios-sp-label:#000000] [--ios-sp-glass:255_255_255] [--ios-sp-alpha:0.62] [--ios-sp-shadow-alpha:0.066] [--ios-sp-rim:0_0_0_0_rgba(0,0,0,0)] " +
  "[--ios-sp-field:rgba(118,118,128,0.12)] [--ios-sp-muted:#8a8a8e] [--ios-sp-separator:#c6c6c8] [--ios-sp-tab-selected:rgba(120,120,128,0.16)] [--ios-sp-tile:rgba(118,118,128,0.12)] [--ios-sp-ghost-shadow:rgba(0,0,0,0.28)] " +
  "dark:[--ios-sp-label:#f4f3f4] dark:[--ios-sp-glass:28_28_28] dark:[--ios-sp-alpha:0.72] dark:[--ios-sp-shadow-alpha:0] dark:[--ios-sp-rim:inset_0_0_0_1px_rgba(255,255,255,0.09)] " +
  "dark:[--ios-sp-field:rgba(118,118,128,0.24)] dark:[--ios-sp-muted:#97979d] dark:[--ios-sp-separator:#38383a] dark:[--ios-sp-tab-selected:rgba(120,120,128,0.32)] dark:[--ios-sp-tile:rgba(118,118,128,0.24)] dark:[--ios-sp-ghost-shadow:rgba(0,0,0,0.5)]";

export const stickerPickerMetrics = {
  /** The screen the sheet's numbers were measured on. Points equal CSS px. */
  screen: { width: 402, height: 874 },
  /** Measured: the plus menu's sheet in `plus-menu-open-light.png`. */
  sheet: { left: 8.6667, top: 371, width: 322.6667, height: 460.6667, radius: 24 },
  /** Measured: the plus menu's Stickers row artwork, the third Oe39 disc down. */
  origin: { centerX: 63.1667, centerY: 558.8333, size: 39 },
  /** Measured in `photo-picker.tsx`; the 36 x 5 is `-[_UIGrabber intrinsicContentSize]`. */
  grabber: { width: 36, height: 5, radius: 2.5, top: 4.6667 },
  /**
   * `rowHeight` and `fieldHeight` are `-[UISearchBar sizeThatFits:]` and
   * `-[UISearchTextField sizeThatFits:]`; `fontSize` and `weight` are that bar's own search field
   * font (SF Medium 17), which is also the weight `ios-conversation-list.tsx` measured on the list's
   * search pill. `top`, `radius` and `glyphScale` are judgement: iOS 26 draws every field as a
   * capsule, so the radius is half the height.
   * @unverified top, radius, glyphScale
   */
  search: { top: 14, rowHeight: 44, fieldHeight: 34, fontSize: 17, weight: 500, radius: 17, glyphScale: 0.72, textInset: 34 },
  /**
   * `inset` and `gap` are `-[CKUIBehaviorPhone attachmentBrowserGridSectionInset]` and
   * `attachmentBrowserGridInterItemSpacing`; `tileRadius` is `stickersCellCornerRadius`. The two
   * column counts are judgement, and `emojiGlyph` (the glyph's share of its tile) is too.
   * @unverified columns, emojiColumns, emojiGlyph
   */
  grid: { inset: 8, gap: 4, tileRadius: 8, columns: 3, emojiColumns: 6, emojiGlyph: 0.68 },
  /**
   * The minified app strip out of `-[CKAppStripLayout _specForLayoutMode:]` mode 0, whose height is
   * also `+[CKAppStripLayout minHeight]`, with `-[CKUIBehaviorPhone browserSwitcherGutterWidth]` for
   * the gutter. `iconSize` and `selectionInset` are judgement, and the hairline over the strip is one
   * device pixel at 3x.
   * @unverified iconSize, selectionInset, hairline
   */
  strip: { height: 38, itemWidth: 52, itemHeight: 38, spacing: 2, separatorWidth: 1, gutter: 8, iconSize: 26, selectionInset: 3, hairline: 0.3333 },
  /**
   * `minRotation` and `maxRotation` are ChatKit's sticker reaction rotation bounds. `liftScale` is
   * derived from ChatKit (see the file comment); the threshold and the shadow are invented.
   * @unverified threshold, shadowBlur, shadowLift
   */
  drag: { liftScale: 1.4, minRotation: 3, maxRotation: 10, threshold: 6, shadowBlur: 18, shadowLift: 8 },
  /**
   * 380 and 220 are the long-press menu's measured open and exit, borrowed exactly as
   * `photo-picker.tsx` borrows them. `settle` is judgement.
   * @unverified settle
   */
  timing: { enter: 380, exit: 220, settle: 260 },
  /** The timing function `+[CKBrowserDragStickerView springAnimationWithKeyPath:speed:]` installs. */
  dragEasing: "cubic-bezier(0.14028, 0.004662, 0.57534, 0.96737)",
  /** The kit's entrance curve, shared with `photo-picker.tsx`. */
  enterEasing: "cubic-bezier(0.32, 0.72, 0, 1)",
  exitEasing: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

export type StickerKind = "emoji" | "art";

export type Sticker = {
  id: string;
  /** `emoji` draws `glyph` as text; `art` draws a placeholder tile with the glyph on top. */
  kind?: StickerKind;
  glyph: string;
  /** Accessible name, and what the search field matches against together with `keywords`. */
  label: string;
  keywords?: string;
  /** Any CSS background for an `art` sticker. The registry ships no photographs. */
  fill?: string;
};

export type StickerTabIcon = "recents" | "emoji" | "memoji" | "live" | "pack";

export type StickerTab = {
  id: string;
  label: string;
  icon: StickerTabIcon;
  stickers: Sticker[];
  /** Overrides the tab's column count. Emoji tabs default to six, everything else to three. */
  columns?: number;
  /** Draws the strip's 1 x 38 separator before this tab, the way the app strip splits its sections. */
  separatorBefore?: boolean;
};

const art = (id: string, glyph: string, label: string, fill: string, keywords?: string): Sticker => ({ id, kind: "art", glyph, label, fill, keywords });
const emoji = (id: string, glyph: string, label: string, keywords?: string): Sticker => ({ id, kind: "emoji", glyph, label, keywords });

/**
 * Fixture stickers. The people are the kit's own fixture cast (Alex Morgan, Jamie Chen, Sam Rivera)
 * and every "photo" sticker is a gradient, because a registry item never ships anybody's pictures.
 *
 * Recents is filled in below from the tabs it is a recency view over, so the same sticker carries one
 * id everywhere and a search across every tab cannot return it twice.
 */
export const stickerPickerTabs: StickerTab[] = [
  {
    id: "recents",
    label: "Recents",
    icon: "recents",
    stickers: [],
  },
  {
    id: "emoji",
    label: "Emoji",
    icon: "emoji",
    separatorBefore: true,
    stickers: [
      emoji("e-joy", "\u{1F602}", "Face with tears of joy", "laugh haha"),
      emoji("e-love", "\u{1F60D}", "Smiling face with heart eyes", "love"),
      emoji("e-wink", "\u{1F609}", "Winking face"),
      emoji("e-cool", "\u{1F60E}", "Smiling face with sunglasses", "cool"),
      emoji("e-think", "\u{1F914}", "Thinking face"),
      emoji("e-party", "\u{1F973}", "Partying face", "celebrate"),
      emoji("e-heart", "❤️", "Red heart", "love"),
      emoji("e-sparkle", "✨", "Sparkles"),
      emoji("e-fire", "\u{1F525}", "Fire"),
      emoji("e-clap", "\u{1F44F}", "Clapping hands"),
      emoji("e-pray", "\u{1F64F}", "Folded hands", "thanks"),
      emoji("e-rocket", "\u{1F680}", "Rocket"),
      emoji("e-cake", "\u{1F382}", "Birthday cake", "party"),
      emoji("e-coffee", "☕", "Hot beverage", "coffee"),
      emoji("e-dog", "\u{1F415}", "Dog"),
      emoji("e-cat", "\u{1F408}", "Cat"),
      emoji("e-sun", "☀️", "Sun"),
      emoji("e-thumbs", "\u{1F44D}", "Thumbs up", "yes ok"),
    ],
  },
  {
    id: "memoji",
    label: "Memoji",
    icon: "memoji",
    stickers: [
      art("m-alex-wave", "\u{1F44B}", "Alex Morgan waving", "linear-gradient(165deg, #ffe0b8 0%, #f0a566 55%, #b96a35 100%)"),
      art("m-alex-laugh", "\u{1F604}", "Alex Morgan laughing", "linear-gradient(165deg, #ffe0b8 0%, #f0a566 55%, #b96a35 100%)"),
      art("m-jamie-thumbs", "\u{1F44D}", "Jamie Chen giving a thumbs up", "linear-gradient(165deg, #d9e8ff 0%, #92aee0 55%, #4f5f96 100%)"),
      art("m-jamie-wow", "\u{1F62E}", "Jamie Chen looking surprised", "linear-gradient(165deg, #d9e8ff 0%, #92aee0 55%, #4f5f96 100%)"),
      art("m-sam-heart", "\u{1F60D}", "Sam Rivera sending love", "linear-gradient(165deg, #ffd7e2 0%, #e08aa8 55%, #944763 100%)"),
      art("m-sam-shrug", "\u{1F937}", "Sam Rivera shrugging", "linear-gradient(165deg, #ffd7e2 0%, #e08aa8 55%, #944763 100%)"),
    ],
  },
  {
    id: "live",
    label: "Live Stickers",
    icon: "live",
    stickers: [
      art("l-pup", "\u{1F415}", "Puppy cutout", "linear-gradient(170deg, #cfe4f6 0%, #8fb6d8 50%, #4d6f90 100%)", "dog"),
      art("l-shore", "\u{1F3D6}️", "Shore cutout", "linear-gradient(180deg, #bfe3ef 0%, #6fae9b 55%, #2f5a4a 100%)", "beach"),
      art("l-ridge", "⛰️", "Ridge cutout", "linear-gradient(200deg, #cdd6dd 0%, #7f8f97 50%, #38434a 100%)", "mountain"),
      art("l-bloom", "\u{1F339}", "Bloom cutout", "linear-gradient(160deg, #ffc9de 0%, #e0567f 55%, #8d2544 100%)", "flower"),
      art("l-mug", "☕", "Coffee cutout", "linear-gradient(170deg, #e7d3bd 0%, #b58a5f 55%, #6b4a2c 100%)"),
      art("l-bike", "\u{1F6B2}", "Bicycle cutout", "linear-gradient(190deg, #d5e9c9 0%, #86ac6a 55%, #40603a 100%)"),
    ],
  },
  {
    id: "doodles",
    label: "Doodles",
    icon: "pack",
    separatorBefore: true,
    stickers: [
      art("d-star", "⭐", "Doodled star", "linear-gradient(160deg, #fff2c4 0%, #f7c948 60%, #b98d10 100%)"),
      art("d-bolt", "⚡", "Doodled bolt", "linear-gradient(160deg, #d8ecff 0%, #6aa9f0 60%, #2b5ea8 100%)"),
      art("d-moon", "\u{1F319}", "Doodled moon", "linear-gradient(160deg, #e6e2ff 0%, #9d94ee 60%, #4d449c 100%)"),
      art("d-wave", "\u{1F30A}", "Doodled wave", "linear-gradient(160deg, #cdf2f7 0%, #56b7cf 60%, #1c6a83 100%)"),
    ],
  },
];

const byId = new Map(stickerPickerTabs.flatMap(entry => entry.stickers.map(sticker => [sticker.id, sticker] as const)));
/** The six most recently used, taken from the packs they belong to rather than copied. */
stickerPickerTabs[0].stickers = ["m-alex-wave", "e-heart", "l-pup", "e-joy", "d-star", "e-thumbs"].flatMap(id => {
  const sticker = byId.get(id);
  return sticker ? [sticker] : [];
});

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * A stable angle per sticker, inside ChatKit's 3 to 10 degree band. Deterministic on the id and not on
 * a clock or `Math.random`, so a lifted sticker poses identically every run and a seeked checkpoint
 * stays byte-identical.
 */
export function stickerDragRotation(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const { minRotation, maxRotation } = stickerPickerMetrics.drag;
  const magnitude = minRotation + ((hash >>> 8) % 1000) / 1000 * (maxRotation - minRotation);
  return (hash & 1 ? 1 : -1) * magnitude;
}

function TabGlyph({ icon, size }: { icon: StickerTabIcon; size: number }) {
  const common = { width: size, height: size, viewBox: "0 0 26 26", fill: "none", "aria-hidden": true } as const;
  if (icon === "recents") {
    return (
      <svg {...common} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13" cy="13" r="9.6" />
        <path d="M13 7.6V13l3.9 2.5" />
      </svg>
    );
  }
  if (icon === "emoji") {
    return (
      <svg {...common} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="13" cy="13" r="9.6" />
        <path d="M9.4 11.2v.6M16.6 11.2v.6" strokeWidth="2.4" />
        <path d="M8.9 15.4a5.2 5.2 0 0 0 8.2 0" />
      </svg>
    );
  }
  if (icon === "memoji") {
    return (
      <svg {...common} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="13" cy="13.2" rx="6.4" ry="7.4" />
        <path d="M6.6 11.4a1.9 1.9 0 0 0 0 3.8M19.4 11.4a1.9 1.9 0 0 1 0 3.8" />
        <path d="M10.8 12v1M15.2 12v1" strokeWidth="2.2" />
        <path d="M11 16.4a3.4 3.4 0 0 0 4 0" />
      </svg>
    );
  }
  if (icon === "live") {
    // A sticker with its corner peeled up, the shape the plus menu's Stickers row draws, as an
    // outline at strip size.
    return (
      <svg {...common} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8.4A3.4 3.4 0 0 1 8.4 5h9.2A3.4 3.4 0 0 1 21 8.4v5.2L13.6 21H8.4A3.4 3.4 0 0 1 5 17.6Z" />
        <path d="M21 13.6h-4a3.4 3.4 0 0 0-3.4 3.4v4" />
      </svg>
    );
  }
  return (
    <svg {...common} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <rect x="4.6" y="4.6" width="7.4" height="7.4" rx="2.1" />
      <rect x="14" y="4.6" width="7.4" height="7.4" rx="2.1" />
      <rect x="4.6" y="14" width="7.4" height="7.4" rx="2.1" />
      <rect x="14" y="14" width="7.4" height="7.4" rx="2.1" />
    </svg>
  );
}

/** The magnifier traced for the conversation list's search pill, at 0.72 of the size it is drawn there. */
function SearchGlyph({ scale }: { scale: number }) {
  return (
    <svg aria-hidden="true" width={18.3333 * scale} height={18.6667 * scale} viewBox="-1 -1 18.3333 18.6667" fill="none" stroke="var(--ios-sp-muted)" strokeLinecap="round">
      <circle cx="6.745" cy="7.219" r="5.883" strokeWidth="1.725" />
      <path d="M11.4 12.01 15.17 15.78" strokeWidth="2.467" />
    </svg>
  );
}

/** One sticker's artwork, at whatever box the grid or the drag ghost gives it. */
function StickerArt({ sticker, size }: { sticker: Sticker; size: number }) {
  const m = stickerPickerMetrics;
  if (sticker.kind === "emoji") {
    return (
      <span
        aria-hidden="true"
        data-slot="sticker-art"
        className="flex size-full items-center justify-center"
        style={{ fontFamily: emojiFontStack, fontSize: size * m.grid.emojiGlyph, lineHeight: 1 }}
      >
        {sticker.glyph}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-slot="sticker-art"
      className="flex size-full items-center justify-center"
      style={{
        background: sticker.fill ?? "var(--ios-sp-tile)",
        borderRadius: m.grid.tileRadius,
        ...continuous,
        fontFamily: emojiFontStack,
        fontSize: size * 0.46,
        lineHeight: 1,
      }}
    >
      {sticker.glyph}
    </span>
  );
}

type DragState = {
  sticker: Sticker;
  pointerId: number;
  /** Root relative, so the ghost and the drop point share one coordinate space. */
  x: number;
  y: number;
  size: number;
  rotation: number;
  source: { left: number; top: number; size: number };
};

export type StickerPlacement = {
  /** Where the sticker was let go, in the picker root's own coordinates. */
  x: number;
  y: number;
  /** The angle it was carrying, in degrees. */
  rotation: number;
  /** Its drawn size at the moment of the drop. */
  size: number;
};

export type StickerPickerProps = Omit<ComponentProps<"div">, "onSelect" | "children"> & {
  tabs?: StickerTab[];
  /** Controlled active tab id. */
  tab?: string;
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  /** Controlled search text. A non-empty query searches every tab, the way the field says it does. */
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  /** A tap, Enter or Space on a sticker. This is the path the keyboard has to the same result. */
  onSelect?: (sticker: Sticker) => void;
  /** A sticker dragged out of the sheet and let go. Pointer only; see the file comment. */
  onPlace?: (sticker: Sticker, placement: StickerPlacement) => void;
  /** Escape and a tap outside the sheet. */
  onDismiss?: () => void;
  /** False plays the exit and then calls `onExited`, so the caller can unmount the sheet. */
  open?: boolean;
  onExited?: () => void;
  /**
   * Seek whichever direction `open` selects to this fraction (0..1) instead of playing it, which is
   * what the harness does. A seeked exit poses the sheet and never reports through `onExited`, and it
   * turns the drag affordance off.
   */
  progress?: number;
  /** The sheet box. Defaults are the plus menu's measured one. */
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  /** The sheet's drag bar. */
  grabber?: boolean;
  /** False drops the search row and gives the grid its height. */
  search?: boolean;
  /** Accessible name for the sheet. */
  label?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
};

export function StickerPicker({
  tabs = stickerPickerTabs,
  tab: tabProp,
  defaultTab,
  onTabChange,
  query: queryProp,
  defaultQuery,
  onQueryChange,
  onSelect,
  onPlace,
  onDismiss,
  open = true,
  onExited,
  progress,
  left = stickerPickerMetrics.sheet.left,
  top = stickerPickerMetrics.sheet.top,
  width = stickerPickerMetrics.sheet.width,
  height = stickerPickerMetrics.sheet.height,
  grabber = true,
  search = true,
  label = "Stickers",
  searchPlaceholder = "Search",
  emptyLabel = "No Stickers",
  className,
  style,
  ...props
}: StickerPickerProps) {
  const m = stickerPickerMetrics;
  const id = useId();

  const [internalTab, setInternalTab] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const activeTabId = tabProp ?? internalTab;
  const [internalQuery, setInternalQuery] = useState(defaultQuery ?? "");
  const query = queryProp ?? internalQuery;

  const root = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);

  /**
   * The sheet outlives the `open` prop so the dismissal has frames to run in, and `closing` is derived
   * DURING RENDER rather than in an effect: an effect leaves one committed frame with the sheet
   * already gone and the exit never runs. Same rule as `ios-plus-menu.tsx`.
   */
  const [seenOpen, setSeenOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  if (seenOpen !== open) {
    setSeenOpen(open);
    setClosing(!open);
  }

  /**
   * The callback lives in a ref, not in the timeline effect's dependencies. A caller that passes an
   * inline arrow hands us a new identity on the render `onExited` itself causes, and a dependency on
   * it would tear the finished exit down and start it again from the top.
   */
  const exitedCallback = useRef(onExited);
  useEffect(() => {
    exitedCallback.current = onExited;
  });
  const reported = useRef(false);

  const activeTab = tabs.find(entry => entry.id === activeTabId) ?? tabs[0];
  const searching = query.trim().length > 0;
  const matches = useMemo(() => {
    if (!searching) return activeTab?.stickers ?? [];
    const needle = query.trim().toLowerCase();
    const seen = new Set<string>();
    const found: Sticker[] = [];
    for (const entry of tabs) {
      for (const sticker of entry.stickers) {
        if (seen.has(sticker.id)) continue;
        if (!`${sticker.label} ${sticker.keywords ?? ""}`.toLowerCase().includes(needle)) continue;
        seen.add(sticker.id);
        found.push(sticker);
      }
    }
    return found;
  }, [searching, query, tabs, activeTab]);

  const columns = searching ? m.grid.columns : (activeTab?.columns ?? (activeTab?.icon === "emoji" ? m.grid.emojiColumns : m.grid.columns));
  const tileSize = (width - 2 * m.grid.inset - (columns - 1) * m.grid.gap) / columns;

  const searchHeight = search ? m.search.top + m.search.rowHeight : 0;

  /**
   * One Web Animations timeline over the sheet's contents and its strip, run forwards or backwards.
   * Both keyframe sets are constants, so `document.getAnimations()` reaches them and a seeked frame is
   * a pure function of `progress`. The direction comes off `open`, which is a render value.
   */
  useEffect(() => {
    const sheetNode = sheet.current;
    const contentNode = content.current;
    const stripNode = strip.current;
    if (!sheetNode || !contentNode || !stripNode) return;
    if (open) reported.current = false;
    const isClosing = !open;
    const duration = isClosing ? m.timing.exit : m.timing.enter;
    const originX = m.origin.centerX - left;
    const originY = m.origin.centerY - top;
    // The contents grow out of the Stickers row's icon rather than out of the sheet's own centre.
    const away: Keyframe = { opacity: 0, transform: "scale(0.92)" };
    const settled: Keyframe = { opacity: 1, transform: "scale(1)" };
    const stripAway: Keyframe = { opacity: 0, transform: `translateY(${m.strip.height}px)` };
    const stripSettled: Keyframe = { opacity: 1, transform: "translateY(0px)" };
    const finish = () => {
      if (reported.current) return;
      reported.current = true;
      exitedCallback.current?.();
    };
    // Scrubbing is inspection, not a dismissal: a seeked exit poses the sheet and reports nothing.
    const reports = isClosing && progress === undefined;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    contentNode.style.transformOrigin = `${originX}px ${originY}px`;
    if (reduced) {
      if (!reports) return;
      const frame = requestAnimationFrame(finish);
      return () => cancelAnimationFrame(frame);
    }
    const easing = isClosing ? m.exitEasing : m.enterEasing;
    const options: KeyframeAnimationOptions = { duration, easing, fill: "both" };
    const fade: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
    const sheetAnimation = sheetNode.animate(isClosing ? [...fade].reverse() : fade, options);
    const contentAnimation = contentNode.animate(isClosing ? [settled, away] : [away, settled], options);
    const stripAnimation = stripNode.animate(isClosing ? [stripSettled, stripAway] : [stripAway, stripSettled], options);
    const animations = [sheetAnimation, contentAnimation, stripAnimation];
    if (progress !== undefined) {
      const time = clamp01(progress) * duration;
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = time;
      }
      return () => {
        for (const animation of animations) animation.cancel();
      };
    }
    if (!isClosing) {
      return () => {
        for (const animation of animations) animation.cancel();
      };
    }
    contentAnimation.addEventListener("finish", finish);
    return () => contentAnimation.removeEventListener("finish", finish);
  }, [open, progress, left, top, m.timing.enter, m.timing.exit, m.origin.centerX, m.origin.centerY, m.strip.height, m.enterEasing, m.exitEasing]);

  // Escape closes it, so the sheet never depends on a tap outside to get out of the way.
  useEffect(() => {
    if (!open || !onDismiss) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  const selectTab = useCallback(
    (next: string) => {
      if (tabProp === undefined) setInternalTab(next);
      onTabChange?.(next);
    },
    [tabProp, onTabChange],
  );

  const setQuery = useCallback(
    (next: string) => {
      if (queryProp === undefined) setInternalQuery(next);
      onQueryChange?.(next);
    },
    [queryProp, onQueryChange],
  );

  // One tab stop for the grid, arrows to move inside it, the way a native grid behaves. The roving
  // index is clamped during render, so a tab that shrinks under it cannot strand the tab stop.
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1));
  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" ? 1
      : event.key === "ArrowLeft" ? -1
      : event.key === "ArrowDown" ? columns
      : event.key === "ArrowUp" ? -columns
      : 0;
    let next = step ? activeIndex + step : activeIndex;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = matches.length - 1;
    if (!step && event.key !== "Home" && event.key !== "End") return;
    if (next < 0 || next >= matches.length) return;
    event.preventDefault();
    setActive(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus();
  };

  const onTabsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex(entry => entry.id === activeTabId);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    let next = step ? index + step : index;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (!step && event.key !== "Home" && event.key !== "End") return;
    if (next < 0 || next >= tabs.length) return;
    event.preventDefault();
    selectTab(tabs[next].id);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${tabs[next].id}"]`)?.focus();
  };

  /**
   * The drag affordance. Pointer only, and off while `progress` is scrubbing: a drag is an interaction
   * and would put a pointer's position into a frame the harness expects to be a pure function of one
   * scalar. Everything it can do, a tap can also do, so the keyboard loses nothing.
   */
  const [drag, setDrag] = useState<DragState | null>(null);
  const pending = useRef<{ sticker: Sticker; pointerId: number; startX: number; startY: number; source: DragState["source"] } | null>(null);
  const suppressClick = useRef(false);
  const ghost = useRef<HTMLDivElement>(null);
  const dragEnabled = progress === undefined && (onPlace !== undefined);

  const rootPoint = (clientX: number, clientY: number) => {
    const rect = root.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };

  const onTilePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, sticker: Sticker) => {
    // Cleared here, not after the click it suppresses: a drag that ends off the tile may never produce
    // a click at all, and a flag left standing would swallow the next real tap.
    suppressClick.current = false;
    if (!dragEnabled || event.button !== 0) return;
    const rect = root.current?.getBoundingClientRect();
    const tile = event.currentTarget.getBoundingClientRect();
    if (!rect) return;
    pending.current = {
      sticker,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      // The position comes off the live rect, the size off the layout. Lifting a tile mid-entrance
      // would otherwise scale the ghost by whatever the entrance had reached.
      source: { left: tile.left - rect.left, top: tile.top - rect.top, size: tileSize },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onTilePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pending.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const point = rootPoint(event.clientX, event.clientY);
    if (!drag) {
      const moved = Math.hypot(event.clientX - start.startX, event.clientY - start.startY);
      if (moved < m.drag.threshold) return;
      suppressClick.current = true;
      setDrag({
        sticker: start.sticker,
        pointerId: event.pointerId,
        x: point.x,
        y: point.y,
        size: start.source.size * m.drag.liftScale,
        rotation: stickerDragRotation(start.sticker.id),
        source: start.source,
      });
      return;
    }
    setDrag(current => (current ? { ...current, x: point.x, y: point.y } : current));
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pending.current;
    if (start && start.pointerId === event.pointerId) pending.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = rootPoint(event.clientX, event.clientY);
    const insideSheet =
      point.x >= left && point.x <= left + width && point.y >= top && point.y <= top + height;
    if (!insideSheet) {
      onPlace?.(drag.sticker, { x: point.x, y: point.y, rotation: drag.rotation, size: drag.size });
      setDrag(null);
      return;
    }
    // Let go over the sheet: the sticker goes home. A Web Animations run, so this is reachable through
    // `document.getAnimations()` like everything else that moves here.
    const node = ghost.current;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!node || reduced) {
      setDrag(null);
      return;
    }
    const home = drag.source;
    const animation = node.animate(
      [
        { transform: `translate(${drag.x - drag.size / 2}px, ${drag.y - drag.size / 2}px) rotate(${drag.rotation}deg) scale(1)` },
        { transform: `translate(${home.left}px, ${home.top}px) rotate(0deg) scale(${home.size / drag.size})` },
      ],
      { duration: m.timing.settle, easing: m.dragEasing, fill: "both" },
    );
    animation.addEventListener("finish", () => setDrag(null));
  };

  const alive = open || closing;

  return (
    <div
      ref={root}
      data-slot="sticker-picker"
      data-picker={id}
      data-state={open ? "open" : closing ? "closing" : "closed"}
      className={cn("absolute inset-0 z-20 select-none", vars, className)}
      style={{ fontFamily: fontStack, pointerEvents: "none", ...style }}
      {...props}
    >
      {/* A scrim, not a control: invisible, full screen, and both Escape and the caller's own close
          control do the same job, so it stays out of the tab order and the accessibility tree. */}
      {alive && onDismiss ? (
        <div aria-hidden="true" data-slot="dismiss" onClick={onDismiss} className="pointer-events-auto absolute inset-0 cursor-default" />
      ) : null}

      <div
        ref={sheet}
        data-slot="sheet"
        role="group"
        aria-label={label}
        // A closed sheet is not just invisible: `inert` takes its field, grid and tabs out of the tab
        // order and out of the accessibility tree, which `opacity: 0` on its own would not.
        inert={!open}
        className="pointer-events-auto absolute overflow-hidden"
        style={{
          left,
          top,
          width,
          height,
          borderRadius: m.sheet.radius,
          ...continuous,
          background: "rgb(var(--ios-sp-glass) / var(--ios-sp-alpha))",
          boxShadow: "0 5px 30px 6px rgb(0 0 0 / var(--ios-sp-shadow-alpha)), var(--ios-sp-rim)",
          backdropFilter: "blur(45px) saturate(1.9)",
          WebkitBackdropFilter: "blur(45px) saturate(1.9)",
        }}
      >
        <div ref={content} data-slot="sheet-content" className="absolute inset-0">
          {grabber ? (
            <span
              aria-hidden="true"
              data-slot="grabber"
              className="pointer-events-none absolute left-1/2 [background:rgba(0,0,0,0.3)] dark:[background:rgba(255,255,255,0.3)]"
              style={{
                top: m.grabber.top,
                width: m.grabber.width,
                height: m.grabber.height,
                marginLeft: -m.grabber.width / 2,
                borderRadius: m.grabber.radius,
              }}
            />
          ) : null}

          {search ? (
            <div data-slot="search-row" className="absolute flex items-center" style={{ left: m.grid.inset, right: m.grid.inset, top: m.search.top, height: m.search.rowHeight }}>
              <div
                className="relative w-full"
                style={{ height: m.search.fieldHeight, borderRadius: m.search.radius, background: "var(--ios-sp-field)" }}
              >
                <span aria-hidden="true" className="pointer-events-none absolute flex" style={{ left: 10, top: (m.search.fieldHeight - 18.6667 * m.search.glyphScale) / 2 }}>
                  <SearchGlyph scale={m.search.glyphScale} />
                </span>
                <input
                  type="search"
                  data-slot="search-field"
                  aria-label={`Search ${label}`}
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  className="size-full bg-transparent outline-none placeholder:[color:var(--ios-sp-muted)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff] [&::-webkit-search-cancel-button]:appearance-none"
                  style={{
                    paddingLeft: m.search.textInset,
                    paddingRight: 10,
                    borderRadius: m.search.radius,
                    fontSize: m.search.fontSize,
                    fontWeight: m.search.weight,
                    letterSpacing: 0,
                    color: "var(--ios-sp-label)",
                  }}
                />
              </div>
            </div>
          ) : null}

          <div
            data-slot="grid-scroller"
            className="absolute overflow-y-auto overflow-x-hidden [overscroll-behavior:contain]"
            style={{ left: 0, right: 0, top: searchHeight, bottom: m.strip.height, padding: m.grid.inset }}
          >
            {matches.length === 0 ? (
              <p data-slot="empty" className="w-full text-center" style={{ marginTop: 48, fontSize: 15, color: "var(--ios-sp-muted)" }}>
                {emptyLabel}
              </p>
            ) : (
              <div
                data-slot="grid"
                role="group"
                aria-label={searching ? `${label} results` : activeTab?.label ?? label}
                onKeyDown={onGridKeyDown}
                className="grid"
                style={{ gridTemplateColumns: `repeat(${columns}, ${tileSize}px)`, gap: m.grid.gap }}
              >
                {matches.map((sticker, index) => (
                  <button
                    key={sticker.id}
                    type="button"
                    data-slot="sticker"
                    data-index={index}
                    data-sticker={sticker.id}
                    data-dragging={drag?.sticker.id === sticker.id ? "true" : undefined}
                    aria-label={sticker.label}
                    tabIndex={index === activeIndex ? 0 : -1}
                    onFocus={() => setActive(index)}
                    onPointerDown={event => onTilePointerDown(event, sticker)}
                    onPointerMove={onTilePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onClick={() => {
                      if (suppressClick.current) {
                        suppressClick.current = false;
                        return;
                      }
                      onSelect?.(sticker);
                    }}
                    className="block touch-none p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff]"
                    style={{ width: tileSize, height: tileSize, opacity: drag?.sticker.id === sticker.id ? 0 : undefined }}
                  >
                    <StickerArt sticker={sticker} size={tileSize} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            ref={strip}
            data-slot="tab-strip"
            role="tablist"
            aria-label={`${label} categories`}
            aria-orientation="horizontal"
            onKeyDown={onTabsKeyDown}
            className="absolute bottom-0 left-0 flex w-full items-stretch overflow-x-auto"
            style={{
              height: m.strip.height,
              paddingLeft: m.strip.gutter,
              paddingRight: m.strip.gutter,
              gap: m.strip.spacing,
              boxShadow: `inset 0 ${m.strip.hairline}px 0 0 var(--ios-sp-separator)`,
            }}
          >
            {tabs.map(entry => {
              const selected = entry.id === activeTabId;
              return (
                <Fragment key={entry.id}>
                  {entry.separatorBefore ? (
                    <span aria-hidden="true" data-slot="tab-separator" className="block shrink-0 self-center" style={{ width: m.strip.separatorWidth, height: m.strip.itemHeight, background: "var(--ios-sp-separator)" }} />
                  ) : null}
                  <button
                    type="button"
                    role="tab"
                    data-slot="tab"
                    data-tab={entry.id}
                    aria-selected={selected}
                    aria-label={entry.label}
                    tabIndex={entry.id === activeTabId ? 0 : -1}
                    onClick={() => {
                      selectTab(entry.id);
                      setQuery("");
                    }}
                    className="flex shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff]"
                    style={{
                      width: m.strip.itemWidth,
                      height: m.strip.itemHeight,
                      borderRadius: m.grid.tileRadius,
                      ...continuous,
                      // The selection sits inside the item box, so the strip's own 38 pitch is intact.
                      background: selected ? "var(--ios-sp-tab-selected)" : "transparent",
                      backgroundClip: "padding-box",
                      padding: m.strip.selectionInset,
                      color: selected ? "var(--ios-sp-label)" : "var(--ios-sp-muted)",
                    }}
                  >
                    <TabGlyph icon={entry.icon} size={m.strip.iconSize} />
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/*
        The lifted sticker. It lives outside the sheet so it can be carried over the transcript, and it
        is inert to the accessibility tree: the button it came from still carries the name, and letting
        go over the transcript reaches the same handler a tap does.
      */}
      {drag ? (
        <div
          ref={ghost}
          aria-hidden="true"
          data-slot="drag-ghost"
          className="pointer-events-none absolute left-0 top-0"
          style={{
            width: drag.size,
            height: drag.size,
            transform: `translate(${drag.x - drag.size / 2}px, ${drag.y - drag.size / 2}px) rotate(${drag.rotation}deg)`,
            filter: `drop-shadow(0 ${m.drag.shadowLift}px ${m.drag.shadowBlur}px var(--ios-sp-ghost-shadow))`,
          }}
        >
          <StickerArt sticker={drag.sticker} size={drag.size} />
        </div>
      ) : null}
    </div>
  );
}
