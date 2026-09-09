"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePlatform, type Platform } from "@/registry/imessage/platform";
import { bubbleMetrics, fontStack, type Direction } from "@/registry/imessage/tokens";
import { bodyClipPath, tailBox, tailPath, tailSeamOverlap } from "@/registry/imessage/bubble-shape";

/**
 * Photos and videos sent in a conversation. A photo takes the bubble's shape, tail included, so the
 * same traced outline in `bubble-shape.ts` clips the image instead of filling it.
 *
 * NOT MEASURED against a native photo message: the corner radius and tail come from the measured text
 * bubble. The multi-photo layout is the stack ChatKit actually draws, with the framework's own
 * constants — see `photoStackLayout` for which parts of composing them are a reading.
 *
 * ## What a photo message offers, and what is here (audit, 2026-09-09)
 *
 * | part                    | native evidence                                              | here |
 * |-------------------------|--------------------------------------------------------------|------|
 * | single photo's box      | `thumbnailFillSizeForWidth:imageSize:`, swept                 | yes, MEASURED, within 0.38 pt (ChatKit rounds to the device grid; see `photoBox`) |
 * | multi-photo box         | `-[CKUIBehavior previewBalloonSizeThatFits:]`, read at both idioms | yes, MEASURED: see `photoStackBox`. 375 x 353 on Mac, 350.625 x 332.625 on iPhone |
 * | balloon max width       | `balloonMaxWidthForTranscriptWidth:…`, `balloonMaxWidthPercent` 0.85 iPhone / 0.65 Mac | rule recorded in `balloonMaxWidth`; the group uses the measured constant and now cannot exceed its container |
 * | loading                 | `DOWNLOADING` = "Downloading…"                                 | partial: tiles hold on the placeholder and the group is `aria-busy`, but there is NO progress indicator and no "Downloading…" copy. `photoSheetProgressIndicatorSize` {20, 20} is the picker sheet, not the balloon, so the balloon's spinner is UNMEASURED |
 * | failed / not downloaded | `TAP_TO_DOWNLOAD`, `CLICK_TO_DOWNLOAD`, `downloadButtonFont` 17 | yes: copy and type size MEASURED; `pending` offers it without a failed fetch. A *send* failure is a different thing and belongs to the shell (`FailedSendBadge`, ChatKit's `_clearFailureBadge`), not to this component |
 * | video duration badge    | none on a transcript balloon                                   | NO — and correctly so. `CKMovieBalloonView` is `CKImageBalloonView` plus an `AVPlayerLayer` and has no duration label at all (`playsInlineVideo` = 1). The only `_durationLabel` in ChatKit is on `CKPhotoSearchResultCell`, the search-results cell. Adding one to a bubble would be inventing a control native does not draw |
 * | Live Photo badge        | `CKImageBalloonView._irisBadgeView`, `livePhotoBadgeImage`      | yes, added here: symbol identity and ring geometry MEASURED off the framework's own `UIImage` (see `livePhotoBadge`); its position in the tile is judgement |
 * | spatial badge           | `CKImageBalloonView._monoskiBadgeView`                          | NO. Not built; no size read yet |
 * | overflow count past 4   | `PXMessagesStackAdditionalItemsView`, `_localizedTitleForAdditionalItemsCount:` | yes: the last card slot stops being a photo and becomes the count card, a blur under SF Bold 17 in systemBlue reading "+7 Items". The copy and the type are MEASURED; the blur has nothing behind it to measure against |
 * | tap target → viewer     | —                                                              | yes: every tile is a `<button>` and `onOpenImage` hands the viewer the tile's own `DOMRect` |
 *
 ## The grid was the wrong layout, and it is gone
 *
 * There is no photo-*grid* balloon in ChatKit. Two or more attachments on one message are a **stack**:
 * `CKGenericPhotoStackBalloonView` over a `PXMessagesStackView`, which pages left and right
 * (`pageLeftAnimated:` / `pageRightAnimated:`) and counts the rest on a
 * `PXMessagesStackAdditionalItemsView`. The `CKPhotoGrid*` names in the framework belong to the
 * full-screen grid the stack opens into, not to the transcript. The accessibility format this file
 * quotes, `messages.attachment.stack.view.format`, is that stack view's.
 *
 * The note that used to sit here said the stack could not be built because its frames live in
 * PhotoFoundation's solver and no capture exists to fit them against. Half of that was wrong: the
 * constants are readable — see `photoStackLayout` — and they are what this draws now. The half that
 * still stands is that no capture of a multi-photo message exists, so *composing* those constants is
 * a reading and is marked as one.
 *
 * The stack's **outer box**, though, is no longer a guess — see `photoStackBox`. `PFMessagesStackLayoutFrameSolver`
 * only ever hands out *normalized* geometry (`normalizedVerticalInsets`, `normalizedVerticalOffset`,
 * `normalizedSizeTransform`, `normalizedHorizontalOffsets`), and `-[PXMessagesStackItemsLayoutHelper
 * maxItemSizeForReferenceSize:]` is handed the reference size from outside, so the absolute box has to
 * come from the chat item — and it does.
 *
 * The single photo's box, on the other hand, is now read out of ChatKit rather than guessed: see
 * `photoBox` below. So are the accessible names: ChatKit's own accessibility bundle
 * (`/System/iOSSupport/System/Library/AccessibilityBundles/ChatKitFramework.axbundle`,
 * `Accessibility.loctable`) calls one attachment `photo.attachment` = "Photo", counts them with
 * `attachment.count` = "%d attachments" and positions each one with
 * `messages.attachment.stack.view.format` = "attachment %1$d of %2$d".
 *
 * A photo sent together with text is NOT one balloon with a caption under the photo. ChatKit splits a
 * message into parts (`-[CKMessagePartChatItem messagePartRange]`, `CKTextMessagePartChatItem` vs
 * `CKAttachmentMessagePartChatItem`), and each part is its own balloon chat item, so native draws the
 * photo balloon and the text balloon as two bubbles of one cluster. "Caption" exists nowhere in the
 * image balloon; in ChatKit it belongs to Business Chat rich cards
 * (`-[CKBalloonView didTapTruncatedCaptionForRichCard:]`). The message list therefore renders the two,
 * passing `tail` to whichever comes last; this component stays a photo group.
 */
export type MessageImage = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  /**
   * The transfer has not been fetched. The tile offers `TAP_TO_DOWNLOAD` / `CLICK_TO_DOWNLOAD`
   * straight away instead of only after an <img> errors, which is what native does with an
   * attachment it is holding but has not downloaded.
   */
  pending?: boolean;
  /** A Live Photo. Draws ChatKit's `livePhotoBadgeImage` over the tile; see `livePhotoBadge`. */
  livePhoto?: boolean;
};

export type MessageImagesProps = Omit<ComponentProps<"div">, "children"> & {
  images: MessageImage[];
  direction?: Direction;
  tail?: boolean;
  /**
   * The balloon width the transcript grants this message — native's `balloonMaxWidth`, which is what
   * `-[CKChatItem size]` passes down. Defaults to the platform's measured maximum bubble width. A single
   * photo fills it (`photoBox`); a group derives its own box from it by ChatKit's rule (`photoStackBox`)
   * and, on iOS, comes out *wider* than this value, exactly as native does.
   */
  maxWidth?: number;
  /** Tallest the group may grow, in px. Defaults to the native cap (see `photoBox`). */
  maxHeight?: number;
  /** The transfer has not arrived yet: hold every tile on the placeholder. */
  loading?: boolean;
  /**
   * Open the full-screen viewer at `index`. The second argument is the tile's own box in viewport
   * coordinates, so the viewer can zoom out of the tile the way native does instead of fading in.
   */
  onOpenImage?: (index: number, rect: DOMRect) => void;
  /** @deprecated Use `onOpenImage`, which also hands over the tile's box. */
  onOpen?: (index: number) => void;
  /** Tapback balloons; positioned on the group's top corner away from the screen edge. */
  reactions?: ReactNode;
  platform?: Platform;
};

/** Native draws at most four cards and counts the rest; see `photoStackLayout.visible`. */
const MAX_TILES = 4;

/**
 * The card the tail continues. The front card is the only one whose bottom edge reaches the
 * balloon's - the ones behind it are smaller, pushed sideways and turned, and none touches the
 * corner the tail grows out of - and a single photo is its own front card, so it is 0 either way.
 * Module scope so it is a constant rather than a dependency of the measuring callback.
 */
const TAIL_TILE = 0;

/**
 * How big one photo's balloon is, read out of ChatKit instead of a screenshot.
 * `-[CKUIBehaviorPhone thumbnailFillSizeForWidth:imageSize:]`, swept over widths 100…900 against
 * extreme image sizes, fills the balloon width and then clamps the shape: anything wider than 16:9
 * comes back at `width x 0.5625` and anything taller than 3:4 at `width x 1.3333`, in both cases
 * cropped, since the answer is a *fill* size (its sibling `unconstrainedAspectFillSizeForWidth:`
 * returns the unclamped fit).
 *
 * `-[CKUIBehaviorMac thumbnailFillSizeForWidth:imageSize:]` overrides it and applies no shape clamp at
 * all: it returns the true aspect fit (w 382.5, a 4:1 photo → 382.5 x 96, where the phone stops at
 * 215.5). Re-swept 2026-09-09; the Mac override only answers for real once it is asked in its own
 * process, because `+sharedBehaviors` caches the first singleton it builds and a second call in the
 * same process hands back the phone's.
 *
 * `maxHeight` is a PORTRAIT-ONLY ceiling on both, which the sweep is unambiguous about: 3:4, 9:16 and
 * 1:4 all stop at 500 and shrink their width to hold the ratio (w 382.5, 9:16 → 281.5 x 500), while
 * 1:1 at w 900 comes back 900 x 900 and 16:9 at w 900 comes back 900 x 506.5. Nothing in this kit
 * ever hands a photo 900 pt, so the two rules agree everywhere it is used; `portraitOnly` records
 * which one is native rather than leaving the wrong one to bind if a caller ever passes a wide box.
 *
 * Native rounds each result to the device pixel grid (it answers 158.0 where 280.5 x 0.5625 is
 * 157.78); the fractions are kept here, which is why the lab's own probe reports our box within 0.38 pt
 * of ChatKit's rather than equal to it.
 *
 * This is the **single**-photo rule only. Two or more attachments are a different chat item with a
 * different, fixed box; see `photoStackBox`.
 */
export const photoBox: Record<Platform, { minRatio: number; maxRatio: number; maxHeight: number; portraitOnly: true }> = {
  ios: { minRatio: 0.5625, maxRatio: 4 / 3, maxHeight: 500, portraitOnly: true },
  macos: { minRatio: 0, maxRatio: Number.POSITIVE_INFINITY, maxHeight: 500, portraitOnly: true },
};

/**
 * How big a balloon holding **more than one** photo is. This is not `photoBox` and it is not the text
 * balloon's width, which is what this component used to hand it: two or more attachments on a message
 * are a `CKAggregateAttachmentMessagePartChatItem`, and its entire `-loadSizeThatFits:textAlignmentInsets:`
 * is one unconditional call —
 *
 *     -[CKUIBehavior sharedBehaviors] previewBalloonSizeThatFits:size
 *
 * — with no branch on the photos at all. `-[CKChatItem size]` calls that with `(self.maxWidth,
 * CGFLOAT_MAX)`, and `maxWidth` is `balloonMaxWidth` unchanged, because
 * `+[CKBalloonChatItem resultingMaxWidthWithBalloonMaxWidth:fullMaxWidth:transcriptTraitCollection:
 * transcriptBackgroundLuminance:]` is a bare `ret`. So the whole rule is `previewBalloonSizeThatFits:`,
 * whose body is:
 *
 *     w' = min(w, previewMaxWidth) * 1.25
 *     h' = w' - 2 * (stackBalloonVerticalInset - smallTranscriptSpace)
 *
 * MEASURED twice: read out of the disassembly and then confirmed by calling the selector at both idioms
 * over a dozen widths (100…900), which reproduces the formula exactly. The three inputs, read at their
 * own idiom in their own process:
 *
 * | idiom  | previewMaxWidth | stackBalloonVerticalInset | smallTranscriptSpace | at its `maxWidth` |
 * |--------|-----------------|---------------------------|----------------------|-------------------|
 * | iPhone | 761             | 15                        | 6                    | 280.5 → 350.625 x 332.625 |
 * | Mac    | **300**         | 15                        | 4                    | 382.5 → **375 x 353**     |
 *
 * `previewMaxWidth` is the whole story on the Mac: at 300 it saturates for any balloon max width at or
 * above 300, so a macOS photo group is **375 x 353 whatever the window does**, and 382.5 x 382.5 — the
 * text balloon's width squared by a 2x2 grid — was never a number ChatKit produces. It is also not
 * square: the height is 22 pt (Mac) / 18 pt (iPhone) short of the width.
 *
 * Nothing else bounds it, and several things that look like they might do not:
 *   - `calculatesWidthForAttachmentBalloons` is **0 on both idioms**, so it is not a Mac difference.
 *   - `attachmentBalloonSize` is `{187, 124.5}` on **both** idioms; it belongs to the fixed rich-icon
 *     file balloon (`attachmentBalloonRichIconInsets`), not to a photo.
 *   - `-[CKUIBehaviorMac thumbnailFillSizeForWidth:imageSize:]`, re-swept today at idiom 5 in its own
 *     process, still fills the width it is given with only the portrait 500 ceiling (see `photoBox`) —
 *     it never narrows anything, and it is the *single*-photo path, not this one.
 *   - `balloonMaxWidthPercent` 0.65 makes the Mac balloon proportionally narrower than the iPhone's, but
 *     it is the same balloon width a text bubble gets; there is no photo-specific percent.
 *   - `macTotalMarginWidth` = 40 is Mac-only and matches the measured `edgeInset` 20 per side, but
 *     `(630 - 40) x 0.65` = 383.5 against the capture's 382.5, so it still does not close that 1.0 pt.
 *   - There is no photo-grid or collage constant on either idiom.
 */
export const photoStackBox: Record<Platform, { previewMaxWidth: number; widthScale: number; heightInset: number }> = {
  ios: { previewMaxWidth: 761, widthScale: 1.25, heightInset: 2 * (15 - 6) },
  macos: { previewMaxWidth: 300, widthScale: 1.25, heightInset: 2 * (15 - 4) },
};

/**
 * **The stack, with its numbers.** The note above says the frames live in PhotoFoundation's solver
 * and cannot be reached; they can. `PXMessagesStackItemsLayoutHelper` is empty until something
 * configures it, but the thing that configures it is `PXMessagesStackItemsLayout`, and a
 * `PXMessagesStackView` built with `-[initWithFrame:]` and laid out carries one already set up.
 * Reading that layout's ivars at the phone idiom, out of `PhotosUICore.framework` beside ChatKit:
 *
 * | ivar | value |
 * | --- | --- |
 * | `_stackedItemsCount` | **4** |
 * | `_normalizedPageWidth` | **0.8** |
 * | `_normalizedStackSizeTransform` | **0.9** |
 * | `_normalizedStackHorizontalOffsets` | **[0.0666667, 0.0483333, 0.0333333, 0.03]** |
 * | `_normalizedStackVerticalOffset` | 0 |
 * | `_normalizedContentInsets` | 0 |
 * | `_rotationAngle` | **0.03490658 rad = 2.0°** |
 * | `_minItemAspectRatio` / `_maxItemAspectRatio` | **0.75 / 1.3333** |
 * | `_itemCornerRadius` | **20** |
 *
 * and `-[PXMessagesStackView horizontalContentMarginForSize:]` swept from 120 to 420 pt answers 15,
 * 19, 23, 26, 30, then 32 and 32 for everything wider — i.e. **min(32, round(width / 8))**.
 * `-[CKUIBehavior stackBalloonVerticalInset]` is **15** on both idioms.
 *
 * **What is measured and what is read into it.** Every number above is measured. How they compose is
 * not: `getGeometries:count:forVisibleRect:focus:archSide:keyframeOverride:` asserts on an internal
 * `totalItemCount` that only the layout fills in, so the solver could not be run directly and the
 * arithmetic below is a reading of the normalized values, not the solver's own output. Specifically
 * unverified: that the offsets are successive deltas rather than absolute positions (they decrease,
 * which only makes sense as a fan that compresses); that the fan leans toward the trailing edge
 * (`pageRightAnimated:` puts the next item to the right, so the ones behind peek out that way); and
 * that the rotation accumulates by index. The count card is `PXMessagesStackAdditionalItemsView`: a
 * `UIBlurEffect` behind a centred **SF Bold 17** label in **systemBlue**, whose
 * `_localizedTitleForAdditionalItemsCount:` answers "+1 Item" and "+2 Items".
 *
 * What this replaces was a 2x2 grid, and a grid is not a thing Messages draws — there is no
 * photo-grid balloon on either idiom, only `CKGenericPhotoStackBalloonView` over a
 * `PXMessagesStackView`.
 */
export const photoStackLayout = {
  /** Cards drawn at once, however many photos there are. */
  visible: 4,
  /** Each card behind is this fraction of the one in front. */
  sizeTransform: 0.9,
  /** Successive horizontal deltas, as fractions of the stack's width. */
  offsets: [0.0666667, 0.0483333, 0.0333333, 0.03],
  /** Degrees each card behind is turned, accumulating with depth. */
  rotation: 2,
  /** The card's corner, which is the balloon's own. */
  radius: 20,
  minAspect: 0.75,
  maxAspect: 4 / 3,
  verticalInset: 15,
  /** `min(32, round(width / 8))`, swept off `horizontalContentMarginForSize:`. */
  margin: (width: number) => Math.min(32, Math.round(width / 8)),
  /** The count card's label, `_localizedTitleForAdditionalItemsCount:`. */
  more: (count: number) => `+${count} Item${count === 1 ? "" : "s"}`,
} as const;

/** `-[CKUIBehavior previewBalloonSizeThatFits:]` for a balloon the transcript allows `balloonWidth`. */
export function photoStackSize(balloonWidth: number, platform: Platform): { width: number; height: number } {
  const box = photoStackBox[platform];
  const width = Math.min(balloonWidth, box.previewMaxWidth) * box.widthScale;
  return { width, height: width - box.heightInset };
}

/**
 * The width a transcript of `transcriptWidth` gives any balloon, photo balloons included:
 * `-[CKUIBehavior balloonMaxWidthForTranscriptWidth:marginInsets:shouldShowPluginButtons:
 * shouldShowCharacterCount:shouldCoverSendButton:]`, which is exactly
 * `(transcriptWidth - insets.left - insets.right) * balloonMaxWidthPercent`. Verified against the
 * framework at ten widths on each idiom: 630 with 16 pt margins answers 508.3 on iPhone and 388.7 on
 * Mac, which is (630 - 32) x 0.85 and (630 - 32) x 0.65 to the last digit.
 *
 * **`balloonMaxWidthPercent` is 0.65 on Mac against 0.85 on iPhone**, so the Mac balloon is
 * proportionally the *narrower* of the two — the opposite of what this component used to imply by
 * handing macOS a 382.5 pt box and iOS a 280.5 pt one with nothing tying either to its pane.
 *
 * Solving the formula for the two constants this kit already measured off captures:
 *
 * - iPhone, transcript 402: an inset of **36.0** gives (402 - 72) x 0.85 = **280.5000**, which is
 *   `bubbleMetrics.ios.maxWidth` exactly. The framework and the capture agree to the last digit.
 * - Mac, transcript 630: the inset that lands on 382.5 is 20.77, which is not a round number. The
 *   obvious 20 (`bubbleMetrics.macos.edgeInset`) gives 383.5 — a whole point wider than the capture.
 *
 * That 1.0 pt is unresolved and is the reason the measured constant, not this formula, is still the
 * default: swapping it in would move every macOS bubble by a point on the strength of a guessed
 * inset. `shouldCoverSendButton` is the only flag that changes the answer, and it is the composer's
 * concern, not the transcript's. A shell that resizes its transcript should pass `maxWidth` from
 * here — the proportion is right even where the constant's offset is not.
 */
export const balloonMaxWidthPercent: Record<Platform, number> = { ios: 0.85, macos: 0.65 };

export function balloonMaxWidth(transcriptWidth: number, platform: Platform, marginInsets = 16): number {
  return (transcriptWidth - marginInsets * 2) * balloonMaxWidthPercent[platform];
}

/**
 * Where a tapback balloon sits against the group's top corner. Measured on text bubbles and carried
 * over: a photo group takes a tapback like any other balloon, and native anchors it to the balloon's
 * frame, which is what this box is. Numbers from `tapback.tsx`'s `balloonSlot` (the corrected pair),
 * not from `message-bubble.tsx`'s older copy. A photo has no measured slot of its own; ChatKit does
 * carry `-[CKUIBehavior messageAcknowledgmentPhotoGridXOffsetScalar]` = 0 / `…YOffsetScalar` = 0.2 on
 * iPhone and 0.35 / 0.35 on Mac, but those are fractions of a frame this component does not build (a
 * photo *grid* view), so they are recorded rather than used.
 */
const reactionSlot: Record<Platform, { marginTop: number; top: number; side: number }> = {
  ios: { marginTop: 28, top: -27.39, side: -13.85 },
  macos: { marginTop: 27.4, top: -22.05, side: -11.79 },
};

/**
 * What native offers on an attachment it has not fetched: ChatKit's `TAP_TO_DOWNLOAD` = "Tap to
 * Download" and `CLICK_TO_DOWNLOAD` = "Click to Download", both read back out of the framework
 * bundle. The tile keeps the same copy when the fetch fails, and activating it asks for the photo
 * again.
 *
 * The type size is MEASURED: `-[CKUIBehavior downloadButtonFont]` is `.SFNS-Regular` at **17 pt on
 * both idioms** — the Mac does not shrink it. This used to render 15 on iOS and 13 on macOS, which
 * was a guess and was wrong on both.
 */
const downloadLabel: Record<Platform, string> = { ios: "Tap to Download", macos: "Click to Download" };

/** `-[CKUIBehavior downloadButtonFont]`, both idioms. */
const downloadFontSize = 17;

/**
 * The Live Photo badge, which native draws over the photo itself: `CKImageBalloonView` keeps an
 * `_irisBadgeView` ("iris" is ChatKit's word for a Live Photo — see `isIrisAsset`) alongside a
 * `_monoskiBadgeView` for spatial media, and the image both are built from is
 * `-[CKUIBehavior livePhotoBadgeImage]`, the system symbol `livephoto` in white.
 *
 * MEASURED, by rasterising that `UIImage` at 8x and reading its ink, the way `audio-recorder.tsx`
 * measures the framework's own symbols:
 *
 * | idiom  | image box     | ink box       | centre disc | solid ring   | dashed ring   |
 * |--------|---------------|---------------|-------------|--------------|---------------|
 * | iPhone | 21.5 x 20.5   | 18.5 x 18.5   | r 3.375     | r 6.0-6.875  | r 8.5-9.25    |
 * | Mac    | 28 x 28 (lg)  | 24 x 24       | r 4.375     | r 7.875-8.75 | r 11.0-12.0   |
 *
 * The dashed ring's duty cycle is the measured inked fraction of its circumference (0.33 on iPhone,
 * 0.21 on Mac); the phase of the dashes, and where the badge sits inside the tile, are NOT MEASURED —
 * no capture of a Live Photo message exists. The inset below is judgement.
 */
const livePhotoBadge: Record<Platform, { box: number; ink: number; disc: number; ring: [number, number]; dashed: [number, number]; duty: number; inset: number }> = {
  ios: { box: 21.5, ink: 18.5, disc: 3.375, ring: [6, 6.875], dashed: [8.5, 9.25], duty: 0.33, inset: 8 },
  macos: { box: 28, ink: 24, disc: 4.375, ring: [7.875, 8.75], dashed: [11, 12], duty: 0.21, inset: 8 },
};

/**
 * `livephoto` drawn to the radii above: a filled centre disc, one solid ring and one dashed ring, in
 * a viewBox the size of the symbol's own ink so the caller only has to place the box.
 */
function LivePhotoGlyph({ platform }: { platform: Platform }) {
  const badge = livePhotoBadge[platform];
  const c = badge.ink / 2;
  const ringWidth = badge.ring[1] - badge.ring[0];
  const dashedWidth = badge.dashed[1] - badge.dashed[0];
  const dashedRadius = (badge.dashed[0] + badge.dashed[1]) / 2;
  // 12 dashes around the ring, each covering `duty` of its share of the circumference.
  const period = (2 * Math.PI * dashedRadius) / 12;
  return (
    <svg width={badge.ink} height={badge.ink} viewBox={`0 0 ${badge.ink} ${badge.ink}`} fill="none" aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.35))" }}>
      <circle cx={c} cy={c} r={badge.disc} fill="#fff" />
      <circle cx={c} cy={c} r={(badge.ring[0] + badge.ring[1]) / 2} stroke="#fff" strokeWidth={ringWidth} fill="none" />
      <circle cx={c} cy={c} r={dashedRadius} stroke="#fff" strokeWidth={dashedWidth} fill="none"
        strokeLinecap="round" strokeDasharray={`${(period * badge.duty).toFixed(3)} ${(period * (1 - badge.duty)).toFixed(3)}`} />
    </svg>
  );
}

/**
 * Aspect ratios already learned this session, so a photo that has been seen once never opens at the
 * 4:3 placeholder again. A remount (the viewer closing, a list re-render) would otherwise lay the
 * bubble out at the wrong height and snap when the image decodes. Empty during hydration, because
 * nothing can have loaded by then, so the first client render still matches the server's.
 */
const aspectMemo = new Map<string, number>();

type Phase = "ready" | "failed";

/**
 * Average colour of the corner of `image` that the tail meets, so the tail reads as a continuation of
 * the photo rather than a gray stub. The tile is `object-cover`, so the visible corner is not the
 * source's own corner: map the tail's footprint back through the cover crop before reading it.
 * Returns null when the image has not loaded, is not laid out, or taints the canvas (a cross-origin
 * photo), and the caller keeps its fallback fill.
 */
function sampleCorner(image: HTMLImageElement, side: "left" | "right", boxWidth: number, boxHeight: number): string | null {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  if (!image.complete || !naturalWidth || !naturalHeight) return null;
  const rect = image.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const cover = Math.max(rect.width / naturalWidth, rect.height / naturalHeight);
  const visibleWidth = Math.min(naturalWidth, rect.width / cover);
  const visibleHeight = Math.min(naturalHeight, rect.height / cover);
  const patchWidth = Math.max(1, Math.min(visibleWidth, boxWidth / cover));
  const patchHeight = Math.max(1, Math.min(visibleHeight, boxHeight / cover));
  const left = (naturalWidth - visibleWidth) / 2;
  const sx = side === "right" ? left + visibleWidth - patchWidth : left;
  const sy = (naturalHeight - visibleHeight) / 2 + visibleHeight - patchHeight;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, sx, sy, patchWidth, patchHeight, 0, 0, 8, 8);
    const data = context.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
    const pixels = data.length / 4;
    return `rgb(${Math.round(r / pixels)}, ${Math.round(g / pixels)}, ${Math.round(b / pixels)})`;
  } catch {
    return null; // a cross-origin photo taints the canvas
  }
}

export function MessageImages({
  images, direction = "outgoing", tail = false, maxWidth, maxHeight, loading = false,
  onOpenImage, onOpen, reactions, platform: platformProp, className, style, ...props
}: MessageImagesProps) {
  const contextPlatform = usePlatform();
  const platform = platformProp ?? contextPlatform;
  const m = bubbleMetrics[platform];
  const side = direction === "outgoing" ? "right" : "left";
  const width = maxWidth ?? m.maxWidth;
  // Four card slots. Past four photos the last slot stops being a photo and becomes the stack's own
  // count card (`PXMessagesStackAdditionalItemsView`), so three photos show and the rest are counted
  // — the count is not a scrim laid over a fourth photo, which is what this drew before.
  const counted = images.length > MAX_TILES;
  const tiles = useMemo(() => images.slice(0, counted ? MAX_TILES - 1 : MAX_TILES), [images, counted]);
  const overflow = images.length - tiles.length;
  const single = tiles.length === 1;
  const groupKey = tiles.map(image => image.src).join("|");

  // More than one photo is one balloon of a fixed shape, not a square of the text bubble's width: see
  // `photoStackBox`. 375 x 353 on macOS at any window size, 350.625 x 332.625 on iOS. The tiles inside
  // it are whatever the grid makes of that box, and stop being square with it — the box is the measured
  // part, the tiling is not (native draws a stack here, see the note at the top of the file).
  const stack = single ? null : photoStackSize(width, platform);

  // One photo keeps its aspect ratio: the caller's dimensions when it gave any, otherwise the image's
  // own once it has loaded. 4:3 is only the placeholder until then, and only for a photo whose size
  // this session has never seen; declaring `width`/`height` is what keeps the bubble from resizing at
  // all on a cold load.
  const [measured, setMeasured] = useState<{ src: string; aspect: number } | null>(null);
  const first: MessageImage | undefined = tiles[0];
  const firstSrc = first?.src ?? "";
  const declaredAspect = single && first?.width && first.height ? first.width / first.height : null;
  const learnedAspect = single ? (measured?.src === firstSrc ? measured.aspect : aspectMemo.get(firstSrc)) : undefined;
  const aspect = declaredAspect ?? learnedAspect ?? 4 / 3;

  // The clamp is the native one, and it is the SINGLE photo's: a very tall photo stops at 4:3 of its
  // width and a very wide one at 16:9, both cropped by `object-cover`; a portrait photo never grows
  // past `maxHeight`, and when the clamped shape would, the width comes in with it rather than the
  // photo stretching. The ceiling is portrait-only because that is what the sweep says (see
  // `photoBox`): a landscape or square photo at a width past 500 keeps its true fit. A group ignores
  // all of it — its box is `photoStackBox`, which never looks at the photos.
  const box = photoBox[platform];
  const ceiling = maxHeight ?? box.maxHeight;
  const ratio = Math.min(Math.max(1 / aspect, box.minRatio), box.maxRatio);
  const capped = box.portraitOnly ? ratio > 1 : true;
  const groupWidth = stack ? stack.width : capped ? Math.min(width, ceiling / ratio) : width;
  const height = stack ? stack.height : groupWidth * ratio;

  /**
   * Where each card sits, in the stack's own box. Index 0 is the front one, the only one whose whole
   * face shows; the rest peek out behind it toward the trailing edge, each `sizeTransform` of the one
   * in front and turned a further `rotation`. See `photoStackLayout` for which parts of this are the
   * framework's and which are a reading of it.
   */
  const cards = useMemo(() => {
    const L = photoStackLayout;
    if (single) return null;
    const boxWidth = stack?.width ?? width;
    const boxHeight = stack?.height ?? width;
    const margin = L.margin(boxWidth);
    const front = { width: boxWidth - 2 * margin, height: boxHeight - 2 * L.verticalInset };
    // The card's shape is clamped the way the layout clamps an item's aspect, so a very wide or very
    // tall box never hands the stack a card no photo would be cropped into.
    const aspectRatio = Math.min(Math.max(front.width / front.height, L.minAspect), L.maxAspect);
    const cardHeight = Math.min(front.height, front.width / aspectRatio);
    const cardWidth = Math.min(front.width, cardHeight * aspectRatio);
    // The fan leans away from the tail. Nothing measured says which way it goes — `pageRightAnimated:`
    // only says the next photo is to the right — but the tail grows out of the front card's bottom
    // corner on `side`, and a fan that went the same way would bury it under the cards behind.
    const lean = side === "right" ? -1 : 1;
    let shift = 0;
    return Array.from({ length: MAX_TILES }, (_, index) => {
      if (index > 0) shift += (L.offsets[index - 1] ?? L.offsets[L.offsets.length - 1]) * boxWidth;
      return {
        width: cardWidth,
        height: cardHeight,
        // Centred in the box, then pushed out along the lean and turned into the arch.
        left: (boxWidth - cardWidth) / 2 + lean * shift,
        top: (boxHeight - cardHeight) / 2,
        scale: L.sizeTransform ** index,
        rotate: lean * index * L.rotation,
      };
    });
  }, [single, stack, width, side]);

  const hang = tailBox.hang * m.tailScale;
  // The tail continues the photo, so it is filled from the tile that touches it: the bottom tile on
  // the tail's side. Three photos put a full-height tile first, so on an incoming message that first

  const [tailFill, setTailFill] = useState<{ key: string; color: string } | null>(null);
  // A tile is on the placeholder until its own <img> says otherwise, so the bubble is never a hole.
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [attempt, setAttempt] = useState<Record<string, number>>({});
  const gridRef = useRef<HTMLDivElement>(null);

  // Runs on mount as well as on load: a server-rendered <img> is normally already complete by the
  // time React attaches its handlers, and then `onLoad` never fires at all, the tail stays gray and
  // every tile looks unloaded. It is a layout effect so a photo the browser already has is laid out
  // at its real shape in the same frame, instead of painting 4:3 once and resizing.
  const measure = useCallback(() => {
    const element = gridRef.current;
    if (!element) return;
    const rendered = element.querySelectorAll("img");
    // By tile index, not by position in the list: a tile that failed renders no <img> at all, and
    // counting elements would then sample the wrong photo for the tail.
    const edge = element.querySelector<HTMLImageElement>(`img[data-tile="${TAIL_TILE}"]`);
    // Only ever replace a real colour with a real colour: a half-decoded image reads as null, and
    // dropping back to gray for a frame would flash the tail.
    const sampled = tail && edge ? sampleCorner(edge, side, tailBox.width * m.tailScale, tailBox.height * m.tailScale) : null;
    if (sampled) setTailFill(previous => (previous?.key === groupKey && previous.color === sampled ? previous : { key: groupKey, color: sampled }));
    setPhase(previous => {
      let next = previous;
      rendered.forEach(image => {
        if (!image.complete) return;
        const src = image.getAttribute("data-src") ?? image.src;
        const value: Phase = image.naturalWidth > 0 ? "ready" : "failed";
        if (previous[src] === value) return;
        if (next === previous) next = { ...previous };
        next[src] = value;
      });
      return next;
    });
    const photo = element.querySelector<HTMLImageElement>('img[data-tile="0"]');
    if (single && photo?.naturalWidth && photo.naturalHeight) {
      const value = photo.naturalWidth / photo.naturalHeight;
      aspectMemo.set(firstSrc, value);
      setMeasured(previous => (previous?.src === firstSrc && previous.aspect === value ? previous : { src: firstSrc, aspect: value }));
    }
  }, [single, tail, side, m.tailScale, groupKey, firstSrc, setMeasured, setPhase, setTailFill]);
  useLayoutEffect(() => { measure(); }, [measure]);

  const retry = useCallback((src: string) => {
    setPhase(previous => { const next = { ...previous }; delete next[src]; return next; });
    setAttempt(previous => ({ ...previous, [src]: (previous[src] ?? 0) + 1 }));
  }, []);

  const countCard = counted ? cards?.[MAX_TILES - 1] : null;
  const open = onOpenImage ?? (onOpen ? (index: number) => onOpen(index) : undefined);
  const busy = loading || tiles.some(image => phase[image.src] === undefined);
  const slot = reactionSlot[platform];
  // No photos is not an empty balloon: without this the group would paint a bare gray square the size
  // of a four-tile grid.
  if (!tiles.length) return null;

  return (
    <div data-slot="message-images" data-direction={direction} data-count={images.length}
      // ChatKit's `attachment.count` reads "%d attachments"; the group is named with the photo noun
      // its own `PHOTO_ATTACHMENT_STATUS_PHOTOS_TITLE_FORMAT` ("%tu Photos") uses. One photo needs no
      // group at all: the tile's own name already says everything.
      role={images.length > 1 ? "group" : undefined}
      aria-label={images.length > 1 ? `${images.length} Photos` : undefined}
      aria-busy={busy || undefined}
      className={cn("relative", className)}
      // `maxWidth: 100%` is the ceiling this group used to be missing entirely. `groupWidth` derives
      // from a constant — `bubbleMetrics[platform].maxWidth` — with nothing tying it to the transcript
      // it is drawn in, so a pane narrower than that (a resized window, an open inspector, a two-pane
      // layout) had the group hang out of its row: at a 140 pt container the macOS group measured
      // 382.5 wide and spilled 242.5 px, which is the defect this line closes. It matters more now
      // that a group is 375 pt on Mac and 350.6 on iOS by `photoStackBox` rather than the balloon's
      // own width. Native's own rule is `balloonMaxWidth` above, and a shell that resizes its
      // transcript should pass that as `maxWidth`; this is the floor under it either way.
      style={{ width: groupWidth, maxWidth: "100%", boxSizing: "border-box", fontFamily: fontStack, marginTop: reactions ? slot.marginTop : undefined, ...style }} {...props}>
      {/* `aspectRatio` rather than a pixel height, so the box keeps its shape when the clamp above
          bites: at full width it resolves to exactly `height`, and under the clamp the grid shortens
          with its width instead of holding a tall box over narrow tiles. */}
      {/* A stack, not a grid: the cards are placed in this box rather than flowed through it, and the
          box itself paints nothing — the front card is what the balloon looks like, so the corner and
          the tail belong to it and not to a container clipping four tiles. A single photo keeps the
          old shape, where the box *is* the balloon. */}
      <div ref={gridRef} data-slot={single ? "image-grid" : "photo-stack"} style={single
        ? { display: "block", width: "100%", aspectRatio: `${groupWidth} / ${height}`, borderRadius: m.radius, overflow: "hidden", clipPath: tail ? bodyClipPath(side, m.tailScale, tailSeamOverlap[platform]) : undefined, background: "var(--im-gray-top)" }
        // `isolation: isolate` is load-bearing, not tidiness: the cards carry a `zIndex` so the front
        // one paints last, and without a stacking context here those numbers escape to the nearest
        // ancestor that has one - which put the whole stack on top of the open photo viewer, a card
        // floating over the full-screen photo it had just been tapped to open.
        : { position: "relative", isolation: "isolate", width: "100%", aspectRatio: `${groupWidth} / ${height}` }}>
        {tiles.map((image, index) => {
          const state = phase[image.src];
          // Two ways into the same affordance: the transfer was never fetched (`pending`), or it was
          // and it did not arrive. Native offers the download either way, so the tile does too.
          const failed = image.pending === true || state === "failed";
          const name = image.alt?.trim() || "Photo";
          // "Photo, 2 of 5" follows ChatKit's own `messages.attachment.stack.view.format`
          // ("attachment %1$d of %2$d"); the counted tile has to say what its "+N" opens.
          const position = images.length > 1 ? `${name}, ${index + 1} of ${images.length}` : name;
          // "Live Photo" is the noun VoiceOver reads for an iris asset, and it is the only thing the
          // badge says, so the name has to carry it or the badge is invisible without sight.
          const named = image.livePhoto ? `Live Photo. ${position}` : position;
          const label = failed ? `${named}. ${downloadLabel[platform]}.` : named;
          // A tile that cannot be fetched offers the fetch again, the way native's undownloaded
          // attachment does. Otherwise it opens the viewer, handing over its own box so the viewer can
          // grow out of this tile.
          const activate: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined = failed
            ? () => retry(image.src)
            : open
              ? event => open(index, event.currentTarget.getBoundingClientRect())
              : undefined;
          // A button is a control for the pointer and the keyboard both, for free. With nothing to
          // open it would be a dead tab stop that reads out "dimmed", so the tile becomes a named
          // image instead: the photo keeps its accessible name either way.
          const card = cards?.[index];
          const shell = {
            "data-slot": "photo-tile", "data-index": index,
            "data-state": failed ? "failed" : state === "ready" ? "ready" : "loading",
            "aria-label": label,
            className: cn("block overflow-hidden p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff]",
              card ? "absolute" : "relative h-full w-full"),
            style: card
              ? {
                  // Painted back to front, so the front card is on top and takes the pointer.
                  zIndex: MAX_TILES - index,
                  left: card.left, top: card.top, width: card.width, height: card.height,
                  transform: `rotate(${card.rotate}deg) scale(${card.scale})`,
                  transformOrigin: "50% 50%",
                  borderRadius: photoStackLayout.radius,
                  // Only the front card carries the balloon's tail; the ones behind are plain cards.
                  clipPath: index === 0 && tail ? bodyClipPath(side, m.tailScale, tailSeamOverlap[platform]) : undefined,
                  background: "var(--im-gray-top)",
                  boxShadow: index === 0 ? undefined : "0 0 0 0.5px rgba(0,0,0,0.06)",
                }
              : undefined,
          } as const;
          const inner = (
            <>
              {failed ? (
                // The placeholder the grid already paints, plus native's own copy for a photo it does
                // not have. `downloadFontSize` is `-[CKUIBehavior downloadButtonFont]`, 17 on both;
                // the weight and the line height are not measured.
                <span data-slot="photo-failed" aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center px-[8px] text-center"
                  style={{ fontSize: downloadFontSize, lineHeight: 1.2, color: "var(--im-incoming-text)" }}>
                  {downloadLabel[platform]}
                </span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={attempt[image.src] ?? 0} src={image.src} data-src={image.src} data-tile={index} alt="" loading="lazy" decoding="async"
                  onLoad={measure} onError={measure}
                  className="h-full w-full object-cover" style={{ opacity: loading ? 0 : 1 }} />
              )}
              {/* Native puts the badge on the photo, not on the balloon, so a Live Photo in a group
                  gets one per tile. Hidden while the tile is still on the placeholder: a badge over a
                  gray square announces a photo that is not there yet. */}
              {image.livePhoto && !failed && !loading && state === "ready" && (
                <span data-slot="live-photo-badge" aria-hidden="true" className="pointer-events-none absolute"
                  style={{ top: livePhotoBadge[platform].inset, left: livePhotoBadge[platform].inset }}>
                  <LivePhotoGlyph platform={platform} />
                </span>
              )}

            </>
          );
          return activate
            ? <button key={image.src + index} type="button" onClick={activate} {...shell}>{inner}</button>
            : <div key={image.src + index} role="img" {...shell}>{inner}</div>;
        })}
        {/* The last card, when there are more photos than card slots.
            `PXMessagesStackAdditionalItemsView` is a `UIBlurEffect` under a centred SF Bold 17 label
            in systemBlue, and `_localizedTitleForAdditionalItemsCount:` is where "+2 Items" comes
            from. The blur has nothing measured behind it here - a card at the back of a stack has
            only its neighbours to blur - so it is drawn as the material's own light/dark fill. */}
        {counted && countCard && (
          <button type="button" data-slot="photo-stack-more" aria-label={`Show ${overflow} more photo${overflow === 1 ? "" : "s"}.`}
            onClick={open ? event => open(tiles.length, event.currentTarget.getBoundingClientRect()) : undefined}
            className="absolute flex items-center justify-center overflow-hidden p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0088ff]"
            style={{
              zIndex: MAX_TILES - (MAX_TILES - 1),
              left: countCard.left, top: countCard.top, width: countCard.width, height: countCard.height,
              transform: `rotate(${countCard.rotate}deg) scale(${countCard.scale})`, transformOrigin: "50% 50%",
              borderRadius: photoStackLayout.radius,
              background: "var(--im-stack-more, rgba(242,242,247,0.82))",
              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 0 0 0.5px rgba(0,0,0,0.06)",
              color: "var(--im-stack-more-label, #0088ff)", fontSize: 17, fontWeight: 700, letterSpacing: 0,
            }}>
            {photoStackLayout.more(overflow)}
          </button>
        )}
      </div>
      {/* On the front card's bottom corner, not the box's: a stack's box is wider and taller than the
          card it holds (the margin rule leaves room for the cards behind to peek into), so a tail
          pinned to the box would float away from the photo it is supposed to continue. */}
      {tail && (
        <div aria-hidden="true" data-slot="tail" className="pointer-events-none absolute"
          style={{
            [side]: cards ? (stack ? stack.width : width) - (cards[0].left + cards[0].width) : 0,
            bottom: cards ? (stack ? stack.height : height) - (cards[0].top + cards[0].height) - hang : -hang,
            width: tailBox.width * m.tailScale, height: tailBox.height * m.tailScale + hang,
            clipPath: `path("${tailPath(side, m.tailScale)}")`,
            background: tailFill?.key === groupKey ? tailFill.color : "var(--im-gray-bottom)",
          }}>
          {/* On a stack the tail is a corner of the front card, so it can carry the photograph itself
              rather than one colour averaged out of that corner. The same photo is laid out at the
              card's size and pushed back by the card's own offset, so the pixels line up across the
              seam; the flat fill stays behind it for the 6.8 pt that hangs below the card, where
              there is no photo to continue. A single photo keeps the flat fill on its own - its
              balloon is the box, and its geometry is the measured one every baseline was taken
              against. */}
          {cards && firstSrc && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={firstSrc} alt="" aria-hidden="true" className="absolute max-w-none object-cover"
              style={{
                width: cards[0].width, height: cards[0].height,
                // The tail's own edge on `side` is the card's edge, so the photo lines up there with
                // no offset; vertically the tail starts one tail-height above the card's bottom.
                [side]: 0,
                top: -(cards[0].height - tailBox.height * m.tailScale),
              }} />
          )}
        </div>
      )}
      {/* Outside the grid on purpose: the grid clips to the balloon's outline, and a balloon that laps
          the photo's rounded corner would lose its own edge to that clip. */}
      {reactions && (
        <div data-slot="reactions" className="absolute z-10" style={{ top: slot.top, [direction === "outgoing" ? "left" : "right"]: slot.side }}>{reactions}</div>
      )}
    </div>
  );
}

/** Override the sampled tail colour, e.g. when the image is cross-origin and cannot be read back. */
export function photoTailFill(color: string): CSSProperties {
  return { ["--im-gray-bottom" as string]: color } as CSSProperties;
}
