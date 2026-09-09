/**
 * ChatKit's own unread-indicator arithmetic, transcribed from the disassembly so the lab can draw
 * the frame the framework would compute and a diff can say whether a component's dot lands on it.
 *
 * Source: `-[CKConversationListStandardCell _calculateIndicatorFrameForSize:trailing:displayScale:insets:]`
 * in ChatKit 26.5 (macOS 26.5, `/System/iOSSupport/.../ChatKit.framework/ChatKit`), read under lldb
 * with the ChatKit image loaded into a Catalyst host. The leading (non-trailing) path is:
 *
 *   x0 = (conversationListCellLeftMargin - size.width) * 0.5 + containerBounds.origin.x
 *   x1 = frintm(x0 * screenScale) / screenScale                 // floor, at UIScreen.mainScreen.scale
 *   y0 = containerBounds.origin.y + (cellHeightForDisplayScale: - size.height) * 0.5
 *   y1 = frintm(y0 * screenScale) / screenScale
 *   out = { frinta(x1*ds)/ds, frinta(y1*ds)/ds, frinta(w*ds)/ds, frinta(h*ds)/ds }   // round, ties away
 *
 * Two different scales are in play and that is not a typo: `screenScale` is a cached
 * `[[UIScreen mainScreen] scale]` (the `fcmp d0, #0.0` / `fcsel d15, 1.0, d0` guard makes it 1 when
 * the screen is not up yet), while `displayScale` is the method's own argument, taken from the cell's
 * `traitCollection.displayScale`. In this kit the two are the same number, so the second rounding is
 * a no-op on top of the first; both are kept here because they are what the framework does.
 *
 * The floor is why the phone's dot is NOT at the round (26 - 11) / 2 = 7.5: at 3x, floor(22.5)/3 is
 * 7.3333, and the vertical centre of an 86.6667 row is floor(113.5)/3 = 37.6667, not 37.8333. On the
 * Mac at 2x both halves land on whole device pixels going in, so 4.5 stays 4.5 and only the vertical
 * moves, 35.75 -> 35.5 on the sidebar's measured 80.5 row.
 */
export type IndicatorFrame = { x: number; y: number; width: number; height: number };

/** `frinta`: round to nearest, ties away from zero. `Math.round` ties toward +∞, which differs at -0.5. */
function roundTiesAway(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export function chatkitIndicatorFrame(input: {
  /** `-[CKUIBehavior conversationListCellLeftMargin]`: 26 on Phone, 18 on Mac. */
  leftMargin: number;
  /** `-[CKUIBehavior unreadIndicatorImageViewSize]`: {11, 11} on Phone, {9, 9} on Mac. */
  size: number;
  /** `+[CKConversationListStandardCell cellHeightForDisplayScale:]`, or the row height actually drawn. */
  rowHeight: number;
  /** `UIScreen.mainScreen.scale`. */
  screenScale: number;
  /** `traitCollection.displayScale`; the same number as `screenScale` in this kit. */
  displayScale: number;
  /** `containerBounds`, zero for a cell whose indicator column starts at the row's own origin. */
  containerX?: number;
  containerY?: number;
}): IndicatorFrame {
  const { leftMargin, size, rowHeight, screenScale, displayScale, containerX = 0, containerY = 0 } = input;
  const x1 = Math.floor(((leftMargin - size) * 0.5 + containerX) * screenScale) / screenScale;
  const y1 = Math.floor((containerY + (rowHeight - size) * 0.5) * screenScale) / screenScale;
  const snap = (value: number) => roundTiesAway(value * displayScale) / displayScale;
  return { x: snap(x1), y: snap(y1), width: snap(size), height: snap(size) };
}

/**
 * The two idioms, probed side by side rather than assumed equal — assuming they were equal has
 * already cost this repo one wrong commit. Every number below came out of one run of a Catalyst probe
 * that swizzles `-[UIDevice userInterfaceIdiom]` *before* `dlopen`ing ChatKit, then reads
 * `+[CKUIBehaviorPhone sharedBehaviors]` at idiom 0 and `+[CKUIBehaviorMac sharedBehaviors]` at
 * idiom 5. The colours are the rendered centre pixel of the framework's own image assets under a
 * light and a dark `UITraitCollection`, not a constant copied out of a header.
 */
export const chatkitUnread = {
  ios: {
    /** `-[CKUIBehaviorPhone unreadIndicatorImageViewSize]` = {11, 11}. */
    size: 11,
    /** `-[CKUIBehaviorPhone conversationListCellLeftMargin]` = 26. */
    leftMargin: 26,
    /** `+[CKConversationListStandardCell cellHeightForDisplayScale:3]` at idiom 0 = 86.666667. */
    rowHeight: 86.6667,
    scale: 3,
    /** `unreadIndicatorTintedImage`, a Ø12 opaque disc, rendered under each appearance. */
    dot: { light: "#0088ff", dark: "#0091ff" },
    /**
     * `-[CKUIBehaviorPhone shouldUnreadIndicatorChangeOnSelection]` = **NO**, so the phone's dot keeps
     * `unreadIndicatorTintedImage` on a selected row. (`unreadIndicatorSelectedImage` exists at this
     * idiom and renders #1a1919, but the NO makes that branch unreachable.)
     */
    changesOnSelection: false,
    selectedDot: null,
  },
  macos: {
    /** `-[CKUIBehaviorMac unreadIndicatorImageViewSize]` = {9, 9}. */
    size: 9,
    /** `-[CKUIBehaviorMac conversationListCellLeftMargin]` = 18 = 9 + `unreadIndicatorTotalMargins` 9. */
    leftMargin: 18,
    /**
     * The sidebar's own measured row, not ChatKit's: `cellHeightForDisplayScale:2` at idiom 5 returns
     * 84, and the 960×640 capture measures 80.5. A capture beats a framework constant, the same call
     * `macos-sidebar.tsx` already makes for the conversation-list font table.
     */
    rowHeight: 80.5,
    scale: 2,
    /** `unreadIndicatorTintedImage` = `-[CKUIThemeMac unreadIndicatorColor]`, baked in. */
    dot: { light: "#0088ff", dark: "#0091ff" },
    /**
     * `-[CKUIBehaviorMac shouldUnreadIndicatorChangeOnSelection]` = **YES**, and
     * `-[CKConversationListCell unreadIndicatorImageForVisibility:withMuteState:]` then returns
     * `unreadIndicatorSelectedImage`, which renders opaque #ffffff in both appearances.
     */
    changesOnSelection: true,
    selectedDot: { light: "#ffffff", dark: "#ffffff" },
  },
} as const;
