# Evaluation cases driven off the headless simulator

Everything below was produced on `imessage-eval`
(`525CB796-F5C9-41C3-92FC-D760CA5CE9DC`, iPhone 17 Pro, iOS 26.0 build 23A343, 1206x2622 device px =
402x874 pt at 3x). No Simulator.app was ever running — `pgrep -x Simulator` returned nothing
throughout — and nothing was typed or tapped. Every state below is reached by a `simctl` command.

The checkpoints in section 3 are in the repo as
`references/ios/motion/simulator-checkpoints.json`, and `scripts/eval-simulator-cases.ts` is what
runs our kit against them. The rig problems section 0 describes in `record.ts` were fixed after this
was written — the recorder now waits for its client to exit, escalates if it does not, and clears the
sandbox temp that otherwise poisons the device-wide recording lock.

Status bar pinned for every capture, and re-pinned before each one, because a device cycle loses it:

    xcrun simctl status_bar 525CB796-F5C9-41C3-92FC-D760CA5CE9DC override \
      --time "9:41" --batteryState discharging --batteryLevel 100 \
      --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3

---

## 0. Read this first: three things about the rig

**The recorder leaks, and the leak is silent.** `record.ts` writes `frames.json`, sends SIGINT to
`simctl io … recordVideo`, and the recorder does not die. It keeps the display, and the *next*
recording is truncated rather than refused. Measured: a run that should have produced ~4.5 s produced
**6 frames over 1.5 s** because a recorder from eleven minutes earlier was still attached. Kill it and
the *device* still holds a lock of its own, and then every recording captures nothing at all
(`Host recording is already in progress`); only `simctl shutdown` + `boot` clears that. `rec/reap.sh`
and `rec/batch.sh` in this directory do both. Falsifier: `ps -eo pid,etime,command | grep recordVideo`
after a completed run — if a recorder is listed, the leak is live.

**The device shuts itself down.** `xcrun simctl terminate <udid> com.apple.MobileSMS` took the whole
device to `Shutdown` on 2 of 3 attempts, and `launch` inside ~30 s of a boot returns
`The system shell probably crashed`. `rec/sim.sh ready` boots if needed and waits for
`simctl io screenshot` to succeed before anything else runs. (That probe must write to a real path:
simctl refuses `/dev/null` with a sandbox error, which is its own half-hour.)

**The simulator is shared.** Other agents in this session drive the same UDID and record on it.
Two `recordVideo` processes do not error, they interleave, so `rec/batch.sh` waits for a free display
and re-runs any case whose manifest comes back without a usable `t = 0`.

---

## 1. The reachability map

What "evaluates" means: the surface of ours that the transition is ground truth for.

Status: **recorded** = a `frames.json` in `recordings/` and a measurement in section 2. **queued** =
in `rec/batch.sh`, recorded after this was written — check `recordings/` for it. **open** = reachable
with the exact command given, nothing has run it. **blocked** = not reachable without touch.

### 1.1 `simctl ui` — the three system-wide appearance switches

| # | state / transition | command | evaluates | status |
|---|---|---|---|---|
| 1 | light → dark | `xcrun simctl ui $U appearance dark` | `tokens.ts` dark palette, and the *timing* of our theme swap | **recorded** |
| 2 | dark → light | `xcrun simctl ui $U appearance light` | same, other direction — is it the reverse curve? | **recorded** |
| 3 | Increase Contrast on | `xcrun simctl ui $U increase_contrast enabled` | separates a token that is a real colour from one that is an opacity over a ground | queued |
| 4 | Increase Contrast off | `xcrun simctl ui $U increase_contrast disabled` | the return path | queued |
| 5 | Dynamic Type L → XXXL | `xcrun simctl ui $U content_size extra-extra-extra-large` | every text metric in the kit; bubble height, list row height, nav bar | **recorded** |
| 6 | Dynamic Type L → AX5 | `… content_size accessibility-extra-extra-extra-large` | the accessibility range, where iOS restacks rather than scales | **recorded** (2.7) |
| 7 | AX5 → L | `… content_size large` | the return path | queued |
| 8 | each single step | `… content_size increment` / `decrement` | the 12-stop ladder, one stop at a time | open |
| 9 | the other 9 categories | `… content_size {extra-small,small,medium,large,extra-large,extra-extra-large,accessibility-medium,accessibility-large,accessibility-extra-large,accessibility-extra-extra-large}` | the full ladder | open |

### 1.2 `simctl status_bar` — the exact surface `ios-status-bar.tsx` draws

| # | state / transition | command | evaluates | status |
|---|---|---|---|---|
| 10 | cellular 4 → 1 bar | `xcrun simctl status_bar $U override --cellularBars 1` | our signal glyph's bar heights and gaps | queued |
| 11 | Wi-Fi active → searching | `… override --wifiMode searching` | the searching/failed Wi-Fi glyph, which we do not draw at all | queued |
| 12 | battery discharging 100 → charging 42 | `… override --batteryState charging --batteryLevel 42` | the battery fill, the bolt, and the level→width mapping | queued |
| 13 | operator name | `… override --operatorName 'Freestyle'` | whether a carrier name displaces the time (it does not on this device) | open |
| 14 | data network type | `… override --dataNetwork {hide,wifi,3g,4g,lte,lte-a,lte+,5g,5g+,5g-uwb,5g-uc}` | the `5G`/`LTE` label next to the bars — 11 distinct renders | open |
| 15 | cellular mode | `… override --cellularMode {notSupported,searching,failed,active}` | "No Service" / searching states | open |
| 16 | wifi bars 0–3, cell bars 0–4 | `… override --wifiBars N --cellularBars N` | 4 × 5 = 20 discrete glyph renders | open |
| 17 | a different time | `… override --time "23:41"` | our clock's width at a 2-digit hour | open |
| 18 | overrides cleared | `xcrun simctl status_bar $U clear` | the un-pinned status bar (do not leave it here) | open |

### 1.3 `simctl openurl` — app-to-app, and our own app on the device

Verified on this device: `https:` → Safari, `messages:` → Messages, `sms:` → Messages,
`photos-redirect:` → Photos all open. `prefs:root=…` and `facetime:` fail with
`NSOSStatusErrorDomain -10814` (not installed on this runtime).

| # | state / transition | command | evaluates | status |
|---|---|---|---|---|
| 19 | Photos → Messages | `xcrun simctl openurl $U messages://` | iOS's own app-open curve, and the `‹ Photos` breadcrumb our nav bar copies | queued |
| 20 | Messages → Photos | `xcrun simctl openurl $U photos-redirect://` | same curve, and the breadcrumb pointing the other way | queued |
| 21 | Messages → Safari | `xcrun simctl openurl $U https://example.com` | the same, plus a way onto the web | queued |
| 22 | our own kit on the device | `xcrun simctl openurl $U 'https://imessage.swerdlow.dev/harness?platform=ios&scene=outgoing&t=417&embed=1'` | **our components in real iOS WebKit at 3x**, not Playwright's WebKit on a Mac — the one case that measures our output rather than Apple's | open |
| 23 | compose with a body | `xcrun simctl openurl $U 'sms:+18885551212&body=Ok%20sounds%20good'` | our new-message sheet, its prefilled composer, the live send button, and the sheet's dismissal curve | **recorded** |

### 1.4 `simctl push` — a real Messages banner, drawn by iOS, over another app

This is the only Messages-styled surface reachable without touch on this device, because it is drawn
by SpringBoard rather than by Messages.

| # | state | payload | evaluates | status |
|---|---|---|---|---|
| 24 | one-line banner | `{"aps":{"alert":{"title":…,"body":"Ok"}}}` | banner geometry, corner radius, material, the in/out curve | **recorded** |
| 25 | wrapping banner | a body long enough for 3+ lines | where iOS clamps, and how the banner grows | **recorded** |
| 26 | group banner | `alert.subtitle` + `thread-id` | title/subtitle stacking, which is our group row's shape | **recorded** |
| 27 | badge only | `{"aps":{"badge":7}}` with no `alert` | the app-icon badge, no banner | open |
| 28 | two pushes in a row | two `simctl push` calls ~1 s apart | banner stacking / replacement | open |
| 29 | silent | `{"aps":{"content-available":1}}` | nothing on screen; useful as a negative control | open |

### 1.5 `simctl spawn … defaults write` — the largest unexplored lever

Every one of these is a system-wide setting that our CSS is supposed to answer, and none of them
needs a tap. All require a SpringBoard cycle to take effect
(`xcrun simctl spawn $U launchctl stop com.apple.SpringBoard`, or `shutdown`+`boot`).

| # | state | command | evaluates | status |
|---|---|---|---|---|
| 30 | Reduce Motion | `xcrun simctl spawn $U defaults write com.apple.Accessibility ReduceMotionEnabled -bool YES` | `prefers-reduced-motion` — what iOS actually substitutes for each of our animations (it cross-fades instead of sliding) | open |
| 31 | Bold Text | `… defaults write com.apple.Accessibility BoldTextEnabled -bool YES` | our font-weight ladder under the system bold setting | open |
| 32 | Darken System Colors | `… defaults write com.apple.Accessibility DarkenSystemColors -bool YES` | the same axis as 1.3 but on the colour side | open |
| 33 | RTL | `… defaults write -g AppleLanguages -array ar he` | **bubble tail mirroring, nav bar chevron, composer send button side** — the single highest-value untouched case | open |
| 34 | 24-hour time | `… defaults write -g AppleICUForce24HourTime -bool YES` | our conversation-list and swipe-reveal timestamps | open |
| 35 | locale | `… defaults write -g AppleLocale -string de_DE` | date separators, "Yesterday", relative times | open |

### 1.6 `simctl privacy`, `addmedia`, `pbcopy`, `keyboard`, `location`

| # | state | command | evaluates | status |
|---|---|---|---|---|
| 36 | photo permission granted / revoked / reset | `xcrun simctl privacy $U {grant,revoke,reset} photos com.apple.MobileSMS` | the photo picker's limited/denied states | open (picker itself blocked) |
| 37 | microphone | `… privacy $U revoke microphone com.apple.MobileSMS` | audio recorder's denied state | open (recorder blocked) |
| 38 | a photo in the library | `xcrun simctl addmedia $U shot.png` | the picker's first cell and the recents strip | open (picker blocked) |
| 39 | a contact | `xcrun simctl addmedia $U person.vcf` | how a handle resolves to a name in the list and nav bar | open |
| 40 | device pasteboard | `printf 'text' \| xcrun simctl pbcopy $U` | the composer's paste target (`pbpaste` verifies the set; using it needs a tap) | open |
| 41 | keyboard language | `xcrun simctl keyboard $U de-DE` | the keyboard — invisible without a focused field | blocked |
| 42 | simulated location | `xcrun simctl location $U set 37.33,-122.03` | nothing of ours | n/a |

### 1.7 The Messages first-launch sheet, and what is still behind a tap

**Half of this study ran with Messages stuck behind its first-launch "Shared with You" sheet, and no
preference dismisses it.** Recorded here because the next person will try the same thing. Each of the
following was written, verified with `defaults read com.apple.MobileSMS`, and followed by
`terminate` + `launch`; the last round was followed by a full `shutdown`/`boot`:

    SyndicationOnboardingVersion = 3      (the value an already-onboarded sim carries)
    SyndicationOnboardingVersion = 99
    NicknameOnboardingVersion = 99
    CollaborationOnboardingVersion = 99
    LastShownAppleIntelligenceOnboardingVersion = 99
    CKRecentlyDeletedOnboardingVersion = 99
    DeleteVerificationCodesOnboardingVersion = 99
    FunCameraUserConsentAlertControllerOnboardingVersion = 99
    OnboardingFinishTime = "2026-09-08 08:22:26 +0000"
    AlwaysShowSyndicationOnboarding = NO

All of them landed and the sheet still came up on the next launch. The literal
`SyndicationOnboardingVersion` does not appear in ChatKit's binary or anywhere under the runtime's
`PrivateFrameworks`, so the gate is not the version being set. `strings ChatKit | grep -i syndicat`
names two escape hatches — *"Don't show the syndication onboarding flow as this device does not
support it"* and *"Not showing syndication onboarding because device is in landscape orientation"* —
and neither is reachable through `simctl`, which has no rotate subcommand.

**It was dismissed by a tap from another agent partway through**, which is how `appearance-dark-to-light`
and everything after it are recorded over the real conversation list. So: one tap, once, per device;
after that `openurl` reaches the list, the New Message sheet and the composer with no further input.
If the device is erased this comes back, and the cheapest fix is a single tap, not a preference.

Still blocked without an input path, because no URL reaches them: opening an existing conversation's
transcript, scrolling, swipe-to-reveal-times, sending, the long-press menu, the tapback bar, the
effects picker and every bubble/screen effect, the photo picker, the sticker picker, search, select
mode, the details pane, group details, the audio recorder, and the image viewer.

Two ways forward, in order of cost: (a) a HID / `SimDeviceLegacyHIDClient` tap — there are half-built
probes for it in `scratchpad/hid/`; (b) case 22 — `openurl https://imessage.swerdlow.dev/harness?…`,
which evaluates our own kit in real iOS WebKit at 3x and needs no tap at all.

---

## 2. The recordings

Eleven cases, all on `imessage-eval`, all reproduced with

    cd /Users/ben/Documents/GitHub/freestyle-vms-new/iMessageUI
    bun scripts/reference/record.ts --udid 525CB796-F5C9-41C3-92FC-D760CA5CE9DC \
      --case <name> --out <scratchpad>/recordings/<name> --seconds N --settle 1500 --drive '<command>'

or in one go with `rec/batch.sh`. Frames and manifests are in `recordings/<name>/`
(`frames.json`, `frames/f*.png`, `capture.mp4`, and a `contact.png` strip built by `rec/sheet.py`).

| case | frames | container | recorder t=0 | real t=0 | motion |
|---|---|---|---|---|---|
| `appearance-light-to-dark` | 65 | 2.60 s | frame 1 | frame 1 | 0 → 440 ms |
| `appearance-dark-to-light` | 74 | 3.25 s | frame 1 | frame 1 | 0 → 450 ms |
| `content-size-l-to-xxxl` | 7 | 5.04 s | frame 1 | frame 1 | 0 → 233 ms |
| `newmsg-sheet-open` | 240 | 7.46 s | frame 1 | **frame 18 (+1522 ms)** | 0 → 198 ms (dismiss), then instant re-present |
| `newmsg-sheet-body` | 266 | 7.38 s | frame 1 | **frame 15 (+1500 ms)** | 25 → 210 ms |
| `push-banner-short` | 191 | 10.15 s | frame 1 | **frame 29 (+1790 ms)** | 0 → 200 ms in, holds to 7132 ms |
| `push-banner-long` | 202 | 10.38 s | frame 1 | **frame 32 (+1652 ms)** | 0 → 200 ms in |
| `push-banner-group` | 209 | 10.34 s | frame 1 | **frame 34 (+1837 ms)** | 0 → 215 ms in |
| `list-light-to-dark` | 129 | 5.12 s | frame 1 | **frame 17 (+1198 ms)** | 0 → 492 ms |
| `list-dark-to-light` | 162 | 5.38 s | frame 1 | **frame 22 (+1189 ms)** | 0 → 495 ms |
| `list-content-size-ax5` | 182 | 5.79 s | frame 1 | **frame 7 (+827 ms)** | 0 → 28 ms |

### The t = 0 correction, and why it matters

`effects.md` fixes t = 0 as *the first frame that differs from the resting one*, and `record.ts`
implements that at a 0.2 % threshold. That is right for a driver that acts instantly — an
`ui appearance` flip moves the screen in the same frame — and **wrong for `openurl` and `push`, which
take about 1.5 s to reach the device**. In that gap a caret blink or a status-bar tick clears 0.2 %,
and the manifest anchors t = 0 a second and a half early: `newmsg-sheet-open` reports
`zeroIndex: 1` when the sheet does not move until frame 18.

Every time in this file for those five cases is re-anchored at the first frame past **5 %** of
pixels, with `rec/analyze.py --zero 0.05`, and the offset is stated above so the raw manifest can be
checked against it. Falsifier: at the recorder's own t = 0 for `newmsg-sheet-open`, `changedFromRest`
is 0.0022 and the screen is visibly still; at frame 18 it is 0.169 and the sheet has started to move.

---

### 2.1 `appearance-light-to-dark` — 65 frames, motion 0 → 440 ms

Drive: `xcrun simctl ui $U appearance dark`. Backdrop: a full-screen Messages sheet.

Frame by frame it is a **cross-dissolve, not a swap**: the whole screen holds both palettes at once
for a quarter of a second, and the text passes through a low-contrast trough on the way. Mean RGB
over a 900x300 px empty region at (150, 1450):

| t (ms) | background | progress toward dark |
|---|---|---|
| 0 | 239,239,239 | 0.06 |
| 47 | 208,208,208 | 0.20 |
| 105 | 168,168,168 | 0.37 |
| 157 | 138,138,140 | 0.51 |
| 192 | 119,119,122 | 0.59 |
| 257 | 88,88,90 | 0.73 |
| 307 | 66,66,68 | 0.82 |
| 342 | 53,53,55 | 0.88 |
| 393 | 38,38,40 | 0.95 |
| 423 | 31,31,33 | 0.98 |
| 440 | 30,30,32 | 0.99 |
| 473 … 953 | 26,26,28 | 1.00, flat |

Whole-frame difference from the settled frame holds above 0.89 until **423 ms** and collapses to
0.021 at **440 ms** — the last 10 % of the dissolve happens in one frame.

**systemBlue barely moves.** The OK pill (400,2220,400x60) reads `rgb(11.6, 139.4, 251.4)` in light
and `rgb(11.6, 146.1, 253.4)` in dark: red identical, green +6.7, blue +2. Whatever our two themes do
to the accent, they may not do more than that.

### 2.2 `appearance-dark-to-light` — 74 frames, motion 0 → 450 ms

Drive: `xcrun simctl ui $U appearance light`. Backdrop: **the Messages conversation list** — the
surface `ios-conversation-list.tsx` draws (large "Messages" title, two rows with initial avatars,
trailing timestamps and chevrons, the pill search field with mic and compose).

| t (ms) | background |
|---|---|
| 0 | 9,9,9 |
| 55 | 26,26,26 |
| 98 | 44,44,44 |
| 148 | 67,67,67 |
| 198 | 95,95,95 |
| 248 | 126,126,126 |
| 298 | 159,159,159 |
| 350 | 196,196,196 |
| 400 | 236,236,236 |
| 450 … 1098 | 253,253,253, flat |

**The two directions are not the same curve.** Going dark the luminance decelerates (0.20 of the
distance covered in the first 47 ms, 0.06 in the last 80); coming back to light it *accelerates*
(0.07 in the first 55 ms, 0.24 in the last 50). Both land at ~445 ms. A single symmetric CSS
transition on `background-color` reproduces neither.

### 2.3 `content-size-l-to-xxxl` — 7 frames, motion 0 → 233 ms

Drive: `xcrun simctl ui $U content_size extra-extra-extra-large`, over the conversation list.

**Dynamic Type is not animated.** Seven frames in five seconds of recording: the new metrics are
already on screen in the first frame after the change (t = 0, 4.36 % of pixels different from rest),
there is nothing between it and t = 8 ms, and the only later frame is a settle at 233 ms where the
list finishes reloading its rows. Anything in our kit that *transitions* on a Dynamic Type change is
wrong by construction.

What changed, from the contact strip: row text grows, and the second row's number truncates to
`+1 (555) 564-85…`. Row order flickers (KB above JA at 0 ms, back to JA above KB by 233 ms) — that is
the table reloading, not a sort.

### 2.4 `newmsg-sheet-open` / `newmsg-sheet-body` — the modal sheet, measured twice

Drive: `xcrun simctl openurl $U 'sms:+18885551212'` and `…&body=Ok%20sounds%20good'`.
Both start with a New Message sheet already up, so what they capture is the **dismissal** — and they
capture it independently, which is what makes the numbers trustworthy.

Top edge of the sheet, tracked down the centre column (`rec/edge.py --col 603`), in device px on a
2622 px screen:

| t (ms) | `newmsg-sheet-open` | t (ms) | `newmsg-sheet-body` |
|---|---|---|---|
| 0 | 186 | 0–25 | 186 (25 ms of latency first) |
| 15 | 241 | 33 | 229 |
| 31 | 430 | 47 | 378 |
| 46 | 683 | 62 | 622 |
| 63 | 965 | 73 | 834 |
| 80 | 1216 | 93 | 1095 |
| 98 | 1454 | 108 | 1345 |
| — | — | 125 | 1569 |
| — | — | 142 | 1896 |
| — | — | 158 | 2061 |
| — | — | 175 | 2199 |
| 183 | 2363 | 192 | 2312 |
| 198 | gone (list top, 153) | 210 | gone (153) |

So: **the sheet leaves y = 186 px (62 pt), is past mid-screen by ~100 ms, and is off the bottom by
190–210 ms.** Peak velocity is ~17 px/ms around 45–65 ms, with a slower start and a slower finish —
an ease-in-out, not a linear slide. The two recordings agree within 8 % at every sampled time.

**The re-presentation is not animated.** In `newmsg-sheet-open` the list is bare from 216 to 613 ms,
and the next sheet is fully in place at 643 ms with *no intermediate frames at all* — and this
recorder emits a frame whenever the screen changes, so a 300 ms slide would have left ~18 of them.
A deep link that re-opens a sheet the app has already built snaps it into place.

`newmsg-sheet-body` additionally shows, once settled: the composer prefilled with `Ok sounds good`
and its send button live, the keyboard's predictive row (`"good"` / goodness / goodbye), and — behind
the sheet at 192–507 ms — a conversation-list row in its **swipe-revealed** state with the blue and
red action pills.

### 2.5 `push-banner-{short,long,group}` — a real Messages banner, three shapes

Drive: `xcrun simctl push $U com.apple.MobileSMS <payload>` with Photos/the sheet in front.
Payloads in `rec/push-*.json`; all fixture text, no real contacts.

The banner does not slide down — **it expands out of the Dynamic Island**. Bounding box of everything
that differs from the frame before the change (`rec/bbox.py --window 0,0,1206,900`):

`push-banner-short` (`title: "Harness Fixture", body: "Ok"`):

| t (ms) | x | width | height |
|---|---|---|---|
| 0 | 300 | 622 | 204 |
| 17 | 258 | 710 | 320 |
| 33 | 221 | 767 | 327 |
| 55 | 180 | 904 | 330 |
| 68 | 154 | 933 | 371 |
| 85 | 59 | 1133 | 525 |
| 102 | 32 | 1160 | 525 |
| 133 | 23 | 1167 | 521 |
| 150 | 0 | 1199 | 521 |
| 183 | 0 | 1206 | 521 |
| 200+ | 0 | 1206 | **528, settled** |

It starts **622 px (207 pt) wide** — the Dynamic Island's own width — and reaches full width at
183 ms; height is 80 % of final by 85 ms. Total entrance ~200 ms. It then **holds for 7.1 s**
(first retraction frame at 7132 ms) rather than the 5 s that gets quoted.

Settled height by payload, same method:

| payload | settled h (px) | (pt) |
|---|---|---|
| short (`title` + 2-char body) | 528 | 176 |
| long (body wrapping to 3+ lines) | 569 | 190 |
| group (`title` + `subtitle` + body + `thread-id`) | 543 | 181 |

A three-line body buys **14 pt**, not three lines' worth: the banner clamps. A subtitle buys 5 pt.
`push-banner-group` also runs 15 ms longer to full width (215 ms vs 200 ms).

### 2.6 `list-light-to-dark` / `list-dark-to-light` — the same crossfade, over the real list

129 and 162 frames. Drive as 2.1 / 2.2, but with the Messages conversation list in front and t = 0
re-anchored at 5 % (`openurl messages://` runs in the pre-step, so the recorder's 0.2 % anchor lands
on the list still settling). These are the cleanest of the four appearance captures — t = 0 is the
frame the dissolve starts, not one already 6 % into it — and they are the pair to trust.

Mean RGB over an empty 800x400 px region at (200, 1300), and the search pill at (200, 2420, 600x80):

| t (ms) | list bg, → dark | progress | search pill, → dark | list bg, → light | progress |
|---|---|---|---|---|---|
| 0 | 229.6 | 0.00 | 217,219,223 | 32.0 | 0.00 |
| 47 / 55 | 206.6 | 0.115 | 208,210,214 | 40.6 | 0.040 |
| 104 / 105 | 175.1 | 0.272 | 144,144,147 | 54.8 | 0.107 |
| 152 / 155 | 145.9 | 0.418 | 118,118,122 | 72.7 | 0.191 |
| 199 / 193 | 120.6 | 0.544 | 97,97,100 | 89.4 | 0.269 |
| 242 / 247 | 98.4 | 0.655 | 79,79,81 | 113.8 | 0.383 |
| 292 / 292 | 74.1 | 0.777 | 60,60,62 | 141.0 | 0.510 |
| 359 / 343 | 49.5 | 0.900 | 39,39,41 | 170.0 | 0.646 |
| 409 / 393 | 36.8 | 0.963 | 31,31,33 | 203.0 | 0.801 |
| 442 / 445 | 32.0 | 0.987 | 26,26,28 | 238.6 | 0.968 |
| 492 / 495 | 30.4 | 0.998 | 25,25,27 | 244.8 | 0.997 |
| settled | 29.2 | 1.00 | 25,25,27 | 245.6 | 1.00 |

**Same screen, same ~490 ms, two different curves.** Going dark is half done by ~180 ms; coming back
to light is not half done until ~290 ms. This is not the reverse of one animation, and it is not a
colour-space artifact — converting both to linear light leaves the asymmetry intact (0.646 of the way
at 152 ms one way, 0.279 at 292 ms the other). One CSS `transition: background-color 490ms ease` will
match one direction and miss the other; the two directions need separate easings.

The search pill lags the ground it sits on: at 47 ms the background has moved 11.5 % and the pill has
barely moved at all, then it overshoots past it (144 at 104 ms against the background's 175). A
material, not a colour.


### 2.7 `list-content-size-ax5` — 182 frames, motion 0 → 28 ms

Drive: `xcrun simctl ui $U content_size accessibility-extra-extra-extra-large`, over the list.
The far end of the Dynamic Type ladder behaves like the near end: **it snaps.** 0.117 of the frame
differs from rest at t = 0, 0.100 from t = 28 ms, and flat for the remaining 5.8 seconds. The 182
frames are a blinking caret, not motion. `content-size-l-to-xxxl` (2.3) and this agree, at opposite
ends of the range, that a Dynamic Type change has no timeline at all.


---

## 3. Checkpoints

### 3.1 The convention this follows

`references/ios/motion/effects.md` fixes **t = 0 as the first frame that differs from the resting
one**, and states every measurement as a value at a time from that anchor. Everything below keeps
that, with one addition the effects tables did not need: for a driver that does not act instantly
(`openurl`, `push`), t = 0 is the first frame past **5 %** of pixels changed, not 0.2 %, and the
offset from the recorder's own anchor is stated per case in section 2 so the correction can be
checked. A checkpoint here is therefore always the triple

    (case, t in ms from that anchor, a measurable claim about the frame)

and the claim is one of three kinds, in descending order of how much it pins down:

| kind | claim | how the harness checks it |
|---|---|---|
| `edge` | a named edge is at y = N device px (±tol) | measure the slot's `getBoundingClientRect()` at the seeked time |
| `box` | a named element's box is x,y,w,h (±tol) | same |
| `region` | the mean RGB of a rectangle is r,g,b (±tol) | sample the screenshot, or read the computed colour |
| `progress` | the frame differs from the settled frame in F of its pixels (±tol) | `toHaveScreenshot` against the settled baseline with `maxDiffPixelRatio` |

Device px throughout; the harness's iOS frame is 402x874 pt, so divide by 3.

### 3.2 The checkpoints, as data

**`rec/checkpoints.json` is the file to consume** — 11 cases, 95 assertions, and it is the copy that
carries `list-light-to-dark`, `list-dark-to-light` and `list-content-size-ax5` from 2.6 and 2.7. The block below is the same data for
the first eight cases, inline for reading. Times are the ones that were actually sampled — no
interpolation, because an interpolated checkpoint is a guess wearing a measurement's clothes.

```json
{
  "device": { "udid": "525CB796-F5C9-41C3-92FC-D760CA5CE9DC", "px": [1206, 2622], "pt": [402, 874], "scale": 3 },
  "zeroRule": "first frame whose changedFromRest exceeds `zeroThreshold`",
  "cases": [
    {
      "case": "appearance-light-to-dark",
      "drive": "xcrun simctl ui $UDID appearance dark",
      "zeroThreshold": 0.002,
      "duration": 440,
      "checkpoints": [0, 47, 105, 157, 192, 257, 307, 342, 393, 423, 440],
      "assertions": [
        { "at": 0,   "kind": "region", "region": [150,1450,900,300], "rgb": [239,239,239], "tol": 4 },
        { "at": 47,  "kind": "region", "region": [150,1450,900,300], "rgb": [208,208,208], "tol": 4 },
        { "at": 105, "kind": "region", "region": [150,1450,900,300], "rgb": [168,168,168], "tol": 4 },
        { "at": 157, "kind": "region", "region": [150,1450,900,300], "rgb": [138,138,140], "tol": 4 },
        { "at": 192, "kind": "region", "region": [150,1450,900,300], "rgb": [119,119,122], "tol": 4 },
        { "at": 257, "kind": "region", "region": [150,1450,900,300], "rgb": [88,88,90],    "tol": 4 },
        { "at": 307, "kind": "region", "region": [150,1450,900,300], "rgb": [66,66,68],    "tol": 4 },
        { "at": 342, "kind": "region", "region": [150,1450,900,300], "rgb": [53,53,55],    "tol": 4 },
        { "at": 393, "kind": "region", "region": [150,1450,900,300], "rgb": [38,38,40],    "tol": 4 },
        { "at": 423, "kind": "region", "region": [150,1450,900,300], "rgb": [31,31,33],    "tol": 4 },
        { "at": 440, "kind": "region", "region": [150,1450,900,300], "rgb": [30,30,32],    "tol": 4 },
        { "at": 473, "kind": "region", "region": [150,1450,900,300], "rgb": [26,26,28],    "tol": 2, "note": "settled; flat to 953 ms" },
        { "at": 0,   "kind": "region", "region": [400,2220,400,60], "rgb": [12,141,252], "tol": 3, "note": "systemBlue, light" },
        { "at": 473, "kind": "region", "region": [400,2220,400,60], "rgb": [12,146,253], "tol": 3, "note": "systemBlue, dark: only G moves, by 7" },
        { "at": 423, "kind": "progress", "differsFromSettled": 0.820, "tol": 0.06 },
        { "at": 440, "kind": "progress", "differsFromSettled": 0.021, "tol": 0.02, "note": "the last 10% of the dissolve is one frame" }
      ]
    },
    {
      "case": "appearance-dark-to-light",
      "drive": "xcrun simctl ui $UDID appearance light",
      "zeroThreshold": 0.002,
      "duration": 450,
      "checkpoints": [0, 55, 98, 148, 198, 248, 298, 350, 400, 450],
      "assertions": [
        { "at": 0,   "kind": "region", "region": [150,1450,900,300], "rgb": [9,9,9],       "tol": 3 },
        { "at": 55,  "kind": "region", "region": [150,1450,900,300], "rgb": [26,26,26],    "tol": 4 },
        { "at": 98,  "kind": "region", "region": [150,1450,900,300], "rgb": [44,44,44],    "tol": 4 },
        { "at": 148, "kind": "region", "region": [150,1450,900,300], "rgb": [67,67,67],    "tol": 4 },
        { "at": 198, "kind": "region", "region": [150,1450,900,300], "rgb": [95,95,95],    "tol": 4 },
        { "at": 248, "kind": "region", "region": [150,1450,900,300], "rgb": [126,126,126], "tol": 4 },
        { "at": 298, "kind": "region", "region": [150,1450,900,300], "rgb": [159,159,159], "tol": 4 },
        { "at": 350, "kind": "region", "region": [150,1450,900,300], "rgb": [196,196,196], "tol": 4 },
        { "at": 400, "kind": "region", "region": [150,1450,900,300], "rgb": [236,236,236], "tol": 4 },
        { "at": 450, "kind": "region", "region": [150,1450,900,300], "rgb": [253,253,253], "tol": 2, "note": "settled; flat to 1098 ms" }
      ],
      "note": "NOT the reverse of light-to-dark: this one accelerates (0.07 of the distance in the first 55 ms, 0.24 in the last 50), the other decelerates. Two curves, not one."
    },
    {
      "case": "content-size-l-to-xxxl",
      "drive": "xcrun simctl ui $UDID content_size extra-extra-extra-large",
      "zeroThreshold": 0.002,
      "duration": 0,
      "checkpoints": [0, 233],
      "assertions": [
        { "at": 0,   "kind": "progress", "differsFromSettled": 0.002, "tol": 0.004, "note": "the new metrics are already drawn in the first frame" },
        { "at": 233, "kind": "progress", "differsFromSettled": 0.000, "tol": 0.001, "note": "table reload settles" }
      ],
      "note": "duration is 0 on purpose. Seven frames in five seconds of recording; there is nothing between t=0 and t=8 ms. Any transition on a Dynamic Type change is wrong."
    },
    {
      "case": "sheet-dismiss",
      "from": ["newmsg-sheet-open", "newmsg-sheet-body"],
      "drive": "xcrun simctl openurl $UDID 'sms:+18885551212'",
      "zeroThreshold": 0.05,
      "duration": 200,
      "checkpoints": [0, 15, 31, 46, 63, 80, 98, 140, 183, 200],
      "assertions": [
        { "at": 0,   "kind": "edge", "edge": "sheet.top", "y": 186,  "tol": 8,   "note": "at rest, 62 pt" },
        { "at": 15,  "kind": "edge", "edge": "sheet.top", "y": 241,  "tol": 30 },
        { "at": 31,  "kind": "edge", "edge": "sheet.top", "y": 430,  "tol": 60 },
        { "at": 46,  "kind": "edge", "edge": "sheet.top", "y": 683,  "tol": 80 },
        { "at": 63,  "kind": "edge", "edge": "sheet.top", "y": 965,  "tol": 100 },
        { "at": 80,  "kind": "edge", "edge": "sheet.top", "y": 1216, "tol": 110 },
        { "at": 98,  "kind": "edge", "edge": "sheet.top", "y": 1454, "tol": 120, "note": "past mid-screen" },
        { "at": 183, "kind": "edge", "edge": "sheet.top", "y": 2363, "tol": 80 },
        { "at": 200, "kind": "edge", "edge": "sheet.top", "y": 2622, "tol": 0,   "note": "off the bottom; list top edge at 153 is what remains" }
      ],
      "note": "Two independent recordings, agreeing within 8% at every sampled time; tolerances are that spread. Peak velocity ~17 px/ms at 45-65 ms — ease-in-out, not linear. `newmsg-sheet-body` shows 25 ms of latency before the first movement."
    },
    {
      "case": "sheet-represent",
      "from": "newmsg-sheet-open",
      "duration": 0,
      "checkpoints": [0],
      "assertions": [
        { "at": 0, "kind": "edge", "edge": "sheet.top", "y": 186, "tol": 8 }
      ],
      "note": "Not animated. The list is bare from 216 to 613 ms and the sheet is fully in place at 643 ms with no intermediate frames at all — and this recorder emits a frame on every screen change, so a 300 ms slide would have left ~18."
    },
    {
      "case": "push-banner-short",
      "drive": "xcrun simctl push $UDID com.apple.MobileSMS rec/push-short.json",
      "zeroThreshold": 0.02,
      "duration": 200,
      "checkpoints": [0, 17, 33, 55, 68, 85, 102, 133, 150, 183, 200],
      "assertions": [
        { "at": 0,   "kind": "box", "box": [300,0,622,204],  "tol": 24, "note": "starts at the Dynamic Island's width, 207 pt" },
        { "at": 17,  "kind": "box", "box": [258,0,710,320],  "tol": 24 },
        { "at": 33,  "kind": "box", "box": [221,0,767,327],  "tol": 24 },
        { "at": 55,  "kind": "box", "box": [180,0,904,330],  "tol": 24 },
        { "at": 68,  "kind": "box", "box": [154,0,933,371],  "tol": 24 },
        { "at": 85,  "kind": "box", "box": [59,0,1133,525],  "tol": 24, "note": "80% of final height by here" },
        { "at": 102, "kind": "box", "box": [32,0,1160,525],  "tol": 24 },
        { "at": 133, "kind": "box", "box": [23,0,1167,521],  "tol": 24 },
        { "at": 150, "kind": "box", "box": [0,0,1199,521],   "tol": 24 },
        { "at": 183, "kind": "box", "box": [0,0,1206,521],   "tol": 12, "note": "full width" },
        { "at": 200, "kind": "box", "box": [0,0,1206,528],   "tol": 12, "note": "settled, 176 pt tall" },
        { "at": 7132, "kind": "box", "box": [12,0,1117,521], "tol": 40, "note": "first retraction frame — it holds for 7.1 s, not 5" }
      ]
    },
    {
      "case": "push-banner-long",
      "drive": "xcrun simctl push $UDID com.apple.MobileSMS rec/push-long.json",
      "zeroThreshold": 0.02,
      "duration": 200,
      "checkpoints": [0, 18, 50, 83, 116, 150, 183, 200],
      "assertions": [
        { "at": 0,   "kind": "box", "box": [59,0,1125,525], "tol": 30 },
        { "at": 50,  "kind": "box", "box": [100,0,1084,521],"tol": 30 },
        { "at": 116, "kind": "box", "box": [59,0,1076,521], "tol": 30 },
        { "at": 150, "kind": "box", "box": [10,0,1189,528], "tol": 24 },
        { "at": 183, "kind": "box", "box": [0,0,1205,568],  "tol": 16 },
        { "at": 200, "kind": "box", "box": [0,0,1206,569],  "tol": 12, "note": "settled, 190 pt" }
      ],
      "note": "A 3+ line body buys 14 pt over the short banner's 176, not three lines. The banner clamps."
    },
    {
      "case": "push-banner-group",
      "drive": "xcrun simctl push $UDID com.apple.MobileSMS rec/push-group.json",
      "zeroThreshold": 0.02,
      "duration": 215,
      "checkpoints": [0, 15, 31, 66, 100, 133, 165, 198, 215],
      "assertions": [
        { "at": 0,   "kind": "box", "box": [356,0,599,316],  "tol": 24 },
        { "at": 15,  "kind": "box", "box": [323,0,632,319],  "tol": 24 },
        { "at": 31,  "kind": "box", "box": [228,0,744,320],  "tol": 24 },
        { "at": 66,  "kind": "box", "box": [201,0,798,328],  "tol": 24 },
        { "at": 100, "kind": "box", "box": [146,0,942,414],  "tol": 24 },
        { "at": 133, "kind": "box", "box": [96,0,1046,452],  "tol": 24 },
        { "at": 165, "kind": "box", "box": [56,0,1128,506],  "tol": 24 },
        { "at": 198, "kind": "box", "box": [6,0,1199,543],   "tol": 16 },
        { "at": 215, "kind": "box", "box": [0,0,1206,543],   "tol": 12, "note": "settled, 181 pt — a subtitle buys 5 pt" }
      ],
      "note": "15 ms slower to full width than the one-line banner."
    }
  ]
}
```

### 3.3 The `scenarios.ts` entries these imply

Same shape as the existing rows (`{ id, title, group, duration, checkpoints }`), so they can be
dropped in next to `outgoing` and `photo-viewer`:

```ts
// Durations from 2.6, the pair with a correct t = 0, not from 2.1/2.2.
{ id: "theme-to-dark",   title: "Switch to dark",     group: "Screens", duration: 492, checkpoints: [0, 47, 104, 152, 199, 242, 292, 359, 409, 442, 492] },
{ id: "theme-to-light",  title: "Switch to light",    group: "Screens", duration: 495, checkpoints: [0, 55, 105, 155, 193, 247, 292, 343, 393, 445, 495] },
{ id: "dynamic-type",    title: "Dynamic Type",       group: "Screens", duration: 0,   checkpoints: [0, 233] },
{ id: "sheet-dismiss",   title: "Dismiss a sheet",    group: "Screens", duration: 200, checkpoints: [0, 15, 31, 46, 63, 80, 98, 183, 200], only: "ios" },
{ id: "banner",          title: "Notification",       group: "Screens", duration: 200, checkpoints: [0, 17, 33, 55, 68, 85, 102, 133, 150, 183, 200], only: "ios" },
{ id: "banner-long",     title: "Notification, wrapped", group: "Screens", duration: 200, checkpoints: [0, 18, 50, 83, 116, 150, 183, 200], only: "ios" },
{ id: "banner-group",    title: "Notification, group",   group: "Screens", duration: 215, checkpoints: [0, 15, 31, 66, 100, 133, 165, 198, 215], only: "ios" },
```

`nativeMotion` gains, all measured here rather than assumed:

```ts
themeToDark: 492,      // 2.6 — decelerating dissolve, half done by ~180 ms
themeToLight: 495,     // 2.6 — accelerating dissolve, half done by ~290 ms; NOT themeToDark reversed
dynamicType: 0,        // 2.3 — snaps; 233 ms later the table has reloaded
sheetDismiss: 200,     // 2.4 — cross-checked on two recordings
bannerIn: 200,         // 2.5 — expands out of the Dynamic Island, 622 px wide at t=0
bannerHold: 7132,      // 2.5 — not 5000
```

---

## 3.4 Photos, driven through the app rather than reached with a `simctl` flag

Added after XCUITest input started working, so these are the first cases that needed a *tap*. Driven
with `scratchpad/uitest/drive.sh` against `com.apple.MobileSMS`, photos put in the library with
`simctl addmedia`, every capture at 1206x2622.

**Sending N photos makes N messages.** Attach N in the picker and tap Send **once**: the transcript
gets N cells, each a single-photo balloon with its own "Your iMessage, Includes picture" label.
Verified at N = 1, 3 and 10; the ten-photo send produced exactly ten cells in the picked order. There
is no fan, nothing behind the front card, and no "+N Items" pill in the pixels or in any accessibility
dump. `CKGenericPhotoStackBalloonView` is real and fully built — `registry/imessage/message-image.tsx`
reproduces its frames to three decimals — but **nothing observed on the device produces one**, and the
obvious candidate (a *received* message with several attachments) is unreachable here: the simulator
has no iMessage service and no `sms.db` to inject into.

**A photo balloon is narrower than a text bubble, and its width does not follow the photo.**

| | measured on device | `thumbnailFillSizeForWidth:252.667` | with the text bubble's 280.5 |
| --- | --- | --- | --- |
| 4:3 landscape | 252.667 x 189.667 | 253.0 x 189.5 | 280.5 x 210.5 |
| 1:1 square | 252.667 x 252.667 | 253.0 x 253.0 | 280.5 x 280.5 |
| 3:4 portrait | 252.667 x **337.0** | 253.0 x **337.0** | 280.5 x 374.0 |

The portrait row settles it: 337.0 exactly, and 280.5 cannot produce it. The right edge sits on
386.000 — the same trailing margin every text bubble uses — so only the width differs, not the
alignment. Where 252.667 comes from is **not** established: it is not
`balloonMaxWidthForTranscriptWidth:` at any sensible inset (swept at transcript 402 over insets 0…90
in eighths and every flag combination, the only inset that lands on it is 52.375, which nothing else
in ChatKit uses).

Also measured: the tail is on the **last** balloon of a run of consecutive outgoing messages only —
the middle balloons of a 3-run and a 10-run have none — and consecutive photo balloons sit ~4 pt
apart. Corner radius reads ~19 pt, against the 20.0107 already in `bubbleMetrics`, which is inside
the precision of that reading.

The scene that matches all of this is `photo-run` in `harness/scenarios.ts`.

One number this section did not pin down: consecutive photo balloons sit **4.000 pt** apart, not "~4".
Three balloons sent in one go land at y −17.7, 176.0 and 432.7 with heights 189.7, 252.7 and 337.0, so
both gaps are 172.0 → 176.0 and 428.7 → 432.7. `bubbleMetrics.ios.gapInGroup` is 4.3333, measured on
text bubbles; a photo run is 0.333 tighter per gap and this kit still draws it at the text value.

## 3.5 Long-pressing a photo

Same rig, same conversation (three photos into `+1 (555) 564-8583`), then a 1.0 s press on the last
balloon (3:4, tailed) and on the middle one (1:1, no tail). The first is in the repo as
`references/ios/light/photo-long-press-0.png` and the resting frame under it as
`references/ios/light/photo-run-0.png`; the middle-balloon capture is not imported (one capture per
scene) and only its numbers below survive. Both 1206x2622 with the status bar pinned.

**A photo's menu is not a text bubble's menu.** It reads **Save / Copy / More…** — three rows, no
separator, and no Reply, Translate or Select. The panel is the same 250 pt AppKit-style sheet the text
menu uses and every number of `contextMenuMetrics.ios` survives: **250.000 x 146.000**, right edge on
the balloon's own 386.000, ink rows centred 31.5 / 73.5 / 115.5 inside it (padding 10 + row 42), icon
ink centred 36.167 from the leading edge, label ink starting 61.0 in. On the last balloon the menu's
bottom lands on **832.000** = 874 − 42, which is `messageActionsMetrics.bottomInset` exactly; on the
middle balloon it is not clamped and sits at 481.0 … 627.0.

**The preview lifts to a fixed width and loses its tail.** It spans x **60.000 ... 386.000** - 326.000 -
on *both* the 1:1 and the 3:4 balloon, i.e. x1.2902 on the 252.667 every photo balloon is wide, against
the 1.1032 `liftScale` gives it and the 1.15 it caps at. The 3:4 one goes 337.000 → 434.000 tall. The
tail the resting balloon carries is simply gone: the bottom-right corner of the preview is a plain
rounded corner, and the menu's 16.0 pt gap is taken from that corner, with no 6.8 pt hang under it.

**The bar is the bar, one number aside.** Height **64.333** (`tapbackBarMetrics.ios.height` to the
digit), right edge on the balloon's 386.000, first glyph centred **32.5** from the pill's own left end
and the rest on a **49** pt pitch (38.500, 87.167, ~137.8, 185.333, ~234.2, 283.667, then the recents
at 332.167 and one clipped by the pill's right edge). The emoji-picker thought bubble is Ø44.0 centred
(32.167, 244.667), which `pickerBeside` 28 and `pickerDrop` 14.67 predict as (32.0, 245.33). The pill's
**leading inset is 6.000, not 10.83** — the same measurement on `longpress-ok-light.png` still returns
10.83, so this is photo-specific or otherwise unexplained, and it is recorded rather than derived.

The dim is unchanged: solving `t0.png` against `lp-02.png` per channel returns 0.2103–0.2158 over
(22, 21, 42) on white, on a dimmed magenta photo and on the nav bar alike, which is
`messageActionsDim`. The menu's glass takes a clear violet tint from the blue photo above it and the
bar's takes the magenta from the photo behind it, so `wash={null}` for a photo understates what native
carries through the glass — that part is observed, not measured.

**NOT MEASURED: a tapback applied to a photo.** Where the balloon sits on a photo balloon's corner is
still the text bubble's slot carried over (`reactionOffsets` in `message-bubble.tsx`), because no
gesture that opens the Tapback bar survives on this rig. Measured, 3 attempts each and always on the
action that opens the bar, never before it: `press x y 1.0`, `double-tap x y`, `swipe x y x y 1.0` and
a four-part `press → drag → hold → lift` all kill the XCUITest runner. It is not the duration —
`press 200 620 1.00` on an empty conversation list runs fine, as do 0.40 … 1.00 s holds in a ladder —
and it is not the app under test, because attaching the driver to `com.apple.springboard` and driving
Messages by screen coordinates dies in the same place. Running the gesture off the test thread is not
open either: `-[XCUIApplication _dispatchEvent:eventBuilder:]` asserts on the main thread.

The touch *is* synthesized before the runner dies, so the menu does open and stays on the glass for
minutes — `scratchpad/tbp/burst.sh` is the workaround, and every capture above came out of it: watch
the live xcodebuild log for the action, then screenshot from the host. What it cannot do is *tap* the
glyph afterwards, and the state cannot be carried into a second run: the simulator has no `sms.db`, so
sent messages live only in the running Messages process, and xcodebuild shuts the device down at the
end of every run, crashed or clean (verified both ways — a conversation with three photos in it comes
back empty on the next run). Anything that needs a tap *after* the bar is open needs a rig that can
open it without XCUITest.

`photo-long-press` in `harness/scenarios.ts` is the scene that matches all of this.

## 4. What to run next, in priority order

1. **Case 33, RTL.** `defaults write -g AppleLanguages -array ar he` + a SpringBoard cycle. It is one
   command, it needs no tap, and it exercises bubble-tail mirroring, the nav-bar chevron and the
   composer's send-button side — none of which anything in the suite touches today.
2. **Case 22, our own kit on the device.** `openurl https://imessage.swerdlow.dev/harness?…` renders
   our components in real iOS WebKit at 3x and can be recorded with the same rig. It is the only case
   in this file that measures *our* output rather than Apple's.
3. **Case 30, Reduce Motion.** What iOS substitutes for each of these animations is itself a
   measurement, and `prefers-reduced-motion` in our kit is currently unverified against anything.
4. **The 20 discrete status-bar glyph renders** (cases 14–16). Cheap, static, and `ios-status-bar.tsx`
   has no reference for most of them.
5. **A tap.** Everything listed at the end of 1.7 needs one, and it is one tap per device, not one per
   case — after the first-launch sheet is gone, `openurl` reaches the rest.

---

## 5. The files

    SIMULATOR-CASES.md         this
    rec/checkpoints.json       11 cases, 95 assertions, machine-readable
    rec/sim.sh                 boot / wait-for-ready / re-pin the status bar
    rec/reap.sh                kill the recorders record.ts leaks
    rec/batch.sh               the whole case list, serial, with retry and lock recovery
    rec/analyze.py             frames.json -> motion window, per-frame diff, region means; --zero re-anchors t=0
    rec/edge.py                track one horizontal edge down a column (the sheet slide)
    rec/bbox.py                bounding box of what changed inside a window (the banner growth)
    rec/sheet.py               contact strip of chosen times
    rec/push-{short,long,group}.json   the push payloads
    recordings/<case>/         frames.json, frames/f*.png, capture.mp4, contact.png

To reproduce any single case:

    /private/.../scratchpad/rec/sim.sh ready
    cd /Users/ben/Documents/GitHub/freestyle-vms-new/iMessageUI
    bun scripts/reference/record.ts --udid 525CB796-F5C9-41C3-92FC-D760CA5CE9DC \
      --case list-light-to-dark --out <scratchpad>/recordings/list-light-to-dark \
      --seconds 4 --settle 1500 --drive 'xcrun simctl ui 525CB796-F5C9-41C3-92FC-D760CA5CE9DC appearance dark'
    python3 <scratchpad>/rec/analyze.py <scratchpad>/recordings/list-light-to-dark \
      --zero 0.05 --regions listbg:200,1300,800,400

and reap afterwards, or the next recording is truncated:

    <scratchpad>/rec/reap.sh 5

The simulator was left as it was found: appearance `light`, content size `large`, Increase Contrast
`disabled`, status bar pinned to 9:41 / 100 % discharging / 4 cellular bars / 3 Wi-Fi bars, no
Simulator.app running, and the device's recording lock verified clear by taking a fresh 2.99 s
capture after the last reap.
