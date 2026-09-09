# iOS group conversation details — where every number came from

`registry/imessage/group-details.tsx`. Lab: `/lab/group-details`.

## The problem

`references/ios/captures` holds 41 iOS frames and **not one of them shows a group**. `details-light.png`
and `details-dark.png` are the *one-to-one* details screen; `grouped-light.png` is named for message
clustering and is a two-person thread. So this screen cannot be diffed against a reference the way
every other surface in this repo can, and everything below says exactly which of three sources each
number has: the one-to-one captures (which the two screens share their frame with), ChatKit rendered
and measured, or nothing at all.

## 1. What the one-to-one captures settle

Everything the two screens share is taken from `ios-details.tsx`, which SPEC's fidelity table records
at 0.08% against `details-light.png` over 0 60 402 560. It is *imported*, not restated:
`iosDetailsMotion`, `iosDetailsMorph`, `iosDetailsCollapse`, `IosSwitch` and `subpixel`. What that
buys, all measured:

- Back circle Ø44 at (16, 62); the header photo slot Ø80 at (161, 62), centre (201, 102).
- Name box top 146.15, 28px/33px bold (Chrome's fit to the measured 26 pt ink box y 152.33–177.67).
- Action circles Ø54, centres on y 222.667, on a 74 pt pitch; three of them measure x 127 / 201 / 275.
- Cells x 16–386, radius 26 continuous, 20 apart, first top **269.6667**; row inset 16; text row 52.
- The 1 pt separator convention: it is the **last point of the row above** a boundary, not the first
  point of the row below. On `details-light.png` the hairline between the two link rows occupies
  device rows 1234–1236 for a boundary at 412.33.
- Fills 6% black / 12% white; #0088ff/#0091ff, #ff383c/#ff4245, #dadadb/#3a3a3c, #848488/#98989f,
  chevron #bdbdbd/#5d5d5d; σ18 blur under a 49%/59% scrim.

Two things the old file got wrong here, both now fixed and both re-verified in the lab render:

- **The cell stack was one device pixel low.** The scroller used to be an absolutely positioned box
  at `top: 269.6667`, and Blink snaps a scroll container's border box to a whole CSS px, so every
  cell inherited 270.0. Measured on `lab-light.png` now: the first cell's fill starts at device row
  **809**, which is 269.6667 × 3 exactly, the same row `details-light.png` starts it on.
- **The separators were on the wrong side of the boundary.** They sat at `top: 0` of the row below.
  Measured now on the boundary between the first two participant rows (333.6667): the hairline
  occupies device rows **997–999**, the last point above it, exactly the captures' convention.

## 2. What ChatKit settles, rendered and measured

`references/group-details/probe.m` is a small iOS app (`clang -target arm64-apple-ios18.0-simulator`)
that `dlopen`s the *simulator runtime's own*
`/System/Library/PrivateFrameworks/ChatKit.framework`, builds the real details cells, lays them out
at the measured 370 pt cell width, dumps every frame, font and colour to
`chatkit-tree.txt`, and puts them on screen so the ink can be measured with `scripts/measure/px.py`.
It runs on the booted iPhone 17 Pro (iOS 26), whose screen is 1206 × 2622 = **402 × 874 pt at 3x** —
the same geometry as the repo's iOS captures. `chatkit-cells-light.png` and `chatkit-cells-dark.png`
are its screenshots.

To re-take them:

```sh
SDK=$(xcrun --sdk iphonesimulator --show-sdk-path)
clang -target arm64-apple-ios18.0-simulator -isysroot "$SDK" -fobjc-arc \
  -framework UIKit -framework Foundation -framework Contacts -framework CoreGraphics \
  -o gdprobe.app/gdprobe references/group-details/probe.m
codesign -f -s - gdprobe.app && xcrun simctl install booted gdprobe.app
xcrun simctl launch booted dev.swerdlow.gdprobe          # SIMCTL_CHILD_GD_STYLE=d for dark
xcrun simctl io booted screenshot --display internal out.png
cat "$(xcrun simctl get_app_container booted dev.swerdlow.gdprobe data)/Documents/tree.txt"
```

### 2a. The header photo is the Snowglobe stack, not the pancake

This is the single biggest correction. The old file drew `CKDetailsAvatarPancakeView` — three heads
stepped 13.5 apart with 41 pt knockouts — scaled ×1.25 so that "three heads span the measured Ø80
slot". That was wrong three ways, and the probe shows all three:

1. `-[CKUIBehaviorPhone detailsAvatarPancakeViewWidth3Avatars]` is **72**, not 64, so the ×1.25 was
   derived from a wrong width. Laid out for real the three avatars sit at x 26.667 / 13.333 / 0 —
   steps of 13.333, not 13.5 — inside a **41 pt tall** box. Passing `initWithSize:` 80×80 changes
   nothing; the avatars stay Ø37. The view does not scale.
2. The cut-outs are opaque Ø41 `UIView`s with `cornerRadius` 20.5, painted *behind* their own avatar,
   not a transparent mask punched out of the head behind. The old file drew a transparent ring.
3. **It is the wrong view entirely.** The pancake is `CKDetailsGroupHeaderCell._avatarView`, a row
   cell that also answers `configureCellIconForCollapsedState:`. The details screen's photo is
   `CKGroupPhotoCell._groupView` — singular — and a `CKAvatarView` given the group's contacts.

Rendered at 80 × 80 with three contacts and measured off `chatkit-cells-light.png` (the box is device
x 483–722, y 186–425):

| Face | Measured (pt, in the Ø80 box) | `snowglobeSlots(3)` scaled to 80 |
|---|---|---|
| 0 | x 9.667–47.667 | 9.545–47.727 |
| 1 | y 32.333–61.333 | 32.273–61.364 |
| 2 | x 22.667–46.333 | 22.727–46.364 |

Every edge lands within a third of a point — i.e. within one device pixel of anti-aliasing. So the
group photo *is* `group-avatar.tsx`'s `GroupAvatar`, and `group-details.tsx` now imports it instead
of drawing a third copy of the avatar gradient inline.

The stack also paints a full-diameter disc behind the faces. Measured here at **#f4f5f5 over white**
and **#1f1f20 over black**, which agrees with `group-avatar.tsx`'s independently measured
`groupAvatarPlate` rows for #ffffff and #000000 (`#f4f4f5` / `#1f1f1f`) to a pixel. `GroupAvatar`
draws it; this screen does not add one.

> `group-avatar.tsx`'s header currently says the details header "is not this stack" and that
> `group-details.tsx` "already draws" the pancake. That line predates this probe. The evidence above
> — `CKGroupPhotoCell._groupView`, the pancake's own 41 pt row height and collapsed-state selector,
> and a Ø80 `CKAvatarView` reproducing the Snowglobe table to within a device pixel — says the
> details header is the Snowglobe. That file's `registry.json` description ("the details header") was
> right all along.

### 2b. The rows

From `chatkit-tree.txt`, a `CKDetailsContactsStandardTableViewCell` at 370 × 64:

```
CKLabel      frame{57, 0, 108.333, 64}  text='Jamie Aldrich' font=.SFUI-Semibold 17  color=rgba(0,0,0,1)
CKAvatarView frame{8, 13.333, 37, 37}
UIView       frame{57, 0, 313, 0.3333}  bg=rgba(60,60,67,0.12)      <- its own top hairline
```

- Row 64 (`+preferredHeight`), avatar Ø37 (`detailsViewContactImageDiameter` = `detailsAvatarDiameter`),
  name at 8 + 37 + 12 (`detailsContactAvatarLabelSpacing`).
- The name is **17 semibold at the full label colour**. `-[CKUITheme detailsContactCellTitleColor]`
  is 84.71% label, but that is not what the cell paints, so the cell wins.
- **The hairline is inset to the name column**, not to the row inset. In this screen's 16 pt geometry
  that column is 16 + 37 + 12 = **65**, which is what `Separator inset` gets on a participant row.

`CKDetailsAddMemberStandardCell` at 370 × 44:

```
UILabel      frame{57, 0, 313, 44}  text='Add Contact' font=.SFUI-Regular 17  color=rgba(0,136,255,1)
UIImageView  frame{8, 3.333, 37, 37}  img=18x16  tint=#0088ff  bg=rgba(118,118,128,0.12)  r=18.5 continuous
```

Measured off the render: the circle is **Ø37.0000** (device x 72–182, y 862–972) and the plus's ink is
**13.6667 × 13.6667 pt** (device x 107–147, y 898–938) on a **4.33 device px = 1.4444 pt** stroke.
The circle's fill measures #efeff0 over white and #323236 over the cell's own #1c1c1e in dark, which
is `rgba(118,118,128,0.12 / 0.24)` — `detailsAddButtonBackgroundColor` — in both.

The label is **"Add Contact"** (`ADD_CONTACT`), not "Add Member". Both strings exist in
ChatKit's `en` loctable; the cell renders the first.

Other class constants read the same way: `+[CKDetailsGroupCountCell preferredHeight]` = 22,
`+[CKDetailsShowMoreContactsCell preferredHeight]` = 44, `CKDetailsGroupNameCell` carries exactly
`_phoneButton` and `_facetimeVideoButton` (no mail), and `CKDetailsAddGroupNameView` really does hold
an `_inputField` with the placeholder "Enter a Group Name" under a 13 pt "NAME" label — so an
editable name is the framework's own idea, even though its legacy layout is a table row and this
screen's is the 28 pt title.

### 2c. The chevron, and why ChatKit's is not used

The rendered contact cell's disclosure chevron measures **7.00 × 12.00 pt of ink at #c5c5c7**
(device x 1111–1131, y 708–743) — `+[UIColor tertiaryLabelColor]`, and close to
`-[CKUITheme detailsContactCellChevronColor]` rgba(0,0,0,0.2588).

This screen does **not** use it. The only chevron measured off a capture in this repo is the nav
bar's — 4.67 × 12.67 of ink on a 2.6 round stroke, #bdbdbd / #5d5d5d (`ios-nav-bar.tsx`) — and
`ios-details.tsx` already paints that one on the rows that navigate on the sibling screen. Those
cells are the legacy UIKit table; the measured screen is not. A group screen that drew a different
chevron from the one-to-one screen on the same pixel, on no capture's authority, would be worse than
one that matches it. The ChatKit numbers are recorded here so nobody has to re-measure them.

### 2d. Copy, verbatim from `ChatKit.loctable` (en)

`ADD_CONTACT` "Add Contact" · `ADD_MEMBER` "Add Member" · `LEAVE_CONVERSATION` "Leave this
Conversation" · `LEAVE_CONVERSATION_CONFIRMATION` "Are you sure you want to leave this
conversation?" · `DETAILS_VIEW_HIDE_ALERTS_TOGGLE_TITLE` "Hide Alerts" · `GROUP_NAME_PLACEHOLDER`
"Enter a Group Name" · `GROUP_NAME_LABEL` "Name" · `CHANGE_GROUP_NAME_AND_PHOTO` "Change Group Name
and Photo" · `REMOVE_PARTICIPANT_FROM_GROUP` 'Remove "%@" from "%@"?' · `SEARCH_SHOW_MORE` "See All" ·
`SEE_ALL_PHOTOS_TITLE` / `_LINKS_` / `_ATTACHMENTS_` / `_LOCATIONS_` / `_PASSES_` ·
`SHARED_WITH_YOU_TITLE` "Shared With You" · `DETAILS_VIEW_GROUP_COUNT_TEXT` "%lu PEOPLE" / "%lu
PERSON".

All of it is on `groupDetailsCopy`, `groupCountText` and `removeParticipantPrompt`, so a shell can put
the same words in its own alerts.

## 3. What is still unmeasured

Listed here because nothing in `references/` can settle it:

- **Every duration.** The presentation and the collapse are `ios-details.tsx`'s, whose own header
  already records them as unmeasured. What *is* measured is the pose at each end.
- **The section order.** Participants, Hide Alerts, then shared content, then the destructive row —
  which is where `ios-details.tsx` puts photos, links and attachments (after Hide Alerts, before
  Block Contact). The old file put shared content *before* Hide Alerts while claiming to mirror the
  measured screen. With no shared content the stack now reproduces the measured cell stack exactly.
- **The shared-content cells.** The 110 tile is `(370 − 2×16 − 2×4)/3`: the 4 gap and the radius 12
  are measured on `photo-picker-light.png` (SPEC), three-across inside a 370 cell is not.
  `-[CKUIBehaviorPhone searchPhotosInterItemSpacingDetailsView]` = 1.5 and
  `searchPhotosCellZKWAndDetailsCornerRadius` = 4 are named for a details photo grid and match
  neither number; nothing here can say which surface they belong to.
- **The group-count subtitle's position.** `CKDetailsGroupHeaderCell` has `_subTitleLabel` and
  `detailsGroupHeaderCellInterTextVerticalSpacing` = 1, so the line exists; where it lands on the
  modern screen does not. It is opt-in (`subtitle`), and with it absent the header is the measured
  one, untouched.
- **Centring an even number of action circles about x 201.** The 74 pitch is measured and the formula
  reproduces the measured three-up (127 / 201 / 275) exactly; two circles at 164 / 238 is a
  derivation from it.
- **Swipe-to-remove a participant.** `REMOVE_PARTICIPANT_FROM_GROUP` says the gesture exists; no
  capture in this repo shows a swipe action on a grouped cell, and `ios-swipe-times.tsx`'s measured
  swipe is the transcript's, not a row action's. Not built; the copy is exported so a shell can.

## Lab

`/lab/group-details?scene=settled|scrolled|editing|long|photo&theme=light|dark`, plus
`&progress=0..1|live` and `&scroll=<points>`.

- `settled` is the frame to diff. `hairline-scan.ts` on it at 3x reports **0 runs**.
- `scrolled` seeks the header collapse (`&scroll=120.3333` is fully collapsed).
- `long` is six members truncated behind a "See All" row with the count subtitle, in one frame.

No mismatch ratio can be quoted: there is no group details capture to diff against. What the lab
*does* prove is the two device-pixel facts above (cell top on row 809, separator on rows 997–999) and
that the entrance timeline still ends inside `iosDetailsMotion.enter`: with six cells the last
animation ends at **352 ms** against `enter` = 360, because the stagger is clamped at
`cellStaggerMax`. The old file's unclamped stagger ran to 376.
