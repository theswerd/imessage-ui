"use client";

import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/registry/imessage/avatar";

/**
 * macOS 26 Messages conversation list. Every number is measured from a native 960×640 window at 2x
 * (see `references/SPEC.md` → macOS Chrome). The sidebar is not a flat 330 pt column: it is a floating
 * panel inset 8 from the window's left, top and bottom, 320 wide (window x 8–328), radius ≈18, with a
 * 1 pt bright rim and a soft shadow onto the pane. Everything inside sits in window coordinates:
 * search field x 18–318 y 52–88 (a 36 tall capsule), pinned Ø73 avatar centered (168, 142.5) with an
 * 11 pt gray label, rows 80.5 tall from y 215 with a Ø40 avatar at x 36–76, a 13 pt semibold name
 * (baseline 28.75 into the row), a 12 pt time on the same baseline ending at x 307.5, a 12 pt preview
 * (baseline 45, 15 pt line pitch, two lines), 1 pt separators from x 82 to 306, a #3478f6 selection
 * (#3a3a3a when the window is not key) and a 49 pt footer bar at the panel's bottom.
 *
 * **Unread** (no capture; read out of ChatKit 26.5 on macOS 26.5, the framework macOS Messages is
 * built on). An unread row draws a dot and nothing else: nothing in the row's layout moves, no label
 * changes weight or colour, and there is no count badge.
 * - Ø **9**, from `-[CKUIBehaviorMac unreadIndicatorImageViewSize]` = `{9, 9}`. The asset behind it,
 *   `-[CKUIBehavior unreadIndicatorTintedImage]`, is a Ø12 circle that fills its box edge to edge, so
 *   the image view's size *is* the dot's diameter.
 * - Fill **#0088ff light / #0091ff dark, opaque**, from `-[CKUIThemeMac unreadIndicatorColor]`.
 *   `__42-[CKUIBehavior unreadIndicatorTintedImage]_block_invoke` is that colour's only consumer:
 *   it bakes it into the circle, and rendering the image under each appearance returns those two.
 * - Placement `-[CKConversationListCellLayout unreadFrame]` = `{4.5, y, 9, 9}` in the same row space
 *   whose avatar is `{18, ·, 40, 40}` and whose name box starts at 64, i.e. exactly this component's.
 *   `-[CKConversationListStandardCell _calculateIndicatorFrameForSize:trailing:displayScale:insets:]`
 *   derives both: x = (`conversationListCellLeftMargin` 18 − 9) / 2 = 4.5, so the dot is centred in the
 *   gutter left of the avatar, and y = (row height − 9) / 2, so it is centred on the row.
 * - **Selected and unread**: the dot turns **white**, opaque. `-[CKUIBehaviorMac
 *   shouldUnreadIndicatorChangeOnSelection]` is `YES` (it is `NO` on `CKUIBehaviorPhone`), and
 *   `-[CKConversationListCell unreadIndicatorImageForVisibility:withMuteState:]` reads
 *   `shouldLabelsBeHighlighted && shouldUnreadIndicatorChangeOnSelection ? unreadIndicatorSelectedImage
 *   : unreadIndicatorTintedImage`. The selected image renders #ffffff in both appearances. It is the
 *   same test that whitens the labels, because the dot sits inside the selection fill, not beside it,
 *   so the dot follows `highlighted` here. `shouldLabelsBeHighlighted` is a bare ivar on the cell with
 *   no notion of a key window, so an inactive window's gray selection is the one case not settled by
 *   the framework: the capture shows its labels staying dark, and the dot stays blue to match.
 * - **No count.** `_TtC7ChatKit32CKConversationListIndicatorsView`, the row's accessory strip, holds
 *   only image views, and `-[CKConversationListCell unreadMessageCount]` is read by nothing that
 *   draws. A number passed here is announced and never painted.
 * - **A pinned conversation shows nothing.** `CKPinnedConversationView` has its own Ø9 dot before the
 *   title label (`unreadIndicatorSize` {9, 9}, `unreadIndicatorPreferredPadding` trailing 3, the same
 *   `unreadIndicatorColor`), but `-[CKPinnedConversationView _unreadIndicatorColor]` also branches on
 *   `isFilteredByFocus` and `isSelectedWithDarkAppearance` into a `readSelectedIndicatorColor` this
 *   component has no equivalent for, so `unread` on a pinned conversation is deliberately inert
 *   rather than a guess.
 */
export type SidebarConversation = {
  id: string;
  name: string;
  initials: string;
  preview: string;
  time: string;
  pinned?: boolean;
  muted?: boolean;
  /**
   * Unread conversation: draws the dot. A number is announced ("3 unread messages") but never
   * painted, because macOS Messages draws no count on a row.
   */
  unread?: boolean | number;
  /** Photo variant of the avatar. */
  photo?: string;
};

export type MacSidebarProps = Omit<ComponentProps<"nav">, "onSelect"> & {
  conversations: SidebarConversation[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** Key window: blue selection. Otherwise the neutral inactive selection. */
  active?: boolean;
  /** Footer line, e.g. "Syncing with iCloud Paused". */
  footer?: string;
  onSearch?: (query: string) => void;
  onOptions?: () => void;
};

export const macSidebarMetrics = {
  /** The column the window reserves. The panel itself is inset inside it. */
  width: 330,
  panel: { left: 8, top: 8, bottom: 8, width: 320, radius: 18 },
  search: { left: 18, top: 52, width: 300, height: 36 },
  pinned: { top: 96, avatar: 73, centerX: 168, avatarCenterY: 142.5, height: 119, labelTop: 184.75 },
  row: {
    left: 18, width: 300, height: 80.5, radius: 8, avatar: 40, avatarLeft: 18,
    textLeft: 64, textRight: 10.5, separatorRight: 12, nameTop: 15.75, previewTop: 33, previewLine: 15,
    muted: 11.5, mutedTop: 36.3,
    // ChatKit's own unreadFrame: Ø9 centred in the 18 pt gutter left of the avatar, centred on the row.
    unread: 9, unreadLeft: 4.5,
  },
  footer: { height: 49, textTop: 17.75 },
  options: { centerX: 306, centerY: 25.85 },
};

/** Sidebar list options: three centred bars, 16.5 / 12.5 / 9.5 wide, 1.25 thick, 4.1 apart. */
function OptionsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16.5 9.45" width="16.5" height="9.45" fill="currentColor">
      <rect x="0" y="0" width="16.5" height="1.25" rx="0.625" />
      <rect x="2" y="4.1" width="12.5" height="1.25" rx="0.625" />
      <rect x="3.5" y="8.2" width="9.5" height="1.25" rx="0.625" />
    </svg>
  );
}

/** Ø10 magnifier with a handle running to the corner: the native ink box is 12.5 square at (32.5, 63.5). */
function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 12.5 12.5" width="12.5" height="12.5" fill="none" stroke="currentColor">
      <circle cx="5" cy="5" r="4.4" strokeWidth="1.2" />
      <path d="M8.4 8.4 11.9 11.9" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** bell.slash.fill: a filled bell with the slash separated from it by a background-coloured stroke. */
function MutedIcon({ size, color, halo }: { size: number; color: string; halo: string }) {
  return (
    <svg aria-label="Muted" role="img" viewBox="0 0 10 10" width={size} height={size}>
      <path fill={color} d="M5 0.6a2.6 2.6 0 0 0-2.6 2.6c0 2.2-.6 2.9-1.1 3.4a.5.5 0 0 0 .35.85h6.7a.5.5 0 0 0 .35-.85c-.5-.5-1.1-1.2-1.1-3.4A2.6 2.6 0 0 0 5 .6Zm0 8.8a1.2 1.2 0 0 0 1.15-.9h-2.3A1.2 1.2 0 0 0 5 9.4Z" />
      <path stroke={halo} strokeWidth="1.9" strokeLinecap="round" d="M1.5 1.5 8.5 8.5" />
      <path stroke={color} strokeWidth="0.95" strokeLinecap="round" d="M1.5 1.5 8.5 8.5" />
    </svg>
  );
}

/**
 * What an unread row announces. Nothing in ChatKit builds this string, so the wording is ours; the
 * count comes from the caller because macOS Messages never paints one.
 */
function unreadLabel(unread: boolean | number): string {
  if (unread === true) return "Unread";
  return unread === 1 ? "1 unread message" : `${unread} unread messages`;
}

export function MacSidebar({ conversations, selectedId, onSelect, active = true, footer, onSearch, onOptions, className, style, ...props }: MacSidebarProps) {
  const m = macSidebarMetrics;
  const pinned = conversations.filter(c => c.pinned);
  const rows = conversations.filter(c => !c.pinned);
  const listTop = pinned.length ? m.pinned.top + m.pinned.height : m.pinned.top;
  return (
    <nav
      data-slot="mac-sidebar"
      data-active={active ? "true" : "false"}
      aria-label="Conversations"
      className={cn(
        "mac-sidebar relative h-full select-none overflow-hidden bg-[#f8f8f8] text-black",
        "[--sb-fill:#fafafa] [--sb-rim:#ffffff] [--sb-rim-inner:#fefefe] [--sb-inactive:#e2e2e2] [--sb-name:#000000] [--sb-secondary:#6e6e6d] [--sb-muted:#aeaeae] [--sb-glyph:#232323] [--sb-field:#eeeeee] [--sb-placeholder:#777777] [--sb-separator:#e1e1e1] [--sb-footer-line:#d0d2d7] [--sb-footer-top:#e4e6eb] [--sb-footer-bottom:#eff0f2] [--sb-footer-text:#000000] [--sb-unread:#0088ff]",
        "dark:bg-[#1c1c1c] dark:text-[#f4f4f4]",
        "dark:[--sb-fill:#1b1b1b] dark:[--sb-rim:#424242] dark:[--sb-rim-inner:#323232] dark:[--sb-inactive:#3a3a3a] dark:[--sb-name:#f4f4f4] dark:[--sb-secondary:#a4a4a4] dark:[--sb-muted:#5b5b5b] dark:[--sb-glyph:#dddddd] dark:[--sb-field:#1e1e1e] dark:[--sb-placeholder:#9a9a9a] dark:[--sb-separator:#3a3a3a] dark:[--sb-footer-line:#43454a] dark:[--sb-footer-top:#27292e] dark:[--sb-footer-bottom:#27272a] dark:[--sb-footer-text:#f5f5f5] dark:[--sb-unread:#0091ff]",
        className,
      )}
      style={{ width: m.width, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", ...style }}
      {...props}
    >
      {/*
        Native draws continuous corners: a plain circle of radius 18 (panel) / 8 (row selection) is the
        closest circular fit, so browsers with `corner-shape` get the superellipse the capture shows.
      */}
      <style>{`
        .mac-sidebar-panel { border-radius: ${m.panel.radius}px; }
        .mac-sidebar-row { border-radius: ${m.row.radius}px; }
        @supports (corner-shape: superellipse(1.4)) {
          .mac-sidebar-panel { border-radius: 22px; corner-shape: superellipse(1.4); }
          .mac-sidebar-row { border-radius: 10px; corner-shape: superellipse(1.4); }
        }
      `}</style>
      <div
        aria-hidden="true"
        data-slot="sidebar-panel"
        className="mac-sidebar-panel absolute bg-[var(--sb-fill)]"
        style={{ left: m.panel.left, top: m.panel.top, bottom: m.panel.bottom, width: m.panel.width, // The panel rim is two device pixels and they are not the same colour: #424242 outside,
          // #323232 inside on dark. One 1 pt ring paints both columns the same and reads too bright.
          boxShadow: "0 0 20px rgba(0,0,0,0.05), inset 0 0 0 0.5px var(--sb-rim), inset 0 0 0 1px var(--sb-rim-inner)" }}
      />

      <button type="button" data-slot="sidebar-options" aria-label="Conversation list options" aria-haspopup="menu" onClick={onOptions}
        className="absolute flex size-[26px] items-center justify-center rounded-full text-[var(--sb-glyph)] hover:bg-black/5 dark:hover:bg-white/10"
        style={{ left: m.options.centerX - 13, top: m.options.centerY - 13 }}>
        <OptionsIcon />
      </button>

      <label data-slot="sidebar-search" className="absolute flex items-center bg-[var(--sb-field)] text-[var(--sb-placeholder)]"
        style={{ left: m.search.left, top: m.search.top, width: m.search.width, height: m.search.height, borderRadius: m.search.height / 2 }}>
        <span aria-hidden="true" className="absolute" style={{ left: 32.5 - m.search.left, top: 63.5 - m.search.top }}><SearchIcon /></span>
        <span className="sr-only">Search conversations</span>
        <input type="search" placeholder="Search" onChange={event => onSearch?.(event.target.value)}
          className="absolute bg-transparent text-[13px] leading-[16px] text-[var(--sb-name)] outline-none placeholder:font-medium placeholder:text-[var(--sb-placeholder)] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          style={{ left: 53 - m.search.left, right: 8, top: 61.75 - m.search.top }} />
      </label>

      {pinned.length > 0 && (
        <ul data-slot="sidebar-pinned" aria-label="Pinned" className="absolute flex list-none justify-center gap-[24px] p-0"
          style={{ left: m.panel.left, top: m.pinned.top, width: m.panel.width, height: m.pinned.height }}>
          {pinned.map(c => {
            const selected = c.id === selectedId;
            return (
              <li key={c.id} className="flex w-[96px] flex-col items-center">
                <button type="button" aria-current={selected ? "true" : undefined} onClick={() => onSelect?.(c.id)}
                  className="flex flex-col items-center rounded-[14px] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#3478f6]"
                  style={{ paddingTop: m.pinned.avatarCenterY - m.pinned.top - m.pinned.avatar / 2 }}>
                  <Avatar size={m.pinned.avatar} initials={c.initials} src={c.photo} name={c.name}
                    style={selected ? { boxShadow: `0 0 0 2px ${active ? "#3478f6" : "#9a9a9a"}` } : undefined} />
                  <span data-slot="pinned-name" className="max-w-[96px] truncate text-[11px] leading-[13px] text-[var(--sb-secondary)]"
                    style={{ marginTop: m.pinned.labelTop - (m.pinned.avatarCenterY + m.pinned.avatar / 2) }}>{c.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ul data-slot="sidebar-rows" role="list" className="absolute m-0 list-none p-0" style={{ left: m.row.left, top: listTop, width: m.row.width }}>
        {rows.map((c, index) => {
          const selected = c.id === selectedId;
          const nextSelected = rows[index + 1]?.id === selectedId;
          // Inactive windows keep the neutral text colors on the gray selection.
          const highlighted = selected && active;
          const secondary = highlighted ? "#d6e4fd" : "var(--sb-secondary)";
          return (
            <li key={c.id} data-slot="sidebar-row" data-selected={selected ? "true" : "false"} className="relative" style={{ height: m.row.height }}>
              <button type="button" aria-current={selected ? "true" : undefined} onClick={() => onSelect?.(c.id)}
                className="mac-sidebar-row absolute inset-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#3478f6]/60"
                style={{ background: selected ? (active ? "#3478f6" : "var(--sb-inactive)") : "transparent" } as CSSProperties}>
                {c.unread ? (
                  <>
                    {/* First in the row so the announcement leads: "Unread, Alex Morgan, Yesterday, ...". */}
                    <span className="sr-only">{unreadLabel(c.unread)}. </span>
                    {/* The dot lies inside the selection fill, so it takes the same white the labels take. */}
                    <span aria-hidden="true" data-slot="row-unread" className="absolute rounded-full"
                      style={{ left: m.row.unreadLeft, top: (m.row.height - m.row.unread) / 2, width: m.row.unread, height: m.row.unread, background: highlighted ? "#ffffff" : "var(--sb-unread)" }} />
                  </>
                ) : null}
                <Avatar size={m.row.avatar} initials={c.initials} src={c.photo} name={c.name} className="absolute" style={{ left: m.row.avatarLeft, top: (m.row.height - m.row.avatar) / 2 }} />
                <span className="absolute flex items-baseline justify-between gap-2" style={{ left: m.row.textLeft, right: m.row.textRight, top: m.row.nameTop }}>
                  <span data-slot="row-name" className="truncate text-[13px] font-semibold leading-[16px]" style={{ color: highlighted ? "#ffffff" : "var(--sb-name)" }}>{c.name}</span>
                  <span data-slot="row-time" className="shrink-0 text-[12px] leading-[15px]" style={{ color: secondary }}>{c.time}</span>
                </span>
                <span data-slot="row-preview" className="absolute line-clamp-2 text-[12px] leading-[15px]"
                  style={{ left: m.row.textLeft, right: m.row.textRight, top: m.row.previewTop, color: secondary }}>{c.preview}</span>
                {c.muted && (
                  <span className="absolute" style={{ right: m.row.separatorRight, top: m.row.mutedTop }}>
                    <MutedIcon size={m.row.muted} color={highlighted ? "#d6e4fd" : "var(--sb-muted)"} halo={selected ? (active ? "#3478f6" : "var(--sb-inactive)") : "var(--sb-fill)"} />
                  </span>
                )}
              </button>
              {!selected && !nextSelected && index < rows.length - 1 && (
                <span aria-hidden="true" className="absolute bottom-0 h-px bg-[var(--sb-separator)]" style={{ left: m.row.textLeft, right: m.row.separatorRight }} />
              )}
            </li>
          );
        })}
      </ul>
      {footer && (
        <div data-slot="sidebar-footer" className="absolute overflow-hidden"
          style={{ left: m.panel.left, bottom: m.panel.bottom, width: m.panel.width, height: m.footer.height, borderRadius: `0 0 ${m.panel.radius}px ${m.panel.radius}px` }}>
          <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(to bottom, var(--sb-footer-top), var(--sb-footer-bottom))", boxShadow: "inset 0 1px 0 var(--sb-footer-line)" }} />
          <p className="absolute left-0 m-0 w-full text-center text-[10px] leading-[12px] text-[var(--sb-footer-text)]" style={{ top: m.footer.textTop }}>{footer}</p>
        </div>
      )}
    </nav>
  );
}
