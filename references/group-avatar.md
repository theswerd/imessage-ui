# Group avatar — measurement note

`registry/imessage/group-avatar.tsx`. Everything here is a reading; nothing is judgement unless it
says so.

## The problem this note solves

Not one of the 58 PNGs in `references/ios/captures` and `references/macos/captures` shows a group
conversation. `grouped-light.png` is named for message *grouping* (clusters and tails) in the
two-person `+1 (888) 555-1212` thread; `details-light.png` is a one-to-one details screen. So this
surface had no capture to diff against and every number in the component traced to framework
introspection alone.

## The captures in `references/group-avatar/`

| file | what it is |
|---|---|
| `snowglobe-light.png` | 1206x2622 (402x874 pt at 3x), light appearance |
| `snowglobe-dark.png` | the same screen in dark |
| `material-swatches-light.png` | nine flat colours, right half under a bare `.systemThinMaterial` plate |
| `material-swatches-dark.png` | the same in dark |

These are `xcrun simctl io booted screenshot` of the **iPhone 17 Pro simulator on iOS 26.0** — the
repo's own iOS capture geometry — running a throwaway app that `dlopen`s the simulator runtime's
`ContactsUICore` and `ChatKit` and builds real `CKAvatarView`s over `CNMutableContact` fixtures.
Every circle, monogram, gradient and blur in them is drawn by Apple's code in a live window. They are
**not** screenshots of Messages: the simulator cannot hold an iMessage group. They are the same view
Messages instantiates, on backgrounds chosen so the material can be read off.

Keep that distinction. The layout, the diameters, the gradients and the plate are native. The
*arrangement* of the stacks on the screen is the harness's.

### Layout (points, on the 402x874 screen)

```
root         #ffffff (light) / #000000 (dark)
row A  y 60  Ø60, n = 1..6, x = 6, 72, 138, 204, 270, 336
row B  y 130 Ø60 n=7 at 6; Ø45 n=2 at 72; Ø45 n=3 at 132; Ø45 n=7 at 192; Ø40 n=3 at 252; Ø40 n=7 at 312
band   y 200..360  #3478f6
row C  y 220 Ø60, n = 1..6, x = 6, 72, 138, 204, 270, 336
row D  y 290 Ø60 n=7 at 6; Ø45 n=3 at 72; Ø40 n=3 at 132
patch  y 380..460  opaque #ffffff — row E y 390: Ø60 n=2 at 6, n=3 at 72, n=7 at 138
patch  y 470..550  opaque #000000 — row F y 480: Ø60 n=2 at 6, n=3 at 72, n=7 at 138
```

Contacts, in the order handed to `-[CNAvatarView setContacts:]`: Alex Morgan, Jamie Chen, Sam Rivera,
Dana Wu, Kai Patel, Robin Diaz, Noor Haddad — AM, JC, SR, DW, KP, RD, NH.

`material-swatches-*.png` is nine 402x80 bands starting at y 60: `#ffffff`, `#000000`, `#808080`,
`#3478f6`, `#ff0000`, `#00ff00`, `#0000ff`, `#e9e9eb`, `#1c1c1e`. The right half of each (x 201..402)
carries a `UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))`.

Note that `material-swatches-light.png` was taken while the simulator display had auto-dimmed, so
every pixel in it is the true colour times 0.800 exactly (255 reads 204, `#3478f6` reads
`(42, 96, 197)`). Divide before quoting it. `snowglobe-light.png` was taken undimmed and is the
authority; the two agree to under 1/255 after the correction.

### Re-taking them

Boot a simulator (`xcrun simctl list devices booted`), build the app for
`arm64-apple-ios18.0-simulator`, `xcrun simctl install booted`, grant contacts
(`xcrun simctl privacy booted grant contacts <bundle id>`, or the app aborts with a TCC
`NSContactsUsageDescription` termination), launch with `SIMCTL_CHILD_GA_STYLE=light|dark` and
`SIMCTL_CHILD_GA_SCREEN=stacks|swatches`, wait for the window, screenshot. Give it a moment: a
screenshot taken during the launch transition catches the previous app sliding away, and after about
a minute idle the simulator dims the display by 0.8.

## What the captures settle

**The plate is real and it is a circle.** `ContactsUICore.SnowglobeUIView` inserts a
`UIVisualEffectView` as subview 0, filling the box, behind every face. Its *frame* is square, but
`scripts/measure/outline.py` traced on `snowglobe-light.png` at the Ø60 two-face stack over `#3478f6`
returns `bbox 60.00 x 60.00 pt` with a radius of ~29.5 pt on all four corners: a full-box disc. The
effect is `UIBlurEffect material=20`, and `+[UIBlurEffect effectWithStyle:]` reports material 20 for
`.systemThinMaterial` (and its Light/Dark siblings), 26 for ultra-thin, 6 for regular, 5 for thick, 3
for chrome. One contact never builds a `SnowglobeUIView` at all, so a single face has no plate.

An offline `-[CALayer renderInContext:]` of the same view tree renders the plate as an unrounded
`#f9f9f9` square, because a `UIVisualEffectView` outside a live window never installs its backdrop
filters and `renderInContext:` cannot run a blur. That render is an artefact; the simulator capture is
the reading.

**The plate colour, per background.** Means over 762 clean samples per cell — inside the disc, 3 pt
clear of the disc's edge and of every face — with the swatch capture as a second, independent
measurement of the same material.

| background | light | dark |
|---|---|---|
| `#ffffff` | `#f4f4f5` | `#7d7d7d` |
| `#000000` | `#8d8e8e` | `#1f1f1f` |
| `#3478f6` | `#a2c7ff` | `#264a8f` |
| `#e9e9eb` | `#ededee` | `#737373` |
| `#1c1c1e` | `#9d9d9e` | `#2a2a2a` |

A flat translucent fill fitted to the two achromatic ends — `rgba(237,237,237,0.596)` light,
`rgba(49,49,49,0.632)` dark — hits `#ffffff` and `#000000` exactly, misses `#e9e9eb` by 1.2/255 and
`#1c1c1e` by 4.0/255 (light; 1.7 and 0.9 dark), and misses `#3478f6` by up to 14/255 light and 22/255
dark in the blue channel. The material also lifts saturation and no flat overlay can follow that; the
component takes the fit as its default and lets a surface pin the measured colour through
`--im-ga-plate`. The material is not a `saturate()` either: solving `saturate(s)` per channel against
the blue row gives s = 1.01, 5.04 and ≥1.26 for R, G and B, so there is a per-channel luminance curve
in it that CSS has no primitive for.

**The faces never touch.** The layout table leaves a gap everywhere. Minimum centre-to-centre
clearance in base-88 units: 1.598 (n=2), 2.446 (n=3), 2.040 (n=4..6), 2.071 (n=7) — 1.09, 1.67, 1.39
and 1.41 pt at Ø60. What reads as a "ring" between the faces is the plate showing through, and
nothing strokes it.

**The gradient inside each face is per-face, and `avatar.tsx`'s four endpoints are right.** Fitting a
straight line down the Ø60 single-face circle (116 rows, glyph pixels dropped) returns `#a9c2e1` ->
`#747fb9` in light with a maximum residual of 0.89/255, and `#575368` -> `#302649` in dark with 0.78.
The Ø6.8 face in the seven-face stack spans the same range in its own box, so the gradient is drawn
per circle and does not stretch across the stack.

## Framework readings

Mac Catalyst probe: `clang -target arm64-apple-ios26.0-macabi`, `-[UIDevice userInterfaceIdiom]`
swizzled to the idiom under test, then `dlopen` of
`/System/iOSSupport/System/Library/PrivateFrameworks/{ChatKit,ContactsUICore}.framework/*`.

`+[CNUIAvatarLayoutManager identifierForLayoutType:]` — 0 `PlanetsAvatarLayoutConfigurations`, 1
`PlanetsAvatarLayoutAdHocConfigurations`, 2 `SnowglobeAvatarLayoutConfigurations`, 3
`SnowglobeGroupTypingIndicatorAvatarLayoutConfigurations`, 4 Planets again.
`+maxAvatarCountForType:` answers 10 for every type, but type 2 asked for 8, 9, 10 or 11 returns the
same seven configurations, so seven is the real cap. Every entry carries `baseSize` 88.

`-[CNUIAvatarLayoutItemConfiguration itemFrameInContainingBounds:isRTL:]` is
`frame = (midX + x*s - d/2, midY + y*s - d/2, d, d)` with `s = bounds.width / 88` and `d = size * s`;
`isRTL:YES` negates x and nothing else. Both tables in the component are that call verbatim.

Diameters, all three behaviour objects:

| | Phone | Pad | Mac |
|---|---|---|---|
| `groupAvatarViewSize` | 60 | 60 | 60 |
| `conversationListContactImageDiameter` | 45 | 45 | 40 |
| `conversationListContactImageTrailingSpace` | 12 | 12 | 6 |
| `transcriptContactImageDiameter` | 32 | 34 | 28 |
| `contactPhotoBalloonMargin` | 7 | 7 | 7 |
| `transcriptGroupTypingContactImageDiameter` | 44 | 48 | 42 |
| `detailsAvatarDiameter` / `Cutout` / `PancakeViewOverlapOffset` | 37 / 41 / 13.5 | same | same |
| `detailsAvatarPancakeViewWidth2Avatars` / `3Avatars` | 58 / 72 | same | same |
| `scrollInNewMessageAnimationDuration` | 0.300 | 0.300 | 0.300 |

`+[CKChatItemLayoutUtilities avatarSupplementaryItemForChatItem:layoutEnvironment:]` returns, under
each idiom in turn, an `NSCollectionLayoutSupplementaryItem` of `.absolute(32/34/28)` square at
`zIndex` 1 with `containerAnchor` `edges = 6` (`NSDirectionalRectEdge.leading | .bottom`) and
`absoluteOffset = (-32/-34/-28, 0)`. The offset tracks the diameter, so nothing here is hardcoded to
the phone. `-[CKTranscriptAvatarSupplementaryView initWithFrame:]` builds its `CKAvatarView` at
exactly `(0, 0, d, d)` whatever frame the view is handed.

`+[CNUIAvatarLayoutManager avatarBadgeRectForAvatarInRect:badgeType:isRTL:]` for a 60 box: type 0
`(39, 0, 21, 21)`, type 1 `(45, 0, 15, 15)`, type 2 `(45, 4.5, 51, 51)`, type 3 empty. Nothing in the
component draws a badge yet.

A live `CKAvatarView`'s subview tree, with `-borderWidth` 0, `-borderColor` nil,
`-maskedAvatarIndices` nil and `-monogrammerStyle` 0 throughout:

```
CKAvatarView
  UIImageView (0x0)
  UIImageView (0x0)
  ContactsUI.CNAvatarView_SwiftWrapper
    ContactsUICore.SnowglobeUIView                      (n >= 2 only)
      UIVisualEffectView          0,0,S,S   masksToBounds  material=20
      ContactsUICore.AvatarUIView  <- table entry 0, the largest, added first
      ...                          <- entry n-1, the smallest, added last
```

Every `AvatarUIView` has `zPosition` 0, so the paint order is the subview order: **the largest face is
at the back**. `-[CNUIAvatarLayoutItemConfiguration updateLayer:inBounds:atIndex:isRTL:layoutType:]`
does set `zPosition` to `-index`, but a group photo does not run that path. It never showed either
way, because the faces do not overlap.

## What is still unmeasured

- The **easing** of the sender-avatar hand-off. The duration is a framework constant (0.300 s); no
  recording in `references/` contains a group transcript, so the curve is `ease-in-out`, UIView's
  default, and is marked as a placeholder in `senderAvatarMotion`.
- What the stack does when a **participant is added or removed**. `CNAvatarView` exposes
  `-performTransitionAnimationWithStartHandler:completion:` but no duration, and nothing captures it.
  The component re-lays the stack with no transition.
- Which participants occupy which slots in a **real conversation**, and whether "you" is excluded.
  The capture app hands the contacts in a fixed order; Messages' own ordering is not observable from
  here.
- Whether the plate is visible **through the iOS nav bar's own material**, which is not a flat colour.
- The **badge** rects above have never been drawn or diffed.
