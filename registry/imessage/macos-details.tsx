"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/registry/imessage/avatar";

/**
 * macOS 26 conversation details: the inspector column that slides in from the trailing edge of the
 * Messages window.
 *
 * **NO CAPTURE IN THIS REPO SHOWS THIS PANE.** Every `references/macos/captures/*.png` is a crop of
 * window x 330-960 of a window with no inspector open, so nothing here was measured off a frame.
 * What is below comes from three places, and each number says which:
 *
 * 1. **The framework.** macOS Messages is a Mac Catalyst app on ChatKit
 *    (`/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework`, 26.5 on macOS 26.5.2
 *    build 25F84). Read by dlopening it from a `arm64-apple-ios26.0-macabi` binary, swizzling
 *    `-[UIDevice userInterfaceIdiom]` to return 5 (Mac) so `+[CKUIBehavior sharedBehaviors]` vends
 *    `CKUIBehaviorMac`, then reading the selectors named against each value. The same probe returns
 *    `balloonTextFont` 13 pt, `transcriptMessageStatusDateFont` 9 pt, `balloonContiguousSpace` 3,
 *    `conversationListContactImageDiameter` 40, `defaultConversationListWidth` 320 and
 *    `_transcriptBackgroundColor` #ffffff / #1e1e1e, all of which SPEC has already measured off a
 *    capture and all of which agree, so the probe is reading genuine Mac values.
 * 2. **Numbers measured elsewhere in the kit**, reused and named as such.
 * 3. **Judgement**, called judgement, both here and in the report.
 *
 * One caution about the framework's fonts. `-[CKUIBehaviorMac conversationListSenderFont]` is 17 pt
 * semibold and `searchBarFont` is 17 pt, but SPEC measures both of those surfaces at 13 pt in
 * `conversation-pane-*.png`, so macOS 26's redesigned chrome plainly does not read those selectors
 * any more. Its geometry selectors do still agree with the captures (the five cross-checks above).
 * So this file takes **geometry** from the framework and **type sizes** from the measured macOS
 * scale in SPEC, and never quotes `detailsGroupHeaderCellTitleFont` (17 pt) as the name's size.
 *
 * ### Geometry, from ChatKit
 *
 * | Value | Selector on `CKUIBehaviorMac` |
 * |---|---|
 * | column 300 wide, resizable 280-400 | `defaultInspectorColumnWidth`, `minInspectorColumnWidth`, `maxInspectorColumnWidth` |
 * | content inset 16 | `searchDetailsLeadingAndTrailingMaxPadding`, and `searchDetailsResultsInsets` t12 l16 b16 r16 |
 * | contact photo O 37 | `detailsAvatarDiameter` = `detailsViewContactImageDiameter` |
 * | photo to name 12 | `detailsContactAvatarLabelSpacing` |
 * | name to subtitle 1 | `detailsGroupHeaderCellInterTextVerticalSpacing` |
 * | group photo stack 58 wide for two, 72 for three | `detailsAvatarPancakeViewWidth2Avatars`, `...3Avatars` |
 * | action button O 32 | `detailsAddButtonDiameter` |
 * | action glyph box 25, gap 12 | `detailsContactCellButtonWidth`/`Height`, `detailsContactCellButtonEdgeInsets` t8 l6 b8 r6 |
 * | section header 16 above, 12 below, 16 at the section's foot | `detailsSectionHeaderPaddingAbove`, `searchResultsTitleHeaderDetailsTopPadding`, `searchDetailsResultsInsets.bottom` |
 * | photo grid gap 10, tile radius 8 | `searchPhotosInterItemSpacingDetailsView`, `searchPhotosCellZKWAndDetailsCornerRadius` |
 * | link and document card radius 8 | `searchLinksCellCornerRadius`, `searchAttachmentsCellCornerRadius` |
 * | row height 40 | `detailsContactCellMinimumHeight` |
 * | option row height 44 | `+[CKDetailsChatOptionsCell estimatedHeight]` |
 * | Hide Alerts is a **16 x 16 checkbox**, not a switch | `-[CKDetailsChatOptionsCell controlSwitch]` is a `UISwitch`, and a `UISwitch` built under the Mac idiom reports `style` 1 (`UISwitchStyleCheckbox`) and `intrinsicContentSize` 16 x 16 |
 *
 * ### Colours, from `-[CKUIBehaviorMac theme]` (a `CKUIThemeMac`), resolved through a light and a dark `UITraitCollection`
 *
 * | Token | Light | Dark | Selector |
 * |---|---|---|---|
 * | label | rgba(0,0,0,0.847) | rgba(255,255,255,0.847) | `primaryLabelColor` |
 * | secondary | rgba(0,0,0,0.498) | rgba(255,255,255,0.549) | `secondaryLabelColor`, = `detailsContactCellSubTitleColor` |
 * | tertiary | rgba(0,0,0,0.259) | rgba(255,255,255,0.247) | `tertiaryLabelColor`, = `detailsContactCellChevronColor` |
 * | tint | #0088ff | #0091ff | `appTintColor`, = `detailsSeeAllButtonTextColor` = `iosMacDetailsButtonColor` |
 * | control fill | rgba(0,0,0,0.098) | rgba(255,255,255,0.098) | `detailsAddButtonBackgroundColor` |
 * | destructive | #ff383c | #ff4245 | `background_sendButtonColor` |
 *
 * ### Glyphs, rendered out of the framework
 *
 * `-[CKUIBehaviorMac detailsViewPhoneImage]`, `detailsViewFaceTimeVideoImage` and
 * `macToolbarDetailsImage` (`info.circle` at `macToolbarImagePointSize` 22) were drawn into 8x
 * bitmaps and traced. Ink boxes: phone 15.5 x 15.5 inside a 19.5 x 17.5 image, video 20.5 x 13.5
 * inside 24 x 15.5, info 22 x 22 inside 26 x 25. The video body is 14.375 x 13.5 with a corner whose
 * tangents sit 2.0 in, then a 1 pt gap, then a lens whose near edge stands at x 17.965 over y
 * 5.5-10.0 and whose arms run 1.15 across per 1 down to a right edge at x 23. The info ring is a
 * 1.875 stroke on a O 22 circle, its dot is O 2.8 centred (12.94, 7.3), and its stem is a 1.625
 * round-capped stroke. The phone reuses the `phone.fill` path already traced in `ios-details.tsx`,
 * drawn at this ink box.
 *
 * ### Everything the pane is made of that is NOT measured, and is judgement
 *
 * - Which sections it shows and in what order. `CKUIBehaviorMac detailsSectionCount` is 17 and
 *   ChatKit 26 carries `DetailsInfoTab`, `DetailsPhotosTab`, `DetailsLinksTab`, `DetailsLocationsTab`,
 *   `DetailsAttachmentsTab` and `DetailsWalletTab`, so the real pane has more than this, and may put
 *   them behind a tab strip rather than stacking them.
 * - Three photo columns, so an 82.667 tile at 300 wide.
 * - The pane's own top band. It reserves the 55 pt SPEC gives the conversation header so its content
 *   starts under the same toolbar line, and puts the Hide Details button at the band's trailing end.
 *   Native almost certainly leaves that button in the conversation's toolbar instead.
 * - That the column runs flush to the window's edges. SPEC measures the *sidebar* on macOS 26 as a
 *   floating panel inset 8 on three sides with a continuous corner, so the inspector may well float
 *   the same way. Its fill and rim are that panel's measured ones (#fafafa / #1b1b1b, rim #ffffff /
 *   #424242); its shape is not.
 * - The checkbox's drawing (only its 16 x 16 box is framework), the type weights, and the row
 *   internals of the link and document cards.
 *
 * ### The presentation is UNMEASURED
 *
 * Nothing in this repo records this pane in motion, and ChatKit vends no duration for it: there is no
 * `details`- or `inspector`-named timing anywhere on `CKUIBehaviorMac`. So `macDetailsMotion` below
 * is a choice, not a reading. Say so wherever it is quoted.
 *
 * Copy comes from ChatKit.strings: "Hide Details" (`HIDE_DETAILS_VIEW`), "Photos"
 * (`PHOTOS_MENU_ITEM_TITLE`), "Links" (`LINKS`), "Documents" (`SEARCH_ATTACHMENTS_TITLE`), "See All
 * Photos" / "See All Links" / "See All Attachments", "Hide Alerts"
 * (`DETAILS_VIEW_HIDE_ALERTS_TOGGLE_TITLE`), "Block Contact" (`BLOCK_CONTACT`), "Delete
 * Conversation…" (`DELETE_CONVERSATION_ELLIPSIS`), "Leave this Conversation" (`LEAVE_CONVERSATION`).
 */

const font = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif';

/** Framework geometry, plus the two judgement calls that shape the layout. */
export const macDetailsMetrics = {
  /** `-[CKUIBehaviorMac defaultInspectorColumnWidth]`, with its own min and max. */
  width: 300,
  minWidth: 280,
  maxWidth: 400,
  /** SPEC "macOS Chrome": the toolbar's layout height, so the pane's content starts on the same line. */
  headerHeight: 55,
  /** `searchDetailsLeadingAndTrailingMaxPadding`, and the left and right of `searchDetailsResultsInsets`. */
  inset: 16,
  /** `detailsAvatarDiameter`. */
  avatar: 37,
  /** `detailsContactAvatarLabelSpacing`. */
  avatarGap: 12,
  /** `detailsGroupHeaderCellInterTextVerticalSpacing`. */
  nameGap: 1,
  /** `detailsAvatarPancakeViewWidth2Avatars` / `...3Avatars`, so the step is 21 for two and 17.5 for three. */
  stack: { two: 58, three: 72 },
  /** `detailsAddButtonDiameter`. `detailsContactCellButtonWidth`/`Height` give the 25 pt tap box. */
  actionButton: 32,
  actionHit: 25,
  /** The left and right of `detailsContactCellButtonEdgeInsets`, added. */
  actionGap: 12,
  /** `detailsSectionHeaderPaddingAbove`, `searchResultsTitleHeaderDetailsTopPadding`, `searchDetailsResultsInsets.bottom`. */
  sectionTop: 16,
  sectionHeaderGap: 12,
  sectionBottom: 16,
  /** `searchPhotosInterItemSpacingDetailsView` and `searchPhotosCellZKWAndDetailsCornerRadius`. */
  photoGap: 10,
  photoRadius: 8,
  /** Judgement: nothing in the framework says how many columns the grid runs at 300 wide. */
  photoColumns: 3,
  /** `searchLinksCellCornerRadius` = `searchAttachmentsCellCornerRadius`. */
  cardRadius: 8,
  /** `detailsContactCellMinimumHeight` for a card row, `+[CKDetailsChatOptionsCell estimatedHeight]` for an option. */
  rowHeight: 40,
  optionHeight: 44,
  /** `-[UISwitch intrinsicContentSize]` under the Mac idiom, where its `style` resolves to checkbox. */
  checkbox: 16,
} as const;

/**
 * UNMEASURED, and unmeasurable from anything committed here: no capture records the pane in motion,
 * and ChatKit has no duration selector for it. These sit in the family the kit already uses.
 *
 * - The slide runs 300 ms on `cubic-bezier(0.32, 0.72, 0, 1)`, the curve `ios-details.tsx` (320 ms),
 *   `ios-effects-picker.tsx` (260 ms) and the iOS shell's screen transitions (400 ms) all use.
 * - The overlay dim fades over 220 ms, a little ahead of the slide, the way the measured long-press
 *   dim (150 of its 600 ms) leads its menu.
 * - The way out is 250 ms, between the measured macOS menu dismiss (~120 ms) and the iOS details
 *   dismiss (260 ms).
 * - The sections settle after the panel in a short stagger, matching `iosDetailsMotion`'s cells.
 */
export const macDetailsMotion = {
  enter: 300,
  exit: 250,
  dim: 220,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
  exitEase: "cubic-bezier(0.4, 0, 1, 1)",
  sectionStart: 70,
  sectionStagger: 26,
  sectionRise: 10,
  sectionDuration: 190,
} as const;

/**
 * Light and dark live in CSS variables so a `.dark` ancestor flips the whole pane, the way every
 * other file in the kit does it. Sources are in the header table.
 */
const vars =
  "[--mdt-panel:#fafafa] [--mdt-ground:#f8f8f8] [--mdt-rim:#ffffff] [--mdt-label:rgba(0,0,0,0.847)] " +
  "[--mdt-secondary:rgba(0,0,0,0.498)] [--mdt-tertiary:rgba(0,0,0,0.259)] [--mdt-tint:#0088ff] " +
  "[--mdt-fill:rgba(0,0,0,0.098)] [--mdt-fill-hover:rgba(0,0,0,0.145)] [--mdt-red:#ff383c] " +
  "[--mdt-separator:#e1e1e1] [--mdt-tile:#e9e9eb] [--mdt-scrim:rgba(0,0,0,0.10)] [--mdt-knob:#ffffff] " +
  "dark:[--mdt-panel:#1b1b1b] dark:[--mdt-ground:#1c1c1c] dark:[--mdt-rim:#424242] dark:[--mdt-label:rgba(255,255,255,0.847)] " +
  "dark:[--mdt-secondary:rgba(255,255,255,0.549)] dark:[--mdt-tertiary:rgba(255,255,255,0.247)] dark:[--mdt-tint:#0091ff] " +
  "dark:[--mdt-fill:rgba(255,255,255,0.098)] dark:[--mdt-fill-hover:rgba(255,255,255,0.16)] dark:[--mdt-red:#ff4245] " +
  "dark:[--mdt-separator:#3a3a3a] dark:[--mdt-tile:#3b3b3d] dark:[--mdt-scrim:rgba(0,0,0,0.28)]";

/** The focus ring the rest of the macOS chrome uses (`macos-header.tsx`, `macos-composer.tsx`). */
const focusRing = "outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#3478f6]";

export type MacDetailsAction = {
  id: string;
  label: string;
  icon: "phone" | "video" | "info";
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

export type MacDetailsProps = Omit<ComponentProps<"div">, "children" | "onChange"> & {
  name: string;
  initials?: string;
  /** Contact photo URL, or a whole avatar node. */
  photo?: string;
  avatar?: ReactNode;
  /** Two or three of these draw the group photo stack instead of one circle. */
  participants?: Array<{ id: string; name: string; initials?: string; photo?: string }>;
  /** The handle under the name, or the participant count for a group. */
  subtitle?: string;

  actions?: MacDetailsAction[];
  photos?: MacDetailsPhoto[];
  links?: MacDetailsLink[];
  attachments?: MacDetailsAttachment[];
  onSeeAllPhotos?: () => void;
  onSeeAllLinks?: () => void;
  onSeeAllAttachments?: () => void;

  hideAlerts?: boolean;
  onHideAlertsChange?: (next: boolean) => void;
  /** A group conversation offers Leave in place of Block. */
  onLeave?: () => void;
  onBlock?: () => void;
  onDelete?: () => void;

  /** Closes the pane. Escape does the same. */
  onClose?: () => void;

  /**
   * The conversation the pane opens beside. `push` shrinks it by the pane's width as the pane slides
   * in, which is what an inspector column does; `overlay` leaves it alone and dims it under the pane.
   */
  conversation?: ReactNode;
  mode?: "push" | "overlay";
  width?: number;

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
function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }
function stop(animation: Animation) { try { animation.cancel(); } catch { /* already gone */ } }

type Pose = Record<string, string>;
type Layer = { el: HTMLElement; from: Pose; to: Pose; duration: number; delay: number; easing: string };

/**
 * Every layer of the presentation, as the pose it holds while closed and the pose it settles on. The
 * settled pose is what each element already carries at rest, so cancelling the timeline once it lands
 * leaves the pane with no animation and no transform at all, and a settled checkpoint screenshots the
 * plain styles twice over.
 */
function detailsLayers(panel: HTMLElement, pane: HTMLElement | null, scrim: HTMLElement | null, width: number): Layer[] {
  const m = macDetailsMotion;
  const layers: Layer[] = [];
  const add = (el: HTMLElement | null, from: Pose, to: Pose, duration: number, delay = 0, easing: string = m.ease) => {
    if (el) layers.push({ el, from, to, duration, delay, easing });
  };
  add(panel, { translate: `${width}px 0px` }, { translate: "0px 0px" }, m.enter);
  // The push is the conversation's own trailing inset, so its bubbles rewrap as it narrows, which is
  // what an inspector column does to the view beside it.
  add(pane, { right: "0px" }, { right: `${width}px` }, m.enter);
  add(scrim, { opacity: "0" }, { opacity: "1" }, m.dim, 0, "ease-out");
  Array.from(panel.querySelectorAll<HTMLElement>('[data-slot="details-section"]')).forEach((el, index) =>
    add(el, { translate: `0px ${m.sectionRise}px`, opacity: "0" }, { translate: "0px 0px", opacity: "1" },
      m.sectionDuration, m.sectionStart + index * m.sectionStagger));
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
 * SF Symbol stand-ins at the ink boxes the framework's own images measure, so the three keep their
 * relative weights. `phone` and `video` are `-[CKUIBehaviorMac detailsViewPhoneImage]` and
 * `detailsViewFaceTimeVideoImage`, which are the details view's own glyphs; `info` is
 * `macToolbarDetailsImage`, which is `info.circle` at `macToolbarImagePointSize` 22 and belongs to the
 * toolbar, so the button row draws it at 17.5 to sit in the other two's family. That 17.5 is
 * judgement: the framework has no details-view info image to measure.
 */
function ActionGlyph({ icon, infoSize = 17.5 }: { icon: MacDetailsAction["icon"]; infoSize?: number }) {
  if (icon === "phone") {
    // `phone.fill`: ink 15.5 square inside the framework's 19.5 x 17.5 image. The path is the one
    // traced for `ios-details.tsx` off `references/ios/captures/details-light.png`, in its own
    // 13.5-square viewBox, drawn here at the box this image measures.
    return (
      <svg aria-hidden="true" width="15.5" height="15.5" viewBox="1.72 1.25 13.5 13.5" fill="currentColor">
        <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.6 17.6 0 0 0 4.168 6.608 17.6 17.6 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.68.68 0 0 0-.58-.122l-2.19.547a1.75 1.75 0 0 1-1.657-.459L5.482 8.062a1.75 1.75 0 0 1-.46-1.657l.548-2.19a.68.68 0 0 0-.122-.58z" />
      </svg>
    );
  }
  if (icon === "video") {
    // `video.fill`: body x 2.5-16.875 y 1.0-14.5 with its corner tangents 2.0 in, then the lens, whose
    // near edge stands at x 17.965 over y 5.5-10.0 and whose arms run 1.15 across per 1 down out to a
    // right edge at x 23. Traced off the 8x render of `detailsViewFaceTimeVideoImage`.
    return (
      <svg aria-hidden="true" width="20.5" height="13.5" viewBox="2.5 1 20.5 13.5" fill="currentColor">
        <rect x="2.5" y="1" width="14.375" height="13.5" rx="2" />
        <path d="M17.97 5.55c0-.5.18-.8.58-1.05l2.75-2.15c.75-.6 1.7-.2 1.7.8v9.2c0 1-.95 1.4-1.7.8l-2.75-2.15c-.4-.25-.58-.55-.58-1.05z" />
      </svg>
    );
  }
  // `info.circle` at `macToolbarImagePointSize` 22: a 1.875 stroke on a O 22 ring centred (13, 12.5),
  // a O 2.8 dot centred (12.94, 7.3), and a 1.625 round-capped "i" whose stem runs y 11.31-17.69.
  return (
    <svg aria-hidden="true" width={infoSize} height={infoSize} viewBox="1.5 1 23 23" fill="none">
      <circle cx="13" cy="12.5" r="10.0625" stroke="currentColor" strokeWidth="1.875" />
      <circle cx="12.94" cy="7.3" r="1.4" fill="currentColor" />
      <path d="M11.5 11.31h1.81v6.38M11.19 17.69h4.25" stroke="currentColor" strokeWidth="1.625" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * macOS 26 checkbox. Its 16 x 16 box is the framework's (`-[UISwitch intrinsicContentSize]` under the
 * Mac idiom, where `style` resolves to `UISwitchStyleCheckbox`); the corner and the tick are drawn,
 * not measured, because no capture in this repo holds a checkbox.
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
      className={cn("relative shrink-0 rounded-[4px] transition-colors motion-reduce:transition-none", focusRing, className)}
      style={{
        width: size, height: size,
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

/** The group photo stack. Widths are the framework's; the step falls out of them. */
function ContactPhoto({ name, initials, photo, avatar, participants }: Pick<MacDetailsProps, "name" | "initials" | "photo" | "avatar" | "participants">) {
  const { avatar: size, stack } = macDetailsMetrics;
  const people = participants ?? [];
  if (avatar) return <span className="flex">{avatar}</span>;
  if (people.length < 2) return <Avatar size={size} initials={initials} src={photo} name={name} />;
  const shown = people.slice(0, 3);
  const width = shown.length === 2 ? stack.two : stack.three;
  const step = (width - size) / (shown.length - 1);
  return (
    <span className="relative block" style={{ width, height: size }} role="img" aria-label={`${shown.map(person => person.name).join(", ")}`}>
      {shown.map((person, index) => (
        <span key={person.id} className="absolute top-0" style={{ left: index * step, zIndex: shown.length - index }}>
          <Avatar size={size} initials={person.initials} src={person.photo} name={person.name} aria-hidden="true" />
        </span>
      ))}
    </span>
  );
}

function SectionHeading({ id, title, action, onAction }: { id: string; title: string; action?: string; onAction?: () => void }) {
  const m = macDetailsMetrics;
  return (
    <div className="flex items-baseline justify-between" style={{ marginBottom: m.sectionHeaderGap }}>
      <h2 id={id} className="m-0 font-semibold text-[var(--mdt-label)]" style={{ fontSize: 13, lineHeight: "16px", letterSpacing: -0.4 }}>{title}</h2>
      {action ? (
        <button type="button" data-slot="see-all" onClick={onAction}
          className={cn("rounded-[4px] bg-transparent p-0 text-[var(--mdt-tint)] hover:underline", focusRing)}
          style={{ fontSize: 12, lineHeight: "15px", letterSpacing: -0.3 }}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

/** A document glyph for the attachment rows. Drawn, not measured. */
function DocumentGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 22" width="18" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M2.7 1.7h7.4l5.2 5.2v13.4a1 1 0 0 1-1 1H2.7a1 1 0 0 1-1-1V2.7a1 1 0 0 1 1-1Z" />
      <path d="M10.1 1.9v5.1h5.1" />
    </svg>
  );
}

/** A globe for the link rows. Drawn, not measured. */
function LinkGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 22 22" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="11" cy="11" r="9.3" />
      <ellipse cx="11" cy="11" rx="4" ry="9.3" />
      <path d="M2 8.2h18M2 13.8h18" />
    </svg>
  );
}

export function MacDetails({
  name, initials, photo, avatar, participants, subtitle,
  actions = [], photos = [], links = [], attachments = [],
  onSeeAllPhotos, onSeeAllLinks, onSeeAllAttachments,
  hideAlerts = false, onHideAlertsChange, onLeave, onBlock, onDelete, onClose,
  conversation, mode = "push", width = macDetailsMetrics.width,
  progress, open = true, onExited, className, style, ...props
}: MacDetailsProps) {
  const m = macDetailsMetrics;
  const titleId = useId();
  const photosId = `${titleId}-photos`;
  const linksId = `${titleId}-links`;
  const filesId = `${titleId}-files`;
  const optionsId = `${titleId}-options`;

  const panel = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const timeline = useRef<Animation[] | null>(null);
  const exited = useRef(onExited);
  useEffect(() => { exited.current = onExited; }, [onExited]);

  // The dismissal is derived during render, not in an effect: an effect leaves one committed frame
  // with the pane already gone and the exit never runs. `closing` also separates a pane that is
  // leaving (fire `onExited`) from one mounted closed, which just sits off screen.
  const [seenOpen, setSeenOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  if (seenOpen !== open) { setSeenOpen(open); setClosing(!open); }

  const build = (phase: "enter" | "exit"): Animation[] | null => {
    const node = panel.current;
    if (!node) return null;
    return runLayers(detailsLayers(node, mode === "push" ? pane.current : null, scrim.current, width), phase);
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
    // One rebuild per phase, and `build` only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, width, mode]);

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
      const time = clamp01(progress) * total;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, progress, closing, width, mode]);

  // The pane covers part of the window, so Escape backs out of it the way the close button does.
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const inert = !open && !closing;
  const contentWidth = width - m.inset * 2;
  const tile = (contentWidth - m.photoGap * (m.photoColumns - 1)) / m.photoColumns;
  const shownPhotos = photos.slice(0, m.photoColumns * 2);
  const sectionStyle: CSSProperties = { paddingTop: m.sectionTop, paddingBottom: m.sectionBottom };

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
        <div ref={pane} data-slot="details-conversation" className="absolute inset-y-0 left-0" style={{ right: inert || mode !== "push" ? 0 : width }}>
          {conversation}
        </div>
      ) : null}

      {/* Overlay mode dims what the pane covers; push mode moves it instead and needs no scrim. */}
      {mode === "overlay" && conversation ? (
        <div ref={scrim} aria-hidden="true" data-slot="details-scrim" className="absolute inset-y-0 left-0 bg-[var(--mdt-scrim)]" style={{ right: width, opacity: inert ? 0 : 1 }} />
      ) : null}

      <div
        ref={panel}
        data-slot="details-panel"
        role="complementary"
        aria-label="Conversation details"
        aria-hidden={inert || undefined}
        className="absolute inset-y-0 right-0 flex flex-col bg-[var(--mdt-panel)]"
        style={{
          width,
          minWidth: m.minWidth,
          // A 1 pt bright rim down the leading edge, the sidebar panel's measured rim reused (SPEC
          // "macOS Chrome": light #ffffff, dark #424242), over the soft shadow the sidebar casts on
          // the pane beside it. Overlay needs a heavier one, riding above the conversation instead of
          // beside it. Both shadows are judgement; the rim is measured, on the other panel.
          boxShadow: mode === "overlay"
            ? "inset 1px 0 0 var(--mdt-rim), -14px 0 34px rgba(0,0,0,0.14)"
            : "inset 1px 0 0 var(--mdt-rim), -10px 0 22px rgba(0,0,0,0.05)",
          pointerEvents: inert ? "none" : undefined,
          translate: inert ? `${width}px 0px` : undefined,
        }}
      >
        {/* The pane reserves the conversation header's measured 55 pt so its content starts on the
            same line. Where the close button belongs is judgement: native most likely leaves the
            info.circle toggle in the window's own toolbar. */}
        <div data-slot="details-toolbar" className="flex shrink-0 items-center justify-end" style={{ height: m.headerHeight, paddingRight: m.inset }}>
          {onClose ? (
            <button type="button" data-slot="details-close" aria-label="Hide Details" onClick={onClose}
              className={cn("flex items-center justify-center rounded-full bg-transparent p-0 text-[var(--mdt-tint)] hover:bg-[var(--mdt-fill)]", focusRing)}
              style={{ width: m.actionButton, height: m.actionButton }}>
              {/* The toolbar's own info.circle, at its `macToolbarImagePointSize` 22. */}
              <ActionGlyph icon="info" infoSize={22} />
            </button>
          ) : null}
        </div>

        <div data-slot="details-scroll" className="mac-details-scroll min-h-0 flex-1 overflow-y-auto" style={{ paddingInline: m.inset, paddingBottom: m.inset }}>
          <style>{".mac-details-scroll{scrollbar-width:none}.mac-details-scroll::-webkit-scrollbar{display:none}"}</style>

          <div data-slot="details-section" className="flex flex-col items-center" style={{ paddingBottom: m.sectionBottom }}>
            <ContactPhoto name={name} initials={initials} photo={photo} avatar={avatar} participants={participants} />
            <h1 id={titleId} className="m-0 text-center font-bold text-[var(--mdt-label)]"
              style={{ marginTop: m.avatarGap, fontSize: 13, lineHeight: "16px", letterSpacing: 0 }}>
              {name}
            </h1>
            {subtitle ? (
              <p className="m-0 text-center text-[var(--mdt-secondary)]" style={{ marginTop: m.nameGap, fontSize: 11, lineHeight: "14px", letterSpacing: -0.2 }}>{subtitle}</p>
            ) : null}

            {/* Equal columns rather than a flex row, so the O 32 discs stay evenly pitched however wide
                their labels run. The 12 between columns is the framework's; the column width is not. */}
            {actions.length ? (
              <div role="group" aria-labelledby={titleId} className="grid w-full"
                style={{ marginTop: m.sectionTop, gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))`, columnGap: m.actionGap }}>
                {actions.map(action => (
                  <div key={action.id} className="flex min-w-0 flex-col items-center">
                    <button type="button" data-slot="details-action" data-action={action.id}
                      aria-label={action.label} disabled={action.disabled} onClick={action.onPress}
                      className={cn("flex items-center justify-center rounded-full bg-[var(--mdt-fill)] p-0 text-[var(--mdt-tint)] transition-colors motion-reduce:transition-none",
                        "enabled:hover:bg-[var(--mdt-fill-hover)] disabled:text-[var(--mdt-tertiary)]", focusRing)}
                      style={{ width: m.actionButton, height: m.actionButton }}>
                      <ActionGlyph icon={action.icon} />
                    </button>
                    <span aria-hidden="true" className="mt-[5px] truncate text-[var(--mdt-secondary)]"
                      style={{ fontSize: 11, lineHeight: "14px", letterSpacing: -0.2 }}>{action.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {shownPhotos.length ? (
            <section data-slot="details-section" aria-labelledby={photosId} style={sectionStyle} className="border-t border-[var(--mdt-separator)]">
              <SectionHeading id={photosId} title="Photos" action={onSeeAllPhotos ? "See All Photos" : undefined} onAction={onSeeAllPhotos} />
              <ul className="m-0 grid list-none p-0" style={{ gridTemplateColumns: `repeat(${m.photoColumns}, ${tile}px)`, gap: m.photoGap }}>
                {shownPhotos.map((item, index) => (
                  <li key={item.id} className="m-0 p-0">
                    <button type="button" data-slot="details-photo" onClick={item.onOpen}
                      aria-label={item.alt ?? `Shared photo ${index + 1}`}
                      className={cn("relative block overflow-hidden bg-[var(--mdt-tile)] p-0", focusRing)}
                      style={{ width: tile, height: tile, borderRadius: m.photoRadius, background: item.src ? "var(--mdt-tile)" : (item.fill ?? "var(--mdt-tile)") }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- registry components stay framework-neutral */}
                      {item.src ? <img src={item.src} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 size-full object-cover" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {links.length ? (
            <section data-slot="details-section" aria-labelledby={linksId} style={sectionStyle} className="border-t border-[var(--mdt-separator)]">
              <SectionHeading id={linksId} title="Links" action={onSeeAllLinks ? "See All Links" : undefined} onAction={onSeeAllLinks} />
              <ul className="m-0 flex list-none flex-col p-0" style={{ gap: 2 }}>
                {links.map(item => (
                  <li key={item.id} className="m-0 p-0">
                    <button type="button" data-slot="details-link" onClick={item.onOpen}
                      className={cn("flex w-full items-center bg-transparent p-0 text-left hover:bg-[var(--mdt-fill)]", focusRing)}
                      style={{ height: m.rowHeight, borderRadius: m.cardRadius, gap: m.avatarGap, paddingInline: 6 }}>
                      <span aria-hidden="true" className="flex shrink-0 text-[var(--mdt-tertiary)]"><LinkGlyph /></span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[var(--mdt-label)]" style={{ fontSize: 13, lineHeight: "16px", letterSpacing: -0.4 }}>{item.title}</span>
                        <span className="truncate text-[var(--mdt-secondary)]" style={{ fontSize: 11, lineHeight: "14px", letterSpacing: -0.2 }}>{item.host}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {attachments.length ? (
            <section data-slot="details-section" aria-labelledby={filesId} style={sectionStyle} className="border-t border-[var(--mdt-separator)]">
              <SectionHeading id={filesId} title="Documents" action={onSeeAllAttachments ? "See All Attachments" : undefined} onAction={onSeeAllAttachments} />
              <ul className="m-0 flex list-none flex-col p-0" style={{ gap: 2 }}>
                {attachments.map(item => (
                  <li key={item.id} className="m-0 p-0">
                    <button type="button" data-slot="details-attachment" onClick={item.onOpen}
                      className={cn("flex w-full items-center bg-transparent p-0 text-left hover:bg-[var(--mdt-fill)]", focusRing)}
                      style={{ height: m.rowHeight, borderRadius: m.cardRadius, gap: m.avatarGap, paddingInline: 6 }}>
                      <span aria-hidden="true" className="flex shrink-0 text-[var(--mdt-tertiary)]"><DocumentGlyph /></span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[var(--mdt-label)]" style={{ fontSize: 13, lineHeight: "16px", letterSpacing: -0.4 }}>{item.name}</span>
                        {item.meta ? <span className="truncate text-[var(--mdt-secondary)]" style={{ fontSize: 11, lineHeight: "14px", letterSpacing: -0.2 }}>{item.meta}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section data-slot="details-section" aria-labelledby={optionsId} style={{ paddingTop: m.sectionTop }} className="border-t border-[var(--mdt-separator)]">
            <h2 id={optionsId} className="sr-only">Conversation options</h2>
            {onHideAlertsChange ? (
              <div className="flex items-center justify-between" style={{ height: m.optionHeight, paddingInline: 6 }}>
                <span className="text-[var(--mdt-label)]" style={{ fontSize: 13, lineHeight: "16px", letterSpacing: -0.4 }}>Hide Alerts</span>
                <MacCheckbox checked={hideAlerts} onChange={onHideAlertsChange} label="Hide Alerts" />
              </div>
            ) : null}
            {onLeave ? (
              <button type="button" data-slot="details-leave" onClick={onLeave}
                className={cn("flex w-full items-center bg-transparent p-0 text-left text-[var(--mdt-red)] hover:bg-[var(--mdt-fill)]", focusRing)}
                style={{ height: m.optionHeight, borderRadius: m.cardRadius, paddingInline: 6, fontSize: 13, letterSpacing: -0.4 }}>
                Leave this Conversation
              </button>
            ) : null}
            {onBlock ? (
              <button type="button" data-slot="details-block" onClick={onBlock}
                className={cn("flex w-full items-center bg-transparent p-0 text-left text-[var(--mdt-red)] hover:bg-[var(--mdt-fill)]", focusRing)}
                style={{ height: m.optionHeight, borderRadius: m.cardRadius, paddingInline: 6, fontSize: 13, letterSpacing: -0.4 }}>
                Block Contact
              </button>
            ) : null}
            {onDelete ? (
              <button type="button" data-slot="details-delete" onClick={onDelete}
                className={cn("flex w-full items-center bg-transparent p-0 text-left text-[var(--mdt-red)] hover:bg-[var(--mdt-fill)]", focusRing)}
                style={{ height: m.optionHeight, borderRadius: m.cardRadius, paddingInline: 6, fontSize: 13, letterSpacing: -0.4 }}>
                Delete Conversation…
              </button>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
