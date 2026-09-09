"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePlatform, type Platform } from "@/registry/imessage/platform";
import { bubbleMetrics, fontStack } from "@/registry/imessage/tokens";
import { unknownSenderMetrics } from "@/registry/imessage/ios-notices";
import type { TapbackType } from "@/registry/imessage/tapback";

/**
 * The centred grey lines a transcript carries that are not bubbles: group renames, joins and
 * leaves, the group photo, a missed call, a reaction summary, and the unknown-sender notice.
 *
 * ## What is measured, and what is not
 *
 * **The type, colour, centring and the space above are measured**, from the unknown-sender notice in
 * `references/ios/captures/incoming-light.png` (402x874 @3x). Re-read for this component, scanning
 * every row for non-white ink across the full width:
 *
 * - line 1 ("If you did not expect this message from an unknown sender, it may") has ink on device
 *   rows 2163-2195, i.e. pt y 721.0-731.67, with the x-height band running 723.67-729.33 and the
 *   baseline at 729.5. Line 2 ("be spam.") runs 2204-2234 = pt 734.67-745.0.
 * - line pitch is therefore 734.67 - 721.33 = **13.3333**, and x-height is 729.5 - 723.67 = **5.83**,
 *   which at SF Pro Text's 0.53 em x-height is 11.0 pt exactly (12 pt would read 6.36). The ascender
 *   run 729.5 - 721.0 = 8.5 agrees at SF's 0.75 em. So the family is **11 pt, not the 12 pt SPEC.md's
 *   prose line says**; `unknownSenderMetrics` in `ios-notices.tsx` measured the same 11.
 * - line 1 spans x 22.33-379.0 and line 2 x 176.67-224.0, so both centre on x 200.5 in a 402 wide
 *   screen: the paragraph is **centred**, and it wraps inside the 370 column that the measured 16 pt
 *   edge inset leaves (402 - 2x16 = 370).
 * - the last bubble body above it ends at pt y 702.67 and the line box starts at 718.67, so the
 *   **space above is 16**.
 * - colour #8a8a8e light / #8d8d93 dark (SPEC.md "Secondary label (Delivered, date, spam notice)"),
 *   which is the palette's `--im-secondary`.
 *
 * **The space below is not measured.** Nothing sits under the notice in that capture except its
 * "Report Spam" pill, 10.33 below. This file mirrors the measured 16 above as 16 below; treat it as
 * judgement.
 *
 * **The bold run is not measured.** No capture holds a system message with a name in it. Weight 600
 * is reused, not guessed: it is the measured weight of the other ink in this same 11 pt secondary
 * slot, the "Delivered" status label (SPEC.md, iOS bubble geometry) and the "Report Spam" label.
 *
 * **macOS is sized from the macOS secondary label, not measured for this surface.** It takes
 * `bubbleMetrics.macos.statusFontSize` / `statusLineHeight` / `statusLetterSpacing`, the measured
 * 9 pt on an 11 pt line box that "Delivered" and the macOS date header both use, and the measured
 * secondary colour #808080 / #9a9a9a. Its 11.5 gaps are the measured between-cluster gap, reused the
 * way `dateSeparatorMetrics.macos.midGapAbove` reuses it, because a system line is its own cluster.
 * Note that on iOS the notice's 16 is 1.57x that platform's 10.2 cluster gap, so if macOS follows the
 * same ratio the true number is nearer 18. Nothing in `references/` settles it.
 *
 * ## Which strings this supports
 *
 * Only `unknownSender` is a captured string. Every other sentence below follows Apple's documented
 * behaviour for group conversations and tapback summaries, and is **wording, not a measurement**:
 *
 * | event | renders (bold shown in brackets) |
 * |---|---|
 * | `unknownSender` | If you did not expect this message from an unknown sender, it may be spam. |
 * | `conversationNamed` | You named the conversation "Design Crew". / [Alex Morgan] named the conversation "Design Crew". |
 * | `participantAdded` | You added [Sam Rivera] to the conversation. |
 * | `participantRemoved` | You removed [Sam Rivera] from the conversation. |
 * | `participantLeft` | [Alex Morgan] left the conversation. / You left the conversation. |
 * | `groupPhotoChanged` | You changed the group photo. |
 * | `missedCall` | Missed Call / Missed Video Call / Missed FaceTime |
 * | `reaction` | You loved "Tuesday morning at 9?" / [Alex Morgan] laughed at "…" |
 *
 * A participant's name renders bold; "You" never does, which is the rule Messages follows for the
 * first person. `actor` left out means you. The conversation name and a quoted message stay in the
 * regular weight inside curly quotes, matching how SPEC.md records the macOS sidebar preview
 * ("You loved “…”"). "Missed FaceTime" is the same wording `facetime-card.tsx` already uses.
 *
 * The unknown-sender sentence lives here as plain text so the family is complete. The version with
 * the measured "Report Spam" pill under it is `UnknownSenderNotice` in `ios-notices.tsx`; use that
 * one when the button belongs on screen.
 *
 * Nothing here animates, so there is no reduced-motion or seek behaviour to respect.
 */

export type SystemMessageMetrics = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  weight: number;
  /** Weight for a participant's name inside the sentence. */
  emphasisWeight: number;
  /** Space from the row above to the line box, and from the line box to the row below. */
  gapAbove: number;
  gapBelow: number;
  /** Inset from the pane edge, which is what wraps the sentence. */
  inset: number;
};

export const systemMessageMetrics: Record<Platform, SystemMessageMetrics> = {
  ios: {
    // Measured: the unknown-sender notice, via `unknownSenderMetrics`.
    fontSize: unknownSenderMetrics.fontSize,
    lineHeight: unknownSenderMetrics.lineHeight,
    letterSpacing: unknownSenderMetrics.letterSpacing,
    weight: 400,
    // Reused: the measured semibold of the 11pt "Delivered" label and the "Report Spam" pill.
    emphasisWeight: 600,
    gapAbove: unknownSenderMetrics.topGap,
    // Judgement: mirrors the measured 16 above. Nothing sits below the notice in the capture.
    gapBelow: unknownSenderMetrics.topGap,
    // Measured: 402 - 2x16 is the 370 column the notice wraps inside.
    inset: bubbleMetrics.ios.edgeInset,
  },
  macos: {
    // Reused: the measured macOS secondary label, 9pt on an 11pt line box with no tracking.
    fontSize: bubbleMetrics.macos.statusFontSize,
    lineHeight: bubbleMetrics.macos.statusLineHeight,
    letterSpacing: bubbleMetrics.macos.statusLetterSpacing,
    weight: 400,
    emphasisWeight: 600,
    // Reused: the measured between-cluster gap. A system line is its own cluster.
    gapAbove: bubbleMetrics.macos.gapBetweenGroups,
    gapBelow: bubbleMetrics.macos.gapBetweenGroups,
    inset: bubbleMetrics.macos.edgeInset,
  },
};

/**
 * Palette first, then the measured value for that platform and theme, so a bare
 * `<SystemMessage>` outside an app shell still paints the right grey.
 */
const secondaryVars: Record<Platform, string> = {
  ios: "[--im-sys-label:var(--im-secondary,#8a8a8e)] dark:[--im-sys-label:var(--im-secondary,#8d8d93)]",
  macos: "[--im-sys-label:var(--im-secondary,#808080)] dark:[--im-sys-label:var(--im-secondary,#9a9a9a)]",
};

/** The one captured string, kept verbatim. */
export const unknownSenderText =
  "If you did not expect this message from an unknown sender, it may be spam.";

/** Apple's past-tense tapback wording, keyed by the kit's own `TapbackType`. */
export const reactionVerbs: Record<TapbackType, string> = {
  love: "loved",
  like: "liked",
  dislike: "disliked",
  laugh: "laughed at",
  emphasize: "emphasized",
  question: "questioned",
};

export type MissedCallKind = "audio" | "video" | "facetime";

/**
 * One thing that happened to the conversation rather than in it. `actor` is the person who did it;
 * leave it out (or pass "You") for the first person, which never renders bold.
 */
export type SystemMessageEvent =
  | { type: "unknownSender" }
  | { type: "conversationNamed"; actor?: string; name: string }
  | { type: "participantAdded"; actor?: string; participant: string }
  | { type: "participantRemoved"; actor?: string; participant: string }
  | { type: "participantLeft"; actor?: string }
  | { type: "groupPhotoChanged"; actor?: string }
  | { type: "missedCall"; kind?: MissedCallKind }
  | { type: "reaction"; actor?: string; reaction: TapbackType; excerpt: string };

/** A run of the sentence. `emphasis` runs carry a participant's name and render semibold. */
export type SystemMessageSegment = { text: string; emphasis?: boolean };

const quoted = (text: string) => `“${text}”`;

/** "You" is the first person and stays in the regular weight; anyone else is a name, so it bolds. */
function person(name: string | undefined): SystemMessageSegment {
  const text = name ?? "You";
  return text === "You" ? { text } : { text, emphasis: true };
}

const missedCallText: Record<MissedCallKind, string> = {
  audio: "Missed Call",
  video: "Missed Video Call",
  // The same wording `facetime-card.tsx` uses for a missed FaceTime.
  facetime: "Missed FaceTime",
};

/** Turns an event into the runs of its sentence, so a name can render bold inside it. */
export function formatSystemMessage(event: SystemMessageEvent): SystemMessageSegment[] {
  switch (event.type) {
    case "unknownSender":
      return [{ text: unknownSenderText }];
    case "conversationNamed":
      return [person(event.actor), { text: ` named the conversation ${quoted(event.name)}.` }];
    case "participantAdded":
      return [person(event.actor), { text: " added " }, person(event.participant), { text: " to the conversation." }];
    case "participantRemoved":
      return [person(event.actor), { text: " removed " }, person(event.participant), { text: " from the conversation." }];
    case "participantLeft":
      return [person(event.actor), { text: " left the conversation." }];
    case "groupPhotoChanged":
      return [person(event.actor), { text: " changed the group photo." }];
    case "missedCall":
      return [{ text: missedCallText[event.kind ?? "audio"] }];
    case "reaction":
      return [person(event.actor), { text: ` ${reactionVerbs[event.reaction]} ${quoted(event.excerpt)}` }];
  }
}

/** The same sentence as one string, for a sidebar preview, an aria label, or a test. */
export function systemMessageText(event: SystemMessageEvent): string {
  return formatSystemMessage(event).map(segment => segment.text).join("");
}

export type SystemMessageProps = Omit<ComponentProps<"div">, "children"> & {
  /** The event to describe. Omit and pass `children` to render your own sentence in this style. */
  event?: SystemMessageEvent;
  platform?: Platform;
  /** Override the platform's spacing, e.g. to close it up against a date header. */
  gapAbove?: number;
  gapBelow?: number;
  /** Cap the wrapped column. Left open, the platform's edge inset does the wrapping. */
  maxWidth?: number;
  children?: ReactNode;
};

export function SystemMessage({
  event, platform: platformProp, gapAbove, gapBelow, maxWidth, children, className, style, ...props
}: SystemMessageProps) {
  const contextPlatform = usePlatform();
  const platform = platformProp ?? contextPlatform;
  const m = systemMessageMetrics[platform];
  const segments = event ? formatSystemMessage(event) : undefined;
  return (
    <div
      data-slot="system-message"
      data-platform={platform}
      data-kind={event?.type}
      role="note"
      className={cn("flex w-full select-none flex-col items-center", secondaryVars[platform], className)}
      style={{
        fontFamily: fontStack,
        // The inset is what wraps the sentence, so the padding has to come out of the full width
        // even where the host has no global reset. Without this the column is 402 wide inside a
        // 402 frame and the measured 370 wrap turns into an overflow.
        boxSizing: "border-box",
        paddingTop: gapAbove ?? m.gapAbove,
        paddingBottom: gapBelow ?? m.gapBelow,
        paddingInline: m.inset,
        ...style,
      }}
      {...props}
    >
      <p
        data-slot="system-message-text"
        className="m-0 text-center"
        style={{
          maxWidth,
          fontSize: m.fontSize,
          lineHeight: `${m.lineHeight}px`,
          fontWeight: m.weight,
          letterSpacing: m.letterSpacing,
          color: "var(--im-sys-label)",
        }}
      >
        {segments
          ? segments.map((segment, index) =>
              segment.emphasis ? (
                <strong key={`${index}-${segment.text}`} style={{ fontWeight: m.emphasisWeight }}>
                  {segment.text}
                </strong>
              ) : (
                <span key={`${index}-${segment.text}`}>{segment.text}</span>
              ),
            )
          : children}
      </p>
    </div>
  );
}
