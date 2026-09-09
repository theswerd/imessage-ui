"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/registry/imessage/avatar";

/**
 * macOS 26 conversation details: the inspector column that slides in from the trailing edge of the
 * Messages window.
 *
 * **NO CAPTURE IN THIS REPO SHOWS THIS PANE.** Every `references/macos/captures/*.png` is a crop of
 * window x 330-960 of a window with no inspector open. The one capture of *any* details view in the
 * repo is `references/ios/captures/details-light.png` / `-dark.png`, which is the phone idiom of the
 * same view controller, and it is used below only where it settles structure (which glyphs, whether
 * the action discs carry labels), never for macOS geometry.
 *
 * Everything else comes from the framework, and every value says which selector it came from.
 *
 * ### How the framework was read
 *
 * macOS Messages is a Mac Catalyst app. Its details view is **not** ChatKit's old
 * `CKDetailsViewController` — that class is ABSENT from ChatKit 26.5. The live view is
 * `CommunicationDetails.DetailsViewController` in
 * `/System/iOSSupport/System/Library/PrivateFrameworks/CommunicationDetails.framework`, which still
 * reads its metrics off `+[CKUIBehavior sharedBehaviors]` and ChatKit's cell classes (those *do*
 * still ship: `CKDetailsChatOptionsCell`, `CKDetailsChatOptionsCheckboxCell`,
 * `CKDetailsSharedWithYouCheckboxCell`, `CKDetailsSegmentedControlCell`,
 * `CKDetailsSearchResultsTitleHeaderCell`, `CKDetailsMapViewCell`, `CKDetailsAddMemberStandardCell`).
 *
 * The probe: a `clang -target arm64-apple-ios26.0-macabi` binary that dlopens both frameworks and
 * swizzles `-[UIDevice userInterfaceIdiom]` to return 5 (Mac), so `sharedBehaviors` vends
 * `CKUIBehaviorMac` and `theme` vends `CKUIThemeMac`. Cross-checks that the probe is reading genuine
 * Mac values: `balloonTextFont` 13, `balloonContiguousSpace` 3, `conversationListContactImageDiameter`
 * 40, `defaultConversationListWidth` 320 and `_transcriptBackgroundColor` #ffffff / #1e1e1e, all of
 * which SPEC has already measured off a capture and all of which agree.
 *
 * ### Structure, from `CommunicationDetails`
 *
 * `DetailsViewController`'s ivars are `headerView`, `detailsPageViewController`, `tabs`,
 * `selectedTab`, `backgroundVisualEffectView`. `Header.HeaderView`'s ivars are `avatarView`,
 * `contactCardHeaderView`, `quickActionsContainerPool`, `horizontalTabsHostingView`,
 * `isHeaderBlurVisible`, `hasScrolledPastTopEdge`, `headerInterpolationProgress`. So: **one pinned
 * header carrying the avatar, the name, the quick actions and a tab strip, over a paged tab body**,
 * with a blur that appears once the body scrolls past the header (`PlatformTopEdgeBlurView`). The
 * tab classes are `DetailsInfoTab`, `DetailsPhotosTab`, `DetailsLinksTab`, `DetailsAttachmentsTab`,
 * `DetailsLocationsTab`, `DetailsWalletTab`, `DetailsBackgroundsTab`. This component builds Info,
 * Photos, Links and Documents; Locations, Wallet and Backgrounds are not built (see the report).
 *
 * The tab strip's own pixels are **UNMEASURED** — `DetailsTabBarView`, `SegmentedTabControl` and
 * `TabSegmentView` are Swift, they carry a `styleGuide` struct no ObjC probe can reach, and their
 * `init(frame:)` is `fatalError`. Only its existence is established, not its metrics. See
 * `macDetailsUnmeasured`.
 *
 * ### Geometry, from `CKUIBehaviorMac` (every one of these reproduces exactly)
 *
 * | Value | Selector |
 * |---|---|
 * | column 300 wide, user-resizable 280-400 | `defaultInspectorColumnWidth`, `min…`, `max…` |
 * | content inset 16 | `searchDetailsLeadingAndTrailingMaxPadding` = `searchDetailsResultsInsets`.leading/.trailing |
 * | body scroll insets 12 top, 16 bottom | `searchDetailsResultsInsets` (t12 l16 b16 r16) |
 * | section margin 10 above and below | `searchDetailsSectionMarginInsets` (t10 l0 b10 r16) |
 * | section heading 16 above, 2 outside the content margin | `detailsSectionHeaderPaddingAbove`, `detailsSectionHeaderPaddingLeading` (-2) |
 * | contact photo Ø 37, cut-out Ø 41 (a 2 pt ring), radius 20.5 | `detailsAvatarDiameter` = `detailsViewContactImageDiameter`, `detailsAvatarCutoutDiameter`, `detailsAvatarCornerRadius` |
 * | photo to name 12, name to subtitle 1 | `detailsContactAvatarLabelSpacing`, `detailsGroupHeaderCellInterTextVerticalSpacing` |
 * | group photo stack 58 wide for two, 72 for three | `detailsAvatarPancakeViewWidth2Avatars`, `…3Avatars` |
 * | quick action Ø 32 | `detailsAddButtonDiameter`, the only circular details button the framework vends |
 * | 12 between quick actions | the l6 + r6 of `detailsContactCellButtonEdgeInsets` (t8 l6 b8 r6) — **a transfer**, those insets are `CKDetailsContactCell`'s trailing buttons (box 25 × 25, `detailsContactCellButtonWidth`/`Height`); `detailsCellLabelPadding` gives the same 12 |
 * | glyph to label 12 | `detailsCellLabelPadding` |
 * | photo grid gap 10, tile radius 8 | `searchPhotosInterItemSpacingDetailsView`, `searchPhotosCellZKWAndDetailsCornerRadius` |
 * | link and document row radius 8 | `searchLinksCellCornerRadius` = `searchAttachmentsCellCornerRadius` |
 * | row height 40, option row 44 | `detailsContactCellMinimumHeight`, `+[CKDetailsChatOptionsCell estimatedHeight]` = `+[CKDetailsSharedWithYouCell estimatedHeight]` = `+[CKDetailsAddMemberStandardCell preferredHeight]` |
 * | Hide Alerts and Shared With You are **16 × 16 checkboxes** | `CKDetailsChatOptionsCheckboxCell`, `CKDetailsSharedWithYouCheckboxCell`; a `UISwitch` built under the Mac idiom reports `style` 1 (checkbox) and `intrinsicContentSize` 16 × 16 |
 * | map 196 tall | `detailsViewMapHeight` |
 *
 * ### Type
 *
 * The framework's details fonts are `detailsGroupHeaderCellTitleFont` .SFNS-Regular **17**,
 * `detailsGroupHeaderCellSubtitleFont` .SFNS-Regular **15** and `searchDetailsHeaderFont`
 * .SFNS-Regular **13**. The 17 is not what macOS 26 renders: `conversationListSenderFont` is also 17
 * (semibold) and SPEC measures that same surface at **13** semibold off `conversation-pane-*.png`,
 * while `balloonTextFont` 13 and `searchDetailsHeaderFont` 13 are already Mac-scale and agree with
 * their captures. So the two 17-family details fonts are iOS sizes left in the Mac behaviour object,
 * and their shipping sizes are the framework value × the measured 13/17 = 0.7647:
 *
 * - **Name 13.** 17 × 13/17. Independently, SPEC "macOS Chrome → Header" measures the contact name in
 *   the header pill at **13 pt bold** ("13px/700 `-apple-system` in Chrome reproduces that ink
 *   exactly"), which is the same contact's name one surface away, so the size is corroborated and the
 *   **weight 700** is measured — on the pill, not here.
 * - **Subtitle 11.47.** 15 × 13/17. The framework says Regular.
 * - **Section heading 13 Regular**, `searchDetailsHeaderFont` verbatim, no correction.
 * - **Letter-spacing 0 everywhere.** SPEC's macOS chrome fits ("Search" 13px/500 ink 41.55, the pill
 *   name 13px/700, "Freestyle" 11px/400 ink 47.0) all reproduce native ink with no tracking; the
 *   −0.4 SPEC measures is for *bubble body text*, which this pane has none of.
 *
 * ### Glyphs, rendered out of the framework and traced
 *
 * `detailsViewPhoneImage`, `detailsViewFaceTimeVideoImage` and `detailsViewMessagesImage` are
 * `phone.fill`, `video.fill` and `message.fill` — and a point-size sweep pins all three to **17 pt
 * Regular**, because 17 pt is the only size where `phone.fill` is {19.5, 17.5}, `video.fill` is
 * {24, 15.5} and `message.fill` is {22.5, 18} simultaneously, which are exactly the three sizes the
 * selectors return. That is what fixes the envelope too: the details view has no mail image on
 * `CKUIBehaviorMac`, but `envelope.fill` at the same 17 pt is {24.5, 16.5}, and the iOS capture shows
 * the third disc as an envelope.
 *
 * Each image was drawn into a 16x bitmap and traced on the alpha 0.5 isoline, so the ink boxes below
 * are measured, not read off `contentInsets` (they agree):
 *
 * | Image | Image box | Ink box | Ink origin |
 * |---|---|---|---|
 * | `phone.fill` @17 | 19.5 × 17.5 | 15.4988 × 15.4990 | (2.0002, 1.0007) |
 * | `video.fill` @17 | 24 × 15.5 | 20.5000 × 13.5000 | (2.5000, 1.0000) |
 * | `message.fill` @17 | 22.5 × 18 | 19.4988 × 15.9993 | (1.5005, 1.0005) |
 * | `envelope.fill` @17 | 24.5 × 16.5 | 20.5000 × 14.5000 | (2.0000, 1.0000) |
 * | `info.circle` @`macToolbarImagePointSize` 22 (`macToolbarDetailsImage`) | 26 × 25 | 21.9995 × 21.9995 | (2.0002, 1.5002) |
 *
 * Each `<svg>` below sets `viewBox` to its ink box and `width`/`height` to the ink box's size, so the
 * glyph paints at exactly the measured ink. (The old file scaled a 23-unit viewBox to 22 and painted
 * every info glyph 4.3% small.)
 *
 * ### The panel's own shape: the sidebar's, mirrored
 *
 * There is **no divider**. SPEC "macOS Chrome → Sidebar" measures the macOS 26 conversation list as a
 * *floating panel*, not a column: inset 8 from the window's left, top and bottom, continuous corner
 * (`border-radius: 22px; corner-shape: superellipse(1.4)`, best circle 17.75), 1 pt bright rim
 * (#ffffff / #424242), panel fill #fafafa / #1b1b1b over a window ground of #f8f8f8 / #1c1c1c, and
 * explicitly "**no divider line**". The pane behind it starts 2 pt past the panel (panel 8-328, pane
 * from 330).
 *
 * This file gives the inspector that same shape mirrored to the trailing edge, so the pushed
 * conversation's trailing inset is `inset + width + gapToPane` = 8 + 300 + 2 = 310. The *shape* is
 * measured; that the inspector uses it is judgement, and it is the only judgement in the panel's
 * chrome. The old file's `--mdt-separator` rim was SPEC's sidebar **conversation-row** separator
 * borrowed onto a panel edge; that colour is now used only where it belongs, between rows.
 *
 * ### The presentation is UNMEASURED
 *
 * Nothing in this repo records this pane in motion and ChatKit vends no timing for it: a scan of
 * every `*duration*` selector on `CKUIBehaviorMac` returns 28 values, none of them inspector- or
 * details-named. `macDetailsMotion` is therefore a choice, not a reading. It is deliberately plain —
 * the panel slides, the conversation's trailing inset follows it, and nothing staggers, because an
 * AppKit/Catalyst inspector column slides as one piece; the old per-section stagger was a phone-sheet
 * idiom.
 *
 * Copy comes from `ChatKit.loctable` and `CommunicationDetails.loctable`, verbatim: "Hide Details"
 * (`HIDE_DETAILS_VIEW`), "Info" (`CONTACT_INFO_SHORT`), "Photos" (`PHOTOS_MENU_ITEM_TITLE`), "Links"
 * (`LINKS`), "Documents" (`SEARCH_ATTACHMENTS_TITLE`), "See All Photos" / "See All Links" / "See All
 * Attachments" (`SEE_ALL_*_TITLE`), "Hide Alerts" (`DETAILS_VIEW_HIDE_ALERTS_TOGGLE_TITLE`), "Send
 * Read Receipts" (`READ_RECEIPTS`), "Shared With You" (`SHARED_WITH_YOU_TITLE`), "Create New Contact"
 * (`CREATE_NEW_CONTACT`), "Add to Existing Contact" (`ADD_TO_EXISTING_CONTACT`), "Block Contact"
 * (`BLOCK_CONTACT`), "Delete and Block Conversation" (`DELETE_AND_BLOCK_CONVERSATION`), "Delete
 * Conversation…" (`DELETE_CONVERSATION_ELLIPSIS`), "Leave this Conversation" (`LEAVE_CONVERSATION`),
 * "Call" / "FaceTime" / "Mail" / "Message" (`CommunicationDetails`).
 */

const font = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif';

/**
 * The measured macOS:iOS type ratio, 13/17. SPEC measures macOS bubble text at 13 where the phone
 * measures 17, and measures the macOS conversation list at 13 semibold where `conversationListSenderFont`
 * says 17 semibold. Applied to the two details fonts that are still carrying iOS sizes.
 */
const macTypeScale = 13 / 17;

/** Framework geometry. Anything without a selector beside it is in `macDetailsUnmeasured`. */
export const macDetailsMetrics = {
  /** `defaultInspectorColumnWidth`, with the min and max the column can be dragged between. */
  width: 300,
  minWidth: 280,
  maxWidth: 400,
  /** SPEC "macOS Chrome → Sidebar": the floating panel is inset 8 and the pane resumes 2 past it. */
  inset: 8,
  gapToPane: 2,
  /** SPEC "macOS Chrome → Sidebar": best circle 17.75, `superellipse(1.4)` at 22. */
  cornerRadius: 17.75,
  continuousRadius: 22,
  /** `searchDetailsLeadingAndTrailingMaxPadding`, = `searchDetailsResultsInsets` leading/trailing. */
  contentInset: 16,
  /** `searchDetailsResultsInsets` top and bottom. */
  scrollTop: 12,
  scrollBottom: 16,
  /** `searchDetailsSectionMarginInsets` t10 b10. Its l0/r16 are dropped: the scroll box already
   *  carries 16 on both sides from `searchDetailsResultsInsets`, and applying r16 again would inset
   *  every section's trailing edge to 32. */
  sectionMargin: 10,
  /** `detailsSectionHeaderPaddingAbove` and `detailsSectionHeaderPaddingLeading`. */
  headingAbove: 16,
  headingLeading: -2,
  /** `detailsAvatarDiameter` = `detailsViewContactImageDiameter`; `detailsAvatarCutoutDiameter` is
   *  41, i.e. a 2 pt ring of the panel's fill knocked out behind each overlapping face. */
  avatar: 37,
  avatarCutoutRing: 2,
  /** `detailsAvatarPancakeViewWidth2Avatars` / `…3Avatars`, so the step is 21 for two and 17.5 for three. */
  stack: { two: 58, three: 72 },
  /** `detailsContactAvatarLabelSpacing` and `detailsGroupHeaderCellInterTextVerticalSpacing`. */
  avatarGap: 12,
  nameGap: 1,
  /** `detailsAddButtonDiameter` — the only circular details-view button diameter the framework
   *  vends. `CommunicationDetails.QuickActionView` is Swift and has none of its own. */
  actionButton: 32,
  /** The l6 + r6 of `detailsContactCellButtonEdgeInsets`. **A transfer**: those insets belong to
   *  `CKDetailsContactCell`'s trailing buttons (`detailsContactCellButtonWidth`/`Height` 25), not to
   *  the quick actions. `detailsCellLabelPadding` independently gives the same 12. */
  actionGap: 12,
  /** `searchPhotosInterItemSpacingDetailsView`, `searchPhotosCellZKWAndDetailsCornerRadius`. */
  photoGap: 10,
  photoRadius: 8,
  /** `searchLinksCellCornerRadius` = `searchAttachmentsCellCornerRadius`. */
  cardRadius: 8,
  /** `detailsContactCellMinimumHeight`; `+[CKDetailsChatOptionsCell estimatedHeight]`. */
  rowHeight: 40,
  optionHeight: 44,
  /** `detailsCellLabelPadding`: a details cell's glyph-to-label gap. */
  rowGap: 12,
  /** `-[UISwitch intrinsicContentSize]` under the Mac idiom, where `style` resolves to checkbox. */
  checkbox: 16,
  font: {
    /** `detailsGroupHeaderCellTitleFont` 17 × 13/17; corroborated by SPEC's measured 13 pt bold header pill. */
    name: 13,
    nameWeight: 700,
    /** `detailsGroupHeaderCellSubtitleFont` 15 × 13/17. */
    subtitle: 15 * macTypeScale,
    /** `searchDetailsHeaderFont`, .SFNS-Regular 13, verbatim. */
    heading: 13,
    headingWeight: 400,
    body: 13,
  },
} as const;

/**
 * Every *number* this file draws that no capture and no framework selector settles, kept as data so a
 * later capture session can work straight off it. Everything in here is read by the code below, so
 * nothing is declared and left unused. Two unmeasured **colour tokens** are not here, because they can
 * only live in the CSS variables: `--mdt-hover` (6% black / 8% white — `detailsAddButtonBackgroundColor`
 * is the *resting* control fill, 9.8%, and nothing vends a hover) and `--mdt-scrim` (10% / 28% black,
 * overlay mode only). The panel's drop shadow is unmeasured too: SPEC records the sidebar's as a
 * ground ramp (#f8f8f8 → #f4f4f4), not a CSS shadow.
 */
export const macDetailsUnmeasured = {
  /** Space under a section heading before its content. `searchResultsTitleHeaderDetailsTopPadding`
   *  is 12 but names the *top* padding of the title header, so it is not this. */
  headingToContent: 8,
  /** Horizontal padding inside a hoverable row, so its 8-radius hover fill clears the text. */
  rowPadding: 6,
  /** Columns in the photo grid. Nothing in the framework says how many the 300 column runs. */
  photoColumns: 3,
  /** Rows of the grid the Info tab previews before "See All Photos", and how many link/document
   *  rows it previews. */
  previewPhotoRows: 2,
  previewRows: 3,
  /** The checkbox's corner. Only its 16 × 16 box is the framework's. */
  checkboxRadius: 3.5,
  /** The whole tab strip. `DetailsTabBarView` / `SegmentedTabControl` / `TabSegmentView` are Swift
   *  and their `styleGuide` is unreachable from ObjC; only the strip's existence is established. */
  tab: { height: 24, radius: 7, paddingInline: 10, gap: 2, fontSize: 13 },
  /** The top-edge blur band (`PlatformTopEdgeBlurView`) that appears once the body scrolls. */
  scrollEdgeBlur: 12,
} as const;

/**
 * UNMEASURED, and unmeasurable from anything committed here: no capture records the pane in motion,
 * and a scan of all 28 `*duration*` selectors on `CKUIBehaviorMac` turns up nothing details- or
 * inspector-named. These sit in the family the kit already uses.
 *
 * - The slide runs 300 ms on `cubic-bezier(0.32, 0.72, 0, 1)`, the curve `ios-details.tsx` (320 ms)
 *   and `ios-effects-picker.tsx` (260 ms) both use.
 * - The way out is 250 ms, between the measured macOS menu dismiss (~120 ms) and the iOS details
 *   dismiss (260 ms).
 * - Nothing staggers. An inspector column slides as one piece.
 *
 * The push is a real layout change: the conversation's trailing inset animates, so a transcript
 * rewraps while it runs, which is what a native split view does when the inspector opens.
 */
export const macDetailsMotion = {
  enter: 300,
  exit: 250,
  dim: 220,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
  exitEase: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

/**
 * Light and dark live in CSS variables so a `.dark` ancestor flips the whole pane, the way every
 * other file in the kit does it. The six label/tint/fill/destructive pairs are `CKUIThemeMac`'s, and
 * `--mdt-panel` / `--mdt-ground` / `--mdt-rim` are SPEC's measured sidebar panel, ground and rim; see
 * the header. Two more are reuses of measured macOS colours from other surfaces, named as such:
 * `--mdt-row-separator` is SPEC's sidebar **conversation-row** separator (a row separator used as a
 * row separator, not as a panel edge — the old file put it on the panel's leading edge), and
 * `--mdt-tile` is SPEC's measured **incoming bubble** fill, standing in for a photo that has not
 * loaded. `--mdt-hover` and `--mdt-scrim` are unmeasured.
 */
const vars =
  "[--mdt-panel:#fafafa] [--mdt-ground:#f8f8f8] [--mdt-rim:#ffffff] [--mdt-label:rgba(0,0,0,0.8471)] " +
  "[--mdt-secondary:rgba(0,0,0,0.4980)] [--mdt-tertiary:rgba(0,0,0,0.2588)] [--mdt-tint:#0088ff] " +
  "[--mdt-fill:rgba(0,0,0,0.098)] [--mdt-hover:rgba(0,0,0,0.06)] [--mdt-red:#ff383c] " +
  "[--mdt-row-separator:#e1e1e1] [--mdt-tile:#e9e9eb] [--mdt-scrim:rgba(0,0,0,0.10)] [--mdt-knob:#ffffff] " +
  "dark:[--mdt-panel:#1b1b1b] dark:[--mdt-ground:#1c1c1c] dark:[--mdt-rim:#424242] dark:[--mdt-label:rgba(255,255,255,0.8471)] " +
  "dark:[--mdt-secondary:rgba(255,255,255,0.5490)] dark:[--mdt-tertiary:rgba(255,255,255,0.2471)] dark:[--mdt-tint:#0091ff] " +
  "dark:[--mdt-fill:rgba(255,255,255,0.098)] dark:[--mdt-hover:rgba(255,255,255,0.08)] dark:[--mdt-red:#ff4245] " +
  "dark:[--mdt-row-separator:#3a3a3a] dark:[--mdt-tile:#3b3b3d] dark:[--mdt-scrim:rgba(0,0,0,0.28)]";

/** The focus ring the rest of the macOS chrome uses (`macos-header.tsx`, `macos-composer.tsx`). */
const focusRing = "outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#3478f6]";

export type MacDetailsTab = "info" | "photos" | "links" | "documents";

/** `CommunicationDetails.loctable`: Call / FaceTime / Mail / Message are its four action titles. */
export type MacDetailsAction = {
  id: string;
  /** The button's accessible name and tooltip. The discs carry **no visible label**: the only
   *  capture of this view anywhere in the repo, `references/ios/captures/details-light.png`, draws
   *  three bare discs. `CommunicationDetails.QuickActionView` still has a `title` property, which is
   *  what this is. */
  label: string;
  icon: "phone" | "video" | "message" | "mail";
  disabled?: boolean;
  onPress?: () => void;
};

export type MacDetailsPhoto = {
  id: string;
  /** Photo URL. Without one the tile paints `fill`, so the pane renders with no assets. */
  src?: string;
  fill?: string;
  alt?: string;
  onOpen?: () => void;
};

export type MacDetailsLink = {
  id: string;
  title: string;
  /** The hostname under the title. */
  host: string;
  onOpen?: () => void;
};

export type MacDetailsAttachment = {
  id: string;
  name: string;
  /** A size, a date, whatever belongs on the second line. */
  meta?: string;
  onOpen?: () => void;
};

/** A handle on the contact card (`CommunicationDetailsContactCard`): "phone" / "+1 (555) 010-0100". */
export type MacDetailsHandle = {
  id: string;
  /** "phone", "home", "iMessage" — the small label above the value. */
  label: string;
  value: string;
  onPress?: () => void;
};

export type MacDetailsParticipant = { id: string; name: string; initials?: string; photo?: string; subtitle?: string };

export type MacDetailsProps = Omit<ComponentProps<"div">, "children" | "onChange"> & {
  name: string;
  initials?: string;
  /** Contact photo URL, or a whole avatar node. */
  photo?: string;
  avatar?: ReactNode;
  /** Two or more of these draw the group photo stack instead of one circle, and give the header a
   *  disclosure that opens the participant list. */
  participants?: MacDetailsParticipant[];
  /** The handle under the name, or the participant count for a group. */
  subtitle?: string;

  actions?: MacDetailsAction[];
  /** The contact card's handles. */
  handles?: MacDetailsHandle[];
  /** Shown when the contact is not in Contacts (`CREATE_NEW_CONTACT` / `ADD_TO_EXISTING_CONTACT`). */
  onCreateContact?: () => void;
  onAddToContact?: () => void;

  photos?: MacDetailsPhoto[];
  links?: MacDetailsLink[];
  attachments?: MacDetailsAttachment[];

  /** `DETAILS_VIEW_HIDE_ALERTS_TOGGLE_TITLE`, `READ_RECEIPTS`, `SHARED_WITH_YOU_TITLE`. Each row
   *  appears only when its handler does. All three are checkboxes on the Mac. */
  hideAlerts?: boolean;
  onHideAlertsChange?: (next: boolean) => void;
  readReceipts?: boolean;
  onReadReceiptsChange?: (next: boolean) => void;
  sharedWithYou?: boolean;
  onSharedWithYouChange?: (next: boolean) => void;

  /** A group conversation offers Leave in place of Block. */
  onLeave?: () => void;
  onBlock?: () => void;
  onDelete?: () => void;

  /** Closes the pane. Escape from inside the panel does the same. */
  onClose?: () => void;

  /** Opens the header's participant disclosure on mount. */
  defaultParticipantsOpen?: boolean;

  /** The selected tab. Uncontrolled unless `tab` is given. */
  tab?: MacDetailsTab;
  defaultTab?: MacDetailsTab;
  onTabChange?: (next: MacDetailsTab) => void;

  /**
   * The conversation the pane opens beside. `push` insets it by the pane's footprint as the pane
   * slides in, which is what an inspector column does; `overlay` leaves it alone, dims it, and makes
   * it `inert` so nothing behind the scrim is still tabbable.
   */
  conversation?: ReactNode;
  mode?: "push" | "overlay";
  /** Controlled column width. Leave unset to let the drag handle own it. */
  width?: number;
  defaultWidth?: number;
  onWidthChange?: (next: number) => void;
  /** False removes the drag handle and the keyboard resize. */
  resizable?: boolean;

  /**
   * Seek the presentation instead of playing it, which is what the harness does: while `open`, 0 is
   * closed and 1 is settled; while it is closing, 0 is settled and 1 is gone. Leave it unset for the
   * real thing.
   */
  progress?: number;
  /** False plays the dismissal; `onExited` fires when it is over, and the consumer unmounts then. */
  open?: boolean;
  onExited?: () => void;
};

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function clamp(value: number, low: number, high: number) { return Math.max(low, Math.min(high, value)); }
function stop(animation: Animation) { try { animation.cancel(); } catch { /* already gone */ } }

type Pose = Record<string, string>;
type Layer = { el: HTMLElement; from: Pose; to: Pose; duration: number; delay: number; easing: string };

/**
 * Every layer of the presentation, as the pose it holds while closed and the pose it settles on. The
 * settled pose is what each element already carries at rest, so cancelling the timeline once it lands
 * leaves the pane with no animation and no transform at all, and a settled checkpoint screenshots the
 * plain styles twice over.
 */
function detailsLayers(panel: HTMLElement, pane: HTMLElement | null, scrim: HTMLElement | null, travel: number, push: number): Layer[] {
  const m = macDetailsMotion;
  const layers: Layer[] = [];
  const add = (el: HTMLElement | null, from: Pose, to: Pose, duration: number, delay = 0, easing: string = m.ease) => {
    if (el) layers.push({ el, from, to, duration, delay, easing });
  };
  add(panel, { translate: `${travel}px 0px` }, { translate: "0px 0px" }, m.enter);
  // The push is the conversation's own trailing inset. Native's split view relays out the transcript
  // while the inspector opens too — this is a layout animation on purpose, not an oversight.
  add(pane, { right: "0px" }, { right: `${push}px` }, m.enter);
  add(scrim, { opacity: "0" }, { opacity: "1" }, m.dim, 0, "ease-out");
  return layers;
}

/** What an element holds right now, so a dismissal can start from a half-played entrance. */
function poseNow(el: HTMLElement, shape: Pose): Pose {
  const style = getComputedStyle(el);
  const pose: Pose = {};
  for (const key of Object.keys(shape)) pose[key] = style.getPropertyValue(key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)) || shape[key];
  return pose;
}

/** Web Animations, not a rAF loop and not a transition, so `document.getAnimations()` can seek a frame. */
function runLayers(layers: Layer[], phase: "enter" | "exit"): Animation[] {
  const m = macDetailsMotion;
  return layers.map(({ el, from, to, duration, delay, easing }) => phase === "enter"
    ? el.animate([from, to], { duration, delay, easing, fill: "both" })
    // One flat span on the way out, starting from wherever the layer stands now.
    : el.animate([poseNow(el, from), from], { duration: m.exit, easing: m.exitEase, fill: "both" }));
}

/**
 * The quick actions' glyphs, at the ink boxes traced off the framework's own 16x renders. Each
 * `viewBox` *is* the ink box, so `width`/`height` paint the measured ink exactly. See the header
 * table for the boxes and the point-size sweep that pins all four to 17 pt.
 */
function ActionGlyph({ icon }: { icon: MacDetailsAction["icon"] }) {
  if (icon === "phone") {
    return (
      <svg aria-hidden="true" width="15.5" height="15.5" viewBox="2 1 15.5 15.5" fill="currentColor">
        <path d="M4.500,0.989 L3.562,1.416 L2.673,2.250 L2.101,3.438 L1.970,4.562 L2.164,5.938 L2.664,7.312 L3.486,8.812 L4.615,10.375 L6.188,12.114 L7.625,13.453 L9.375,14.772 L11.125,15.757 L12.750,16.328 L14.000,16.468 L15.188,16.275 L16.250,15.706 L17.144,14.688 L17.460,13.875 L17.343,13.250 L16.750,12.661 L14.500,11.056 L13.938,10.784 L13.125,10.850 L11.312,11.821 L10.812,11.837 L10.188,11.522 L9.250,10.833 L7.482,9.062 L6.728,8.000 L6.524,7.438 L7.647,5.312 L7.639,4.500 L7.331,3.875 L5.443,1.312 L4.938,0.990Z" />
      </svg>
    );
  }
  if (icon === "video") {
    return (
      <svg aria-hidden="true" width="20.5" height="13.5" viewBox="2.5 1 20.5 13.5" fill="currentColor">
        <path d="M4.688,1.000 L3.812,1.243 L3.177,1.688 L2.734,2.312 L2.481,3.250 L2.476,12.125 L2.668,13.000 L3.037,13.625 L3.812,14.211 L5.062,14.467 L14.438,14.461 L15.312,14.269 L15.938,13.907 L16.570,13.062 L16.791,11.875 L16.782,3.250 L16.637,2.500 L16.267,1.812 L15.500,1.221 L14.500,0.976Z" />
        <path d="M21.812,2.242 L21.438,2.345 L20.938,2.674 L17.953,5.250 L17.930,10.125 L20.938,12.764 L21.438,13.092 L21.875,13.201 L22.250,13.147 L22.605,12.938 L22.959,12.250 L22.969,3.438 L22.899,2.938 L22.668,2.562 L22.250,2.290Z" />
      </svg>
    );
  }
  if (icon === "message") {
    return (
      <svg aria-hidden="true" width="19.5" height="16" viewBox="1.5 1 19.5 16" fill="currentColor">
        <path d="M10.312,1.000 L7.750,1.427 L6.375,1.919 L5.375,2.429 L4.375,3.105 L3.348,4.062 L2.667,4.938 L2.168,5.812 L1.609,7.500 L1.475,9.375 L1.601,10.438 L1.858,11.375 L3.148,13.875 L3.322,14.562 L3.141,15.562 L2.420,16.500 L2.428,16.688 L2.625,16.897 L3.438,16.955 L4.500,16.769 L5.500,16.395 L6.188,15.980 L8.188,16.639 L10.438,16.953 L12.688,16.894 L14.625,16.525 L16.438,15.840 L18.062,14.828 L19.403,13.500 L20.267,12.125 L20.634,11.188 L20.893,10.062 L20.968,9.000 L20.893,7.875 L20.635,6.750 L20.268,5.812 L19.145,4.125 L18.438,3.420 L17.438,2.663 L16.312,2.037 L15.250,1.606 L12.750,1.050Z" />
      </svg>
    );
  }
  // `envelope.fill` at the same 17 pt: image 24.5 × 16.5, ink 20.5 × 14.5 from (2, 1).
  return (
    <svg aria-hidden="true" width="20.5" height="14.5" viewBox="2 1 20.5 14.5" fill="currentColor">
      <path d="M9.375,8.737 L2.986,15.062 L3.125,15.204 L3.625,15.387 L4.312,15.468 L20.062,15.469 L20.812,15.386 L21.441,15.125 L15.062,8.737 L13.375,10.091 L12.875,10.331 L12.188,10.438 L11.562,10.331 L11.062,10.091Z" />
      <path d="M4.125,0.991 L3.375,1.166 L2.951,1.438 L11.500,8.894 L12.188,9.153 L12.625,9.073 L12.938,8.889 L21.478,1.438 L20.875,1.103 L20.062,0.972Z" />
      <path d="M2.188,2.408 L2.036,2.812 L1.969,3.625 L1.971,13.062 L2.188,14.081 L8.459,7.875Z" />
      <path d="M22.250,2.408 L15.978,7.875 L22.250,14.081 L22.398,13.625 L22.469,12.812 L22.466,3.375 L22.389,2.750Z" />
    </svg>
  );
}

/**
 * `macToolbarDetailsImage`: `info.circle` at `macToolbarImagePointSize` 22, image 26 × 25, traced ink
 * 21.9995 square from (2.0002, 1.5002). The ring is the first two contours with `evenodd`, then the
 * stem and the dot.
 */
function InfoGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="2 1.5 22 22" fill="currentColor" fillRule="evenodd">
      <path d="M12.188,1.494 L10.062,1.853 L8.188,2.560 L6.375,3.663 L4.670,5.250 L3.422,7.000 L2.611,8.750 L2.045,11.125 L1.984,13.125 L2.353,15.375 L3.060,17.250 L4.163,19.062 L5.688,20.712 L7.188,21.830 L9.250,22.827 L11.188,23.329 L13.562,23.458 L15.625,23.149 L17.750,22.377 L19.562,21.275 L21.212,19.750 L22.330,18.250 L23.327,16.188 L23.829,14.250 L23.958,11.875 L23.649,9.812 L22.878,7.688 L21.775,5.875 L20.188,4.170 L18.312,2.851 L16.312,1.983 L14.312,1.545Z M12.559,3.312 L14.438,3.415 L16.125,3.854 L17.688,4.602 L19.188,5.728 L20.334,7.000 L21.326,8.688 L21.955,10.625 L22.140,12.438 L21.955,14.312 L21.461,15.938 L20.638,17.500 L19.468,18.938 L18.000,20.138 L16.438,20.961 L14.812,21.455 L13.000,21.640 L11.125,21.455 L9.500,20.961 L7.938,20.138 L6.500,18.968 L5.299,17.500 L4.477,15.938 L3.982,14.312 L3.798,12.500 L3.915,11.000 L4.354,9.312 L5.102,7.750 L6.228,6.250 L7.500,5.104 L9.062,4.168 L10.625,3.600Z M11.062,10.548 L10.709,10.750 L10.491,11.125 L10.489,11.438 L10.688,11.808 L11.062,12.027 L12.375,12.043 L12.414,12.125 L12.414,16.938 L11.000,16.987 L10.628,17.125 L10.299,17.625 L10.433,18.188 L10.750,18.443 L11.062,18.511 L15.438,18.513 L15.875,18.405 L16.158,18.125 L16.258,17.812 L16.195,17.438 L16.000,17.180 L15.562,16.989 L14.138,16.938 L14.138,11.500 L14.018,10.938 L13.804,10.688 L13.438,10.535Z M12.625,5.932 L12.062,6.165 L11.727,6.500 L11.491,7.062 L11.486,7.562 L11.670,8.062 L12.125,8.525 L12.562,8.708 L13.188,8.707 L13.625,8.524 L14.075,8.062 L14.255,7.562 L14.264,7.125 L14.020,6.500 L13.688,6.166 L13.125,5.934Z" />
    </svg>
  );
}

/**
 * The group header's disclosure: `detailsGroupHeaderCellChevronForwardName` (`chevron.forward.circle`)
 * closed, `detailsGroupHeaderCellChevronDownName` (`chevron.down.circle`) open, at
 * `detailsGroupHeaderCellChevronFont` **17 pt**. Both images are {20, 19} with `contentInsets`
 * {1, 1.5, 1, 1.5}, and both trace to an ink box of **16.9985 square** from (1.5007, 1.0007). The two
 * share their ring exactly; only the chevron inside it differs.
 */
function DisclosureGlyph({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="1.5 1 17 17" fill="currentColor" fillRule="evenodd">
      <path d="M9.312,0.994 L7.875,1.225 L6.312,1.790 L4.875,2.662 L3.679,3.750 L2.735,5.000 L1.975,6.562 L1.544,8.312 L1.482,10.000 L1.725,11.562 L2.290,13.125 L3.162,14.562 L4.250,15.758 L5.500,16.703 L7.062,17.462 L8.812,17.894 L10.500,17.956 L12.062,17.712 L13.625,17.147 L15.062,16.275 L16.258,15.188 L17.203,13.938 L17.962,12.375 L18.394,10.625 L18.456,8.938 L18.212,7.375 L17.648,5.812 L16.775,4.375 L15.688,3.179 L14.438,2.235 L12.875,1.475 L11.125,1.044Z M9.122,2.438 L10.625,2.412 L11.750,2.606 L13.062,3.094 L14.375,3.917 L15.256,4.750 L16.150,6.000 L16.702,7.250 L17.021,8.750 L17.021,10.188 L16.760,11.500 L16.217,12.812 L15.520,13.875 L14.688,14.756 L13.438,15.650 L12.188,16.202 L10.688,16.521 L9.250,16.521 L7.938,16.260 L6.625,15.717 L5.562,15.020 L4.682,14.188 L3.787,12.938 L3.236,11.688 L2.917,10.188 L2.917,8.750 L3.178,7.438 L3.720,6.125 L4.417,5.062 L5.250,4.182 L6.500,3.287 L7.750,2.736Z" />
      {open
        ? <path d="M6.188,7.607 L5.938,7.721 L5.721,8.000 L5.693,8.312 L5.870,8.688 L9.250,12.261 L9.938,12.573 L10.375,12.470 L10.762,12.188 L14.062,8.679 L14.253,8.250 L14.148,7.875 L13.875,7.658 L13.562,7.603 L13.250,7.732 L9.938,11.165 L6.750,7.789 L6.438,7.611Z" />
        : <path d="M8.250,5.247 L7.907,5.625 L8.000,6.186 L11.456,9.438 L7.970,12.812 L7.876,13.125 L7.988,13.500 L8.250,13.706 L8.500,13.734 L8.938,13.584 L12.438,10.277 L12.707,9.875 L12.777,9.438 L12.700,9.062 L12.450,8.688 L9.000,5.426 L8.688,5.227Z" />}
    </svg>
  );
}

/**
 * macOS 26 checkbox, the control `CKDetailsChatOptionsCheckboxCell` and
 * `CKDetailsSharedWithYouCheckboxCell` put on their rows. Its 16 × 16 box is the framework's
 * (`-[UISwitch intrinsicContentSize]` under the Mac idiom, where `style` resolves to
 * `UISwitchStyleCheckbox`); the corner and the tick are drawn, not measured — see
 * `macDetailsUnmeasured.checkboxRadius`.
 */
export type MacCheckboxProps = Omit<ComponentProps<"button">, "onChange"> & {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
};

export function MacCheckbox({ checked = false, onChange, label, className, style, ...rest }: MacCheckboxProps) {
  const size = macDetailsMetrics.checkbox;
  return (
    <button
      type="button"
      data-slot="mac-checkbox"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={cn("relative shrink-0 transition-colors motion-reduce:transition-none", focusRing, className)}
      style={{
        width: size, height: size,
        borderRadius: macDetailsUnmeasured.checkboxRadius,
        background: checked ? "var(--mdt-tint)" : "var(--mdt-fill)",
        boxShadow: checked ? "none" : "inset 0 0 0 1px var(--mdt-tertiary)",
        ...style,
      }}
      {...rest}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" width={size} height={size} className="block" fill="none"
        stroke="var(--mdt-knob)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ opacity: checked ? 1 : 0 }}>
        <path d="M4.2 8.4 6.9 11.1 11.9 5.2" />
      </svg>
    </button>
  );
}

/**
 * The group photo stack (`CKDetailsAvatarPancakeView`). The widths are the framework's, so the step
 * is (58 − 37) = 21 for two faces and (72 − 37)/2 = 17.5 for three. Each overlapping face carries the
 * 41 pt cut-out — `detailsAvatarCutoutDiameter` 41 around a `detailsAvatarDiameter` 37 is a 2 pt ring
 * of the panel's own fill — so the faces read as separated discs rather than one smeared blob.
 *
 * `detailsAvatarPancakeViewOverlapOffset` is 13.5 and reconciles with neither step (37 − 21 = 16,
 * 37 − 17.5 = 19.5). It is recorded, not applied; the two widths are the more specific selectors.
 */
function ContactPhoto({ name, initials, photo, avatar, participants }: Pick<MacDetailsProps, "name" | "initials" | "photo" | "avatar" | "participants">) {
  const { avatar: size, stack, avatarCutoutRing } = macDetailsMetrics;
  const people = participants ?? [];
  if (avatar) return <span className="flex">{avatar}</span>;
  if (people.length < 2) return <Avatar size={size} initials={initials} src={photo} name={name} />;
  const shown = people.slice(0, 3);
  const width = shown.length === 2 ? stack.two : stack.three;
  const step = (width - size) / (shown.length - 1);
  return (
    <span className="relative block" style={{ width, height: size }} role="img" aria-label={shown.map(person => person.name).join(", ")}>
      {shown.map((person, index) => (
        <span key={person.id} className="absolute top-0 rounded-full" style={{
          left: index * step,
          zIndex: shown.length - index,
          // The cut-out: a 2 pt ring of the panel's fill, which is what a 41 cut-out around a 37 face is.
          boxShadow: index === 0 ? undefined : `0 0 0 ${avatarCutoutRing}px var(--mdt-panel)`,
        }}>
          <Avatar size={size} initials={person.initials} src={person.photo} name={person.name} aria-hidden="true" />
        </span>
      ))}
    </span>
  );
}

/** `CKDetailsSearchResultsTitleHeaderCell`, with its "See All …" trailing button. */
function SectionHeading({ id, title, action, onAction }: { id: string; title: string; action?: string; onAction?: () => void }) {
  const m = macDetailsMetrics;
  return (
    <div className="flex items-baseline justify-between"
      style={{ paddingTop: m.headingAbove, marginInlineStart: m.headingLeading, marginBottom: macDetailsUnmeasured.headingToContent }}>
      <h3 id={id} className="m-0 text-[var(--mdt-label)]"
        style={{ fontSize: m.font.heading, fontWeight: m.font.headingWeight, lineHeight: "16px", letterSpacing: 0 }}>{title}</h3>
      {action ? (
        <button type="button" data-slot="see-all" onClick={onAction}
          className={cn("rounded-[4px] bg-transparent p-0 text-[var(--mdt-tint)] hover:underline", focusRing)}
          style={{ fontSize: m.font.heading, lineHeight: "16px", letterSpacing: 0 }}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

/** A document glyph for the attachment rows. Drawn, not measured. */
function DocumentGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 22" width="16" height="19.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M2.7 1.7h7.4l5.2 5.2v13.4a1 1 0 0 1-1 1H2.7a1 1 0 0 1-1-1V2.7a1 1 0 0 1 1-1Z" />
      <path d="M10.1 1.9v5.1h5.1" />
    </svg>
  );
}

/** A globe for the link rows. Drawn, not measured. */
function LinkGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 22 22" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="11" cy="11" r="9.3" />
      <ellipse cx="11" cy="11" rx="4" ry="9.3" />
      <path d="M2 8.2h18M2 13.8h18" />
    </svg>
  );
}

type RowProps = {
  onPress?: () => void;
  glyph?: ReactNode;
  title: string;
  meta?: string;
  /** Puts `meta` above `title`, which is how the one capture of this view draws a contact handle
   *  ("phone" in gray over "+1 (888) 555-1212" — `references/ios/captures/details-light.png`). */
  metaFirst?: boolean;
  tone?: "label" | "tint" | "red";
  height?: number;
  trailing?: ReactNode;
  slot?: string;
};

/**
 * One row of a details list. `detailsContactCellMinimumHeight` 40 tall by default,
 * `searchLinksCellCornerRadius` 8 on its hover fill, `detailsCellLabelPadding` 12 between the glyph
 * and the text. Its horizontal padding is in `macDetailsUnmeasured.rowPadding`.
 */
function Row({ onPress, glyph, title, meta, metaFirst = false, tone = "label", height, trailing, slot }: RowProps) {
  const m = macDetailsMetrics;
  const colour = tone === "red" ? "var(--mdt-red)" : tone === "tint" ? "var(--mdt-tint)" : "var(--mdt-label)";
  const titleLine = <span key="title" className="truncate" style={{ color: colour, fontSize: m.font.body, lineHeight: "16px", letterSpacing: 0 }}>{title}</span>;
  const metaLine = meta
    ? <span key="meta" className="truncate text-[var(--mdt-secondary)]" style={{ fontSize: m.font.subtitle, lineHeight: "14px", letterSpacing: 0 }}>{meta}</span>
    : null;
  const body = (
    <>
      {glyph ? <span aria-hidden="true" className="flex shrink-0 text-[var(--mdt-tertiary)]">{glyph}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col text-left">
        {metaFirst ? [metaLine, titleLine] : [titleLine, metaLine]}
      </span>
      {trailing}
    </>
  );
  const style: CSSProperties = {
    minHeight: height ?? m.rowHeight,
    borderRadius: m.cardRadius,
    gap: m.rowGap,
    paddingInline: macDetailsUnmeasured.rowPadding,
  };
  if (!onPress) return <div data-slot={slot} className="flex w-full items-center" style={style}>{body}</div>;
  return (
    <button type="button" data-slot={slot} onClick={onPress}
      className={cn("flex w-full items-center bg-transparent p-0 hover:bg-[var(--mdt-hover)]", focusRing)} style={style}>
      {body}
    </button>
  );
}

/** A group of rows separated by SPEC's measured macOS row separator (#e1e1e1 / #3a3a3a). */
function RowGroup({ children, label }: { children: ReactNode[]; label?: string }) {
  const rows = children.filter(Boolean);
  return (
    <div role="group" aria-label={label} className="flex flex-col">
      {rows.map((row, index) => (
        <div key={index} style={index === 0 ? undefined : {
          borderTop: "1px solid var(--mdt-row-separator)",
          marginInlineStart: macDetailsUnmeasured.rowPadding,
        }}>
          {row}
        </div>
      ))}
    </div>
  );
}

const tabTitles: Record<MacDetailsTab, string> = {
  info: "Info",
  photos: "Photos",
  links: "Links",
  documents: "Documents",
};

export function MacDetails({
  name, initials, photo, avatar, participants, subtitle,
  actions = [], handles = [], onCreateContact, onAddToContact,
  photos = [], links = [], attachments = [],
  hideAlerts = false, onHideAlertsChange,
  readReceipts = false, onReadReceiptsChange,
  sharedWithYou = false, onSharedWithYouChange,
  onLeave, onBlock, onDelete, onClose,
  defaultParticipantsOpen = false,
  tab, defaultTab = "info", onTabChange,
  conversation, mode = "push",
  width, defaultWidth = macDetailsMetrics.width, onWidthChange, resizable = true,
  progress, open = true, onExited, className, style, ...props
}: MacDetailsProps) {
  const m = macDetailsMetrics;
  const u = macDetailsUnmeasured;
  const titleId = useId();

  const panel = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const timeline = useRef<Animation[] | null>(null);
  const exited = useRef(onExited);
  const opener = useRef<Element | null>(null);
  useEffect(() => { exited.current = onExited; }, [onExited]);

  // The column is user-resizable between `minInspectorColumnWidth` and `maxInspectorColumnWidth`.
  // Controlled when `width` is given, otherwise the handle owns it.
  const [selfWidth, setSelfWidth] = useState(clamp(defaultWidth, m.minWidth, m.maxWidth));
  const columnWidth = clamp(width ?? selfWidth, m.minWidth, m.maxWidth);
  const setWidth = useCallback((next: number) => {
    const value = clamp(Math.round(next), macDetailsMetrics.minWidth, macDetailsMetrics.maxWidth);
    // A live timeline has the old width baked into its keyframes, and rebuilding it here would
    // replay the entrance from off screen on every drag frame. Drop it and let the resting styles,
    // which are the settled pose, carry the new width.
    timeline.current?.forEach(stop);
    timeline.current = null;
    setSelfWidth(value);
    onWidthChange?.(value);
  }, [onWidthChange]);

  const [selfTab, setSelfTab] = useState<MacDetailsTab>(defaultTab);
  const selectTab = (next: MacDetailsTab) => { setSelfTab(next); onTabChange?.(next); };

  // The dismissal is derived during render, not in an effect: an effect leaves one committed frame
  // with the pane already gone and the exit never runs. `closing` also separates a pane that is
  // leaving (fire `onExited`) from one mounted closed, which just sits off screen.
  const [seenOpen, setSeenOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  if (seenOpen !== open) { setSeenOpen(open); setClosing(!open); }

  // `PlatformTopEdgeBlurView`: the header grows a blurred edge once the body scrolls past it. Set
  // from the scroll event, never from an effect.
  const [scrolled, setScrolled] = useState(false);

  const inert = !open && !closing;
  const travel = columnWidth + m.inset;
  const push = m.inset + columnWidth + m.gapToPane;

  const build = (phase: "enter" | "exit"): Animation[] | null => {
    const node = panel.current;
    if (!node) return null;
    return runLayers(detailsLayers(node, mode === "push" ? pane.current : null, scrim.current, travel, push), phase);
  };
  const land = (list: Animation[]) => {
    if (timeline.current !== list) return;
    list.forEach(stop);
    timeline.current = null;
  };

  // Only unmount cancels the timeline. The two phases hand over to each other without one, so a
  // dismissal can read the pose the entrance is still holding.
  useEffect(() => () => { timeline.current?.forEach(stop); timeline.current = null; }, []);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const previous = timeline.current;
    const next = build(open ? "enter" : "exit");
    previous?.forEach(stop);
    timeline.current = next;
    // One rebuild per phase, and `build` only reads refs. `columnWidth` is deliberately absent:
    // resizing must not restart the presentation (`setWidth` cancels a live one instead).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  useLayoutEffect(() => {
    // Reduced motion: the pane is simply there, and leaves at once. Its resting styles are the
    // settled pose, so there is nothing to undo.
    if (prefersReducedMotion()) { if (!open && closing) exited.current?.(); return; }
    const list = timeline.current ?? build(open ? "enter" : "exit");
    if (!list) return;
    timeline.current = list;
    const total = open ? macDetailsMotion.enter : macDetailsMotion.exit;
    const seek = (time: number) => list.forEach(animation => { animation.pause(); try { animation.currentTime = time; } catch { /* no timeline yet */ } });
    if (progress !== undefined) {
      const time = clamp(progress, 0, 1) * total;
      seek(time);
      // A settled checkpoint gets screenshotted, so drop the timeline there and leave the plain styles.
      if (open && time >= total) land(list);
      return;
    }
    // Mounted closed rather than closing: hold the dismissed pose instead of playing a dismissal.
    if (!open && !closing) { seek(total); return; }
    let dropped = false;
    list.forEach(animation => animation.play());
    Promise.allSettled(list.map(animation => animation.finished)).then(() => {
      if (dropped) return;
      if (open) land(list);
      else if (closing && timeline.current === list) exited.current?.();
    });
    return () => { dropped = true; };
    // `columnWidth` is deliberately absent here too; see the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, progress, closing, mode]);

  // Focus follows the pane: opening moves it into the panel, closing hands it back to whatever
  // opened it. Without this the inspector is invisible to the keyboard.
  useEffect(() => {
    if (progress !== undefined) return;
    if (open) {
      const node = panel.current;
      if (!node || node.contains(document.activeElement)) return;
      opener.current = document.activeElement;
      node.focus({ preventScroll: true });
      return;
    }
    const previous = opener.current as HTMLElement | null;
    opener.current = null;
    if (previous && typeof previous.focus === "function" && previous.isConnected) previous.focus({ preventScroll: true });
  }, [open, progress]);

  // Escape is handled on the panel, not on the document: a document-level handler that always calls
  // preventDefault swallows Escape from every layer above the pane (the context menu, the effects
  // picker, the photo viewer). Anything already handled passes through untouched.
  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented || !onClose) return;
    event.preventDefault();
    onClose();
  };

  // Dragging the panel's leading edge, and ← / → when it is focused.
  const drag = useRef<{ x: number; width: number } | null>(null);
  const onHandleDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, width: columnWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onHandleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setWidth(drag.current.width - (event.clientX - drag.current.x));
  };
  const onHandleUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onHandleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") { event.preventDefault(); setWidth(columnWidth + step); }
    if (event.key === "ArrowRight") { event.preventDefault(); setWidth(columnWidth - step); }
    if (event.key === "Home") { event.preventDefault(); setWidth(macDetailsMetrics.maxWidth); }
    if (event.key === "End") { event.preventDefault(); setWidth(macDetailsMetrics.minWidth); }
  };

  const contentWidth = columnWidth - m.contentInset * 2;
  const tile = (contentWidth - m.photoGap * (u.photoColumns - 1)) / u.photoColumns;

  const tabs: MacDetailsTab[] = ["info",
    ...(photos.length ? ["photos" as const] : []),
    ...(links.length ? ["links" as const] : []),
    ...(attachments.length ? ["documents" as const] : []),
  ];
  const wanted = tab ?? selfTab;
  const active: MacDetailsTab = tabs.includes(wanted) ? wanted : "info";

  const previewPhotos = photos.slice(0, u.photoColumns * u.previewPhotoRows);
  const previewLinks = links.slice(0, u.previewRows);
  const previewFiles = attachments.slice(0, u.previewRows);

  const photoGrid = (items: MacDetailsPhoto[]) => (
    <ul className="m-0 grid list-none p-0" style={{ gridTemplateColumns: `repeat(${u.photoColumns}, ${tile}px)`, gap: m.photoGap }}>
      {items.map((item, index) => (
        <li key={item.id} className="m-0 p-0">
          <button type="button" data-slot="details-photo" onClick={item.onOpen}
            aria-label={item.alt ?? `Shared photo ${index + 1}`}
            className={cn("relative block overflow-hidden bg-[var(--mdt-tile)] p-0 transition-opacity hover:opacity-90 active:opacity-75 motion-reduce:transition-none", focusRing)}
            style={{ width: tile, height: tile, borderRadius: m.photoRadius, background: item.src ? "var(--mdt-tile)" : (item.fill ?? "var(--mdt-tile)") }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- registry components stay framework-neutral */}
            {item.src ? <img src={item.src} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 size-full object-cover" /> : null}
          </button>
        </li>
      ))}
    </ul>
  );

  const linkRows = (items: MacDetailsLink[]) => (
    <div className="flex flex-col">
      {items.map(item => (
        <Row key={item.id} slot="details-link" onPress={item.onOpen} glyph={<LinkGlyph />} title={item.title} meta={item.host} />
      ))}
    </div>
  );

  const fileRows = (items: MacDetailsAttachment[]) => (
    <div className="flex flex-col">
      {items.map(item => (
        <Row key={item.id} slot="details-attachment" onPress={item.onOpen} glyph={<DocumentGlyph />} title={item.name} meta={item.meta} />
      ))}
    </div>
  );

  const sectionStyle: CSSProperties = { paddingTop: m.sectionMargin, paddingBottom: m.sectionMargin };
  const sectionId = (kind: string) => `${titleId}-${kind}`;

  const [participantsOpen, setParticipantsOpen] = useState(defaultParticipantsOpen);
  const people = participants ?? [];

  return (
    <div
      data-slot="mac-details"
      className={cn("relative isolate size-full overflow-hidden bg-[var(--mdt-ground)] text-[var(--mdt-label)]", vars, className)}
      style={{ fontFamily: font, WebkitFontSmoothing: "antialiased", ...style }}
      {...props}
    >
      {/* Resting styles ARE the settled pose, so cancelling the timeline once it lands leaves the pane
          with no animation at all and a settled checkpoint screenshots the plain styles. A pane that is
          mounted closed rests on the closed pose instead, which is also what reduced motion renders. */}
      {conversation ? (
        <div
          ref={pane}
          data-slot="details-conversation"
          // Overlay mode covers the conversation; `inert` is the only thing that actually stops Tab
          // reaching it. `aria-hidden` alone on a subtree with focusable children is a violation.
          inert={mode === "overlay" && !inert ? true : undefined}
          className="absolute inset-y-0 left-0"
          style={{ right: inert || mode !== "push" ? 0 : push }}
        >
          {conversation}
        </div>
      ) : null}

      {/* Overlay mode dims what the pane covers; push mode moves it instead and needs no scrim. */}
      {mode === "overlay" && conversation ? (
        <div ref={scrim} aria-hidden="true" data-slot="details-scrim" className="absolute inset-0 bg-[var(--mdt-scrim)]"
          style={{ opacity: inert ? 0 : 1 }} />
      ) : null}

      <div
        ref={panel}
        data-slot="details-panel"
        role="complementary"
        aria-label="Conversation details"
        tabIndex={-1}
        inert={inert ? true : undefined}
        onKeyDown={onPanelKeyDown}
        className="mac-details-panel absolute flex flex-col bg-[var(--mdt-panel)] outline-none"
        style={{
          top: m.inset, bottom: m.inset, right: m.inset,
          width: columnWidth,
          // SPEC "macOS Chrome → Sidebar": a 1 pt bright rim all the way round the floating panel,
          // over the soft shadow it casts on the pane beside it. The rim is measured; the shadow's
          // spread is not (SPEC records the sidebar's as a ground ramp, not a CSS shadow).
          boxShadow: mode === "overlay"
            ? "inset 0 0 0 1px var(--mdt-rim), -14px 0 34px rgba(0,0,0,0.14)"
            : "inset 0 0 0 1px var(--mdt-rim), -10px 0 22px rgba(0,0,0,0.05)",
          translate: inert ? `${travel}px 0px` : undefined,
        }}
      >
        <style>{`
          .mac-details-panel { border-radius: ${m.cornerRadius}px; }
          @supports (corner-shape: superellipse(1.4)) {
            .mac-details-panel { border-radius: ${m.continuousRadius}px; corner-shape: superellipse(1.4); }
          }
        `}</style>

        {/* The header: avatar, name, quick actions and the tab strip, pinned over the scrolling body,
            which is `Header.HeaderView`'s own composition. `isHeaderBlurVisible` /
            `hasScrolledPastTopEdge` is the blurred edge below. */}
        <div data-slot="details-header" className="relative z-10 shrink-0"
          style={{ paddingTop: m.scrollTop, paddingInline: m.contentInset }}>
          {onClose ? (
            <button type="button" data-slot="details-close" aria-label="Hide Details" title="Hide Details" onClick={onClose}
              className={cn("absolute flex items-center justify-center rounded-full bg-transparent p-0 text-[var(--mdt-tint)] hover:bg-[var(--mdt-hover)]", focusRing)}
              style={{ width: m.actionButton, height: m.actionButton, top: m.scrollTop, right: m.contentInset }}>
              <InfoGlyph />
            </button>
          ) : null}

          <div className="flex flex-col items-center">
            <ContactPhoto name={name} initials={initials} photo={photo} avatar={avatar} participants={participants} />
            <div className="flex items-center" style={{ marginTop: m.avatarGap, gap: 6 }}>
              <h2 id={titleId} className="m-0 text-center text-[var(--mdt-label)]"
                style={{ fontSize: m.font.name, fontWeight: m.font.nameWeight, lineHeight: "16px", letterSpacing: 0 }}>
                {name}
              </h2>
              {people.length > 1 ? (
                <button type="button" data-slot="details-participants-toggle"
                  aria-expanded={participantsOpen} aria-controls={sectionId("participants")}
                  aria-label={participantsOpen ? "Hide participants" : "Show participants"}
                  onClick={() => setParticipantsOpen(value => !value)}
                  className={cn("flex items-center justify-center rounded-full bg-transparent p-0 text-[var(--mdt-tertiary)] hover:text-[var(--mdt-secondary)]", focusRing)}>
                  <DisclosureGlyph open={participantsOpen} />
                </button>
              ) : null}
            </div>
            {subtitle ? (
              <p className="m-0 text-center text-[var(--mdt-secondary)]"
                style={{ marginTop: m.nameGap, fontSize: m.font.subtitle, lineHeight: "14px", letterSpacing: 0 }}>{subtitle}</p>
            ) : null}

            {/* `QuickActionsContainerView`: Ø 32 discs with the framework's 12 between their glyph
                boxes and no labels — the one capture of this view in the repo draws bare discs. */}
            {actions.length ? (
              <div role="group" aria-labelledby={titleId} className="flex" style={{ marginTop: m.headingAbove, gap: m.actionGap }}>
                {actions.map(action => (
                  <button key={action.id} type="button" data-slot="details-action" data-action={action.id}
                    aria-label={action.label} title={action.label} disabled={action.disabled} onClick={action.onPress}
                    className={cn("flex items-center justify-center rounded-full bg-[var(--mdt-fill)] p-0 text-[var(--mdt-tint)] transition-colors motion-reduce:transition-none",
                      "enabled:hover:brightness-95 disabled:text-[var(--mdt-tertiary)]", focusRing)}
                    style={{ width: m.actionButton, height: m.actionButton }}>
                    <ActionGlyph icon={action.icon} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* `DetailsTabBarView` / `SegmentedTabControl`. Only tabs with content exist, so a
              conversation with nothing shared shows no strip at all — which is exactly what
              `details-light.png` shows on the phone. Every number here is unmeasured. */}
          {tabs.length > 1 ? (
            <div role="tablist" aria-label="Details" data-slot="details-tabs"
              className="flex justify-center" style={{ marginTop: m.headingAbove, gap: u.tab.gap }}>
              {tabs.map(key => (
                <button key={key} type="button" role="tab" data-slot="details-tab" data-tab={key}
                  aria-selected={active === key} aria-controls={sectionId(key)} id={`${titleId}-tab-${key}`}
                  tabIndex={active === key ? 0 : -1}
                  onClick={() => selectTab(key)}
                  className={cn("bg-transparent transition-colors motion-reduce:transition-none", focusRing,
                    active === key ? "text-[var(--mdt-label)]" : "text-[var(--mdt-secondary)] hover:text-[var(--mdt-label)]")}
                  style={{
                    height: u.tab.height, paddingInline: u.tab.paddingInline, borderRadius: u.tab.radius,
                    fontSize: u.tab.fontSize, lineHeight: `${u.tab.height}px`, letterSpacing: 0,
                    background: active === key ? "var(--mdt-fill)" : "transparent",
                  }}>
                  {tabTitles[key]}
                </button>
              ))}
            </div>
          ) : null}

          {/* `PlatformTopEdgeBlurView`. */}
          <div aria-hidden="true" data-slot="details-scroll-edge"
            className="pointer-events-none absolute inset-x-0 transition-opacity duration-150 motion-reduce:transition-none"
            style={{
              top: "100%", height: u.scrollEdgeBlur, opacity: scrolled ? 1 : 0,
              background: "linear-gradient(to bottom, var(--mdt-panel), transparent)",
            }} />
        </div>

        <div data-slot="details-scroll" className="min-h-0 flex-1 overflow-y-auto"
          onScroll={event => setScrolled(event.currentTarget.scrollTop > 0)}
          style={{ paddingInline: m.contentInset, paddingBottom: m.scrollBottom }}>

          {active === "info" ? (
            <div role="tabpanel" id={sectionId("info")} aria-labelledby={tabs.length > 1 ? `${titleId}-tab-info` : undefined} tabIndex={-1} className="outline-none">
              {participantsOpen && people.length > 1 ? (
                <section data-slot="details-section" aria-labelledby={sectionId("participants-heading")} style={sectionStyle} id={sectionId("participants")}>
                  {/* `DETAILS_VIEW_GROUP_COUNT_TEXT`: "%lu PERSON" / "%lu PEOPLE", verbatim. */}
                  <SectionHeading id={sectionId("participants-heading")} title={`${people.length} ${people.length === 1 ? "PERSON" : "PEOPLE"}`} />
                  <RowGroup label="Participants">
                    {people.map(person => (
                      <Row key={person.id} slot="details-participant" title={person.name} meta={person.subtitle}
                        glyph={<Avatar size={m.avatar} initials={person.initials} src={person.photo} name={person.name} />} />
                    ))}
                  </RowGroup>
                </section>
              ) : null}

              {handles.length ? (
                <section data-slot="details-section" style={sectionStyle}>
                  <RowGroup label="Contact">
                    {handles.map(handle => (
                      <Row key={handle.id} slot="details-handle" onPress={handle.onPress}
                        title={handle.value} meta={handle.label} metaFirst
                        height={m.optionHeight} tone={handle.onPress ? "tint" : "label"} />
                    ))}
                  </RowGroup>
                </section>
              ) : null}

              {onCreateContact || onAddToContact ? (
                <section data-slot="details-section" style={sectionStyle}>
                  <RowGroup label="Contact actions">
                    {onCreateContact ? <Row slot="details-create-contact" onPress={onCreateContact} title="Create New Contact" tone="tint" /> : null}
                    {onAddToContact ? <Row slot="details-add-contact" onPress={onAddToContact} title="Add to Existing Contact" tone="tint" /> : null}
                  </RowGroup>
                </section>
              ) : null}

              {previewPhotos.length ? (
                <section data-slot="details-section" aria-labelledby={sectionId("photos-heading")} style={sectionStyle}>
                  <SectionHeading id={sectionId("photos-heading")} title="Photos"
                    action={photos.length > previewPhotos.length ? "See All Photos" : undefined}
                    onAction={() => selectTab("photos")} />
                  {photoGrid(previewPhotos)}
                </section>
              ) : null}

              {previewLinks.length ? (
                <section data-slot="details-section" aria-labelledby={sectionId("links-heading")} style={sectionStyle}>
                  <SectionHeading id={sectionId("links-heading")} title="Links"
                    action={links.length > previewLinks.length ? "See All Links" : undefined}
                    onAction={() => selectTab("links")} />
                  {linkRows(previewLinks)}
                </section>
              ) : null}

              {previewFiles.length ? (
                <section data-slot="details-section" aria-labelledby={sectionId("files-heading")} style={sectionStyle}>
                  <SectionHeading id={sectionId("files-heading")} title="Documents"
                    action={attachments.length > previewFiles.length ? "See All Attachments" : undefined}
                    onAction={() => selectTab("documents")} />
                  {fileRows(previewFiles)}
                </section>
              ) : null}

              {onHideAlertsChange || onReadReceiptsChange || onSharedWithYouChange ? (
                <section data-slot="details-section" style={sectionStyle}>
                  <h3 className="sr-only">Conversation options</h3>
                  <RowGroup label="Conversation options">
                    {onHideAlertsChange ? (
                      <Row slot="details-hide-alerts" title="Hide Alerts" height={m.optionHeight}
                        trailing={<MacCheckbox checked={hideAlerts} onChange={onHideAlertsChange} label="Hide Alerts" />} />
                    ) : null}
                    {onReadReceiptsChange ? (
                      <Row slot="details-read-receipts" title="Send Read Receipts" height={m.optionHeight}
                        trailing={<MacCheckbox checked={readReceipts} onChange={onReadReceiptsChange} label="Send Read Receipts" />} />
                    ) : null}
                    {onSharedWithYouChange ? (
                      <Row slot="details-shared-with-you" title="Shared With You" height={m.optionHeight}
                        trailing={<MacCheckbox checked={sharedWithYou} onChange={onSharedWithYouChange} label="Shared With You" />} />
                    ) : null}
                  </RowGroup>
                </section>
              ) : null}

              {onLeave || onBlock || onDelete ? (
                <section data-slot="details-section" style={sectionStyle}>
                  <RowGroup label="Conversation">
                    {onLeave ? <Row slot="details-leave" onPress={onLeave} title="Leave this Conversation" tone="red" height={m.optionHeight} /> : null}
                    {onBlock ? <Row slot="details-block" onPress={onBlock} title="Block Contact" tone="red" height={m.optionHeight} /> : null}
                    {onDelete ? <Row slot="details-delete" onPress={onDelete} title="Delete Conversation…" tone="red" height={m.optionHeight} /> : null}
                  </RowGroup>
                </section>
              ) : null}
            </div>
          ) : null}

          {active === "photos" ? (
            <div role="tabpanel" id={sectionId("photos")} aria-labelledby={`${titleId}-tab-photos`} tabIndex={-1} className="outline-none" style={sectionStyle}>
              {photoGrid(photos)}
            </div>
          ) : null}

          {active === "links" ? (
            <div role="tabpanel" id={sectionId("links")} aria-labelledby={`${titleId}-tab-links`} tabIndex={-1} className="outline-none" style={sectionStyle}>
              {linkRows(links)}
            </div>
          ) : null}

          {active === "documents" ? (
            <div role="tabpanel" id={sectionId("documents")} aria-labelledby={`${titleId}-tab-documents`} tabIndex={-1} className="outline-none" style={sectionStyle}>
              {fileRows(attachments)}
            </div>
          ) : null}
        </div>

        {/* The resize handle sits on the panel's leading edge, between
            `minInspectorColumnWidth` and `maxInspectorColumnWidth`. */}
        {resizable ? (
          <div
            data-slot="details-resize"
            role="separator"
            aria-label="Details width"
            aria-orientation="vertical"
            aria-valuenow={columnWidth}
            aria-valuemin={m.minWidth}
            aria-valuemax={m.maxWidth}
            tabIndex={0}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            onKeyDown={onHandleKeyDown}
            className={cn("absolute inset-y-0 left-0 w-[6px] cursor-col-resize", focusRing)}
            style={{ marginLeft: -3, touchAction: "none" }}
          />
        ) : null}
      </div>
    </div>
  );
}
