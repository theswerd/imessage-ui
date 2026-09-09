import type { Platform } from "@/registry/imessage/platform";

/**
 * Measured design tokens (see references/SPEC.md). Points equal CSS px.
 * Colors that vary with vertical screen position are expressed as top/bottom pairs of a
 * screen-space linear gradient; `screenHeight` is the reference height they were measured on.
 */
export type Service = "imessage" | "sms";
export type Direction = "incoming" | "outgoing";

export type BubbleMetrics = {
  fontSize: number;
  lineHeight: number;
  paddingX: number;
  paddingY: number;
  radius: number;
  minWidth: number;
  /** Widest bubble in px (iOS uses a fixed width at 402pt screens). */
  maxWidth: number;
  /** Fraction of the message pane width a bubble may occupy (macOS). */
  maxWidthRatio: number;
  /** Scale applied to the traced iOS tail (1 on iOS, 0.7 on macOS). */
  tailScale: number;
  /** Gap between consecutive bubbles of the same group, and between groups. */
  gapInGroup: number;
  gapBetweenGroups: number;
  /** Inset from the pane edge on the bubble's own side. */
  edgeInset: number;
  /** Whether every bubble gets a tail. Both platforms only tail the last bubble of a cluster. */
  tailOnEveryBubble: boolean;
  /** Status label ("Delivered") typography and offsets. Always semibold. */
  statusFontSize: number;
  statusLineHeight: number;
  statusLetterSpacing: number;
  statusGap: number;
  statusInset: number;
  /** Large glyph size, line box, and edge inset for emoji-only messages. */
  emojiOnlySize: number;
  emojiOnlyLineHeight: number;
  emojiOnlyInset: number;
  /** Tracking applied to bubble text so the web's SF matches native widths. */
  letterSpacing: number;
};

export const bubbleMetrics: Record<Platform, BubbleMetrics> = {
  ios: {
    fontSize: 17,
    lineHeight: 20,
    paddingX: 13.85,
    paddingY: 10,
    radius: 19,
    minWidth: 48,
    maxWidth: 280.5,
    /** Unverified: 0.17 under `maxWidth`. `message-list` uses the ratio on iOS too, so a bubble is
     * 280.33 wide in a list and 280.5 standalone. The widest body in `conv3-light.png` measures 280.67. */
    maxWidthRatio: 280.33 / 402,
    tailScale: 1,
    gapInGroup: 4.3333,
    // 10.33 cannot reproduce the 50.000 pt step native puts between the third "V" and the long
    // bubble: solving all seven row origins at once pins this to 10.168-10.25.
    gapBetweenGroups: 10.2,
    edgeInset: 16,
    tailOnEveryBubble: false,
    statusFontSize: 11,
    statusLineHeight: 13,
    statusLetterSpacing: -0.25,
    statusGap: 4.65,
    statusInset: 20.3,
    /** Unverified: no iOS capture holds an emoji-only message. Scaled from the measured macOS 72/87.3. */
    emojiOnlySize: 58,
    emojiOnlyLineHeight: 70,
    emojiOnlyInset: 4,
    letterSpacing: 0,
  },
  macos: {
    fontSize: 13,
    lineHeight: 14.7,
    paddingX: 12.5,
    paddingY: 7.03,
    // 14.5, not 14. An arc anchored to the four-line bubble's own measured straight edges (left
    // 227.477, top 493.976 in conversation-pane-light.png) fits 25 sub-pixel rows of the top
    // corners at 0.119 rmse; r = 14 fits at 0.194 with all 25 residuals on the same side. The same
    // routine run against our own 14.5 render returns 14.42, so native's 14.39 reads as 14.46 once
    // that bias is removed. What is left at 14.5 is a symmetric S of +-0.15, twice our own render's,
    // which is the shape difference of a slightly continuous corner, not a radius error.
    radius: 14.5,
    minWidth: 40,
    maxWidth: 382.5,
    maxWidthRatio: 0.6068,
    tailScale: 0.7,
    // Native lands every row's top on the device grid (0.5 at 2x), so a single gap reads anywhere
    // from 2.75 to 3.25. The run of six one-line bubbles in conversation-pane-dark.png settles it:
    // tops 379.5 / 411.5 / 443.0 / 475.0 / 506.5 / 538.5, a mean pitch of 31.7997 over five gaps
    // against a body height of 28.7545, so the gap is 3.045 +- 0.1. Do not re-derive it from one
    // pair of bubbles in a pane capture; those read 3.24 or 2.75 depending on the phase.
    gapInGroup: 3,
    gapBetweenGroups: 11.5,
    edgeInset: 20,
    tailOnEveryBubble: false,
    statusFontSize: 9,
    statusLineHeight: 11,
    statusLetterSpacing: 0,
    statusGap: 4,
    statusInset: 15.9,
    emojiOnlySize: 72,
    emojiOnlyLineHeight: 87.3,
    emojiOnlyInset: 4,
    letterSpacing: -0.4,
  },
};

export type ScreenGradient = { top: string; bottom: string; screenHeight: number };

export type Palette = {
  background: string;
  /** Outgoing iMessage blue, screen-space gradient. */
  imessage: ScreenGradient;
  /** Outgoing SMS green, screen-space gradient. */
  sms: ScreenGradient;
  /** Incoming gray, screen-space gradient (nearly flat). */
  incoming: ScreenGradient;
  incomingText: string;
  outgoingText: string;
  secondaryLabel: string;
  edited: string;
  /** Tapback balloon fills. */
  tapbackMine: string;
  tapbackTheirs: string;
  separator: string;
};

/**
 * iOS 26 measured: SMS green from the simulator. The blue and gray gradients are taken from macOS 26,
 * which shares Messages' palette; they are marked as such in SPEC.md until an iOS capture confirms them.
 *
 * Not measured, and not in SPEC.md either: `macos.*.sms` (no macOS capture holds a green bubble; the
 * only green in any of them is the plus-menu app icons), `macos.light.edited`, and both `ios.*.separator`
 * values. Treat them as placeholders, not as measurements.
 */
export const palettes: Record<Platform, { light: Palette; dark: Palette }> = {
  ios: {
    light: {
      background: "#ffffff",
      imessage: { top: "#77c7f5", bottom: "#3682f7", screenHeight: 874 },
      sms: { top: "#53e678", bottom: "#31c355", screenHeight: 874 },
      incoming: { top: "#e9e9eb", bottom: "#e9e9eb", screenHeight: 874 },
      incomingText: "#000000",
      outgoingText: "#ffffff",
      secondaryLabel: "#8a8a8e",
      edited: "#3f8ff7",
      tapbackMine: "#0088ff",
      tapbackTheirs: "#e9e9eb",
      separator: "#c6c6c8",
    },
    dark: {
      background: "#000000",
      imessage: { top: "#589af7", bottom: "#3d8ef7", screenHeight: 874 },
      sms: { top: "#53e678", bottom: "#31c355", screenHeight: 874 },
      incoming: { top: "#262629", bottom: "#262629", screenHeight: 874 },
      incomingText: "#ffffff",
      outgoingText: "#ffffff",
      secondaryLabel: "#8d8d93",
      edited: "#3f8ff7",
      tapbackMine: "#0088ff",
      tapbackTheirs: "#262629",
      separator: "#38383a",
    },
  },
  macos: {
    light: {
      background: "#ffffff",
      imessage: { top: "#77c7f5", bottom: "#3682f7", screenHeight: 640 },
      sms: { top: "#5fe083", bottom: "#35c65b", screenHeight: 640 },
      incoming: { top: "#e9e9eb", bottom: "#e9e9eb", screenHeight: 640 },
      incomingText: "#000000",
      outgoingText: "#ffffff",
      secondaryLabel: "#808080",
      edited: "#1f7cf5",
      tapbackMine: "#5498f8",
      tapbackTheirs: "#e9e9eb",
      separator: "#e1e1e1",
    },
    dark: {
      background: "#1e1e1e",
      imessage: { top: "#589af7", bottom: "#3d8ef7", screenHeight: 640 },
      sms: { top: "#4fd772", bottom: "#33bf56", screenHeight: 640 },
      incoming: { top: "#38383a", bottom: "#3c3c3e", screenHeight: 640 },
      incomingText: "#ffffff",
      outgoingText: "#ffffff",
      secondaryLabel: "#9a9a9a",
      edited: "#3f8ff7",
      tapbackMine: "#5498f8",
      tapbackTheirs: "#3b3b3d",
      separator: "#3a3a3a",
    },
  },
};

/** CSS custom properties that carry a palette, so components stay theme-aware through `.dark`. */
export function paletteVars(p: Palette): Record<string, string> {
  return {
    "--im-bg": p.background,
    "--im-blue-top": p.imessage.top,
    "--im-blue-bottom": p.imessage.bottom,
    "--im-green-top": p.sms.top,
    "--im-green-bottom": p.sms.bottom,
    "--im-gray-top": p.incoming.top,
    "--im-gray-bottom": p.incoming.bottom,
    "--im-incoming-text": p.incomingText,
    "--im-outgoing-text": p.outgoingText,
    "--im-secondary": p.secondaryLabel,
    "--im-edited": p.edited,
    "--im-tapback-mine": p.tapbackMine,
    "--im-tapback-theirs": p.tapbackTheirs,
    "--im-separator": p.separator,
    "--im-screen-h": `${p.imessage.screenHeight}px`,
  };
}

/** System font stacks. `-apple-system` resolves to SF Pro on Apple platforms, which is what native renders. */
export const fontStack = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const emojiFontStack = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
