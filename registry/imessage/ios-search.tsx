"use client";

import { useEffect, useId, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/registry/imessage/avatar";
import { IosMicIcon } from "@/registry/imessage/ios-composer";

/**
 * iOS 26 Messages search: the state the conversation list enters when the search field is pulled
 * down or tapped, and the results screen that replaces the list once there is a query.
 *
 * ## Where the numbers come from
 *
 * **Measured from a capture.** The search field itself is the one in
 * `references/ios/captures/list-light.png` / `list-dark.png`, carried over from
 * `ios-conversation-list.tsx` unchanged: a 48pt glass capsule inset 28 from both screen edges, radius
 * 24 (a plain circle, n = 2.045), resting at y 798-846; magnifier ring Ø13.49 centred (54.75, 820.22)
 * with a 1.725 stroke and a 2.467 handle; "Search" 17pt weight 500 at x 46.8; the mic 12.6667 x
 * 18.3333 inset 23.3333 from the pill's trailing edge. The 12pt gap to the button beside it is the
 * measured gap to the compose circle. Every row metric below that is shared with the conversation
 * list is also measured from those two frames: the 86.6667 row, the Ø45 avatar at x 26, the 17pt
 * semibold name at x 83, the 15pt secondary time whose ink ends at x 364, the chevron at x 376, the
 * 15pt/20 preview, and the separator from x 83 to 386. Colours are the list's measured tokens, and
 * the #0088ff / #0091ff tint is the measured iOS link colour (SPEC.md, "iOS colors").
 *
 * **Read out of the framework.** Nothing in `references/` holds a search *result*, so the results
 * screen is built from ChatKit 26.5 instead of a screenshot. Values were read at runtime off
 * `[[CKUIBehaviorPhone alloc] init]` (a Mac Catalyst probe that dlopens
 * `/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit`); every one of them
 * resolves to `-[CKUIBehavior …]`, which is the iPhone value because `CKUIBehaviorPhone` overrides
 * none of them. Each is named on the constant it feeds in `iosSearchMetrics`. The section titles, the
 * "See All" and "Cancel" labels and the "No Results" copy are the framework's own English strings out
 * of `ChatKit.framework/Versions/A/Resources/ChatKit.loctable`.
 *
 * Two structural facts also come from disassembly rather than guesswork:
 *
 * - `+[CKConversationSearchResultCell conversationListCellClass]` returns the ordinary conversation
 *   list cell at the default content size (it only swaps to `CKConversationLargeTextSearchCell` when
 *   `isAccessibilityPreferredContentSizeCategory` is YES), and
 *   `-[CKUIBehavior searchMessageCellHeightForDisplayScale:]` returns **86.66667** at scale 3, the
 *   conversation list's own row pitch. So a result row is a conversation row, at the measured pitch.
 * - `-[CKMessageSearchResultCell _annotatedResultStringForResult:searchText:]` builds the snippet by
 *   passing `searchMessagesBalloonFont` as **both** the primary and the annotated font and only
 *   swapping the colour: `secondaryLabelColor` to `labelColor` for an incoming message, and
 *   `searchMessagesFromMeUnannotatedLabelColor` (white at 0.6) to `+[UIColor whiteColor]` for one you
 *   sent. The match is therefore recoloured, never bolded. Before that it trims the snippet with
 *   `ck_trimmedStringWithPreferredLength:anchoredAroundSubstring:` at `searchMessagesMaxSummaryLength`
 *   (200), anchored on the match, which `trimAroundMatch` below reproduces.
 *
 * **Judgement, not measured.** Called out again on each constant: where the active field sits under
 * the status bar; the crossfade offsets and the 260/200 ms durations (reused from the measured
 * `effectsPickerMetrics.timing` of the "Send with effect" screen, which is a different screen, so they
 * carry no authority here); the Ø17 clear button; laying the Photos and Links sections out as
 * horizontal strips and the tile size that follows from `searchDefaultMaxResults`; and applying the
 * Documents cell's paddings to a link card. Do not quote any of those as measured.
 *
 * ## Motion
 *
 * One Web Animations timeline over four elements, so `document.getAnimations()` reaches it and
 * `progress` pauses and seeks every part to the same frame on every run. Closing runs the same
 * keyframes with `direction: "reverse"` and is read off the `open` prop **during render**, so the exit
 * always gets committed frames before `onExited` lets the caller unmount. `prefers-reduced-motion`
 * builds no animation at all: the screen is simply there, and a close still reports on the next frame.
 */

/** Section kinds, named after ChatKit's own controllers (`CKConversationSearchController` and friends). */
export type IosSearchSectionKind = "conversations" | "messages" | "photos" | "links";

export type IosSearchConversationResult = {
  id: string;
  name: string;
  initials?: string;
  /** The matching line. The part of it that matches the query is recoloured, not bolded. */
  preview: string;
  time: string;
};

export type IosSearchMessageResult = {
  id: string;
  /** Who sent it. */
  name: string;
  initials?: string;
  /** The chat it is in, shown ahead of the sender. */
  conversation?: string;
  text: string;
  time: string;
  /** Your own message: the balloon takes the outgoing fill and the match turns pure white. */
  fromMe?: boolean;
};

export type IosSearchPhotoResult = { id: string; src?: string; name: string; time: string };

export type IosSearchLinkResult = { id: string; title: string; domain: string; time: string; src?: string };

export type IosSearchResult =
  | IosSearchConversationResult
  | IosSearchMessageResult
  | IosSearchPhotoResult
  | IosSearchLinkResult;

export type IosSearchSection =
  | { kind: "conversations"; title?: string; results: IosSearchConversationResult[] }
  | { kind: "messages"; title?: string; results: IosSearchMessageResult[] }
  | { kind: "photos"; title?: string; results: IosSearchPhotoResult[] }
  | { kind: "links"; title?: string; results: IosSearchLinkResult[] };

/**
 * Every number the screen draws with, and where each one came from. "ChatKit" means it was read off
 * `-[CKUIBehavior …]` through the Phone behaviour; "measured" means a capture in `references/`.
 */
export const iosSearchMetrics = {
  /** The screen these were measured on. Points equal CSS px. */
  screen: { width: 402, height: 874 },
  field: {
    /** Measured, `list-light.png`: the pill is 48 tall, inset 28 both sides, radius 24. */
    height: 48,
    inset: 28,
    radius: 24,
    /** Measured: the resting pill spans x 28-314 (286 wide) and y 798-846. */
    restingTop: 798,
    restingWidth: 286,
    /** Measured: the 12pt gap between the pill and the compose circle beside it. */
    gap: 12,
    /**
     * Judgement. No capture holds the active search state, and ChatKit does not place it either:
     * `searchNavbarCanvasInsets` and `spaceBetweenSearchBarAndComposeButton` are declared on
     * `CKUIBehaviorMac` only, so on iPhone the bar is UIKit's and its offset is unmeasured. 6 centres
     * the 48pt pill in a 60pt bar below the status bar.
     */
    topFromInset: 6,
    /** Measured: magnifier, placeholder and mic offsets inside the pill. */
    glyphLeft: 19,
    glyphTop: 14,
    textLeft: 46.8,
    textTop: 15.5,
    micRight: 23.3333,
    micTop: 14.6667,
    micWidth: 12.6667,
    micHeight: 18.3333,
    /** Judgement: UIKit's clear button is a Ø17 disc; it is centred on the mic's ink. */
    clearSize: 17,
  },
  /** ChatKit `-[CKUIBehavior additionalSearchResultTopPadding]`: the gap from the bar to the results. */
  resultsTopPadding: 8,
  header: {
    /** ChatKit `searchHeaderHeight`. */
    height: 44,
    /** ChatKit `searchHeaderFont`: SF Semibold 20 (line 23.5547, cap 14.0918). */
    fontSize: 20,
    weight: 600,
    /** ChatKit `searchHeaderButtonFont`: SF Regular 17. */
    buttonFontSize: 17,
    /** ChatKit `searchSectionMarginInsets` = {0, 16, 0, 16}. */
    margin: 16,
    /** ChatKit `searchSectionHeadersPinToBounds` is YES, so headers stick. */
    pinned: true,
  },
  /**
   * ChatKit `searchMessageCellHeightForDisplayScale:` returns 86.66667 at scale 3 (86.5 at scale 2),
   * which is the conversation list's measured row pitch, and
   * `+[CKConversationSearchResultCell conversationListCellClass]` hands the conversation section the
   * ordinary list cell. So both row kinds are one measured row.
   */
  row: {
    height: 86.6667,
    /** Measured, `list-light.png`. */
    avatar: 45,
    avatarLeft: 26,
    avatarTop: 20,
    textLeft: 83,
    nameTop: 14,
    nameSize: 17,
    nameWeight: 600,
    timeSize: 15,
    timeRight: 37.1167,
    timeTop: 15,
    chevronLeft: 376,
    chevronTop: 15,
    previewTop: 33,
    previewSize: 15,
    previewLine: 20,
    separatorLeft: 83,
    separatorRight: 16,
  },
  message: {
    /** ChatKit `searchMessagesAvatarSize` = {28, 28}. */
    avatar: 28,
    /** ChatKit `searchMessagesTopSpacing` / `searchMessagesBottomSpacing`. */
    topSpacing: 12,
    bottomSpacing: 18,
    /** ChatKit `searchMessagesConversationToSenderSpacing`. */
    conversationToSender: 4,
    /** ChatKit `searchMessagesSenderToBalloonSpacing`. */
    senderToBalloon: 8,
    /** ChatKit `searchMessagesBalloonToChevronSpacing`. */
    balloonToChevron: 12,
    /** ChatKit `searchMessagesHorizontalBalloonMargin`; applied here as the balloon's width ceiling. */
    horizontalBalloonMargin: 72,
    /** ChatKit `searchMessagesBalloonFont` (SF Regular 17) and its 20.0215 line box. */
    balloonFontSize: 17,
    balloonLine: 20.0215,
    /** ChatKit `searchMessagesSenderFont` / `searchMessagesDateFont` (SF Regular 12), line 14.1328. */
    labelFontSize: 12,
    labelLine: 14.1328,
    /** ChatKit `searchMessagesDMConversationFont` / `…GroupConversationFont` are SF **Medium** 12. */
    conversationWeight: 500,
    /** ChatKit `searchMessagesMaxSummaryLength`. */
    maxSummaryLength: 200,
    /** Measured bubble padding (tokens.ts `bubbleMetrics.ios.paddingX`); the vertical padding is what the row height leaves. */
    balloonPaddingX: 13.85,
    /** Measured bubble radius, clamped to a capsule by the balloon's own height. */
    balloonRadius: 19,
  },
  photos: {
    /** ChatKit `searchPhotosInterItemSpacing`. */
    gap: 10,
    /**
     * ChatKit `searchPhotosCellCornerRadius` is 0 on the Phone behaviour. `CKUIBehaviorMac` overrides
     * it to 8, which is what makes 0 read as a real value rather than an unset default.
     */
    radius: 0,
    /**
     * Judgement, from two framework numbers: `searchDefaultMaxResults` is 4 and the section is inset
     * 16 either side, so four tiles and three 10pt gaps across 402 give (370 - 30) / 4 = 85.
     */
    tile: 85,
  },
  links: {
    /** ChatKit `searchLinksInterItemSpacing` and `searchLinksCellCornerRadius`. */
    gap: 10,
    radius: 10,
    /** ChatKit `searchLinksFractionalWidthScale` 1.2 and `searchLinksFractionalHeightScale` 0.85, applied to the photo tile. */
    widthScale: 1.2,
    heightScale: 0.85,
    /** ChatKit `searchResultLabelBoldFont` / `searchResultLabelFont`: SF Semibold and Regular 12. */
    labelFontSize: 12,
    labelLine: 14.1328,
    /** Judgement: the Documents cell's own paddings (`searchAttachmentsTitleTopPadding` 12, `searchAttachmentsCellDatePadding` 4) applied to a link card. */
    titleTop: 12,
    subtitleTop: 4,
  },
  /** ChatKit `searchResultsTitleHeaderBottomPadding`, used here as the gap under a strip section. */
  sectionGap: 12,
  /** ChatKit `searchDefaultMaxResults`: how many rows a section shows before "See All". */
  maxResults: 4,
  empty: {
    /** ChatKit `searchIndexingTitleFont` (SF Regular 22) and `searchIndexingSubtitleFont` (SF Regular 15). */
    titleFontSize: 22,
    subtitleFontSize: 15,
  },
  /**
   * Judgement. Reused from the measured `effectsPickerMetrics.timing` in `ios-effects-picker.tsx`,
   * which was measured for a different screen, so these carry no authority for this one.
   */
  timing: { enter: 260, exit: 200 },
} as const;

/** ChatKit's own English section titles, out of `ChatKit.loctable`. */
export const iosSearchSectionTitles: Record<IosSearchSectionKind, string> = {
  // SEARCH_CONVERSATIONS_TITLE. The framework calls this section Conversations, not Contacts.
  conversations: "Conversations",
  messages: "Messages", // SEARCH_MESSAGES_TITLE
  photos: "Photos", // SEARCH_PHOTOS_TITLE
  links: "Links", // SEARCH_LINKS_TITLE
};

/** ChatKit strings: SEARCH, CANCEL, SEARCH_SHOW_MORE, SEARCH_RESULTS_INDEXING_TITLE. */
export const iosSearchStrings = {
  placeholder: "Search",
  cancel: "Cancel",
  seeAll: "See All",
  noResults: "No Results",
} as const;

export type IosSearchProps = Omit<ComponentProps<"div">, "onSelect" | "onChange"> & {
  /** The query. Uncontrolled when omitted. */
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  sections?: IosSearchSection[];
  onSelect?: (result: IosSearchResult, kind: IosSearchSectionKind) => void;
  onSeeAll?: (kind: IosSearchSectionKind) => void;
  /** Cancel, and Escape, leave search. */
  onCancel?: () => void;
  /** False plays the exit and then calls `onExited`. */
  open?: boolean;
  onExited?: () => void;
  /** Seek the transition to this fraction (0..1) instead of playing it, which is what the harness does. */
  progress?: number;
  /** Space above the field for the status bar. */
  topInset?: number;
  /** Where the field rests on the list before it rises. Measured at y 798. */
  restingFieldTop?: number;
  /** Rows per section before "See All" appears. ChatKit's own default is 4. */
  maxResults?: number;
  placeholder?: string;
  cancelLabel?: string;
  /** Shown before anything is typed. Native fills this with suggestions, which this kit does not model. */
  emptyState?: ReactNode;
  /** Second line under "No Results". Native only fills it while the index is still building. */
  noResultsDetail?: string;
};

const font = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif';

/**
 * Light values are the conversation list's measured tokens; dark values are its measured dark set.
 * The balloon fills are the kit's measured palette (`tokens.ts`): iOS gray #e9e9eb / #262629, and the
 * blue, which `tokens.ts` still carries from macOS because no iOS capture holds a blue bubble.
 */
const vars =
  "[--ios-search-bg:#ffffff] [--ios-search-label:#000000] [--ios-search-secondary:#8a8a8e] [--ios-search-chevron:#c5c5c7] [--ios-search-separator:#e8e8e8] " +
  "[--ios-search-glass:rgba(255,255,255,0.9)] [--ios-search-rim:none] [--ios-search-shadow:0_6px_36px_4px_rgba(0,0,0,0.065)] [--ios-search-field:#8a8a8e] " +
  "[--ios-search-tint:#0088ff] [--ios-search-dim:rgba(0,0,0,0.2)] [--ios-search-clear:#c5c5c7] " +
  "[--ios-search-incoming:#e9e9eb] [--ios-search-incoming-text:#000000] [--ios-search-blue-top:#77c7f5] [--ios-search-blue-bottom:#3682f7] [--ios-search-tile:#e9e9eb] " +
  "dark:[--ios-search-bg:#000000] dark:[--ios-search-label:#ffffff] dark:[--ios-search-secondary:#8d8d93] dark:[--ios-search-chevron:#464649] dark:[--ios-search-separator:#2a2a2c] " +
  "dark:[--ios-search-glass:rgba(28,28,28,0.9)] dark:[--ios-search-rim:inset_0_0_0_1px_rgba(255,255,255,0.09)] dark:[--ios-search-shadow:none] dark:[--ios-search-field:#97979d] " +
  "dark:[--ios-search-tint:#0091ff] dark:[--ios-search-dim:rgba(0,0,0,0.5)] dark:[--ios-search-clear:#464649] " +
  "dark:[--ios-search-incoming:#262629] dark:[--ios-search-incoming-text:#ffffff] dark:[--ios-search-blue-top:#589af7] dark:[--ios-search-blue-bottom:#3d8ef7] dark:[--ios-search-tile:#1c1c1e]";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? "").join("").toUpperCase();
}

/** Where the query lands in a piece of text. Falls back to each word when the whole phrase misses. */
function matchRanges(text: string, query: string): Array<[number, number]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const haystack = text.toLowerCase();
  const find = (term: string) => {
    const found: Array<[number, number]> = [];
    for (let at = haystack.indexOf(term); at !== -1; at = haystack.indexOf(term, at + term.length)) found.push([at, at + term.length]);
    return found;
  };
  const whole = find(needle);
  if (whole.length > 0) return whole;
  const words = needle.split(/\s+/).filter(Boolean);
  return words.flatMap(find).sort((a, b) => a[0] - b[0]);
}

/**
 * ChatKit's `ck_trimmedStringWithPreferredLength:anchoredAroundSubstring:`: a snippet longer than
 * `max` is cut down to a window centred on the match, with an ellipsis on whichever side was cut.
 */
export function trimAroundMatch(text: string, query: string, max = iosSearchMetrics.message.maxSummaryLength): string {
  if (text.length <= max) return text;
  const first = matchRanges(text, query)[0];
  const anchor = first ? first[0] : 0;
  const start = Math.max(0, Math.min(text.length - max, anchor - Math.floor((max - (first ? first[1] - first[0] : 0)) / 2)));
  const end = Math.min(text.length, start + max);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/**
 * The annotated snippet. Same font throughout, only the colour changes, which is what
 * `-[CKMessageSearchResultCell _annotatedResultStringForResult:searchText:]` does.
 */
function Highlight({ text, query, match }: { text: string; query: string; match: string }) {
  const ranges = matchRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([start, end], index) => {
    if (start < at) return;
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <span key={`${start}-${index}`} data-slot="match" style={{ color: match }}>
        {text.slice(start, end)}
      </span>,
    );
    at = end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

/** The measured list chevron, reused byte for byte. */
function Chevron({ style }: { style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" data-slot="chevron" className="absolute" style={style} width="11" height="16" viewBox="-2 -2 11 16" fill="none" stroke="var(--ios-search-chevron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 1 6 6 1 11" />
    </svg>
  );
}

/** The measured list separator, from x 83 to 386 at the row's bottom edge. */
function RowSeparator() {
  const m = iosSearchMetrics.row;
  return <span aria-hidden="true" data-slot="separator" className="absolute" style={{ left: m.separatorLeft, right: m.separatorRight, bottom: 0, height: 1, transform: "translateY(-0.3333px)", background: "var(--ios-search-separator)" }} />;
}

function ConversationRow({ result, query, onSelect }: { result: IosSearchConversationResult; query: string; onSelect?: () => void }) {
  const m = iosSearchMetrics.row;
  return (
    <button type="button" onClick={onSelect} aria-label={`${result.name}, ${result.time}, ${result.preview}`}
      className="absolute inset-0 w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500">
      <Avatar aria-hidden="true" size={m.avatar} initials={result.initials ?? initialsOf(result.name)} className="absolute" style={{ left: m.avatarLeft, top: m.avatarTop }} />
      <span aria-hidden="true" data-slot="name" className="absolute truncate" style={{ left: m.textLeft, right: 96, top: m.nameTop, transform: "translateY(0.3333px)", fontSize: m.nameSize, lineHeight: 1, fontWeight: m.nameWeight, letterSpacing: 0, color: "var(--ios-search-label)" }}>
        {result.name}
      </span>
      <span aria-hidden="true" data-slot="time" className="absolute whitespace-nowrap" style={{ right: m.timeRight, top: m.timeTop, transform: "translateY(0.3333px)", fontSize: m.timeSize, lineHeight: 1, letterSpacing: 0, color: "var(--ios-search-secondary)" }}>
        {result.time}
      </span>
      <Chevron style={{ left: m.chevronLeft, top: m.chevronTop, transform: "translateX(0.3333px)" }} />
      <span aria-hidden="true" data-slot="preview" className="absolute overflow-hidden" style={{ left: m.textLeft, right: 34, top: m.previewTop, transform: "translateY(-0.3333px)", fontSize: m.previewSize, lineHeight: `${m.previewLine}px`, letterSpacing: 0, color: "var(--ios-search-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as CSSProperties}>
        <Highlight text={result.preview} query={query} match="var(--ios-search-label)" />
      </span>
      <RowSeparator />
    </button>
  );
}

function MessageRow({ result, query, onSelect }: { result: IosSearchMessageResult; query: string; onSelect?: () => void }) {
  const row = iosSearchMetrics.row;
  const m = iosSearchMetrics.message;
  const snippet = trimAroundMatch(result.text, query);
  // Every spacing here is a framework value; the balloon's own vertical padding is what the 86.6667
  // row has left once they are taken out, so it is derived rather than invented.
  const balloonTop = m.topSpacing + m.labelLine + m.senderToBalloon;
  const balloonHeight = row.height - balloonTop - m.bottomSpacing;
  const label = [result.conversation, result.name].filter(Boolean).join(", ");
  return (
    <button type="button" onClick={onSelect} aria-label={`${label}, ${result.time}, ${snippet}`}
      className="absolute inset-0 w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500">
      {/* Ø28 centred in the measured 26-71 avatar gutter so the text column still starts at x 83. */}
      <Avatar aria-hidden="true" size={m.avatar} initials={result.initials ?? initialsOf(result.name)} className="absolute" style={{ left: row.avatarLeft + (row.avatar - m.avatar) / 2, top: m.topSpacing }} />
      <span aria-hidden="true" data-slot="message-heading" className="absolute flex items-baseline overflow-hidden whitespace-nowrap" style={{ left: row.textLeft, right: row.timeRight + 40, top: m.topSpacing, height: m.labelLine, gap: m.conversationToSender, fontSize: m.labelFontSize, lineHeight: `${m.labelLine}px`, letterSpacing: 0 }}>
        {result.conversation && <span data-slot="conversation" className="shrink-0 truncate" style={{ fontWeight: m.conversationWeight, color: "var(--ios-search-label)" }}>{result.conversation}</span>}
        <span data-slot="sender" className="truncate" style={{ color: "var(--ios-search-secondary)" }}>{result.name}</span>
      </span>
      <span aria-hidden="true" data-slot="time" className="absolute whitespace-nowrap" style={{ right: row.timeRight, top: m.topSpacing, fontSize: m.labelFontSize, lineHeight: `${m.labelLine}px`, letterSpacing: 0, color: "var(--ios-search-secondary)" }}>
        {result.time}
      </span>
      {/*
        The track carries the geometry so the balloon inside it can hug its own text and still stop
        short: an absolutely positioned box cannot take `left`, `right` and a shrink-to-fit width at
        once. The chevron sits at the row's trailing edge and the framework's 12pt balloon-to-chevron
        gap becomes the track's right inset, with `searchMessagesHorizontalBalloonMargin` as the
        ceiling on top of that.
      */}
      <span aria-hidden="true" data-slot="balloon-track" className="absolute flex items-center"
        style={{ left: row.textLeft, right: iosSearchMetrics.screen.width - row.chevronLeft + m.balloonToChevron, top: balloonTop, height: balloonHeight }}>
        <span data-slot="balloon" className="flex h-full items-center overflow-hidden"
          style={{
            maxWidth: `min(100%, ${iosSearchMetrics.screen.width - m.horizontalBalloonMargin}px)`,
            paddingLeft: m.balloonPaddingX,
            paddingRight: m.balloonPaddingX,
            borderRadius: Math.min(m.balloonRadius, balloonHeight / 2),
            background: result.fromMe ? "linear-gradient(var(--ios-search-blue-top), var(--ios-search-blue-bottom))" : "var(--ios-search-incoming)",
            fontSize: m.balloonFontSize,
            lineHeight: `${m.balloonLine}px`,
            letterSpacing: 0,
            color: result.fromMe ? "rgba(255,255,255,0.6)" : "var(--ios-search-secondary)",
          }}>
          <span className="truncate">
            <Highlight text={snippet} query={query} match={result.fromMe ? "#ffffff" : "var(--ios-search-label)"} />
          </span>
        </span>
      </span>
      <Chevron style={{ left: row.chevronLeft, top: balloonTop + balloonHeight / 2 - 8, transform: "translateX(0.3333px)" }} />
      <RowSeparator />
    </button>
  );
}

function PhotoTile({ result, onSelect }: { result: IosSearchPhotoResult; onSelect?: () => void }) {
  const m = iosSearchMetrics.photos;
  return (
    <button type="button" onClick={onSelect} aria-label={`Photo from ${result.name}, ${result.time}`}
      className="relative shrink-0 overflow-hidden focus-visible:outline-2 focus-visible:outline-blue-500"
      style={{ width: m.tile, height: m.tile, borderRadius: m.radius, background: "var(--ios-search-tile)" }}>
      {result.src && (
        // eslint-disable-next-line @next/next/no-img-element -- registry components stay framework-neutral
        <img src={result.src} alt="" className="size-full object-cover" draggable={false} />
      )}
    </button>
  );
}

function LinkCard({ result, query, onSelect }: { result: IosSearchLinkResult; query: string; onSelect?: () => void }) {
  const m = iosSearchMetrics.links;
  const width = iosSearchMetrics.photos.tile * m.widthScale;
  const thumbHeight = iosSearchMetrics.photos.tile * m.heightScale;
  return (
    <button type="button" onClick={onSelect} aria-label={`${result.title}, ${result.domain}, ${result.time}`}
      className="relative shrink-0 text-left focus-visible:outline-2 focus-visible:outline-blue-500" style={{ width }}>
      <span aria-hidden="true" className="block overflow-hidden" style={{ height: thumbHeight, borderRadius: m.radius, background: "var(--ios-search-tile)" }}>
        {result.src && (
          // eslint-disable-next-line @next/next/no-img-element -- registry components stay framework-neutral
          <img src={result.src} alt="" className="size-full object-cover" draggable={false} />
        )}
      </span>
      <span aria-hidden="true" className="block truncate" style={{ marginTop: m.titleTop, fontSize: m.labelFontSize, lineHeight: `${m.labelLine}px`, fontWeight: 600, letterSpacing: 0, color: "var(--ios-search-label)" }}>
        <Highlight text={result.title} query={query} match="var(--ios-search-tint)" />
      </span>
      <span aria-hidden="true" className="block truncate" style={{ marginTop: m.subtitleTop, fontSize: m.labelFontSize, lineHeight: `${m.labelLine}px`, letterSpacing: 0, color: "var(--ios-search-secondary)" }}>
        {result.domain} · {result.time}
      </span>
    </button>
  );
}

function SectionHeader({ id, title, kind, showSeeAll, onSeeAll }: { id: string; title: string; kind: IosSearchSectionKind; showSeeAll: boolean; onSeeAll?: (kind: IosSearchSectionKind) => void }) {
  const m = iosSearchMetrics.header;
  return (
    <div data-slot="section-header" className="sticky top-0 z-10" style={{ height: m.height, background: "var(--ios-search-bg)" }}>
      <h2 id={id} className="absolute m-0 truncate" style={{ left: m.margin, right: m.margin + 80, top: (m.height - m.fontSize) / 2, fontSize: m.fontSize, lineHeight: 1, fontWeight: m.weight, letterSpacing: 0, color: "var(--ios-search-label)" }}>
        {title}
      </h2>
      {showSeeAll && onSeeAll && (
        <button type="button" data-slot="see-all" onClick={() => onSeeAll(kind)} aria-label={`${iosSearchStrings.seeAll} ${title}`}
          className="absolute rounded focus-visible:outline-2 focus-visible:outline-blue-500"
          style={{ right: m.margin, top: (m.height - m.buttonFontSize) / 2, fontSize: m.buttonFontSize, lineHeight: 1, letterSpacing: 0, color: "var(--ios-search-tint)" }}>
          {iosSearchStrings.seeAll}
        </button>
      )}
    </div>
  );
}

export function IosSearch({
  query: queryProp,
  defaultQuery = "",
  onQueryChange,
  sections = [],
  onSelect,
  onSeeAll,
  onCancel,
  open = true,
  onExited,
  progress,
  topInset = 54,
  restingFieldTop = iosSearchMetrics.field.restingTop,
  maxResults = iosSearchMetrics.maxResults,
  placeholder = iosSearchStrings.placeholder,
  cancelLabel = iosSearchStrings.cancel,
  emptyState = null,
  noResultsDetail,
  className,
  style,
  ...props
}: IosSearchProps) {
  const m = iosSearchMetrics;
  const id = useId();
  const [internalQuery, setInternalQuery] = useState(defaultQuery);
  const query = queryProp ?? internalQuery;
  const setQuery = (next: string) => {
    if (queryProp === undefined) setInternalQuery(next);
    onQueryChange?.(next);
  };

  const scrim = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const fieldRow = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const exited = useRef(false);
  // Kept in a ref so a caller passing a fresh closure does not restart the timeline: an inline arrow
  // has a new identity on every render, and a dependency on it would tear a finished exit down and
  // start it again from the top.
  const exitedCallback = useRef(onExited);
  useEffect(() => {
    exitedCallback.current = onExited;
  });

  const [cancelWidth, setCancelWidth] = useState(0);
  useEffect(() => {
    const node = cancel.current;
    if (!node) return;
    const sync = () => setCancelWidth(node.offsetWidth);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [cancelLabel]);

  const fieldTop = topInset + m.field.topFromInset;
  const rowWidth = m.screen.width - m.field.inset * 2;
  const pillWidth = cancelWidth > 0 ? rowWidth - cancelWidth - m.field.gap : rowWidth;
  const rise = restingFieldTop - fieldTop;
  const resultsTop = fieldTop + m.field.height + m.resultsTopPadding;

  /** Escape leaves search, wherever focus happens to be. */
  useEffect(() => {
    if (!open || !onCancel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  /** Opening for real takes the caret; a scrubbed frame must not, or the harness moves focus. */
  useEffect(() => {
    if (!open || progress !== undefined) return;
    input.current?.focus({ preventScroll: true });
  }, [open, progress]);

  /**
   * One timeline over the scrim, the surface, the field row and the pill. Closing runs the same
   * keyframes in reverse, so a seek lands on the same frame in either direction, and the direction is
   * read off `open` during render rather than in an effect that would skip the exit's frames.
   */
  useEffect(() => {
    if (open) exited.current = false;
    const closing = !open;
    const duration = closing ? m.timing.exit : m.timing.enter;
    const finish = () => {
      if (exited.current) return;
      exited.current = true;
      exitedCallback.current?.();
    };
    // Scrubbing is inspection, not a dismissal: a seeked exit poses the screen and reports nothing.
    const reports = closing && progress === undefined;
    if (reducedMotion()) {
      if (!reports) return;
      const frame = requestAnimationFrame(finish);
      return () => cancelAnimationFrame(frame);
    }
    const tracks: Array<[HTMLElement | null, Keyframe[]]> = [
      // Judgement: the dim leads and the opaque surface follows, so the list is visibly dimmed
      // before it is replaced. Neither offset is measured.
      [scrim.current, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 1, offset: 1 }]],
      [surface.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.15 }, { opacity: 1, offset: 1 }]],
      [fieldRow.current, [{ transform: `translateY(${rise}px)` }, { transform: "translateY(0px)" }]],
      [pill.current, [{ width: `${m.field.restingWidth}px` }, { width: `${pillWidth}px` }]],
      [cancel.current, [{ opacity: 0, transform: `translateX(${m.field.gap}px)` }, { opacity: 1, transform: "translateX(0px)" }]],
    ];
    const animations = tracks
      .filter((track): track is [HTMLElement, Keyframe[]] => track[0] !== null)
      .map(([node, frames]) => node.animate(frames, { duration, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "both", direction: closing ? "reverse" : "normal" }));
    if (progress !== undefined) {
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = clamp01(progress) * duration;
      }
      return () => { for (const animation of animations) animation.cancel(); };
    }
    if (!closing) return () => { for (const animation of animations) animation.cancel(); };
    const first = animations[0];
    first?.addEventListener("finish", finish);
    return () => first?.removeEventListener("finish", finish);
  }, [open, progress, rise, pillWidth, m.field.gap, m.field.restingWidth, m.timing.enter, m.timing.exit]);

  const typed = query.trim().length > 0;
  const shown = sections.map(section => ({ section, visible: section.results.slice(0, maxResults) })).filter(entry => entry.visible.length > 0);
  const total = sections.reduce((count, section) => count + section.results.length, 0);

  return (
    <div data-slot="ios-search" data-state={open ? "open" : "closed"} className={cn("absolute inset-0 isolate select-none overflow-hidden", vars, className)}
      style={{ fontFamily: font, ...style }} {...props}>
      <div ref={scrim} aria-hidden="true" data-slot="scrim" className="absolute inset-0" style={{ background: "var(--ios-search-dim)" }} />

      {/* The opaque page and everything on it fade together, so the list never shows through a gap
          between two rows on the way in. */}
      <div ref={surface} data-slot="surface" className="absolute inset-0" style={{ background: "var(--ios-search-bg)" }}>
      <div data-slot="results" className="absolute overflow-y-auto" style={{ left: 0, right: 0, top: resultsTop, bottom: 0 }}>
        {!typed && emptyState}
        {typed && total === 0 && (
          <div data-slot="no-results" role="status" className="flex h-full flex-col items-center justify-center px-8 text-center">
            <p className="m-0" style={{ fontSize: m.empty.titleFontSize, lineHeight: 1.2, letterSpacing: 0, color: "var(--ios-search-label)" }}>{iosSearchStrings.noResults}</p>
            {noResultsDetail && <p className="m-0" style={{ marginTop: 8, fontSize: m.empty.subtitleFontSize, lineHeight: 1.3, letterSpacing: 0, color: "var(--ios-search-secondary)" }}>{noResultsDetail}</p>}
          </div>
        )}
        {typed && shown.map(({ section, visible }) => {
          const title = section.title ?? iosSearchSectionTitles[section.kind];
          const headingId = `${id}-${section.kind}`;
          const seeAll = section.results.length > visible.length;
          return (
            <section key={section.kind} data-slot="section" data-kind={section.kind} aria-labelledby={headingId} className="relative">
              <SectionHeader id={headingId} title={title} kind={section.kind} showSeeAll={seeAll} onSeeAll={onSeeAll} />
              {section.kind === "conversations" && (
                <ul role="list" aria-labelledby={headingId} className="relative m-0 list-none p-0" style={{ height: visible.length * m.row.height }}>
                  {visible.map((result, index) => (
                    <li key={result.id} role="listitem" className="absolute left-0 right-0 top-0" style={{ height: m.row.height, transform: `translateY(${index * m.row.height}px)` }}>
                      <ConversationRow result={result as IosSearchConversationResult} query={query} onSelect={() => onSelect?.(result, section.kind)} />
                    </li>
                  ))}
                </ul>
              )}
              {section.kind === "messages" && (
                <ul role="list" aria-labelledby={headingId} className="relative m-0 list-none p-0" style={{ height: visible.length * m.row.height }}>
                  {visible.map((result, index) => (
                    <li key={result.id} role="listitem" className="absolute left-0 right-0 top-0" style={{ height: m.row.height, transform: `translateY(${index * m.row.height}px)` }}>
                      <MessageRow result={result as IosSearchMessageResult} query={query} onSelect={() => onSelect?.(result, section.kind)} />
                    </li>
                  ))}
                </ul>
              )}
              {section.kind === "photos" && (
                <ul role="list" aria-labelledby={headingId} className="m-0 flex list-none overflow-x-auto p-0" style={{ gap: m.photos.gap, paddingLeft: m.header.margin, paddingRight: m.header.margin, paddingBottom: m.sectionGap }}>
                  {visible.map(result => (
                    <li key={result.id} role="listitem" className="shrink-0">
                      <PhotoTile result={result as IosSearchPhotoResult} onSelect={() => onSelect?.(result, section.kind)} />
                    </li>
                  ))}
                </ul>
              )}
              {section.kind === "links" && (
                <ul role="list" aria-labelledby={headingId} className="m-0 flex list-none overflow-x-auto p-0" style={{ gap: m.links.gap, paddingLeft: m.header.margin, paddingRight: m.header.margin, paddingBottom: m.sectionGap }}>
                  {visible.map(result => (
                    <li key={result.id} role="listitem" className="shrink-0">
                      <LinkCard result={result as IosSearchLinkResult} query={query} onSelect={() => onSelect?.(result, section.kind)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      </div>

      <div ref={fieldRow} data-slot="field-row" role="search" className="absolute z-20" style={{ left: m.field.inset, right: m.field.inset, top: fieldTop, height: m.field.height }}>
        <div ref={pill} data-slot="field" className="absolute left-0 top-0 h-full rounded-full" style={{ width: pillWidth }}>
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]" style={{ boxShadow: "var(--ios-search-shadow)" }} />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: "var(--ios-search-glass)", boxShadow: "var(--ios-search-rim)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }} />
          <svg aria-hidden="true" className="absolute" style={{ left: m.field.glyphLeft, top: m.field.glyphTop }} width="18.3333" height="18.6667" viewBox="-1 -1 18.3333 18.6667" fill="none" stroke="var(--ios-search-field)" strokeLinecap="round">
            <circle cx="6.745" cy="7.219" r="5.883" strokeWidth="1.725" />
            <path d="M11.4 12.01 15.17 15.78" strokeWidth="2.467" />
          </svg>
          {!typed && (
            <span aria-hidden="true" data-slot="placeholder" className="absolute" style={{ left: m.field.textLeft, top: m.field.textTop, transform: "translateY(0.3333px)", fontSize: 17, lineHeight: 1, fontWeight: 500, letterSpacing: 0, color: "var(--ios-search-field)" }}>
              {placeholder}
            </span>
          )}
          <input
            ref={input}
            type="text"
            role="searchbox"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={placeholder}
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="absolute border-0 bg-transparent p-0 outline-none select-text"
            style={{
              left: m.field.textLeft,
              right: m.field.micRight + m.field.micWidth + 8,
              // The measured placeholder's line box starts at 15.8333; a 20pt line box centres on it
              // from 14.3333. Weight 500 is the placeholder's measured weight, reused for typed text,
              // which no capture holds.
              top: 14.3333,
              height: 20,
              fontFamily: font,
              fontSize: 17,
              lineHeight: "20px",
              fontWeight: 500,
              letterSpacing: 0,
              color: "var(--ios-search-label)",
              caretColor: "var(--ios-search-tint)",
            }}
          />
          {typed ? (
            <button type="button" data-slot="clear" aria-label="Clear search" onClick={() => { setQuery(""); input.current?.focus(); }}
              className="absolute flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-blue-500"
              style={{ right: m.field.micRight + (m.field.micWidth - m.field.clearSize) / 2, top: (m.field.height - m.field.clearSize) / 2, width: m.field.clearSize, height: m.field.clearSize, background: "var(--ios-search-clear)" }}>
              <svg aria-hidden="true" width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="var(--ios-search-glass)" strokeWidth="1.6" strokeLinecap="round">
                <path d="M1 1 8 8M8 1 1 8" />
              </svg>
            </button>
          ) : (
            <span aria-hidden="true" className="absolute" style={{ right: m.field.micRight, top: m.field.micTop, color: "var(--ios-search-field)", display: "flex" }}>
              <IosMicIcon width={m.field.micWidth} height={m.field.micHeight} />
            </span>
          )}
        </div>
        <button ref={cancel} type="button" data-slot="cancel" onClick={onCancel}
          className="absolute right-0 top-0 h-full whitespace-nowrap rounded focus-visible:outline-2 focus-visible:outline-blue-500"
          style={{ fontSize: 17, lineHeight: 1, letterSpacing: 0, color: "var(--ios-search-tint)" }}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
