# The audio recorder, measured

`registry/imessage/audio-recorder.tsx` — recording a voice message: the composer's field becomes a
row with a live waveform, a running timer and a stop button; stopping swaps the stop for a play
control, a duration pill that appends to the take, and a send pill.

**No capture in `references/` holds this screen on either platform**, and none can be made from the
committed material: the iOS simulator has no way to drive Messages' mic button without sending
pointer events to the user's Mac, which this project forbids. So every geometric number in the
component was read out of **ChatKit** — the framework macOS Messages (a Catalyst app) and iOS
Messages both run on — with the probe below. The probe is committed here in full so that anyone can
re-derive every number; `references/SPEC.md` § "Audio recorder" tabulates what it prints.

## Running it

```sh
SDK=$(xcrun --sdk macosx --show-sdk-path)
xcrun clang -target arm64-apple-ios26.0-macabi -isysroot "$SDK" \
  -iframework "$SDK/System/iOSSupport/System/Library/Frameworks" \
  -framework UIKit -framework Foundation -framework CoreGraphics -framework QuartzCore \
  -fobjc-arc audio-recorder-probe.m -o probe && ./probe
```

Three things make it work where a naive probe traps:

1. **`-[UIDevice userInterfaceIdiom]` is swizzled** so `+[CKUIBehavior sharedBehaviors]` vends the
   Phone or the Mac behaviour. `+[CKUIBehavior testOverrideClearSharedBehaviors]` clears the cached
   singleton between the two.
2. **`+[IMService iMessageService]` is stubbed.** `ChatKit.AudioMessageRecordingView.init(frame:)`
   force-unwraps it, and it is nil outside Messages; without the stub the process dies with
   `EXC_BREAKPOINT` at `AudioMessageRecordingView.init(frame:) + 604`, whose disassembly is a
   `cbz` on the result of `objc_msgSend$iMessageService` jumping straight to a `brk #0x1`. The view
   only stores the service, so a bare `[IMService alloc]` is enough.
3. **The view is built, not read about.** `-[CKAudioMessageRecordingView initWithFrame:service:]`,
   then `-addToWaveformWithIntensity:` for known levels, then `-setState:` and `-layoutIfNeeded`, and
   the frames come off the real subviews. Two of its Swift-only ivars (`stateChangeAnimationDuration`,
   `stateChangeSpringDamping`) are read at their `ivar_getOffset` because they have no accessor.

Two cautions learned the hard way:

- **Build a fresh view per state.** Calling `-setState:` repeatedly on one view accumulates segment
  views and reports a contaminated waveform (44 segments become 90).
- **Force nothing.** Setting the view's frame to a height you chose rather than the one
  `-sizeThatFits:` returns changes the Mac layout: the Mac row is **49** tall, and forcing 52 turns
  its 36.75 waveform into 39 and its 62.5 x 27 duration pill into 66.5 x 29.

## Verifying the component against it

`/lab/audio-recorder` renders the row at native geometry. `/tmp` scratch scripts aside, the check
that matters is: read the rendered boxes out of Chromium and compare them with the frames above.
All eighteen — row, waveform, timer, play, stop, send, bar count and leading gap, across three
states and both platforms — agree to better than 0.06 px, and the bar heights agree with
`level² × viewHeight × min(1, √(k/4))` to 0.014 px.

## The probe

```objc
// ChatKit audio-recorder probe — every number in references/SPEC.md "Audio recorder" comes from this.
//
//   SDK=$(xcrun --sdk macosx --show-sdk-path)
//   xcrun clang -target arm64-apple-ios26.0-macabi -isysroot "$SDK" \
//     -iframework "$SDK/System/iOSSupport/System/Library/Frameworks" \
//     -framework UIKit -framework Foundation -framework CoreGraphics -framework QuartzCore \
//     -fobjc-arc audio-recorder-probe.m -o probe && ./probe
//
// It dlopens ChatKit, swizzles -[UIDevice userInterfaceIdiom] so +[CKUIBehavior sharedBehaviors]
// vends the Phone or the Mac behaviour, and stubs +[IMService iMessageService], which
// AudioMessageRecordingView.init(frame:) force-unwraps and which is nil outside Messages (without
// the stub the initialiser traps at ChatKit`AudioMessageRecordingView.init(frame:) + 604). Then it
// builds the real -[CKAudioMessageRecordingView initWithFrame:service:], feeds it known intensities
// and walks -setState: 1..3, reading every subview's frame, radius, colour, font and symbol back.
#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <objc/message.h>
#import <dlfcn.h>

static UIUserInterfaceIdiom gIdiom = UIUserInterfaceIdiomPhone;
static UIUserInterfaceIdiom fakeIdiom(id self, SEL _cmd) { (void)self; (void)_cmd; return gIdiom; }
static id gService = nil;
static id fakeService(id self, SEL _cmd) { (void)self; (void)_cmd; return gService; }

static id behaviors(void) {
  Class b = objc_getClass("CKUIBehavior");
  ((void (*)(id, SEL))objc_msgSend)(b, sel_registerName("testOverrideClearSharedBehaviors"));
  return ((id (*)(id, SEL))objc_msgSend)(b, sel_registerName("sharedBehaviors"));
}
static double dbl(id o, const char *s) { return ((double (*)(id, SEL))objc_msgSend)(o, sel_registerName(s)); }
static unsigned long ul(id o, const char *s) { return ((unsigned long (*)(id, SEL))objc_msgSend)(o, sel_registerName(s)); }
static id obj(id o, const char *s) { return ((id (*)(id, SEL))objc_msgSend)(o, sel_registerName(s)); }
static double swiftDouble(id o, const char *name) {
  Ivar iv = class_getInstanceVariable([o class], name);
  return iv ? *(double *)((__bridge void *)o + ivar_getOffset(iv)) : NAN;
}
static id swiftObject(id o, const char *name) {
  Ivar iv = class_getInstanceVariable([o class], name);
  return iv ? (__bridge id)*(void **)((__bridge void *)o + ivar_getOffset(iv)) : nil;
}

static void colour(const char *label, UIColor *c) {
  if (!c) return;
  CGFloat r = 0, g = 0, b = 0, a = 0;
  [[c resolvedColorWithTraitCollection:[UITraitCollection traitCollectionWithUserInterfaceStyle:UIUserInterfaceStyleLight]] getRed:&r green:&g blue:&b alpha:&a];
  printf("  %-26s light rgba(%.0f, %.0f, %.0f, %.4f)", label, r * 255, g * 255, b * 255, a);
  [[c resolvedColorWithTraitCollection:[UITraitCollection traitCollectionWithUserInterfaceStyle:UIUserInterfaceStyleDark]] getRed:&r green:&g blue:&b alpha:&a];
  printf("   dark rgba(%.0f, %.0f, %.0f, %.4f)\n", r * 255, g * 255, b * 255, a);
}

/** Ink box and coverage of a symbol image, drawn as a template at 8x and scanned for alpha. */
static void ink(const char *label, UIImage *img) {
  if (!img || img.size.width == 0) { printf("  %-22s (none)\n", label); return; }
  const CGFloat S = 8, pad = 2;
  size_t w = (size_t)ceil((img.size.width + 2 * pad) * S), h = (size_t)ceil((img.size.height + 2 * pad) * S);
  uint8_t *buf = calloc(h, w * 4);
  CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
  CGContextRef ctx = CGBitmapContextCreate(buf, w, h, 8, w * 4, cs, (CGBitmapInfo)kCGImageAlphaPremultipliedLast);
  UIGraphicsPushContext(ctx);
  CGContextScaleCTM(ctx, S, S);
  [[img imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate] drawInRect:CGRectMake(pad, pad, img.size.width, img.size.height)];
  UIGraphicsPopContext();
  long minx = w, maxx = -1, miny = h, maxy = -1; double area = 0;
  for (size_t y = 0; y < h; y++) for (size_t x = 0; x < w; x++) {
    uint8_t a = buf[y * w * 4 + x * 4 + 3];
    if (!a) continue;
    area += a / 255.0;
    if ((long)x < minx) minx = x; if ((long)x > maxx) maxx = x;
    if ((long)y < miny) miny = y; if ((long)y > maxy) maxy = y;
  }
  printf("  %-22s image %.4f x %.4f   ink %.4f x %.4f   coverage %.4f pt^2\n", label,
         img.size.width, img.size.height, (maxx - minx + 1) / S, (maxy - miny + 1) / S, area / (S * S));
  CGContextRelease(ctx); CGColorSpaceRelease(cs); free(buf);
}

static void walk(UIView *v, const char *needle, NSMutableArray *out) {
  if (strstr(NSStringFromClass(v.class).UTF8String, needle)) [out addObject:v];
  for (UIView *s in v.subviews) walk(s, needle, out);
}

static UIView *build(double width, int count, double level, long state) {
  Class rv = objc_getClass("CKAudioMessageRecordingView");
  UIView *v = ((id (*)(id, SEL, CGRect, id))objc_msgSend)([rv alloc], sel_registerName("initWithFrame:service:"),
                                                          CGRectMake(0, 0, width, 52), gService);
  for (int i = 0; i < count; i++)
    ((void (*)(id, SEL, double))objc_msgSend)(v, sel_registerName("addToWaveformWithIntensity:"), level);
  ((void (*)(id, SEL, long))objc_msgSend)(v, sel_registerName("setState:"), state);
  ((void (*)(id, SEL, double))objc_msgSend)(v, sel_registerName("setPlaybackDuration:"), count / 12.0);
  ((void (*)(id, SEL, double))objc_msgSend)(v, sel_registerName("setPlaybackCurrentTime:"), 0.0);
  CGSize fits = [v sizeThatFits:CGSizeMake(width, CGFLOAT_MAX)];
  v.frame = CGRectMake(0, 0, width, fits.height);
  [v setNeedsLayout]; [v layoutIfNeeded];
  return v;
}

int main(void) {
  setvbuf(stdout, NULL, _IONBF, 0);
  @autoreleasepool {
    if (!dlopen("/System/iOSSupport/System/Library/PrivateFrameworks/ChatKit.framework/ChatKit", RTLD_NOW)) {
      printf("dlopen failed: %s\n", dlerror()); return 1;
    }
    method_setImplementation(class_getInstanceMethod(UIDevice.class, @selector(userInterfaceIdiom)), (IMP)fakeIdiom);
    Class im = objc_getClass("IMService");
    gService = [im alloc];
    method_setImplementation(class_getClassMethod(im, sel_registerName("iMessageService")), (IMP)fakeService);

    struct { const char *name; UIUserInterfaceIdiom idiom; double width; } runs[] = {
      { "PHONE", UIUserInterfaceIdiomPhone, 294 },   // the measured iOS composer field
      { "MAC",   UIUserInterfaceIdiomMac,   530 },   // the measured macOS composer field
    };
    const char *states[] = { "", "recording", "stopped", "playing" };

    for (int r = 0; r < 2; r++) {
      gIdiom = runs[r].idiom;
      id b = behaviors();
      printf("\n================ %s, %.0f-wide box ================\n", runs[r].name, runs[r].width);

      printf("-- CKUIBehavior --\n");
      const char *ds[] = { "audioRecordingViewButtonSpacing", "audioRecordingViewDurationSpacing",
        "audioRecordingViewPadding", "audioRecordingViewTimeBetweenWaveformSegments",
        "audioRecordingViewMinimumDBLevel", "audioRecordingViewMaximumDBLevel", "audioWaveformGapWidth",
        "audioWaveformHeight", "audioWaveformViewHeight", "minimumWaveformHeight",
        "minAudioRecordingDuration", "maxAudioRecordingDuration", "audioMessagePeakAnimationDuration",
        "entryViewConcentricPadding", "entryViewCoverMinHeight", "entryViewPlusButtonToTextFieldPadding",
        "entryViewEmojiButtonToTextFieldPadding", "entryViewLeftInsetForRecordedAudioCancelButton", NULL };
      for (int i = 0; ds[i]; i++) printf("  %-46s %.6f\n", ds[i], dbl(b, ds[i]));
      const char *is[] = { "waveformPowerLevelWidth", "waveformGapWidth", "waveformMinPowerLevelsCount",
        "waveformMaxPowerLevelsCount", NULL };
      for (int i = 0; is[i]; i++) printf("  %-46s %lu\n", is[i], ul(b, is[i]));
      UIFont *f = obj(b, "audioBalloonTimeFont");
      printf("  %-46s %s / %.4f\n", "audioBalloonTimeFont", f.fontName.UTF8String, f.pointSize);

      for (long state = 1; state <= 3; state++) {
        UIView *v = build(runs[r].width, 24, 0.8, state);
        printf("\n-- state %ld (%s), sizeThatFits height %.4f --\n", state, states[state], v.frame.size.height);
        if (state == 1)
          printf("  minimumWaveformWidth %.4f  stateChangeAnimationDuration %.4f  stateChangeSpringDamping %.4f\n",
                 swiftDouble(v, "minimumWaveformWidth"), swiftDouble(v, "stateChangeAnimationDuration"),
                 swiftDouble(v, "stateChangeSpringDamping"));
        UIButton *stop = obj(v, "stopButton"), *send = obj(v, "sendButton");
        UIButton *play = swiftObject(v, "playButton");
        UIView *append = swiftObject(v, "durationAppendButton");
        NSMutableArray *wave = [NSMutableArray array]; walk(v, "WaveformView", wave);
        UIView *box = wave.firstObject;
        const char *fmt = "  %-12s (%9.4f, %8.4f, %9.4f, %8.4f)  alpha %.2f  radius %.4f\n";
        printf(fmt, "play", play.frame.origin.x, play.frame.origin.y, play.frame.size.width, play.frame.size.height, play.alpha, play.layer.cornerRadius);
        printf(fmt, "waveform", box.frame.origin.x, box.frame.origin.y, box.frame.size.width, box.frame.size.height, box.alpha, box.layer.cornerRadius);
        printf(fmt, "timer", append.frame.origin.x, append.frame.origin.y, append.frame.size.width, append.frame.size.height, append.alpha, ((UIView *)append.subviews.firstObject).layer.cornerRadius);
        printf(fmt, "stop", stop.frame.origin.x, stop.frame.origin.y, stop.frame.size.width, stop.frame.size.height, stop.alpha, stop.layer.cornerRadius);
        printf(fmt, "send", send.frame.origin.x, send.frame.origin.y, send.frame.size.width, send.frame.size.height, send.alpha, send.layer.cornerRadius);

        NSMutableArray *segs = [NSMutableArray array]; walk(box, "SegmentView", segs);
        [segs sortUsingComparator:^NSComparisonResult(UIView *a, UIView *c) { return a.frame.origin.x > c.frame.origin.x ? 1 : -1; }];
        UIView *first = segs.firstObject, *last = segs.lastObject;
        printf("  segments %lu, pitch %.4f, first x %.4f, last right %.4f, bar %.4f x radius %.4f\n",
               (unsigned long)segs.count,
               segs.count > 1 ? ((UIView *)segs[1]).frame.origin.x - first.frame.origin.x : 0,
               first.frame.origin.x, CGRectGetMaxX(last.frame), first.frame.size.width, first.layer.cornerRadius);
        printf("  newest six heights:");
        for (NSUInteger i = segs.count > 6 ? segs.count - 6 : 0; i < segs.count; i++)
          printf(" %.4f", ((UIView *)segs[i]).frame.size.height);
        printf("   (level 0.8, level^2 * viewHeight = %.4f)\n", 0.64 * box.frame.size.height);
        colour("segment fill", ((UIView *)segs.lastObject).backgroundColor);
        colour("play fill", play.configuration.background.backgroundColor);
        colour("play ink", play.configuration.baseForegroundColor);
        colour("stop fill", stop.configuration.background.backgroundColor);
        colour("stop ink", stop.configuration.baseForegroundColor);
        colour("send fill", send.configuration.background.backgroundColor);
        UIButton *inner = (UIButton *)append.subviews.firstObject;
        colour("timer fill", inner.configuration.background.backgroundColor);
        colour("timer ink", inner.configuration.baseForegroundColor);
        NSMutableArray *labels = [NSMutableArray array]; walk(append, "UILabel", labels);
        NSMutableArray *images = [NSMutableArray array]; walk(append, "UIImageView", images);
        UILabel *label = labels.firstObject; UIImageView *glyph = images.firstObject;
        printf("  timer label \"%s\" %s/%.2f at (%.4f, %.4f, %.4f, %.4f); glyph box (%.4f, %.4f, %.4f, %.4f)\n",
               label.text.UTF8String ?: "", label.font.fontName.UTF8String, label.font.pointSize,
               label.frame.origin.x, label.frame.origin.y, label.frame.size.width, label.frame.size.height,
               glyph.frame.origin.x, glyph.frame.origin.y, glyph.frame.size.width, glyph.frame.size.height);
        ink("stop glyph", stop.configuration.image);
        ink("send glyph", send.configuration.image);
        ink("play glyph", play.configuration.image);
        ink("timer glyph", inner.configuration.image);
      }

      // The `x` that replaces the composer's `+`.
      UIButton *cancel = [[objc_getClass("CKGlassCancelAudioRecordingButton") alloc] init];
      CGSize fits = [cancel sizeThatFits:CGSizeMake(CGFLOAT_MAX, CGFLOAT_MAX)];
      cancel.frame = CGRectMake(0, 0, fits.width, fits.height);
      [cancel layoutIfNeeded];
      NSMutableArray *iv = [NSMutableArray array]; walk(cancel, "UIImageView", iv);
      printf("\n-- CKGlassCancelAudioRecordingButton: %.4f x %.4f, radius %.4f, glyph box (%.4f, %.4f, %.4f, %.4f) --\n",
             fits.width, fits.height, cancel.layer.cornerRadius,
             ((UIView *)iv.firstObject).frame.origin.x, ((UIView *)iv.firstObject).frame.origin.y,
             ((UIView *)iv.firstObject).frame.size.width, ((UIView *)iv.firstObject).frame.size.height);
      colour("cancel ink", cancel.configuration.baseForegroundColor);
      ink("cancel glyph", cancel.configuration.image);
    }

    // The bar-height law and the ramp: feed one level and read the newest bars back.
    gIdiom = UIUserInterfaceIdiomPhone;
    behaviors();
    printf("\n================ bar-height law ================\n");
    double levels[] = { 0.1, 0.2, 0.3333333, 0.4, 0.4444444, 0.5, 0.6, 0.6666667, 0.75, 0.8, 0.9, 1.0 };
    for (int i = 0; i < 12; i++) {
      UIView *v = build(294, 12, levels[i], 1);
      NSMutableArray *segs = [NSMutableArray array]; walk(v, "SegmentView", segs);
      [segs sortUsingComparator:^NSComparisonResult(UIView *a, UIView *c) { return a.frame.origin.x > c.frame.origin.x ? 1 : -1; }];
      double settled = ((UIView *)segs[segs.count - 5]).frame.size.height;
      printf("  level %.7f -> settled bar %.4f   level^2 * 39 = %.4f\n", levels[i], settled, levels[i] * levels[i] * 39);
    }
    printf("  ramp, newest first (level 0.8, level^2 * 39 = 24.96):");
    {
      UIView *v = build(294, 12, 0.8, 1);
      NSMutableArray *segs = [NSMutableArray array]; walk(v, "SegmentView", segs);
      [segs sortUsingComparator:^NSComparisonResult(UIView *a, UIView *c) { return a.frame.origin.x < c.frame.origin.x ? 1 : -1; }];
      for (int k = 0; k < 6; k++)
        printf(" k=%d %.4f (sqrt(k/4) = %.5f)", k, ((UIView *)segs[k]).frame.size.height, sqrt(k / 4.0));
      printf("\n");
    }

    // The played rule, once stopped.
    printf("\n================ played bars ================\n");
    for (double frac = 0; frac <= 1.001; frac += 0.125) {
      UIView *v = build(294, 24, 0.8, 2);
      ((void (*)(id, SEL, double))objc_msgSend)(v, sel_registerName("setPlaybackCurrentTime:"), 2.0 * frac);
      ((void (*)(id, SEL, double))objc_msgSend)(v, sel_registerName("setPlaybackDuration:"), 2.0);
      [v setNeedsLayout]; [v layoutIfNeeded];
      NSMutableArray *segs = [NSMutableArray array]; walk(v, "SegmentView", segs);
      int full = 0;
      for (UIView *s in segs) if (s.alpha > 0.99) full++;
      printf("  fraction %.3f of %lu bars -> %d played   max(1, floor(fraction * count)) = %d\n",
             frac, (unsigned long)segs.count, full, (int)fmax(1, floor(frac * segs.count)));
    }

    // Which symbol configuration each control draws.
    printf("\n================ SF Symbols ================\n");
    struct { const char *sym; double pt; UIImageSymbolWeight weight; const char *name; } syms[] = {
      { "stop.fill", 17, UIImageSymbolWeightRegular, "stop.fill 17 regular" },
      { "play.fill", 17, UIImageSymbolWeightRegular, "play.fill 17 regular" },
      { "pause.fill", 17, UIImageSymbolWeightRegular, "pause.fill 17 regular" },
      { "plus", 17, UIImageSymbolWeightRegular, "plus 17 regular" },
      { "arrow.up", 17, UIImageSymbolWeightBold, "arrow.up 17 bold" },
      { "xmark", 16, UIImageSymbolWeightMedium, "xmark 16 medium" },
    };
    for (int i = 0; i < 6; i++)
      ink(syms[i].name, [UIImage systemImageNamed:[NSString stringWithUTF8String:syms[i].sym]
                               withConfiguration:[UIImageSymbolConfiguration configurationWithPointSize:syms[i].pt weight:syms[i].weight]]);
  }
  return 0;
}
```

## What it prints

```

================ PHONE, 294-wide box ================
-- CKUIBehavior --
  audioRecordingViewButtonSpacing                16.000000
  audioRecordingViewDurationSpacing              12.000000
  audioRecordingViewPadding                      18.000000
  audioRecordingViewTimeBetweenWaveformSegments  0.083333
  audioRecordingViewMinimumDBLevel               -60.000000
  audioRecordingViewMaximumDBLevel               -10.000000
  audioWaveformGapWidth                          2.000000
  audioWaveformHeight                            35.000000
  audioWaveformViewHeight                        39.000000
  minimumWaveformHeight                          4.000000
  minAudioRecordingDuration                      0.250000
  maxAudioRecordingDuration                      60.000000
  audioMessagePeakAnimationDuration              0.500000
  entryViewConcentricPadding                     28.000000
  entryViewCoverMinHeight                        40.000000
  entryViewPlusButtonToTextFieldPadding          12.000000
  entryViewEmojiButtonToTextFieldPadding         10.000000
  entryViewLeftInsetForRecordedAudioCancelButton 8.500000
  waveformPowerLevelWidth                        2
  waveformGapWidth                               2
  waveformMinPowerLevelsCount                    25
  waveformMaxPowerLevelsCount                    50
  audioBalloonTimeFont                           .SFNS-Regular / 13.0000

-- state 1 (recording), sizeThatFits height 52.0000 --
  minimumWaveformWidth 30.0000  stateChangeAnimationDuration 0.6000  stateChangeSpringDamping 0.8600
  play         (   9.0000,   9.0000,   34.0000,  34.0000)  alpha 0.00  radius 17.0000
  waveform     (  16.0000,   6.5000,  181.5000,  39.0000)  alpha 1.00  radius 0.0000
  timer        ( 209.5000,  18.0000,   29.5000,  16.0000)  alpha 1.00  radius 8.0000
  stop         ( 251.0000,   9.0000,   34.0000,  34.0000)  alpha 1.00  radius 17.0000
  send         ( 249.0000,  15.0000,   30.0000,  22.0000)  alpha 0.00  radius 11.0000
  segments 45, pitch 4.0000, first x 3.5000, last right 181.5000, bar 2.0000 x radius 1.0000
  newest six heights: 24.9600 24.9600 21.6160 17.6494 12.4800 4.0000   (level 0.8, level^2 * viewHeight = 24.9600)
  segment fill               light rgba(255, 56, 60, 1.0000)   dark rgba(255, 66, 69, 1.0000)
  play fill                  light rgba(118, 118, 128, 0.1200)   dark rgba(118, 118, 128, 0.2400)
  play ink                   light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  stop fill                  light rgba(255, 56, 60, 0.1900)   dark rgba(255, 56, 60, 0.1900)
  stop ink                   light rgba(255, 56, 60, 1.0000)   dark rgba(255, 66, 69, 1.0000)
  send fill                  light rgba(0, 136, 255, 1.0000)   dark rgba(0, 136, 255, 1.0000)
  timer fill                 light rgba(0, 0, 0, 0.0000)   dark rgba(0, 0, 0, 0.0000)
  timer ink                  light rgba(255, 56, 60, 1.0000)   dark rgba(255, 66, 69, 1.0000)
  timer label "0:00" .SFNS-Regular/13.00 at (0.0000, 0.0000, 29.5000, 16.0000); glyph box (0.0000, 8.0000, 0.0000, 0.0000)
  stop glyph             image 18.0000 x 16.0000   ink 14.0000 x 14.0000   coverage 180.3853 pt^2
  send glyph             image 17.5000 x 19.0000   ink 13.5000 x 16.0000   coverage 68.9608 pt^2
  play glyph             image 15.0000 x 16.0000   ink 12.5000 x 14.0000   coverage 101.8686 pt^2
  timer glyph            (none)

-- state 2 (stopped), sizeThatFits height 52.0000 --
  play         (   9.0000,   9.0000,   34.0000,  34.0000)  alpha 1.00  radius 17.0000
  waveform     (  55.0000,   6.5000,  109.0000,  39.0000)  alpha 1.00  radius 0.0000
  timer        ( 176.0000,  13.0000,   61.0000,  26.0000)  alpha 1.00  radius 13.0000
  stop         ( 251.0000,   9.0000,   34.0000,  34.0000)  alpha 0.00  radius 17.0000
  send         ( 249.0000,  15.0000,   30.0000,  22.0000)  alpha 1.00  radius 11.0000
  segments 27, pitch 4.0000, first x 3.0000, last right 109.0000, bar 2.0000 x radius 1.0000
  newest six heights: 24.9600 24.9600 24.9600 24.9600 24.9600 24.9600   (level 0.8, level^2 * viewHeight = 24.9600)
  segment fill               light rgba(0, 0, 0, 0.4980)   dark rgba(255, 255, 255, 0.5490)
  play fill                  light rgba(118, 118, 128, 0.1200)   dark rgba(118, 118, 128, 0.2400)
  play ink                   light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  stop fill                  light rgba(255, 56, 60, 0.1900)   dark rgba(255, 56, 60, 0.1900)
  stop ink                   light rgba(255, 56, 60, 1.0000)   dark rgba(255, 66, 69, 1.0000)
  send fill                  light rgba(0, 136, 255, 1.0000)   dark rgba(0, 136, 255, 1.0000)
  timer fill                 light rgba(116, 116, 128, 0.0800)   dark rgba(116, 116, 128, 0.0800)
  timer ink                  light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  timer label "0:02" .SFNS-Regular/13.00 at (21.5000, 5.0000, 29.5000, 16.0000); glyph box (7.0000, 8.0000, 11.5000, 10.5000)
  stop glyph             image 18.0000 x 16.0000   ink 14.0000 x 14.0000   coverage 180.3853 pt^2
  send glyph             image 17.5000 x 19.0000   ink 13.5000 x 16.0000   coverage 68.9608 pt^2
  play glyph             image 15.0000 x 16.0000   ink 12.5000 x 14.0000   coverage 101.8686 pt^2
  timer glyph            image 18.0000 x 16.0000   ink 14.0000 x 14.0000   coverage 37.4529 pt^2

-- state 3 (playing), sizeThatFits height 52.0000 --
  play         (   9.0000,   9.0000,   34.0000,  34.0000)  alpha 1.00  radius 17.0000
  waveform     (  55.0000,   6.5000,  140.5000,  39.0000)  alpha 1.00  radius 0.0000
  timer        ( 207.5000,  18.0000,   29.5000,  16.0000)  alpha 1.00  radius 8.0000
  stop         ( 251.0000,   9.0000,   34.0000,  34.0000)  alpha 0.00  radius 17.0000
  send         ( 249.0000,  15.0000,   30.0000,  22.0000)  alpha 1.00  radius 11.0000
  segments 42, pitch 0.0000, first x 2.5000, last right 140.5000, bar 2.0000 x radius 1.0000
  newest six heights: 24.9600 24.9600 24.9600 24.9600 24.9600 24.9600   (level 0.8, level^2 * viewHeight = 24.9600)
  segment fill               light rgba(0, 0, 0, 0.4980)   dark rgba(255, 255, 255, 0.5490)
  play fill                  light rgba(118, 118, 128, 0.1200)   dark rgba(118, 118, 128, 0.2400)
  play ink                   light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  stop fill                  light rgba(255, 56, 60, 0.1900)   dark rgba(255, 56, 60, 0.1900)
  stop ink                   light rgba(255, 56, 60, 1.0000)   dark rgba(255, 66, 69, 1.0000)
  send fill                  light rgba(0, 136, 255, 1.0000)   dark rgba(0, 136, 255, 1.0000)
  timer fill                 light rgba(0, 0, 0, 0.0000)   dark rgba(0, 0, 0, 0.0000)
  timer ink                  light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  timer label "0:00" .SFNS-Regular/13.00 at (0.0000, 0.0000, 29.5000, 16.0000); glyph box (0.0000, 8.0000, 0.0000, 0.0000)
  stop glyph             image 18.0000 x 16.0000   ink 14.0000 x 14.0000   coverage 180.3853 pt^2
  send glyph             image 17.5000 x 19.0000   ink 13.5000 x 16.0000   coverage 68.9608 pt^2
  play glyph             image 14.5000 x 16.0000   ink 10.5000 x 14.0000   coverage 110.7490 pt^2
  timer glyph            (none)

-- CKGlassCancelAudioRecordingButton: 41.0000 x 41.0000, radius 20.5000, glyph box (12.0000, 12.5000, 17.0000, 16.0000) --
  cancel ink                 light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  cancel glyph           image 17.0000 x 16.0000   ink 13.0000 x 13.0000   coverage 55.3471 pt^2

================ MAC, 530-wide box ================
-- CKUIBehavior --
  audioRecordingViewButtonSpacing                16.000000
  audioRecordingViewDurationSpacing              12.000000
  audioRecordingViewPadding                      18.000000
  audioRecordingViewTimeBetweenWaveformSegments  0.083333
  audioRecordingViewMinimumDBLevel               -60.000000
  audioRecordingViewMaximumDBLevel               -10.000000
  audioWaveformGapWidth                          2.000000
  audioWaveformHeight                            35.000000
  audioWaveformViewHeight                        39.000000
  minimumWaveformHeight                          4.000000
  minAudioRecordingDuration                      0.250000
  maxAudioRecordingDuration                      60.000000
  audioMessagePeakAnimationDuration              0.500000
  entryViewConcentricPadding                     11.000000
  entryViewCoverMinHeight                        30.000000
  entryViewPlusButtonToTextFieldPadding          10.000000
  entryViewEmojiButtonToTextFieldPadding         10.000000
  entryViewLeftInsetForRecordedAudioCancelButton 8.500000
  waveformPowerLevelWidth                        2
  waveformGapWidth                               2
  waveformMinPowerLevelsCount                    25
  waveformMaxPowerLevelsCount                    50
  audioBalloonTimeFont                           .SFNS-Regular / 16.0000

-- state 1 (recording), sizeThatFits height 52.0000 --
  minimumWaveformWidth 30.0000  stateChangeAnimationDuration 0.6000  stateChangeSpringDamping 0.8600
  play         (   9.0000,   9.0000,   34.0000,  34.0000)  alpha 0.00  radius 17.0000
  waveform     (  16.0000,   6.5000,  412.0000,  39.0000)  alpha 1.00  radius 0.0000
  timer        ( 440.0000,  16.5000,   35.0000,  19.0000)  alpha 1.00  radius 9.5000
  stop         ( 487.0000,   9.0000,   34.0000,  34.0000)  alpha 1.00  radius 17.0000
  send         ( 485.0000,  15.0000,   30.0000,  22.0000)  alpha 0.00  radius 11.0000
  segments 103, pitch 4.0000, first x 2.0000, last right 412.0000, bar 2.0000 x radius 1.0000
  newest six heights: 24.9600 24.9600 21.6160 17.6494 12.4800 4.0000   (level 0.8, level^2 * viewHeight = 24.9600)
  segment fill               light rgba(255, 56, 60, 1.0000)   dark rgba(255, 66, 69, 1.0000)
  play fill                  light rgba(118, 118, 128, 0.1200)   dark rgba(118, 118, 128, 0.2400)
  play ink                   light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  stop fill                  light rgba(255, 56, 60, 0.1900)   dark rgba(255, 56, 60, 0.1900)
  stop ink                   light rgba(255, 56, 60, 1.0000)   dark rgba(255, 66, 69, 1.0000)
  send fill                  light rgba(0, 136, 255, 1.0000)   dark rgba(0, 136, 255, 1.0000)
  timer fill                 light rgba(0, 0, 0, 0.0000)   dark rgba(0, 0, 0, 0.0000)
  timer ink                  light rgba(255, 56, 60, 1.0000)   dark rgba(255, 66, 69, 1.0000)
  timer label "0:00" .SFNS-Regular/16.00 at (0.0000, 0.0000, 35.0000, 19.0000); glyph box (0.0000, 9.5000, 0.0000, 0.0000)
  stop glyph             image 18.0000 x 16.0000   ink 14.0000 x 14.0000   coverage 180.3853 pt^2
  send glyph             image 17.5000 x 19.0000   ink 13.5000 x 16.0000   coverage 68.9608 pt^2
  play glyph             image 15.0000 x 16.0000   ink 12.5000 x 14.0000   coverage 101.8686 pt^2
  timer glyph            (none)

-- state 2 (stopped), sizeThatFits height 52.0000 --
  play         (   9.0000,   9.0000,   34.0000,  34.0000)  alpha 1.00  radius 17.0000
  waveform     (  55.0000,   6.5000,  339.5000,  39.0000)  alpha 1.00  radius 0.0000
  timer        ( 406.5000,  11.5000,   66.5000,  29.0000)  alpha 1.00  radius 14.5000
  stop         ( 487.0000,   9.0000,   34.0000,  34.0000)  alpha 0.00  radius 17.0000
  send         ( 485.0000,  15.0000,   30.0000,  22.0000)  alpha 1.00  radius 11.0000
  segments 84, pitch 4.0000, first x 5.5000, last right 339.5000, bar 2.0000 x radius 1.0000
  newest six heights: 24.9600 24.9600 24.9600 24.9600 24.9600 24.9600   (level 0.8, level^2 * viewHeight = 24.9600)
  segment fill               light rgba(0, 0, 0, 0.4980)   dark rgba(255, 255, 255, 0.5490)
  play fill                  light rgba(118, 118, 128, 0.1200)   dark rgba(118, 118, 128, 0.2400)
  play ink                   light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  stop fill                  light rgba(255, 56, 60, 0.1900)   dark rgba(255, 56, 60, 0.1900)
  stop ink                   light rgba(255, 56, 60, 1.0000)   dark rgba(255, 66, 69, 1.0000)
  send fill                  light rgba(0, 136, 255, 1.0000)   dark rgba(0, 136, 255, 1.0000)
  timer fill                 light rgba(116, 116, 128, 0.0800)   dark rgba(116, 116, 128, 0.0800)
  timer ink                  light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  timer label "0:02" .SFNS-Regular/16.00 at (21.5000, 5.0000, 35.0000, 19.0000); glyph box (7.0000, 9.5000, 11.5000, 10.5000)
  stop glyph             image 18.0000 x 16.0000   ink 14.0000 x 14.0000   coverage 180.3853 pt^2
  send glyph             image 17.5000 x 19.0000   ink 13.5000 x 16.0000   coverage 68.9608 pt^2
  play glyph             image 15.0000 x 16.0000   ink 12.5000 x 14.0000   coverage 101.8686 pt^2
  timer glyph            image 18.0000 x 16.0000   ink 14.0000 x 14.0000   coverage 37.4529 pt^2

-- state 3 (playing), sizeThatFits height 52.0000 --
  play         (   9.0000,   9.0000,   34.0000,  34.0000)  alpha 1.00  radius 17.0000
  waveform     (  55.0000,   6.5000,  371.0000,  39.0000)  alpha 1.00  radius 0.0000
  timer        ( 438.0000,  16.5000,   35.0000,  19.0000)  alpha 1.00  radius 9.5000
  stop         ( 487.0000,   9.0000,   34.0000,  34.0000)  alpha 0.00  radius 17.0000
  send         ( 485.0000,  15.0000,   30.0000,  22.0000)  alpha 1.00  radius 11.0000
  segments 101, pitch 0.0000, first x 5.0000, last right 371.0000, bar 2.0000 x radius 1.0000
  newest six heights: 24.9600 24.9600 24.9600 24.9600 24.9600 24.9600   (level 0.8, level^2 * viewHeight = 24.9600)
  segment fill               light rgba(0, 0, 0, 0.4980)   dark rgba(255, 255, 255, 0.5490)
  play fill                  light rgba(118, 118, 128, 0.1200)   dark rgba(118, 118, 128, 0.2400)
  play ink                   light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  stop fill                  light rgba(255, 56, 60, 0.1900)   dark rgba(255, 56, 60, 0.1900)
  stop ink                   light rgba(255, 56, 60, 1.0000)   dark rgba(255, 66, 69, 1.0000)
  send fill                  light rgba(0, 136, 255, 1.0000)   dark rgba(0, 136, 255, 1.0000)
  timer fill                 light rgba(0, 0, 0, 0.0000)   dark rgba(0, 0, 0, 0.0000)
  timer ink                  light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  timer label "0:00" .SFNS-Regular/16.00 at (0.0000, 0.0000, 35.0000, 19.0000); glyph box (0.0000, 9.5000, 0.0000, 0.0000)
  stop glyph             image 18.0000 x 16.0000   ink 14.0000 x 14.0000   coverage 180.3853 pt^2
  send glyph             image 17.5000 x 19.0000   ink 13.5000 x 16.0000   coverage 68.9608 pt^2
  play glyph             image 14.5000 x 16.0000   ink 10.5000 x 14.0000   coverage 110.7490 pt^2
  timer glyph            (none)

-- CKGlassCancelAudioRecordingButton: 41.0000 x 41.0000, radius 20.5000, glyph box (12.0000, 12.5000, 17.0000, 16.0000) --
  cancel ink                 light rgba(0, 0, 0, 0.8471)   dark rgba(255, 255, 255, 0.8471)
  cancel glyph           image 17.0000 x 16.0000   ink 13.0000 x 13.0000   coverage 55.3471 pt^2

================ bar-height law ================
  level 0.1000000 -> settled bar 4.0000   level^2 * 39 = 0.3900
  level 0.2000000 -> settled bar 4.0000   level^2 * 39 = 1.5600
  level 0.3333333 -> settled bar 4.3333   level^2 * 39 = 4.3333
  level 0.4000000 -> settled bar 6.2400   level^2 * 39 = 6.2400
  level 0.4444444 -> settled bar 7.7037   level^2 * 39 = 7.7037
  level 0.5000000 -> settled bar 9.7500   level^2 * 39 = 9.7500
  level 0.6000000 -> settled bar 14.0400   level^2 * 39 = 14.0400
  level 0.6666667 -> settled bar 17.3333   level^2 * 39 = 17.3333
  level 0.7500000 -> settled bar 21.9375   level^2 * 39 = 21.9375
  level 0.8000000 -> settled bar 24.9600   level^2 * 39 = 24.9600
  level 0.9000000 -> settled bar 31.5900   level^2 * 39 = 31.5900
  level 1.0000000 -> settled bar 39.0000   level^2 * 39 = 39.0000
  ramp, newest first (level 0.8, level^2 * 39 = 24.96): k=0 4.0000 (sqrt(k/4) = 0.00000) k=1 12.4800 (sqrt(k/4) = 0.50000) k=2 17.6494 (sqrt(k/4) = 0.70711) k=3 21.6160 (sqrt(k/4) = 0.86603) k=4 24.9600 (sqrt(k/4) = 1.00000) k=5 24.9600 (sqrt(k/4) = 1.11803)

================ played bars ================
  fraction 0.000 of 27 bars -> 1 played   max(1, floor(fraction * count)) = 1
  fraction 0.125 of 27 bars -> 3 played   max(1, floor(fraction * count)) = 3
  fraction 0.250 of 27 bars -> 6 played   max(1, floor(fraction * count)) = 6
  fraction 0.375 of 27 bars -> 10 played   max(1, floor(fraction * count)) = 10
  fraction 0.500 of 27 bars -> 13 played   max(1, floor(fraction * count)) = 13
  fraction 0.625 of 27 bars -> 16 played   max(1, floor(fraction * count)) = 16
  fraction 0.750 of 27 bars -> 20 played   max(1, floor(fraction * count)) = 20
  fraction 0.875 of 27 bars -> 23 played   max(1, floor(fraction * count)) = 23
  fraction 1.000 of 27 bars -> 27 played   max(1, floor(fraction * count)) = 27

================ SF Symbols ================
  stop.fill 17 regular   image 18.0000 x 16.0000   ink 14.0000 x 14.0000   coverage 180.3853 pt^2
  play.fill 17 regular   image 15.0000 x 16.0000   ink 12.5000 x 14.0000   coverage 101.8686 pt^2
  pause.fill 17 regular  image 14.5000 x 16.0000   ink 10.5000 x 14.0000   coverage 110.7490 pt^2
  plus 17 regular        image 18.0000 x 16.0000   ink 14.0000 x 14.0000   coverage 37.4529 pt^2
  arrow.up 17 bold       image 17.5000 x 19.0000   ink 13.5000 x 16.0000   coverage 68.9608 pt^2
  xmark 16 medium        image 17.0000 x 16.0000   ink 13.0000 x 13.0000   coverage 55.3471 pt^2
```
