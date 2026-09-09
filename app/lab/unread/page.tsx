import { UnreadScene, type UnreadScene as UnreadSceneName } from "./scene";

export const metadata = { title: "Lab: unread" };

/**
 * The unread lab. Both conversation lists carry an unread dot and neither has ever drawn one, because
 * no fixture anywhere in this repo sets `unread` and `harness/preview.tsx` re-maps the fixture list
 * field by field on its way into both shells, dropping any field it does not name — `unread` among
 * them. Driving `/harness?scene=list` on either platform finds 6 iOS rows, 5 macOS rows and **zero**
 * elements matching `[data-slot="unread"], [data-slot="row-unread"], [data-slot="pinned-unread"]`.
 *
 * So this route renders the state at native geometry: 402 × 874 for iOS, the 960 × 640 window for
 * macOS, both at their real device scale, with a fixture set that puts every case ChatKit
 * distinguishes on screen at once (read, unread, group, muted, two-line, counted, selected, pinned).
 *
 * /lab/unread?platform=ios|macos&theme=light|dark&scene=list|shell|row&selected=<id>&frames=1&active=0|1
 *
 *   scene=list    the list component alone, in its native frame. The diffable one.
 *   scene=shell   the same conversations through `IosMessagesApp` / `MacMessagesApp`, which is the
 *                 path the harness takes. Both shells pass the whole conversation object down, so
 *                 this draws the dots too — which is the proof that the shells are not the bug.
 *   scene=row     cropped: the first four iOS rows, or the macOS sidebar column alone.
 *   selected=     which row starts selected. On the Mac this is what turns its dot white
 *                 (`shouldUnreadIndicatorChangeOnSelection` is YES there and NO on the phone).
 *   frames=1      overlays, in a 1-device-pixel #ff2d55 ring, the frame ChatKit's own
 *                 `_calculateIndicatorFrameForSize:trailing:displayScale:insets:` computes for each
 *                 unread row (see `./chatkit.ts`). One ring means the component agrees with the
 *                 framework; two visibly offset boxes means it does not, and the offset reads
 *                 straight off the screenshot. Off by default so the plain scene stays comparable to
 *                 a capture byte for byte.
 *   active=0      macOS only: not the key window, so the selection is gray. ChatKit does not settle
 *                 the dot in that state — `shouldLabelsBeHighlighted` is a bare ivar with no notion of
 *                 a key window — and the sidebar's own capture keeps its labels dark there, so the
 *                 component keeps the dot blue to match. Rendering it is how that stays visible.
 */
export default async function UnreadLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const str = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const platform = str("platform") === "macos" ? "macos" : "ios";
  const theme = str("theme") === "dark" ? "dark" : "light";
  const raw = str("scene");
  const scene: UnreadSceneName = raw === "shell" ? "shell" : raw === "row" ? "row" : "list";
  const selected = str("selected") ?? "unread";
  const frames = str("frames") === "1";
  const active = str("active") !== "0";
  return (
    <>
      <style>{"body > header, body > footer, body > a, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <UnreadScene platform={platform} theme={theme} scene={scene} selected={selected} frames={frames} active={active} />
    </>
  );
}
