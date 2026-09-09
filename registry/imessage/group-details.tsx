"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IosSwitch, iosDetailsMorph, iosDetailsMotion, subpixel } from "@/registry/imessage/ios-details";

/**
 * iOS 26 **group** conversation details, the screen a group's name pill opens.
 *
 * No capture in `references/` shows it. Every number below is therefore one of three things, and the
 * comment on each says which:
 *
 * **A. Measured, carried over from the one-to-one screen** (`ios-details.tsx`, read off
 * `references/ios/captures/details-light.png` and `details-dark.png`). The two screens share their
 * whole frame, so these are used unchanged:
 *
 * - Back button Ø44 glass circle at (16, 62); the header photo slot Ø80 centred (201, 102).
 * - Name 28pt bold, ink centred on x 201, box top 146.15.
 * - Round glass action circles Ø54 with their centres on y 222.67, on a 74 pt pitch about x 201.
 * - Grouped cells span x 16-386 (370 wide), radius 26 with a continuous corner, 20 between groups,
 *   first cell top 269.6667. Row text starts 16 in from the cell's leading edge (x 32), rows that
 *   carry plain text are 52 tall, and a row separator is a 1 pt hairline inset 16 from both edges.
 * - Cell and button fills: 6% black in light, 12% white in dark. Blue #0088ff / #0091ff, red
 *   #ff383c / #ff4245, separator #dadadb / #3a3a3c, secondary label #848488 / #98989f.
 * - The screen sits over the conversation, blurred σ18 and washed by a 49% white / 59% black scrim.
 * - `iosDetailsMotion` and `iosDetailsMorph` are imported rather than restated.
 *
 * **B. Read out of ChatKit 26** (`/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework`,
 * loaded into a Mac Catalyst process with `-[UIDevice userInterfaceIdiom]` swizzled to Phone so
 * `+[CKUIBehavior sharedBehaviors]` returns `CKUIBehaviorPhone`). Class and selector for each:
 *
 * | Value | Where it comes from |
 * |---|---|
 * | Participant row 64 tall | `-[CKUIBehaviorPhone detailsContactCellMinimumHeight]` = 64, and `+[CKDetailsContactsStandardTableViewCell preferredHeight]` returns the same 64 under Phone (40 under Mac) |
 * | Participant avatar Ø37 | `-[CKUIBehaviorPhone detailsViewContactImageDiameter]` = `-detailsAvatarDiameter` = 37 |
 * | Avatar to name gap 12 | `-[CKUIBehaviorPhone detailsContactAvatarLabelSpacing]` = 12 |
 * | Add Member row 44 tall | `+[CKDetailsAddMemberStandardCell preferredHeight]` = 44 |
 * | Add Member button Ø37 | `-[CKUIBehaviorPhone detailsAddButtonDiameter]` = 37 |
 * | Add Member glyph | `-[CKDetailsAddMemberStandardCell initWithStyle:reuseIdentifier:]` loads `+[UIImage systemImageNamed:@"plus"]` (the literal is in the disassembly at +216) and tints it `detailsTextColor` |
 * | Add Member circle fill | `-[CKUITheme detailsAddButtonBackgroundColor]` = rgba(118,118,128,0.12) light, 0.24 dark |
 * | Blue for links and Add Member | `-[CKUITheme detailsTextColor]` and `-detailsSeeAllButtonTextColor` = #0088ff light / #0091ff dark, which is exactly the blue already measured off `details-light.png` |
 * | Row chevron colour | `-[CKUITheme detailsContactCellChevronColor]` = rgba(0,0,0,0.259) light, rgba(255,255,255,0.247) dark |
 * | Stacked group photo | `-[CKDetailsAvatarPancakeView addConstraints]` reads `detailsAvatarDiameter` 37, `detailsAvatarCutoutDiameter` 41 and `detailsAvatarPancakeViewOverlapOffset` 13.5. Instantiating the view with three avatars lays them out at x 0 / 13.5 / 27, all on the same y, each behind a Ø41 knockout centred on it, and puts the **leading** avatar in front. So three heads span 64, each one punching a 2 pt ring out of the one behind it |
 * | Copy | `ChatKit.loctable` (en): `ADD_MEMBER` "Add Member", `LEAVE_CONVERSATION` "Leave this Conversation", `DETAILS_VIEW_HIDE_ALERTS_TOGGLE_TITLE` "Hide Alerts", `GROUP_NAME_PLACEHOLDER` "Enter a Group Name", `GROUP_NAME_LABEL` "Name", `SEE_ALL_PHOTOS_TITLE` "See All Photos", `SEE_ALL_LINKS_TITLE` "See All Links" |
 * | Two action buttons, not three | `CKDetailsGroupNameCell` carries exactly `_phoneButton` and `_facetimeVideoButton` (with `showPhoneButton` / `showFaceTimeVideoButton`); there is no mail button on a group |
 *
 * Three ChatKit values that were read and deliberately **not** used, so nobody re-derives them:
 * `+[CKDetailsContactsTableViewCell marginWidth]` = 56 (the same under both idioms, and it does not
 * reconcile with this screen's measured 16 pt content inset, so the name column is placed as
 * 16 + 37 + 12 = 65 instead); `-[CKUITheme detailsContactCellTitleColor]` = 84.7% label (the measured
 * screen paints row text at full strength, and one screen cannot have both); and
 * `+[CKDetailsGroupCountCell preferredHeight]` = 22 with `DETAILS_VIEW_GROUP_COUNT_TEXT` "%lu PEOPLE",
 * a section header that will not fit in the measured 20 pt gap above the first cell.
 *
 * **C. Judgement**, called out again in the report. Nothing here is measured:
 *
 * - The header stack is the ChatKit pancake scaled ×1.25, so that three heads span exactly the
 *   measured Ø80 header slot: avatars Ø46.25, step 16.875, knockout ring 2.5. The ×1.25 is the
 *   judgement; the proportions inside it are the framework's.
 * - The knockout is transparent rather than filled with `detailsGroupPhotoBackgroundColor`
 *   (#ececec / #1e1e1e), because this screen has no opaque ground: the blurred conversation shows
 *   through the ring.
 * - The row chevron's ink box (6.4 × 11.2, stroke 2.2) and the participant separator's leading inset
 *   (aligned to the name column at 65, not to the measured 16).
 * - The Photos strip: three square tiles across the cell's 16 pt insets with the 4 pt gaps and
 *   radius 12 measured on `photo-picker-light.png`, which works out at 110 pt tiles in a 142 pt row.
 * - The section order (participants, photos, links, Hide Alerts, Leave), chosen to mirror the
 *   measured one-to-one screen, which puts its destructive row last.
 * - Every duration: the presentation is `iosDetailsMotion`, whose timings that file already records
 *   as unmeasured.
 */

const font = "-apple-system, BlinkMacSystemFont, sans-serif";

/**
 * The one-to-one screen's palette verbatim (measured; see `ios-details.tsx`), plus the two fills
 * ChatKit vends for the Add Member button and the row chevron. Light/dark live in CSS variables so a
 * `.dark` ancestor flips the whole screen.
 */
const vars =
  "[--ios-dt-label:#000000] [--ios-dt-secondary:#848488] [--ios-dt-blue:#0088ff] [--ios-dt-red:#ff383c] " +
  "[--ios-dt-fill:rgba(0,0,0,0.06)] [--ios-dt-separator:#dadadb] [--ios-dt-glyph:#000000] [--ios-dt-glyph-off:rgba(0,0,0,0.26)] [--ios-dt-glyph-blend:normal] [--ios-dt-av-top:#a9c2e1] [--ios-dt-av-bottom:#747fb9] " +
  "[--ios-dt-track:rgba(0,0,0,0.21)] [--ios-dt-knob:#ffffff] [--ios-dt-add:rgba(118,118,128,0.12)] [--ios-dt-chevron:rgba(0,0,0,0.259)] " +
  "[--ios-dt-scrim:rgba(255,255,255,0.573)] [--ios-dt-saturate:1] [--ios-dt-page:#ffffff] " +
  "dark:[--ios-dt-label:#ffffff] dark:[--ios-dt-secondary:#98989f] dark:[--ios-dt-blue:#0091ff] dark:[--ios-dt-red:#ff4245] " +
  "dark:[--ios-dt-fill:rgba(235,235,245,0.12)] dark:[--ios-dt-separator:#3a3a3c] dark:[--ios-dt-glyph:#ffffff] dark:[--ios-dt-glyph-off:rgba(255,255,255,0.26)] dark:[--ios-dt-glyph-blend:plus-lighter] dark:[--ios-dt-av-top:#575368] dark:[--ios-dt-av-bottom:#302649] " +
  "dark:[--ios-dt-track:rgba(255,255,255,0.28)] dark:[--ios-dt-add:rgba(118,118,128,0.24)] dark:[--ios-dt-chevron:rgba(255,255,255,0.247)] " +
  "dark:[--ios-dt-scrim:rgba(0,0,0,0.587)] dark:[--ios-dt-saturate:1.05] dark:[--ios-dt-page:#000000]";

/** Apple's continuous corner. Browsers without `corner-shape` fall back to a plain round corner. */
const continuous = { cornerShape: "superellipse(1.14)" } as CSSProperties;

/** The measured frame this screen shares with `ios-details.tsx`. */
export const groupDetailsMetrics = {
  /** Grouped cells: x 16-386, radius 26, 20 apart, the first one at 269.6667. */
  cellLeft: 16, cellWidth: 370, cellRadius: 26, cellGap: 20, cellsTop: 269.6667,
  /** Row text and the separator's trailing inset, both 16 in from the cell's own edge. */
  rowInset: 16,
  /** A plain text row (Hide Alerts, Leave, See All), measured. */
  textRow: 52,
  /** ChatKit: participant rows are 64 tall with a Ø37 avatar 12 from its name; Add Member is 44. */
  participantRow: 64, avatar: 37, avatarGap: 12, addRow: 44, addButton: 37,
  /** ChatKit's pancake, and the ×1.25 that fits three of them across the measured Ø80 slot. */
  stackScale: 1.25, stackAvatar: 37, stackStep: 13.5, stackRing: 2,
  /** The header slot, measured: Ø80 centred (201, 102). */
  headerPhoto: 80, headerCentre: { x: 201, y: 102 },
} as const;

/**
 * Photos strip: the 4 pt gaps and the radius 12 are measured on `photo-picker-light.png`; three
 * across the cell's own 16 pt insets then gives 110 pt tiles in a 142 pt row. UNVERIFIED.
 */
const photoTile = (groupDetailsMetrics.cellWidth - 2 * groupDetailsMetrics.rowInset - 2 * 4) / 3;

export type GroupParticipant = {
  id: string;
  name: string;
  /** Two letters. Ignored when `avatar` is given. */
  initials?: string;
  /** Replaces the initials circle (an <img>, say). */
  avatar?: ReactNode;
  onPress?: () => void;
};

export type GroupDetailsAction = {
  id: string;
  label: string;
  icon: "phone" | "video";
  /** Unavailable actions keep the glass circle and drop the glyph to tertiary label (measured). */
  disabled?: boolean;
  onPress?: () => void;
};

export type GroupDetailsPhoto = { id: string; src: string; alt: string; onPress?: () => void };
export type GroupDetailsLink = { id: string; title: string; host?: string; onPress?: () => void };

export type GroupDetailsProps = Omit<ComponentProps<"div">, "children" | "onChange"> & {
  /** The group's name. Empty shows ChatKit's own placeholder, "Enter a Group Name". */
  name: string;
  /** Makes the name an editable field, the way a group's name is in native. */
  onNameChange?: (next: string) => void;
  namePlaceholder?: string;
  /** Drawn as ChatKit's stacked pancake: the first three, leading one in front. */
  participants?: GroupParticipant[];
  /** Defaults to the two a group gets in ChatKit: audio and FaceTime video. */
  actions?: GroupDetailsAction[];
  addMemberLabel?: string;
  onAddMember?: () => void;
  photos?: GroupDetailsPhoto[];
  onSeeAllPhotos?: () => void;
  seeAllPhotosLabel?: string;
  links?: GroupDetailsLink[];
  onSeeAllLinks?: () => void;
  seeAllLinksLabel?: string;
  hideAlerts?: boolean;
  onHideAlertsChange?: (next: boolean) => void;
  hideAlertsLabel?: string;
  leaveLabel?: string;
  onLeave?: () => void;
  onBack?: () => void;
  /** The conversation behind the screen; rendered blurred and washed out. */
  backdrop?: ReactNode;
  /**
   * Seek the presentation to this fraction instead of playing it, which is what the harness does:
   * while `open`, 0 is dismissed and 1 is settled; while it is closing, 0 is settled and 1 is gone.
   * Leave it unset for the real thing.
   */
  progress?: number;
  /** False plays the dismissal; `onExited` fires when it is over, and the consumer unmounts then. */
  open?: boolean;
  onExited?: () => void;
};

type Pose = Record<string, string>;
type Layer = { el: HTMLElement; from: Pose; to: Pose; duration: number; delay: number; easing: string };

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }
function stop(animation: Animation) { try { animation.cancel(); } catch { /* already gone */ } }

/**
 * Where in the rise the sheet stands `covered` of the way up: the entrance curve read backwards, so a
 * drag scrubs the timeline instead of leaving the screen nearly still under a finger that has already
 * moved 200 pt. Same control points as `iosDetailsMotion.ease`.
 */
const sheetCurve = [0.32, 0.72, 0, 1] as const;
function riseSeek(covered: number): number {
  const [x1, y1, x2, y2] = sheetCurve;
  const at = (a: number, b: number, t: number) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  let low = 0, high = 1, t = 0.5;
  for (let step = 0; step < 24; step++) { t = (low + high) / 2; if (at(y1, y2, t) < covered) low = t; else high = t; }
  return at(x1, x2, t);
}

/** What an element is holding right now, so a dismissal can start from a half-played entrance or a drag. */
function poseNow(el: HTMLElement, shape: Pose): Pose {
  const style = getComputedStyle(el);
  const pose: Pose = {};
  for (const key of Object.keys(shape)) pose[key] = style.getPropertyValue(key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)) || shape[key];
  return pose;
}

/**
 * Every layer of the presentation, as the pose it holds while dismissed and the pose it settles on.
 * The settled pose is what the element already carries at rest, so cancelling the timeline when it
 * lands leaves the screen with no animation, no transform and its glass intact.
 *
 * The header morphs out of the conversation's own nav bar, exactly as the one-to-one screen does:
 * the group photo is Ø60 there (`-[CKUIBehaviorPhone groupAvatarViewSize]` = 60 × 60, which is also
 * the measured nav-bar avatar) and Ø80 here, and the name is 17pt there and 28pt here, so
 * `iosDetailsMorph` transfers unchanged.
 */
function groupLayers(content: HTMLElement, blur: HTMLElement | null, scrim: HTMLElement | null, height: number, saturate: string): Layer[] {
  const m = iosDetailsMotion;
  const layers: Layer[] = [];
  const add = (el: HTMLElement | null, from: Pose, to: Pose, duration: number, delay = 0, easing: string = m.ease) => {
    if (el) layers.push({ el, from, to, duration, delay, easing });
  };
  const one = (slot: string) => content.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
  const each = (slot: string) => Array.from(content.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
  // The chrome that both screens share is already on screen, in the same place: it cancels the
  // sheet's rise exactly (same duration, same easing) and morphs out of the nav bar instead.
  const stay = (dy: number) => `0px ${(dy - height).toFixed(3)}px`;

  add(blur,
    { filter: `blur(0px) saturate(${saturate})`, scale: "1" },
    { filter: `blur(${(m.blur / m.backdropScale).toFixed(3)}px) saturate(${saturate})`, scale: String(m.backdropScale) },
    m.sheet);
  add(scrim, { opacity: "0" }, { opacity: "1" }, m.dim, 0, "ease-out");
  add(content, { translate: `0px ${height}px` }, { translate: "0px 0px" }, m.sheet);
  add(one("back"), { translate: stay(0) }, { translate: "0px 0px" }, m.sheet);
  add(one("back"), { opacity: "0" }, { opacity: "1" }, m.dim, 0, "ease-out");
  add(one("avatar"), { translate: stay(iosDetailsMorph.avatar.dy), scale: String(iosDetailsMorph.avatar.scale) }, { translate: "0px 0px", scale: "1" }, m.sheet);
  add(one("name"), { translate: stay(iosDetailsMorph.name.dy), scale: String(iosDetailsMorph.name.scale) }, { translate: "0px 0px", scale: "1" }, m.sheet);
  each("action").forEach((el, index) => add(el, { translate: `0px ${m.actionRise}px` }, { translate: "0px 0px" }, m.actionDuration, m.actionStart + index * m.actionStagger));
  each("cell").forEach((el, index) => add(el, { translate: `0px ${m.cellRise}px` }, { translate: "0px 0px" }, m.cellDuration, m.cellStart + index * m.cellStagger));
  return layers;
}

/** Web Animations, not a rAF loop or a transition, so `document.getAnimations()` can seek a frame. */
function runLayers(layers: Layer[], phase: "enter" | "exit"): Animation[] {
  const m = iosDetailsMotion;
  return layers.map(({ el, from, to, duration, delay, easing }) => phase === "enter"
    ? el.animate([from, to], { duration, delay, easing, fill: "both" })
    // One flat span on the way out, so the shared chrome's counter-translate still cancels the
    // sheet's exactly, and it starts from wherever the layer is now (settled, or mid-drag).
    : el.animate([poseNow(el, from), from], { duration: m.exit, easing: m.exitEase, fill: "both" }));
}

/** Swallows the click a drag would otherwise leave behind on whatever control it started on. */
function swallowClick(node: HTMLElement | null) {
  if (!node) return;
  const swallow = (event: Event) => { event.stopPropagation(); event.preventDefault(); };
  node.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => node.removeEventListener("click", swallow, true), 0);
}

type GlassCircleProps = ComponentProps<"button"> & { size: number; "data-slot"?: string; "data-action"?: string };

function GlassCircle({ size, className, style, children, ...rest }: GlassCircleProps) {
  return (
    <button type="button"
      className={cn("absolute flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088ff]", className)}
      style={{ width: size, height: size, background: "var(--ios-dt-fill)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", ...style }}
      {...rest}>
      {children}
    </button>
  );
}

/**
 * The two glyphs a group's header carries, at the ink sizes measured inside the Ø54 circles of
 * `details-light.png` (phone x 118.0-136.0 y 213.67-231.33, video x 190.0-213.11 y 215.02-230.33).
 * Copied from `ios-details.tsx` rather than re-derived; the envelope has no place on a group.
 */
function ActionGlyph({ icon }: { icon: GroupDetailsAction["icon"] }) {
  if (icon === "phone") {
    return (
      <svg aria-hidden="true" width="18.36" height="17.3333" viewBox="1.72 1.25 13.5 13.5" fill="currentColor">
        <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.6 17.6 0 0 0 4.168 6.608 17.6 17.6 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.68.68 0 0 0-.58-.122l-2.19.547a1.75 1.75 0 0 1-1.657-.459L5.482 8.062a1.75 1.75 0 0 1-.46-1.657l.548-2.19a.68.68 0 0 0-.122-.58z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width="23" height="15.3333" viewBox="0 0 23 15.3333" fill="currentColor" style={{ transform: "translateY(0.3333px)" }}>
      <rect x="0" y="0" width="16.3333" height="15.3333" rx="3.6" />
      <path d="M17.969 4.312 22.531 1.508Q23 1.22 23 1.77V13.53Q23 14.08 22.531 13.792L17.969 10.988Q17.5 10.7 17.5 10.15V5.15Q17.5 4.6 17.969 4.312Z" />
    </svg>
  );
}

/** Trailing chevron on a participant row. UNVERIFIED geometry; the colour is ChatKit's. */
function RowChevron() {
  return (
    <svg aria-hidden="true" width="6.4" height="11.2" viewBox="0 0 6.4 11.2" fill="none"
      stroke="var(--ios-dt-chevron)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.1 1.1 5.3 5.6 1.1 10.1" />
    </svg>
  );
}

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? "").join("").toUpperCase();
}

type CircleProps = { size: number; initials?: string; avatar?: ReactNode; style?: CSSProperties };

/**
 * One head. The gradient and the 7/15 initials ratio are `avatar.tsx`'s measured values, restated
 * here through this screen's own `--ios-dt-av-*` variables so the file installs on its own.
 */
function Head({ size, initials, avatar, style }: CircleProps) {
  return (
    <span aria-hidden="true" className="absolute flex items-center justify-center overflow-hidden rounded-full text-white"
      style={{
        width: size, height: size, fontSize: (size * 7) / 15, fontWeight: 600, lineHeight: 1, letterSpacing: 0,
        background: "linear-gradient(var(--ios-dt-av-top), var(--ios-dt-av-bottom))", ...style,
      }}>
      {avatar ?? <span style={{ transform: "translateY(0.02em)" }}>{initials}</span>}
    </span>
  );
}

/**
 * ChatKit's `CKDetailsAvatarPancakeView`: up to three heads on one row, each stepped 13.5/37 of a
 * diameter to the trailing side, the leading one in front, and each punching a ring 2/37 of a
 * diameter wide out of the head behind it. Scaled ×1.25 here (judgement) so three of them span the
 * measured Ø80 header slot.
 */
function GroupPhotoStack({ participants, scale }: { participants: GroupParticipant[]; scale: number }) {
  const { stackAvatar, stackStep, stackRing } = groupDetailsMetrics;
  const diameter = stackAvatar * scale;
  const step = stackStep * scale;
  const ring = stackRing * scale;
  const heads = participants.slice(0, 3);
  const count = Math.max(heads.length, 1);
  const width = diameter + (count - 1) * step;
  // The hole a head punches in the one behind it, in that trailing head's own box.
  const hole = diameter / 2 + ring;
  const cut = `radial-gradient(circle at ${(diameter / 2 - step).toFixed(4)}px ${(diameter / 2).toFixed(4)}px, transparent ${(hole - 0.25).toFixed(4)}px, #000 ${(hole + 0.25).toFixed(4)}px)`;
  return (
    <span aria-hidden="true" className="relative block" style={{ width, height: diameter }}>
      {/* Painted back to front, so the leading head ends up on top the way the framework stacks it. */}
      {heads.slice().reverse().map((person, index) => {
        const position = heads.length - 1 - index;
        return (
          <Head key={person.id} size={diameter} initials={person.initials ?? initialsOf(person.name)} avatar={person.avatar}
            style={position === 0 ? { left: 0, top: 0 } : { left: position * step, top: 0, maskImage: cut, WebkitMaskImage: cut }} />
        );
      })}
      {heads.length === 0 && <Head size={diameter} initials="" style={{ left: 0, top: 0 }} />}
    </span>
  );
}

/**
 * A grouped cell. Blink snaps a painted box to whole CSS px, so the fill sits on an integer box and
 * a transform carries the fraction, exactly as the one-to-one screen's cells do.
 */
function Cell({ children }: { children: ReactNode }) {
  return (
    <div data-slot="cell" className="relative" style={{ width: groupDetailsMetrics.cellWidth }}>
      <span aria-hidden="true" data-slot="cell-fill" className="absolute inset-0" style={{
        borderRadius: groupDetailsMetrics.cellRadius, background: "var(--ios-dt-fill)", ...continuous,
      }} />
      <div className="relative">{children}</div>
    </div>
  );
}

/** The 1 pt hairline between rows. `inset` is how far its leading end sits in from the cell's edge. */
function Separator({ inset }: { inset: number }) {
  return <span aria-hidden="true" data-slot="separator" className="absolute" style={{ left: inset, right: groupDetailsMetrics.rowInset, top: 0, height: 1, background: "var(--ios-dt-separator)" }} />;
}

type RowProps = ComponentProps<"button"> & { height: number; "data-slot"?: string };

/**
 * One row. A row with no handler is not a control: it renders as a plain block rather than an empty
 * button, so nothing lands on a focus stop that does nothing.
 */
function Row({ height, className, style, children, onClick, ...rest }: RowProps) {
  const shape = cn("relative flex w-full items-center text-left", className);
  const box: CSSProperties = { height, paddingLeft: groupDetailsMetrics.rowInset, paddingRight: groupDetailsMetrics.rowInset, ...style };
  if (!onClick) return <div className={shape} style={box} {...(rest as ComponentProps<"div">)}>{children}</div>;
  return (
    <button type="button" onClick={onClick}
      className={cn(shape, "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff]")}
      style={{ ...box, borderRadius: groupDetailsMetrics.cellRadius }}
      {...rest}>
      {children}
    </button>
  );
}

export function GroupDetails({
  name, onNameChange, namePlaceholder = "Enter a Group Name",
  participants = [], actions,
  addMemberLabel = "Add Member", onAddMember,
  photos = [], onSeeAllPhotos, seeAllPhotosLabel = "See All Photos",
  links = [], onSeeAllLinks, seeAllLinksLabel = "See All Links",
  hideAlerts = false, onHideAlertsChange, hideAlertsLabel = "Hide Alerts",
  leaveLabel = "Leave this Conversation", onLeave,
  onBack, backdrop, progress, open = true, onExited, className, style, ...props
}: GroupDetailsProps) {
  const nameId = useId();
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const blur = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const timeline = useRef<Animation[] | null>(null);
  const landed = useRef(false);
  const exited = useRef(onExited);
  useEffect(() => { exited.current = onExited; }, [onExited]);

  // ChatKit gives a group exactly two of these: `CKDetailsGroupNameCell` carries a phone button and a
  // FaceTime video button and no mail button.
  const buttons: GroupDetailsAction[] = actions ?? [
    { id: "audio", label: "Audio", icon: "phone" },
    { id: "video", label: "FaceTime", icon: "video" },
  ];

  // The dismissal is derived during render, not in an effect: an effect leaves one committed frame
  // with the screen already gone, and the exit never runs. `closing` also separates a screen that is
  // leaving (fire `onExited`, stop taking clicks) from one mounted closed, which just sits dismissed.
  const [seenOpen, setSeenOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  if (seenOpen !== open) { setSeenOpen(open); setClosing(!open); }

  const build = (phase: "enter" | "exit"): Animation[] | null => {
    const node = content.current;
    const box = root.current;
    if (!node || !box) return null;
    const height = box.getBoundingClientRect().height;
    if (!height) return null;
    const saturate = getComputedStyle(box).getPropertyValue("--ios-dt-saturate").trim() || "1";
    return runLayers(groupLayers(node, blur.current, scrim.current, height, saturate), phase);
  };
  const land = (list: Animation[]) => {
    if (timeline.current !== list) return;
    list.forEach(stop);
    timeline.current = null;
    landed.current = true;
  };

  // Only unmount cancels the timeline. The two phases hand over to each other without one, so a
  // dismissal can read the pose the entrance, or a drag, is still holding.
  useEffect(() => () => { timeline.current?.forEach(stop); timeline.current = null; }, []);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) { landed.current = true; return; }
    const previous = timeline.current;
    const next = build(open ? "enter" : "exit");
    previous?.forEach(stop);
    timeline.current = next;
    landed.current = false;
    // One rebuild per phase, and `build` only reads refs.
  }, [open]);

  useLayoutEffect(() => {
    // Reduced motion: the screen is simply there, and leaves at once. Its resting styles are the
    // settled pose, so there is nothing to undo.
    if (prefersReducedMotion()) { if (!open && closing) exited.current?.(); return; }
    const list = timeline.current ?? build(open ? "enter" : "exit");
    if (!list) return;
    timeline.current = list;
    const total = open ? iosDetailsMotion.enter : iosDetailsMotion.exit;
    const seek = (time: number) => list.forEach(animation => { animation.pause(); try { animation.currentTime = time; } catch { /* no timeline yet */ } });
    if (progress !== undefined) {
      const time = clamp01(progress) * total;
      seek(time);
      // A settled checkpoint is screenshotted, so drop the timeline there and let the glass breathe.
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
  }, [open, progress, closing]);

  // The screen covers the conversation, so Escape backs out of it the way the back button does.
  useEffect(() => {
    if (!open || !onBack) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onBack(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onBack]);

  /**
   * Drag down to dismiss. It seeks the entrance backwards rather than writing its own styles, so a
   * half-dragged screen is the same pose as a half-played entrance. A group's list can be longer than
   * the screen, so the drag only starts when the list is already at its top, which is what native
   * does too; below that the finger scrolls.
   */
  const drag = useRef<{ id: number; from: number; last: number; at: number; velocity: number; live: boolean } | null>(null);
  const playIn = () => {
    const list = timeline.current;
    if (!list) return;
    list.forEach(animation => animation.play());
    Promise.allSettled(list.map(animation => animation.finished)).then(() => land(list));
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!open || closing || progress !== undefined || !onBack || !landed.current || prefersReducedMotion()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((scroller.current?.scrollTop ?? 0) > 0) return;
    drag.current = { id: event.pointerId, from: event.clientY, last: event.clientY, at: event.timeStamp, velocity: 0, live: false };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    const dy = event.clientY - state.from;
    if (!state.live) {
      // A tap, or a drag back up, leaves the controls alone.
      if (dy < 8) return;
      state.live = true;
      event.currentTarget.setPointerCapture(state.id);
      const list = timeline.current ?? build("enter");
      if (list) { timeline.current = list; list.forEach(animation => { animation.pause(); try { animation.currentTime = iosDetailsMotion.enter; } catch { /* no timeline yet */ } }); }
    }
    const elapsed = event.timeStamp - state.at;
    if (elapsed > 0) state.velocity = (event.clientY - state.last) / elapsed;
    state.last = event.clientY;
    state.at = event.timeStamp;
    // The sheet rises by the frame's own height, so tracking the finger means seeking to wherever
    // the rise stands `1 - dy / height` of the way up.
    const height = root.current?.getBoundingClientRect().height || 1;
    const back = riseSeek(clamp01(1 - dy / height)) * iosDetailsMotion.sheet;
    timeline.current?.forEach(animation => { animation.pause(); try { animation.currentTime = back; } catch { /* no timeline yet */ } });
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    drag.current = null;
    if (!state.live) return;
    swallowClick(root.current);
    const dy = event.clientY - state.from;
    // Ask for the dismissal first: the exit builds from the pose this drag is holding. Then play the
    // entrance back in, which springs the screen home if the consumer does not take the dismissal.
    if (dy > iosDetailsMotion.dragCommit || state.velocity > iosDetailsMotion.dragVelocity) onBack?.();
    playIn();
  };

  const { cellLeft, cellGap, cellsTop, rowInset, textRow, participantRow, avatar, avatarGap, addRow, addButton, headerPhoto, stackScale } = groupDetailsMetrics;
  const nameColumn = rowInset + avatar + avatarGap;
  const stackWidth = (avatar + Math.max(Math.min(participants.length, 3) - 1, 0) * groupDetailsMetrics.stackStep) * stackScale;

  return (
    <div ref={root} data-slot="group-details" data-state={open ? "open" : "closing"}
      data-progress={progress === undefined ? undefined : clamp01(progress).toFixed(3)}
      role="dialog" aria-modal="true" aria-label={name || namePlaceholder}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
      className={cn("relative isolate size-full select-none overflow-hidden", vars, className)}
      style={{ fontFamily: font, ...style }} {...props}>
      {backdrop !== undefined && (
        <div aria-hidden="true" data-slot="backdrop" className="absolute inset-0 -z-10 overflow-hidden">
          {/*
            Blurring a box larger than the screen keeps the filter's own edge falloff off-screen, and
            the same box takes the sheet's push-back. The blur is divided by that scale, so what lands
            on screen is the measured σ18 either way.
          */}
          <div ref={blur} data-slot="details-blur" className="absolute"
            style={{ inset: -60, background: "var(--ios-dt-page)", scale: String(iosDetailsMotion.backdropScale), filter: `blur(${(iosDetailsMotion.blur / iosDetailsMotion.backdropScale).toFixed(3)}px) saturate(var(--ios-dt-saturate))` }}>
            <div className="absolute" style={{ inset: 60 }}>{backdrop}</div>
          </div>
          <div ref={scrim} data-slot="details-scrim" className="absolute inset-0" style={{ background: "var(--ios-dt-scrim)" }} />
        </div>
      )}

      {/* At rest the wrapper carries no transform: a transform node makes Chrome snap descendants to
          whole CSS px, and the entrance is cancelled the moment it lands for exactly that reason. */}
      <div ref={content} data-slot="details-content" className="absolute inset-0"
        style={closing ? { pointerEvents: "none" } : undefined}>
        <GlassCircle size={44} data-slot="back" aria-label="Back" onClick={onBack} style={{ left: 16, top: 62 }}>
          <svg aria-hidden="true" width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="var(--ios-dt-glyph)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M24.8 13.87 16.2 22.17 24.8 30.47" />
          </svg>
        </GlassCircle>

        {/* The stack is centred on the measured slot's own centre, (201, 102). */}
        <div data-slot="avatar" className="absolute flex items-center justify-center"
          style={{ left: 201 - stackWidth / 2, top: 62, width: stackWidth, height: headerPhoto }}>
          <GroupPhotoStack participants={participants} scale={stackScale} />
        </div>

        {onNameChange ? (
          <input id={nameId} data-slot="name" value={name} placeholder={namePlaceholder} aria-label="Name"
            onChange={event => onNameChange(event.target.value)}
            className="absolute m-0 select-text bg-transparent p-0 text-center outline-none placeholder:text-[color:var(--ios-dt-secondary)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0088ff]"
            style={{ left: 16, right: 16, top: 146.15, width: "auto", fontSize: 28, lineHeight: "33px", fontWeight: 700, letterSpacing: 0, color: "var(--ios-dt-label)", fontFamily: font }} />
        ) : (
          <h1 id={nameId} data-slot="name" className="absolute m-0 whitespace-nowrap text-center"
            style={{ left: 0, right: 0, top: 146.15, fontSize: 28, lineHeight: "33px", fontWeight: 700, letterSpacing: 0, color: name ? "var(--ios-dt-label)" : "var(--ios-dt-secondary)" }}>
            {name || namePlaceholder}
          </h1>
        )}

        {buttons.map((action, index) => (
          <GlassCircle key={action.id} size={54} data-slot="action" data-action={action.id} aria-label={action.label}
            aria-disabled={action.disabled || undefined} onClick={action.disabled ? undefined : action.onPress}
            style={{
              ...subpixel(195.6667),
              // Measured 74 pt pitch about x 201: two circles sit at 164 and 238.
              left: 201 - (buttons.length * 74 - 20) / 2 + index * 74,
              color: action.disabled ? "var(--ios-dt-glyph-off)" : "var(--ios-dt-glyph)",
              mixBlendMode: action.disabled ? "var(--ios-dt-glyph-blend)" as CSSProperties["mixBlendMode"] : undefined,
            }}>
            <ActionGlyph icon={action.icon} />
          </GlassCircle>
        ))}

        {/*
          A group's member list runs past the bottom of the screen, so the cells scroll under a
          header that stays put. The scroller starts at the measured first-cell top, so a cell
          scrolling away is clipped there rather than sliding behind the name. Two things depend on
          the header being outside it: the chrome that morphs out of the nav bar counter-translates
          the sheet's whole rise, which a scroller would clip away, and the glass circles keep the
          conversation as their backdrop.
        */}
        <div ref={scroller} data-slot="scroll" className="absolute inset-x-0 bottom-0 overflow-y-auto overscroll-contain" style={{ top: cellsTop }}>
          <div className="relative" style={{ paddingBottom: 24 }}>
            <div className="flex flex-col items-start" style={{ paddingLeft: cellLeft, gap: cellGap }}>
              {(participants.length > 0 || onAddMember) && (
                <Cell>
                  <ul className="m-0 list-none p-0">
                    {participants.map((person, index) => (
                      <li key={person.id} className="relative">
                        {index > 0 && <Separator inset={nameColumn} />}
                        <Row height={participantRow} data-slot="participant" onClick={person.onPress}>
                          <Head size={avatar} initials={person.initials ?? initialsOf(person.name)} avatar={person.avatar}
                            style={{ left: rowInset, top: (participantRow - avatar) / 2 }} />
                          <span className="truncate" style={{ paddingLeft: avatar + avatarGap, fontSize: 17, lineHeight: "22px", color: "var(--ios-dt-label)" }}>{person.name}</span>
                          {person.onPress && <span className="ml-auto flex items-center pl-2"><RowChevron /></span>}
                        </Row>
                      </li>
                    ))}
                    {onAddMember && (
                      <li className="relative">
                        {participants.length > 0 && <Separator inset={nameColumn} />}
                        <Row height={addRow} data-slot="add-member" onClick={onAddMember}>
                          <span aria-hidden="true" className="absolute flex items-center justify-center rounded-full"
                            style={{ left: rowInset, top: (addRow - addButton) / 2, width: addButton, height: addButton, background: "var(--ios-dt-add)" }}>
                            {/* ChatKit loads the "plus" SF Symbol here and tints it detailsTextColor. */}
                            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="var(--ios-dt-blue)" strokeWidth="2.1" strokeLinecap="round">
                              <path d="M8.5 2.4v12.2M2.4 8.5h12.2" />
                            </svg>
                          </span>
                          <span style={{ paddingLeft: addButton + avatarGap, fontSize: 17, lineHeight: "22px", color: "var(--ios-dt-blue)" }}>{addMemberLabel}</span>
                        </Row>
                      </li>
                    )}
                  </ul>
                </Cell>
              )}

              {photos.length > 0 && (
                <Cell>
                  <ul className="m-0 flex list-none p-0" style={{ gap: 4, padding: rowInset }}>
                    {photos.slice(0, 3).map(photo => (
                      <li key={photo.id}>
                        <button type="button" data-slot="photo" onClick={photo.onPress} aria-label={photo.alt}
                          className="block overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088ff]"
                          style={{ width: photoTile, height: photoTile, borderRadius: 12 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- registry components stay framework-neutral */}
                          <img src={photo.src} alt="" className="size-full object-cover" draggable={false} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {onSeeAllPhotos && (
                    <div className="relative">
                      <Separator inset={rowInset} />
                      <Row height={textRow} data-slot="see-all-photos" onClick={onSeeAllPhotos}
                        style={{ fontSize: 17, lineHeight: "22px", color: "var(--ios-dt-blue)" }}>
                        {seeAllPhotosLabel}
                      </Row>
                    </div>
                  )}
                </Cell>
              )}

              {links.length > 0 && (
                <Cell>
                  <ul className="m-0 list-none p-0">
                    {links.map((link, index) => (
                      <li key={link.id} className="relative">
                        {index > 0 && <Separator inset={rowInset} />}
                        <Row height={textRow} data-slot="link" onClick={link.onPress}
                          aria-label={link.host ? `${link.title}, ${link.host}` : undefined}>
                          <span className="truncate" style={{ fontSize: 17, lineHeight: "22px", color: "var(--ios-dt-label)" }}>{link.title}</span>
                          {link.onPress && <span className="ml-auto flex items-center pl-2"><RowChevron /></span>}
                        </Row>
                      </li>
                    ))}
                    {onSeeAllLinks && (
                      <li className="relative">
                        <Separator inset={rowInset} />
                        <Row height={textRow} data-slot="see-all-links" onClick={onSeeAllLinks}
                          style={{ fontSize: 17, lineHeight: "22px", color: "var(--ios-dt-blue)" }}>
                          {seeAllLinksLabel}
                        </Row>
                      </li>
                    )}
                  </ul>
                </Cell>
              )}

              <Cell>
                <div className="flex items-center justify-between" style={{ height: textRow, paddingLeft: rowInset, paddingRight: 14 }}>
                  <span data-slot="hide-alerts-label" style={{ fontSize: 17, lineHeight: "22px", transform: "translateY(0.6667px)", color: "var(--ios-dt-label)" }}>{hideAlertsLabel}</span>
                  <IosSwitch checked={hideAlerts} onChange={onHideAlertsChange} label={hideAlertsLabel} style={{ transform: "translateY(0.3333px)" }} />
                </div>
              </Cell>

              <Cell>
                <Row height={textRow} data-slot="leave" onClick={onLeave}
                  style={{ fontSize: 17, lineHeight: "22px", transform: "translateY(0.6667px)", color: "var(--ios-dt-red)" }}>
                  {leaveLabel}
                </Row>
              </Cell>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
