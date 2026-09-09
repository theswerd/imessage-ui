# Photo picker: how each number was measured

Companion to the `## iOS photo picker` section of `SPEC.md` and to the docblock in
`registry/imessage/photo-picker.tsx`. This file records the *method*, so any of it can be re-run.

Source capture: `references/ios/captures/photo-picker-light.png`, 1206 x 2622 px = 402 x 874 pt at
3x, iOS 26.0, iPhone 17 Pro, light, the picker collapsed with nothing selected. It is the only
capture of this surface in the repo.

## 1. The grabber: a 2D area fit, not an ink bounding box

The old value, 36 x 5 at top 4.6667, came from `-[_UIGrabber intrinsicContentSize]` and was defended
in the file as "the capture's ink minus its anti-aliased rim". It is not: rows 1469 and 1484 read the
surrounding photo exactly at every x sampled (560, 580, 603, 620, 645), so the pill occupies rows
1470-1483 inclusive and nothing else. 14 device px, no rim.

The width needs more than a threshold, because the pill is a luma-tracking vibrancy view over a
photograph: the "ink" colour changes across it (the background is darkened by 59/255 at x 560 and
52/255 at x 640) and the background itself has a vertical gradient. The fit models both:

1. **Background** per column, linearly interpolated in y between the mean of rows 1465-1469 and the
   mean of rows 1484-1488 - both clean of the pill.
2. **Ink** per column as `background - delta(x)`, where `delta(x)` is a quadratic fitted to the
   observed darkening over the 100 fully covered columns 553-652. Outside the pill this model returns
   `delta` within 1.3/255 of zero, which is the check that it is not fitting noise.
3. **Coverage** per pixel is then `(bg - value) / delta` in the channel with the largest `delta`.
4. **Shape**: a rounded rectangle `(L, R, T, B, r)` whose coverage is computed by supersampling each
   pixel 8 x 8 (16 x 16 and 24 x 24 give the same answer), fitted by `scipy.optimize.least_squares`
   over the 2640 pixels of the window x 544-663, y 1466-1487.

Result:

```
L 550.500  R 655.500  width 105.000 px = 35.0000 pt
T 1470.000 B 1484.000 height 14.000 px = 4.6667 pt
centre x 603.000 (panel centre 603.000)   top 15.000 px below the panel = 5.0000 pt
rms 0.0284 of coverage, max residual 0.334
```

`least_squares` needs `diff_step` well above the supersampling quantum or the residual has no
gradient and it returns the initial guess; that is the trap the first attempt fell into.

The corner is the only shallow parameter. Holding `r` fixed and refitting the other four leaves the
width and height at exactly 105.000 and 14.000 for every `r`, and the rms curve is nearly flat
between 6.4 and 7.0 device px (0.0255 at 6.4, 0.0287 at 6.0, 0.0307 at 7.0). A capsule - `r` =
height / 2 = 2.3333 pt = 7 device px - sits at the top of that band and is the shape UIKit draws, so
that is what the component uses.

**Why the framework number loses.** A Catalyst probe (see below) confirms `_UIGrabber` really is
36 x 5 at `cornerRadius` 2.5, `masksToBounds` YES, with a `_UILumaTrackingBackdropView` and a
`UIVisualEffectView` at `{0, -5, 36, 15}` that inset nothing, and that `CKAppGrabberView` - ChatKit's
own sheet header, which has `showsGrabberPill` and a `_chevronView` ivar typed `_UIGrabber` - lays it
out at `{177.5, 5, 36, 5}` in a 391.3333-wide header. So the **top of 5.0 is corroborated exactly**.
The size is not: 36 x 5 at 3x is 108 x 15 device px, and 105/108 = 0.972 against 14/15 = 0.933, so
the capture is not showing a uniformly scaled `_UIGrabber`. Per the repo's rule the capture wins.

## 2. The tile corner

Nine tile corners meet clean `#ffffff`: the bottom edges of the second row (x 404.238, 409.108,
796.900, 801.759 at y 2237.24), the same four at the first row's bottom edge y 1843.636, and the top
corners at y 1848.494. Each was fitted with the same rounded-rect coverage model, with the tile's
"ink" colour taken from a plane least-squares-fitted to the pixels more than 3.5 px inside the corner
in both axes, in the channel furthest from white.

| Corner | radius (device px) | rms |
|---|---|---|
| r2c1 bottom-right | 7.906 | 0.236 |
| r2c2 bottom-left | 6.548 | 0.172 |
| r2c2 bottom-right | 6.866 | 0.103 |
| r2c3 bottom-left | 6.643 | 0.133 |
| r1c1 bottom-right | 7.969 | 0.168 |
| r1c2 bottom-left | 6.551 | 0.192 |
| r1c2 bottom-right | 6.961 | 0.140 |
| r2c1 top-right | 7.523 | 0.231 |
| r2c3 top-left | 6.552 | 0.138 |

Median 6.866, rms-weighted mean 6.935, so **2.3 pt**. Re-running every fit with coverage computed in
linear light instead of sRGB makes the mean rms worse (0.207 against 0.168) and pulls the radii down
to a median 6.26, which is how the blending question was settled rather than assumed.

The residuals are an order of magnitude worse than the grabber's because photographs are not planes.
2.3 carries about +/-0.2 pt of real uncertainty. What it is not is **2.1** (under every one of the
nine) or **12** (36 device px, which `SPEC.md` line 164 still says).

## 3. The Catalyst probe

```
SDK=$(xcrun --sdk macosx --show-sdk-path)
clang -target arm64-apple-ios26.0-macabi -isysroot "$SDK" \
  -iframework "$SDK/System/iOSSupport/System/Library/Frameworks" \
  -framework Foundation -framework UIKit -framework CoreGraphics -fobjc-arc -o probe probe.m
```

with `dlopen("/System/iOSSupport/System/Library/PrivateFrameworks/PhotosUICore.framework/PhotosUICore")`
and `method_setImplementation(class_getInstanceMethod([UIDevice class], @selector(userInterfaceIdiom)),
(IMP)returnsPhone)`.

What it settled:

- `+[PXSelectionBadgeUIViewTile preferredSize]` -> `{26, 26}`.
- `-[PUPhotosGridCell layoutSubviews]` on a 129.364 x 129.5633 cell puts `_selectionBadgeView` at
  `{99.864, 100.0633, 26, 26}`, i.e. 3.5 trailing and 3.5 bottom.
- That badge view is a `UIImageView`; its `UIImage` is 26 x 26 at scale 2, so the `CGImage` is 52 x 52.
  Reading it at native size (rather than redrawing it larger, which resamples and blurs every edge by
  a whole point) gives: alpha is hard-edged and 44 px wide in both centre rows and both centre
  columns -> ink **O 22.0**; the white rim integrates to 3.0898 px inward -> **1.5449**, so the blue
  disc is **O 18.9102**; the blue is `rgb(0 136 255)` exactly.
- The check: a round-capped round-joined two-segment polyline fitted by least squares against the
  white coverage of the 928 pixels inside the disc, supersampled 8 x 8 ->
  start `(-4.408, 0.941)`, vertex `(-1.334, 4.670)`, end `(3.957, -3.645)` from the badge centre,
  stroke **1.4248**, rms 0.0125. A hand-read skeleton had given (-4.2, 1.15) (-0.94, 3.87)
  (4.05, -3.72) at stroke 1.4, rms 0.113 - nine times worse - which is why the fit was worth running.

What it could **not** settle, and this is the important negative result: **iOS dark colours**. Under
Catalyst the colour catalog is the macOS one no matter what the idiom trait says.
`+[UIColor systemBackgroundColor]` comes back `#ffffff` / `#1e1e1e` (iOS dark is `#000000`) and
`secondarySystemBackgroundColor` comes back `#ececec` / `#323232` (iOS light is `#f2f2f7`). Setting
`userInterfaceIdiom` on the resolving `UITraitCollection` changes nothing. The `systemFill` family
does come back with the iOS values (`rgb(118 118 128 / 0.12)` and `/ 0.24`), which is why the search
field's fill is treated as measured and the panel's dark fill is not.

`CKUIBehaviorPhone` has a `photoPicker*` family - `photoPickerInterItemSpacing` 5,
`photoPickerSectionInsets` `{5,5,5,5}`, `photoPickerMaxPhotoHeight` 129, `numberOfAssetsInPhotoPicker`
50, `numberOfButtonsInPhotoPicker` 3 - but it describes the **legacy alert-sheet** picker
(`photoPickerPopoverWidth`, `photoPickerMaxPhotoWidthForAlertWidth:`), and its 5 pt spacing and 5 pt
section inset contradict the capture's 1.6207 and 0. It is not this grid.
`PXPhotosGridMessagesLayoutSpec` is not this grid either: its settings object,
`PXMessagesUISettings`, is about `stackedItemsCount`, `rotationAngle` and `pagingBehavior`, i.e. the
photo stack inside a balloon.

## 4. Verifying the render

```
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers \
  bun scripts/measure/compare.ts \
  "http://localhost:3100/lab/photo-picker?scene=screen" \
  references/ios/captures/photo-picker-light.png 3 402 874 /tmp/out 0 810 402 64
```

-> **0.00%** over the panel's bottom band, which is where the inset, both bottom corners and the
panel's own edge all show. The whole frame is 23.80% and means nothing: the lab draws gradient
placeholders where the capture has photographs.

The grabber cannot be diffed for the same reason, so it is verified by running its own fit again on
a 3x screenshot of `?scene=panel`. The rendered pill comes back at **105.000 x 14.000 device px, top
15.000, centred on 603.000** - the capture's numbers to three decimals. The rendered gap seam
measures 4.852 device px against the capture's 4.844 on the same estimator.

The badge is diffed directly, against PhotosUICore's own image composited on white at its native 2x:

```
bun scripts/measure/compare.ts "http://localhost:3100/lab/photo-picker?scene=badge" \
  badge-native-on-white.png 2 26 26 /tmp/badge
```

-> **1.26%** (34 px of 2704), all of it on the check's anti-aliased edges.

`hairline-scan.ts` on `?scene=panel&progress=1` at 3x: **0 runs**.
