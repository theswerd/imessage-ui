# Native measurement spec

Every number here was measured from native captures on 2026-09-08:

- **iOS 26.0** (23A343) in the Xcode Simulator, iPhone 17 Pro, 402×874 pt @3x. Captured with `xcrun simctl io screenshot`. The simulator can only send SMS-green bubbles; the two sample conversations (+1 (888) 555-1212 "JA" and +1 (555) 564-8583 "KB") mirror each other, so anything sent in one appears as an **incoming gray bubble** in the other (with others' tapbacks and the unknown-sender spam banner). Bubble *colors* for iMessage blue come from macOS and known system values, and are cross-checked below.
- **macOS 26.5.2** (25F84) Messages 26.0, window 960×640 pt @2x, captured with `screencapture`. Accent color set to Blue for the captures.

Units are points unless stated. Fractions come from the 3x/2x pixel grid; reproduce them exactly in CSS px (1 pt = 1 CSS px).

## iOS

### Conversation view chrome

| Element | Measurement |
|---|---|
| Screen | 402 × 874, status bar 0–54 (time at x≈75, y≈33; Dynamic Island 138–263 × 14–50.67) |
| Nav bar | Liquid Glass. Back button: 44pt circle centered (38, 84). Avatar circle Ø 60 (y 171–231 at 3x → 57–77pt), initials 28pt semibold white (cap 19.67). Name pill top y 118.33, height 30, text 17pt bold (Chrome weight 700 matches its ink) + chevron `›` gray. Capsules use continuous corners (superellipse n≈2.2) |
| Message list | Content starts below the nav. The number that anchors the column is the first bubble's body top at **y 205.00 exactly** (device row 615 at 3x, reproducing bit-identically in `conv3-light.png`, `conv4-light.png`, `grouped-light.png`, `sent-1-light.png` and `conv2-dark.png`); the opening date header's two ink runs are 175.0-181.9 and 187.0-194.7. `listTop` 169.5 plus a 35.594 header block lands on it. Bubbles inset 16 from the screen edge on their own side |
| Composer | `+` button: Ø40 glass circle centered (48, 826). Field: x 80–374, y 806–846 (40 tall, radius 20, grows 20 per extra line up to 8 lines), placeholder "iMessage" 17pt gray at x 97, mic icon at x≈353. Send button appears inside the field on the right when text exists: a 38×28 pill, #0088ff, centered (348.67, 826) with a white up-arrow; gray when disabled (no recipient) |
| Home indicator | none in simulator captures (gesture bar hidden) |

### Bubble geometry (17pt SF Pro text)

| Property | Value |
|---|---|
| Font | 17pt system (SF Pro Text), regular, white on colored bubbles. Web `-apple-system` at 17px with `letter-spacing: 0` reproduces native advances (28×"a" = 252.55 both) |
| Line height | 20.0 (4 lines = 80) |
| Vertical padding | 10 top and bottom (single line bubble = 40 tall, two lines = 60, four = 100) |
| Horizontal padding | 13.85 (native fits 28 "a" glyphs = 252.55 in the widest bubble; "Ok" bubble = 49.2 wide) |
| Min bubble width | 48 (text centered inside when narrower, e.g. "V") |
| Max bubble width | 280.5 at 402pt screen (i.e. the far edge sits ≈105.5 from the opposite screen edge) |
| Corner radius | **20.0107**. Tracing the first bubble's top-right corner in `conv3-light.png` — the sub-pixel x where fill coverage crosses 0.5, row by row for 69 rows — and least-squares fitting a circle gives r 20.010 at 0.197 rms; `-[CKUIBehaviorPhone balloonCornerRadius]` is 20.0107 and `CKUIBehaviorMac` inherits it. The ≈19 recorded here before fits the same trace at 0.526 rms, two and a half times worse, and moving to 20.0107 took `conv3-light` 1.57% → 1.55%, `conv2-dark` 0.77% → 0.75% and `grouped-light` 0.74% → 0.72%. The corner is very slightly more than circular — a superellipse fit lands at r 20.96, n 2.14 (CSS `superellipse(1.10)`) for 0.142 rms, and the measured edge is still 0.18 out at 20 below the top where every circle has closed — but adding `corner-shape` moves the diff by at most 0.02 points (1.562% → 1.544% at `superellipse(1.05)`, worse above 1.1), so the bubble stays on a plain circle |
| Tail | hangs 6.8 below the body, replaces the bottom corner on the sender side. Contour in `bubble-tail.json` (points relative to the body's bottom-right corner). Body right edge starts sweeping inward 19.2 above the body bottom. Neck at (−10.5, +0.4), max bulge (−8.3, +5.5), tip ≈ (−9.3, +6.8), underside meets the body bottom at (−21.7, 0) |
| Group spacing | **4.3333** between bubbles of the same cluster (confirmed three times over, feasible range 4.318-4.383); **10.2** between clusters, not 10.33 (feasible range 10.168-10.25). Native rounds each row origin to the device grid, so one fractional value has to satisfy all seven rows at once, and 10.33 cannot produce the 50.000 pt step between the third "V" and the long bubble. Body bottom to next body top; tails do not take space |
| Grouping rule | consecutive same-sender messages within ~60 s form a cluster; only the last bubble of a cluster has a tail. **Same rule on macOS** (verified in a real conversation; a self-chat renders tails on every single-line bubble because each self-message is mirrored as a hidden incoming copy, so do not measure clustering there) |
| Status label | "Delivered"/"Read …" 11pt semibold (ink 49.67 × 8.33; in Chrome 11px/600 needs `letter-spacing: -0.25px` to match), color #8a8a8e, ink right edge at 365 (20.3 in from the bubble body's right edge 385.3), ink top **8.08** below the body bottom (7.85 if native's two-line body is the 60.2 a coverage estimator reads). We render 7.11 and cannot close it: Chrome rounds this text baseline to whole CSS px, so `statusGap` 4.65, 5.0, 5.2 and 5.4 all land the label on the same device row and 5.65 jumps it three rows the wrong way |
| Date header | centered, two lines at the top of a conversation: service name ("iMessage", weight 500) then "Today 1:25 AM" ("Today" weight 500, time regular, narrow no-break space before AM), 11pt with a 14pt pitch, #8a8a8e; first bubble top 7.6 below. **Mid-list** headers (after a gap over an hour) are one line only: ink top 11.33 below the previous body bottom, ink bottom 8.0 above the next bubble (`dateheader-mid-light.png`) |
| Bubble width | bubbles hug their longest wrapped line ("It's all in the little details…" is 268.2 wide, not the 280.5 maximum, which only an unbreakable string reaches) |

### iOS colors

| Token | Light | Dark |
|---|---|---|
| SMS green bubble | #4bde70 top → #49db6e bottom (near-flat) | same gradient (the green does not change with the theme) |
| Incoming bubble | #e9e9eb, text #000000 | #262629, text #ffffff |
| Screen background | #ffffff | #000000 |
| Secondary label (Delivered, date, spam notice) | #8a8a8e | #8d8d93 |
| Others' tapback balloon | #e9e9eb | #262629 |
| Composer field fill | #ffffff (glass, soft shadow) | #191919, placeholder #5d5d5d |
| Name pill | #ffffff glass, text #000 | #191919, text #f4f3f4 |
| Link buttons ("Report Spam") | #0088ff on #e9e9eb | #0091ff on #262629 |

Incoming bubbles mirror outgoing ones exactly: body left edge at x 16, the tail on the bottom-left (`incoming-light.png`: "Hi there" body 88×40 at (16, 662.67), tail tip ≈ 9.3 in from the left edge, 6.8 below the body).

### Long-press (tapback) state

- Background: one dim overlay ≈ rgba(22,18,44,0.21) in both themes (white → #ceced2, black → #050409) plus blur. Glass surfaces show the content brighter than the dimmed layer (fit: rgba(229,229,231,0.69) + blur 9 / brightness 1.32 / saturate 1.35).
- The pressed bubble is **lifted**: "Ok" grows 49.6×40.3 → 57×45.5 (≈1.15×1.13 about its trailing edge, nudged up 0.55) while its text grows only ≈1.06; wider bubbles scale less (≈1.10).
- Tapback bar: glass pill **64.33 tall** (radius 32.17), bottom edge 4.67 above the lifted bubble, spanning from x 10.83 to the bubble's trailing edge; items ♥ 👍 👎 HAHA ‼ ? then recent emoji (😂 ❤️ …), horizontally scrollable. The same 64 in the selected state.
- Emoji-picker "thought bubble" (Ø44 blob with two trailing circles, smiley inside) centred 14.67 below the pill and 6 beside the bubble, on the side away from the screen edge.
- Context menu 17 below the bubble: x 136–386, 188 tall (10 + 4×42 + 10): Copy, Translate, Select, More… with SF Symbols. Its "tint" is the bubble behind it seen through the glass plus a faint wash, not a painted gradient.
- Applying a tapback shifts the bubble down **28** (balloon Ø34; own-reaction blue #0088ff in both themes).
- Captures: `references/ios/captures/longpress-light.png` (mid-animation), `longpress-light-settled.png` (settled), `longpress-dark.png`, `longpress-ok-light.png`, `longpress-incoming-light.png`.

### Conversation list

- Large title "Messages" 34pt bold at x 16, baseline ≈ y 152.
- Rows: avatar Ø 45 at x 26–71, name 17pt semibold at x 83, time 15pt gray (narrow no-break space before AM) right-aligned before a chevron at x≈380, preview 15pt gray (up to 2 lines). Row pitch 86.67. Separator inset to x 83.
- Bottom: glass search pill x 28–314 y 798–846 ("Search" 17pt weight 500 gray, mic icon), compose button Ø48 centered (350, 822).
- Glass: one soft shadow per glass group (capsules 0 6 36 spread 4 at 6.5%; Ø40–48 circles 0 5 20 spread 6 at 5.5%), fill rgba(255,255,255,0.9) light / rgba(28,28,28,0.9) dark with backdrop blur, dark rim inset 1px rgba(255,255,255,0.09).

### Bubble fill is a screen-space gradient (iOS and macOS)

Bubble color depends on where the bubble sits on screen, not on the bubble itself: bubbles lower on the screen are darker, and the color shifts while scrolling (verified on macOS: the same bubble measured #4c95f7 at window y 290 and #5597f7 after scrolling to y 95). Measured SMS green at bubble top y (pt) → color: 205→#4bde70, 275→#48da6c, 320→#47d96b, 364→#45d76a, 414→#42d466, 525→#3ed163, 569→#3dcf61. Linear fit: rgb(83,230,120) at y=0 → rgb(49,195,85) at y=874. Re-confirmed on a single 412 pt tall bubble (`grad1`, y 265–679): sampling it every 37 pt gives rgb(73,220,110) at y 267 falling to rgb(58,204,95) at y 677, which extrapolates to rgb(83,230,120) at y 0 and rgb(51,196,88) at y 874. The gradient spans the screen exactly, and one bubble is enough to see the whole ramp. Implement as one gradient in screen coordinates and position it per bubble (`background-size: 100% <screen height>; background-position: 0 -<bubble top>`), updated on scroll.

### iOS send animation (60 fps capture, `references/ios/motion/`)

**Frame indexing and t=0.** `ffmpeg -i send-60fps.mp4 -vsync 0 -start_number 0 f%03d.png` gives 299 frames
at 60 fps, 0-based, so **t = (f − 73) / 60 s**. f68–f72 differ by at most 2 in any channel and each paints
the blue send button (3321 px with B − R > 80 in an 80 × 65 px box over it); f73 differs from f72 in 50289
px and has 0 such blue pixels, and already shows the tinted rect. So f72 is the last composer frame and
**f73 is t = 0**. f83 duplicates f82 (max channel delta 6 over 18 px) and is the only frame the recording
drops inside the flight, so 167 ms repeats 150 ms. The two contact sheets in this folder are
**1-based on the same clip** — their "f74" is this table's f73 — and the times this section used to carry
were read from f71, **two frames (33 ms) early**; every row below is the re-measured one. Geometry is
sub-pixel: greenness `G − (R+B)/2`, normalised per frame, crossed at 0.5 along each row and column, then
halved to points.

| Time (frame) | What happens |
|---|---|
| 0 ms (f73) | Return has been pressed. In this **one frame** the field's text row is *already* a tinted green rounded rect with a tail, over exactly the text box (x 81.6–373.8, y 810.8–857.7 = 292.2 × 46.9), the send button is *already* gone, and the placeholder "iMessage" is *already* at full strength — it does not fade in. (Its darkest glyph luma is 170.5 here and 175.9 once the rect has passed, over backgrounds of 232.6 and 253.0; measured in luma because 4:2:0 chroma bleed makes the green channel read ~30% light over the rect.) White tint over the green is 0.40, decaying to 0 by 183 ms |
| 17 ms (f74) | Still full width (294.2 pt). The collapse has **not** started; it starts between 17 and 33 ms |
| 17–183 ms | The rect collapses toward the field's right end, as an S-curve, not linearly. Widths, pt: 292.2 (f73), 294.2 (f74), 271.6 (f75), 251.7 (f76), 225.8 (f77), 194.7 (f78), 154.0 (f79), 123.0 (f80), 98.0 (f81), 81.7 (f82), **67.9 at 183 ms (f84)** — 0.772 of the settled 88.0, i.e. squash 0.228, not 0.167. f77–f79 show two shapes: the pale tinted rect still at the field's y and a saturated bubble above it; they coincide from f80 (117 ms) |
| 33–70 ms | The message text fades in inside the rect (invisible at f74, ~15% at f75, ~52% at f76, full at f77) |
| 33–690 ms | The bubble travels to its slot on a from-rest spring. Fitting the body's bottom edge over f84–f133 with the amplitude pinned to the geometric travel (127.1 pt) gives **release 33 ms, damping 0.73, 11.9 rad/s** (0.28 pt rms, 0.77 pt worst over 50 frames). The old damping 0.8 / 15 rad/s released at 103 ms misses by 9.6 pt rms and 35 pt worst. With the amplitude left free the same data reads release ≈ 47 ms, damping 0.71, 12.1 rad/s — the release time trades against the amplitude, the spring constants do not |
| 183–500 ms | Scale recovers 0.772 → 1.0 on a second, slower from-rest spring, fitted over f84–f125 as released at 193 ms (a frame past the 183 ms minimum) with damping 0.80 and 13.1 rad/s, 0.002 rms. No overshoot in scale: the 1.004 peak at 500 ms is within measurement noise |
| 417–690 ms | **There is a visible overshoot.** The tail corner passes 5.0 pt above its slot at 417 ms (f98, bottom 728.9 vs 733.9) and falls back; the body's top is 4.1 pt high at 433–450 ms. Inside 0.25 pt of rest at 633 ms (f111), settled at ~690 ms (f114). Body tops: 760.8 at 150 ms, 740.8 at 183, 717.6 at 233, 691.8 at 317, 686.9 at 350, resting 686.8 |
| 1017 ms (f134) | "Delivered" moves off the bubble above, and the new bubble's slot rises 15 pt (686.8 → 671.75) over f134–f147. The list itself does not scroll — the bubble above stays at y 601–669 the whole time |

`messageMotion.send` models the collapse as one linear lerp, so its `shrink` is 150 ms, not the 183 ms the
recording takes: the clone cannot hold a scale above 1, and the rect's scale only crosses 1 at ~140 ms, so
150 is the earliest hand-over the model can express and also the value that tracks the rect best (2.6 pt
rms over the whole flight against 10.1 for the old constants). Through 33–83 ms the model's left edge still
trails the recording by up to 14 pt because a linear lerp cannot follow an S-curve; from 183 ms on it is
inside 2 pt on every edge.

### iOS long-press

- Long press threshold ≈ 500 ms; the bubble does not move. Background dims and blurs. Tapback bar appears above the bubble, context menu below, emoji picker bubble beside the bubble (on the side away from the screen edge).
- Re-opening on a message that already has a tapback shows the chosen tapback highlighted (blue circle) in the bar and a "tapback details" popover (heart + reactor avatar) at the top. Capture: `longpress-ok-selected-dark.png`.
- Applying a tapback: the balloon (Ø 34 blue circle for your own reaction, gray for others) sits on the bubble's top corner on the side away from the screen edge, with two trailing circles (Ø ≈ 10 and Ø ≈ 5) pointing away from the bubble; the bubble shifts down to make room. Capture: `tapback-love-light.png`.

### iOS "Send with effect" (`effects-picker-light.png`, `effects-slam-light.png`, `effects-loud-light.png`, `effects-ink-light.png`, `effects-screen-light.png`, `effects-screen-spotlight-light.png`, `effects-picker-dark.png`, `effects-slam-dark.png`)

Press and hold the send button and the conversation freezes and blurs behind a full-screen sheet. It is
not a list. The status bar stays crisp above it.

| Part | Measurement |
|---|---|
| Title | "Send with effect", 22pt, cap top y 96, baseline 112, ink x 124.67–277, centred on x 201 |
| Segmented control | track x 81–321, y 132–164 (240 × 32, radius 16); selected pill inset 2 all round (116 × 28); labels 13pt, cap top 143, selected semibold (ink 41.67 for "Bubble"), unselected regular (ink 40.33 for "Screen") |
| Rail | white, x 321.75, y 572, 53.75 × 214.67, continuous corner radius 23 (a circle fits to 0.27 pt, a `superellipse(1.14)` corner to 0.14) |
| Rows | 4, pitch 57, first centre y 593.67; dot Ø 9 at x 348.5, #999999 |
| Row labels | 11.33pt regular, right ink edge 298.33, cap height 8.33, centred on the row; rgba(60,60,67,0.75) |
| Chosen row | the dot becomes a 38 × 28 #0088ff pill (radius 14) centred on the row, white arrow 13 × 15.67 with a 2pt stroke |
| Unselected labels once something is chosen | the same colour at 0.44 opacity, and any label the preview covers is simply behind it |
| Caption | "SEND WITH &lt;NAME&gt;", same style as a row label, right ink 298.33, baseline 8.67 above the preview's top |
| Close button | 38 × 28 #808080 pill centred (348.5, 825.83), white cross 13.67 square, 2pt stroke; same size as the send pill in both themes |
| Preview at rest | right edge 301.33, top 792 (it runs off the bottom of the screen) |
| Preview once chosen | right edge 315.67, top = row centre − 17.33, never below a bottom of 827.33 (row 4 would otherwise reach 834.34 and sits at 827.33) |
| Preview fill | flat #0088ff, *not* the conversation's screen-space gradient: the same bubble measures (0, 136, 255) at y 578 and again at y 871 |
| Invisible Ink preview | the bubble stays #0088ff and only the text dissolves into bright specks |
| Screen tab | the rail disappears; preview right edge 301.33, top 731; the send pill moves to (348.5, 765.83) above the close button; swiping left pages Echo → Spotlight → Balloons…, with no page dots |
| Screen tab caption | 11pt (not 11.33) with a right ink edge of 294.67 (not 298.33). Three different captions measure the same offset, and a second capture minutes later reproduces it, so it is the design, not a mid-animation frame |

Dark: backdrop resolves to rgb(8,9,10) over a black conversation; title and labels rgba(255,255,255,0.8);
segment track rgba(120,120,128,0.24) with a #636366 selected pill and white labels; the rail is
translucent (rgba(255,255,255,0.14)) rather than the opaque white it is in light, and the dot
rgba(255,255,255,0.24) over it; the close button stays #808080.

**Eight screen effects, not nine.** The Screen tab pages through them and shows one dot per effect
under the preview: **eight dots**, 7.67 across, 17.62 apart, the first centred at x 139.17 and all on
y 807, the current one at full strength and the rest at the same reduced opacity an unchosen row label
uses. Swiping past the eighth goes nowhere. In order: Echo, Spotlight, Balloons, Confetti, Love,
Lasers, Fireworks, Celebration. Shooting Star, which earlier releases had, is gone.

**The labels are vibrant, and ours are not.** Every gray on this screen (the row labels, the caption,
the page dots) picks up the hue of whatever is blurred behind it: over a green SMS conversation the
caption renders green, not gray. A flat `rgba()` cannot do that. Over the neutral backdrop the
captures were measured on, the flat colour matches to within a device pixel, so that is what the kit
uses; over a strongly coloured conversation it will read too neutral. The blend was not identified:
multiply fits the neutral samples and not the green one, colour-burn fits one green sample and not the
neutral ones, and the glyph cores of 11pt text at 3x are too thin to settle it.

**Bubble effect motion** is measured, in `references/ios/motion/effects.md`: Slam 640 ms from about 8x
down through a 0.92 squash to a 1.07 rebound, Loud 1230 ms up to a 2.35x swell with a shake, Gentle
about 3000 ms from 0.38 with a long relax, and Invisible Ink with no motion at all.

### iOS extra states (captures in `references/ios/captures/`)

- **Swipe to reveal times** (`swipe-timestamps-light.png`): dragging the list left shifts every bubble left by ≈58 pt and reveals a per-message time ("1:25 AM", 11pt, secondary gray) right-aligned at x≈386, vertically centered on each bubble. Releasing springs back.
- **Plus menu** (`plus-menu-open-light.png`): tapping `+` opens a glass sheet anchored at the bottom-left (x 8–330, from y≈372 to the composer) listing Camera, Photos, Stickers, Apple Cash, Audio, #images, Check In… with 44pt app icons at x 40 and 22pt labels; the background blurs; the composer collapses to a mic-only field and the `+` hides.
- **Details** (`details-light.png`): tapping the name pill pushes a details screen over a blurred backdrop: avatar Ø80 centered at (201, 103), name 26pt bold, three round glass buttons (call, video, mail) Ø52 at x 127/201/274 y 222, grouped cells (radius 24, x 16–386): phone with a "RECENT" tag, "Create New Contact"/"Add to Existing Contact" (blue), "Hide Alerts" with a switch, "Block Contact" (red).
- **Mirrored incoming conversation** (`incoming-light.png`, `incoming-dark.png`, `photo-picker-light.png`): incoming bubbles sit 16 from the left edge with black (light) / white (dark) text; a tapback by the other party is a light gray balloon at the bubble's top-right; an unknown sender shows the centered 12pt notice "If you did not expect this message from an unknown sender, it may be spam." and a "Report Spam" pill button above the composer. The Photos picker opens as an embedded 3-column grid (tiles ≈ 126 pt, 4 pt gaps, radius 12) under the composer.
- **Long press on an incoming bubble** (`longpress-incoming-light.png`): everything mirrors: the tapback bar starts at x 16, the emoji-picker bubble sits to the right of the message, the context menu is left-aligned (x 16–266) and tinted with the incoming gray at its top.
- **Long press on a two-line bubble** (`longpress-two-line-light.png`): the tapback bar overlaps the message above; the context menu is right-aligned under the bubble; the bubble itself is nudged up so both fit.

### macOS extra states (captures in `references/macos/captures/`)

- **Plus menu** (`plus-menu-dark-2x.png`, `plus-menu-light-2x.png`): a popover at pane (9, 626), 175×214, radius 12, flush with the `+` button's left edge and overlapping its bottom 3pt; 1pt bright inset rim (#61696e dark / #f8fcfe light) plus a 0.5pt dark outline; fill ≈#252728 dark / ≈#edeff0 light. 5pt padding, six 34pt rows: Ø20 icon at x 20, 13pt untracked label at x 50 (#dddddd dark / #242424 light): Photos, Stickers, Genmoji, Image Playground, #images, Message Effects. No arrow.
- **No hover state** on sidebar rows or bubbles.
- **Scroll-edge fade**: the header washes the content under it toward the pane colour at full strength down
  to ≈50, then releases it by ≈90–96. Measured two ways and they agree. Over the *empty* pane of
  `conversation-pane-light.png` (column pane x 220, clear of the pill's shadow) the wash darkens white to
  252/255 down to y 50.5, then 253 to 70.5, 254 to 89.5, and 255 from 89.5 — so the wash itself is 3/255
  dark over white, not a neutral white, and its alpha is 1 to 50.5 and 0 by ≈90. Over the bubbles of
  `conversation-pane-dark-2.png` the same alpha solves out of the blue channel (the unwashed bubble colour
  comes from the screen-space gradient) as ≈0.83 at y 32, 0.15 at y 88 and 0.11 at y 92, reaching 0 by
  y ≈105. In dark the wash is ≈1/255 *lighter* than the #1e1e1e pane, so an empty dark pane barely shows it.
- **Attachment card and failed send** (`attachment-not-delivered-dark-2x.png`): a file message renders as a 275×93.5 card (radius ≈ 18, fill #3b3b3d dark) with a 44×56 document icon at x 20, the filename 13pt semibold and "Text Document · 275 bytes" 11pt gray. A message that failed to send shows a red (!) badge (Ø 18, #eb534e) to the right of the bubble and "Not Delivered" (11pt, #eb534e) under it where "Delivered" would be; the sidebar preview reads "Message Send Failure".
- **Applying a tapback** (`tapback-love-dark-2x.png`, `tapback-love-light-2x.png`, `tapback-balloon-dark-4x.png`, `tapback-apply-frames-100-123.png`). The settled balloon and the frame-by-frame motion are both measured; see "macOS tapback balloon" and "macOS tapback motion" below. The sidebar preview becomes "You loved “…”".
- **Selected message** (no capture; read out of ChatKit 26.5 on macOS 26.5). A single click selects one
  bubble and deselects the rest; cmd toggles, shift extends, a click elsewhere in the pane clears,
  Escape clears, and a right click selects before opening the menu.
  `-[CKTextBalloonView setSelected:withSelectionState:]` turns on a highlight overlay layer on the
  balloon, coloured by `-[CKUIThemeMac balloonOverlayColorForColorType:]`. The layer is the balloon's
  own shape, body and tail, with no inset and no row background. Blue and gray are opaque, so a
  selected bubble loses its screen-space gradient. Colours are in the macOS colour table.


## macOS (960×640 window @2x)

### Chrome

| Element | Measurement |
|---|---|
| Sidebar | **A floating panel, not a column.** It occupies window x 8–328 (320 wide) and y 8–632, i.e. inset 8 from the window's left, top and bottom, with a continuous corner (a circle of radius 17.75 fits the dark rim to ≈1 px; `border-radius: 22px; corner-shape: superellipse(1.4)` matches it to 1 device px), a 1 pt bright rim (light #ffffff, dark #424242 blending to #323232) and a soft shadow that darkens the window ground beside it (light: #f8f8f8 at x 0 → #f4f4f4 at x 8) and the pane behind it (#f3f3f3 at x 328 fading out by x 350). Panel fill light #fafafa / dark #1b1b1b; window ground around it light #f8f8f8 / dark #1c1c1c. There is **no divider line**. Traffic lights Ø 14 centred (26, 26), (49, 26), (72, 26) (saturation bbox at four thresholds returns image x 38-65 / 84-111 / 130-157 and y 38-65 every time; an earlier 25.75 reading was a threshold artefact). List-options icon: three centred bars 16.5 / 12.5 / 9.5 wide × 1.25 thick, 4.1 apart, centred (306, 25.85), #232323 light / #dddddd dark (not a circled glyph). Search field x 18–318, y 52–88 (300 × 36, a **capsule**: a radius-18 circle fits the corner to 0.4 px, radius 10 misses by 10), fill #eeeeee / #1e1e1e, no border. Magnifier ink box 12.5 square at (32.5, 63.5). Placeholder "Search" 13pt (ink 41.0–42.0 wide; 13px/500 = 41.55 in Chrome, 13px/400 = 40.49), ink left 53.5, baseline 74.75, #777777 / #9a9a9a |
| Pinned row | Ø 72 avatar centred (168, 142) — the panel's centre, not the 330 column's. Label 11pt regular, secondary gray (#6e6e6d / #a4a4a4), baseline 195.75, centred ("Freestyle" ink 47.0 wide = 11px/400 in Chrome). The list starts at y 215 |
| Conversation rows | Row pitch **80.5** (separators at y 375.5, 456, 536.5), x 18–318, first row top 215. Selected row: full row height, fill #3478f6, continuous corner (circular fit ≈ 8; `border-radius: 10px; corner-shape: superellipse(1.4)` matches the capture to 1 device px). Avatar Ø 40 at x 36–76 (centre 56), centred on the row. Name **13pt semibold** at x 82, baseline 28.75 into the row (a 13-character name measures 88.0 of ink and a 5-character one 30.0, which is 13px/600; light #000 / dark #f4f4f4, white when selected). Time **12pt** regular on the same baseline, ink right edge 307.25 ("Yesterday" ink 54.75 = 12px/400). Preview **12pt** regular, baseline 45.0, line pitch 15, up to 2 lines, same gray as the time (#6e6e6d / #a4a4a4; #d6e4fd when selected). Separator 1 pt #e1e1e1 / #3a3a3a from x 82 to **306** at the row's bottom, between unselected rows. Muted rows show a bell.slash.fill, ink ≈ 9.5 square with its right edge at 305 and its top 37 into the row, #aeaeae / #5b5b5b (lighter than the preview gray) |
| Sidebar footer | A bar across the panel's bottom: y 583–632 (49 tall, following the panel's bottom corners), 1 pt hairline #d0d2d7 / #43454a along its top, fill a vertical ramp #e4e6eb → #eff0f2 light / #27292e → #27272a dark, the list scrolling under it. "Syncing with iCloud Paused" **10pt** (ink 132.5 wide = 10px/400), centred on x 168, baseline 610.75, in the **primary** label colour (#000000 / #f5f5f5), only when applicable |
| Sidebar captures | **No committed capture shows the sidebar**, and none can: `conversation-pane-*.png` are crops of window x 330–960 precisely because the column to their left is a real conversation list. The numbers above were measured from full-window 960×640 @2x frames of the same session that are held outside the repo and are not reproducible from anything here. Treat every sidebar number as measured but uncheckable, and re-derive it from a fixture window before changing it. The two coordinate systems line up: the pane crop's first column is image x 660 = window x 330 |
| Header | 55 tall (nothing in a capture draws that edge; the number is the toolbar's layout height, not a measured one). **Compose button**: the white light rim fills device columns 13–14 / 84–85 and rows 16–17 / 86–87 of the pane crop, i.e. a 36.5 × 36 glass shape at window x 336.5–373, y 8–44 (centre 354.75, 26); "square.and.pencil" ink 17.5–33.5 in the pane's own coordinates, stroke ≈1.3. **Contact avatar** Ø 40 at y 8–48, centred (645, 28). **Name pill** below it, centred (645, 57.95): 52.6 × 27.1 (y 44.4–71.5), so its top 3.6 hides behind the avatar. Its caps are **circular** — fitting a superellipse to 34 rim points of `conversation-pane-dark.png` returns exponent s = 2.01 at 0.45 device px rms, against 0.93 rms for `superellipse(1.4)` (s = 2.639); the same fit on a Chrome render of `superellipse(1.4)` returns 2.64, so the fit does tell them apart. Fill #fdfdfd / #1b1b1b, rim 1 pt #ffffff light / dark a band of constant 1.55 device px width whose alpha varies around the stadium, its coverage integral fitting 3.0 + 54.4·|cos(θ − 45.5°)| at 1.5 rms over 31 angles, so it is brightest at the top-left AND the bottom-right (#404040 over the fill) and nearly gone at the other two caps. A box-shadow can only vary width, not alpha, so the closest reachable is a faint uniform ring plus an opposed pair, light shadow ≈8/255 just below the pill fading out ≈25 below it. Name **13pt bold** (not 15 semibold): "Ben" ink 601–646 px of the crop, cap top 53.5, baseline 63, cap height 9.5; 13px/700 `-apple-system` in Chrome reproduces that ink exactly. Text ink starts 11.8 in from the pill's left edge; the `›` chevron ink is 3.55 × 9.5 spanning exactly the cap height, stroke 2 (a rasterised polyline fit reads 1.97 on the capture and 1.96 on our own drawn 2), vertex at pane (331.695, 58.25), arms **1.721 across per 3.75 down** (slope 0.459, fitted at 0.0077 rms). Chrome paints an inline SVG's ink 0.437 CSS px left of where its box origin predicts, so calibrate on differences of fits rather than on predicted positions, ink left 329.05 (4.7 after the text box) and 8.7 before the pill's right edge; #b1b1b1 / #5b5b5b. **Video button** 40 × 36 stadium (radius 18: the cap fits a circle to 0.2 pt over 18 traced points) at window x 912–952, y 8–44. Its glyph is a 13.75 × 12.3 rounded rect (corner radius **2.3**, stroke ≈1.12 measured from the rim's coverage; a rendered sweep compared in coverage space over the four corner quadrants is a parabola with its vertex at 2.296, giving rms 0.0555 at 2.3 against 0.0865 at 2.5 and 0.125 at 2.65, and an independent sweep against the light capture puts the vertex in the same place) whose stroke centres sit at pane (11.05, 11.65) inside the button, plus a lens whose right edge is at pane x 30.1 and whose arms run 1.19 across per 1 down; total ink 592.5–612.65 × 18.9–32.5, #262626 / #dcdddf. The list scrolls under the header (translucent). |
| Composer | Field x 379–909 (530 wide), 31 tall, radius 15.5 (a pill; its ends sit within 0.35 of a circle), top y 598 and bottom y 629, so it is centered on y 613.5. Fill light #ffffff / dark #232323. `+` button Ø 30 at x 339–369 and emoji button Ø 30 at x 919–949, both 30 tall and bottom-aligned with the field (y 599–629), so their centers are y 614. Placeholder "Message" 13pt, ink from x 394.35; typed text ink from x 391.9, cap top 10.75 below the field top. Caret x 390.75–392.25, 15 tall, #3b86f7 light / #3f8ff7 dark. Audio waveform glyph inside the field, centered (889.5, 613.5), hidden while text exists. **No send button**: the typed capture shows nothing between the text and the field's right rim, and nothing between the field and the emoji button. Return sends |
| Pane | background light #ffffff / dark #1e1e1e. Bubbles inset 20 from the pane's right edge: in the 630 × 640 pane crops the body's right edge measures 609.8–610.0 (`conversation-pane-light.png`, one-line bubble at pane y 160–162.5). The left inset is assumed to be the same 20; every macOS capture is a self chat, so no incoming bubble exists to measure it |
| Pane, vertically | the log rests against the composer, not under the header: with a short conversation the last row still sits at the bottom (`conversation-pane-light-partial.png`). The composer field's top edge is at pane y 598.0 (640-tall pane) and the log's content box stops 15.2 above it, so the log reserves 57.2 at the bottom. Nothing measures the top inset: both full pane captures are scrolled to the end and the short one rests at the bottom |

### Bubbles (13pt system text)

| Property | Value |
|---|---|
| Font | 13pt system with native tracking: web 13px + `letter-spacing: -0.4px` matches both the cap height (17.5–18.1 px at 2x) and the widths ("Hey! How's the new project going?" native ink 194.0); line pitch 15 (cap tops 424/439/454 on a 3-line bubble) |
| Body height | 28.76 for one line, 58.10 for three → vertical padding 7.03 |
| Horizontal padding | 12.5, checked through the bubble widths rather than the ink. The four one-line bubbles of `conversation-pane-light.png` measure 195.0 / 105.47 / 150.47 / 158.5 wide (arc-corrected at the pill's widest row; the same four in `conversation-pane-dark-2.png` give 195.0 / 105.47 / 150.47) and the kit renders 195.28 / 106.97 / 150.36 / 158.34. Three agree within 0.16. "Second of two" is 1.5 too wide, and all of it is on the leading edge — the trailing edge and the text's right edge line up — so it is that string's advance in Chrome, not the padding |
| Corner radius | 14. Circle fit on the four-line bubble of `conversation-pane-light.png` (body 227.40–609.80 × 493.98–566.85): top-left 14.00, top-right 13.90, bottom-left 13.90, each at 0.14–0.15 rmse over 28 sub-pixel edge samples. One-liners are therefore near-pills: the "Ok" bubble in `bubble-tails-4x.png` (body 40.00 × 28.80, so 14.40 is its own half-height) follows a 14.40 arc to within 0.03 from 18 above its bottom down to 4 above it |
| Tail | only the last bubble of a cluster (see iOS rule). Traced from the four-line bubble of `conversation-pane-light.png` (body right edge 609.80, body bottom 566.85) and reproduced by the two-line bubble in the same capture to 0.05; x is measured in from the body's right edge, y down from the body's bottom. The straight edge starts bending ≈19 above the bottom: −0.04 at y −18.6, −0.19 at −15.6, −0.35 at −13.6, −0.80 at −10.6, −1.78 at −7.6, −3.93 at −4.6, −6.12 at −2.6. Neck (−7.46, +0.40). The lobe reaches back out to (−5.94, +4.40) and its lowest point is (−6.55, **+4.85**), so the tail hangs 4.85. The underside runs from there back to ≈(−15.1, 0), so the whole tail sits in a 15.1 × 19 box plus the hang |
| Tail vs the iOS tail | **not a uniform 0.70 scale of it.** From the neck down it is: neck x 7.46 vs iOS 10.51 (0.709), hang 4.85 vs 6.80 (0.713), lobe outer edge −5.94 vs −8.32 (0.714), underside 15.1 vs 22 (0.69). The entry is not scaled at all — it leaves the body ≈19 above the bottom on both platforms, where 0.70 would put it at 13.4. On a **one-line** bubble that difference is invisible, because the body is a 14.4 pill whose own arc runs where the long sweep would: `bubble-tails-4x.png` matches the kit's 0.70 tail to ≤0.14 everywhere. On two lines and up the kit's sweep starts 5.6 too low and its outline runs up to **0.42** outside native between y −13 and −10, tapering to 0.05 by −5. Below the neck the kit is 0.10–0.28 shy (bulge worst at y +2.4); `tailScale` 0.71 would take that to ≤0.10 but widen the box to 15.6 against a measured 15.1–15.4. A fixed tail box cannot have both entries: raising it to 19 would make a one-line bubble's tail stand ≈0.5 proud of the pill |
| Group spacing | 3 between bubbles in a cluster, body bottom to next body top: 3.24 / 2.93 / 3.49 / 2.74 measured in `conversation-pane-light.png`, `-dark.png`, `-dark-2.png` and `-light-partial.png`. 11.5 between clusters (measured from the fixture chat; none of the four pane captures contains a cluster break, so that one is unconfirmed) |
| Drawing the tail | the body is a rounded rect with the tail box clipped out and the tail is a second box drawn into it. macOS's box is 15.4 × 14.84, so its left edge lands on a fraction (594.609 in the 630pt pane) and Chrome rounds the tail's `clip-path` reference box to whole CSS px before rasterizing it: the tail was painted from 595.0 while the body stopped at 594.6, leaving a white hairline down every tailed bubble (one 75%-white device pixel at x 594.5 at 2x; 3 fully white pixels at 8x). `bodyClipPath` now takes an `overlap` and `message-bubble.tsx` passes 0.75 on macOS so the body paints into the box. iOS's 22 × 21.2 box lands on whole pixels and never showed it |
| Tail takes space | unlike iOS, a tail pushes the next bubble of the cluster down by its hang: the same four captures measure 7.74 / 8.10 / 8.11 / 8.23 from a tailed body's bottom to the next body's top, i.e. the 3 gap plus the 4.76 hang. The status label below a tailed bubble is *not* pushed down (it stays 6.15 under the body) |
| Status | "Delivered" gray, ink 41.5 × 7.5 (41.0 light, 42.0 dark), ink right edge 16.75 in from the bubble body's right edge, ink top 6.15 below the body bottom. Web: 9px weight 600 with `letter-spacing: 0` on an 11px line box reproduces it (ink 41.8); 10px is 13% too wide and too tall (ink 47.0 × 8.5) |
| Date header | "Today 1:47 AM" 9pt gray (ink 63.0 × 9.0 at pane x 282.0–345.0; #808080 light / #9a9a9a dark) centered, its ink bottom 5.99 above the first bubble's body top (`conversation-pane-light-partial.png`). Neither full pane capture shows a header: both are scrolled past it |
| Emoji-only message | a 72pt glyph (ink 71.5 × 70.5) in an 87.3 line box, 4 from the edge, cluster gaps on both sides, no bubble |
| Link | gray card (#e9e9eb light / #3b3b3d dark) 140×60 radius 14 with hostname 10pt and a Ø24 Safari disc centered 28 from the right edge |
| One-line body | 28.76 tall; line pitch 14.70 (28.76 / 43.39 / 58.10 / 72.87 for 1–4 lines, each read off `conversation-pane-light.png` at a column clear of the text); max width 382.29 at a 630 pane (0.6068) |

`bubble-tails-4x.png` is a 4x **nearest-neighbour** enlargement of the 2x capture, not a 4x screenshot: every
source pixel is a 4×4 block, so it holds 8 image px per point but only 2 px/pt of real edge information.
Downsample it by 4 before tracing, or the sub-pixel coverage on its edges reads as four identical rows.

### macOS colors

| Token | Light | Dark |
|---|---|---|
| Outgoing bubble (gradient by window y) | #64b2f5 at y 185 → #3f8bf6 at y 553 | #5096f7 at y 185 → #4190f7 at y 553 |
| Incoming bubble | #e9e9eb | #38383a at top → #3b3b3d lower |
| Selected sidebar row (key window) | #3478f6 | #3478f6 |
| Sidebar unread dot | #0088ff | #0091ff |
| Sidebar unread dot, selected row | #ffffff | #ffffff |
| Selected outgoing bubble (flat) | #1b60d8 | #0b50c8 |
| Selected incoming bubble (flat) | #c6c6c7 | #55555c |
| Selected SMS green bubble (over the fill) | rgba(10,10,120,0.20) | rgba(10,10,120,0.20) |
| Selected image balloon (over the image) | rgba(206,206,210,0.40) | rgba(206,206,210,0.40) |
| Selected link, attachment or plugin balloon | rgba(10,10,120,0.10) | rgba(10,10,120,0.10) |
| Selected sidebar row (inactive window) | (pending) | #3a3a3a |
| Sidebar panel fill / window ground beside it | #fafafa / #f8f8f8 | #1b1b1b / #1c1c1c |
| Sidebar row separator | #e1e1e1 | #3a3a3a |
| Sidebar muted bell | #aeaeae | #5b5b5b |
| Secondary label | #808080 | #9a9a9a |
| "Edited" label | (pending) | #3f8ff7 |
| Tapback balloon, own reaction | #5498f8 | #5498f8 (the same blue in both themes, laid over the pane with the opacity ramp below) |
| Composer field and button fill | #ffffff | #232323 |
| Composer rim (see below; absent in light) | none | #424242 |
| Composer placeholder | #bdbdbd | #626262 |
| Composer typed text | (pending) | #dddddd |
| Composer caret | #3b86f7 | #3f8ff7 |
| `+` glyph / emoji face ink | #010101 | #f1f1f1 / #f4f4f4 |
| Composer waveform glyph | #999999 | #858585 |

### macOS composer glyphs and rim (`composer-empty-and-typed-dark.png`, `conversation-pane-light.png`)

Every glyph below is given in its own button's 30-point box, and each sits 0.2 left of and 0.2 below
that box's center, so the two buttons carry the same optical offset.

| Part | Measurement |
|---|---|
| `+` cross | **12.58** long including the round caps, 1.7 stroke, centered (14.8, 15.2). Identical in both themes. Measure on the stroke axis: a row even 0.8 px off centre is already inside the round cap taper and reads 12.3 |
| Emoji face | Ø 15.55 centered (14.79, 15.2): a 1.35 outline in light, a filled disc in dark |
| Eyes | Ø 1.98 at (12.54, 13.42) and (17.06, 13.42) |
| Mouth | a **10.0**-wide D from x 9.8 to 19.8, centred on the disc. Its top edge is an arc, 15.65 at the corners and 16.3 in the middle; its bottom reaches 20.36. A 0.94-thick band of teeth curves through it, 7.95 wide, centered 17.15 at its ends and 17.6 in the middle |
| Waveform | five stadium bars, centers 3.595 and 7.305 either side of the middle one, widths 1.6 / 1.8 / 2.0 / 1.8 / 1.6 and heights 3.77 / 7.0 / 14.47 / 7.0 / 3.77, all centered on the field's middle |

The dark rim is **lit on one diagonal**, not a uniform ring: #424242 for 0.77 inside the edge (it reads
#424242 then #343434 down the top edge's two pixels), the same along all four edges and at the top-left
and bottom-right, and it fades into the fill at the top-right and bottom-left. Peaks sampled around the
`+` circle: 0x40 top, 0x42 left and right, 0x45 bottom-right, 0x24 top-right and bottom-left; the field
and the emoji button measure the same. Two offset inset shadows reproduce it. Light has no rim at all:
the #ffffff fill steps straight to the pane, and only the shared soft shadow separates them (11/255
darker than the pane just under the field, 5/255 in the two points above it, 3/255 eight above).

### macOS context menu (right-click on a bubble)

Rounded translucent NSMenu, **302 wide**, at the cursor. Glyph rows centred 24.0 and 62.5 below the menu's top edge (a 38.5 pitch): row 1 the six tapbacks (♥ 👍 👎 HAHA ‼ ?), row 2 five recent emoji + the emoji picker button, both at a **46.75** pitch with the first slot centred 34.5 in from the menu's leading edge. See "macOS tapback picker" below. Then 24pt rows (13pt labels at 40.5 from the menu edge, SF-Symbol icons centred at 25.25): Tapback Details…, Reply…, Attach Sticker… | Forward…, Copy | Delete… | Show Times. Separators inset 16 inside 11pt blocks. Corner radius **12**: a circle fitted to the 0.5 pt dark outline, the one feature that coincides with our render to 0.1 px along the straight edges, gives 12.41/12.42/12.43 on `ctxmenu-light.png` and 12.29/12.30/12.31 on `ctxmenu-dark.png` (rmse 0.06), and a radius sweep pixel-matched against three 20 pt corner crops bottoms out at 11.95-12.1. Leave the top-left corner out of any such fit: a bubble sits behind the glass there in both captures. Captures: `references/macos/captures/ctxmenu-light.png`, `ctxmenu-dark.png`.

**The highlighted row is not captured.** The gray band across the lower half of `ctxmenu-with-edit-light-2x.png` looks like one and is not: it is the blurred scene behind the translucent menu. It begins mid-way up the row above the separator and crosses the separator with no step, which a row highlight cannot do. So the kit draws the AppKit shape (inset 4 pt each side, radius 6, accent fill) and marks it unverified. Whatever a menu row's highlight does, the menu has to clip it: a full-bleed row otherwise paints a square corner past the menu's rounded one, which is what the iOS menu was doing until its row wrapper was clipped to the same continuous-corner path as its glass.

### macOS tapback picker (`ctxmenu-light.png`, `ctxmenu-dark.png`, both 2x)

Two rows of six, both on the same 46.75 pitch. The row-2 emoji ink centres measure 40.00, 87.00,
133.50, 180.25, 227.00 and 273.75 pt with the menu's border at x 5.5, so the first slot's centre is
34.5 in from the menu's leading edge and the last is 268.25. Row centres are 24.0 and 62.5 below the
menu's top edge: the same 👍 appears in both rows and its ink centres sit at y 25.25 and 63.75, a
38.5 pitch. That 👍 is **18.5 wide in both rows**, so one glyph size serves the whole picker; the
row-2 emoji ink is 20.0 × 20.0 and the emoji-picker smiley's outline is 17.5 square. Row 1 ink widths:
👍 18.5, 👎 17.5, HAHA 19.5, ‼ 14.5 (× 21.0 tall), ? 11.5 (× 19.0).

### macOS tapback balloon (`tapback-love-light-2x.png`, `tapback-love-dark-2x.png`, both 2x)

Circle fits on both captures agree to 0.01 pt (rmse 0.01–0.03 pt), so every number below is the same
in light and dark.

| Part | Measurement |
|---|---|
| Main circle | Ø 27.98, centre (136.72, 57.45) pt in the crop (px centre (273.44, 114.90), Ø 55.97 px) |
| Medium trailing circle | Ø 8.04, centre (−9.04, +12.42) from the main centre |
| Small trailing circle | Ø 4.00, centre (−14.22, +19.05) from the main centre |
| Heart | ink 14.64 × 12.96 (columns x 259–288, rows y 103–129 at 2x), centred on the circle's x and 0.53 below its y |
| Placement | the circle's top sits 22.05 above the bubble body's top (86.92 px vs 131.01 px) and its leading edge 11.79 outside the body's leading edge (245.46 px vs 269.03 px) |
| Slot | body bottom 34.93 → next body top 65.51 is a 30.58 gap where the cluster gap below it is 3.18, so the list opens 27.40 above the reacted bubble |

The fill is **not** the bubble's screen-space gradient and does not change with the theme. Solving the
light/dark pair row by row gives one colour, rgb(84, 152, 248) = #5498f8, and an opacity ramp down the
main circle: 0.912 at the top edge, 0.951 a quarter down, 0.982 at the centre, 1.00 from ≈83% down.
(Light row y=89 reads (100,161,249) and dark (80,141,229); by y=139 both read (84,152,248). All three
channels in both themes fit that one alpha, which is why translucency, not two baked gradients, is the
right reading. The bubble underneath cannot be decomposed the same way, because its own blue *does*
change with the theme.) The trailing circles are opaque #5498f8.

There is **no shadow and no visible outline over the pane**, but the artwork is knocked out of anything
it laps by a **0.5 pt rim in the pane colour**, which shows only where the balloon overlaps a bubble.
A radial cut at −50° through that overlap reads (84,151,247) → (55,88,133) → (84,152,248) in dark and
(85,152,248) → (182,218,251) → (108,186,245) in light; the deficit integrates to 1.02 px at 2x and to
exactly the pane colour in both themes.

### macOS tapback motion (`tapback-apply-frames-100-123.png`)

24 consecutive frames at 60 fps, f100 = 1667 ms, 16.67 ms apart, each frame a 304 × 154 px crop at
1.150 px per point (the "Text right before a link" body is 173.36 px wide against 150.475 pt in the
2x capture; the one-line body is 33.13 px against 28.87 pt).

| Frame | ms | What the pixels say |
|---|---|---|
| f100–f101 | 1667–1684 | the menu is still whole (mean absolute difference against the menu-free f112 is flat at 1.00) |
| f102–f111 | 1700–1850 | it dissolves: 0.97, 0.86, 0.71, 0.62, 0.40, 0.28, 0.19, 0.12, 0.06, 0.02 of that difference |
| f112 | 1867 | the menu is gone. **183 ms** end to end, 134 ms from 95% to 5% |
| f117 | 1950 | nothing yet: no balloon, and every bubble is exactly where it was at f100 |
| f118 | 1967 | the balloon appears **and** the list starts opening the slot in the same frame, 100 ms after the menu vanished and 283 ms after it began to dissolve |
| f118–f123 | 1967–2050 | balloon fill diameter over the settled Ø28: 0.19, 0.28, ≈0.52, ≈0.65, ≈0.75, ≥0.80 — still growing in the last frame, so it needs ≈110 ms to reach full size |
| f118–f123 | 1967–2050 | the slot opens by moving everything **above** the reacted bubble up, not by pushing it down: its own body top holds at 76.36 → 76.15 px while the body above rises 72.45 → 62.36 px, i.e. 8.8 pt of the 27.4 pt slot by the last frame |

The small trailing circle measures 0.49, 0.64, 0.71 and 0.81 of its settled Ø4 across f120–f123,
against 0.52, 0.65, 0.75 and ≈0.83 for the main circle: it rides the balloon's own scale with no
delay of its own. The heart is odd and is left alone in the replica: it is visible at f118–f119 at the
balloon's proportion, absent at f120–f121, and back from ≈0 at f122.

**Not in this capture:** the strip ends at f123 = 2050 ms with the balloon still under full size, so
the overshoot past 1 and the settle after it are unverified, as is the 420 ms total in
`tapbackAppear`. The peak scale cannot be read from this strip.



### The macOS pane's vertical rhythm does not drift

A verifier reported our bubbles sitting 0.5 to 1 pt low with the error growing down the pane, and it
is worth recording that the causal reading was wrong even though the observation was real. Native
lands every row top on the device grid (0.5 pt at 2x), so two captures of the SAME conversation put
the same bubbles 0.5 pt apart from each other while agreeing on the bottom-anchored one. Measured
against `conversation-pane-dark-2.png`, which carries our exact fixture, our layout tops track native
within 0.31 pt with no monotone trend: nothing accumulates.

Two real residuals do survive, and neither is the rhythm:
- **Painted width.** Chrome rounds a painted background box to whole CSS px, so a layout of 227.71875
  and one of 227.5 both paint at 228.00. Every macOS bubble therefore paints 0.29 to 0.47 pt narrow
  and up to 0.52 pt right. `will-change: transform` does not opt out; only a fractional `transform`
  moves it, and the send and receive animations already own that element's transform.
- **The tailed-bubble gap.** The m6-to-m9 span is 0.19 to 0.69 short. With `gapInGroup` pinned at
  3.045 ± 0.1 by a five-gap run, the shortfall has to be in the extra space a tail takes, which is
  `tailSpace` in `message-list.tsx` plus the lab fixture's own `gapBefore`. Note `tailSpace` is
  unreachable for a derived tail: `tail` is `!nextInCluster` and the next row's `inCluster` is the
  same predicate, so only a caller-forced tail can trigger it.

## FaceTime

Messages does not render a live call inline: an active FaceTime call is its own window, and call
history lives in the Phone and FaceTime apps. What appears in a transcript is a FaceTime **link**
card, which uses the same gray card as a link preview. `registry/imessage/facetime-card.tsx` renders
that card for the `invitation` state and reuses it for `ringing`, `connected`, `ended` and `missed`
so an application can show its own call lifecycle in the same visual language. Those four states are
app surfaces, not reproductions of a native Messages element, and are marked unverified.

## Still unverified

No native capture exists yet for these, so they are built from the documented pattern and must not be
described as measured:

- The typing indicator's **dot animation**. Its geometry is no longer open: ChatKit gives
  `transcriptTypingIndicatorLargeBubbleSize` **{57.5, 35}**,
  `transcriptTypingIndicatorThinkingDotDiameter` **8.5** and
  `transcriptTypingIndicatorThinkingDotSpace` **12.5**, which is a centre-to-centre pitch, not a
  gap: three 8.5 dots at 12.5 span 33.5 and leave 12 of padding each side of the 57.5 balloon,
  where reading it as a gap would leave 3.5. It also has the two smaller bubbles that trail the
  balloon (`…MediumBubbleSize` {11.5, 11.5} at (7, -7.5), the large one at (14, -28.5), whole
  indicator `transcriptTypingIndicatorDefaultSize` {78.5, 35}), which the kit does not draw yet.
- **The macOS tapback overshoot.** `tapback-apply-frames-100-123.png` ends while the balloon is still
  growing, so the peak scale and the settle in `tapbackAppear` are invented; only the 110 ms rise, the
  trail's lack of delay, and the 183 ms menu dissolve are measured. See "macOS tapback motion".
- **The macOS balloon for someone else's reaction.** Every macOS capture shows your own blue one, so
  the gray fill (`--im-tapback-theirs`) is carried over from the incoming bubble colour, and the 0.5 pt
  knockout rim is measured only on the blue balloon.
- **The unread dot, on both platforms.** No capture on either side contains an unread row: over the
  whole left gutter of `list-light.png` and `list-dark.png` the maximum deviation from the page
  background is 0, and neither frame holds a saturated blue pixel. The values now come out of ChatKit
  26.5 instead. macOS: Ø 9 at row x 4.5-13.5, vertically centred, #0088ff light and #0091ff dark,
  turning opaque white on the selected row because the dot sits inside the selection fill
  (`-[CKUIBehaviorMac shouldUnreadIndicatorChangeOnSelection]` is YES, and
  `unreadIndicatorImageForVisibility:withMuteState:` swaps the image on the same test that whitens the
  labels). iOS: Ø 11 at x 7.5, centred on the 86.67 row, same two colours, and it does NOT change on
  selection because `CKUIBehaviorPhone` returns NO. An unread row changes nothing else on either
  platform: no bolding, no colour move, no layout shift, and there is no count badge anywhere in
  `CKConversationListIndicatorsView`. Two things the framework does not settle: whether an inactive
  window's gray selection whitens the macOS dot, and the pinned tile's dot, which colours through a
  branch this kit has no equivalent for and is therefore inert. Also still unmeasured on macOS: the
  light inactive-window selection fill, multi-item pinned layout (every capture has exactly one pinned
  conversation), and the hover feedback on the list-options button. An inactive
  dark window also lightens the whole panel to ≈#292929, measured on a full-window frame held outside
  the repo for the same reason the sidebar frames are; the component keeps the active #1b1b1b.
- The selected-message overlay on macOS. Its colours, and the fact that it is a layer on the balloon
  rather than a row background, come from ChatKit's own theme rather than a screenshot, and no capture
  of a selected bubble exists: the one in `ctxmenu-*.png` sits behind the tapback bar's glass and is a
  blur. Only text bubbles draw it so far; link cards, attachments, images and emoji-only messages
  carry `data-selected` but no fill change.
- The iOS link card and both rich link variants (macOS compact is measured).
- The receive animation (pop from the typing indicator).
- Group-chat sender-name placement.
- "Yesterday" and weekday date-header wording, and whether later headers drop the service line.
- **Message effects** (`message-effects.tsx`, `screen-effects.tsx`): the four bubble effects and the
  nine screen effect animations. Shapes and timings follow the documented look. Screen effects that
  happen against a night sky (fireworks, lasers, shooting star) dim the screen under them, as native
  does. The iOS picker itself *is* measured now, see "Send with effect" above; the macOS popover is
  not. Invisible Ink's look is measured from the iOS preview (a #0088ff bubble whose text dissolves
  into bright specks) but its particle motion is not.
- **The iOS iMessage blue gradient.** `tokens.ts` still carries the macOS values (#76c2f5 → #3583f6)
  because no iOS capture contains a blue conversation bubble: the simulator has no iMessage account,
  so every outgoing message there is SMS green. The one blue directly measured on iOS is the flat
  #0088ff of the effects preview, and it is flat by design, so it says nothing about the ramp.
- **Inline replies** (`message-reply.tsx`): the quoted stub is **not** a scaled copy of the quoted
  bubble, which is what this said before. ChatKit gives it its own box: `_replyBalloonTextFont`
  .SFNS-Regular **11**, `textReplyBalloonCornerRadius` **17.5**, `replyBalloonMinHeight` **26**,
  `replyPreviewBalloonMinWidth` **48**, `replyBalloonTextContainerInset` **{6.5, 0, 6.5, 0}** and
  `replyBalloonMaximumNumberOfLines` **3**. A corner nearly as round as a full bubble's over type
  two thirds the size cannot come from one scale factor; the 0.76 recorded here would have given
  12.93 / 15.21 / 30.4 / 36.5 / 7.6 / 2. `CKUIBehaviorMac` inherits all of them. The one number that
  survives is the opacity: `replyPreviewBalloonImageAlpha` is **0.55**. Still not measured, because
  ChatKit is silent on them: the stub's horizontal padding, its tail, and its maximum width, which
  stay derived from the bubble. The thread view dims and blurs the rest of the conversation, from
  documented behaviour.
- **Photo messages** (`message-image.tsx`): photos take the measured bubble outline including the tail.
  The tail is filled by sampling the photo's own trailing-bottom edge. Grid: one photo keeps its
  aspect ratio, two are side by side, three put a tall tile first, four or more show four tiles with
  a "+N" count on the last.
- **Audio messages** (`message-audio.tsx`): ChatKit describes the row and it is not the shape that
  was guessed here. `audioWaveformHeight` **35**, `audioWaveformGapWidth` **2**,
  `audioProgressViewSize` **{29, 29}**, `audioBalloonHorizontalSpacing` **10**,
  `audioBalloonWaveformTimeSpace` **6**, `audioBalloonVerticalSpacing` **7** with
  `audioBalloonAlignmentInsets` {0,0,0,0}. So the waveform is taller than the control beside it
  (35 against 29, where one 28 used to serve as both), and the balloon insets its row by 7
  vertically rather than by a text bubble's 10. Still provisional: the **bar width**, and
  therefore the bar count, which is only how many fit. `audioRecordingViewTimeBetweenWaveformSegments`
  is 1/12 s, so a recording lays down 12 bars a second - that fixes a count from a duration but
  not a width.
- **The macOS composer beyond one line.** Every capture has a one-line field, so how far it grows per
  extra line, and what it does at its ceiling, is unmeasured; `macos-composer.tsx` grows it by the
  16-point line box and keeps the field's bottom, the `+` and the emoji button pinned at y 629. Also
  unmeasured there: the unfocused placeholder (every composer capture shows a caret, so only the
  focused "Message" is measured, not "iMessage"), the light theme's typed-text color, the field's
  trailing padding, and any hover or pressed feedback on the three buttons.
- Edit-in-place, and the sticker and Genmoji pickers, are not built.
- The macOS context menu gains an **Edit** row for a recent outgoing iMessage, in its own separated
  block between "Attach Sticker…" and "Forward…" with a pencil icon
  (`references/macos/captures/ctxmenu-with-edit-light-2x.png`). The edit-in-place UI itself is not
  captured.

## Reading a diff number honestly

`scripts/measure/compare.ts` prints raw mismatched pixels, so a region can look bad for reasons that
have nothing to do with fidelity. Known ones, measured on 2026-09-08:

| Region | Raw | Comparable | Why the raw number is misleading |
|---|---|---|---|
| macOS header, whole bar | 11.15% | 0.03% on x 0-280 y 0-100 (light) | the native glass has the conversation blurred underneath it; the lab pane is empty. Sub-region x 360-630 alone is 19.58% for that reason, and the video button's own box measures 8.20% purely because a blue bubble sits behind native's glass there |
| macOS header, name pill | 6.31% | 0.00% on x 286-344 y 62-74, both themes | native shows a contact photo, the lab shows initials, and the photo's drop shadow darkens the pill's top; the pill's own outline below the avatar is exact |
| macOS pane, `/lab/list?platform=macos` vs `conversation-pane-light.png` | 3.89% on 0 90 630 500 | 2.76% vs `conversation-pane-dark-2.png` | the light capture is the same conversation with a heart Tapback applied to "Second of two", which the fixture does not carry. The balloon also splits the cluster there, so the bubble above it gains a tail and the two bubbles sit 30.6 apart instead of 3.2. Diff that scene against `conversation-pane-dark-2.png` |
| macOS composer row against `conversation-pane-dark-2.png`, full 55 pt | 2.57% | 0.31% on 0 585 620 53 | that capture has no window rim: its last point row is the pane's own #1e1e1e where `conversation-pane-dark.png` has the #4b4b4b bottom border, and the pane's right edge differs too. End the region at y 638 and x 620 |
| iOS bubbles, conv3 | 2.11% | — | text anti-aliasing between the simulator and a browser |
| iOS nav bar | 0.43% | — | text anti-aliasing plus the avatar gradient's lower half |

Diff a sub-region that excludes the known difference before concluding a component is wrong, and say
which exclusion you applied when you quote a number.

## Where fidelity stands

Measured on 2026-09-09 with `scripts/measure/compare.ts`, Chromium, at the capture's own pixel ratio.
Each number is the raw mismatched-pixel ratio for the region named; read it with the caveats above.

| Lab | Reference | Region (pt) | Mismatch |
|---|---|---|---|
| `/lab?scene=ios-conv3` | `ios/conv3-light.png` | 100 200 302 460 | 1.58% |
| `/lab/ios-chrome?scene=conversation` | `ios/conv3-light.png` | 0 0 402 168 | 0.07% |
| `/lab/ios-chrome?scene=conversation` | `ios/conv3-light.png` | 0 780 402 94 | 0.00% |
| `/lab/ios-chrome?scene=list` | `ios/list-light.png` | 0 0 402 360 | 0.07% |
| `/lab/ios-screens?scene=details` | `ios/details-light.png` | 0 60 402 560 | 0.08% |
| `/lab/tapback?scene=balloon` | `ios/tapback-love-light.png` | 300 520 102 80 | 3.10% |
| `/lab/tapback?scene=longpress` | `ios/longpress-ok-light.png` | 130 590 260 180 | 1.16% |
| `/lab/list?platform=macos` | `macos/conversation-pane-dark-2.png` | 0 115 630 470 | 2.60% |
| `/lab/list?platform=macos&theme=light` | `macos/conversation-pane-light.png` | 0 90 630 500 | 4.17% |
| `/lab/macos-chrome?scene=pane&theme=dark&text=Every detail` | `macos/conversation-pane-dark.png` | 0 585 630 55 | 0.29% |
| `/lab/macos-chrome?scene=pane&theme=dark&focus=1` | `macos/conversation-pane-dark-2.png` | 0 585 620 53 | 0.31% |
| `/lab/macos-chrome?scene=pane&theme=light&focus=1` | `macos/conversation-pane-light.png` | 0 585 620 53 | 0.26% |

The remainder in every one of these is text and edge anti-aliasing: the simulator and a browser
rasterize glyphs and curves differently. Geometry, spacing and colour agree within a point.

## Interactive transitions

The scenario timeline scrubs every animation, but the live path has to run them too. These are wired
and captured in `scratchpad/cmp/live*` during development:

| Action | What runs | Where |
|---|---|---|
| Send | `playSendAnimation`: the field's text row becomes a bubble-shaped rect, shrinks to the field's sending end by ~117 ms, then a clone flies to the slot on a spring, settling by ~520 ms | `useArrivalAnimation` in the shells, triggered by `sendAnimation={{ id }}` |
| Receive | `playReceiveAnimation`: pops in from the typing indicator | `receiveAnimation={{ id }}` |
| Long press | dim, lift, menu unfold, then the bar expands from the picker circle with the glyphs staggered | `MessageActions` entrance, ~600 ms |
| Dismiss the menu | the dim lifts while the menu, bar and picker fold back toward the bubble, ~220 ms | `MessageActions` `open={false}` then `onExited` |
| Apply a Tapback | the menu dissolves over 183 ms, then the balloon appears 100 ms after it has gone and grows to full size in ~110 ms with the trail riding its scale; the overshoot and settle after that are unverified | `Tapback animateIn`, 420 ms |
| macOS menu dismiss | fade and settle back, ~120 ms; closes on Escape or a click anywhere outside | `ContextMenu` `open={false}` |
| Press and hold | the bubble grows to 1.03 over the 500 ms hold | `useLongPress` `holdStyle` |

Two rules that matter for both fidelity and testability:

- A component that animates on dismissal must stay mounted until it is done. Both shells derive that
  "closing" state **during render**, not in an effect: an effect leaves one committed frame with the
  element already gone, and the dismissal is never seen.
- A balloon only pops in for a reaction applied in this session. Reactions already on a message when
  the conversation opens are simply there, so `Tapback animateIn` is off by default.

## Transcript status lines (the centred grey text that is not a bubble)

`registry/imessage/system-message.tsx`. A group rename, a join, a leave, the group photo and
background, an unsent message, a kept attachment, a failed group edit, and the unknown-sender notice.
Lab: `/lab/system-message?scene=notice|run|family`.

**Correction to line 164 above.** The "iOS extra states" entry calls the unknown-sender notice
"the centered 12pt notice". It is **11 pt**. Line 1's ink in `incoming-light.png` spans device x
67–1137, i.e. 357.0 pt of advance for 65 characters; 12 pt needs ≈389 and would not fit the 370
column at all. ChatKit agrees (below). The 11 in `unknownSenderMetrics` was always right.

### Measured from `references/ios/captures/incoming-light.png` / `-dark.png` (402×874 @3x)

The only frame in the repo holding any member of this family. Full-width non-white row scan:

| reading | value | how |
|---|---|---|
| line pitch | **13.3333** | baselines 40 device rows apart (ink count falls 525→128 between rows 2188/2189 and 82→24 between 2228/2229); the x-height bands open on rows 2170 and 2210, also 40 apart |
| font size | **11** | 357.0 pt of advance over 65 characters, and the 370 column reproduces the capture's break ("…it may" / "be spam.") to the word |
| colour | **#8a8a8e / #8d8d93** | darkest ink in the capture is exactly (138,138,142); ChatKit carries `UIColor.secondaryLabel`, which is (60,60,67, 0.6) over white = (138,138,142.2) and (235,235,245, 0.6) over black = (141,141,147) |
| column | **370** = 402 − 2×16 | the measured edge inset |
| space above | **16.1667** | bubble body bottom 702.6667 (its full-width run ends after device row 2108, only the tail survives into 2109); line 1's baseline 729.6667 less the 10.6348 ascent and the 0.1891 half-leading of a 13.3333 box puts the line box top at 718.8334 |
| tracking | **0.12** | fitted, not assumed: sweeping `/lab/system-message?scene=notice&ls=…` and taking the band's MSE against the capture gives 0.10→468.6, 0.11→431.5, 0.115→423.9, **0.12→418.7**, 0.13→424.1, 0.14→462.9 |

The x-height arguments elsewhere in this repo (5.83 here, 6.0 in `ios-notices.tsx`, 6.33 from a plain
threshold) are all anti-aliasing-inflated: `-[UIFont xHeight]` for this font is **5.79**. Width is the
argument that establishes the size; x-height is not.

### Read out of ChatKit 26.5 (Catalyst probe, both idioms)

`clang -target arm64-apple-ios26.0-macabi`, `dlopen` the iOSSupport ChatKit,
`-[UIDevice userInterfaceIdiom]` swizzled, `CKUIBehaviorPhone` / `CKUIBehaviorMac` instantiated:

| reading | iOS | macOS |
|---|---|---|
| `transcriptRegularFontAttributes` | .SFNS-Regular **11**, natural line height 13.0, centred, no min/max line height, no line spacing | identical |
| `transcriptEmphasizedFontAttributes` | .SFNS-**Medium**, `UIFontWeightTrait` 0.23 = CSS **500** | identical |
| `transcriptGroupModificationError{Regular,Emphasized}FontAttributes` | .SFNS-**Light** (trait −0.4 = CSS 300) / .SFNS-Medium, both `systemRedColor` | identical |
| `-[CKGroupActionChatItem textAlignmentInsets]` | top **3**, bottom **3** | top **2.5**, bottom **2** |
| `-[CKGroupActionChatItem hasSelectableText]` | **NO** | **NO** |
| `transcriptMessageStatusFont` ("Delivered") | .SFNS-Semibold 11 | .SFNS-Medium 9 |
| `transcriptStatusItemEdgeInsets` | all zeros | all zeros |

Three things this settles that the kit had wrong. The emphasised run is weight **500**, not the 600
borrowed from the "Delivered" label. **macOS status text is 11/13, the same as iOS** — the 9 pt this
family used to take is `transcriptMessageStatusFont`, which is the one transcript metric that does
scale on the Mac. And `select-none` is a reading, not a preference.

`textAlignmentInsets` is the item's own padding, inside whatever the layout puts between items — so
the notice's measured 16.1667 above decomposes as 3 (the item) + 13.1667 (the layout).

### Wording

Every sentence is a ChatKit format string, verbatim from `ChatKit.framework/Resources/ChatKit.loctable`
(`plistlib`, no probe needed), kept as templates in `statusTemplates`. `#…#` marks the emphasised run;
the localisations prove it is emphasis markup and not a token, because the delimiters wrap a
translated verb phrase (`es` "#Has denominado# la conversación “%@”.", `de` "#Du# hast…",
`ja` "#あなた#が…"). Two consequences: **"You" is emphasised** (every `GROUP_YOU_*` string wraps it),
and **the added or removed participant is not** — only the actor is inside `#…#`, so
"**You** added Sam Rivera to the conversation." bolds the first half.

**A missed call is not a transcript line.** ChatKit's string tables contain no `Missed*` string;
"Missed Call" and "Missed FaceTime" live in FaceTime.app's `Recents.loctable`, and "Missed Video Call"
exists nowhere on the system. A call in a transcript is the FaceTime card (`facetime-card.tsx`,
`state="missed"`). **A tapback is not one either** — the six verbs come from `IMSharedUtilities.loctable`
("%@ loved “%@”", "You loved “%@”"), which is the notification and sidebar-preview format, carries no
`#…#` at all, and has no ChatKit status string behind it; a tapback in the transcript is a balloon.

### Still unverified for this surface

- **`gapAbove` for the group lines, on both platforms.** ChatKit keeps the item's own padding in
  `textAlignmentInsets` but the spacing *between* items in
  `-[CKChatItem layoutItemSpacingWithEnvironment:…]`, which needs a live layout environment;
  `transcriptStatusItemEdgeInsets` is all zeros. No committed capture shows a group conversation on
  either platform. iOS borrows the notice's measured 13.1667; macOS reuses the measured 11.5
  between-cluster gap less the item's 2.5 top pad. The open route is an iOS-simulator capture of a
  real group event (seed the booted simulator's `Library/SMS/sms.db` with `item_type` 1/2/3/6 rows,
  then `xcrun simctl io booted screenshot`); it was attempted for this section and the sandbox
  declined the write to the Messages database.
- **`macos.lineHeight` 13** is ChatKit's natural line height, not a rasterised pitch: no macOS capture
  holds a two-line status sentence, so unlike iOS's 13.3333 it has no capture behind it.
- **`macos.letterSpacing` 0** — nothing to fit against.
- **`errorColor` on iOS** (#ff3b30 / #ff453a) is Apple's published iOS systemRed. `systemRedColor` is
  a `UIDynamicCatalogSystemColor`, so the Catalyst probe resolves it on the host and returned the
  macOS pair (#ff383c / #ff4245) under both idioms; only the macOS pair is a reading.
- **The arrival motion** (`systemMessageMotion`, 260 ms, 6 pt rise) is invented. Nothing captures a
  status line arriving and ChatKit exposes no duration for one. It is one Web Animations animation on
  the row, so `animateIn={{ progress }}` seeks it.

### Fidelity

| Lab | Reference | Region (pt) | Mismatch |
|---|---|---|---|
| `/lab/system-message?scene=notice` | `ios/incoming-light.png` | 0 712 402 40 | 3.70% |
| `/lab/system-message?scene=notice&theme=dark` | `ios/incoming-dark.png` | 0 712 402 40 | 3.89% |

Interior mean signed error 0.00 in both, largest interior blob 0.0%: the whole remainder is glyph
anti-aliasing.

## The macOS details inspector (`registry/imessage/macos-details.tsx`)

**No capture in this repo shows this pane**, and until one exists nothing in this section is a
reading off a macOS frame. `references/macos/captures/*.png` are all crops of window x 330–960 with
no inspector open. The one capture of *any* details view anywhere in the repo is
`references/ios/captures/details-light.png` / `-dark.png` (402×874 @3x), which is the **phone idiom
of the same view controller**; it is used below only for structure, never for macOS geometry.

Everything else was read out of the frameworks on this machine with the Catalyst probe the rest of
this file already uses: `clang -target arm64-apple-ios26.0-macabi`, dlopen
`ChatKit.framework` **and** `CommunicationDetails.framework`, swizzle `-[UIDevice userInterfaceIdiom]`
to 5 so `+[CKUIBehavior sharedBehaviors]` vends `CKUIBehaviorMac` and `theme` vends `CKUIThemeMac`.
Probe cross-checks that it is reading Mac values, all already measured elsewhere in this file and all
agreeing: `balloonTextFont` 13, `balloonContiguousSpace` 3, `conversationListContactImageDiameter` 40,
`defaultConversationListWidth` 320, `_transcriptBackgroundColor` #ffffff / #1e1e1e.

### What the live view actually is

`CKDetailsViewController` is **ABSENT** from ChatKit 26.5. The shipping view is
`CommunicationDetails.DetailsViewController`, whose ivars are `headerView`,
`detailsPageViewController`, `tabs`, `selectedTab`, `backgroundVisualEffectView`; and
`Header.HeaderView`'s are `avatarView`, `contactCardHeaderView`, `quickActionsContainerPool`,
`horizontalTabsHostingView`, `isHeaderBlurVisible`, `hasScrolledPastTopEdge`,
`headerInterpolationProgress`. So the pane is **one pinned header (avatar, name, quick actions, tab
strip) over a paged tab body**, with a top-edge blur (`PlatformTopEdgeBlurView`) that appears once the
body scrolls. Its tab classes are `DetailsInfoTab`, `DetailsPhotosTab`, `DetailsLinksTab`,
`DetailsAttachmentsTab`, `DetailsLocationsTab`, `DetailsWalletTab`, `DetailsBackgroundsTab`, and its
strip is `DetailsTabBarView` / `SegmentedTabControl` / `TabSegmentView` / `SelectionView`.

ChatKit's *cells* do still ship and still carry the metrics: `CKDetailsChatOptionsCell`,
`CKDetailsChatOptionsCheckboxCell`, `CKDetailsSharedWithYouCheckboxCell`,
`CKDetailsSegmentedControlCell`, `CKDetailsSearchResultsTitleHeaderCell`, `CKDetailsMapViewCell`,
`CKDetailsAddMemberStandardCell`, `CKDetailsGroupHeaderCell`.

### Geometry, from `CKUIBehaviorMac`

| Value | Selector |
|---|---|
| column **300** wide, user-resizable **280–400** | `defaultInspectorColumnWidth`, `minInspectorColumnWidth`, `maxInspectorColumnWidth` |
| content inset **16** | `searchDetailsLeadingAndTrailingMaxPadding`; `searchDetailsResultsInsets` leading/trailing |
| body scroll inset **12** top, **16** bottom | `searchDetailsResultsInsets` = t12 l16 b16 r16 (an `NSDirectionalEdgeInsets`) |
| section margin **10** above and below | `searchDetailsSectionMarginInsets` = t10 l0 b10 r16 |
| section heading **16** above, **−2** leading | `detailsSectionHeaderPaddingAbove`, `detailsSectionHeaderPaddingLeading` |
| title header top padding 12 (see caveat) | `searchResultsTitleHeaderDetailsTopPadding` |
| contact photo **Ø 37**, cut-out **Ø 41**, cut-out radius **20.5** | `detailsAvatarDiameter` = `detailsViewContactImageDiameter`, `detailsAvatarCutoutDiameter`, `detailsAvatarCornerRadius` |
| photo→name **12**, name→subtitle **1** | `detailsContactAvatarLabelSpacing`, `detailsGroupHeaderCellInterTextVerticalSpacing` |
| group photo stack **58** wide for two, **72** for three | `detailsAvatarPancakeViewWidth2Avatars`, `…3Avatars` |
| quick action **Ø 32** | `detailsAddButtonDiameter` — the only circular details-view button diameter the framework vends; `CommunicationDetails.QuickActionView` is Swift and has none of its own |
| **12** between quick actions | the l6 + r6 of `detailsContactCellButtonEdgeInsets` (t8 l6 b8 r6). **A transfer**: those insets belong to `CKDetailsContactCell`'s trailing buttons, whose box is `detailsContactCellButtonWidth`/`Height` 25 × 25, not to the quick actions. `detailsCellLabelPadding` independently gives the same 12 |
| glyph→label **12** | `detailsCellLabelPadding` |
| photo grid gap **10**, tile radius **8** | `searchPhotosInterItemSpacingDetailsView`, `searchPhotosCellZKWAndDetailsCornerRadius` |
| link / document row radius **8** | `searchLinksCellCornerRadius` = `searchAttachmentsCellCornerRadius` |
| row height **40**, option row **44** | `detailsContactCellMinimumHeight`; `+[CKDetailsChatOptionsCell estimatedHeight]` = `+[CKDetailsSharedWithYouCell estimatedHeight]` = `+[CKDetailsAddMemberStandardCell preferredHeight]` |
| Hide Alerts / Send Read Receipts / Shared With You are **16 × 16 checkboxes**, not switches | `CKDetailsChatOptionsCheckboxCell`, `CKDetailsSharedWithYouCheckboxCell`; a `UISwitch` built under the Mac idiom reports `style` 1 (`UISwitchStyleCheckbox`) and `intrinsicContentSize` 16 × 16 |
| popover width in details **260**, preferred content size **320 × 480**, map **196** tall | `popOverWidthInDetailsView`, `detailsPreferredContentSizeWidth`/`Height`, `detailsViewMapHeight` |
| group disclosure `chevron.forward.circle` / `chevron.down.circle` at **17 pt**, ink 16.9985 square | `detailsGroupHeaderCellChevronForwardName`/`…DownName`, `detailsGroupHeaderCellChevronFont` |

Two caveats recorded rather than applied:

- `searchDetailsSectionMarginInsets`'s **l0 / r16** is dropped. The scroll box already carries 16 on
  both sides from `searchDetailsResultsInsets`, and applying r16 again would inset every section's
  trailing edge to 32.
- `detailsSectionHeaderPaddingAbove` **16** and `searchResultsTitleHeaderDetailsTopPadding` **12** are
  both "above the title". The component applies the 16 (the selector that names *this* view's section
  header) and records the 12. Which one ships is unresolved without a capture.
- `detailsAvatarPancakeViewOverlapOffset` is **13.5** and reconciles with neither pancake step
  (58 − 37 = 21 for two faces, (72 − 37)/2 = 17.5 for three, i.e. overlaps of 16 and 19.5). The two
  width selectors are the more specific reading and are what the component uses.

### Type

The framework's details fonts are `detailsGroupHeaderCellTitleFont` **.SFNS-Regular 17**,
`detailsGroupHeaderCellSubtitleFont` **.SFNS-Regular 15**, `searchDetailsHeaderFont`
**.SFNS-Regular 13**. The 17 is not what macOS 26 renders: `conversationListSenderFont` is likewise 17
(semibold) where this file measures that surface at **13** semibold off `conversation-pane-*.png`,
while `balloonTextFont` 13 and `searchDetailsHeaderFont` 13 are already Mac-scale and agree with their
captures. So the 17-family details fonts are iOS sizes left in the Mac behaviour object, and the
shipping sizes are the framework value × the measured **13/17 = 0.7647**:

| Element | Size | Where it comes from |
|---|---|---|
| Contact name | **13 / 700** | 17 × 13/17; the weight is this file's measured header-pill name ("13pt bold … 13px/700 reproduces that ink exactly"), the same contact one surface away |
| Subtitle | **11.4706 / 400** | `detailsGroupHeaderCellSubtitleFont` 15 × 13/17; Regular is the framework's |
| Section heading, See All, row title | **13 / 400** | `searchDetailsHeaderFont`, verbatim |
| Row second line | **11.4706 / 400** | as the subtitle |
| Letter-spacing | **0** everywhere | this file's macOS chrome fits ("Search" 13px/500 ink 41.55, the pill name 13px/700, "Freestyle" 11px/400 ink 47.0) all land native ink with no tracking; the −0.4 measured for macOS is *bubble body text*, which this pane has none of |

### Glyphs — the details view draws SF Symbols at 17 pt

A point-size sweep pins all three `detailsView*Image` selectors to **17 pt Regular**: 17 is the only
size at which `phone.fill` is {19.5, 17.5}, `video.fill` is {24, 15.5} and `message.fill` is
{22.5, 18} at once, which are exactly the sizes those three selectors return. That also settles the
envelope, which has no ChatKit selector: `envelope.fill` at 17 pt is {24.5, 16.5}.

Each image was drawn into a 16x bitmap and traced on the alpha 0.5 isoline. The ink boxes agree with
the images' own `contentInsets`:

| Image | Image box | Ink box | Ink origin |
|---|---|---|---|
| `detailsViewPhoneImage` = `phone.fill` @17 | 19.5 × 17.5 | **15.4988 × 15.4990** | (2.0002, 1.0007) |
| `detailsViewFaceTimeVideoImage` = `video.fill` @17 | 24 × 15.5 | **20.5000 × 13.5000** | (2.5000, 1.0000) |
| `detailsViewMessagesImage` = `message.fill` @17 | 22.5 × 18 | **19.4988 × 15.9993** | (1.5005, 1.0005) |
| `envelope.fill` @17 | 24.5 × 16.5 | **20.5000 × 14.5000** | (2.0000, 1.0000) |
| `macToolbarDetailsImage` = `info.circle` @`macToolbarImagePointSize` 22 | 26 × 25 | **21.9995 × 21.9995** | (2.0002, 1.5002) |
| `chevron.forward.circle` / `chevron.down.circle` @17 (`detailsGroupHeaderCellChevronForwardName` / `…DownName`, at `detailsGroupHeaderCellChevronFont` 17) | 20 × 19 | **16.9985 × 16.9985** | (1.5007, 1.0007) |

Draw each with its `viewBox` set to the ink box, so `width`/`height` paint the measured ink. A
viewBox that is not the ink box scales the drawing: the previous file put a 23-unit box on the info
glyph and painted every copy of it 22/23 = 4.3% small.

### Colours, from `CKUIThemeMac` resolved through a light and a dark `UITraitCollection`

| Token | Light | Dark | Selector |
|---|---|---|---|
| label | rgba(0,0,0,0.8471) | rgba(255,255,255,0.8471) | `primaryLabelColor` |
| secondary | rgba(0,0,0,0.4980) | rgba(255,255,255,0.5490) | `secondaryLabelColor` = `detailsContactCellSubTitleColor` |
| tertiary | rgba(0,0,0,0.2588) | rgba(255,255,255,0.2471) | `tertiaryLabelColor` = `detailsContactCellChevronColor` |
| tint | #0088ff | #0091ff | `appTintColor` = `detailsSeeAllButtonTextColor` = `iosMacDetailsButtonColor` |
| control fill | rgba(0,0,0,0.098) | rgba(255,255,255,0.098) | `detailsAddButtonBackgroundColor` |
| destructive | #ff383c | #ff4245 | `background_sendButtonColor` |

`CKUIThemeMac` has **no** `detailsSeparatorColor` and no `separatorColor` (probe: ABSENT), and
`detailsBackgroundColor` is nil.

### The panel's shape: **there is no divider**

The macOS 26 sidebar is measured in "macOS Chrome" as a *floating panel* — inset 8 from the window's
left, top and bottom, continuous corner (`border-radius: 22px; corner-shape: superellipse(1.4)`, best
circle 17.75), 1 pt rim #ffffff / #424242, fill #fafafa / #1b1b1b over a window ground of #f8f8f8 /
#1c1c1c — and explicitly has "no divider line"; the pane resumes 2 past it (panel 8–328, pane from
330). `macos-details.tsx` mirrors that shape to the trailing edge, so the pushed conversation's
trailing inset is `8 + width + 2` = **310** at the default 300. The shape is measured; that the
inspector uses it is judgement, and it is the only judgement in the panel's chrome. Rendered and read
back at 2x: panel x 652–952, y 8–632; conversation right edge 650.

### Copy, verbatim from the loctables

`ChatKit.loctable`: "Hide Details" (`HIDE_DETAILS_VIEW`), "Info" (`CONTACT_INFO_SHORT`, also
`INFO_BUTTON_TITLE`), "Photos" (`PHOTOS_MENU_ITEM_TITLE`), "Links" (`LINKS`), "Documents"
(`SEARCH_ATTACHMENTS_TITLE`), "Locations" (`SEARCH_LOCATIONS_TITLE`), "Wallet"
(`SEARCH_WALLET_TITLE`), "See All Photos / Links / Attachments / Locations / Passes" (`SEE_ALL_*_TITLE`),
"Hide Alerts" (`DETAILS_VIEW_HIDE_ALERTS_TOGGLE_TITLE`), "Send Read Receipts" (`READ_RECEIPTS`),
"Shared With You" (`SHARED_WITH_YOU_TITLE`), "Create New Contact" (`CREATE_NEW_CONTACT`), "Add to
Existing Contact" (`ADD_TO_EXISTING_CONTACT`), "Block Contact" (`BLOCK_CONTACT`), "Delete and Block
Conversation" (`DELETE_AND_BLOCK_CONVERSATION`), "Delete Conversation…"
(`DELETE_CONVERSATION_ELLIPSIS`), "Leave this Conversation" (`LEAVE_CONVERSATION`), "%lu PERSON" /
"%lu PEOPLE" (`DETAILS_VIEW_GROUP_COUNT_TEXT`).
`CommunicationDetails.loctable`: "Call", "FaceTime", "Mail", "Message", "Screen Sharing", "Add",
"Create New Contact", "Add to Existing Contact", "Block Contact", "Show Contact Card".

### Still unverified for this surface

Everything here is a choice. None of it is quoted as measured anywhere.

- **The whole tab strip.** That there *is* one is established (`DetailsTabBarView`,
  `SegmentedTabControl`, `TabSegmentView`, `AnyTabItem`, `DetailsPageViewController`, seven
  `Details*Tab` classes, and ChatKit's own `CKDetailsSegmentedControlCell`). Its pixels are not:
  those types are Swift, they carry a `styleGuide` struct no ObjC probe can reach, and their
  `init(frame:)` is `fatalError`, so they cannot even be instantiated and measured. The component
  draws it 24 tall, radius 7, 10 of horizontal padding, 2 between segments, 13 pt, selected segment on
  the control fill. Five invented numbers.
- **Gap under a section heading** (8), **row horizontal padding** (6), **grid columns** (3),
  **Info-tab preview caps** (2 photo rows, 3 link/document rows), **checkbox corner** (3.5), and the
  **top-edge blur band** (12).
- **Hover fill** (6% black / 8% white) and the **overlay scrim** (10% / 28% black).
- **The panel's drop shadow.** This file records the sidebar's as a *ground ramp* (#f8f8f8 → #f4f4f4),
  not a CSS shadow, so the inspector's `-10px 0 22px rgba(0,0,0,0.05)` is invented.
- **The presentation.** A scan of all 28 `*duration*` selectors on `CKUIBehaviorMac` returns nothing
  inspector- or details-named, and no capture records the pane moving. 300 ms in on
  `cubic-bezier(0.32, 0.72, 0, 1)`, 250 ms out. Nothing staggers, which is itself a choice: an
  AppKit/Catalyst inspector column slides as one piece.
- **Whether the Hide Details button belongs inside the panel.** The component puts an `info.circle`
  at the panel's top trailing corner; native most likely leaves the toggle in the window's own
  toolbar. `HIDE_DETAILS_VIEW` is the string either way.
- **Locations, Wallet/Passes and Backgrounds tabs** are not built at all, though
  `DetailsLocationsTab` / `DetailsWalletTab` / `DetailsBackgroundsTab`, `SEE_ALL_LOCATIONS_TITLE`,
  `SEE_ALL_PASSES_TITLE` and `detailsViewMapHeight` 196 all exist. Neither is the Info tab's
  `FaceTimeSection`, `HandleSelection`, `KeyTransparency` / `EncryptionStatusFooter`
  (`DETAILS_VIEW_ENCRYPTION_FOOTER_IMESSAGE`) or `DownloadPurgedAttachmentsView`.

### How to get the capture that would settle all of it

Messages is a Catalyst app on this Mac, so one 2x screenshot closes most of this section:

1. size the Messages window to 960×640, the geometry every other macOS number here was measured at;
2. Conversation ▸ **Show Details** (the menu item's `AXMenuItemCmdChar` is `I` with
   `AXMenuItemCmdModifiers` 2, i.e. ⌥⌘I);
3. `screencapture -o -l<windowid>` and drop the PNG in `references/macos/captures/`;
4. diff it:

```
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers \
  bun scripts/measure/compare.ts \
    'http://localhost:3100/lab/macos-details?scene=window&theme=light' \
    references/macos/captures/<that>.png 2 960 640 /tmp/out
```

`scene=panel` crops to the panel's own box (its width × 624 at window (952 − w, 8)) so the header, the
tab strip and the rows can be diffed without the window around them.

### Fidelity

| Lab | Reference | Mismatch |
|---|---|---|
| `/lab/macos-details?scene=window` | none exists | — |

No row can be filled in until a capture of this pane is committed. `scripts/measure/hairline-scan.ts`
on `?scene=window&theme=light` at 2x reports 89 runs, all ≤ 12.5 pt and all of them glyph strokes —
no seam anywhere near the 624 pt the panel's edge would produce.

## The Tapback Details platter (`registry/imessage/tapback-details.tsx`)

**No capture of this surface exists on either platform.** Every number below comes from ChatKit 26.5,
read on 2026-09-08 from two copies of the same framework:

- a Mac Catalyst probe — `clang -target arm64-apple-ios26.0-macabi`, `dlopen` of
  `/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit`, `-[UIDevice
  userInterfaceIdiom]` swizzled to 0 or 5, then `objc_msgSend` on the getters named below;
- the on-disk simulator copy at
  `/Library/Developer/CoreSimulator/Volumes/iOS_23A343/…/iOS 26.0.simruntime/Contents/Resources/RuntimeRoot/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit`,
  whose symbol table is intact, so `nm -a` and `otool -tV -p '-[Class selector]'` disassemble it.

### Which surface this is

ChatKit calls it the **voting view**. Tapping a tapback badge runs
`-[CKChatController(ClickyOrbConformance) _votingViewForChatItem:containingViewController:]`, which
allocates a `CKAttributionViewAccessoryView` (a `_UIContextMenuAccessoryView` wrapping the SwiftUI
`ChatKit.CKTapbackAttributionView`, driven by `ChatKit.TapbackAttributionViewModel` with its
`_tapbackItems`, `_selectedItem` and `_itemPlatterMaskState`). So this platter and the card in
`references/ios/captures/longpress-ok-selected-{light,dark}.png` are the **same view family**: that
capture is its collapsed, single-reactor form, which `message-actions.tsx` already implements as
`TapbackDetails`. The expanded form — tallies, named cells, a close button — is what
`registry/imessage/tapback-details.tsx` builds, and nothing captures it.

Re-measured on `longpress-ok-selected-light.png` and `-dark.png` (3x, both give the same numbers):
the collapsed card's edges are x 416.5–788.5 px and y 197.5–563.5 px, i.e. **124.0 × 122.0 pt**, which
is `-[CKUIBehavior attributionViewHeight]` 132 less `attributionViewAdditionalTopOffset` 4 and
`attributionViewMinPadding` 6. (`message-actions.tsx` records 124 × 121, 1 pt shorter; both readings
sit inside the rim's own anti-aliasing and that file's number is the one in use.) The white/`#484848`
balloon inside it flood-fills to x 528–677, y 225–398 px = **50.0 × 58.0 pt**, a Ø50 circle with its
trail pointing down, and its fill is `-[CKUITheme attributionViewBackgroundColor]` = #FFFFFF light /
#464646 dark.

### There is no Catalyst point scale

`ChatKit.StyleSupport`'s class constants are **idiom-independent**: probing at idiom 0 and idiom 5
returns the same value for every one of them. Only `CKUIBehavior` differs by idiom, and its idiom
pairs land on measured captures 1:1, with no 0.77 anywhere:

| `CKUIBehavior` getter | Phone | Mac | Measured counterpart in this file |
|---|---|---|---|
| `conversationListContactImageDiameter` | 45 | 40 | iOS row avatar Ø45; macOS sidebar avatar Ø40 |
| `conversationListSummaryFont` | 15 | 12 | iOS row preview 15pt; macOS row preview 12pt |
| `balloonTextFont` | 17 | 13 | iOS bubble text 17pt; macOS bubble text 13pt |

Any macOS number obtained by scaling a ChatKit constant is wrong.

### The platter

| Value | Selector | iOS | macOS |
|---|---|---|---|
| Height | `-[CKUIBehavior messageAcknowledgementVotingViewHeight]` | 72 | 80 |
| Max width | `-messageAcknowledgementVotingViewMaxWidth` | 400 | 500 |
| Min padding from the presenting edge | `-messageAcknowledgementVotingViewMinPadding` | 8 | 6 |
| Corner radius | `+[ChatKit.StyleSupport votingViewPlatterCornerRadius]` | 34 | 34 |
| Horizontal padding | `+votingViewHorizontalPadding` | 24 | 24 |
| Item spacing | `+votingViewItemSpacing` | 24 | 24 |
| Additional top inset | `+votingViewAdditionalTopInset` | 4 | 4 |
| End fade width | `+votingViewBlurWidth` | 88 | 88 |
| Close button left padding | `+votingViewCloseButtonLeftPadding` | 22 | 22 |
| Cell width | `+votingViewCellWidth` | 64 | 64 |
| Avatar | `+votingViewAvatarDiameter` | 44 | 44 |
| Reaction badge frame | `+votingViewAvatarViewGlyphFrameWidth` / `…Height` | 20 | 20 |
| Avatar to name | `+votingViewAvatarToTextSpacing` | 4 | 4 |
| Name label height | `+votingViewAvatarViewLabelHeight` | 18 | 18 |
| Name font | `-[CKUIBehavior avatarNameFont]` | SFNS Regular 12 | 16 |
| Count font | `-messageAcknowledgmentVoteCountFont` | SFNS Regular 12 | 16 |
| Tally box | `+votingViewExpandedTallyWidth` / `…Height` | 27 | 27 |
| Tally to count | `+votingViewTallyLabelSpacing` | 0 | 0 |
| Names before "Others" | `-messageAcknowledgmentVotingStackSize` | 4 | 4 |

4 + 44 + 4 + 18 = 70 fits the 72 iOS height with 2 to spare and the 80 macOS height with 10. ChatKit
does not say where that slack goes; the component top-aligns and leaves it at the bottom.

### Colours

`-[CKUITheme messageAcknowledgmentVotingTextColor]` (and `-attributionCountViewFontColor`, which
matches it) returns rgba(0,0,0,0.498) light / rgba(255,255,255,0.549) dark on **both** `CKUITheme` and
`CKUIThemeMac`. Those are byte-identical to `+[UIColor secondaryLabelColor]` resolved in the same
Catalyst process, i.e. the colour *is* secondaryLabel and the probe returns its **macOS** resolution.
So macOS keeps rgba(0,0,0,0.498) / rgba(255,255,255,0.549) and iOS uses iOS's own secondaryLabel,
rgba(60,60,67,0.6) / rgba(235,235,245,0.6) — the trap `sticker-picker.tsx` already documents.

Other values read out and **not** used by the component, recorded here so nobody has to probe again:
`messageAcknowledgmentPickerBackgroundColor` and `attributionViewBackgroundColor` #FFFFFF / #464646,
`messageAcknowledgmentGrayColor` #808080 / rgba(255,255,255,0.549), `messageAcknowledgmentRedColor`
#FA5E96 both themes, `messageAcknowledgmentWhiteColor` and `messageAcknowledgmentBalloonBorderColor`
#FFFFFF both themes.

### How much of a glyph frame the artwork fills

ChatKit draws a classic tapback as an image inset inside its frame — `-[CKTapbackGlyphView
platterEdgeInsets]` is 4 all round on both idioms — so a 27 frame is not 27 of ink. The ratio comes
from ChatKit's own balloon-and-inset pair checked against this file's measured ink:

| | Balloon (`messageAcknowledgmentTranscriptBalloonSize`) | Glyph inset (`…TranscriptGlyphInset`) | Glyph frame | Measured heart ink | Ratio |
|---|---|---|---|---|---|
| iOS | 36 | 4 | 28 | 18.34 (`tapback-love-light.png`) | 0.6550 |
| macOS | 29 | 3 | 23 | 14.64 (`tapback-love-*-2x.png`) | 0.6365 |

ChatKit's balloon size and the captured circle agree independently through the knockout rim: macOS
27.98 + 2 × 0.51 = 29.00 exactly, iOS 34.0 + 2 × 1.0 = 36. So the tally's ink is 27 × the ratio
(17.69 iOS, 17.19 macOS) and the avatar badge's is 20 × the ratio (13.10 iOS, 12.73 macOS).

### Presentation

`-[CKFullScreenBalloonViewControllerPhone votingViewTargetFrame]` disassembles to
`CGRect(x: leading system layout margin, y: max(attributionViewMinPadding, preferredTapbackLayoutFrame.origin.y),
width: preferredTapbackLayoutFrame.width − (leading + trailing margins), height: attributionViewHeight)`.
So on iPhone the platter is presented **inside the full-screen balloon overlay, anchored near the top
at the message it belongs to** — not as a bottom sheet — and it shrink-wraps inside that box up to
its max width. `attributionViewShouldCenterInTranscript` is false on both idioms.

### Still unverified for this surface

- Whether `votingViewItemSpacing` 24 applies between cells as well as between tallies. The component
  applies it everywhere; ChatKit only says "item spacing". `votingViewCellWidth` 64 already carries
  10 pt of gutter each side of the Ø44 avatar, which is the argument for the other reading.
- Where the 20 square badge sits on the avatar **vertically**. Horizontally it is arithmetic —
  64 = 44 + 20, so its trailing edge is the cell's and half of it laps the avatar — but ChatKit gives
  the frame's size and nothing about its origin. The component bottom-aligns it with the avatar.
- The close button's size. ChatKit gives it a left padding of 22 and no size; the component uses the
  tally's own 27 box.
- Whether the tallies are vertically centred on the avatars' band (what the component does) or on the
  whole 66 pt content box.
- Where the platter's leftover height goes (2 pt on iOS, 10 on macOS).
- Every duration and curve. The component borrows `message-actions.tsx`'s own entrance for the
  sibling attribution card (200 ms on `cubic-bezier(0.2, 0.95, 0.3, 1)` from `translateY(-8px)
  scale(0.9)`) and the measured `messageActionsTiming.exit` of 220 ms to `scale(0.72)`. ChatKit's own
  `-[CKUIBehavior tapbackDismissalDuration]` = 0.5 s (the picker's) and
  `+[ChatKit.StyleSupport tapbackStartingScaleX/Y]` = 0.3 (the balloon's pop-in, already
  `tapbackAppear`'s) are recorded on `tapbackDetailsPlatterMotion` and not used.
- That a tally filters the cells. `TapbackAttributionViewModel` carries a `_selectedItem`, so one
  tally being selected is the framework's idea; that selecting it narrows the cells is this kit's.
- A collapsed state. `votingViewExpandedTally…` and `ACCESSIBILITY_EXPANDED_TAPBACK_FORMAT` both say
  "expanded", so one exists; no capture shows it and the component does not invent one.

### Lab

`/lab/tapback-details?scene=ios|ios-one|ios-many|macos|platter|platter-macos|platter-many&theme=light|dark&progress=0..1&filter=type:love`.
The iOS scenes place the platter by ChatKit's own rule, reading the rendered balloon's top rather
than typing a number in. `hairline-scan.ts` on `?scene=ios-one` at 3x reports **0 runs**; on
`?scene=platter` it reports one 5 pt run at y 30.33, which is an edge inside the 👍 emoji's own
artwork and not a shape seam. No mismatch ratio can be quoted for this surface: there is nothing to
diff it against.

## iOS photo picker (`registry/imessage/photo-picker.tsx`)

Measured 2026-09-08 from `references/ios/captures/photo-picker-light.png` (iOS 26.0, iPhone 17 Pro,
402x874 at 3x), which is the only capture of this surface in the repo: light, collapsed, nothing
selected. There is no dark capture, no selected tile, no expanded sheet, no Albums or Search, and
nothing anywhere showing a selection sitting in the composer.

**Correction to line 164.** That line records the picker's grid as "tiles approx 126 pt, 4 pt gaps,
radius 12". All three are wrong and the third is wrong by a factor of five. Measured: tiles
**129.364 x 129.5633**, gaps **1.6207** (4.862 device px, not the 12 device px "4 pt" claims), tile
radius **2.3** (6.9 device px, not 36). `group-details.tsx` line 66, `group-details.tsx` line 110 and
`ios-details.tsx` line 54 all cite "radius 12 measured on photo-picker-light.png" and carry the error
into their own photo strips; they need the same correction. Line 164 is not rewritten here because
this file is append-only for this session.

### Panel

| Part | Value | How |
|---|---|---|
| Inset, left/right/bottom | 5.3333 (16 px) | white run x 16-1189; bottom-most white row 2605 of 2622 |
| Width / height / top at 402x874 | 391.3333 / 383.6667 / 485 | grid top 1455 px, panel bottom 2606 px |
| Fill | `#ffffff` | flat over the whole empty area below the grid |
| Top corner | superellipse n 2.204 R 39.0 (rms 0.84 px); best circle 36.1667 (rms 0.94) | 109 sub-pixel boundary points |
| Bottom corner | superellipse n 2.204 R 57.5833 (rms 0.90 px); best circle 53.5 (rms 1.27) | 183 points. 57.58 + 5.33 = 62.9, the display radius |
| Shadow / scrim | none | the blurred backdrop reads a flat 244-246 up to the panel edge |
| Composer above it | field bottom 463.6667, panel top 485, so a 21.3333 gap | and the composer stays **whole**: `+`, "iMessage" placeholder and mic all drawn, unlike the plus-menu state at line 162 |

### Grid

Three columns flush to the panel on three sides, **1.6207 (4.862 px)** between tiles on both axes
(three independent seam fits: 4.870, 4.859 across, 4.858 down). Tiles **129.364 x 129.5633** - the
columns average 388.09 device px and the rows 388.69, a real 0.6 px difference that repeats in both
rows, so the component keeps the aspect rather than squaring the tile. Tile corner **2.3**: nine
corners that meet clean white were each fitted as a rounded rect against sub-pixel coverage, with the
photo colour taken from a plane fitted to the tile's own interior; sRGB blending beats linear (mean
rms 0.168 against 0.207) and the nine radii come out 6.55-7.97 device px, median 6.87, rms-weighted
mean 6.94.

### Grabber

**35 x 4.6667**, top **5.0** below the panel, centred, capsule. A five-parameter 2D area fit over
2640 capture pixels returns 105.000 x 14.000 device px at top 15.000, centred on x 603.000 against a
panel centre of 603.000, rms 0.028 of coverage; the width and height hold at exactly 105 and 14 for
every corner radius the fit is given. Rows 1469 and 1484 carry zero ink at every x sampled, so the
pill is 14 device px tall with no rim to subtract.

This **supersedes the `{36, 5}`** that `photo-picker.tsx` and `sticker-picker.tsx` carried from
`-[_UIGrabber intrinsicContentSize]`. A Catalyst probe confirms the framework value is real
(`_UIGrabber` is 36 x 5, `cornerRadius` 2.5, subviews full-bleed) and that
`-[CKAppGrabberView layoutSubviews]` puts one at **y 5.0** centred in a 391.3333-wide header - so the
*top* matches the capture exactly and the *size* does not: 36 x 5 rasterises to 108 x 15 against a
measured 105 x 14, and 105/108 = 0.972 while 14/15 = 0.933, so it is not a scaled `_UIGrabber`
either. `sticker-picker.tsx` line 118 still cites the old number and should be corrected to
35 x 4.6667 at radius 2.3333, top 5.0.

### Selection badge (PhotosUICore, not a capture)

No capture shows a selected tile. A Catalyst probe (`clang -target arm64-apple-ios26.0-macabi`,
dlopen `PhotosUICore`, `-[UIDevice userInterfaceIdiom]` swizzled to Phone) gives the whole badge:

- `+[PXSelectionBadgeUIViewTile preferredSize]` = **26 x 26**.
- `-[PUPhotosGridCell layoutSubviews]` at a 129.364 x 129.5633 cell puts it at
  `{99.864, 100.0633, 26, 26}`: **3.5 trailing, 3.5 bottom**. With 22 of ink in a 26 box, the visible
  disc is **5.5** from the tile's trailing and bottom edges.
- The badge is a `UIImage` whose `CGImage` is 52 x 52 at scale 2. Read at that native size: the alpha
  edge is hard and the disc spans exactly 44 of 52 px in both axes, so the ink is **O 22.0**; the
  white rim integrates to 3.0898 px = **1.5449**, leaving a blue disc of **O 18.9102**; the blue is
  exactly `rgb(0 136 255)`, the kit's own measured iOS blue.
- The check is a round-capped, round-joined polyline. A seven-parameter least-squares fit against the
  white coverage of 928 pixels of that image, supersampled 8 x 8, gives stroke **1.4248** and
  vertices **(-4.408, 0.941) (-1.334, 4.670) (3.957, -3.645)** from the badge centre, rms 0.0125.
  The component's SVG diffed against that same badge composited on white, at dpr 2 over the 26 pt
  box, is **1.26%** (34 px of 2704), all of it on the check's anti-aliased edges.

An **unselected** tile carries no badge at all. That is a measurement, from the capture: nothing is
selected there and no tile shows an empty ring, unlike the Photos app's select mode.

### Still unverified for this surface

- **The dark palette.** The Catalyst probe cannot stand in for a dark capture: under Catalyst the
  colour catalog is the macOS one whatever the idiom trait says. `+[UIColor systemBackgroundColor]`
  resolves dark to `#1e1e1e` where iOS is `#000000`, and `secondarySystemBackgroundColor` resolves
  light to `#ececec` where iOS is `#f2f2f7`. The panel is `#ffffff` in light, which is both
  `systemBackground` and `secondarySystemGroupedBackground`, and those two disagree in dark
  (`#000000` against `#1c1c1e`), so even the right token is undecided. `#1c1c1e` panel, `#2c2c2e`
  tile and 30% white grabber are guesses.
- **Both durations and both curves.** 380 ms in and 220 ms out are the long-press menu's measured
  pair, borrowed the way `ios-plus-menu.tsx` and `sticker-picker.tsx` borrow them; the curves are
  invented. Nothing records this panel moving. The panel translates and does not fade: the away pose
  is `height + inset`, which puts the panel's top exactly on the screen's bottom edge (verified in
  the browser: 874.016 at progress 0 on an 874 screen).
- **The expanded detent** - its 703.6667 height, the 24 pt drag strip, the halfway snap, and
  everything the header draws (the "Recents" title, the Albums button, and where the search row
  sits). The search row's own 44 / 34 / SF Medium 17 and its `tertiarySystemFill` are framework
  values, re-read here as `rgb(118 118 128 / 0.12)` light and `/ 0.24` dark.
- **The composer attachment chip** (`PhotoPickerAttachments`). Nothing captures a selection in the
  composer and ChatKit only offers `-[CKUIBehaviorPhone entryViewAttachmentHorizontalOffset]` = -5
  and `entryViewAttachmentVerticalOffset` = 0, which place such a thing without sizing it. Its 56
  box, 12 radius, 6 gap and 20 remove button are invented.
- **The ordered badge's 13 pt number**, and the 150 ms the badge scales in over.

### Lab

`/lab/photo-picker?scene=screen|panel|badge&theme=light|dark&progress=0..1|live&detent=collapsed|expanded&selected=<ids>&open=0|1&count=<n>`.

`scene=screen` reconstructs the capture at 402x874; `scene=panel` is the panel alone on the
backdrop's own grey; `scene=badge` is a 26 pt box holding only the selection badge, for the diff
against PhotosUICore's own image described above. The tiles are the registry's gradient
placeholders, never Apple's sample photographs, so only the regions both sides draw the same way
carry a meaningful ratio:

| Region (pt) | What it tests | Mismatch |
|---|---|---|
| 0 810 402 64 | the 5.3333 inset, both bottom corners, the panel's bottom edge | **0.00%** |
| whole frame | nothing: the grid is placeholders against photographs | 23.80%, not comparable |

The grabber cannot be diffed - it sits over a photograph in the capture and over a gradient in the
lab - so it is verified by re-running its own 2D fit on the render instead: the rendered pill
measures **105.000 x 14.000 device px at top 15.000, centred on 603.000**, identical to the capture.
The rendered gap seam measures 4.852 device px against the capture's 4.844 on the same estimator.
`hairline-scan.ts` on `?scene=panel&progress=1` at 3x reports **0 runs**.

## iOS group conversation details

`registry/imessage/group-details.tsx`, lab `/lab/group-details`. Long form, with the probe source and
its two renders, in `references/group-details.md` and `references/group-details/`.

**No capture in this repo shows a group.** `references/ios/captures` holds 41 iOS frames and none of
them is a group conversation: `details-light.png` / `details-dark.png` are the *one-to-one* details
screen, and `grouped-light.png` is named for message clustering and is a two-person thread. So this
surface has no mismatch ratio, and every number is one of three things.

**Shared with the measured one-to-one screen** — imported from `ios-details.tsx`, not restated:
`iosDetailsMotion`, `iosDetailsMorph`, `iosDetailsCollapse`, `IosSwitch`, `subpixel`. Back circle Ø44
at (16, 62); photo slot Ø80 at (161, 62); name box top 146.15 at 28px/33px bold; action circles Ø54
with centres on y 222.667 on a 74 pt pitch (three of them measure x 127 / 201 / 275); cells x 16–386,
radius 26 continuous, 20 apart, first top 269.6667; row inset 16; text row 52; the 1 pt separator as
the last point of the row *above* a boundary; the fills and colours; σ18 under a 49% / 59% scrim.

**Read out of ChatKit 26 by rendering it and measuring the render.** `references/group-details/probe.m`
is an iOS app that dlopens the simulator runtime's own ChatKit, lays the real cells out at the
measured 370 pt cell width, dumps every frame to `chatkit-tree.txt` and is screenshotted at 402 × 874
pt @3x as `chatkit-cells-{light,dark}.png`:

- **The details header photo is the Snowglobe stack, not the pancake.** A Ø80 `CKAvatarView` given
  three contacts draws faces at x 9.667–47.667, y 32.333–61.333 and x 22.667–46.333, which is
  `group-avatar.tsx`'s `snowglobeSlots(3)` scaled to 80 to within a third of a point, over a
  full-diameter plate measuring #f4f5f5 on white and #1f1f20 on black. `CKDetailsAvatarPancakeView` —
  Ø37 heads on 13.333 steps in a 41 pt box behind opaque Ø41 cut-outs — is
  `CKDetailsGroupHeaderCell._avatarView`, a row cell with a collapsed-state configuration; the header
  photo is `CKGroupPhotoCell._groupView`. `detailsAvatarPancakeViewWidth3Avatars` is 72, not 64.
- Participant row 64 (`+[CKDetailsContactsStandardTableViewCell preferredHeight]`), avatar Ø37 at 8,
  name at 8 + 37 + 12 in **17 semibold at the full label colour**, and the cell's own hairline inset
  to that name column (65 in this screen's 16 pt geometry).
- Add row 44, button Ø37 at rgba(118,118,128,0.12 / 0.24) — measured #efeff0 on white and #323236 on
  the cell's #1c1c1e — with a plus of **13.6667 × 13.6667 pt of ink on a 1.4444 stroke**. Its label is
  **"Add Contact"** (`ADD_CONTACT`), which is what the cell renders.
- `+[CKDetailsGroupCountCell preferredHeight]` 22, `+[CKDetailsShowMoreContactsCell preferredHeight]`
  44, `CKDetailsGroupNameCell` = `_phoneButton` + `_facetimeVideoButton` only.
- The contact cell's own chevron measures 7.00 × 12.00 pt of ink at #c5c5c7. It is **not** used: the
  only chevron measured off a capture here is the nav bar's 4.67 × 12.67 at 2.6 stroke, #bdbdbd /
  #5d5d5d, which `ios-details.tsx` already paints on the same kind of row.

**Unmeasured**: every duration; the section order (participants, Hide Alerts, shared content,
destructive last — `ios-details.tsx`'s own order); the shared-content cells and the 110 photo tile;
the group-count subtitle's position (opt-in, so the default header is the measured one); centring an
even number of action circles about x 201; swipe-to-remove a participant, which is not built.

**Two device-pixel facts the lab does prove.** The first cell's fill starts on device row **809**
(269.6667 × 3), the row `details-light.png` starts it on — the old scroller was an absolutely
positioned box that Blink snapped to 270.0. And the hairline between the first two participant rows
occupies device rows **997–999**, the last point above the 333.6667 boundary, which is the captures'
convention (`details-light.png`: rows 1234–1236 for a boundary at 412.33). `hairline-scan.ts` on
`/lab/group-details?scene=settled` at 3x reports **0 runs**, and with six cells the entrance's last
animation ends at 352 ms against `iosDetailsMotion.enter` = 360.

**Correction to the older "Details" line in "iOS extra states" above.** That line records the
one-to-one screen as "avatar Ø80 centered at (201, 103), name 26pt bold, three round glass buttons
… Ø52 at x 127/201/274 y 222, grouped cells (radius 24, x 16–386)". Four of those are stale.
`ios-details.tsx`, which SPEC's own fidelity table records at 0.08% against that same capture, uses
centre **(201, 102)**, circles **Ø54** at x **127 / 201 / 275** with centres on y **222.667**, and
radius **26**. The component is right and the prose is not; it is left in place rather than edited
because that section belongs to another surface's notes.

## The audio recorder (`registry/imessage/audio-recorder.tsx`)

Recording a voice message: the composer's field becomes a row with a live waveform, a running timer
and a stop button; stopping swaps the stop for a play control, a duration pill that appends to the
take, and a send pill.

**No capture on either platform shows this surface, and none could be made.** The iOS 26.0 simulator
is installed and its Messages composer's mic button is visible in `references/ios/captures/conv3-light.png`
at x≈353, but reaching the recording state needs a tap, and this project forbids sending pointer
events to the user's Mac. So the whole surface was read out of **ChatKit 26.5** instead, with a Mac
Catalyst probe whose **full source and full output are committed in `references/audio-recorder.md`**.
Everything in this section is reproducible by compiling and running that file.

### How the probe reads it

`dlopen` ChatKit; swizzle `-[UIDevice userInterfaceIdiom]` so `+[CKUIBehavior sharedBehaviors]` vends
the Phone or the Mac behaviour (`+testOverrideClearSharedBehaviors` between the two); stub
`+[IMService iMessageService]`, which `ChatKit.AudioMessageRecordingView.init(frame:)` force-unwraps
and which is nil outside Messages; then **build the real view** with
`-[CKAudioMessageRecordingView initWithFrame:service:]`, feed it known levels through
`-addToWaveformWithIntensity:`, walk `-setState:` and read every subview's frame, radius, colour,
font and symbol image back. Its four states are 0 empty, **1 recording, 2 stopped, 3 playing**.

Two traps: build a *fresh* view per state (repeated `-setState:` accumulates segment views, 44 become
90), and never force the frame height — `-sizeThatFits:` returns **52 on Phone and 49 on Mac**, and
forcing 52 on Mac turns its 36.75 waveform into 39 and its 62.5 × 27 pill into 66.5 × 29.

### `CKUIBehavior`

| Selector | Phone | Mac |
|---|---|---|
| `audioRecordingViewButtonSpacing` | 16 | 16 |
| `audioRecordingViewDurationSpacing` | 12 | 12 |
| `audioRecordingViewPadding` | 18 | 18 |
| `audioRecordingViewTimeBetweenWaveformSegments` | 0.0833333 | 0.0833333 |
| `audioRecordingViewMinimumDBLevel` / `MaximumDBLevel` | −60 / −10 | −60 / −10 |
| `waveformPowerLevelWidth` / `audioWaveformGapWidth` | 2 / 2 | 2 / 2 |
| `audioWaveformHeight` / `audioWaveformViewHeight` | 35 / 39 | 35 / 39 |
| `minimumWaveformHeight` | 4 | 4 |
| `minAudioRecordingDuration` / `maxAudioRecordingDuration` | 0.25 / 60 | 0.25 / 60 |
| `audioMessagePeakAnimationDuration` | 0.5 | 0.5 |
| `waveformMinPowerLevelsCount` / `MaxPowerLevelsCount` | 25 / 50 | 25 / 50 |
| `audioBalloonTimeFont` | SF Regular **13** | SF Regular **16** |
| `entryViewConcentricPadding` | **28** | **11** |
| `entryViewCoverMinHeight` | **40** | **30** |
| `entryViewPlusButtonToTextFieldPadding` | **12** | **10** |
| `entryViewEmojiButtonToTextFieldPadding` | 10 | 10 |
| `entryViewLeftInsetForRecordedAudioCancelButton` | 8.5 | 8.5 |

The last four corroborate the composer measurements above from a second, independent source: iOS's
28 of padding, its measured 12 gap from the `+` to the field and its 40-tall field, and macOS's 11
above the pane bottom, its measured 10 gap and its ~30-tall field, are all ChatKit constants.

`waveformMinPowerLevelsCount` 25 / `MaxPowerLevelsCount` 50 govern the **balloon's** waveform, not
this view: the recording view draws every bar that fits its box (45 in 181.5, 104 in 415).

### The row, from the built view

`sizeThatFits` → **52 tall on Phone, 49 on Mac**. Every child is vertically centred, and — this
reproduces all twelve measured child frames exactly — **each child's leading or trailing inset equals
its own vertical inset**, `(rowHeight − size) / 2`. Every gap is `audioRecordingViewDurationSpacing`
12, except the waveform's leading inset while recording, which is `audioRecordingViewButtonSpacing`
16 because there is no play button beside it.

| | leading | waveform | trailing chain | closes on |
|---|---|---|---|---|
| Phone recording | 16 | **181.5** | 12 + timer 29.5 + 12 + stop 34 + 9 | 294 |
| Phone stopped | 9 + play 34 + 12 | **109** | 12 + pill 61 + 12 + send 30 + 15 | 294 |
| Phone playing | 9 + play 34 + 12 | **140.5** | 12 + timer 29.5 + 12 + send 30 + 15 | 294 |
| Mac recording | 16 | **415** | 12 + timer 35 + 12 + stop 31 + 9 | 530 |
| Mac stopped | 9 + play 31 + 12 | **348** | 12 + pill 62.5 + 12 + send 30 + 13.5 | 530 |
| Mac playing | 9 + play 31 + 12 | **375.5** | 12 + timer 35 + 12 + send 30 + 13.5 | 530 |

- circles Ø **34** Phone / **31** Mac, radius half, inset 9;
- send `CKGlassSendButton` **30 × 22 radius 11**, inset 15 / 13.5;
- the duration pill `ChatKit.AudioMessageRecordingAppendButton` is **29.5 × 16 r8** (Mac 35 × 19 r9.5)
  while recording and while playing, and **61 × 26 r13** (Mac **62.5 × 27 r13.5**) once stopped, where
  its label sits at (21.5, 5, 29.5, 16) / (20, 4, 35, 19) and the `plus` is drawn into an
  **11.5 × 10.5** image box at (7, 8) / (5.5, 8.5). The whole pill is one button: it appends;
- the waveform view is **0.75 of the row** — 39 in the 52, which is `audioWaveformViewHeight`, and
  36.75 in the 49 — vertically centred, top 6.5 / 6.125.

### The waveform

Bars **2 wide, radius 1, pitch 4**, vertically centred, the strip anchored to the box's **trailing**
edge, so `count = floor((W − 2) / 4) + 1` and the leftover `W − 2 − (count − 1) × 4` is a hole at the
**leading** edge (3 in a 109 box: measured, not a defect).

**`height = level² × audioWaveformViewHeight`, floored at 4.** Feeding a ramp and reading the
segments back gives every value exactly:

| level | 0.1 | 0.2 | 0.3333 | 0.4 | 0.4444 | 0.5 | 0.6 | 0.6667 | 0.75 | 0.8 | 0.9 | 1.0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bar | 4 | 4 | 4.3333 | 6.24 | 7.7037 | 9.75 | 14.04 | 17.3333 | 21.9375 | 24.96 | 31.59 | 39 |

It scales to the **view** height 39, not to `audioWaveformHeight` 35; a full-scale bar fills the box
edge to edge. Everything below level 0.3203 clamps to 4.

While recording, the newest bars ramp in: a bar `k` segments back is scaled by **`min(1, √(k/4))`**,
and the `k = 0` bar is additionally at opacity 0. Measured at level 0.8 (`level² × 39` = 24.96):
k = 0 → 4 (the clamp), 1 → 12.48, 2 → 17.6494, 3 → 21.6160, 4 → 24.96, 5 → 24.96, i.e. 0, 0.5,
0.70711, 0.86603, 1, 1. Slots ahead of the take are drawn at the minimum height and 0.5 opacity.

Once stopped the take is resampled **up** to the bars that fit by **nearest neighbour**, bar `j`
taking level `floor(j × n / count)`: 5 levels in a 27-bar box measured as runs of 6, 5, 6, 5, 5. The
played part is **`max(1, floor(fraction × count))`** bars, checked at nine positions from 0 to 1
(1, 3, 6, 10, 13, 16, 20, 23, 27 of 27).

### Colours, `-resolvedColorWithTraitCollection:` in both styles

| | light | dark |
|---|---|---|
| recording bars, timer ink, stop glyph | `#FF383C` | `#FF4245` |
| stopped / playing bars | `rgba(0, 0, 0, 0.498)` | `rgba(255, 255, 255, 0.549)` |
| bars not yet played | ×0.5 opacity | ×0.5 opacity |
| play button fill | `rgba(118, 118, 128, 0.12)` | `rgba(118, 118, 128, **0.24**)` |
| play glyph, stopped pill ink, cancel glyph | `rgba(0, 0, 0, 0.847)` | `rgba(255, 255, 255, 0.847)` |
| stop button fill | `rgba(255, 56, 60, 0.19)` | `rgba(255, 56, 60, 0.19)` — the same |
| stopped pill fill | `rgba(116, 116, 128, 0.08)` | `rgba(116, 116, 128, 0.08)` — the same |
| pill fill while recording or playing | none | none |
| send | `#0088ff` with white | `#0088ff` with white |

### Glyphs

Each control's own symbol image, rasterised as a template at 8x:

| control | symbol | image | ink | coverage |
|---|---|---|---|---|
| stop | `stop.fill` 17 regular | 18 × 16 | 14 × 14 | 180.3853 |
| play | `play.fill` 17 regular | 15 × 16 | 12.5 × 14 | 101.8686 |
| pause | `pause.fill` 17 regular | 14.5 × 16 | 10.5 × 14 | 110.7490 |
| append | `plus` 17 regular | 18 × 16 | 14 × 14 | 37.4529 |
| send | `arrow.up` 17 **bold** | 17.5 × 19 | 13.5 × 16 | 68.9608 |
| cancel | `xmark` **16 medium** | 17 × 16 | 13 × 13 | 55.3471 |

The cancel `xmark` was identified by sweeping every point size from 14 to 20 against all nine
weights: 16 medium is the only configuration that hits 17 × 16 / 13 × 13 / 55.3471 exactly.

Outlines fitted to both the ink box and the coverage: `stop.fill` a 13.52 square with a 1.69 corner;
`play.fill` a triangle inset by a 1.93 round join; `pause.fill` two 4.1 bars 2.3 apart with a 1.5
corner; `plus` a 1.4442 stroke across the 14 box; `arrow.up` a **2.4098** stem with arms at 45°;
`xmark` 1.68. The arrow's 2.4098 is the same weight `conv3-light.png` gives the composer's send pill
(2.41 measured there) but not the same drawing — that pill is 38 × 28 and this one 30 × 22.

The `xmark` is the one fit where the two measures disagree: its rows integrate to 4.9588 of ink, i.e.
1.7532 of stroke at 45°, while its total coverage wants 1.68. 1.68 is drawn.

### The cancel button, `CKGlassCancelAudioRecordingButton`

`-sizeThatFits:` → **41 × 41 radius 20.5** on Phone, **35 × 35 radius 17.5** on Mac; a circle, glass
(its configuration's background colour is transparent — the material is a `UIGlassEffect`), glyph box
17 × 16 centred, ink 84.7% label.

### Motion

`AudioMessageRecordingView`'s Swift ivars, read at their offsets: `stateChangeAnimationDuration`
**0.6**, `stateChangeSpringDamping` **0.86**, `minimumWaveformWidth` **30**.

### Still unverified for this surface

- **Where the row sits in the composer.** `entryViewLeftInsetForRecordedAudioCancelButton` is 8.5 on
  both idioms, which is neither iOS's measured 28 of composer padding nor macOS's measured 9 to the
  `+`, so its frame of reference could not be established and the component does not use it. It
  instead centres the cancel circle on the **measured** centre of the `+` it replaces (iOS x 48;
  macOS pane x 24) and gives the row the **measured** field box (iOS x 80–374; macOS pane x 49–579),
  both resting on the composer's measured bottom (iOS y 846, macOS pane y 629) because every other
  element of both composers is bottom-aligned there. That puts the iOS row at y 794–846 and the macOS
  row at pane y 580–629, and leaves a gap of 11.5 / 7.5 between the circle and the row. Derived from
  measurements; not measured.
- **The row's corner radius.** `-[CKAudioMessageRecordingView cornerRadius]` is 0 until the entry view
  sets it and the framework stores nothing that says what. Drawn as a capsule, 26 / 24.5.
- **The row's fill, rim and shadow**, which are copied from the two measured composer files.
- **The entrance and the exit** (260 / 200 ms on the measured `cubic-bezier(0.32, 0.72, 0, 1)` of the
  iOS effects screen — a reuse, not a measurement of this).
- **The spring's frequency.** UIKit derives it from the 0.6 / 0.86 pair above and stores it nowhere,
  so the `linear()` easing samples the spring whose envelope has decayed to 0.1% at 0.6 s. A fit.
- **Whether the strip slides between segments.** ChatKit lays every bar on the 4 pt grid, so its model
  steps 4 pt twelve times a second; whether its display link interpolates cannot be read from a view
  that never runs. The component slides by `4 × frac(t / segment)`, which is the smallest continuous
  interpolation of the measured layout and is exactly ChatKit's frame at every whole segment.
- **The gestures.** Press-and-hold to record, swipe-up to cancel and slide-to-lock have no
  measurement and no framework constant that describes them; they belong to the composer's mic button
  rather than to this row. What ChatKit *does* specify, and the component now honours, is
  `maxAudioRecordingDuration` (60 s auto-stop) and `minAudioRecordingDuration` (a take under 0.25 s
  reports `onCancel`, not `onStop`).
- **`audioMessagePeakAnimationDuration` 0.5** belongs to the balloon's peak animation, not to this
  view; it is recorded above and deliberately unused.

### One number this settles elsewhere

`audioBalloonTimeFont` is named for the **balloon's** time label and reads SF Regular **13 on Phone
and 16 on Mac**. `message-audio.tsx` currently guesses 13 iOS / **11** macOS for that label and is
listed as provisional above. If the probe reading applies there, the macOS 11 is 5 pt low. That file
is not this component's to change; the reading is recorded here so whoever owns it can act on it.

### Lab

`/lab/audio-recorder?platform=ios|macos&state=recording|stopped|playing&theme=light|dark&t=<seconds>`,
plus `run=1` (drop the seek and let the row run its own clock), `open=0` and `enter=<0..1>` (pose the
exit), `from=<state>&tprog=<0..1>` (pose the state change), and `guides=1` (outline the measured
composer field the row has to land on). iOS renders 402 × 874, macOS the 630 × 640 conversation pane,
both at the composer's measured position, so a future capture drops straight onto it with
`compare.ts` and the composer band as the crop: iOS `0 780 402 94`, macOS `0 570 630 70`.

No mismatch ratio can be quoted for this surface: there is nothing to diff it against. What *is*
checked is the rendered geometry against ChatKit's own frames — row, waveform, timer, play, stop,
send, bar count and leading gap, across three states and both platforms, all within 0.06 px, with the
bar heights within 0.014 px of `level² × viewHeight × min(1, √(k/4))` and the played count exact.

## Group avatar (`registry/imessage/group-avatar.tsx`)

**This surface now has a capture, and it did not before.** Nothing in `references/ios/captures` or
`references/macos/captures` shows a group conversation — `grouped-light.png` is message *grouping*
in a two-person thread, `details-light.png` is a one-to-one details screen — so it was captured on
purpose. `references/group-avatar/snowglobe-light.png` and `snowglobe-dark.png` are
`xcrun simctl io booted screenshot` of the iPhone 17 Pro simulator on iOS 26.0 (1206 × 2622 = 402 × 874
pt at 3x, this repo's own iOS capture geometry) running a throwaway app that `dlopen`s the simulator
runtime's `ContactsUICore` and `ChatKit` and lays out real `CKAvatarView`s over `CNMutableContact`
fixtures. Every circle, monogram, gradient and blur in them is Apple's code in a live window.
`material-swatches-{light,dark}.png` beside them are nine flat colours half-covered by a bare
`.systemThinMaterial` plate. They are *not* screenshots of Messages — the simulator cannot hold an
iMessage group — they are the same view Messages instantiates. Layout, the file list and how to
re-take them: `references/group-avatar.md`.

### The stack

`CKAvatarView` is a `CNAvatarView`; ContactsUICore lays the faces out through
`+[CNUIAvatarLayoutManager layoutConfigurationsForType:2 withItemCount:n]`
(`SnowglobeAvatarLayoutConfigurations`; type 3 is the group typing indicator's reordering of the same
circles). Each entry has `x`, `y`, `size` and `baseSize` 88, and
`-itemFrameInContainingBounds:isRTL:` is
`(midX + x·s − d/2, midY + y·s − d/2, d, d)` with `s = bounds/88`, `d = size·s`; `isRTL:YES` negates
x and nothing else. `+maxAvatarCountForType:` says 10, but 8, 9, 10 and 11 all return the same seven
configurations, so **seven faces is the cap**. Both tables are transcribed verbatim in the component
and now covered by unit tests against the framework frames at bounds 88 and against a live
`CKAvatarView` at Ø60/Ø45/Ø40 (agreement to 3 decimal places).

Three claims the file used to carry were wrong and are corrected:

- **The faces never overlap.** Minimum centre-to-centre clearance, in base-88 units: 1.598 (n=2),
  2.446 (n=3), 2.040 (n=4–6), 2.071 (n=7) — 1.09 / 1.67 / 1.39 / 1.41 pt at Ø60. The "ring" between
  the faces is the plate showing through; nothing strokes it.
- **The largest face is at the back.** A live `CKAvatarView` builds a `ContactsUICore.SnowglobeUIView`
  holding one `AvatarUIView` per person, added in table order with `zPosition` 0 on every one — so
  entry 0, the largest, paints first. (`-[CNUIAvatarLayoutItemConfiguration updateLayer:…]` does set
  `zPosition` to `−index`; a group photo does not run that path.) It never showed, because they do
  not overlap.
- **RTL** is expressible as `inset-inline-start`: a face at physical left L in a box of S with
  diameter d lands at `S − L − d` under mirroring, which is what that property does. Verified in
  Chrome at dpr 3: the n=3 Ø60 stack reads left 7.156 / 33.750 / 17.031 in LTR and 24.219 / 4.438 /
  25.250 inside a `dir="rtl"` container, against the framework's 24.205 / 4.432 / 25.227 — the
  difference is Chrome's 1/64 LayoutUnit quantisation.

### The frosted plate

`SnowglobeUIView` inserts a `UIVisualEffectView` as subview 0 filling the box, behind every face, with
`UIBlurEffect material=20`. `+[UIBlurEffect effectWithStyle:]` reports material 20 for
`.systemThinMaterial` (26 ultra-thin, 6 regular, 5 thick, 3 chrome), so that is the material. The
view's frame is square but it is **masked to a circle**: `scripts/measure/outline.py` on the Ø60
two-face stack over `#3478f6` in `snowglobe-light.png` returns bbox 60.00 × 60.00 pt, radius ~29.5 pt
on all four corners. One contact never builds a `SnowglobeUIView`, so **a single face has no plate**.

Colour, mean of 762 clean samples per cell (inside the disc, 3 pt clear of its edge and of every
face), cross-checked against the bare-material swatches to under 1/255:

| background | light | dark |
|---|---|---|
| `#ffffff` | `#f4f4f5` | `#7d7d7d` |
| `#000000` | `#8d8e8e` | `#1f1f1f` |
| `#3478f6` | `#a2c7ff` | `#264a8f` |
| `#e9e9eb` | `#ededee` | `#737373` |
| `#1c1c1e` | `#9d9d9e` | `#2a2a2a` |

A flat translucent fill fitted to the achromatic ends — `rgba(237,237,237,0.596)` light,
`rgba(49,49,49,0.632)` dark — is exact on `#ffffff` and `#000000`, misses `#e9e9eb` by 1.2/255 and
`#1c1c1e` by 4.0/255 (light; 1.7 and 0.9 dark), and misses `#3478f6` by up to 14/255 light and 22/255
dark in blue, because the material also lifts saturation. It is not a `saturate()` either: solving per
channel against the blue row gives s = 1.01 (R), 5.04 (G) and ≥1.26 (B), i.e. a per-channel luminance
curve CSS has no primitive for. The component takes the fit as its default and exposes
`--im-ga-plate` so a surface that knows its background can pin the measured colour.

An offline `-[CALayer renderInContext:]` of the same tree renders the plate as an unrounded `#f9f9f9`
square — a `UIVisualEffectView` outside a live window never installs its backdrop filters. That render
is an artefact; the simulator capture is the reading. `macos-sidebar.tsx`'s note that the plate is
"not reproduced" and that its appearance is unmeasured can now be closed.

### `avatar.tsx`, confirmed and one bug

Fitting a straight line down the Ø60 single-face circle (116 rows, glyph pixels dropped) returns
**`#a9c2e1` → `#747fb9`** in light with a max residual of 0.89/255 and **`#575368` → `#302649`** in
dark with 0.78 — the four endpoints `avatar.tsx` records, now confirmed against a capture it had never
been diffed on. The Ø6.8 face in the seven-face stack spans the same range in its own box, so the
gradient is per circle and does not stretch across the stack.

**Bug in `avatar.tsx`:** it declares `--av-top`/`--av-bottom` in the inline `style` and then tries to
override them with `dark:[--av-bottom:…]`, which an inline declaration always beats — so any `Avatar`
rendered directly keeps the light gradient in dark mode. It has never shown because
`ios-nav-bar.tsx`, `ios-conversation-list.tsx` and `ios-details.tsx` each draw their own circle.
Measured: the dark lab diff was 12.55% before and 1.00% after `group-avatar.tsx` started handing the
pair in through `style` as `var()` references. That file's own fix is to make the two declarations
`var(--…, light)` references instead of literals.

### Diameters and the transcript gutter, per behaviour object

| | Phone | Pad | Mac |
|---|---|---|---|
| `groupAvatarViewSize` | 60 | 60 | 60 |
| `conversationListContactImageDiameter` | 45 | 45 | 40 |
| `conversationListContactImageTrailingSpace` | 12 | 12 | 6 |
| `transcriptContactImageDiameter` | 32 | 34 | 28 |
| `contactPhotoBalloonMargin` | 7 | 7 | 7 |
| `transcriptGroupTypingContactImageDiameter` | 44 | 48 | 42 |
| leading gutter (`diameter + margin`) | 39 | 41 | **35** |
| `scrollInNewMessageAnimationDuration` | 0.300 | 0.300 | 0.300 |

`+[CKChatItemLayoutUtilities avatarSupplementaryItemForChatItem:layoutEnvironment:]`, run under each
idiom in turn, returns an `NSCollectionLayoutSupplementaryItem` of `.absolute(32/34/28)` square at
`zIndex` 1, `containerAnchor` `edges = 6` (`NSDirectionalRectEdge.leading | .bottom`) and
`absoluteOffset = (−32/−34/−28, 0)`. **The offset tracks the diameter**, so nothing there is hardcoded
to the phone, and the previous file's flat 32/39 was a macOS error of 4 pt per avatar.
`-[CKTranscriptAvatarSupplementaryView initWithFrame:]` builds its `CKAvatarView` at exactly
`(0, 0, d, d)` whatever frame the view is given. The anchor is why a cluster carries one avatar, on
its last (tailed) bubble, bottom flush with the balloon.

The iOS **details** header is a different stack: `CKDetailsAvatarPancakeView`, diameter 37, cut-out
41, overlap 13.5, widths 58 and 72 for two and three — `group-details.tsx` draws it.
`registry.json`'s description of `group-avatar` still says it covers "the details header"; it does
not, and that line wants correcting.

`+[CNUIAvatarLayoutManager avatarBadgeRectForAvatarInRect:badgeType:isRTL:]` for a 60 box: type 0
`(39, 0, 21, 21)`, type 1 `(45, 0, 15, 15)`, type 2 `(45, 4.5, 51, 51)`, type 3 empty. Recorded only;
nothing draws a badge.

### Lab and diff

`/lab/groupavatar?scene=snowglobe&theme=light|dark` reconstructs the capture at native geometry — same
screen, same bands, same stack origins, same seven contacts in the same order. Cropping past the
simulator's status bar and Dynamic Island (`55 55 347 500`):

| | geometry | interior mean signed | interior max abs | interior blobs |
|---|---|---|---|---|
| light | 1.10% | −0.05 | 3.33 | none |
| dark | 1.00% | −0.00 | 2.33 | none |

Every remaining pixel is edge: about 120 circle outlines and the monogram glyph edges, at 3x. The
fills, the plate colours, the face centres and the face diameters land inside 3.33/255 of Apple's own
render. `hairline-scan.ts` finds 0 hairline runs.

`?scene=gutter&platform=ios|macos&progress=0..1` draws the transcript gutter and scrubs the hand-off.
No capture backs that one — it is the supplementary-item anchor drawn out — but the rendered geometry
is checked: iOS avatar 32 × 32 at the row's leading edge, balloon at 39, gap 7, bottoms flush, typing
face 44; macOS 28 × 28, balloon at 35, gap 7, bottoms flush, typing 42.

### Still unmeasured on this surface

The **easing** of the sender-avatar hand-off (the duration is a framework constant; the curve is
`ease-in-out`, UIView's default, and marked as a placeholder). What the stack does when a
**participant is added or removed** — `CNAvatarView` exposes
`-performTransitionAnimationWithStartHandler:completion:` and no duration. Which participants occupy
which **slots** in a real conversation and whether "you" is excluded. Whether the plate reads through
the iOS **nav bar's** own material, which is not a flat colour.

## iOS photo viewer (`image-viewer-chrome-dark.png`, `image-viewer-fit-dark.png`)

Added 2026-09-08. This surface had no capture and no entry in this document until now; the full
working note is `references/image-viewer.md`.

Messages has no photo browser of its own: tapping a photo presents QuickLook through
`ChatKit.CKQLPreviewController`. That class ships in the **iOS simulator runtime**
(`/System/Library/PrivateFrameworks/ChatKit.framework`), so a throwaway simulator app can `dlopen`
it, present it over its own `QLPreviewItem`s, and be screenshotted with `xcrun simctl io`. Both
captures below were taken that way on a private iPhone 17 Pro / iOS 26.0 (23A343) device at
402×874 @3x, alongside a walk of the live view hierarchy logging every frame in window coordinates —
so the geometry is read off the runtime and the screenshot only confirms it.

### The chrome is three glass circles, not two bars

| Element | Measurement |
|---|---|
| Ground | #000000, opaque, in both themes (`PUBlackOneUpInterfaceTheme -photoBrowserChromeVisibleBackgroundColor` / `-photoBrowserChromeHiddenBackgroundColor`). Every pixel outside the fitted photo in `image-viewer-fit-dark.png` is exactly (0,0,0) |
| Safe area | `UIWindow.safeAreaInsets` = {62, 0, 34, 0}. **Not** the 54 the status bar's ink occupies (see "Conversation view chrome"): the layout inset is 62, and there is a 34 home-indicator inset the conversation captures never showed |
| Nav bar | frame 0, 62, 402, 54; its `_UIBarBackground` spans 0, 0, 402, 116 — the bar plus `barsAreaVerticalOutset` 10 |
| Close button | Ø44 glass disc at (342, 62), `accessibilityLabel` "close". The same slot as the conversation's back button, "a 44pt circle centered (38, 84)", mirrored. There is **no** "Done" text button |
| Title | none. `CKQLPreviewController` sets `navigationItem.title` to the preview item's title and the iOS 26 bar draws no title view; no text appears anywhere in the chrome |
| Bottom bar | container 0, 798, 402, 76; button row 28, 798, 346, 48 |
| Reply button | Ø48 glass disc at (28, 798), `accessibilityLabel` "reply", action `replyTapped:`, image `arrowshape.turn.up.left` (symbol box 21.333 × 17.333, ink 21.67 × 19.67). Disabled when the delegate says so |
| Share button | Ø48 glass disc at (326, 798), `accessibilityLabel` "Share", action `_actionButtonTapped:` (QuickLook's own), image `square.and.arrow.up` (symbol box 19 × 22, ink 18.67 × 24). Same slot as the list's compose button, "Ø48 centered (350, 822)" |
| Toolbar order | `[reply, flexible space, share]`. Nothing else, in a build with no chat item |
| Glass | over a (0,0,0) ground the disc interior reads #131313 = white at 7.45%; the outer edge peaks at 52/255 = a rim of white at ~14% over that fill. Glyph ink #f3f3f3. A disabled glyph peaks at 90/255 = 0.32 of the enabled ink. The blur radius is unmeasurable: the ground behind the discs is flat |
| Close glyph | X, ink 16.67 × 17.0 centred on its disc; each diagonal is 9.5 device px across a row, so at 45° the stroke is 9.5/3/√2 = 2.24 |
| Status bar | shown (`PUOneUpSettings -allowStatusBar` = 1), white ink over the black ground, and it hides with the rest of the chrome |
| Fit | the photo is fitted, never filled (`scaleToFitBehavior` 1, `minimumContentInset` 0). A 1200 × 1600 fixture in 402 × 874 lands at x 0, y 169.00, 402 × 536.00; measured 169.00–704.67 down the column at x 201 and 0–401.67 along the row at y 437 |
| Chrome auto-hide | real, not theoretical: in the capture runs the chrome was up at 1.4 s and gone by 2.6 s with no input (`chromeAutoHideDelay` 3 s, `persistChromeVisibility` 0) |

### PhotosUI values, read at the phone idiom

`PUOneUpSettings` is idiom-dependent and its `+sharedInstance` latches the idiom at first access, so a
plain Catalyst process reports **pad**. Every value below was read in a fresh process with
`-[UIDevice userInterfaceIdiom]` swizzled before the first access.

**`interpageSpacing` is 40 at idiom 0 (phone) and idiom 5 (mac), and 100 only at idiom 1 (pad).** The
component previously carried 100, so the page pitch was 502 instead of 442 and the parallax, which
divides that pitch by 12.5, was 40.16 off-centre instead of 35.36.

| Setting | Value |
|---|---|
| `barsAreaVerticalOutset` | 10 |
| `parallaxFactor` / `allowParallax` / `parallaxModel` | 12.5 / 1 / 1 |
| `doubleTapZoomFactor` / `defaultZoomInFactor` | 2.5 / 6 |
| `doubleTapZoomAreaExcludesBackground` / `…ExcludesBars` | 1 / 1 — a double tap on the letterbox or in a bar's area does not zoom |
| `chromeAutoHideBehaviorOnZoom` | 2 (raw value measured; the enum's cases are not) |
| `userNavigationMaximumDistance` | 2 — used as the page mount window |
| `bounceDuration` / `bounceDelay` / `bounceSpringDamping` / `bounceInitialVelocity` | 0.5 / 0 / 1 / 100 — this is the snap back from an **overscrolled pan** and nothing else |
| `finalFadeOutDuration` | 0.2 |
| `pagingFrictionAdjustment` / `pagingSpringPullAdjustment` | 2 / 0 |
| `allowStatusBar` / `allowScrubber` / `allowGIFPlayback` / `autoplayVideo` / `allowPlayButtonInBars` | 1 / 1 / 1 / 0 / 0 |
| `PUTilingViewSettings springAnimationDuration` | 0.3 — the open zoom, the exit, and **every** settle of the photo's transform |
| `PUTilingViewSettings transitionDuration` / `transitionChromeDelay` | 0.2 / 0 |
| `PUTilingViewSettings interactiveTransitionBackgroundDimming` | **0.5** — the ground dims to 50% under a drag-to-dismiss; it does not fade away |
| `CKUIBehaviorPhone tapbackDismissalDuration` | 0.5 |

### Method bodies (lldb against the loaded image)

- `-[CKQLPreviewController updateBarButtonItems]` is one instruction, `ret`. ChatKit builds no bars at
  all; QuickLook lays them out. `loadView` only sets `navigationBar.barStyle`.
- `-fullScreenBalloonViewControllerPickerViewUsesBottomTail:` is not a constant: it compares
  `CGRectGetMinY(tapbackButtonFrame)` against `CGRectGetMaxY(navigationBar.frame)` and returns 1 only
  when the button is at or below the nav bar's bottom (or the frame is empty).
- `-fullScreenBalloonViewControllerShouldShowReplyButton:` is `mov w0,#0; ret` — the balloon overlay
  never shows a reply button. The toolbar's is a different button and does exist.
- `-tapbackButtonFrameForFullScreenBalloonViewController:` forwards to
  `-frameForAdditionalButtonWithActionName:`: the tapback control is a QuickLook additional button.
- `-shouldShowTapbackPickerForFullScreenBalloonViewController:` forwards to the chat controller as
  `previewController:shouldShowTapbackPickerForChatItem:`. **Reacting from inside the viewer is real**,
  and it is decided per item.

### Not measured on this surface

- The **tapback and save buttons' slot in the bar and their glyphs**. `-tapbackTapped:`,
  `-saveTapped:`, `-canCurrentPreviewItemQuickSave` and the axbundle's "Save photo" all exist, but
  neither button is built without a `ckQLPreviewControllerDelegate` supplying a chat item, which a
  probe outside Messages cannot do.
- The chrome **over a bright photo**: iOS 26 glass inverts (plain QuickLook over white shows white
  discs with dark glyphs) and nothing here models the inversion. The blur radius, likewise.
- The **swipe and dismissal thresholds** and the scale the photo shrinks to on the way down.
  `PUOneUpSettings` carries no dismissal threshold.
- Where an **applied tapback balloon** sits on a full-screen photo, and its attribution.
- The **whole macOS presentation**: same Catalyst binary and `interpageSpacing` 40 at idiom 5, but no
  window capture, so the disc sizes and insets are carried over from iOS and the 16 pt top inset is
  invented.
- **Video, Live Photos, GIFs, the scrubber** — every setting for them was read; none is implemented.
- **Edit/markup and a thumbnail tray.** Plain QuickLook's nav bar carries a left index-list platter;
  ChatKit's build drops that platter entirely and neither capture shows a tray. The component has
  neither, deliberately.

### Known differences when diffing this surface

`image-viewer-chrome-dark.png` carries two things the component must not draw: the simulator's own
"◀ Messages" return-to-app breadcrumb (about x 26–180, y 76–104) and SpringBoard's home indicator
(x 129–272, y 861–866). Diff the chrome bands on their own.

| Lab | Reference | Region (pt) | Mismatch |
|---|---|---|---|
| `/lab/photoviewer?scene=fit` | `ios/image-viewer-fit-dark.png` | whole frame | **0.00%** |
| `/lab/photoviewer?scene=chrome` | `ios/image-viewer-chrome-dark.png` | 0 790 402 60 (footer) | 0.33%, interior signed 0.00 |
| `/lab/photoviewer?scene=chrome` | `ios/image-viewer-chrome-dark.png` | 330 52 62 64 (close) | 0.40%, interior signed 0.00 |
| `/lab/photoviewer?scene=chrome` | `ios/image-viewer-chrome-dark.png` | whole frame | 0.13%, and the two blobs are the breadcrumb and the home indicator |

Interior signed error of 0.00 on both bands means the disc fill, the rim and the ink are exact and the
whole remainder is sub-pixel antialiasing on the glyph outlines.

## iOS 26 sticker picker (`sticker-picker.tsx`)

**Capture: `references/ios/captures/sticker-picker-light.png` (402x874 @3x, iOS 26.0, iPhone 17 Pro,
light).** This one was not taken out of Messages. The picker's card is drawn out of process by
`com.apple.StickerKit.StickerPickerService`, so the capture was made by standing the same remote view
controller up in a throwaway simulator app:

```objc
UIViewController *vc = [[NSClassFromString(@"_UIStickerPickerViewController") alloc] init];
[vc setValue:sourceView forKey:@"sourceView"];   // a stand-in for the composer's +
((void(*)(id,SEL,CGRect))objc_msgSend)(vc, sel_getUid("setSourceRect:"), sourceView.bounds);
[self addChildViewController:vc]; [self.view addSubview:vc.view];
((void(*)(id,SEL))objc_msgSend)(vc, sel_getUid("presentCard"));
```

built with `clang -target arm64-apple-ios26.0-simulator`, installed with `xcrun simctl install`, and
shot with `xcrun simctl io booted screenshot`. UIKit presents it through
`_UIFormSheetPresentationController`, and that presentation is what the sheet numbers measure; the
card's own contents are StickerKit's, the same ones Messages hosts. The backdrop is four flat 402x60
bands (white, 50% grey, black, red) at y 100/160/220/280, which is how the dimming was solved.

**This replaces what SPEC and the component used to assume.** The sticker picker is not the plus
menu's own 322.67 x 460.67 glass box, it has no search field and no grabber, and its category strip is
at the top rather than pinned to the bottom.

### Sheet

| Part | Value | How |
|---|---|---|
| Inset (left, right, bottom) | **3.1667** | sub-pixel coverage of the single transition pixel on each edge: 3.163 / 3.195 / 3.194 |
| Top | **414.1667** | 414.122 on the centre column |
| Size | **395.6667 x 456.6667** | 402 - 2x3.1667 and 874 - 414.1667 - 3.1667 |
| Top corners | superellipse n 2.204, R **40.4167** (rms 0.70 device px) | 116 sub-pixel boundary points on the top-left arc; a free-n fit prefers n 2.80 / R 49.0 at rms 0.375 |
| Bottom corners | superellipse n 2.204, R **60.3333** (rms 1.00) | 158 points. 62.9 (the iPhone 17 Pro display corner) - 3.1667 = 59.73, so the bottom is concentric with the device, exactly as `photo-picker.tsx`'s is |
| Backdrop dim | **black at 0.20**, exact | the four known bands come back 255→204, 128→102, 0→0, (255,0,0)→(204,0,0), i.e. multiplied by 0.8 |
| Glass | white at **0.569** over the blurred, dimmed backdrop | the card reads a flat 233 over a backdrop of 204 |

The card is genuinely translucent: with a red band behind it the top of the card reads (230,222,222).

### Header, strip, empty state

| Part | Value |
|---|---|
| Header height | **63**; its row is centred on **31.3333** below the sheet's top (the title's ink y 439.0-452.0 and the close button both centre on 445.5) |
| Title | "Stickers", ink x 170.0-232.0 centred on the screen's 201, 13.0 of ink height — 17pt semibold at tracking -0.2 reproduces it to 0.33 |
| Close button | Ø **43.3333** centred (361.1667, 445.5), fill `tertiarySystemFillColor`; its X glyph is **16.3333** square. The disc's fill is only 4/255 off the card, so the Ø is a fit from the bottom edge and two chords, ±1 |
| Strip | **43.3333** tall, directly under the header; first chip's left edge **9.6667** in from the sheet |
| Chip | **43.3333** square, corner R **14.3333** (superellipse n 2.204, rms 0.68 device px over 40 points), pitch **51.3333** (43.3333 + 8) |
| Chip / EDIT fill | **`rgba(118,118,128,0.12)`**, exact: over a card of (237,230,230) it predicts (222.8,216.6,217.8) and the capture reads (222,217,218). That is `+[UIColor tertiarySystemFillColor]` |
| Category glyph | Ø **21.6667**, stroke **2.3333** |
| Pack artwork | **23** tall (both packs occupy y 487.333-510.333 exactly); 30.67 wide is the aspect those two happen to have |
| EDIT pill | **45 x 20** at x 223.5-268.5, y 488.83-508.83, i.e. **13.3333** after the last category rather than the strip's 8 |
| Selected glyph | **`#000000`** (`labelColor`) |
| Everything else | **`rgba(60,60,67,0.6)`** (`secondaryLabelColor`): the unselected smiley's core reads (130,128,132) against a predicted (129.2,129.2,133.4) |
| Empty state | headline ink y 628.3333-645.0 and 189.33 wide; body lines y 656.3333-669.6667 (158.67 wide) and 676.0-689.3333 (145.0). The block is **not** centred in the content area — it sits 36.83 above that centre |

There is **no hairline** anywhere on this card: `scripts/measure/hairline-scan.ts` reports 0 runs on
the reconstruction, and none is visible in the capture.

### ChatKit, read natively on iOS

The same throwaway app `dlopen`s `/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit` inside
the iOS 26 runtime, where the idiom really is `.phone` and `+[CKUIBehavior sharedBehaviors]` really
vends `CKUIBehaviorPhone` — no Catalyst swizzle involved, so none of this depends on the swizzle
holding.

| Value | Selector |
|---|---|
| grid inset `{8,8,8,8}`, gaps 4, cell **72.5 x 72.5**, cell corner 8 | `attachmentBrowserGridSectionInset`, `attachmentBrowserGridInterItemSpacing`, `attachmentBrowserGridMinimumLineSpacing`, `attachmentBrowserDefaultSizeForSquare`, `stickersCellCornerRadius` |
| a landed sticker is **48 x 48** | `stickerReactionSize`, and `emojiStickerTranscriptBalloonSize` agrees |
| landed rotation **3 to 10 degrees** | `minStickerReactionRotation` / `maxStickerReactionRotation` |
| stacked landings overlap **0.25** across, **0.35** down, odd rows inset **9.6**, transcript padding 0.75, text balloons +5 | `stickerReaction*` |
| preview ceilings 300 / 160 / 96, emoji tapback scale 0.8125 | `stickerDropPreviewMaxDimension`, `stickerInlinePreviewMaxDimension`, `emojiStickerInlinePreviewMaxDimension`, `emojiTapbackScaleFactor` |
| `stickerPopoverSize` 393 x 680, `browserViewControllerSheetDetentStyle` 0 | quoted for the record: neither describes the phone sheet the capture measures |

### The drag, measured off the live class

`-[CKBrowserDragStickerView animateScaleDown]` was called on a real instance and the animation read
back off its layer: a `CASpringAnimation` on `transform.scale.xy`, **fromValue 1, toValue
0.7142857142857143**, `duration` 0.91, `speed` **0.8** (so **1137.5 ms** of wall clock), `fillMode`
forwards, `timingFunction` **(0.14028 0.004662; 0.57534 0.96737)** — the same function
`+[CKBrowserDragStickerView springAnimationWithKeyPath:speed:]` installs (damping 400, stiffness 300,
mass 2; overdamped, so `settlingDuration` comes back FLT_MAX and the 0.91 is the whole of it).

So **there is no lift**. The same instance reports `initialSize` {72,72}, `rasterizedImageSize`
{72,72}, `dragViewScaleUp` **1** and `initialScale` **1**: `dragViewScaleUp` is a rasterisation
correction, not a lift factor, and the only scale ChatKit applies to a carried sticker is the shrink
to 5/7. Anything that reads 1/0.714285 as a 1.4x lift has the sign backwards.

`attachElasticEffectsForLocation:` builds five `CKElasticFunction`s (a tension/friction spring,
`x'' = -T(x - input) - F x'`), read straight off the instance:

| Channel | tension | friction | omega | zeta |
|---|---|---|---|---|
| position x, y | 550 | 20 | 23.45 rad/s | 0.426 |
| rotation | 350 | 15 | 18.71 | 0.401 |
| scale x, y | 350 | 20 | 18.71 | 0.535 |

All three are underdamped, so a carried sticker lags the finger and overshoots. The class also carries
`setUpPeelLayers`, `peelMaskLayer`, `meshLayer`, `perspectiveLayer` and `shineLayer`: the real drag
peels the sticker off the sheet in 3D with a mesh warp and a shine, which this kit does not draw.

### Still unverified for this surface

- **The grid.** Recents was empty in every capture and switching category needs a tap into an
  out-of-process card, so no frame shows a sticker cell. The component uses ChatKit's *attachment
  browser* grid (inset 8, gap 4, cell 72.5 → five columns of 72.7333 across the measured width) and
  says so; it is not a measurement of this card.
- **Dark.** No dark capture of the card exists; every dark value is the iOS system pair of a measured
  light one, and the glass is `ios-plus-menu.tsx`'s measured dark glass.
- **The sheet's entrance and exit.** Nothing records them. 380 / 220 are the long-press menu's
  measured open and exit, the same borrow `photo-picker.tsx` makes.
- **The half-second before the shrink.** `animateScaleDown` is measured; the `dispatch_after` that
  calls it is not, so `drag.scaleDelay` is judgement.
- Which categories a device shows, and the type of the EDIT pill (11pt semibold at tracking 0.1
  reproduces the measured ink to 1.3 of width).

### Lab and diff numbers

`/lab/ios-sticker-picker?scene=capture&theme=light` reconstructs the capture, backdrop bands included.

| Region (pt) | What it checks | Mismatch |
|---|---|---|
| 0 820 402 54 | the 3.1667 inset and the R 60.3333 bottom corners | **0.19%**, interior signed 0.86 |
| 0 405 402 30 | the 414.1667 top and the R 40.4167 top corners | **0.16%** geometry, with a tint: the glass cannot reproduce native's blur of the red band |
| 0 414 402 63 | the header | **0.73%** |
| 8 477 60 44 | the selected chip and its glyph | **0.70%** |
| 218 477 60 44 | the EDIT pill | 1.93% |
| 0 477 402 44 | the whole strip | 6.83% — the two pack tabs are placeholders, not Apple's artwork |

A whole-frame number is dominated by the glass: the sheet blurs the four bands and Chromium renders
every `backdrop-filter: blur()` radius on such an element alike, the same limit `ios-plus-menu.tsx`
documents. Read the bands, not the frame.

Note that the "Edit-in-place, and the sticker and Genmoji pickers, are not built" line in **Still
unverified** above is now wrong about the sticker picker; it is left alone because that section
belongs to another surface's notes.

## Captures that had no lab (`app/lab/macos-pane`, `app/lab/crop`)

A sweep of every lab/capture pair found captures nothing reconstructs. The four macOS conversation
pane crops were the largest hole: `/lab/macos-chrome?scene=pane` draws the header and the composer
over an **empty** pane and `/lab/list?platform=macos` draws the log with **no** header and **no**
composer, so neither is a reconstruction of a capture, and every macOS bubble number above was being
checked against half a scene. `/lab/macos-pane` closes that; `/lab/crop` gives the standalone crop
files a page whose origin is their origin, which is the only way `compare.ts` can diff one.

### The four pane captures are one conversation at three moments

`conversation-pane-{light,dark,dark-2,light-partial}.png` are all crops of window x 330–960 of the
same self chat, so one fixture serves all four and only the cut differs: `-light-partial` ends at
"Blue for iMessage." (and starts at window y 150, hence 630 × 490), `-dark` at "Sounds good 👍",
`-dark-2` runs to the end of the tail-test run, and `-light` is `-dark-2` plus a Love on "Second of
two". Two things about that chat are read off the captures rather than derived, and both matter:

- **Its gaps are all in-cluster.** Every measured gap in all four is 2.74–3.49 (plus the 4.76 hang
  after a tailed bubble); the 11.5 between-cluster gap appears only on the two sides of the emoji-only
  message. So the whole thread is one cluster and the fixture's steps are 2 s. Times that open a
  cluster break put an 11.5 gap where the capture has 7.74 — worth 7.5 pt of accumulated drift at the
  top of `-light-partial` and 2.75 points of mismatch on `-dark`.
- **Its tails do not follow the 60 s rule**, exactly as this file warns for a self chat: "Ok" and
  "Blue for iMessage." carry one with the next bubble 3 pt below, and "Every detail, down to the last
  bubble." — a one-line bubble in the same position — carries none (blue runs at pane x 600 in
  `-light-partial`: 21.0–52.0 with a tail, 126.5–153.0 without). The fixture states them.

| Lab | Reference | Region (pt) | Mismatch | Interior signed |
|---|---|---|---|---|
| `/lab/macos-pane?scene=partial` | `macos/conversation-pane-light-partial.png` | whole frame 630×490 | **1.58%** | +0.29 |
| `/lab/macos-pane?scene=partial` | same | 30 0 600 490 (past the sidebar shadow) | **1.66%** | +0.07 |
| `/lab/macos-pane?scene=thread&theme=dark&text=Every+detail` | `macos/conversation-pane-dark.png` | whole frame 630×640 | **2.57%** | −0.15 |
| `/lab/macos-pane?scene=tails&balloon=1` | `macos/conversation-pane-light.png` | whole frame | **3.19%** | +0.39 |
| `/lab/macos-pane?scene=tails&theme=dark` | `macos/conversation-pane-dark-2.png` | whole frame | **3.51%** | +0.05 |
| `/lab/macos-pane?scene=tails&theme=dark` | `macos/conversation-pane-dark-2.png` | 0 585 630 55 (composer) | 2.50% | +0.38 |
| `/lab/macos-pane?scene=thread&theme=dark&text=Every+detail` | `macos/conversation-pane-dark.png` | 0 585 630 55 (composer) | **0.67%** | +0.33 |

Bubble geometry agrees to ≤1 pt on every row of every frame (blue runs at pane x 600, ref vs ours,
`-dark-2`: 85.0/117.0/149.0/350.5/382.0/433.5/494.5 against 85.0/117.5/149.0/351.0/383.0/434.0/495.0),
and the interior means say the fills are right. What is left is glyph antialiasing, plus the four
things below.

### `composer-empty-and-typed-dark.png` needs no lab of its own

It is a two-panel montage and both panels are **bit-exact** crops of frames this lab now
reconstructs: the empty panel is `conversation-pane-dark-2.png` at device (0, 1170) and the typed
panel is `conversation-pane-dark.png` at the same offset, i.e. pane y 585–640 of each. The two rows
above measure it. The empty panel's 2.50% against the typed panel's 0.67% is the caret: native draws
one, and a Chrome screenshot cannot (already noted in `macos-composer.tsx`). Nothing else in that
band differs but placeholder antialiasing and the window's bottom-right corner.

`references/ios/captures/tapback-balloon-4x.png` is the same story one platform over: it is a
**bit-exact** 4× nearest-neighbour enlargement of `ios/tapback-love-light.png` at device (930, 1560)
= pt (310, 520), 80 × 73.33, which is the box SPEC's tapback row already diffs at 300 520 102 80. It
is a magnifying glass over a measured region, not an unmeasured capture.

### `/lab/crop`: a page whose origin is a crop's origin

`compare.ts` reads the reference from the same rectangle it clips the page to, so a standalone crop
can only be diffed against a page that already starts where the crop starts. `/lab/crop` loads
another lab in an iframe at its natural size and slides it, so the scene is still drawn by whichever
lab owns it, in the same browser at the same DPR — nothing is redrawn. Verified: the wrapper against
a direct render of the same scene is **max 1/255, mean 0.012** over 402 × 874 at 3x.

Offsets were found by sliding the capture over a render and taking the minimum mean absolute error;
each minimum is sharp because both sides carry the same hard glass edges.

| Lab (via `/lab/crop`) | Reference | Offset / size | Mismatch | Interior signed |
|---|---|---|---|---|
| `/lab/tapback?scene=longpress-first` | `ios/tapback-bar-crop.png` | x 0, y 126.333, 402 × 160 @3 | **4.94%** | +0.74, blob 4.2% |
| `/lab/tapback?scene=longpress-first` | `ios/context-menu-crop.png` | x 125, y 286.333, 276 × 200 @3 | **3.72%** | +0.62 (2.6, −1.8, 1.1), blob **19.0%** |
| `/lab/tapback?scene=macos-menu` | `macos/ctxmenu-with-edit-light-2x.png` | x 6, y 0, 305 × 160 @2 | **10.24%** | +2.14 (3.8, 2.2, 0.4), blob 8.3% |

`context-menu-crop.png` is 830 device px wide = 276.667 pt, and Chromium clips a screenshot to whole
CSS px, so the diff covers the crop's left 828 of 830 columns. `ctxmenu-with-edit-light-2x.png` can
only be diffed down to its Edit row, because the kit has no Edit row to draw (below).

### What these labs found

1. **The macOS header's scroll-edge effect blurs too far down.** Over `conversation-pane-dark-2.png`
   the whole-frame interior mean is +0.05, but the band y 0–96 alone is 5.35% with a 3.9% blob at
   pane x 457–586, y 20–44.5. Row by row (mean abs over pane x 410–620, then the two readings at
   x 600): the error is 2–7 down to y 70, then **12.7 at 74, 26.7 at 78, 28.7 at 82, 40.8 at 86**,
   17.9 at 90 and 10.2 at 94. At y 82 native shows bare pane between two bubbles — (31,33,34) — where
   we paint (46,68,96): our blur smears one bubble across the 2.9 pt gap to the next and native's
   does not. At y 86 native is already at full bubble colour (75,131,207) and we are still washed
   (52,81,121). Then it reverses: by y 98 we are at the settled (83,152,247) while native still reads
   (82,145,235), and at 102 (83,147,239) against that same (83,152,247), so the error climbs back to
   22.0 and 30.8 before dying at 106. The alpha ramp `macHeaderMetrics.fadeStart 50 / fadeEnd 96` has
   the right total but the wrong shape — native decays to nearly nothing by 86 and then carries a
   faint tail past 104, and its **blur** is gone by 82 while ours holds full strength to 96. This is
   the largest error in all four frames.
2. **`MacMessagesApp` never paints the sidebar's shadow on the pane**, which "macOS Chrome" above
   measures as #f3f3f3 at x 328 fading out by x 350. `/lab/macos-chrome?scene=pane` hand-draws it
   inside the lab, so the shipping shell has never been checked for it. Over
   `conversation-pane-light-partial.png` the strip 0 0 30 490 scores **0.00% mismatch and interior
   mean +4.31 (4.3, 4.3, 4.3), max 13, with 42.0% of it one connected blob — the verdict line reads
   TINT at a perfect ratio.** It is worth 0.08 points of the whole-frame number (1.66% → 1.58% when
   the strip is included, because the strip's own pixels never trip pixelmatch) and it is the
   cleanest example in this repo of a ratio that cannot see a uniform shift. In dark the same strip
   is +0.33, which is why nobody noticed.
3. **A reacted bubble starts a new cluster natively, and `buildRows` does not model it.**
   `-dark-2` and `-light` differ only by the Love on "Second of two", and in `-light` the bubble
   above it grows a tail. `continues()` in `message-list.tsx` never looks at `reactions`, so the kit
   keeps them in one cluster. Stating the tail in the fixture took the light frame from 3.33% to
   3.03% on its own.
4. **The tapback slot is 3.2 pt short on macOS, because the slot's margin collapses with the row's.**
   Read off the DOM of `/lab/macos-pane?scene=tails`, with and without `balloon=1`: "First of two"
   sits at y 83.81–112.55 with "Second of two" at 115.55 (a 3.00 gap), and with the Love it is
   59.81–88.55 with "Second of two" at 115.89 — a gap of **27.34**, which is `balloonSlot.macos
   .marginTop` 27.4 alone. The row's own margin (3 in-cluster + the 4.76 tail hang) has vanished into
   it. Native's gap is **30.58** (this file's own tapback-balloon row: body bottom 34.93 → next body
   top 65.51, "the list opens 27.40 above the reacted bubble" on top of a 3.18 cluster gap), so the
   right sum is cluster gap + slot with the tail hang **not** charged, and the kit reaches neither:
   uncollapsed it would be 35.16, collapsed it is 27.34.
5. **`/lab/tapback?scene=macos-menu` does not reconstruct the backdrop of the captures it is fitted
   against.** Both `ctxmenu-light.png` and `ctxmenu-dark.png` have a blue bubble behind the
   translucent menu (this file already says so, in the corner-fit caveat), and the lab paints a flat
   #e6e6e6 / #2c2c2e. Inside the menu's top-left the capture reads **(205,230,255)** light and
   **(23,46,85)** dark where the lab reads (246,247,249) and (31,34,40) — 41 and 45 levels — while
   away from that corner the two agree to ≤2 levels at every probe (device (500,110): 248,249,251 vs
   246,247,249; (300,400): 248,249,250 vs 246,247,249). So the glass itself is right and everything
   ever measured over its top-left quadrant is measured over the wrong scene: the light frame's
   interior mean is −1.71 overall with a **+4.49, 7.5%** blob covering exactly pt x 8–147.5,
   y 4–124. The same missing backdrop is the whole of the `ctxmenu-with-edit` residual above (+3.8 R
   against +0.4 B: the blue that should be showing through).
6. **The kit has no Edit row.** `macosMessageMenu` in `context-menu.tsx` runs Tapback Details… /
   Reply… / Attach Sticker… | Forward… / Copy | Delete… | Show Times; `ctxmenu-with-edit-light-2x.png`
   has an **Edit** item in its own block between Attach Sticker… and Forward…, with a pencil glyph
   `MenuIcon` does not draw. Until both exist that capture can only be diffed above the Edit row.
7. **The iOS context menu's glass is green-deficient over a green bubble.** `context-menu-crop.png`
   diffs at 3.72% with an interior mean of only +0.62 but **19.0% of the interior in one connected
   blob**, at pt x 137–382, y 292.6–338.3 of the screen — the top of the menu, where native's glass
   carries a clear green wash from the SMS bubble behind it and ours is neutral. The per-channel
   split says the same thing: R +2.6, **G −1.8**, B +1.1.

### Captures that still have no lab, and why

- `macos/bubble-tails-4x.png` — a two-panel montage at 8 px/pt whose panels are **not** crops of any
  committed frame (checked against all four pane captures at ÷4; no match). Its source looks like a
  dark counterpart of `conversation-pane-light-partial.png` that was never committed, so the panels'
  positions in pane coordinates are unknown and any pairing would be invented.
- `macos/tapback-balloon-dark-4x.png` — same 4× nearest-neighbour form. Recovering its 2x source is
  lossless (every 4 × 4 block is constant) but `compare.ts` has no downsample step, so it needs a
  ÷4 pass before it can be diffed at all.
- `macos/tapback-apply-frames-100-123.png` — 24 frames in one strip; a still lab cannot be one frame
  of it, and the motion it holds is already transcribed under "macOS tapback motion".
- `macos/ctxmenu-with-edit-light-2x.png` — only above its Edit row, see 6.

## iOS search (`search-active-light.png`, `search-noresults-dark.png`, `motion/search-open.mov`, `motion/search-close.mov`)

Measured 2026-09-08 on the same iPhone 17 Pro / iOS 26.0 simulator as the rest of `references/ios`.
The state cannot be reached from a script by tapping, so it was opened with **⌘F** in Messages with the
simulator's hardware keyboard connected — Messages registers that key command on iPhone and it is the
only pointer-free way in. Full Keyboard Access (`simctl spawn booted defaults write
com.apple.Accessibility FullKeyboardAccessEnabled -bool true`, then respring) is *not* needed for ⌘F;
it was only used to clear the first-launch onboarding sheets.

### The field does not move

Diffing `search-active-light.png` against `list-light.png` over the bottom bar gives a difference box
that starts at **x 224 px** — the caret. Every pixel left of it is identical: the pill at x 28–314,
y 798–846, its glass fill and its `0 6px 36px spread 4` shadow, the magnifier, the "Search"
placeholder, the mic, and the 12pt gap to the circle beside it. So on iPhone the search field stays a
floating capsule at the bottom of the screen. It does not rise, it does not widen, and **there is no
Cancel button**: the compose circle becomes a close button in place.

| Part | Measurement |
|---|---|
| Pill, active | unchanged from the list: x 28–314 (286 wide), y 798–846, radius 24, same glass and shadow |
| Trailing circle | unchanged Ø 48 glass circle centred (350, 822); its glyph becomes an ✕ whose **ink box is exactly 17.0 × 17.0 centred (349.833, 822.5)**, diagonal stroke ≈2.0 (a horizontal cut is 8.6 px of ink at 3x), in the compose glyph's own ink colour (#1a1919 light / #f4f3f4 dark) |
| Caret | 2.0 × 22.0 at x 74.667, y 811–833 (centre 822.0), #0088ff light / #0091ff dark, drawn over the placeholder's leading edge. The placeholder does **not** move or fade when the field takes focus |
| Mic | survives focus. It is replaced only once there is text |
| Clear button | Ø **17.0** disc centred (284.5, 821.833) — the mic ink's own centre to within 0.17 — filled with the placeholder colour (#8a8a8e / #97979d), with a **knocked-out** ✕ in the pill's composited interior colour (#ffffff / #191919), ink 7.2pt across at ≈1.65 thick |
| Typed text | starts at the placeholder's own origin (x 46.8 inside the pill) in the label colour, at the placeholder's weight: "Detail" and "Search" both measure 5 device px per stem at 3x |
| Results area | the conversation list is replaced outright, with **no dim and no scrim** (`-[CKUIBehavior searchControllerObscuresConversationList]` is YES on the Phone behaviour). Every pixel above the bar in `search-active-light.png` is the page background |
| Before a query | **blank**. There is no suggestions surface in the capture |

### "No Results"

UIKit's search content-unavailable view, not a ChatKit one: only the title is in `ChatKit.loctable`
(`SEARCH_RESULTS_INDEXING_TITLE`), and "Check the spelling or try a new search." is not in the
framework at all. From `search-noresults-dark.png`:

| Part | Measurement |
|---|---|
| Magnifier | ink 45.3333 × 46.0, x 178.0–223.333, y 375.667–421.667. Ring outer Ø 37.3333 with a 4.0 stroke (centre-line radius 16.6667 about (18.6667, 18.6667) in the ink box); handle a 45° stroke ≈5.45 wide (horizontal cut 7.7) ending at the box's corner |
| Title | "No Results", cap top 445.333, cap height **16.0** → 22pt (`searchIndexingTitleFont`, whose cap is 15.501, plus a third of a point of antialiasing each side), ink 108.0 wide. 22pt **bold** reproduces that width to 0.00; 22pt semibold is 2.7 narrow |
| Subtitle | 15pt (`searchIndexingSubtitleFont`), ink y 473.0–486.333, **263.0 wide**, which 15pt regular reproduces to 0.33 |
| Placement | all three centred on x 201; the block's ink centre is y **431.0** and the results area runs 62 (= 54 status bar + `additionalSearchResultTopPadding` 8) to 798 (the bar's top), whose centre is 430.0. So the block is centred in the results area, which is what pins both edges of that area |

Our render lands the three ink boxes within a third of a point and diffs at **0.04%** over
y 300–600 (`/lab/search?scene=noresults&theme=dark`).

### Motion (`search-open.mov`, `search-close.mov`)

`simctl io recordVideo` writes a frame only when the screen changes, so every frame carries its own
timestamp and no frame rate has to be assumed. Both curves were traced by summing the blue-channel
excess of the two avatars over a fixed column (proportional to the list's alpha, and translation
invariant) and by following the avatars' ink box (their translation). The bar itself never moves in
either direction; only the trailing circle's glyph changes.

**Opening takes 267 ms.** The list fades where it stands and slides *up*; the avatars' diameter never
changes, so there is no scale. On an even 16.7 ms grid:

| t (ms) | 0 | 16.7 | 33.3 | 51.7 | 68.3 | 85 | 100 | 116.7 | 133.3 | 150 | 166.7 | 183 | 200 | 216.7 | 233.3 | 250 | 266.7 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| list alpha | 1.000 | 0.973 | 0.955 | 0.904 | 0.844 | 0.773 | 0.681 | 0.586 | 0.488 | 0.401 | 0.312 | 0.230 | 0.155 | 0.103 | 0.053 | 0.034 | 0.000 |
| rise (pt) | 0 | 2.00 | 5.17 | 9.33 | 15.33 | 22.67 | 31.33 | 40.67 | 51.33 | 61.33 | 71.00 | — | — | — | — | — | — |

The alpha is a symmetric S, half gone at 131 ms. The rise **accelerates** — 0.19 pt/ms over the first
50 ms against 0.6 pt/ms over 120–170 — and is still accelerating at 172 ms (73.33 pt), where the list
is under 30% opacity and can no longer be followed. Those samples fit `dy ∝ t^1.673` at 0.3 pt; the
tail past 172 ms is that fit, not a measurement.

**Closing takes 292 ms and is not the opening reversed.** The search surface is gone inside one
recorded frame (under 3.3 ms) and the list appears at **alpha 0.858, 106.67 pt high**, then settles on
an ease-in-out: fraction of the fall 0, 0.031, 0.119, 0.275, 0.431, 0.619, 0.794, 0.913, 0.988, 1.000
at t 0, 43, 78, 113, 142, 173, 208, 240, 275, 292 ms, with alpha 0.858 → 1.000 over the same window.
Reversing the opening's easing would start the exit almost stationary and is wrong twice over.

The trailing circle's glyph is a crossfade with an overshoot: total ink inside the circle falls from
the compose glyph's level to a minimum at **75 ms**, rises to a peak at **137 ms** that is 25% above
the ✕'s resting ink, and settles by 267 ms. That is native's SF Symbol replace; the kit models the
crossfade (out by 28.1%, in by 51.3%) and not the overshoot.

### What the simulator cannot show

**No capture of a search *result* exists and none can be taken.** The simulator's two conversations
hold no messages and its Spotlight index is empty, so every query returns "No Results" — that is how
`search-noresults-dark.png` was got. Every number for the Conversations / Messages / Photos / Links /
Documents sections therefore comes from ChatKit 26.5 and nothing pins the composition.

### ChatKit constants for this screen (read off `[[CKUIBehaviorPhone alloc] init]`)

`additionalSearchResultTopPadding` 8 · `searchHeaderHeight` 44 · `searchHeaderFont` SF Semibold 20
(line 23.5547, cap 14.0918) · `searchHeaderButtonFont` SF Regular 17 · `searchSectionMarginInsets`
{0,16,0,16} · `searchLeadingAndTrailingMaxPadding` 16 · `searchSectionHeadersPinToBounds` YES ·
`searchResultsTitleHeaderBottomPadding` 12 · `searchDefaultMaxResults` 4 ·
`searchConversationSectionInsets` {20,0,20,0} · `searchConversationMinAvatarLabelSpacing` 10 ·
`searchCellPreferredWidth` **160** · `searchMessagesAvatarSize` {28,28} · top/bottom spacing 12/18 ·
`searchMessagesConversationToSenderSpacing` 4 · `…SenderToBalloonSpacing` 8 ·
`…BalloonToChevronSpacing` 12 · `…HorizontalBalloonMargin` 72 · `…MaxSummaryLength` 200 ·
`…InterGroupSpacing` 0 · `searchMessagesBalloonFont` SF Regular 17 (line 20.0215) · sender/date SF
Regular 12 (line 14.1328) · DM/Group conversation SF **Medium** 12 ·
`searchMessagesFromMeUnannotatedLabelColor` white 0.6 · `searchResultLabelBoldFont` SF Semibold 12 /
`searchResultLabelFont` SF Regular 12 · `searchIndexingTitleFont` SF Regular 22 /
`…SubtitleFont` SF Regular 15 · `searchPhotosInterItemSpacing` 10, `…CellCornerRadius` **0** (Mac
overrides to 8) · `searchLinksInterItemSpacing` 10, `…CellCornerRadius` 10 (Mac 8),
`searchLinksFractionalWidthScale` 1.2, `…FractionalHeightScale` 0.85 ·
`searchAttachmentsInterItemSpacing` 10, `…CellCornerRadius` 10, `…TitleTopPadding` 12,
`…CellDatePadding` 4, `…CellPadding` 0, `…ImageTopPadding` 0 · locations / highlights /
collaboration inter-item spacing all 10 · `searchControllerObscuresConversationList` YES ·
`conversationListShowsSearchOnAppear` NO · `shouldShowSearchBarInConversationList` NO ·
`searchDetailsResultsInsets` {12,16,16,16} · `searchDetailsSectionMarginInsets` {0,16,0,16} ·
`searchDetailsSeeAllButtonTrailingMargin` 0. `searchNavbarCanvasInsets` and
`spaceBetweenSearchBarAndComposeButton` are declared on `CKUIBehaviorMac` only.

**The 86.667-vs-84 idiom trap.** `-[CKUIBehavior searchMessageCellHeightForDisplayScale:]` branches on
the **live `UIDevice` idiom**, not on the behaviour class. Unswizzled — where a Catalyst probe reports
the phone idiom — it returns 86.666667 at scale 3, 86.5 at 2 and 87 at 1, which is the conversation
list's own measured row pitch and the value the kit uses. Apply the `.mac` swizzle these notes
recommend elsewhere and the same selector returns **84.0 at every scale**. Anyone re-deriving the row
pitch with the swizzle on will get 84 and think the kit is wrong. Both readings verified in one probe
that prints the idiom it is running under.

Strings, out of `ChatKit.loctable`: SEARCH_CONVERSATIONS_TITLE "Conversations" (there is **no**
"Top Hits" string anywhere in ChatKit.framework or Messages.app), SEARCH_MESSAGES_TITLE "Messages",
SEARCH_PHOTOS_TITLE "Photos", SEARCH_LINKS_TITLE "Links", SEARCH_ATTACHMENTS_TITLE "Documents",
SEARCH_LOCATIONS_TITLE "Locations", SEARCH_PINS_TITLE "Pins", SEARCH_WALLET_TITLE "Wallet",
SEARCH_COLLABORATION_TITLE "Collaboration", SEARCH_SCREENSHOTS_TITLE "Screenshots", SEARCH_SHOW_MORE
"See All", SEARCH "Search", SEARCH_RESULTS_INDEXING_TITLE "No Results", SEARCH_RESULTS_TITLE
"“%@” in %@", CONVERSATION_SEARCH_RESULTS_TITLE "Conversations with “%@”", SEARCH_PHOTOS_ALL_TITLE
"All". `CKLinkSearchResultCell` holds an `LPLinkView` and an `LPLinkMetadata`, so a link result is a
LinkPresentation card rather than a thumbnail with captions under it.

Lab: `/lab/search?scene=active|noresults|resting|results|open|close&theme=…&progress=…`. `active`
diffs at 0.07% full-frame against `search-active-light.png`, `noresults&theme=dark` at 0.09% against
`search-noresults-dark.png`, and the composited bar at `scene=open&progress=0` diffs at 0.02% against
`list-light.png` with an interior mean of −0.01, which is what proves the search screen replaces the
list's bar rather than stacking a second one on it.
