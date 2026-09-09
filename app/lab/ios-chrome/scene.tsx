"use client";

import { IosStatusBar } from "@/registry/imessage/ios-status-bar";
import { IosNavBar } from "@/registry/imessage/ios-nav-bar";
import { IosComposer } from "@/registry/imessage/ios-composer";
import { IosConversationList, type IosConversation } from "@/registry/imessage/ios-conversation-list";
import { IosNewMessageSheet } from "@/registry/imessage/ios-new-message-sheet";
import { messageActionsDim } from "@/registry/imessage/message-actions";

export type ChromeScene = "conversation" | "composer-text" | "list" | "new-message" | "longpress";

/** Fixture strings are the ones visible in the captures so the pixel diff compares like with like. iOS formats times with a narrow no-break space. */
const conversations: IosConversation[] = [
  { id: "ja", name: "+1 (888) 555-1212", initials: "JA", preview: "Every detail, down to the last bubble.", time: "1:48 AM" },
  { id: "kb", name: "+1 (555) 564-8583", initials: "KB", preview: "Every detail, down to the last bubble.", time: "1:48 AM" },
];

const pasteText = "It’s all in the little details. ✨ A longer message should wrap naturally without stretching the conversation.";

/**
 * `longpress` is the `conversation` chrome with the long-press dim over it, and it exists because no
 * other lab draws the chrome under that dim: `/lab/tapback?scene=longpress*` renders the thread and
 * the overlay on a bare `--im-bg` ground, so its whole top 168 pt is flat dim over white where the
 * capture has a dimmed status bar and nav bar. That is the whole of the "+2.66 … +7.05 over the nav
 * band" the sweep reads as "the glass under the dim is too light": nothing is missing from the glass,
 * the glass is missing.
 *
 * The captures settle what the dim covers. `longpress-ok-light.png` is `conv3-light.png` with one
 * message pressed, so subtracting one from the other measures the dim directly, and outside the
 * overlay's own furniture (the lifted bubble, the pill and the menu, device rows 1356-2349) and the
 * status-bar clock (the two captures are 24 minutes apart) every pixel of the frame is exactly
 * `capture = scene·(1-0.21) + (22,21,42)·0.21`: nav bar residual mean 0.14/255, max 0.9 over the
 * whole 0-255 range, i.e. the nav bar is under the dim, unblurred, and nothing is re-drawn above it.
 * The status bar goes under it too (its white reads #ceced2, the same as the list's).
 *
 * One alpha covers the frame. Fitting `conv3-light.png` -> `longpress-ok-light.png` per band, on the
 * clean pixels only, gives alpha 0.2103/0.2092/0.2130 over the nav bar (device rows 162-450),
 * 0.2105/0.2054/0.2129 over the list (600-1200), 0.2133/0.2118/0.2172 over the composer (2340-2560)
 * and the same tint within a level of each. So there is no separate chrome dim to report.
 *
 * What this scene reconstructs, and therefore what may be measured over it: `0 0 402 168` (status bar
 * + nav bar, which the overlay's furniture never reaches in any long-press capture) against
 * `longpress-ok-light.png` or `longpress-last-bubble-dark.png`, and `0 786 402 88` (the composer band)
 * against the light one only — its menu ends at 783, while the dark capture presses the last bubble
 * so its menu clamps at the bottom inset and covers the composer down to device row 2495. The list
 * band is deliberately empty here — that is `/lab/tapback`'s job — so the full frame does NOT
 * reconstruct and no full-frame number over this scene means anything. Times are the captures' own:
 * 2:12 in `longpress-ok-light.png`, 3:15 in `longpress-last-bubble-dark.png`.
 *
 * The one thing this scene renders knowingly wrong is the Dynamic Island: our dim covers it (5,4,9)
 * where the capture keeps it at #000000, a flat +6 over 6.4% of the `0 0 402 168` band. The island is
 * a hardware cutout the OS composites above the app, so no in-app dim may reach it; see the note on
 * `messageActionsDim`. Measuring `0 54 402 140` leaves it out.
 */
export function IosChromeScene({ scene, theme }: { scene: ChromeScene; theme: "light" | "dark" }) {
  const dark = theme === "dark";
  const frame = { width: 402, height: 874, position: "relative", overflow: "hidden", background: dark ? "#000000" : "#ffffff" } as const;
  if (scene === "list") {
    return (
      <div data-testid="lab" className={theme} style={frame}>
        <IosConversationList conversations={conversations} />
        <IosStatusBar time="1:57" className="absolute left-0 top-0" />
      </div>
    );
  }
  if (scene === "new-message") {
    return (
      <div data-testid="lab" className={theme} style={frame}>
        <IosStatusBar time="1:58" className="absolute left-0 top-0" />
        <IosNewMessageSheet caret>
          <IosComposer placeholder="" raised />
        </IosNewMessageSheet>
      </div>
    );
  }
  const longpress = scene === "longpress";
  return (
    <div data-testid="lab" className={theme} style={frame}>
      <IosStatusBar time={longpress ? (dark ? "3:15" : "2:12") : dark ? "1:45" : "1:48"} className="absolute left-0 top-0" />
      <IosNavBar name="+1 (888) 555-1212" initials="JA" className="absolute left-0 top-[54px]" />
      {/* `paste-check.png` was taken with a caret in the composer and `newmsg-light.png` with one in
          the To: field, so both show the raised composer; `conv3-light.png` and `list-light.png` have
          no editing session anywhere and show the resting one. See `composerLift`. */}
      <IosComposer className="absolute bottom-0 left-0" raised={scene === "composer-text"} defaultValue={scene === "composer-text" ? pasteText : ""} />
      {/* The long-press overlay's dim, over the chrome rather than beside it — see the scene doc. It is
          `message-actions`' own backdrop value, not a copy, so the two cannot drift apart. */}
      {longpress && <div data-slot="backdrop" aria-hidden="true" style={{ position: "absolute", inset: 0, background: messageActionsDim }} />}
    </div>
  );
}
