# The full-screen photo viewer

How the surface was reached, what came back, and what is still not measured. The short version lives
in `SPEC.md` under "iOS photo viewer"; this is the working note behind it.

## The problem

Tapping a photo in Messages opens a full-screen viewer. No capture of it existed, and none could be
taken the usual way: `xcrun simctl` can screenshot a booted device but cannot tap one, `idb` is not
installed on this machine, and driving the Mac's own Messages with synthetic clicks is off limits.
So the audit of `registry/imessage/image-viewer.tsx` had to call the majority of what you actually
see "invented", and it was right to.

## Getting to it anyway

Messages does not draw a photo browser of its own. It presents QuickLook, and the controller it
presents is `ChatKit.CKQLPreviewController`, a `QLPreviewController` subclass. That class is in
`/System/Library/PrivateFrameworks/ChatKit.framework` inside the **iOS simulator runtime**, not just
in the Catalyst iOSSupport tree — so it can be instantiated by any app running on the simulator.

1. A throwaway iOS app: `clang -target arm64-apple-ios18.0-simulator -isysroot $(xcrun --sdk iphonesimulator --show-sdk-path) -framework UIKit -framework QuickLook -framework CoreGraphics`,
   an `Info.plist` with `CFBundleSupportedPlatforms = [iPhoneSimulator]` and `UIDeviceFamily = [1]`,
   and a `QLPreviewControllerDataSource` over five JPEGs it draws with `UIGraphicsImageRenderer` and
   writes to its own tmp directory (a diagonal gradient, a 100 px white grid, a numeral — so any
   scale error in a capture is readable).
2. A **private** simulator device, so nothing collides with whatever else is booted:
   `xcrun simctl create qlprobe-17pro com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro com.apple.CoreSimulator.SimRuntime.iOS-26-0`,
   then `boot`, then `xcrun simctl install <udid> QLProbe.app`.
3. Inside the app, `dlopen("/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit")` and
   `objc_getClass("CKQLPreviewController")`, allocate it in place of `QLPreviewController`, present it
   full screen.
4. Two readings per run: `xcrun simctl io <udid> screenshot` at 402x874 @3x, and a walk of the live
   view hierarchy logging every view's frame **in window coordinates**, plus every
   `UIBarButtonItem`'s title, accessibility label, action selector and symbol image. The hierarchy is
   the measurement; the screenshot only confirms it and supplies the colours.

Both captures are in `ios/captures/`:

- `image-viewer-chrome-dark.png` — chrome up over the viewer's black ground (device appearance set to
  dark with `xcrun simctl ui <udid> appearance dark`, so the ground behind the chrome is black before
  the photo arrives, which is the state the chrome is normally seen in anyway).
- `image-viewer-fit-dark.png` — a 3:4 photo fitted, chrome auto-hidden.

The fixture in the second is `public/fixtures/viewer-probe.jpg`, pulled out of the simulator's data
container afterwards, so `/lab/photoviewer?scene=fit` renders the same bytes and the diff is real.

## What came back

### The chrome is not what the component thought

Liquid Glass circles floating over the photo. No "Done" text button, no title text, no thumbnail
tray, no opaque bars, no scrim. The probe's own build shows three — close, reply, share — and the
section *"The footer has four buttons, not two, and ChatKit does build the bar"* below says why real
Messages shows more.

| Part | Frame (window pt) | Source |
|---|---|---|
| `UIWindow.safeAreaInsets` | {62, 0, 34, 0} | hierarchy |
| `UINavigationBar` | 0, 62, 402, 54 | hierarchy |
| its `_UIBarBackground` | 0, 0, 402, 116 | hierarchy |
| close disc (`accessibilityLabel` "close") | 342, 62, 44, 44 | hierarchy + capture |
| bottom bar container | 0, 798, 402, 76 | hierarchy |
| its button row | 28, 798, 346, 48 | hierarchy |
| reply disc (`accessibilityLabel` "reply") | 28, 798, 48, 48 | hierarchy + capture |
| share disc (`accessibilityLabel` "Share") | 326, 798, 48, 48 | hierarchy + capture |

Both slots reproduce numbers `SPEC.md` already carried for other screens, measured independently
months apart: the conversation's back button is "a 44pt circle centered (38, 84)", which is
(16, 62, 44, 44); the list's compose button is "Ø48 centered (350, 822)", which is
(326, 798, 48, 48). And `barsAreaVerticalOutset` = 10 lands the bars' area bottom on 62 + 44 + 10 =
116, exactly the `_UIBarBackground` height. Three separate corroborations of the same grid.

The toolbar, in order, is `[reply, flexible space, share]`. `reply` carries action `replyTapped:` and
the image `[[CKUIBehavior sharedBehaviors] replyImage]` = `arrowshape.turn.up.left` (21.333 x 17.333);
`share` carries QuickLook's own `_actionButtonTapped:` and `square.and.arrow.up` (19 x 22). The reply
button was `enabled = 0` in the probe, which is correct: `-[CKQLPreviewController replyButton]`
enables it from `-shouldShowReplyButtonForMediaObject:previewController:`, and the probe has no
`ckQLPreviewControllerDelegate`.

### Glass, measured over black

Over a (0,0,0) ground the disc's interior reads **#131313** (19/255), i.e. white at 7.45%; its outer
edge peaks at **52/255**, i.e. a rim of white at ~14% on top of that fill. The glyph ink is
**#f3f3f3**, not pure white. The disabled reply glyph peaks at 90/255, which is 0.32 of the enabled
ink over the same disc. The blur radius is the one number a capture cannot return — the ground behind
the discs is flat, so nothing is being blurred.

### The fit is exactly what `fitPhotoRect` computes

The 1200 x 1600 fixture in a 402 x 874 frame: predicted x 0, y 169.0, 402 x 536. Measured in
`image-viewer-fit-dark.png`, the ink column at x = 201 runs 169.00 to 704.67 and the ink row at
y = 437 runs 0 to 401.67. Every pixel outside it is exactly (0,0,0). `/lab/photoviewer?scene=fit`
diffs against that capture at **0.00%**.

### The chrome really does auto-hide

`chromeAutoHideDelay` = 3 s is not theoretical. In the capture runs the chrome was up at 1.4 s and
gone by 2.6 s with no input at all, and the status bar went with it.

### `interpageSpacing` was the pad value

`PUOneUpSettings` is idiom-dependent and its `+sharedInstance` latches the idiom at first access, so a
plain Catalyst process reports pad. Read in a fresh process with `-[UIDevice userInterfaceIdiom]`
swizzled before the first access:

| idiom | `interpageSpacing` |
|---|---|
| 0 (phone) | **40** |
| 1 (pad) | 100 |
| 5 (mac) | **40** |

The component carried 100 on both platforms, so the page pitch was 502 instead of 442 on iPhone —
60 pt too much black on every swipe — and the parallax, which divides that pitch by 12.5, was off with
it (40.16 instead of 35.36).

### Everything else read out of PhotosUI at idiom 0

`scaleToFitBehavior` 1, `minimumContentInset` 0, `allowUserTransform` 1, `allowChromeHiding` 1,
`allowDoubleTapZoom` 1, `allowStatusBar` 1, `allowScrubber` 1, `allowGIFPlayback` 1,
`autoplayVideo` 0, `allowPlayButtonInBars` 0, `chromeDefaultAnimationDuration` 0.2,
`chromeAutoHideDelay` 3, `chromeAutoHideBehaviorOnZoom` 2, `persistChromeVisibility` 0,
`chromeAnimationType` 1, `chromeBackgroundAnimationType` 1, `barsAreaVerticalOutset` 10,
`parallaxFactor` 12.5, `allowParallax` 1, `parallaxModel` 1, `itemContentCornerRadius` 0,
`pagingFrictionAdjustment` 2, `pagingSpringPullAdjustment` 0, `doubleTapZoomFactor` 2.5,
`defaultZoomInFactor` 6, `doubleTapZoomAreaExcludesBars` 1, `doubleTapZoomAreaExcludesBackground` 1,
`userNavigationMaximumDistance` 2, `bounceDuration` 0.5, `bounceDelay` 0, `bounceSpringDamping` 1,
`bounceInitialVelocity` 100, `finalFadeOutDuration` 0.2.

`PUTilingViewSettings`: `springAnimationDuration` 0.3, `transitionDuration` 0.2,
`transitionChromeDelay` 0, `defaultAnimationDuration` 0.5, `useSpringAnimations` 1,
`useOvershootingSpringAnimations` 1, and **`interactiveTransitionBackgroundDimming` 0.5** — which is
the number the drag-to-dismiss dimming had been guessing at.

### Method bodies (lldb against the loaded image)

The on-disk binaries are shared-cache stubs, so `otool`/`strings` return nothing; `lldb -b -o "b <fn>" -o run -o "disassemble -n '-[Class sel]'"`
against a process that has dlopened ChatKit works.

- `-[CKQLPreviewController updateBarButtonItems]` is one instruction: `ret` — **in the macCatalyst
  build only**. See the correction below: the iOS build of the same method is 872 bytes and installs
  three items. `loadView` really does only set `navigationBar.barStyle`, on both.
- `-fullScreenBalloonViewControllerShouldShowReplyButton:` is `mov w0, #0; ret` — the balloon overlay
  never shows a reply button of its own. That is separate from the toolbar's, which does exist.
- `-fullScreenBalloonViewControllerPickerViewUsesBottomTail:` is **not** a constant. It takes
  `CGRectGetMinY` of `-tapbackButtonFrameForFullScreenBalloonViewController:` into d8 and
  `CGRectGetMaxY(navigationBar.frame)` into d9 and does `fcmp d8, d9; b.pl`: bottom tail only when the
  tapback button is at or below the nav bar's bottom, and when the frame is empty. The button is in
  the footer, so the branch is always taken here — but it is taken because of the geometry.
- `-tapbackButtonFrameForFullScreenBalloonViewController:` forwards to
  `-frameForAdditionalButtonWithActionName:`. The tapback control is a QuickLook *additional button*,
  laid out by QuickLook's bar.
- `-shouldShowTapbackPickerForFullScreenBalloonViewController:` forwards to the chat controller as
  `previewController:shouldShowTapbackPickerForChatItem:`. **Reacting from inside the viewer is real**,
  and it is decided per item.

## The footer has four buttons, not two, and ChatKit does build the bar

Added 2026-09-10, and it corrects this note's own earlier claim.

Everything above was read out of the **macCatalyst** ChatKit, because that is what a Mac can dlopen.
`-[CKQLPreviewController updateBarButtonItems]` really is a single `ret` there. It is not on iOS, and
iOS is the build that matters here. The simulator runtime ships ChatKit as a plain 28 MB Mach-O
rather than a shared-cache stub, so it disassembles straight off disk with no device and no process:

    R="/Library/Developer/CoreSimulator/Volumes/iOS_23A343/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 26.0.simruntime/Contents/Resources/RuntimeRoot"
    lldb -b -o "target create --arch arm64 \"$R/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit\"" \
            -o 'disassemble -n "-[CKQLPreviewController updateBarButtonItems]"' -o quit

872 bytes, and it reads:

1. Three early exits, each setting both `-setAdditionalLeftBarButtonItems:` and
   `-setAdditionalRightBarButtonItems:` to empty: `currentPreviewItem` not of the expected class; the
   delegate's `-shouldHideInteractionOptions`; and
   `-shouldDisableTranscriptCapabilitiesForFileTransfer:` on the item's transfer
   (`IMFileTransferCenter.sharedInstance transferForGUID:currentPreviewItem.transferGUID`).
2. Two fresh `NSMutableArray`s — a left list and a right list.
3. `currentChatItem.canSendTapbacks` → `+[UIBarButtonItem ck_tapbackItemWithChatItem:target:action:]`,
   `-setTarget:`, `-setAction:`, `-setTapbackButton:`, then `addObject:` into the **left** list when
   `CKFeatureFlags.sharedFeatureFlags.isTapbacksRefreshEnabled` and the **right** list otherwise. The
   branch is a `csel x0, [sp,#8], x20, ne` — the two arrays, picked by the flag.
4. `-replyButton` → the same `csel` on the same flag → the same side.
5. `-canCurrentPreviewItemQuickSave` (and `-currentPreviewItemIsSaved` for the symbol) →
   `+[UIImage systemImageNamed:]` → `-[UIBarButtonItem initWithImage:style:target:action:]` →
   `addObject:` into the **right** list, always (`mov x0, x20`, no branch).
6. `-setAdditionalLeftBarButtonItems:` with the first list, `-setAdditionalRightBarButtonItems:` with
   the second.

**The flag is on, and the capture is what proves it.** The probe had no chat item and no
`ckQLPreviewControllerDelegate`, so `canSendTapbacks` was false and `canCurrentPreviewItemQuickSave`
was false: the only thing `updateBarButtonItems` could add was the reply button. In
`image-viewer-chrome-dark.png` that reply button is on the **leading** edge, at x 28. Reply only
lands in the left list when `isTapbacksRefreshEnabled` is set. So on this build it is set, and in real
Messages the footer reads:

| Side | Items |
|---|---|
| leading | tapback, then reply |
| trailing | save, then QuickLook's own share (`_actionButtonTapped:`, never ChatKit's) |

`registry/imessage/image-viewer.tsx` used to draw reply alone on the leading side with tapback, save
and share trailing. It now draws the groups above; `imageViewerMetrics.footerGroups` carries the
reading. Re-diffing `/lab/photoviewer?scene=chrome` against the capture after the move gives the same
**0.13%** it gave before — that scene passes no `onReact`, so its leading group is the lone reply
button at x 28, exactly as captured. The three `photo-viewer*` baselines moved and were regenerated.

Still unmeasured: the gap between two discs inside one group (this kit draws 8 pt), and whether the
order inside the leading group really is tapback-then-reply on screen or only in the array.

## The drag-to-dismiss dimming was written and then ignored

Added 2026-09-10. `PUTilingViewSettings -interactiveTransitionBackgroundDimming` = 0.5 was already
read and already in `imageViewerMetrics.dismissDimming`, and the component already spelled it:
`opacity: 1 - m.dismissDimming * dropProgress` on the ground. It had no effect at all.

Measured in the harness at `?scene=photo-viewer-dismiss&t=200`, two thirds of the way through the
drag: the ground's inline `opacity` read **0.666667** and its computed `opacity` read **1**.
`document.getAnimations()` says why — the entrance animates that same element and is left `paused`
at progress 1 with `fill: "both"`, and a filling Web Animation beats an inline style. So the black
stayed solid through every drag and the conversation never showed through, which is the one thing
`interactiveTransitionBackgroundDimming` describes.

The fix is nesting rather than arithmetic: an outer `viewer-dimming` layer carries the drag, the
inner `viewer-ground` keeps the entrance, and opacity multiplies through the two. Measured after:
1 → 0.833 → 0.667 → 0.5 across the four `photo-viewer-dismiss` checkpoints, with the ground's own
animated opacity still 1. The `photo-viewer-dismiss` baselines moved and were regenerated; they now
show the conversation through a half-strength black behind a photo at `dismiss.minScale` 0.6, where
before they were solid black.

The commit thresholds around it (120 pt / 700 pt/s) are still JUDGEMENT — `PUOneUpSettings` carries
no dismissal threshold at all.

## It pages across messages, not inside one

This was the open question our own model turned on, because §3.4 established that a send of N photos
lands as N separate messages. If the viewer only ever showed the photo you tapped, one photo per
message would mean a viewer that can never page. It does not.

Read the same way as everything above — `lldb -b -o "b probePoint" -o run -o "disassemble -n …"`
against a macCatalyst process that has `dlopen`ed the iOSSupport ChatKit:

- **`-[CKChatController _displayPreviewItemForMediaObject:]`** is the method that puts the viewer up.
  In order it calls `-previewItemsForMediaObject:currentItemIndex:containsRestoring:`, allocates a
  `CKQLPreviewControllerDataSource`, sets `previewItems` to what that returned, hands the data source
  to the preview scene, `reloadData`, and then `setCurrentPreviewItemIndex:` to the index the same
  call handed back, `refreshCurrentPreviewItem`, `presentPreview`.
- **`CKQLPreviewControllerDataSource`** has exactly one ivar, `_previewItems` (`NSArray`), and its
  `-numberOfPreviewItemsInPreviewController:` counts it. So that array *is* the pager's length.
- **`-[CKChatController(QuickLook) previewItemsForMediaObject:currentItemIndex:containsRestoring:]`**
  builds it: `-_chatItemForMediaObject:` → `-layoutGroupIdentifier` → `self.collectionViewController`
  → **`-chatItems`**, the whole transcript, then `-enumerateObjectsUsingBlock:` over all of it. Per
  item the block skips `itemIsReplyContextPreview`, checks the item's class, and compares the item's
  own `layoutGroupIdentifier` to the tapped one's with `isEqualToString:` — mismatch skips, match
  appends `-mediaObject`. It never breaks out, so the group is defined by the identifier and not by
  adjacency in the array. The inner block filters on `shouldBeQuickLooked`, `transfer.isRestoring`
  and `isFileDataReady`, and records `count` as the current index when the candidate's
  `transferGUID` equals the tapped media object's — which is how the viewer opens on the photo you
  tapped rather than on the first of the group.

One branch worth writing down: the identifier test is guarded by `-length` on the captured string
(`ldr x0, [x20, #0x20]; bl length; cbz x0, <include>`). When the tapped item's `layoutGroupIdentifier`
is empty, **every** media chat item in the transcript is taken instead.

`-[CKTranscriptCollectionViewController _mediaObjectsForOrganicChatItem:onIndexPath:]` is a second,
separate walk of the same idea — it starts at the tapped index and walks backwards then forwards
while `layoutRecipe.groupIdentifier` matches, breaking at the first that does not — but its `os_log`
line is *"Quick saving all %@ chat items in organic layout group with identifier %@"*, so that one
belongs to Save All, not to the viewer.

**What this changed in the kit.** `ImageViewer` pages over exactly the `photos` it is given, so the
fix was in the shell: `ios-messages-app.tsx` gained an exported `photoRun(messages, id)`, the viewer
is mounted with the run's photos rather than `viewerMessage.images`, `useTileRects`/`readTileRects`
read tiles across every message of the run so the exit can fly back into the right balloon, and the
share / save / reply / tapback callbacks now report the message the photo **on screen** belongs to
rather than the one that was tapped. `tests/unit/photo-run.test.ts` pins it, and the three
`photo-viewer*` scenes now open from five single-photo messages instead of one five-photo message,
which is the shape a real send makes.

**Not measured:** how `layoutGroupIdentifier` is derived.
`-[IMOrganicAttachmentMessagePartChatItem layoutGroupIdentifier]` is two chained calls into IMCore
functions with no symbol. `photoRun`'s rule — the adjacent photo messages around the tapped one, same
direction and same sender — is this kit's analogue of it and is JUDGEMENT, not a reading.

## Still not measured

- **The tapback and save buttons' glyphs, and the gap between two discs in one group.** Their SIDES
  are no longer a guess — see "The footer has four buttons, not two" above, which reads them out of
  the iOS `updateBarButtonItems`: tapback and reply lead, save trails. What is still unread is the
  save item's SF Symbol name (the `systemImageNamed:` argument is a pointer into a string this
  disassembly did not resolve), the tapback item's artwork (`ck_tapbackItemWithChatItem:target:action:`
  builds it), and the spacing inside a group, which this kit draws as 8 pt. Neither button appears in
  a capture without a `ckQLPreviewControllerDelegate` handing over a chat item, so closing the glyphs
  needs a runtime delegate class that answers `previewController:shouldShowTapbackPickerForChatItem:`
  and `chatItemForMediaObject:previewController:`.
- **The chrome over a bright photo.** The capture has the chrome over black. iOS 26 glass inverts
  over a light backdrop (the plain-QuickLook capture over a white ground shows white discs with dark
  glyphs), and nothing here models that inversion.
- **The blur radius** behind the discs.
- **The thresholds** that commit a swipe or a dismissal, and the scale the photo shrinks to on the way
  down. `PUOneUpSettings` carries no dismissal threshold at all. (How far the ground dims on the way
  down IS measured — `interactiveTransitionBackgroundDimming` 0.5 — and now actually reaches the
  screen; see "The drag-to-dismiss dimming was written and then ignored".)
- **Where an applied tapback balloon sits on a full-screen photo**, and its attribution.
  `-shouldShowTapbackAttributionForFullScreenBalloonViewController:` says attribution exists; nothing
  says where.
- **The whole macOS presentation.** Same Catalyst binary, same QuickLook, `interpageSpacing` 40 at
  idiom 5 — but no window capture, so the disc sizes and insets are carried over from iOS and the
  16 pt top inset is invented.
- **Video, Live Photos, GIFs and the scrubber.** `allowGIFPlayback`, `allowScrubber`,
  `livePhotoScrubberShowForPlayback`, `livePhotoInteractionThreshold` and `autoplayVideo` are all
  read; the component renders a plain `<img>` and none of them.
- **Edit / markup.** `QLPreviewController` exposes
  `previewController:editingModeForPreviewItem:` and there is a `QLEditingUtils`, so an edit
  affordance exists in the API — but the ChatKit build put no such button in the bar, so there is
  nothing to reproduce. It is absent from the component for that reason, not by omission.
- **A thumbnail tray.** The user's brief asks for one. Plain QuickLook does have an index affordance —
  its nav bar's *left* platter is a list glyph — but ChatKit's build drops that platter entirely
  (only the right one exists in the CK hierarchy), and no tray appears in either capture. The
  component has none, and adding one would be invention.

## Known differences when diffing `?scene=chrome`

- The simulator draws its own "◀ Messages" return-to-app breadcrumb under the clock, roughly
  x 26-180, y 76-104. Not part of the viewer.
- The capture shows the home indicator (x 129-272, y 861-866). That is SpringBoard's, and
  `SPEC.md` records that the conversation captures were taken with it hidden.

Diffing the two chrome regions on their own, with those excluded:

| Region (pt) | Mismatch | Interior signed error |
|---|---|---|
| footer band `0 790 402 60` | 0.33% | 0.00 |
| close disc `330 52 62 64` | 0.40% | 0.00 |

Interior error zero in both means the disc fill, the rim and the ink are exact and the entire
remainder is sub-pixel antialiasing on the glyph outlines.


## Registry and simulator regression pass, 2026-09-29

The reproducible probe now lives in `tests/ios/ViewerReference.m`, with its XCTest journey in
`tests/ios/SimulatorReview.swift` and host runner in `scripts/test-ios.py`. It presents the actual
`CKQLPreviewController` with the repository's JPEGs. Captures remain separate from browser baselines.
On iPhone 17 Pro / iOS 26.0 (23A343), the landscape showcase JPEG fits at `(0, 303, 402, 268)`;
the portrait probe fits at `(0, 169, 402, 536)`. Both are asserted by the regression checks.

The browser's portrait fit still compares at 0 mismatched pixels under the existing pixelmatch
threshold against the native fixture capture. The complete chrome comparison is 0.13% different,
including SpringBoard's home indicator and the return-to-app breadcrumb; this is not a claim of
identical pixels across renderers. The enabled/disabled button measurements above remain unchanged.

This pass fixed transcript tapbacks painting over the viewer, scaled gesture coordinates, cancelled
pointers committing navigation, cached/cold portrait entrance transforms, WebKit's variable image
resampling during size changes, and real Safari coalescing a double tap into one pointer pair plus
`dblclick`. `optimizeQuality` bypasses WebKit's low-quality animated-resize heuristic; see
`Source/WebCore/rendering/ImageQualityController.cpp` in WebKit. It preserves interpolation, unlike
`-webkit-optimize-contrast`, which uses nearest-neighbor sampling.

`pageOffset` now holds an actual intermediate swipe. Opening, paging and dismissal are replayed after
fresh navigations with exact decoded-pixel equality in `tests/e2e/photo-viewer.spec.ts`. The reaction
regression removes the hidden transcript reaction and asserts that the open viewer's pixels do not
change. Cancelled gestures and double taps also run at 60% scale. The site matrix covers every public
component at phone/desktop widths and in both themes.

Repeated Chrome captures exposed a blank 256px raster tile in the transcript photo beneath the fading
viewer. Compositing that image separately removes the missing tile. Viewer captures explicitly decode
the underlying lazy photos before settling layout. Exact replay comparisons omit only the harness's
decorative corner mask, whose edge alpha varies with compositing; the regular visual suite retains it.

Remaining fidelity boundary: the PhotosUI settings measured earlier are not a complete model of
QuickLook's image decoder and zoom policy. The landscape JPEG's native double tap produced a
2560 x 1706.667pt canvas in this run, whereas the component uses the earlier PhotosUI factor of 2.5.
The native portrait fixture also supports Live Text selection, which this web image component does
not implement. Do not describe those aspects, the four-control footer gaps or the drag thresholds
as matched to native merely because interaction and regression tests pass.
