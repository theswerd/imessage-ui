# Measuring the iOS 26 sticker picker

How `references/ios/captures/sticker-picker-light.png` and every ChatKit number in
`registry/imessage/sticker-picker.tsx` were obtained, so both are reproducible. The values themselves
live in `SPEC.md` under "iOS 26 sticker picker"; this file is the method.

## Why the usual route does not work

The picker's card is not drawn by Messages. `_UIStickerPickerViewController` is a shell around
`_UIStickerPickerServiceRemoteViewController`, whose scene comes from
`com.apple.iMessageAppsViewService` and whose UI is `com.apple.StickerKit.StickerPickerService`. So:

- Nothing in Messages' own process holds the card's layout, and no Catalyst probe can read it —
  `StickerKit.framework` is not installed on macOS at all.
- The card cannot be inspected from the host app either: its view hierarchy stops at a
  `_UISceneHostingView` / `_UIContextLayerHostView` pair.

What *is* possible is to make the system draw it and photograph the result.

## Capturing the card

`StickerKit.framework` **is** present in the iOS 26 simulator runtime
(`.../iOS 26.0.simruntime/Contents/Resources/RuntimeRoot/System/Library/Frameworks/StickerKit.framework`),
and `_UIStickerPickerViewController` will present itself for any app that asks. A throwaway app is
enough:

```objc
// main.m — arm64-apple-ios26.0-simulator
- (void)viewDidAppear:(BOOL)animated {
  UIViewController *vc = [[NSClassFromString(@"_UIStickerPickerViewController") alloc] init];
  UIView *src = [[UIView alloc] initWithFrame:CGRectMake(28, 806, 40, 40)];   // stands in for the composer's +
  [self.view addSubview:src];
  [vc setValue:src forKey:@"sourceView"];
  ((void(*)(id,SEL,CGRect))objc_msgSend)(vc, sel_getUid("setSourceRect:"), src.bounds);
  [self addChildViewController:vc];
  vc.view.frame = self.view.bounds;
  [self.view addSubview:vc.view];
  [vc didMoveToParentViewController:self];
  ((void(*)(id,SEL))objc_msgSend)(vc, sel_getUid("presentCard"));
}
```

```sh
SDK=$(xcrun --sdk iphonesimulator --show-sdk-path)
xcrun -sdk iphonesimulator clang -target arm64-apple-ios26.0-simulator -isysroot "$SDK" \
  -fobjc-arc -framework UIKit -framework Foundation main.m -o SP.app/SP
xcrun simctl install booted SP.app
xcrun simctl privacy booted grant contacts <bundle-id>   # the service asks, and its alert covers the card
xcrun simctl launch booted <bundle-id>
xcrun simctl io booted screenshot sticker-picker-light.png
```

`presentCard` hands the card to `_UIFormSheetPresentationController`, which is where the sheet's
inset, corners and dimming come from. The card's own contents — the title, the close button, the
category strip, the empty state — are StickerKit's, so they are the ones Messages hosts.

**The backdrop is deliberate.** The host view draws four flat 402x60 bands at y 100/160/220/280:
white, `colorWithWhite:0.5`, black, and pure red. All four come back multiplied by exactly 0.8
(255→204, 128→102, 0→0, (255,0,0)→(204,0,0)), which pins the presentation's dimming at black 0.20 in
one shot, and the red one shows the card is translucent rather than opaque (the card's top reads
(230,222,222) with red behind it).

`app/lab/ios-sticker-picker` reproduces those bands, so a diff of the capture is comparing like with
like above the sheet as well as inside it.

## What could not be captured

Recents is empty on a fresh simulator, so the capture shows the card's empty state and **no sticker
cell**. Switching category needs a tap, and the card is out of process, so:

- in-process synthesised `UITouch`es do not reach it;
- `simctl` has no HID injection;
- iOS Full Keyboard Access does work in the simulator
  (`xcrun simctl spawn booted defaults write com.apple.Accessibility FullKeyboardAccessEnabled -bool true`,
  then restart SpringBoard, then send Tab to the Simulator app with `osascript` — keyboard only, never
  the mouse), and a focus ring does appear. It was not usable here because the simulator on this
  machine is shared with other agents, which kept foregrounding their own apps mid-run.

So the grid's cell size and column count remain unmeasured for this card. The component uses
ChatKit's attachment-browser grid instead and labels it as such.

## Reading ChatKit natively

The same app can `dlopen` ChatKit inside the simulator, which is better than the Catalyst route this
repo has used elsewhere: the idiom really is `.phone`, so `+[CKUIBehavior sharedBehaviors]` really
vends `CKUIBehaviorPhone` and nothing depends on a `-[UIDevice userInterfaceIdiom]` swizzle.

```objc
dlopen("/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit", RTLD_NOW);
id b = [objc_getClass("CKUIBehavior") performSelector:@selector(sharedBehaviors)];
// -> CKUIBehaviorPhone, idiom 0
```

The drag numbers are better still, because the class can simply be *run*. `CKBrowserDragStickerView`
takes an image whose only requirement is a `frames` selector (a one-element category on `UIImage`
satisfies it), and then the animation can be read straight back off its layer:

```objc
id v = ((id(*)(id,SEL,CGRect,id))objc_msgSend)([DS alloc],
        sel_getUid("initWithSourceRect:dragImage:"), CGRectMake(20,500,72,72), img);
((void(*)(id,SEL,BOOL))objc_msgSend)(v, sel_getUid("setCanPeel:"), YES);
((void(*)(id,SEL,BOOL))objc_msgSend)(v, sel_getUid("setCanRotate:"), YES);
((void(*)(id,SEL,double))objc_msgSend)(v, sel_getUid("setDragViewScale:"), 1.0);
((void(*)(id,SEL,CGPoint))objc_msgSend)(v, sel_getUid("attachElasticEffectsForLocation:"), CGPointMake(200,400));
((void(*)(id,SEL))objc_msgSend)(v, sel_getUid("animateScaleDown"));
// [v layer] now carries "scaleDownAnimation"
```

which prints, verbatim:

```
initialSize={72,72} rasterized={72,72} initialScale=1 dragViewScale=1 dragViewScaleUp=1
elasticFunctionPositionX tension=550 friction=20     elasticFunctionRotation tension=350 friction=15
elasticFunctionScaleX    tension=350 friction=20
scaleDownAnimation CASpringAnimation dur=0.91 speed=0.8 fillMode=forwards
  timing=(0.14028 0.004662; 0.57534 0.96737) keyPath=transform.scale.xy from=1 to=0.7142857142857143
```

Two things follow that a disassembly alone got wrong. `dragViewScaleUp` is **1** in the ordinary case
— it is a rasterisation correction, not a lift — so `1 / 0.714285` is not a 1.4x lift; the carried
sticker only ever gets *smaller*. And the scale-down's duration is 0.91 at speed 0.8, i.e. **1137.5 ms
of wall clock**, not the 0.31 that appears in the surrounding `CATransaction`.

## Leaving the machine as it was

The simulator here is shared. Anything toggled for a measurement — the appearance, Full Keyboard
Access, the host's `com.apple.iphonesimulator ConnectHardwareKeyboard` — has to go back afterwards,
and a second simulator booted for isolation has to be shut down again.
