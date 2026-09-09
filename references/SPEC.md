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
| Corner radius | ≈19 (circle fit 18.7–19.4; Apple uses continuous corners) |
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

- The typing indicator's geometry and dot animation.
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
- **Inline replies** (`message-reply.tsx`): the quoted stub above a reply is a 0.76-scaled, 55%-opacity
  copy of the quoted bubble; the thread view dims and blurs the rest of the conversation. Structure
  from documented behaviour, numbers provisional.
- **Photo messages** (`message-image.tsx`): photos take the measured bubble outline including the tail.
  The tail is filled by sampling the photo's own trailing-bottom edge. Grid: one photo keeps its
  aspect ratio, two are side by side, three put a tall tile first, four or more show four tiles with
  a "+N" count on the last.
- **Audio messages** (`message-audio.tsx`): waveform bar count, widths and spacing are provisional.
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
