"use client";

import { useCallback, useEffect, useRef, useState, type ComponentProps, type CSSProperties, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { fontStack } from "@/registry/imessage/tokens";

/**
 * The Photos picker iOS 26 opens inside the Messages composer.
 *
 * Measured from `references/ios/captures/photo-picker-light.png` (iOS 26.0, iPhone 17 Pro, 402×874 pt
 * at 3x). Every number below is a sub-pixel read of that frame unless it says otherwise; device pixels
 * are quoted where the point value is a third.
 *
 * ## What the capture actually shows
 *
 * A white panel, inset **5.333 (16 px)** from the screen's left, right and bottom edges, holding a
 * three-column grid of square thumbnails flush to its own left, right and top edges. Over the middle
 * of the first row sits a drag grabber. That is the whole of it: **no header, no title, no "Recents"
 * label, no "All Photos" button, no camera tile, no search field, no send or count button, and no
 * selection indicator on any tile.** Anything this file draws beyond the panel, the grid and the
 * grabber is marked unverified below and is not in `SPEC.md` as a measurement.
 *
 * The capture shows only two rows with empty white under them. That is the library, not the layout:
 * the iOS Simulator ships exactly six sample photos. The grid scrolls **vertically** and a real
 * library keeps going; at the capture's panel height a third row is visible for 121.3 of its 129.56.
 *
 * ## Panel
 *
 * | Part | Value | How |
 * |---|---|---|
 * | Inset (left, right, bottom) | 5.3333 (16 px) | white run x 16–1189, bottom-most white row 2605 of 2622 |
 * | Width at a 402 screen | 391.3333 | 1174 px |
 * | Top / height in the capture | 485 / 383.6667 | grid top 1455 px, panel bottom 2606 px |
 * | Fill | `#ffffff` | flat, sampled all over the empty area below the grid |
 * | Top corners | superellipse n 2.204, R **39.0** (rms 0.84 px) | 109 sub-pixel boundary points on the top-right corner |
 * | Bottom corners | superellipse n 2.204, R **57.5833** (rms 0.90 px) | 183 points on the bottom-left corner |
 * | Shadow / dim | none | the blurred backdrop reads a flat 244–246 right up to the panel edge |
 *
 * The plain circle is fitted separately, because it is what the panel actually renders (see the
 * clip-path note in the panel's own style): **36.1667** top (rms 0.94 px) and **53.5** bottom (rms
 * 1.27 px). The bottom corner is the device's own corner made concentric with the panel: 57.58 + 5.33
 * = 62.9, which is the iPhone 17 Pro display radius.
 *
 * ## Grid
 *
 * Three columns, flush to the panel on three sides, **1.6207 (4.862 px)** between tiles on both axes.
 * The three gaps are measured independently over 100+ sub-pixel boundary points each and agree:
 * 4.870, 4.859 across, 4.858 down. Measured edges at 3x: columns 16.0 | 404.238 → 409.108 |
 * 796.900 → 801.759 | 1190.0, rows 1455.0 → 1843.636 | 1848.494 → 2237.24.
 *
 * That makes a tile **129.364 wide** (`(width - 2 × gap) / 3`) and **129.5633 tall**: the columns
 * average 388.09 device px and the rows 388.69, a real 0.6 px difference that shows up the same way in
 * both rows. Treating the tile as square puts the second row's bottom 1.2 px above the capture, so the
 * grid keeps the measured aspect instead. Tile corners are **≈2.1** (a circle fitted to the sub-pixel
 * coverage of the highest-contrast interior corner bottoms out at 6.3 device px); they are not the 12
 * the spec's prose carries, which is off by a factor of six and obvious in a side-by-side.
 *
 * ## Grabber
 *
 * **36 × 5**, pill radius 2.5, centred on the panel with its top **4.6667 (14 px)** below the panel
 * top. The size is a framework number, not a fit: `-[_UIGrabber intrinsicContentSize]` in UIKitCore
 * returns exactly `{36, 5}`, and the capture's ink (106 × 14 px at a 25/255 threshold, centred on
 * x 602.5 of a panel centred on 603.0) is that pill minus its anti-aliased rim.
 *
 * Its colour is **not** a flat fill. `_UIGrabber` builds itself out of a luma-tracking vibrancy view
 * (`-[_UIGrabber _visualEffectView]`, `_lumaTrackingEnabled`, `_setBackgroundLuminanceLevel:`), and the
 * capture agrees: over the photo it sits on, the pill darkens all three channels by the same 60/255
 * (196,190,223 → 136,129,163), which no single translucent colour reproduces. The closest flat fill is
 * 30% black, which lands the red and green channels within 2/255 and leaves blue 7/255 short. That is
 * a fit, and it is the same one `ios-plus-menu.tsx` already uses.
 *
 * ## Selection, unverified
 *
 * Nothing in `references/` captures a selected tile, and the iOS 26 picker's own grid is SwiftUI
 * (`PhotosUICore.LemonadePickerView`), so there is no Objective-C metric to read the badge out of
 * either. `PXPhotosGridMessagesLayoutSpec`, which does expose `itemCornerRadius`, `interItemSpacing`
 * and `padding`, is the wrong grid: its `numberOfColumnsForNumberOfItems:` reads
 * `PXMessagesUISettings.minItemSize/minColumns/maxColumns`, so it lays out the photo stack inside a
 * balloon, not this picker. So `photoPickerMetrics.badge` is a **fit, not a measurement**: the ordinary
 * iOS selection badge, a filled disc at the tile's bottom trailing corner carrying a white check, or
 * the 1-based pick order when `ordered` is set. Its blue is the kit's measured `#0088ff`.
 *
 * ## Motion, unverified
 *
 * No capture or recording in this repo holds the picker opening or closing, so both durations are
 * borrowed from the kit's measured neighbours (the long-press menu's 380 ms open and 220 ms exit) and
 * that is the whole of their authority. The panel translates up from its own height and fades; the
 * animation is a single Web Animations timeline so `progress` can pause and seek it to one exact
 * frame, and `prefers-reduced-motion` skips it. Closing is driven by the `open` prop during render, so
 * the exit always gets a committed frame before `onExited` fires.
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
  tileRadius: 2.1,
  grabber: { width: 36, height: 5, radius: 2.5, top: 4.6667 },
  /** Unverified: nothing captures a selected tile. See the file comment. */
  badge: { size: 22, inset: 6, fontSize: 13, checkStroke: 2 },
  /** Unverified: borrowed from the long-press menu's measured 380 / 220. */
  timing: { enter: 380, exit: 220 },
} as const;

/**
 * Light values are measured off the capture. The dark set is unverified: no dark capture of the picker
 * exists, so the panel takes iOS's grouped-background dark grey and the grabber flips to 30% white.
 * They are custom properties so a `.dark` ancestor flips the panel without the caller passing anything.
 */
const vars =
  "[--ios-pp-panel:#ffffff] [--ios-pp-grabber:rgba(0,0,0,0.3)] [--ios-pp-tile:#e9e9eb] [--ios-pp-badge:#0088ff] [--ios-pp-glyph:#ffffff] [--ios-pp-rim:rgba(0,0,0,0.22)] " +
  "dark:[--ios-pp-panel:#1c1c1e] dark:[--ios-pp-grabber:rgba(255,255,255,0.3)] dark:[--ios-pp-tile:#2c2c2e] dark:[--ios-pp-badge:#0088ff] dark:[--ios-pp-glyph:#ffffff] dark:[--ios-pp-rim:rgba(0,0,0,0.35)]";

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
  /** Any CSS background, used when there is no `src`. */
  fill?: string;
};

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
  /** The drag bar over the first row. */
  grabber?: boolean;
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

function Check({ size }: { size: number }) {
  // Drawn, not an SF Symbol, and unverified like the rest of the badge: a 2 pt stroke on its own box.
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 22 22" fill="none">
      <path
        d="M6 11.4l3.4 3.4L16.2 8"
        stroke="currentColor"
        strokeWidth={photoPickerMetrics.badge.checkStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  grabber = true,
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
  const [active, setActive] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const exited = useRef(false);
  /**
   * The callback lives in a ref, not in the timeline effect's dependencies. A caller that passes an
   * inline arrow hands us a new identity on the render `onExited` itself causes, and a dependency on
   * it would tear the finished exit down and start it again from the top.
   */
  const exitedCallback = useRef(onExited);
  useEffect(() => {
    exitedCallback.current = onExited;
  });

  const toggle = useCallback(
    (photo: PhotoPickerPhoto, index: number) => {
      const id = idOf(photo, index);
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
   * One tab stop for the whole grid, arrows to move inside it, the way a native grid behaves. The
   * roving index is clamped during render, so a library that shrinks under it cannot strand the tab
   * stop on a tile that is gone.
   */
  const activeIndex = Math.min(active, Math.max(0, photos.length - 1));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" ? 1
      : event.key === "ArrowLeft" ? -1
      : event.key === "ArrowDown" ? columns
      : event.key === "ArrowUp" ? -columns
      : 0;
    let next = step ? activeIndex + step : activeIndex;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = photos.length - 1;
    if (!step && event.key !== "Home" && event.key !== "End") return;
    if (next < 0 || next >= photos.length) return;
    event.preventDefault();
    setActive(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus();
  };

  /**
   * One Web Animations timeline, run forwards or backwards, so `document.getAnimations()` reaches it
   * and `progress` can pause and seek either direction to a frame that renders identically every run.
   * Which direction it runs is read off the `open` prop during render, so the closing pose gets its
   * committed frames before `onExited` lets the caller unmount anything.
   */
  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    // Reopening arms the exit again, so a panel that opens and closes twice reports twice.
    if (open) exited.current = false;
    const closing = !open;
    const duration = closing ? m.timing.exit : m.timing.enter;
    const away = { transform: `translateY(${height}px)`, opacity: 0 };
    const settled = { transform: "translateY(0px)", opacity: 1 };
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
      easing: closing ? "cubic-bezier(0.4, 0, 1, 1)" : "cubic-bezier(0.32, 0.72, 0, 1)",
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
  }, [open, progress, height, m.timing.enter, m.timing.exit]);

  /**
   * The row height comes from the tile's own measured aspect, not from `aspect-square`: the capture's
   * rows really are 0.6 device px taller than its columns are wide.
   */
  const gap = m.gap;
  const tileWidth = (width - (columns - 1) * gap) / columns;
  const tileHeight = tileWidth / m.tileAspect;

  return (
    <div
      ref={panel}
      data-slot="photo-picker"
      data-state={open ? "open" : "closed"}
      className={cn("ios-photo-picker absolute", vars, className)}
      style={{
        // Left plus width, never left plus right: two fractional insets resolve independently and the
        // panel ends up a device pixel wider than the capture's 1174.
        left: inset,
        bottom: inset,
        width,
        height,
        background: "var(--ios-pp-panel)",
        fontFamily: fontStack,
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
      <div
        data-slot="photo-picker-scroller"
        className="h-full w-full overflow-y-auto overflow-x-hidden [overscroll-behavior:contain]"
      >
        {/*
          A group of toggles, not a listbox: each tile keeps its own pressed state and the grid never
          owes the keyboard a single mandatory selection.
        */}
        <div
          data-slot="photo-picker-grid"
          role="group"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="grid select-none"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: `${tileHeight}px`, gap }}
        >
          {photos.map((photo, index) => {
            const id = idOf(photo, index);
            const order = selected.indexOf(id);
            const isSelected = order >= 0;
            const name = photo.alt ?? `Photo ${index + 1}`;
            return (
              <button
                key={id}
                type="button"
                data-slot="photo-picker-tile"
                data-index={index}
                data-selected={isSelected ? "true" : "false"}
                aria-label={name}
                aria-pressed={isSelected}
                tabIndex={index === activeIndex ? 0 : -1}
                onFocus={() => setActive(index)}
                onClick={() => toggle(photo, index)}
                className="relative block size-full p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff]"
                style={{
                  background: photo.src ? "var(--ios-pp-tile)" : (photo.fill ?? "var(--ios-pp-tile)"),
                  // Clipped, not rounded, for the same reason the panel is; the focus ring is drawn
                  // inside the tile so the clip cannot swallow it.
                  clipPath: `inset(0 round ${m.tileRadius}px)`,
                }}
              >
                {photo.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.src} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" draggable={false} />
                ) : null}
                {/* `aria-pressed` already says selected, so the hidden text only carries the pick order. */}
                {ordered && isSelected ? <span style={offscreen}>{`${order + 1} of ${selected.length}`}</span> : null}
                {/*
                  Unverified geometry and colour, and the 150 ms is a fit too. The badge never
                  unmounts: it is always in the tree and only its opacity and scale change, so a
                  deselect gets the same committed frames a select does instead of vanishing on the
                  render that drops it.
                */}
                <span
                  aria-hidden="true"
                  data-slot="photo-picker-badge"
                  className="pointer-events-none absolute flex items-center justify-center rounded-full motion-safe:transition-[opacity,transform] motion-safe:duration-150"
                  style={{
                    right: m.badge.inset,
                    bottom: m.badge.inset,
                    width: m.badge.size,
                    height: m.badge.size,
                    background: "var(--ios-pp-badge)",
                    color: "var(--ios-pp-glyph)",
                    fontSize: m.badge.fontSize,
                    fontWeight: 600,
                    lineHeight: 1,
                    boxShadow: "0 0 0 0.5px var(--ios-pp-rim)",
                    opacity: isSelected ? 1 : 0,
                    transform: isSelected ? "scale(1)" : "scale(0.6)",
                  }}
                >
                  {ordered ? (isSelected ? order + 1 : "") : <Check size={m.badge.size} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {grabber ? (
        <span
          aria-hidden="true"
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
      ) : null}
    </div>
  );
}
