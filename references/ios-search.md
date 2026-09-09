# iOS Messages search — measurement note

Everything in `SPEC.md` § "iOS search" in longer form: how the state was reached, the raw samples
behind the two motion curves, and an explicit list of what is still not measured. Written 2026-09-08
against iOS 26.0 (23A343) on the iPhone 17 Pro simulator (402 × 874 pt @3x) and ChatKit 26.5 on
macOS 26.5.

## How to reach the state again

The search screen needs a tap, and this project's ground rules forbid sending pointer events. There is
one pointer-free route:

```sh
xcrun simctl boot 0D3EA156-32BF-4E50-A43B-BB43C51A1791          # iPhone 17 Pro, iOS 26.0
xcrun simctl launch --terminate-running-process booted com.apple.MobileSMS
osascript -e 'tell application "Simulator" to activate' \
          -e 'delay 1' \
          -e 'tell application "System Events" to keystroke "f" using command down'
xcrun simctl io booted screenshot --display=internal --type=png out.png
```

**⌘F is a `UIKeyCommand` Messages registers on iPhone**, and it opens search with the field already
first responder. Typing then goes straight into the field (`keystroke "Detail"` in the same
`osascript` block; a second `osascript` invocation sometimes loses the keystrokes because the
Simulator has to be frontmost when they are sent). Escape leaves search.

Two traps cost an hour each:

- `xcrun simctl io booted screenshot` picks a **default** display, and this device has a second
  720 × 480 "external display" port. Always pass `--display=internal`, or you will silently capture a
  green test grid.
- The first launch of Messages shows two onboarding sheets ("Apple Intelligence in Messages", then a
  three-page "Shared with You"). Return does not dismiss them. Full Keyboard Access does:
  `xcrun simctl spawn booted defaults write com.apple.Accessibility FullKeyboardAccessEnabled -bool true`,
  `xcrun simctl spawn booted launchctl stop com.apple.SpringBoard`, then Tab to the OK button and
  Space. Beware that the **first** Tab stop is the "◀ AppName" back-to-app pill in the status bar, so
  activating it switches apps.

Recording motion:

```sh
xcrun simctl io booted recordVideo --display=internal --codec=h264 --force out.mov &
sleep 3; ...keystroke...; sleep 3
pkill -INT -f recordVideo          # SIGINT is what flushes the file; killing the shell job is not enough
ffmpeg -i out.mov -vsync 0 f%03d.png
ffprobe -select_streams v:0 -show_entries frame=pts_time -of csv=p=0 out.mov
```

The simulator writes a frame **only when the screen changes**, so the clip is variable-rate and every
frame has to be read with its own `pts_time`. Do not divide by a nominal frame rate.

## Captures committed

| File | What |
|---|---|
| `ios/captures/search-active-light.png` | focused, empty query, light |
| `ios/captures/search-noresults-dark.png` | query "Detail", no matches, dark |
| `ios/motion/search-open.mov` | ⌘F from the conversation list, light |
| `ios/motion/search-close.mov` | Escape back to the list, light |

`references/ios/manifest.json` is a stale stub (`captures: []`, viewport 390 × 760) that nothing
reads, so these are not registered in it.

## Raw motion samples

`t` is milliseconds from the first changed frame. `alpha` is the summed blue-channel excess of the two
avatars over the fixed column x 40–270 px, normalised — translation invariant, so it measures opacity
alone. `dy` is their ink box's centre.

### Open (`search-open.mov`, first changed frame at pts 3.900 s)

| t | alpha | dy (pt) |
|---|---|---|
| 0 | 1.000 | 0 |
| 16.7 | 0.973 | 2.00 |
| 33.3 | 0.955 | 5.17 |
| 51.7 | 0.904 | 9.33 |
| 68.3 | 0.844 | 15.33 |
| 85.0 | 0.773 | 22.67 |
| 100.0 | 0.681 | 31.33 |
| 116.7 | 0.586 | 40.67 |
| 133.3 | 0.488 | 51.33 |
| 150.0 | 0.401 | 61.33 |
| 166.7 | 0.312 | 71.00 |
| 171.7 | 0.285 | 73.33 |
| 183.0 | 0.230 | — |
| 200.0 | 0.155 | — |
| 216.7 | 0.103 | — |
| 233.3 | 0.053 | — |
| 250.0 | 0.034 | — |
| 266.7 | 0.000 | — |

`dy` stops at 171.7 ms because below alpha ≈ 0.3 the threshold that finds the avatars stops firing.
The eleven samples fit `dy = 73.33·(t/171.7)^1.673` at 0.3 pt rms; extrapolating that to 266.7 ms gives
153.2 pt, which is what the component's last keyframe carries and is **not** a measurement.

### Close (`search-close.mov`, first changed frame at pts 4.048 s)

The frame before it has alpha 0.000 — the list is not on screen at all — and the first changed frame
already has alpha 0.858 at dy −106.67. The search surface therefore vanishes inside one frame
(≤ 3.3 ms); the rest of the 292 ms is the list settling.

| t | alpha | dy (pt) | fall done |
|---|---|---|---|
| 0 | 0.858 | −106.67 | 0.000 |
| 43.3 | 0.862 | −103.33 | 0.031 |
| 78.3 | 0.871 | −94.00 | 0.119 |
| 113.3 | 0.894 | −77.33 | 0.275 |
| 141.7 | 0.914 | −60.67 | 0.431 |
| 173.3 | 0.943 | −40.67 | 0.619 |
| 208.3 | 0.968 | −22.00 | 0.794 |
| 240.0 | 0.982 | −9.33 | 0.913 |
| 275.0 | 0.985 | −1.33 | 0.988 |
| 291.7 | 1.000 | 0 | 1.000 |

### Trailing circle glyph

Mean ink inside a 100 × 95 px box over the Ø48 circle, light theme, same clip as the open:

| t (ms) | 0 | 40 | 75 | 105 | 137 | 167 | 200 | 233 | 267 |
|---|---|---|---|---|---|---|---|---|---|
| ink | 32.7 | 22.5 | 14.7 | 22.1 | 26.9 | 26.7 | 24.5 | 22.5 | 21.6 |

The compose glyph is gone at 75 ms, the ✕ peaks at 137 ms **25% above its own resting ink**, and
settles by 267 ms. The peak is an SF Symbol replace's scale bounce; the kit crossfades and does not
model it, because "ink area" is a poor estimator of scale and no better one is available without a
higher-rate capture.

## How the DOM reproduces the layering

Native puts the search surface **behind** the conversation list and animates the list out on top of
it. In this kit the list is a sibling component `ios-search.tsx` does not own, so it paints the page
colour over the list at `1 − listAlpha` instead: over the same background colour the two composites
are identical pixels. The translation is the half a sibling cannot do for itself, so it is applied
only when the caller passes `listRef`.

Checked against the captures with `scripts/measure/compare.ts`:

| Diff | Result |
|---|---|
| `/lab/search?scene=active` vs `search-active-light.png`, full frame | 0.07%, interior mean −0.00 |
| same, bottom bar 0 780 402 94 | 0.12%, interior mean −0.01 |
| same, results area 0 54 402 726 | **0.00%** |
| `/lab/search?scene=noresults&theme=dark` vs `search-noresults-dark.png`, full frame | 0.09%, interior mean 0.00 |
| same, y 300–600 (the "No Results" block) | 0.04% |
| same, bottom bar | 0.13%, interior mean 0.00 |
| `/lab/search?scene=open&progress=0` vs `list-light.png`, bottom bar | 0.02%, interior mean −0.01 |

The last row is the one that matters for composition: at t = 0 the search screen's own bar is drawn
over the list's (hidden) bar and the result is the list capture, so nothing double-paints the glass or
its shadow. The residual in every row is antialiasing on the diagonal ✕ strokes and the status-bar
clock, whose font is not the capture's.

`scripts/measure/hairline-scan.ts` reports 0 runs on `scene=results` in both themes.

## Still not measured

Ranked by how much it would change the screen.

1. **Every result section.** The simulator's conversations are empty and its Spotlight index is empty,
   so every query returns "No Results". Conversations / Messages / Photos / Links / Documents are
   built from ChatKit constants and *no capture pins how they compose*: which constant is the gap
   under a header, which is the gap under a section, and whether Photos, Links and Documents are
   horizontal strips at all. To settle it, a device or a simulator with a real message history is
   needed — nothing else will do.
2. **The strip cell size.** `searchCellPreferredWidth` = 160 is the only cell-size constant the
   framework exposes, and `searchLinksFractionalWidthScale` 1.2 / `…HeightScale` 0.85 read as
   fractions of it, giving a 192 × 136 landscape link card — the shape an `LPLinkView` is. That is an
   inference from two constants, not a measurement. (The previous 85pt tile was worse: it was derived
   from `searchDefaultMaxResults`, then used to cap the strip at four items, so of course four fit.)
3. **The link card's caption bar** (44 tall, 12 inset). `CKLinkSearchResultCell` hosts an `LPLinkView`
   and nothing in ChatKit sizes its caption.
4. **The tail of the open transition's rise**, past 172 ms — a fit, not samples.
5. **The ✕ replace's scale bounce**, observed as a 25% ink peak at 137 ms and not modelled.
6. **The clear button's cross arm length** inside its measured 7.2pt ink box, and the ✕ close glyph's
   arm length inside its measured 17.0 box; both strokes and both ink boxes are measured.
7. **Whether a conversation result bolds its match.** `+[CKConversationSearchResultCell
   conversationListCellClass]` returns `CKConversationSearchResultEmbeddedCell`, which exposes
   `+annotatedResultStringWithSearchText:resultText:primaryTextColor:primaryFont:annotatedTextColor:annotatedFont:`
   — a separate `annotatedFont`, unlike `CKMessageSearchResultCell`, which passes one font twice.
   Which font its caller passes is untested. The kit recolours and does not bold, matching the message
   cell.
8. **Whether results scroll under the floating bar.** The kit gives the scroller 84pt of bottom
   padding so they can.
9. **Five section kinds ChatKit ships and this kit does not draw**: Locations, Pins, Wallet,
   Collaboration, Screenshots. Their titles are exported; each has only an inter-item spacing (10).
10. **The See All destination.** `searchDetails*` metrics and the destination titles are exported;
    the screen is not built.
11. **The caret's width.** Measured 2.0; Chrome draws a 1 CSS px caret and its width cannot be set.
