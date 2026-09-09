"use client";

import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Avatar, type AvatarProps } from "@/registry/imessage/avatar";

/**
 * The two avatar surfaces a group conversation has and a one-to-one does not: the stacked group
 * photo, and the small per-sender photo beside an incoming bubble.
 *
 * Nothing in `references/` captures a group conversation. `grouped-light.png` is named for message
 * *grouping* (clusters and tails) and is a two-person thread, so every number below was read out of
 * the frameworks on this machine rather than off a screenshot. The probes ran as a Mac Catalyst
 * binary (`clang -target arm64-apple-ios26.0-macabi`) that dlopens ChatKit and asks
 * `CKUIBehaviorPhone` — the iPhone behaviour object — directly, so these are the phone values and
 * not the Mac ones.
 *
 * ## The stack
 *
 * A group photo is not a ChatKit drawing at all: `CKAvatarView` is a `CNAvatarView` subclass, and
 * ContactsUICore lays the faces out through
 * `+[CNUIAvatarLayoutManager layoutConfigurationsForType:withItemCount:]`. Type 2 is
 * `SnowglobeAvatarLayoutConfigurations`, the one Messages uses (type 3, its sibling, is named
 * `SnowglobeGroupTypingIndicatorAvatarLayoutConfigurations`, which only a Messages transcript has).
 * Each entry is a `CNUIAvatarLayoutItemConfiguration` carrying `x`, `y`, `size` and `baseSize`, and
 * `-itemFrameInContainingBounds:isRTL:` turns one into a frame:
 *
 * ```
 * s = bounds.width / baseSize          baseSize is 88 for every Snowglobe entry
 * d = size * s
 * frame = (bounds.midX + x*s - d/2, bounds.midY + y*s - d/2, d, d)
 * ```
 *
 * `snowglobeStack` below is that table, verbatim, read back at a bounds of 88 so the numbers are the
 * configurations' own. One participant fills the circle; two through six extend one another; seven
 * re-lays the whole set. `+[CNUIAvatarLayoutManager maxAvatarCountForType:]` answers 10, but the
 * table itself stops at **seven faces**: asking for 8, 9, 10 or 11 returns the same seven entries,
 * so an eighth participant is simply not drawn. `isRTL:YES` mirrors x about the centre (verified:
 * two faces at a bounds of 88 return x 9.5 / 47.5 in LTR and 30.5 / 12.5 in RTL) and nothing else.
 *
 * Stacking order comes from `-[CNUIAvatarLayoutItemConfiguration updateLayer:inBounds:atIndex:isRTL:layoutType:]`,
 * which ends in `setZPosition:` of **-index**: the first (largest) face is in front and each later,
 * smaller one sits behind it. There is no ring, cut-out or hairline between the faces — no selector
 * in ContactsUI or ContactsUICore draws one, they simply overlap.
 *
 * `-[CKUIBehaviorPhone groupAvatarViewSize]` is 60 x 60, which is the same Ø 60 the nav-bar avatar
 * measures in `conv3-light.png`, so that is the default size here. (`detailsAvatarPancakeView*` on
 * the same object — diameter 37, cut-out 41, overlap 13.5, widths 58 and 72 for two and three — is a
 * *different* stack, `CKDetailsAvatarPancakeView`, used by the details screen's participant header.
 * It is not this one.)
 *
 * ## The per-sender avatar
 *
 * `-[CKUIBehaviorPhone transcriptContactImageDiameter]` is **32**, and
 * `-[CKTranscriptAvatarSupplementaryView initWithFrame:]` builds its `CKAvatarView` at exactly
 * `(0, 0, 32, 32)`, no inset. `-[CKUIBehaviorPhone contactPhotoBalloonMargin]` is **7**: it is added
 * to the diameter in `-[CKTranscriptAbstractLabelCell layoutSubviewsForContents]` (and in the
 * balloon, message and stamp cells) as `transcriptContactImageDiameter + contactPhotoBalloonMargin`
 * = **39**, the whole leading gutter an incoming row gives up in a group.
 *
 * Placement is `+[CKChatItemLayoutUtilities avatarSupplementaryItemForChatItem:layoutEnvironment:]`:
 * a square supplementary item of that diameter, anchored with
 * `[NSCollectionLayoutAnchor layoutAnchorWithEdges:6 absoluteOffset:(-32, 0)]`. Edges 6 is
 * `NSDirectionalRectEdge.leading | .bottom`, so the avatar hangs off the balloon's leading edge and
 * its **bottom lines up with the balloon's bottom** — which is why a cluster carries one avatar, on
 * its last (tailed) bubble. `+[CKChatItemLayoutUtilities balloonEdgeSpacingForItemWithLayoutEnvironment:orientation:itemSize:supplementaryItems:]`
 * then spends that same offset: leading spacing = `marginInsets.left - tailSize.width + |offset|`.
 *
 * The group typing indicator uses a bigger face:
 * `-[CKUIBehaviorPhone transcriptGroupTypingContactImageDiameter]` is 44, taken by the same
 * `avatarSupplementaryItemForChatItem:` when the item is a typing indicator. `typing-indicator.tsx`
 * does not draw one yet; the constant is exported here so it can.
 */

/** One face in the stack. Same shape `avatar.tsx` takes, plus the name used for the composed label. */
export type GroupParticipant = { name?: string; initials?: string; src?: string };

/** `{ x, y, diameter }` in the Snowglobe table's own 88-point box, centre-relative. */
export type StackSlot = { x: number; y: number; diameter: number };

/** The base box every Snowglobe configuration is expressed in (`CNUIAvatarLayoutItemConfiguration.baseSize`). */
export const snowglobeBaseSize = 88;

/** Most faces the table will draw. Participants past this many are not shown. */
export const snowglobeMaxFaces = 7;

/**
 * `SnowglobeAvatarLayoutConfigurations`, read back from
 * `+[CNUIAvatarLayoutManager layoutConfigurationsForType:2 withItemCount:n]` at a bounds of 88.
 * Index 0 is the front-most, largest face.
 */
export const snowglobeStack: readonly (readonly StackSlot[])[] = [
  [{ x: 0, y: 0, diameter: 88 }],
  [{ x: -10.5, y: -10.5, diameter: 48 }, { x: 17.5, y: 17.5, diameter: 28 }],
  [{ x: -12.5, y: -12.5, diameter: 42 }, { x: 21.5, y: 7.5, diameter: 32 }, { x: -6, y: 23.5, diameter: 26 }],
  [{ x: -12.5, y: -12.5, diameter: 42 }, { x: 21.5, y: 7.5, diameter: 32 }, { x: -6, y: 23.5, diameter: 26 }, { x: 20, y: -20.5, diameter: 20 }],
  [{ x: -12.5, y: -12.5, diameter: 42 }, { x: 21.5, y: 7.5, diameter: 32 }, { x: -6, y: 23.5, diameter: 26 }, { x: 20, y: -20.5, diameter: 20 }, { x: -27.5, y: 14, diameter: 14 }],
  [{ x: -12.5, y: -12.5, diameter: 42 }, { x: 21.5, y: 7.5, diameter: 32 }, { x: -6, y: 23.5, diameter: 26 }, { x: 20, y: -20.5, diameter: 20 }, { x: -27.5, y: 14, diameter: 14 }, { x: 7.5, y: -32.5, diameter: 10 }],
  [{ x: -12.5, y: -12.5, diameter: 42 }, { x: 19.5, y: 11.5, diameter: 30 }, { x: 21.5, y: -16.5, diameter: 22 }, { x: -21, y: 19.5, diameter: 20 }, { x: 2, y: 30, diameter: 15 }, { x: -3, y: 15, diameter: 11 }, { x: 9, y: -31.5, diameter: 10 }],
];

/** The table row for `count` faces: one through seven, then seven for anything larger. */
export function snowglobeSlots(count: number): readonly StackSlot[] {
  return snowglobeStack[Math.min(Math.max(count, 1), snowglobeMaxFaces) - 1];
}

/**
 * One slot's box inside a circle of `size`, in CSS px, mirrored for RTL exactly as
 * `-itemFrameInContainingBounds:isRTL:` does.
 */
export function snowglobeFrame(slot: StackSlot, size: number, rtl = false): { left: number; top: number; size: number } {
  const scale = size / snowglobeBaseSize;
  const face = slot.diameter * scale;
  const x = (rtl ? -slot.x : slot.x) * scale;
  return { left: size / 2 + x - face / 2, top: size / 2 + slot.y * scale - face / 2, size: face };
}

/** `-[CKUIBehaviorPhone groupAvatarViewSize]`, 60 x 60. */
export const groupAvatarSize = 60;

/**
 * Metrics for the avatar beside an incoming bubble in a group. `gutter` is what an incoming row
 * gives up on its leading side: the two are always spent together in ChatKit.
 */
export const senderAvatarMetrics = {
  /** `-[CKUIBehaviorPhone transcriptContactImageDiameter]`. */
  diameter: 32,
  /** `-[CKUIBehaviorPhone contactPhotoBalloonMargin]`, between the avatar and the balloon. */
  balloonMargin: 7,
  /** diameter + balloonMargin, the leading inset an incoming row takes in a group. */
  gutter: 39,
  /** `-[CKUIBehaviorPhone transcriptGroupTypingContactImageDiameter]`, for the typing indicator. */
  typingDiameter: 44,
} as const;

export type GroupAvatarProps = Omit<ComponentProps<"span">, "children"> & {
  /** Circle diameter. Defaults to the framework's 60. */
  size?: number;
  /** The people in the conversation, in the order the stack should draw them. */
  participants: readonly GroupParticipant[];
  /** Accessible name; falls back to the participants' names. */
  name?: string;
  /** Mirror the stack, the way `isRTL:YES` does. Defaults to the document direction. */
  rtl?: boolean;
};

/** "Alex Morgan, Jamie Chen and Sam Rivera", or "3 people" when nobody is named. */
function participantsLabel(participants: readonly GroupParticipant[]): string {
  const named = participants.map(person => person.name ?? person.initials).filter((value): value is string => Boolean(value));
  if (!named.length) return participants.length === 1 ? "1 person" : `${participants.length} people`;
  if (named.length === 1) return named[0];
  return `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
}

/**
 * A group conversation's photo: the participants' avatars stacked into one circle, largest in front.
 * Draws at most seven faces, as the framework table does.
 */
export function GroupAvatar({ size = groupAvatarSize, participants, name, rtl, className, style, ...props }: GroupAvatarProps) {
  const faces = participants.slice(0, snowglobeMaxFaces);
  const slots = snowglobeSlots(faces.length || 1);
  const label = name ?? participantsLabel(participants);
  return (
    <span
      data-slot="group-avatar"
      data-size={size}
      data-count={participants.length}
      role="img"
      aria-label={label}
      dir={rtl === undefined ? undefined : rtl ? "rtl" : "ltr"}
      className={cn("relative inline-block shrink-0 select-none align-middle", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      {/* An empty group still draws one circle, so the surface never collapses while a conversation loads. */}
      {(faces.length ? faces : [{}]).map((person, index) => {
        const frame = snowglobeFrame(slots[index], size, rtl);
        // setZPosition: -index. The largest face is drawn first and stays in front.
        const layer: CSSProperties = { position: "absolute", left: frame.left, top: frame.top, zIndex: faces.length - index };
        const avatar: AvatarProps = { size: frame.size, initials: person.initials, src: person.src, name: person.name };
        return <Avatar key={index} {...avatar} aria-hidden="true" role={undefined} style={layer} />;
      })}
    </span>
  );
}

export type SenderAvatarProps = Omit<ComponentProps<"span">, "children"> & {
  /** The sender's name, used as the accessible label. */
  name?: string;
  initials?: string;
  src?: string;
  /** Diameter. Defaults to the framework's 32; the group typing indicator uses 44. */
  size?: number;
};

/**
 * The Ø 32 photo beside an incoming bubble in a group. One per cluster, on the last bubble, bottom
 * aligned with the balloon: `message-list.tsx` places it.
 */
export function SenderAvatar({ name, initials, src, size = senderAvatarMetrics.diameter, className, style, ...props }: SenderAvatarProps) {
  return (
    <Avatar
      data-slot="sender-avatar"
      size={size}
      initials={initials}
      src={src}
      name={name}
      className={className}
      style={style}
      {...props}
    />
  );
}
