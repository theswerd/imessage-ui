# Reproducing the ChatKit probe behind `tapback-details.tsx`

No capture of the Tapback Details platter exists, so its numbers come from ChatKit. This note is the
recipe, so the next person does not have to rediscover it. The findings themselves are in
`SPEC.md`, section "The Tapback Details platter".

Read on 2026-09-08 against macOS 26.5.2 (25F84) with Xcode 26.6 and the iOS 26.0 (23A343) simulator
runtime installed.

## 1. The Catalyst probe (live values)

macOS Messages is a Catalyst app, so its ChatKit lives under `/System/iOSSupport`. Build for the
Mac Catalyst target, swizzle the idiom, `dlopen` the framework, then `objc_msgSend` whatever you want.

```c
// probe.m
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <objc/message.h>
#import <dlfcn.h>

static long gIdiom = 5;                       // 0 = phone, 5 = mac
static long fakeIdiom(id s, SEL c) { (void)s; (void)c; return gIdiom; }

int main(void) { @autoreleasepool {
  const char *e = getenv("PROBE_IDIOM"); if (e) gIdiom = atol(e);
  method_setImplementation(class_getInstanceMethod([UIDevice class], @selector(userInterfaceIdiom)),
                           (IMP)fakeIdiom);
  dlopen("/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit", RTLD_NOW);

  Class ss = objc_getClass("ChatKit.StyleSupport");
  printf("cellWidth %.4f\n", ((double(*)(id,SEL))objc_msgSend)(ss, sel_registerName("votingViewCellWidth")));

  id behavior = [[objc_getClass(gIdiom == 5 ? "CKUIBehaviorMac" : "CKUIBehaviorPhone") alloc] init];
  printf("height %.4f\n", ((double(*)(id,SEL))objc_msgSend)(behavior, sel_registerName("messageAcknowledgementVotingViewHeight")));

  id theme = [[objc_getClass(gIdiom == 5 ? "CKUIThemeMac" : "CKUITheme") alloc] init];
  UIColor *c = ((id(*)(id,SEL))objc_msgSend)(theme, sel_registerName("messageAcknowledgmentVotingTextColor"));
  UIColor *r = [c resolvedColorWithTraitCollection:
      [UITraitCollection traitCollectionWithUserInterfaceStyle:UIUserInterfaceStyleLight]];
  CGFloat rr, gg, bb, aa; [r getRed:&rr green:&gg blue:&bb alpha:&aa];
  printf("votingTextColor rgba(%.0f,%.0f,%.0f,%.4f)\n", rr*255, gg*255, bb*255, aa);
} return 0; }
```

```sh
SDK=/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk
xcrun clang -target arm64-apple-ios26.0-macabi -isysroot "$SDK" \
  -iframework "$SDK/System/iOSSupport/System/Library/Frameworks" \
  -framework Foundation -framework UIKit -fobjc-arc probe.m -o probe
PROBE_IDIOM=0 ./probe        # phone values
PROBE_IDIOM=5 ./probe        # mac values
```

Three things worth knowing:

- `+[CKUITheme currentTheme]` does not exist. Instantiate `CKUITheme` or `CKUIThemeMac` directly.
- `CKUIBehavior` has `+sharedBehaviors`, but `[[CKUIBehaviorPhone alloc] init]` and
  `[[CKUIBehaviorMac alloc] init]` give both idioms in one process, which is what makes the
  no-Catalyst-scale comparison possible.
- Semantic system colours resolve to their **macOS** values in this process. `secondaryLabelColor`
  comes back rgba(0,0,0,0.498) / rgba(255,255,255,0.549), not iOS's rgba(60,60,67,0.6) /
  rgba(235,235,245,0.6). Anything that resolves to one of those is a macOS reading of an iOS colour.

To enumerate rather than guess: `objc_copyClassList` and `class_copyMethodList` with a substring
match on `voting`, `acknowledg`, `tapback` or `attribution` finds every relevant selector, and
`method_getReturnType` says how to call it.

## 2. The simulator framework (symbols and disassembly)

The macOS copy is inside the dyld shared cache, so `strings` and `otool` cannot open it. The **iOS
simulator runtime ships the same framework as a plain file with its symbol table intact**:

```sh
CK="/Library/Developer/CoreSimulator/Volumes/iOS_23A343/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 26.0.simruntime/Contents/Resources/RuntimeRoot/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit"
strings -a "$CK" | grep -i voting
nm -a "$CK" | grep -i votingView
otool -tV -p '-[CKFullScreenBalloonViewControllerPhone votingViewTargetFrame]' "$CK"
otool -tV -p '-[CKChatController(ClickyOrbConformance) _votingViewForChatItem:containingViewController:]' "$CK"
```

That is how the presentation rule and the identity of the view were settled — the second method
allocates a `CKAttributionViewAccessoryView` at `attributionViewHeight`, which is what ties the
platter to the card in `longpress-ok-selected-*.png`.

The strings live in `ChatKit.framework/Resources/ChatKit.loctable`, a binary plist keyed by language:

```sh
python3 -c "import plistlib;d=plistlib.load(open('$CK/../Resources/ChatKit.loctable','rb'));\
print({k:v for k,v in d['en'].items() if 'TAPBACK' in k})"
```

## 3. What is still missing

A capture. The iOS simulator has the two mirrored sample conversations, so a tapback sent from one
appears as somebody else's in the other, which is enough to put two different people's reactions on
one message and open this platter. `simctl` has no tap command and this repo forbids synthetic
pointer events on the host, so producing that frame needs a hand on the simulator. It would settle
every open item in SPEC's "Still unverified for this surface" list at once.
