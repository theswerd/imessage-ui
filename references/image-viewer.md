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

Three Liquid Glass circles floating over the photo. No "Done" text button, no title text, no
thumbnail tray, no opaque bars, no scrim.

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

- `-[CKQLPreviewController updateBarButtonItems]` is one instruction: `ret`. ChatKit builds no bars.
  `viewDidAppear:` and `currentPreviewItemDidChange` both call it, and it does nothing. `loadView`
  only sets `navigationBar.barStyle`.
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

## Still not measured

- **The tapback and save buttons' slot in the bar, and their glyphs.** `-tapbackTapped:`,
  `-tapbackButton`, `-setTapbackButton:`, `-saveTapped:`, `-canCurrentPreviewItemQuickSave`,
  `-currentPreviewItemIsSaved` and the axbundle's "Save photo" all exist, but neither button appears
  without a `ckQLPreviewControllerDelegate` handing over a chat item, which a probe outside Messages
  cannot do. The component puts them in the trailing group next to share with an 8 pt gap, which is a
  guess. Closing this needs a runtime delegate class that answers
  `previewController:shouldShowTapbackPickerForChatItem:` and `chatItemForMediaObject:previewController:`.
- **The chrome over a bright photo.** The capture has the chrome over black. iOS 26 glass inverts
  over a light backdrop (the plain-QuickLook capture over a white ground shows white discs with dark
  glyphs), and nothing here models that inversion.
- **The blur radius** behind the discs.
- **The thresholds** that commit a swipe or a dismissal, and the scale the photo shrinks to on the way
  down. `PUOneUpSettings` carries no dismissal threshold at all.
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
