"use client";

import type { CSSProperties } from "react";
import { GroupAvatar, senderAvatarMetricsForPlatform, SenderAvatar, type GroupParticipant } from "@/registry/imessage/group-avatar";

/**
 * The seven fixture contacts the capture app hands to `CKAvatarView`, in order. The initials are
 * whatever `CNMutableContact(givenName:familyName:)` monograms to, which is the two initials.
 */
const cast: GroupParticipant[] = [
  { name: "Alex Morgan", initials: "AM" },
  { name: "Jamie Chen", initials: "JC" },
  { name: "Sam Rivera", initials: "SR" },
  { name: "Dana Wu", initials: "DW" },
  { name: "Kai Patel", initials: "KP" },
  { name: "Robin Diaz", initials: "RD" },
  { name: "Noor Haddad", initials: "NH" },
];

/** One stack at a fixed point in the 402 x 874 screen, exactly where the capture app put it. */
function Stack({ n, size, x, y, plate }: { n: number; size: number; x: number; y: number; plate?: string }) {
  return (
    <GroupAvatar
      participants={cast.slice(0, n)}
      size={size}
      plate={plate}
      style={{ position: "absolute", left: x, top: y }}
    />
  );
}

/**
 * `snowglobe` reconstructs `references/group-avatar/snowglobe-light.png` and `snowglobe-dark.png`
 * pixel-for-pixel: same screen (402 x 874 at 3x), same background, same band positions, same stack
 * origins, same seven contacts in the same order. Anything that differs in a diff is this
 * component's error, not the fixture's.
 *
 * Band layout, in points, straight out of the capture app:
 *   root         white (light) / black (dark)
 *   row A  y 60  Ø60, n = 1..6, x = 6, 72, 138, 204, 270, 336
 *   row B  y 130 Ø60 n=7 at 6; Ø45 n=2 at 72; Ø45 n=3 at 132; Ø45 n=7 at 192; Ø40 n=3 at 252; Ø40 n=7 at 312
 *   band   y 200..360, #3478f6
 *   row C  y 220 Ø60, n = 1..6, x = 6, 72, 138, 204, 270, 336
 *   row D  y 290 Ø60 n=7 at 6; Ø45 n=3 at 72; Ø40 n=3 at 132
 *   patch  y 380..460 opaque white   — row E y 390: Ø60 n=2 at 6, n=3 at 72, n=7 at 138
 *   patch  y 470..550 opaque black   — row F y 480: Ø60 n=2 at 6, n=3 at 72, n=7 at 138
 *
 * The plate over the two opaque patches is pinned to the measured `groupAvatarPlate` row for that
 * background, because those patches are opaque and the surrounding page is not: the component's
 * default fill is translucent and would show the page through them.
 */
function Snowglobe({ theme }: { theme: "light" | "dark" }) {
  const onWhite = theme === "light" ? "#f4f4f5" : "#7d7d7d";
  const onBlack = theme === "light" ? "#8d8e8e" : "#1f1f1f";
  const onBlue = theme === "light" ? "#a2c7ff" : "#264a8f";
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 200, width: 402, height: 160, background: "#3478f6" }} />
      <div style={{ position: "absolute", left: 0, top: 380, width: 402, height: 80, background: "#ffffff" }} />
      <div style={{ position: "absolute", left: 0, top: 470, width: 402, height: 80, background: "#000000" }} />

      {[1, 2, 3, 4, 5, 6].map((n, i) => <Stack key={`a${n}`} n={n} size={60} x={6 + 66 * i} y={60} />)}
      <Stack n={7} size={60} x={6} y={130} />
      <Stack n={2} size={45} x={72} y={130} />
      <Stack n={3} size={45} x={132} y={130} />
      <Stack n={7} size={45} x={192} y={130} />
      <Stack n={3} size={40} x={252} y={130} />
      <Stack n={7} size={40} x={312} y={130} />

      {[1, 2, 3, 4, 5, 6].map((n, i) => <Stack key={`c${n}`} n={n} size={60} x={6 + 66 * i} y={220} plate={onBlue} />)}
      <Stack n={7} size={60} x={6} y={290} plate={onBlue} />
      <Stack n={3} size={45} x={72} y={290} plate={onBlue} />
      <Stack n={3} size={40} x={132} y={290} plate={onBlue} />

      <Stack n={2} size={60} x={6} y={390} plate={onWhite} />
      <Stack n={3} size={60} x={72} y={390} plate={onWhite} />
      <Stack n={7} size={60} x={138} y={390} plate={onWhite} />

      <Stack n={2} size={60} x={6} y={480} plate={onBlack} />
      <Stack n={3} size={60} x={72} y={480} plate={onBlack} />
      <Stack n={7} size={60} x={138} y={480} plate={onBlack} />
    </>
  );
}

/**
 * The transcript gutter: what `avatarSupplementaryItemForChatItem:` builds. Three incoming rows in one
 * cluster, the avatar on the last, bottom flush with the balloon, hanging its own diameter off the
 * balloon's leading edge inside a `gutter` of leading padding.
 *
 * No capture backs this arrangement — it is the framework's anchor drawn out — so the balloons here
 * are plain rounded rectangles standing in for `message-bubble.tsx`, not a reproduction of one. Use
 * it to read the geometry, not to diff a screenshot.
 */
function Gutter({ platform, progress }: { platform: "ios" | "macos"; progress?: number }) {
  const m = senderAvatarMetricsForPlatform(platform);
  const rows = ["Are we still on for Thursday?", "I can bring the projector.", "Or we could just use the TV."];
  return (
    <div style={{ position: "absolute", left: 16, top: 60, right: 16 }} data-testid="gutter">
      {rows.map((text, index) => {
        const last = index === rows.length - 1;
        return (
          <div key={index} style={{ position: "relative", paddingInlineStart: m.gutter, marginTop: index ? 2 : 0 }}>
            <span style={{
              display: "inline-block", maxWidth: "70%", padding: "8px 12px", borderRadius: 18,
              background: "var(--lab-incoming, #e9e9eb)", color: "var(--lab-ink, #000)", fontSize: 17, lineHeight: "20px",
            }}>{text}</span>
            {last && (
              <SenderAvatar
                name="Jamie Chen" initials="JC" platform={platform}
                handoffKey="cluster-1" handoffFrom={progress === undefined ? undefined : { dy: -44 }} progress={progress}
              />
            )}
          </div>
        );
      })}
      <div style={{ position: "relative", marginTop: 10, paddingInlineStart: m.gutter, height: m.typingDiameter }}>
        <SenderAvatar name="Sam Rivera" initials="SR" platform={platform} variant="typing" />
      </div>
    </div>
  );
}

export function GroupAvatarLab({ scene, theme, platform, progress }: { scene: string; theme: "light" | "dark"; platform: "ios" | "macos"; progress?: number }) {
  const size = platform === "macos" ? { width: 960, height: 640 } : { width: 402, height: 874 };
  const style: CSSProperties = {
    ...size, position: "relative", overflow: "hidden",
    background: theme === "dark" ? "#000000" : "#ffffff",
    ["--lab-incoming" as string]: theme === "dark" ? "#262629" : "#e9e9eb",
    ["--lab-ink" as string]: theme === "dark" ? "#ffffff" : "#000000",
  };
  return (
    <div data-testid="lab" className={theme} style={style}>
      {scene === "gutter" ? <Gutter platform={platform} progress={progress} /> : <Snowglobe theme={theme} />}
    </div>
  );
}
