# macOS 26 details pane — where every number came from

`registry/imessage/macos-details.tsx`. Lab: `/lab/macos-details-pane`.

## The source, and its two limits

**A private capture of the user's own macOS 26 Messages** — `Conversation ▸ Show Details` open on a
group, window sized to 960 × 640 pt. It is a real conversation with real people in it, so:

> **It is not in this repository and it must not be copied into it, into a fixture, into a test, or
> into a screenshot committed anywhere.** Nothing below is content: every number is a geometry or a
> flat colour. The people in it are referred to only as "a participant".

Two properties of the file on disk bound every reading, and they are not incidental:

1. **It survives only as a 1x, 960 × 640 downscale.** The 2x original was overwritten in the
   scratchpad it lived in. So 1 px = 1 pt, and no *edge* reading is finer than about ±0.5 pt. Where
   the same quantity can be read two ways, the reading over more pixels wins — see §6 on type.
2. **It is a display-profile capture.** `screencapture` writes the display's ICC profile, not sRGB.
   Every colour below is quoted **after** converting the image out of that profile into sRGB, which
   is what a browser paints in. The check that the conversion is right: the accent row reads
   `#ffd044` untouched and `#ffd600` converted, and `#ffd600` is `systemYellow` (dark) exactly.

The capture is **dark only**. Two further captures of the same window *without* the pane were used
for the surrounding chrome; they are 2x, and they are what fixes the transcript ground and the
1 pt rim convention.

**Everything in the light column of `vars` is therefore derived, not measured**, and the component
says so in place. Do not treat a light number here as a capture.

## 1. The pane is a flush column, not a floating panel

The previous version of `macos-details.tsx` had no capture and built the inspector out of
`CKUIBehaviorMac` plus SPEC's measurement of the **sidebar** — an 8 pt float with a 22 pt continuous
corner, a 1 pt bright rim and a drop shadow. The capture overturns that:

| | Measured |
|---|---|
| column | x **660–959** in a 960 pt window → **width 300** (`defaultInspectorColumnWidth` agrees) |
| top / bottom / trailing inset | **0** — flush; the divider runs y 0–639 without a break |
| corner | **square**; the column's leading edge is a straight line at every row sampled (y 0…639) |
| shadow | none measurable: the transcript reads a flat `#1e1e1e` right up to x 658 |
| divider | **1 pt at x 660**, brighter than both neighbours on **638 of 640 rows** |

The divider's absolute colour tracks the material behind it, because that material is translucent
(§3). Over the least-tinted rows it reads `#353b41` against a pane reading `#1c1e21`, so its lift is
**+25 / +28 / +31**; applied to the flat panel token that is **`#34383c`**, and that is what
`--mdt-divider` carries.

**The divider is painted *on* the column's leading edge, not as a border.** Every content inset below
is measured from x 660, the same column the hairline occupies; a 1 pt border would push the entire
body one point trailing, and the first build of this file did exactly that (every landmark landed at
+1 x until it was changed to an overlay).

## 2. Opening the pane collapses the sidebar

In the capture the transcript starts at **x 0** — flat `#1e1e1e` from the first column, with the
traffic lights sitting over it and no conversation list anywhere. The companion capture of the same
window *without* the pane has the list at x 0–327 and the transcript from 328.

So `Show Details` does **not** squeeze the transcript into the space left over. It collapses the
conversation list and gives the transcript the whole 660 pt beside the column.
`macDetailsMetrics.collapsesSidebar` records this. `MacDetails` owns only the column, so the shell is
what has to drop its sidebar; `/lab/macos-details-pane` does it with `sidebarWidth={0}`, and
`?sidebar=1` shows the arrangement the capture contradicts.

## 3. The pane's fill is a material, and this kit paints a flat stand-in

Sampled across the column away from content, the fill drifts smoothly from **#1c1f23** beside the
divider to **#1b1b1b** at the window edge, and vertically over a similar range — it is a vibrancy
material sampling the desktop behind the window, and the drift follows the wallpaper. Percentiles
over that sample: p10 `#1b1b1c`, median **`#1b1c1d`**, p90 `#1c1f23`.

`--mdt-panel` is that median. It is a flat stand-in for a material this kit cannot reproduce, and the
±4 drift is the floor on any colour diff of the pane's ground.

## 4. Geometry

All coordinates are the capture's window coordinates (1 px = 1 pt); the column starts at 660.

### Chrome

| | Measured | In the component |
|---|---|---|
| content column | cards x **676–943** → **268** = 300 − 2 × 16 | `contentInset: 16` |
| close button | ring x **669–704** × y **8–43** → **Ø 36**, centre (686.5, 25.5) | `headerButton: 36`, `headerButtonTop: 8`, `headerInset: 8` |
| close glyph | ink **14 × 14**, `xmark` | `CloseGlyph` |
| "Edit" | capsule x **912/913–951** × y **8–43** → **39–40 × 36**, ending 8 in from the window edge | `headerEditWidth: 39` |
| button fill / rim | **#191c1d** inside a 1 pt **#2e3033** — the buttons are *darker* than the pane | `--mdt-glass`, `--mdt-glass-rim` |
| avatar | x **780–839** × y **26–85** → **Ø 60**, centred on the column (809.5) | `avatar: 60`, `avatarTop: 26` |
| quick actions | x **740–879** × y **124–159** → three **Ø 36** discs on a **52** pitch, so **16** between | `action: 36`, `actionGap: 16` |
| disc fill | **#37383c** — the same fill as both cards and the Add circle | `--mdt-fill` |
| disc glyphs | phone ink **14 × 14**, video and envelope **17 × 12**; phone and video white, **Mail #747577** (disabled) | `actionGlyph: 0.85` scales the framework's 17 pt art; `--mdt-tertiary` |
| tab strip | selected capsule x **676–714** × y **176–201** → **26 tall**, capsule, leading inset **16** | `tabHeight: 26` |
| selected capsule fill | **#3e3f42** | `--mdt-tab-fill` |

The strip **scrolls**: its last label runs to x 958 and is clipped by the window edge, and its titles
read **Info · Backgrounds · Photos · Links · Location**.

### Body

| | Measured | In the component |
|---|---|---|
| first card top | **217**, i.e. 15 under the strip's box (which ends at 202) | `bodyTop: 15` |
| map card | x **675/676–943** × y **217–413** → **268 × 197** | `mapHeight: 196` (`detailsViewMapHeight` says 196) |
| card corner | both cards reach full width 10–11 rows in from the corner, which fits a **14–16 pt** corner on an anti-aliased edge | `cardRadius: 16` |
| "Open in Find My" | ≈ **112 × 24** at (694, 235) → 18 in from the card's top-left | `mapButtonHeight: 24`, `mapInset: 18` |
| map pins | **Ø 40 ± 1** faces dropped on the map | `mapPin: 40` |
| map title block | ink starts x **693** → the pane's own **16** pt inset, not the button's 18 | `contentInset` |
| gap between sections | map bottom 413 → action card top 429/430 (**15–16**); card bottom 521 → faces top 538 (**16**) | `sectionGap: 16` |
| action card | x **676–943** × y **429/430–521** → **268 × 92–93** | two `cardRowHeight: 46` rows + a 1 pt rule |
| its separator | y **475**, x **692–927** → 1 pt, inset **16** from each card edge | `separatorInset: 16` |
| separator colour | **#4e5055** | `--mdt-separator` |
| destructive row | peak **#ff5b65** | `--mdt-red` |
| accent row | peak **#ffd600** = `systemYellow` dark | `--mdt-yellow` |
| participant faces | x **679–940** × y **538–607** → **Ø 70** on a **95.5** pitch | `personSize: 70` |
| their layout | three **76** pt cells with **20** between them = 268, exactly the content column; first centre 714, then 809.5, then 905 | `personCell: 76`, `personGap: 20` |
| Add circle | the third cell: a Ø 70 **#37383b** circle with a **26 × 27** plus on a 2 pt stroke | `PlusGlyph` |
| face labels | cap band y **614–621**, centred under each face, 7 under the face | `personLabelGap: 7` |
| bottom | the label baseline sits **17.5** above the window's bottom edge | `bodyBottom: 17` |

**`--mdt-red` is not `systemRed`.** `systemRed` dark is `#ff453a`; the capture's destructive row peaks
at `#ff5b65` after the ICC conversion. The same method on the row below it recovers `systemYellow`
exactly, so the reading is not an artefact of the conversion, and the measured value is what the
component carries.

## 5. What the capture does *not* reach

The capture shows **one tab of one conversation, unscrolled**. Everything under the participant face
row — contact handles, Create/Add to Contact, the photo/link/document previews, the Hide Alerts /
Send Read Receipts / Shared With You checkboxes, Leave / Block / Delete — is below the fold in it.
Their order and every one of their metrics is **unchanged from the framework reading** and lives in
`macDetailsUnmeasured`; the component's header table lists the selectors. Three of those selectors —
`defaultInspectorColumnWidth` 300, `searchDetailsLeadingAndTrailingMaxPadding` 16 and
`detailsViewMapHeight` 196 — the capture independently reproduces, which is the cross-check that the
probe was reading genuine Mac values.

The presentation (the slide in and out) is still unmeasured; nothing records this pane in motion.

## 6. Type is fitted to ink **advances**, not to cap heights

Both readings are available and they disagree by 8–12%, so it matters which one is used.

- A **cap height** on this capture reads 8–12% larger than the true size implies. It is a LANCZOS
  downscale of a 2x original, and the blur widens every ink extent by roughly half a pixel at each
  end — which is ~12% of a 9 px cap.
- An **advance** measured across a whole word carries that same half pixel *once*, over 17–156 px.

So the advance is by far the tighter estimator, and it is also the one a pixel diff sees. Every size
below is the one whose rendered advance in this kit's font stack (`-apple-system …`, measured in the
same headless Chromium the lab is screenshotted in) reproduces the capture's ink width for that exact
string. Target advance = measured ink + ≈ 1.3 pt of side bearings.

| String | Capture ink | Target advance | Fitted | Size / weight |
|---|---|---|---|---|
| the conversation name | 93 | 94.3 | 95.31 | **22 / 700** |
| "Backgrounds" (unselected tab) | 67 | 68.3 | 68.45 | **11 / 400** |
| "Info" (selected tab) | 20 | 21.3 | 21.13 | **11 / 600** |
| "Photos" | 35 | 36.3 | 36.53 | 11 / 400 |
| "Links" | 25 | 26.3 | 27.23 | 11 / 400 |
| "Stop Sharing My Location" | 153 | 154.3 | 155.27 | **13 / 400** |
| "Send My Current Location" | 156 | 157.3 | 157.70 | 13 / 400 |
| a first name under a face | 17 | 18.3 | 19.20 | **10 / 600** |
| "Add" | 18 | 19.3 | 19.98 | 10 / 600 |
| map card title | 48 | 49.3 | 49.55 | **11 / 500** |
| map card subtitle | 45 | 46.3 | 45.64 | 11 / 400 |
| "Open in Find My" | 87 | 88.3 | 89.84 | **11.5 / 500** |
| "Edit" | 21 | 22.3 | 22.61 | **12.5 / 400** |

The weights are not fitted from the widths alone — the selected tab's stem measures 0.12 em against
0.085 em for its neighbours, and the name's 0.143 em, which is what puts them at 600 and 700.

The tab strip's own layout falls straight out of this. With **9 pt** of padding each side of the
label's advance and **2 pt** between capsules, the four ink runs land at 686 / 727 / 815 / 872 — the
capture's are **686 / 727 / 815 / 872**.

One correction in the code is *not* a metric and is commented as such: the location rows carry
`paddingTop: 4`, because `-apple-system`'s line box lands 2 pt higher in Chromium than native's does.
The capture's rows are plainly centred (cap band 447.7–457.7 in a row spanning 429.5–475.5).

## 7. Fidelity

Diffed with `scripts/measure/compare.ts` at dpr 1 over the pane's own box — region `660 0 300 640` of
the 960 × 640 window — against the capture converted to sRGB, `/lab/macos-details-pane?scene=window&theme=dark`
against `/lab/macos-details?scene=window&theme=dark&group=1&people=1`:

| | pixelmatch | interior signed | verdict |
|---|---|---|---|
| before | **53.77%** | **+16.73** | TINT flagged |
| after | **11.48%** | **+0.73** | no tint |

The residual is dominated by content no fixture can reproduce: a real map, real faces on it, a real
contact photo, and real first names. Masking those four boxes — the avatar, the map card, the face
circles and their labels — and counting pixels with |Δ| > 32:

| | whole pane | chrome only | the four content boxes |
|---|---|---|---|
| before | 56.44% | **34.09%** | 89.25% |
| after | 12.22% | **2.68%** | 26.23% |

Mean |Δ| over the chrome falls from **46.86** to **5.27**, against a floor set by §3: the pane's own
ground is a material that drifts ±4 across the column and is painted here as one flat colour.

Landmark by landmark, after (capture | ours):

```
close ring     x 662-713 y   0- 43 | x 662-713 y   0- 43
avatar         x 780-839 y  26- 85 | x 780-839 y  26- 85
name ink       x 764-856 y  92-112 | x 763-856 y  92-111
action discs   x 740-879 y 124-159 | x 740-879 y 124-159
tab capsule    x 676-759 y 176-201 | x 676-759 y 176-201
tab ink runs   686 727 815 872 919 | 686 727 815 872 919
map card       x 675-943 y 217-413 | x 676-943 y 217-412
action card    x 676-943 y 430-521 | x 676-943 y 429-521
its separator  y 475     x 692-927 | y 475     x 692-927
loc row 1 ink  x 693-845 y 448-459 | x 693-845 y 448-459
faces          x 679-940 y 538-607 | x 679-940 y 538-607
face labels              y 614-621 |           y 614-621
```

## 8. How to re-measure

```
# convert the capture out of the display profile first — untouched, the accent row reads #ffd044
python3 - <<'PY'
from PIL import Image, ImageCms
import io
im = Image.open(SRC)
ImageCms.profileToProfile(im.convert("RGB"), ImageCms.ImageCmsProfile(io.BytesIO(im.info["icc_profile"])),
                          ImageCms.createProfile("sRGB"), outputMode="RGB").save(DST)
PY

PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers \
  bun scripts/measure/compare.ts \
    'http://localhost:3100/lab/macos-details-pane?scene=window&theme=dark' \
    "$DST" 1 960 640 /tmp/out 660 0 300 640
```

`$DST` must stay outside this repository.
