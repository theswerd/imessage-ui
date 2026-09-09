"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/registry/imessage/avatar";

/**
 * macOS 26 Messages conversation header. Measured from `references/macos/captures/conversation-pane-dark.png`
 * and `conversation-pane-light.png` (pane x 330–960 of a 960×640 window, 2x), in pane coordinates:
 * - compose button: Ø36 glass circle, left 6, top 8. Native's pure-white light rim occupies device columns
 *   13–14 and 84–85 and device rows 16–17 and 86–87, i.e. a box of x 6.5–43 by y 8–44 (36.5 × 36). Chrome
 *   snaps a box's paint origin to a whole CSS px, so left 6.5 renders at 7 and drags the glyph with it;
 *   left 6 keeps "square.and.pencil" ink at its measured 17.5–33.5 on both axes and leaves the rim 0.5
 *   left of native. Stroke ≈1.3, #dcdcdc; the rim (peak #373739 over a #1b1c1c fill) sits inside the circle.
 * - avatar: Ø40 at (295, 8), so its center is (315, 28), the pane's horizontal center.
 * - name pill: a 52.6 × 27.1 stadium centred (315, 57.95), i.e. y 44.4–71.5, whose top 3.6 pt hide under
 *   the avatar. Its caps are **circular**, not a squircle: tracing the rim of the dark capture at 2x and
 *   least-squares fitting a superellipse to 34 outline points gives exponent s = 2.01 (a circle) at
 *   0.45 device px rms, while `corner-shape: superellipse(1.4)` (s = 2.639) only reaches 0.93 rms. The
 *   same fit on our own render returns s = 2.64 exactly, so the fit does separate the two shapes.
 *   Fill #1b1b1b under a 0.75pt rgba(255,255,255,0.13) rim (peak #383838 over the fill); 13pt bold
 *   #f4f4f4 text ("Ben" ink 601–646 px, cap top 53.5, baseline 63) starting 11 from the pill edge, then a
 *   3.55 × 9.5 chevron (#5b5b5b, stroke 2, ink 329–332.6) that spans exactly the cap height.
 * - video button: 40×36 stadium (radius 18: the cap fits a circle to 0.2 pt), right inset 8, top 8. Its
 *   "video" glyph is a 13.75 × 12.3 rounded rect (radius 2, stroke 1.15) at (11.05, 11.65) in button
 *   coordinates plus a triangle whose right edge sits at x 30.1; total ink 592.5–612.65 × 18.9–32.5, #dcdddf.
 * - the bar itself is 55 tall (not visible in a capture: the glass has no edge) and translucent: the list
 *   scrolls under it, blurred and washed toward the pane color (light: #fcfcfc wash, bubbles show at ≈15%;
 *   dark: rgba(30,30,30) wash) for the top 50 pt, fading back to full content by ~95 pt.
 * Light theme (conversation-pane-light.png): buttons and pill are #fcfcfc/#fdfdfd discs with a 1 px white
 * rim and a soft downward shadow (−15/255 just below, −8 above), text #000000, chevron #b1b1b1, glyphs #262626.
 *
 * **How the pill grows.** 52.6 × 27.1 is the box for "Ben"; everything around the name is fixed, so the
 * pill is that name's advance plus a constant **28.25** (11 before the text, 4.7 after it, the 3.55
 * chevron box, 9 after that). Chrome renders "Ben" at 13px/700 `-apple-system` in a 24.766 box, which
 * puts the whole pill at 53.0 against the measured 52.6, and the extra 0.4 is that one string's advance,
 * the same 1.5-on-a-bubble difference `SPEC.md` records for "Second of two". The height never moves. The
 * pill is centred under the avatar on the pane's centre, so a longer name grows it by half each way and
 * the chevron keeps its 9 to the pill's right edge: the checked render of a 22-character group name
 * comes out 179.2 wide, still centred on 315, with the chevron's box still ending 9 inside it.
 * **Unverified**: where it stops growing. Nothing in a capture bounds it, so `maxWidthInset` is
 * judgement: the pill stops 8 short of the video button, whose 48 (right inset 8 plus width 40) is the
 * wider of the two ends, and the name truncates. That keeps the growth symmetric about the centre.
 *
 * **Groups** (`members`). A group's header draws the same stacked photo the sidebar row does, in the
 * same Ø40 box, and the pill carries the group's name. `groupPhotoRecipes` below is the same measured
 * table `macos-sidebar.tsx` carries, copied rather than imported the way the iOS chrome files each keep
 * their own copy of the avatar's numbers.
 */
export const macHeaderMetrics = {
  height: 55,
  /** Scroll-edge effect: content under the bar is blurred and washed out at full strength for the top
   *  `fadeStart` pt, then eases back to normal by `fadeEnd`. Measured two ways and they agree: over the
   *  empty pane of conversation-pane-light.png (column x 220, clear of the pill's shadow) the wash darkens
   *  white to 252/255 down to y 50.5, then 253 to 70.5, 254 to 89.5, and 255 from 89.5; over the bubbles of
   *  conversation-pane-dark-2.png the wash alpha solves to ≈0.83 at y 32, 0.15 at y 88 and 0.11 at y 92. */
  fadeStart: 50,
  fadeEnd: 96,
  compose: { left: 6, top: 8, size: 36 },
  avatar: { top: 8, size: 40 },
  pill: { top: 44.4, height: 27.1, textTop: 48, paddingLeft: 11, gap: 4.7, paddingRight: 9, fontSize: 13 },
  video: { right: 8, top: 8, width: 40, height: 36 },
  /** Judgement, not measured: how much of each end the pill leaves for the buttons before it truncates. */
  maxWidthInset: 8 + 40 + 8,
};

/**
 * ChatKit's group photo. `CKAvatarButton._avatarView` is a `CNAvatarView` like the conversation list's,
 * and handed more than one contact it lays the circles out through `ContactsUICore.SnowglobeUIView`.
 * Each row is `[x, y, diameter]` on a 44-unit box, back to front, scaled by `size / 44`; see
 * `macos-sidebar.tsx` for how they were read off the framework and what is deliberately not drawn.
 */
export const groupPhotoRecipes: readonly (readonly (readonly [number, number, number])[])[] = [
  [[0, 0, 44]],
  [[4.75, 4.75, 24], [23.75, 23.75, 14]],
  [[5.25, 5.25, 21], [24.75, 17.75, 16], [12.5, 27.25, 13]],
  [[5.25, 5.25, 21], [24.75, 17.75, 16], [12.5, 27.25, 13], [27, 6.75, 10]],
  [[5.25, 5.25, 21], [24.75, 17.75, 16], [12.5, 27.25, 13], [27, 6.75, 10], [4.75, 25.5, 7]],
  [[5.25, 5.25, 21], [24.75, 17.75, 16], [12.5, 27.25, 13], [27, 6.75, 10], [4.75, 25.5, 7], [23.25, 3.25, 5]],
  [[5.25, 5.25, 21], [24.25, 20.25, 15], [27.25, 8.25, 11], [6.5, 26.75, 10], [19.25, 33.25, 7.5], [17.75, 26.75, 5.5], [24, 3.75, 5]],
];

export type MacHeaderMember = { initials: string; name?: string; photo?: string };

export type MacHeaderProps = Omit<ComponentProps<"header">, "children"> & {
  name: string;
  initials?: string;
  /** Photo URL, or a custom avatar node. */
  photo?: string;
  avatar?: ReactNode;
  /**
   * Group conversation: its participants, drawn as the stacked group photo in place of one avatar.
   * Two or more entries make it a group; the stack shows the first seven. Ignored when `avatar` is set.
   */
  members?: MacHeaderMember[];
  onCompose?: () => void;
  onVideoCall?: () => void;
  /** Clicking the name pill opens the conversation details. */
  onOpenDetails?: () => void;
};

function GroupPhoto({ size, members, name }: { size: number; members: MacHeaderMember[]; name: string }) {
  const people = members.slice(0, groupPhotoRecipes.length);
  const recipe = groupPhotoRecipes[people.length - 1] ?? groupPhotoRecipes[0];
  const unit = size / 44;
  return (
    <span data-slot="group-photo" role="img" aria-label={name} className="relative block shrink-0" style={{ width: size, height: size }}>
      {people.map((person, index) => {
        const [x, y, diameter] = recipe[index];
        return (
          <Avatar key={index} aria-hidden="true" size={diameter * unit} initials={person.initials} src={person.photo} name={person.name}
            className="absolute" style={{ left: x * unit, top: y * unit }} />
        );
      })}
    </span>
  );
}

const glassButton = "absolute block bg-[var(--hd-fill)] p-0 text-[var(--hd-ink)] shadow-[var(--hd-rim)] outline-offset-2 hover:bg-[var(--hd-fill-hover)] focus-visible:outline-2 focus-visible:outline-[#3478f6]";

export function MacHeader({ name, initials, photo, avatar, members, onCompose, onVideoCall, onOpenDetails, className, style, ...props }: MacHeaderProps) {
  const m = macHeaderMetrics;
  const fallbackInitials = initials ?? name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? "").join("");
  const group = members && members.length > 1 ? members : null;
  return (
    <header
      data-slot="mac-header"
      className={cn(
        "absolute inset-x-0 top-0 z-10 select-none",
        // Light glass over the white pane (derived from the light composer: white discs with a soft shadow).
        // Light glass, measured: #fcfcfc discs with a white rim and a soft downward shadow; pure black text.
        "[--hd-chevron:#b1b1b1] [--hd-fill-hover:#ffffff] [--hd-fill:#fcfcfc] [--hd-ink:#262626] [--hd-name:#000000] [--hd-pill-rim:inset_0_0_0_1px_#ffffff,0_9px_28px_rgba(0,0,0,0.09)] [--hd-pill:#fdfdfd] [--hd-rim:inset_0_0_0_1px_#ffffff,0_9px_28px_rgba(0,0,0,0.09)] [--hd-tint-40:rgba(251,251,251,0.35)] [--hd-tint-60:rgba(251,251,251,0.53)] [--hd-tint:rgba(251,251,251,0.88)]",
        // Dark glass, measured: fill #1b1c1c over #1e1e1e, rim #373739 fading to #2c2c2c. The pill's rim is
        // lit on one diagonal, the same way the composer's is, and it is **not** brighter at the top.
        // Integrating the rim's excess over the pill fill along the inward normal every 10 degrees around the
        // stadium (pill box: device x 577-683, y 88-144 of conversation-pane-dark.png, so radius 28) gives
        // 3.0 + 54.4 * |cos(angle - 45.5deg)| at 1.5 rms: brightest at the top-left AND the bottom-right,
        // gone at the other two (57 up-left, 45 due left, 7 down-left). The band's width is constant at
        // 1.55 device px and it is the alpha that varies, peaking at #404040 over the fill; a box-shadow can
        // only vary the width, so this is the closest three-shadow stand-in. Scored per pixel over the 928 px
        // within 3 device px of the rim, it halves the error of a uniform ring (mean 3.4 -> 2.4 of 255, worst
        // 28 -> 13), and the two dim caps, which a uniform ring misses by 17, land within 4.
        "dark:[--hd-chevron:#5b5b5b] dark:[--hd-fill-hover:rgba(255,255,255,0.08)] dark:[--hd-fill:rgba(0,0,0,0.08)] dark:[--hd-ink:#dcdcdc] dark:[--hd-name:#f4f4f4] dark:[--hd-pill-rim:inset_0_0_0_0.8px_rgba(255,255,255,0.03),inset_0.75px_0.75px_0_0_rgba(255,255,255,0.1),inset_-0.75px_-0.75px_0_0_rgba(255,255,255,0.1)] dark:[--hd-pill:#1b1b1b] dark:[--hd-rim:inset_0_0_0_0.75px_rgba(255,255,255,0.13)] dark:[--hd-tint-40:rgba(30,30,30,0.34)] dark:[--hd-tint-60:rgba(30,30,30,0.51)] dark:[--hd-tint:rgba(30,30,30,0.85)]",
        className,
      )}
      style={{ height: m.height, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", ...style }}
      {...props}
    >
      {/* Scroll-edge effect. Chromium does not mask backdrop-filter output, so the blur is stacked in steps
          (each layer compounds the ones below it) and the wash is a plain gradient that fades over the same span. */}
      <div aria-hidden="true" data-slot="header-glass" className="pointer-events-none absolute inset-x-0 top-0" style={{ height: m.fadeEnd }}>
        {[0, 1, 2, 3].map(step => (
          <div key={step} className="absolute inset-x-0 top-0" style={{ height: m.fadeEnd - step * ((m.fadeEnd - m.fadeStart) / 4), backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)" }} />
        ))}
        <div className="absolute inset-x-0 top-0" style={{ height: m.fadeEnd, background: `linear-gradient(var(--hd-tint) ${m.fadeStart}px, var(--hd-tint-60) ${m.fadeStart + (m.fadeEnd - m.fadeStart) * 0.3}px, var(--hd-tint-40) ${m.fadeStart + (m.fadeEnd - m.fadeStart) * 0.65}px, transparent ${m.fadeEnd}px)` }} />
      </div>

      <button type="button" data-slot="compose-button" aria-label="New message" onClick={onCompose}
        className={cn(glassButton, "rounded-full")} style={{ left: m.compose.left, top: m.compose.top, width: m.compose.size, height: m.compose.size }}>
        {/* square.and.pencil, drawn in button coordinates so nothing is re-centered. */}
        <svg aria-hidden="true" viewBox="0 0 36 36" width="36" height="36" className="block" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.4 11.6h-5.2a3 3 0 0 0-3 3v7.2a3 3 0 0 0 3 3h7.15a3 3 0 0 0 3-3v-6" strokeWidth="1.35" />
          <path d="M17.5 19.4 25.9 11" />
          <path d="M16.5 20.4l1-1" strokeWidth="0.9" />
          <circle cx="26.9" cy="10" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <div data-slot="header-contact" className="absolute left-1/2 -translate-x-1/2" style={{ top: m.avatar.top, maxWidth: `calc(100% - ${m.maxWidthInset * 2}px)` }}>
        <div className="flex flex-col items-center">
          <span className="relative z-10 flex">
            {avatar ?? (group
              ? <GroupPhoto size={m.avatar.size} members={group} name={name} />
              : <Avatar size={m.avatar.size} initials={fallbackInitials} src={photo} name={name} />)}
          </span>
          {/* The pill sizes to the name: its paddings, the gap and the chevron are fixed, so its width is
              the name's advance plus 28.25 and it grows half each way about the pane's centre. `maxWidth`
              stops it before the video button and truncates instead; the chevron never shrinks, so it
              keeps its 9 to the right edge at every width. */}
          <button type="button" data-slot="name-pill" onClick={onOpenDetails} aria-label={`${name}, show details`}
            className="flex max-w-full items-start bg-[var(--hd-pill)] p-0 shadow-[var(--hd-pill-rim)] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#3478f6]"
            style={{ height: m.pill.height, borderRadius: m.pill.height / 2, marginTop: m.pill.top - m.avatar.top - m.avatar.size, paddingTop: m.pill.textTop - m.pill.top, paddingLeft: m.pill.paddingLeft, paddingRight: m.pill.paddingRight }}>
            <span data-slot="name" className="overflow-hidden text-ellipsis whitespace-nowrap font-bold text-[var(--hd-name)]" style={{ fontSize: m.pill.fontSize, lineHeight: "20px", letterSpacing: 0 }}>{name}</span>
            {/* Chevron, fitted to the dark capture by coverage rather than by a threshold: a round-capped,
                round-joined polyline whose distance field is rasterised at 12×12 samples per device pixel
                and least-squares matched to the ink. The fit lands at 0.008 rms coverage and gives a vertex
                at pane (331.7, 58.25), arms 1.72 across per 3.75 down (0.459, not the 0.413 an earlier
                1.55/3.75 path drew), and ink 3.69 × 9.47 spanning the cap height. The same fit reads 1.97
                for the stroke and reads a drawn 2 as 1.96, so 2 stays.
                Two Chrome quirks, both measured back off the render rather than predicted: it snaps an
                inline SVG's paint origin to a whole CSS px vertically, so the box sits on y 53 and the
                viewBox carries the missing half pixel; and horizontally it paints 0.44 CSS px left of the
                box origin `getBoundingClientRect` reports (328.953), so the path coordinates carry that
                back. The ink therefore laps 0.63 past the box's right edge, which `overflow: visible`
                keeps: the box is the layout slot, not the ink box. Re-measure after any change here. */}
            <svg aria-hidden="true" viewBox="0 -0.5 3.55 10.5" width="3.55" height="10.5" className="block shrink-0" style={{ marginLeft: m.pill.gap, marginTop: 5, overflow: "visible" }} fill="none" stroke="var(--hd-chevron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.471 1 3.179 4.75 1.471 8.5" />
            </svg>
          </button>
        </div>
      </div>

      <button type="button" data-slot="video-button" aria-label={`FaceTime ${name}`} onClick={onVideoCall}
        className={glassButton} style={{ right: m.video.right, top: m.video.top, width: m.video.width, height: m.video.height, borderRadius: m.video.height / 2 }}>
        {/* video: the body's stroke centres measure x 11.05–24.8 and y 11.65–23.95 in button coordinates
            (from the 2x dark capture), and the lens's right edge sits at x 30.1 with arms 1.19 across per down.
            Corner radius 2.3, not 2 and not 2.5: rendering each candidate and comparing the four corner
            quadrants to the capture in coverage space (each image normalised by its own fitted background
            plane, so the content behind the glass cannot bias it) gives rms 0.064 at 2.2, 0.056 at 2.3,
            0.059 at 2.35, 0.087 at 2.5 and 0.125 at 2.65, a parabola with its vertex at 2.30. All four
            corners agree, and the same sweep against the light capture picks the same value. */}
        <svg aria-hidden="true" viewBox="0 0 40 36" width="40" height="36" className="block" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
          <rect x="11.05" y="11.65" width="13.75" height="12.3" rx="2.3" />
          <path d="M24.8 16.4 28.43 13.35c.77-.45 1.67 0 1.67.9v7.1c0 .9-.9 1.35-1.67.9L24.8 19.2" />
        </svg>
      </button>
    </header>
  );
}
