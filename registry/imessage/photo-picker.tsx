"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import { fontStack } from "@/registry/imessage/tokens";

/**
 * The Photos picker iOS 26 opens inside the Messages composer.
 *
 * ## Provenance, in the order this repo prefers it
 *
 * **1. Measured, from `references/ios/captures/photo-picker-light.png`** (iOS 26.0, iPhone 17 Pro,
 * 402x874 pt at 3x). Device pixels are quoted wherever the point value is a third.
 *
 * A white panel, inset **5.3333 (16 px)** from the screen's left, right and bottom edges, holding a
 * three-column grid of thumbnails flush to its own left, right and top edges. Over the middle of the
 * first row sits a drag grabber. That is the whole of what the capture shows: **no header, no title,
 * no "Recents" label, no Albums button, no camera tile, no search field, no send or count button,
 * and no selection badge on any tile.** The last one is a measurement in its own right and this file
 * relies on it: an unselected tile in this picker carries no empty ring, unlike the Photos app's
 * select mode, so the badge is only ever drawn on a selected tile.
 *
 * The capture shows two rows with empty white under them. That is the library, not the layout: the
 * simulator ships six sample photos. The grid scrolls vertically; at this panel height a third row
 * would be visible for 121.3 of its 129.56.
 *
 * | Part | Value | How |
 * |---|---|---|
 * | Inset (left, right, bottom) | 5.3333 (16 px) | white run x 16-1189, bottom-most white row 2605 of 2622 |
 * | Width at a 402 screen | 391.3333 | 1174 px |
 * | Top / height in the capture | 485 / 383.6667 | grid top 1455 px, panel bottom 2606 px |
 * | Fill | `#ffffff` | flat, sampled all over the empty area below the grid |
 * | Top corners | superellipse n 2.204, R **39.0** (rms 0.84 px) | 109 sub-pixel boundary points, top-right |
 * | Bottom corners | superellipse n 2.204, R **57.5833** (rms 0.90 px) | 183 points, bottom-left |
 * | Shadow / dim | none | the blurred backdrop reads a flat 244-246 right up to the panel edge |
 * | Grid gap | 1.6207 (4.862 px) | three independent seam fits: 4.870, 4.859 across, 4.858 down |
 * | Tile | 129.364 x 129.5633 | columns average 388.09 device px, rows 388.69 |
 * | Tile corner | **2.3** | see below |
 * | Grabber | **35 x 4.6667**, top **5.0**, centred | see below |
 * | Composer above it | field bottom 463.6667, so 21.3333 of backdrop above the panel | the composer stays *full*: `+`, "iMessage" and the mic are all still drawn, unlike the plus-menu state |
 *
 * The plain circle is fitted separately, because it is what the panel actually renders (see the
 * clip-path note in the panel's own style): **36.1667** top (rms 0.94 px) and **53.5** bottom (rms
 * 1.27 px). The bottom corner is the device's own corner made concentric with the panel: 57.58 + 5.33
 * = 62.9, the iPhone 17 Pro display radius.
 *
 * **The grabber, re-measured.** A 2D area fit over 2640 pixels of the capture (a rounded rect whose
 * five parameters are solved at once against the sub-pixel coverage, with the local background
 * modelled per column between the clean rows above and below the pill) puts it at
 * **105.000 x 14.000 device px**, its top **15.000 px** below the panel top, centred on x 603.000
 * against a panel centre of 603.000, rms 0.028 of coverage. That is 35 x 4.6667 at top 5.0. The
 * width and the height hold at exactly 105.000 and 14.000 whatever corner radius the fit is given,
 * and rows 1469 and 1484 carry *zero* ink at every x sampled, so there is no anti-aliased rim to
 * subtract: the pill is 14 device px tall, not 15. The corner is shallow to fit (rms 0.0255 at 6.4
 * device px, 0.0307 at 7.0); a capsule, radius = height / 2 = 2.3333, sits in that band and is what
 * the framework draws, so that is what this file uses.
 *
 * This supersedes the `-[_UIGrabber intrinsicContentSize]` value of `{36, 5}` that this file and
 * `sticker-picker.tsx` used to carry. A Catalyst probe confirms the framework number is real -
 * `_UIGrabber` is 36 x 5 at `cornerRadius` 2.5 with two full-bleed subviews that inset nothing, and
 * `-[CKAppGrabberView layoutSubviews]` places one at **y 5.0**, horizontally centred, in a
 * 391.3333-wide header - so the *top* agrees with the capture exactly. The size does not: 36 x 5 at
 * 3x is 108 x 15 device px against a measured 105 x 14, and 105/108 = 0.972 while 14/15 = 0.933, so
 * it is not a scaled `_UIGrabber` either. Per this repo's rule the capture wins.
 *
 * **The tile corner, re-measured.** Nine tile corners that meet clean white (the bottom row's
 * bottom edges and both sides of every gap junction) were each fitted with the same 2D coverage
 * model, taking the photo colour from a plane fitted to the tile's own interior. sRGB blending fits
 * better than linear (mean rms 0.168 against 0.207), and the nine circles come out 6.55 to 7.97
 * device px: median 6.87, rms-weighted mean 6.94. So **2.3** (6.9 device px), with a spread of about
 * +/-0.2 pt corner to corner. The 2.1 this file used to carry sits under the whole cluster, and the
 * **12** `SPEC.md` line 164 still records is 36 device px against a measured 6.9 - off by a factor
 * of five, and copied from there into `group-details.tsx` and `ios-details.tsx`.
 *
 * **2. From the frameworks**, by the Catalyst probe this repo uses elsewhere: `clang -target
 * arm64-apple-ios26.0-macabi`, dlopen
 * `/System/iOSSupport/System/Library/PrivateFrameworks/PhotosUICore.framework/PhotosUICore`, swizzle
 * `-[UIDevice userInterfaceIdiom]` to Phone.
 *
 * | Value | Where |
 * |---|---|
 * | selection badge box **26 x 26** | `+[PXSelectionBadgeUIViewTile preferredSize]` |
 * | badge **3.5** trailing and **3.5** bottom inside the cell | `-[PUPhotosGridCell layoutSubviews]` at a 129.364 x 129.5633 cell: badge frame `{99.864, 100.0633, 26, 26}` |
 * | badge ink **O 22.0**, white rim **1.5449**, blue disc **O 18.9102**, fill **#0088ff** | the badge is a `UIImage`, and its `CGImage` is 52 x 52 at scale 2, so it is read at that native size rather than upscaled. The alpha edge is hard: the disc spans exactly 44 of the 52 px in both axes and in both centre rows and columns. The rim integrates to 3.0898 px of white coverage inward from that edge; the blue is exactly `rgb(0 136 255)`, the kit's measured iOS blue |
 * | check stroke **1.4248**, vertices (-4.408, 0.941) (-1.334, 4.670) (3.957, -3.645) from the badge centre | a seven-parameter least-squares fit of a round-capped, round-joined polyline against the white coverage of 928 pixels of that same native image, supersampled 8 x 8: rms 0.0125 of coverage |
 *
 * Because the badge sits 3.5 inside a 26 box whose ink is 22, the visible disc is **5.5** from the
 * tile's trailing and bottom edges, which is what `badge.inset` records.
 *
 * The search row, if the expanded detent draws one, reuses `sticker-picker.tsx`'s framework numbers
 * (row 44, field 34, SF Medium 17, `tertiarySystemFill`), which this file's own probe re-read:
 * `+[UIColor tertiarySystemFillColor]` is `rgb(118 118 128 / 0.12)` light and `/ 0.24` dark.
 *
 * **3. Not measured, and not measurable from here.** Everything in this group is marked
 * `@unverified` on the metric that carries it and is listed in the component's return.
 *
 * - **The dark palette.** No dark capture of this surface exists, and the Catalyst probe cannot
 *   stand in for one: under Catalyst the colour catalog is the *macOS* one whatever the idiom trait
 *   says. `+[UIColor systemBackgroundColor]` resolves dark to `#1e1e1e` (iOS is `#000000`) and
 *   `secondarySystemBackgroundColor` resolves light to `#ececec` (iOS is `#f2f2f7`), so a dark value
 *   read that way would be a macOS value wearing an iOS label. The panel is `#ffffff` in light,
 *   which is `systemBackground` and `secondarySystemGroupedBackground` alike, and those two part
 *   company in dark (`#000000` against `#1c1c1e`) - so even the *right* token is undecided. The dark
 *   set below is a guess and says so.
 * - **Both easing curves and both durations.** 380 ms open and 220 ms exit are borrowed from the
 *   long-press menu's measured pair, the same borrow `ios-plus-menu.tsx` and `sticker-picker.tsx`
 *   make; the curves are invented. Nothing in `references/` records this panel moving. The panel
 *   translates and does **not** fade: the away pose clears the screen on its own (`height + inset`,
 *   so the panel top lands exactly on the screen's bottom edge), which is what an iOS sheet does,
 *   and the fade this file used to run was covering an away pose that left 5.3 pt on screen.
 * - **The expanded detent and everything in it**: its height, the header, the "Recents" title, the
 *   Albums button and the search row's placement. The capture is of the collapsed detent and shows
 *   none of them, so this is a missing *state*, not a wrong pixel. The drag itself, its 24 pt handle
 *   strip and the halfway snap are judgement too.
 * - **The composer attachment chip** (`PhotoPickerAttachments`). No capture in either directory
 *   shows a selection sitting in the composer, and no ChatKit metric describes it -
 *   `-[CKUIBehaviorPhone entryViewAttachmentHorizontalOffset]` is -5 and the vertical one is 0,
 *   which places something without sizing it. Every number on the chip is invented.
 * - **The ordered badge's number**, and the 150 ms the badge scales in over.
 */
export const photoPickerMetrics = {
  /** The screen the numbers were measured on. Points equal CSS px. */
  screen: { width: 402, height: 874 },
  /** Left, right and bottom inset from the screen edge (16 device px at 3x). */
  inset: 5.3333,
  /** Where the panel's top edge falls in the capture, and how tall it is there. */
  top: 485,
  height: 383.6667,
  width: 391.3333,
  /**
   * `topRadius` and `bottomRadius` are the continuous corner the capture actually draws. `round*` is
   * the best plain circle for the same arc, and it is what the panel renders: see the clip-path note
   * on the panel for why the shape gives way to sub-pixel edges here.
   */
  topRadius: 39,
  bottomRadius: 57.5833,
  roundTopRadius: 36.1667,
  roundBottomRadius: 53.5,
  columns: 3,
  gap: 1.6207,
  /** Implied by width, columns and gap; quoted because the capture measures it directly. */
  tileWidth: 129.364,
  /**
   * Tiles are not quite square in the capture, and both axes are measured over 100+ boundary points:
   * columns average 388.09 device px, rows 388.69. `tileAspect` is that ratio, so a second row lands
   * on the measured 2237.24 instead of 1.2 px above it.
   */
  tileHeight: 129.5633,
  tileAspect: 129.364 / 129.5633,
  /** Median of nine 2D corner fits (6.55-7.97 device px, median 6.87, weighted mean 6.94). */
  tileRadius: 2.3,
  /**
   * 2D area fit over 2640 capture pixels: 105.000 x 14.000 device px at top 15.000, centred.
   * `radius` is the capsule the shallow corner fit brackets (6.4-7.0 device px).
   */
  grabber: { width: 35, height: 4.6667, radius: 2.3333, top: 5 },
  /**
   * `box`, `inset`, `size`, `rim` and `checkStroke` come from PhotosUICore through a Catalyst probe,
   * not from a capture: the 26 pt box is `+[PXSelectionBadgeUIViewTile preferredSize]`, the 3.5 pt
   * cell inset is `-[PUPhotosGridCell layoutSubviews]`, and the ink is measured off the badge's own
   * `UIImage` at its native 52 x 52 at scale 2. `inset` is the visible disc's distance from the tile
   * edge: the 3.5 pt frame inset plus the 2 pt margin the 22 pt ink leaves inside a 26 pt box.
   * @unverified fontSize - nothing shows a numbered badge in this picker.
   */
  badge: { box: 26, size: 22, inset: 5.5, rim: 1.5449, checkStroke: 1.4248, fill: "#0088ff", fontSize: 13 },
  /**
   * Where the panel sits relative to the composer in the capture, which nothing else records: the
   * composer's field ends at 463.6667 and the panel starts at 485, and the composer keeps its `+`,
   * its "iMessage" placeholder and its mic (the plus-menu state, SPEC.md line 162, collapses it to
   * mic-only; this one does not).
   */
  composer: { fieldBottom: 463.6667, gap: 21.3333 },
  /**
   * `collapsed` is the capture's own height. `expanded` is chosen so the panel's top lands on 165,
   * clear of the nav bar (whose name pill ends at 148.33), and `handle` is a touch-sized strip.
   * @unverified expanded, handle
   */
  detents: { collapsed: 383.6667, expanded: 703.6667, handle: 24 },
  /**
   * The expanded detent's header. Every number here is judgement except the search row, which is
   * `sticker-picker.tsx`'s framework pair (`-[UISearchBar sizeThatFits:]` 44 and
   * `-[UISearchTextField sizeThatFits:]` 34) at SF Medium 17.
   * @unverified everything except rowHeight and fieldHeight
   */
  header: { titleTop: 16, titleSize: 17, actionSize: 17, searchTop: 8, rowHeight: 44, fieldHeight: 34, fieldRadius: 17, fieldSize: 17, inset: 12, bottom: 8 },
  /**
   * @unverified enter and exit are the long-press menu's measured 380 / 220, borrowed; `badge` and
   * `detent` are invented, and so are both easing curves below.
   */
  timing: { enter: 380, exit: 220, badge: 150, detent: 320 },
  /** @unverified invented outright; no recording of this panel moving exists. */
  easing: { enter: "cubic-bezier(0.32, 0.72, 0, 1)", exit: "cubic-bezier(0.4, 0, 1, 1)" },
} as const;

/**
 * Light values are measured off the capture, except the two `tertiarySystemFill` alphas, which are
 * `+[UIColor tertiarySystemFillColor]` read in both styles (that family does come back with the iOS
 * values under Catalyst). The dark panel, tile and grabber are unverified: see the file comment for
 * why the probe cannot settle them. They are custom properties so a `.dark` ancestor flips the panel
 * without the caller passing anything.
 */
const vars =
  "[--ios-pp-panel:#ffffff] [--ios-pp-grabber:rgba(0,0,0,0.3)] [--ios-pp-tile:#e9e9eb] [--ios-pp-badge:#0088ff] [--ios-pp-glyph:#ffffff] [--ios-pp-label:#000000] [--ios-pp-muted:#8a8a8e] [--ios-pp-field:rgba(118,118,128,0.12)] " +
  "dark:[--ios-pp-panel:#1c1c1e] dark:[--ios-pp-grabber:rgba(255,255,255,0.3)] dark:[--ios-pp-tile:#2c2c2e] dark:[--ios-pp-badge:#0088ff] dark:[--ios-pp-glyph:#ffffff] dark:[--ios-pp-label:#f4f3f4] dark:[--ios-pp-muted:#97979d] dark:[--ios-pp-field:rgba(118,118,128,0.24)]";

/** Keeps a hidden string in the accessible name without depending on the consumer's utility classes. */
const offscreen: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

export type PhotoPickerPhoto = {
  /** Stable identity for selection. Falls back to the index. */
  id?: string;
  /** A URL, or nothing for a solid `fill`. The registry itself ships no photographs. */
  src?: string;
  alt?: string;
  /** Any CSS background, used when there is no `src` and when a `src` fails to load. */
  fill?: string;
};

/** Which of the two heights the panel is resting at. */
export type PhotoPickerDetent = "collapsed" | "expanded";

/**
 * Placeholder tiles in the tonal range of the capture's landscapes, so the geometry can be reviewed
 * without shipping anyone's photographs in a registry item.
 */
export const photoPickerSamples: PhotoPickerPhoto[] = [
  { id: "bloom", fill: "linear-gradient(160deg, #c8175f 0%, #e8408a 45%, #7a8f2e 100%)" },
  { id: "falls", fill: "linear-gradient(180deg, #8fa2ad 0%, #4e6b5a 55%, #26361f 100%)" },
  { id: "cascade", fill: "linear-gradient(200deg, #8d9aa1 0%, #55605c 50%, #2a3128 100%)" },
  { id: "canyon", fill: "linear-gradient(170deg, #9fb0b8 0%, #5c7a5f 45%, #2c3a24 100%)" },
  { id: "dune", fill: "linear-gradient(190deg, #b7c9cf 0%, #7f9a63 55%, #b52f57 100%)" },
  { id: "leaf", fill: "linear-gradient(150deg, #7fa04a 0%, #3f5c25 60%, #d9c02f 100%)" },
];

export type PhotoPickerProps = Omit<ComponentProps<"div">, "onSelect" | "children"> & {
  photos?: PhotoPickerPhoto[];
  /** Controlled selection, as photo ids, in the order they were picked. */
  selected?: string[];
  defaultSelected?: string[];
  /** Fires with the whole selection, plus the photo that just changed and its new state. */
  onSelectionChange?: (selected: string[], photo: PhotoPickerPhoto, isSelected: boolean) => void;
  /** False keeps one tile chosen at a time. */
  multiple?: boolean;
  /** Number the badges in pick order, the way an ordered multi-select does. */
  ordered?: boolean;
  columns?: number;
  /** Panel box. Defaults are the capture's; the tile size follows from `width`, `columns` and the gap. */
  width?: number;
  height?: number;
  inset?: number;
  /** The taller detent's height. Unmeasured: see the file comment. */
  expandedHeight?: number;
  /** Controlled detent. Uncontrolled unless this is passed. */
  detent?: PhotoPickerDetent;
  defaultDetent?: PhotoPickerDetent;
  onDetentChange?: (detent: PhotoPickerDetent) => void;
  /** False takes the grabber away, and with it the drag between detents. */
  grabber?: boolean;
  /** The expanded detent's header: the title, the trailing action and the search row. */
  title?: string;
  albumsLabel?: string;
  onAlbums?: () => void;
  search?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** False plays the exit timeline and then calls `onExited`. */
  open?: boolean;
  onExited?: () => void;
  /**
   * Seek whichever direction `open` selects to this fraction (0..1) instead of playing it, which is
   * what the harness does. A seeked exit poses the panel and never reports through `onExited`.
   */
  progress?: number;
  /** Accessible name for the grid. */
  label?: string;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const idOf = (photo: PhotoPickerPhoto, index: number) => photo.id ?? String(index);

/**
 * The badge PhotosUICore draws on a selected tile: a blue disc inside a white rim, with a white
 * check. Every number is the 12x render of `+[PXSelectionBadgeUIViewTile preferredSize]`'s own
 * image, measured in the file comment; the view box is the badge's ink, so the caller only has to
 * place a square.
 */
export function PhotoPickerSelectionBadge({ size = photoPickerMetrics.badge.size }: { size?: number }) {
  const m = photoPickerMetrics.badge;
  const r = m.size / 2;
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${m.size} ${m.size}`} fill="none">
      {/* The disc runs under the rim's inner half so the two cannot leave an anti-aliased seam. */}
      <circle cx={r} cy={r} r={r - m.rim / 2} fill="var(--ios-pp-badge)" />
      <circle cx={r} cy={r} r={r - m.rim / 2} stroke="var(--ios-pp-glyph)" strokeWidth={m.rim} />
      {/* Centreline of the framework's own check, moved from badge-centre coordinates into the box. */}
      <path
        d={`M${r - 4.408} ${r + 0.941}L${r - 1.334} ${r + 4.67}L${r + 3.957} ${r - 3.645}`}
        stroke="var(--ios-pp-glyph)"
        strokeWidth={m.checkStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The magnifier traced for the conversation list's search pill, at 0.72 of the size it is drawn there. */
function SearchGlyph({ scale = 0.72 }: { scale?: number }) {
  return (
    <svg aria-hidden="true" width={18.3333 * scale} height={18.6667 * scale} viewBox="-1 -1 18.3333 18.6667" fill="none" stroke="var(--ios-pp-muted)" strokeLinecap="round">
      <circle cx="6.745" cy="7.219" r="5.883" strokeWidth="1.725" />
      <path d="M11.4 12.01 15.17 15.78" strokeWidth="2.467" />
    </svg>
  );
}

export function PhotoPicker({
  photos = photoPickerSamples,
  selected: selectedProp,
  defaultSelected,
  onSelectionChange,
  multiple = true,
  ordered = false,
  columns = photoPickerMetrics.columns,
  width = photoPickerMetrics.width,
  height = photoPickerMetrics.height,
  inset = photoPickerMetrics.inset,
  expandedHeight = photoPickerMetrics.detents.expanded,
  detent: detentProp,
  defaultDetent = "collapsed",
  onDetentChange,
  grabber = true,
  title = "Recents",
  albumsLabel = "Albums",
  onAlbums,
  search = true,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search",
  open = true,
  onExited,
  progress,
  label = "Recent photos",
  className,
  style,
  ...props
}: PhotoPickerProps) {
  const m = photoPickerMetrics;
  const [internal, setInternal] = useState<string[]>(defaultSelected ?? []);
  const selected = selectedProp ?? internal;
  const [internalDetent, setInternalDetent] = useState<PhotoPickerDetent>(defaultDetent);
  const detent = detentProp ?? internalDetent;
  const [active, setActive] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  /** Live drag, or null. `from` is the height the drag started at, so the pose is pure arithmetic. */
  const [drag, setDrag] = useState<{ pointer: number; startY: number; from: number; y: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const exited = useRef(false);
  /** Set by the arrow keys, consumed after the render that puts the tile in the window. */
  const pendingFocus = useRef<number | null>(null);
  /**
   * The callback lives in a ref, not in the timeline effect's dependencies. A caller that passes an
   * inline arrow hands us a new identity on the render `onExited` itself causes, and a dependency on
   * it would tear the finished exit down and start it again from the top.
   */
  const exitedCallback = useRef(onExited);
  /**
   * How far the exit has to travel, kept in a ref rather than in the timeline's dependencies. A
   * detent change moves it, and a dependency on it would replay the entrance on a panel that is
   * already open.
   */
  const awayDistance = useRef(0);

  const collapsedHeight = height;
  /**
   * The panel's height is derived during render, never stored: at rest it is the detent's, and under
   * a finger it is the drag's own arithmetic. Nothing has to be cleaned up when the drag ends.
   */
  const restHeight = detent === "expanded" ? expandedHeight : collapsedHeight;
  const panelHeight = drag
    ? Math.max(collapsedHeight, Math.min(expandedHeight, drag.from + (drag.startY - drag.y)))
    : restHeight;
  useEffect(() => {
    exitedCallback.current = onExited;
    awayDistance.current = restHeight + inset;
  });

  const setDetent = useCallback(
    (next: PhotoPickerDetent) => {
      if (detentProp === undefined) setInternalDetent(next);
      if (next !== detent) onDetentChange?.(next);
    },
    [detent, detentProp, onDetentChange],
  );

  const toggle = useCallback(
    (photo: PhotoPickerPhoto, id: string) => {
      const isSelected = selected.includes(id);
      const next = isSelected
        ? selected.filter(entry => entry !== id)
        : multiple
          ? [...selected, id]
          : [id];
      if (selectedProp === undefined) setInternal(next);
      onSelectionChange?.(next, photo, !isSelected);
    },
    [selected, selectedProp, multiple, onSelectionChange],
  );

  /**
   * The row height comes from the tile's own measured aspect, not from `aspect-square`: the capture's
   * rows really are 0.6 device px taller than its columns are wide.
   */
  const gap = m.gap;
  const tileWidth = (width - (columns - 1) * gap) / columns;
  const tileHeight = tileWidth / m.tileAspect;
  // Guarded: a caller that hands the panel a zero width would otherwise divide by zero windowing it.
  const stride = Math.max(1, tileHeight + gap);

  /**
   * Identity and accessible name are fixed against the *unfiltered* library, so a search cannot
   * renumber "Photo 3" or move a selection onto a different tile.
   */
  const items = photos.map((photo, index) => ({ photo, id: idOf(photo, index), name: photo.alt ?? `Photo ${index + 1}` }));
  const text = searchValue ?? query;
  const needle = text.trim().toLowerCase();
  const filtered = needle ? items.filter(item => item.name.toLowerCase().includes(needle)) : items;
  // Header visibility follows the detent, not the live drag: revealing it mid-drag would jump the
  // grid the moment the finger moved a pixel.
  const expanded = detent === "expanded";
  const headerHeight = expanded
    ? m.header.titleTop + m.header.rowHeight + (search ? m.header.searchTop + m.header.rowHeight : 0) + m.header.bottom
    : 0;

  /**
   * One tab stop for the whole grid, arrows to move inside it, the way a native grid behaves. The
   * roving index is clamped during render, so a library that shrinks under it cannot strand the tab
   * stop on a tile that is gone.
   */
  const activeIndex = Math.min(active, Math.max(0, filtered.length - 1));
  const rows = Math.ceil(filtered.length / columns);
  const viewport = Math.max(0, panelHeight - headerHeight);
  /**
   * Windowed, because a real library is thousands of tiles and every one of them would otherwise
   * carry an `<img>`. Two rows of overscan on each side, and the active row is always in range so
   * the keyboard can reach a tile that has scrolled away.
   */
  const firstRow = Math.max(0, Math.floor(scrollTop / stride) - 2);
  const lastRow = Math.min(rows - 1, Math.ceil((scrollTop + viewport) / stride) + 1);
  const visible = filtered.slice(firstRow * columns, (lastRow + 1) * columns);
  /**
   * The roving tab stop has to be a tile that exists. Scrolling the active tile out of the window
   * moves the stop to the first tile still drawn; focusing that one puts `active` back on it, so the
   * arrows carry on from wherever the eye is.
   */
  const tabStop = activeIndex >= firstRow * columns && activeIndex <= lastRow * columns + columns - 1
    ? activeIndex
    : firstRow * columns;

  useEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    pendingFocus.current = null;
    scroller.current?.querySelector<HTMLButtonElement>(`[data-index="${index}"]`)?.focus();
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Arrows only steer the grid from inside it. Focused on the scroller itself they scroll it,
    // which is the only way a keyboard reaches a row that is not next to the roving tile.
    if (event.target === event.currentTarget) return;
    const step =
      event.key === "ArrowRight" ? 1
      : event.key === "ArrowLeft" ? -1
      : event.key === "ArrowDown" ? columns
      : event.key === "ArrowUp" ? -columns
      : 0;
    let next = step ? activeIndex + step : activeIndex;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = filtered.length - 1;
    if (!step && event.key !== "Home" && event.key !== "End") return;
    if (next < 0 || next >= filtered.length) return;
    event.preventDefault();
    // Scroll first, so the row the focus is about to land on is inside the window this render draws.
    const node = scroller.current;
    if (node) {
      const row = Math.floor(next / columns);
      const top = row * stride;
      const bottom = top + tileHeight;
      let target = node.scrollTop;
      if (top < target) target = top;
      else if (bottom > target + node.clientHeight) target = bottom - node.clientHeight;
      if (target !== node.scrollTop) {
        node.scrollTop = target;
        setScrollTop(target);
      }
    }
    setActive(next);
    pendingFocus.current = next;
  };

  /**
   * The drag between detents. The pose is derived from `drag` during render; the pointer handlers
   * only record where the finger is, and the release picks the nearer detent.
   */
  const onHandleDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!grabber || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ pointer: event.pointerId, startY: event.clientY, from: restHeight, y: event.clientY });
  };
  const onHandleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    setDrag({ ...drag, y: event.clientY });
  };
  const onHandleUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const settled = drag.from + (drag.startY - drag.y);
    const midpoint = (collapsedHeight + expandedHeight) / 2;
    setDrag(null);
    setDetent(settled > midpoint ? "expanded" : "collapsed");
  };

  /**
   * One Web Animations timeline, run forwards or backwards, so `document.getAnimations()` reaches it
   * and `progress` can pause and seek either direction to a frame that renders identically every run.
   * Which direction it runs is read off the `open` prop during render, so the closing pose gets its
   * committed frames before `onExited` lets the caller unmount anything.
   *
   * The away pose is `height + inset`, not `height`: the panel is positioned by its bottom, so
   * translating it by its own height alone leaves the inset on screen.
   */
  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    // Reopening arms the exit again, so a panel that opens and closes twice reports twice.
    if (open) exited.current = false;
    const closing = !open;
    const duration = closing ? m.timing.exit : m.timing.enter;
    const away = { transform: `translateY(${awayDistance.current}px)` };
    const settled = { transform: "translateY(0px)" };
    const finish = () => {
      if (exited.current) return;
      exited.current = true;
      exitedCallback.current?.();
    };
    // Scrubbing is inspection, not a dismissal: a seeked exit poses the panel and reports nothing.
    const reports = closing && progress === undefined;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      if (!reports) return;
      const frame = requestAnimationFrame(finish);
      return () => cancelAnimationFrame(frame);
    }
    const animation = node.animate(closing ? [settled, away] : [away, settled], {
      duration,
      easing: closing ? m.easing.exit : m.easing.enter,
      fill: "both",
    });
    if (progress !== undefined) {
      animation.pause();
      animation.currentTime = clamp01(progress) * duration;
      return () => animation.cancel();
    }
    if (!closing) return () => animation.cancel();
    animation.addEventListener("finish", finish);
    return () => animation.removeEventListener("finish", finish);
  }, [open, progress, m.timing.enter, m.timing.exit, m.easing.enter, m.easing.exit]);

  const field = (
    <div
      className="relative flex items-center"
      style={{ height: m.header.fieldHeight, borderRadius: m.header.fieldRadius, background: "var(--ios-pp-field)" }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute flex" style={{ left: 10, top: (m.header.fieldHeight - 18.6667 * 0.72) / 2 }}>
        <SearchGlyph />
      </span>
      <input
        type="search"
        data-slot="photo-picker-search"
        value={text}
        placeholder={searchPlaceholder}
        onChange={event => {
          if (searchValue === undefined) setQuery(event.target.value);
          onSearchChange?.(event.target.value);
        }}
        className="size-full bg-transparent outline-none placeholder:[color:var(--ios-pp-muted)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff] [&::-webkit-search-cancel-button]:appearance-none"
        style={{ paddingLeft: 34, paddingRight: 12, borderRadius: m.header.fieldRadius, fontSize: m.header.fieldSize, fontWeight: 500, color: "var(--ios-pp-label)" }}
      />
    </div>
  );

  return (
    <div
      ref={panel}
      data-slot="photo-picker"
      data-state={open ? "open" : "closed"}
      data-detent={detent}
      data-dragging={drag ? "true" : "false"}
      className={cn("ios-photo-picker absolute", vars, className)}
      style={{
        // Left plus width, never left plus right: two fractional insets resolve independently and the
        // panel ends up a device pixel wider than the capture's 1174.
        left: inset,
        bottom: inset,
        width,
        height: panelHeight,
        background: "var(--ios-pp-panel)",
        fontFamily: fontStack,
        // Unmeasured, like the detent itself; suppressed under a finger so the drag tracks exactly.
        transition: drag ? undefined : `height ${detent === "expanded" ? m.timing.detent : m.timing.exit}ms ${m.easing.enter}`,
        /*
         * The rounding is a clip path, not `border-radius`, and that is a fidelity decision rather
         * than a style one. Chrome paints a `border-radius` box snapped out to whole device pixels: at
         * this panel's measured left of 15.984 device px it fills pixel 15 completely, and the same
         * snapping on each tile eats the gaps, turning the measured 4.86 device px into 3. `clip-path`
         * renders sub-pixel, so both land where the capture puts them (pixel 15 comes out 241 against
         * the backdrop's 244, which is the 1.6% of a pixel the panel really covers).
         *
         * The cost is the corner profile. `clip-path: inset(... round)` can only draw a circle, and the
         * capture's corner is one of Apple's continuous ones: fitting the traced arc gives the
         * superellipse 0.84 device px rms on the top corner and 0.90 on the bottom, against the best
         * circle's 0.94 and 1.27. Trading 0.1 to 0.37 px of rms on two arcs for a device pixel on every
         * straight edge and every gap is the right way round, so the circle wins here.
         */
        clipPath: `inset(0 round ${m.roundTopRadius}px ${m.roundTopRadius}px ${m.roundBottomRadius}px ${m.roundBottomRadius}px)`,
        ...style,
      }}
      {...props}
    >
      {expanded ? (
        <div data-slot="photo-picker-header" style={{ height: headerHeight, paddingTop: m.header.titleTop, paddingLeft: m.header.inset, paddingRight: m.header.inset }}>
          <div className="flex items-center justify-between" style={{ height: m.header.rowHeight }}>
            <span style={{ fontSize: m.header.titleSize, fontWeight: 600, color: "var(--ios-pp-label)" }}>{title}</span>
            <button
              type="button"
              data-slot="photo-picker-albums"
              onClick={onAlbums}
              className="rounded-[8px] px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088ff]"
              style={{ fontSize: m.header.actionSize, color: "var(--ios-pp-badge)", background: "none", border: 0 }}
            >
              {albumsLabel}
            </button>
          </div>
          {search ? <div style={{ paddingTop: m.header.searchTop, height: m.header.rowHeight + m.header.searchTop }}>{field}</div> : null}
        </div>
      ) : null}

      <div
        ref={scroller}
        data-slot="photo-picker-scroller"
        // A scroll container has to be reachable by keyboard: without a tab stop the only way to
        // move the panel is to focus a tile that happens to be off screen.
        tabIndex={0}
        role="group"
        aria-label={label}
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
        onKeyDown={onKeyDown}
        className="w-full overflow-y-auto overflow-x-hidden [overscroll-behavior:contain] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff]"
        style={{ height: viewport }}
      >
        {/* The full scroll height, with only the visible band of rows drawn inside it. */}
        <div style={{ position: "relative", height: Math.max(0, rows * stride - gap) }}>
          {/*
            A group of toggles, not a listbox: each tile keeps its own pressed state and the grid never
            owes the keyboard a single mandatory selection.
          */}
          <div
            data-slot="photo-picker-grid"
            className="grid select-none"
            style={{
              position: "absolute",
              top: firstRow * stride,
              left: 0,
              right: 0,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridAutoRows: `${tileHeight}px`,
              gap,
            }}
          >
            {visible.map(({ photo, id, name }, offset) => {
              const index = firstRow * columns + offset;
              const order = selected.indexOf(id);
              const isSelected = order >= 0;
              const broken = failed.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  data-slot="photo-picker-tile"
                  data-index={index}
                  data-selected={isSelected ? "true" : "false"}
                  aria-label={name}
                  aria-pressed={isSelected}
                  tabIndex={index === tabStop ? 0 : -1}
                  onFocus={() => setActive(index)}
                  onClick={() => toggle(photo, id)}
                  className="relative block size-full p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff]"
                  style={{
                    background: photo.src && !broken ? "var(--ios-pp-tile)" : (photo.fill ?? "var(--ios-pp-tile)"),
                    // Clipped, not rounded, for the same reason the panel is; the focus ring is drawn
                    // inside the tile so the clip cannot swallow it.
                    clipPath: `inset(0 round ${m.tileRadius}px)`,
                  }}
                >
                  {photo.src && !broken ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.src}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      sizes={`${Math.round(tileWidth)}px`}
                      onError={() => setFailed(prev => (prev.includes(id) ? prev : [...prev, id]))}
                      className="absolute inset-0 size-full object-cover"
                      draggable={false}
                    />
                  ) : null}
                  {/* `aria-pressed` already says selected, so the hidden text only carries the pick order. */}
                  {ordered && isSelected ? <span style={offscreen}>{`${order + 1} of ${selected.length}`}</span> : null}
                  {/*
                    The badge never unmounts: it is always in the tree and only its opacity and scale
                    change, so a deselect gets the same committed frames a select does instead of
                    vanishing on the render that drops it. The 150 ms is unverified.
                  */}
                  <span
                    aria-hidden="true"
                    data-slot="photo-picker-badge"
                    className="pointer-events-none absolute flex items-center justify-center motion-safe:transition-[opacity,transform]"
                    style={{
                      right: m.badge.inset,
                      bottom: m.badge.inset,
                      width: m.badge.size,
                      height: m.badge.size,
                      transitionDuration: `${m.timing.badge}ms`,
                      opacity: isSelected ? 1 : 0,
                      transform: isSelected ? "scale(1)" : "scale(0.6)",
                    }}
                  >
                    {ordered ? (
                      <>
                        <span className="absolute inset-0 rounded-full" style={{ background: "var(--ios-pp-badge)", boxShadow: `0 0 0 ${m.badge.rim}px var(--ios-pp-glyph)` }} />
                        <span className="relative" style={{ color: "var(--ios-pp-glyph)", fontSize: m.badge.fontSize, fontWeight: 600, lineHeight: 1 }}>
                          {isSelected ? order + 1 : ""}
                        </span>
                      </>
                    ) : (
                      <PhotoPickerSelectionBadge size={m.badge.size} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {grabber ? (
        <div
          data-slot="photo-picker-handle"
          aria-hidden="true"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          className="absolute left-0 top-0 touch-none"
          style={{ width, height: m.detents.handle }}
        >
          <span
            data-slot="photo-picker-grabber"
            className="pointer-events-none absolute left-1/2"
            style={{
              top: m.grabber.top,
              width: m.grabber.width,
              height: m.grabber.height,
              marginLeft: -m.grabber.width / 2,
              borderRadius: m.grabber.radius,
              background: "var(--ios-pp-grabber)",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * What a selection turns into once it is in the composer.
 *
 * **Nothing here is measured.** No capture in `references/ios/captures` or
 * `references/macos/captures` shows a photo sitting in the Messages composer, and ChatKit only
 * offers `-[CKUIBehaviorPhone entryViewAttachmentHorizontalOffset]` (-5) and
 * `entryViewAttachmentVerticalOffset` (0), which say where such a thing goes without saying what it
 * is. The chip's size, radius, gap and remove button are invented, and its blue is the kit's
 * measured `#0088ff`. `ios-composer.tsx` takes no children, so this row is positioned by the shell
 * above the composer rather than inside it.
 *
 * @unverified size, radius, gap, removeSize, removeInset
 */
export const photoPickerChipMetrics = { size: 56, radius: 12, gap: 6, removeSize: 20, removeInset: 3, rowInset: 16 } as const;

export type PhotoPickerAttachmentsProps = Omit<ComponentProps<"div">, "children"> & {
  /** The picked photos, in pick order. */
  photos: PhotoPickerPhoto[];
  /** Fires with the id the chip's ✕ was pressed on, so the caller can drop it from the selection. */
  onRemove?: (id: string) => void;
  size?: number;
  label?: string;
};

export function PhotoPickerAttachments({ photos, onRemove, size = photoPickerChipMetrics.size, label = "Attachments", className, style, ...props }: PhotoPickerAttachmentsProps) {
  const c = photoPickerChipMetrics;
  if (photos.length === 0) return null;
  return (
    <div
      data-slot="photo-picker-attachments"
      role="list"
      aria-label={label}
      className={cn("flex items-end", vars, className)}
      style={{ gap: c.gap, fontFamily: fontStack, ...style }}
      {...props}
    >
      {photos.map((photo, index) => {
        const id = idOf(photo, index);
        const name = photo.alt ?? `Photo ${index + 1}`;
        return (
          <div key={id} role="listitem" data-slot="photo-picker-chip" className="relative" style={{ width: size, height: size }}>
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: photo.fill ?? "var(--ios-pp-tile)", clipPath: `inset(0 round ${c.radius}px)` }}
            />
            {photo.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.src} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 size-full object-cover" style={{ clipPath: `inset(0 round ${c.radius}px)` }} />
            ) : null}
            {onRemove ? (
              <button
                type="button"
                data-slot="photo-picker-chip-remove"
                aria-label={`Remove ${name}`}
                onClick={() => onRemove(id)}
                className="absolute flex items-center justify-center rounded-full p-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0088ff]"
                style={{
                  top: c.removeInset,
                  right: c.removeInset,
                  width: c.removeSize,
                  height: c.removeSize,
                  border: 0,
                  background: "rgba(0,0,0,0.5)",
                  color: "var(--ios-pp-glyph)",
                }}
              >
                <svg aria-hidden="true" width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                  <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" />
                </svg>
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
