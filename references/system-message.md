# Transcript status lines — how each number was taken

Everything `registry/imessage/system-message.tsx` asserts, and the exact command that produces it
again. Three routes: the one capture, ChatKit, and the loctables. SPEC.md carries the results; this
file carries the method.

## 1. The capture — `references/ios/captures/incoming-light.png`

The unknown-sender notice is the only member of this family in any committed capture.

```bash
python3 - <<'EOF'
from PIL import Image
import numpy as np
im = np.array(Image.open("references/ios/captures/incoming-light.png").convert("RGB")).astype(int)
for y in range(2140, 2260):
    m = im[y].sum(axis=1) < 3*250
    xs = np.nonzero(m)[0]
    if len(xs): print(y, round(y/3, 3), "n=%d" % len(xs), "x %d-%d" % (xs.min(), xs.max()))
EOF
```

Landmarks in that scan:

| landmark | rows | reading |
|---|---|---|
| line 1 ink | 2163–2195 | 721.000 – 732.000 |
| line 1 x-height opens | 2170 (n 65 → 337) | 723.333 |
| line 1 baseline | between 2188 and 2189 (n 525 → 128) | 729.6667 |
| line 2 ink | 2204–2234 | 734.667 – 745.000 |
| line 2 x-height opens | 2210 (n 5 → 41) | 736.667 |
| line 2 baseline | between 2228 and 2229 (n 82 → 24) | 743.0 |
| line 1 horizontal ink | x 67–1137 | 22.3333 – 379.3333, **357.0 wide** |

- **Pitch 13.3333** — 40 device rows, from the baselines *and* from the x-height tops, independently.
- **Size 11** — 357.0 pt of advance for the 65 characters of line 1. 12 pt needs ≈389, which does not
  fit the 370 column. Do **not** argue this from x-height: `-[UIFont xHeight]` is 5.79 for this font,
  and every threshold reading of the capture returns 6.0–6.33, so all of them are AA-inflated.
- **Space above 16.1667** — the bubble above ends at 702.6667 (its full-width run ends after row 2108;
  row 2109 keeps only the tail, n 173 → 34). Line 1's baseline at 729.6667 less SF's 10.6348 ascent
  and the (13.3333 − 12.9551)/2 = 0.1891 half-leading puts the line box top at 718.8334.

### Fitting the tracking and the gap against the capture

`/lab/system-message?scene=notice` reconstructs the frame: the notice under a spacer whose bottom
edge is 702.6667, so the diffed band holds nothing but the two lines of text. `&ls=` and `&gap=`
override the tracking and the space above without touching the component.

```bash
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers \
  bun scripts/measure/compare.ts \
  "http://localhost:3100/lab/system-message?scene=notice&ls=0.12" \
  references/ios/captures/incoming-light.png 3 402 874 /tmp/cmp 0 712 402 40
```

Mean squared error of the whole 402×40 band, at gap 13.1667:

| tracking | 0.10 | 0.11 | 0.115 | **0.12** | 0.125 | 0.13 | 0.135 | 0.14 | 0.15 |
|---|---|---|---|---|---|---|---|---|---|
| MSE | 468.6 | 431.5 | 423.9 | **418.7** | 424.6 | 424.1 | 439.9 | 462.9 | 503.1 |

At tracking 0.12:

| gap above | 11.83 | 12.17 | 12.67 | **13.0 – 13.5** | 14.0 |
|---|---|---|---|---|---|
| MSE | 779.0 | 574.5 | 520.2 | **418.7** | 742.1 |

Chrome snaps a baseline to whole CSS px, so the whole 13.0–13.5 plateau rasterises identically; the
13.1667 the geometry gives sits inside it. Final: **3.70 % light, 3.89 % dark, interior mean signed
0.00** — the remainder is glyph anti-aliasing.

## 2. ChatKit 26.5 — the Catalyst probe

`/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework` is the Catalyst build of
Messages' UI framework, so a Catalyst process can `dlopen` it and read its constants. Swizzling
`-[UIDevice userInterfaceIdiom]` is what makes `+[CKUIBehavior sharedBehaviors]` pick a side; both
concrete subclasses can also be instantiated directly, which is what the numbers below use.

```objc
// probe.m
#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <objc/message.h>
#import <dlfcn.h>

static UIUserInterfaceIdiom gIdiom = UIUserInterfaceIdiomPhone;
static UIUserInterfaceIdiom fakeIdiom(id self, SEL _cmd) { return gIdiom; }

int main(int argc, char **argv) { @autoreleasepool {
  method_setImplementation(class_getInstanceMethod(UIDevice.class, @selector(userInterfaceIdiom)), (IMP)fakeIdiom);
  gIdiom = (argc > 1 && !strcmp(argv[1], "mac")) ? UIUserInterfaceIdiomMac : UIUserInterfaceIdiomPhone;
  dlopen("/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit", RTLD_NOW);

  id b = [[NSClassFromString(gIdiom == UIUserInterfaceIdiomMac ? @"CKUIBehaviorMac" : @"CKUIBehaviorPhone") alloc] init];
  NSDictionary *reg = ((id(*)(id,SEL))objc_msgSend)(b, @selector(transcriptRegularFontAttributes));
  NSDictionary *emp = ((id(*)(id,SEL))objc_msgSend)(b, @selector(transcriptEmphasizedFontAttributes));
  for (NSDictionary *d in @[reg, emp]) {
    UIFont *f = d[NSFontAttributeName];
    NSParagraphStyle *ps = d[NSParagraphStyleAttributeName];
    NSDictionary *tr = [f.fontDescriptor objectForKey:UIFontDescriptorTraitsAttribute];
    printf("%s %.2f lh=%.4f weight=%s align=%ld minLH=%.2f maxLH=%.2f spacing=%.2f\n",
      f.fontName.UTF8String, f.pointSize, f.lineHeight,
      [NSString stringWithFormat:@"%@", tr[UIFontWeightTrait]].UTF8String,
      (long)ps.alignment, ps.minimumLineHeight, ps.maximumLineHeight, ps.lineSpacing);
  }
  id item = [[NSClassFromString(@"CKGroupActionChatItem") alloc] init];
  UIEdgeInsets i = ((UIEdgeInsets(*)(id,SEL))objc_msgSend)(item, NSSelectorFromString(@"textAlignmentInsets"));
  printf("textAlignmentInsets {t %.2f l %.2f b %.2f r %.2f}  hasSelectableText=%s\n", i.top, i.left, i.bottom, i.right,
    ((BOOL(*)(id,SEL))objc_msgSend)(item, NSSelectorFromString(@"hasSelectableText")) ? "YES" : "NO");
  return 0;
} }
```

```bash
SDK=$(xcrun --sdk macosx --show-sdk-path)
clang -target arm64-apple-ios26.0-macabi -isysroot "$SDK" \
  -iframework "$SDK/System/iOSSupport/System/Library/Frameworks" \
  -isystem "$SDK/System/iOSSupport/usr/include" \
  -framework UIKit -framework Foundation -fobjc-arc -o probe.bin probe.m
./probe.bin phone; ./probe.bin mac
```

Output (macOS 26.5.2, build 25F84):

```
phone: .SFNS-Regular 11.00 lh=13.0000 weight=0    align=1 minLH=0.00 maxLH=0.00 spacing=0.00
phone: .SFNS-Medium  11.00 lh=13.0000 weight=0.23 align=1 minLH=0.00 maxLH=0.00 spacing=0.00
phone: textAlignmentInsets {t 3.00 l 0.00 b 3.00 r 0.00}  hasSelectableText=NO
mac:   .SFNS-Regular 11.00 lh=13.0000 weight=0    align=1 minLH=0.00 maxLH=0.00 spacing=0.00
mac:   .SFNS-Medium  11.00 lh=13.0000 weight=0.23 align=1 minLH=0.00 maxLH=0.00 spacing=0.00
mac:   textAlignmentInsets {t 2.50 l 0.00 b 2.00 r 0.00}  hasSelectableText=NO
```

`transcriptGroupModificationErrorRegularFontAttributes` returns .SFNS-Light (trait −0.4) in
`systemRedColor` and its `…Emphasized…` twin returns .SFNS-Medium, on both idioms.
`transcriptMessageStatusFont` is .SFNS-Semibold 11 on the phone and .SFNS-Medium **9** on the Mac —
the one transcript metric that scales, and the one this component used to borrow for macOS.
`transcriptStatusItemEdgeInsets` is all zeros on both.

### Two caveats about probe colours

- `transcriptRegularFontAttributes`' foreground is `UIColor.secondaryLabel`. Under Catalyst that
  resolves to the *macOS* pair, black @0.498 / white @0.549, which over #ffffff and #1e1e1e gives
  exactly the #808080 / #9a9a9a the palette already carries for macOS. The iOS pair (#8a8a8e /
  #8d8d93) comes from the capture and from iOS's own secondaryLabel, not from the probe.
- `systemRedColor` is a `UIDynamicCatalogSystemColor` and resolves on the host too: the probe returns
  #ff383c / #ff4245 under *both* idioms, which is the Mac's red. The iOS red in the component is
  Apple's published value and is **not** a reading.

### What the probe could not reach

The spacing between two chat items lives in
`-[CKChatItem layoutItemSpacingWithEnvironment:datasourceItemIndex:allDatasourceItems:supplementryItems:sizeOverride:]`,
which needs a live `UICollectionViewLayoutEnvironment`. `transcriptStatusItemEdgeInsets` is zeros and
no `CGFloat` selector on `CKUIBehavior` matching `status|orphan|junk|groupmod|spacing|vertical|padding|inset`
carries it. That is why `gapAbove` for the group lines is still unmeasured.

## 3. The strings

No probe needed — the loctables are binary plists.

```bash
python3 - <<'EOF'
import plistlib, re
d = plistlib.load(open("/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework/Resources/ChatKit.loctable", "rb"))
for k, v in sorted(d["en"].items()):
    if re.search(r"^GROUP_|_STATUS$|RETRACTED|SAVE_ACTION", k): print(repr(k), "=>", repr(v))
for lang in ("es", "de", "ja", "fr"):
    print(lang, repr(d[lang]["GROUP_YOU_NAME_STATUS"]))
EOF
```

That prints the `#…#` emphasis markup and the localisations that prove it is markup
(`#Has denominado#`, `#Du#`, `#あなた#`, `#Vous#`). `statusTemplates` in the component is a verbatim
copy of the `en` values, so a diff against this command is the check.

The tapback verbs are in `IMSharedUtilities.framework/Resources/IMSharedUtilities.loctable`, keyed by
their own English format ("%@ loved “%@”", "You loved “%@”"), with **no** `#…#`: they are the
notification and preview formats, not transcript status strings. There is no `Missed*` key anywhere
in ChatKit; "Missed Call" and "Missed FaceTime" are in
`/System/Applications/FaceTime.app/…/Recents.loctable`, and "Missed Video Call" is nowhere.

## 4. The route that is still open

A real group event on the iOS simulator would settle `gapAbove` for the group lines at the same
402×874 @3x geometry every other iOS capture uses:

1. `xcrun simctl list devices booted` (an iOS 26 iPhone 17 Pro matches the capture geometry) and
   `xcrun simctl terminate booted com.apple.MobileSMS`.
2. Insert into `~/Library/Developer/CoreSimulator/Devices/<UDID>/data/Library/SMS/sms.db`: one
   `chat` with `style = 43`, two `handle` rows joined through `chat_handle_join`, then `message`
   rows with `item_type` 2 (`group_title` set — the rename), 1 with `group_action_type` 0 and
   `other_handle` (the join), 6 (the group photo) and 3 (the leave), each joined through
   `chat_message_join`, with `date` in nanoseconds since 2001-01-01 and 60 s apart so no date header
   is inserted between them, and a plain `item_type` 0 message at each end.
3. `xcrun simctl launch booted com.apple.MobileSMS`, open the chat, `xcrun simctl io booted
   screenshot`.

Sequencing a bubble, three status lines and a bubble in one frame gives the bubble→status,
status→status and status→bubble spacings together. This was attempted while writing the component and
the sandbox declined the write to the Messages database, so it needs an explicit permission grant.
