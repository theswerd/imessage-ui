# Development and native measurements

The public site focuses on iOS-style components. This guide covers the underlying registry,
the deterministic harness, and the native reference work, including older macOS experiments.
Source comments and `references/SPEC.md` distinguish measured behavior from approximations.

## Run it

```sh
bun install --frozen-lockfile
bunx playwright install chromium webkit
bun run dev
```

- [localhost:3100](http://localhost:3100) is the homepage, with an interactive conversation and a Copy prompt for your agent action.
- [localhost:3100/components](http://localhost:3100/components) opens the component workbench with a searchable sidebar, previews, and color controls. Each item has installation, source, and available previews at `/components/{name}`.
- [localhost:3100/harness](http://localhost:3100/harness) is the scenario lab: pick iOS or macOS, a
  scenario, a theme, and a checkpoint on the timeline, then keep interacting with the result. Deep
  links are reproducible, for example
  `/harness?platform=ios&scene=long-press&t=880&theme=light`, and `&embed=1` drops the site chrome.
  Scenarios are organized in six groups (Messages, Previews, Interactions, Screens, Effects,
  FaceTime); some are one platform only, and the picker says so. Every timed one is *scrubbed*, not
  played: `/harness?platform=ios&scene=search-open&t=130` renders the same frame every time.
- `/lab/...` holds the pixel labs, listed below.
- [localhost:3100/onboard.md](http://localhost:3100/onboard.md) installs the agent skill and covers palette setup, themes, media, and connecting your own data. Generated from `content/onboard.md`; set `REGISTRY_URL` before a public build.

### The pixel labs

Each lab renders one surface at native geometry (402 × 874 pt for iOS, 960 × 640 for the macOS
window) so `scripts/measure/compare.ts` can diff it against a capture. Most reconstruct a specific
frame in `references/`; the ones marked below have no capture to diff against and exist so that one
can be taken, and so the framework-derived geometry has somewhere to be looked at. Each lab's own
docblock lists its scenes, its query parameters and the regions worth diffing.

| Route | Reconstructs |
|---|---|
| `/lab` | bubbles and the conversation scenes (`?scene=ios-conv3&theme=light`) |
| `/lab/list` | the message area alone, iOS and macOS (`?platform=macos&theme=dark`) |
| `/lab/ios-chrome` | status bar, nav bar, composer, list, the long-press dim |
| `/lab/ios-screens` | details, plus menu, select mode, swipe-for-times, notices, attachments |
| `/lab/macos-chrome` | the window, the conversation pane, the `+` popover |
| `/lab/macos-pane` | the four `conversation-pane-*.png` crops, header and composer included |
| `/lab/tapback` | the balloon and the long-press menu, whole-frame |
| `/lab/effects` | bubble and screen effects, and the measured "Send with effect" screen (`?picker=1&choose=slam`, `&tab=screen`) |
| `/lab/reply` | the quoted stub and the thread view — no capture backs these |
| `/lab/search` | `search-active-light.png`, `search-noresults-dark.png`, and the two transitions |
| `/lab/photoviewer` | `image-viewer-chrome-dark.png`, `image-viewer-fit-dark.png`, plus states no capture reaches |
| `/lab/photo-picker` | `photo-picker-light.png`, the panel alone, and the selection badge |
| `/lab/ios-sticker-picker` | `sticker-picker-light.png`, plus the posed sticker drag |
| `/lab/groupavatar` | `references/group-avatar/snowglobe-{light,dark}.png`, and the sender gutter |
| `/lab/system-message` | the unknown-sender notice in `incoming-light.png`; the other status lines have no capture |
| `/lab/group-details` | the iOS group details screen — **no group capture exists**; it shares the measured one-to-one frame |
| `/lab/tapback-details` | the Tapback Details platter — **no capture**; ChatKit-derived |
| `/lab/audio-recorder` | the voice-recorder row — **no capture**; ChatKit-derived |
| `/lab/macos-details` | the macOS inspector — **no capture**; the lab's docblock has the recipe for taking one |
| `/lab/crop` | not a surface: a viewport that re-origins another lab so a standalone crop capture (`tapback-bar-crop.png`, `context-menu-crop.png`) can be diffed without redrawing the scene |

## How fidelity is checked

Two independent gates, and they answer different questions.

**Did we change our own rendering?** Playwright screenshots every scenario checkpoint on both
platforms, both themes, in Chromium and WebKit.

```sh
bun test                # deterministic scenario-timeline and geometry tests
bun run typecheck
bun run lint
bun run test:e2e        # real interactions
bun run test:visual     # checkpoint screenshots against tests/e2e/baselines
bun run test:report     # HTML results, traces, failure videos
```

The visual suite makes hundreds of navigations per project: 2 themes × 66 scenarios × 4
browser/platform projects = 528 tests, less the ones skipped because the surface is one-platform.
Against the dev server, on-demand route compilation becomes the bottleneck and navigations time out,
so run it against a production server. (The "under two minutes" figure this file used to quote was
measured when the suite was 336 tests; the current suite has not been timed.) For a full run:

```sh
bun run serve:test                                    # build, then serve on :3101
PLAYWRIGHT_BASE_URL=http://localhost:3101 bun run test:all
```

`PLAYWRIGHT_BASE_URL` also tells Playwright not to start its own server.

`bun run test:visual:update` accepts new baselines. Review the diffs first, and render baselines on
the same OS and font environment they were captured on. These are regression captures of *our*
implementation, not evidence of fidelity to Apple.

**Do we match Apple?** Diff a lab page against a native capture:

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers \
bun scripts/measure/compare.ts \
  "http://localhost:3100/lab?scene=ios-conv3&theme=light" \
  references/ios/captures/conv3-light.png \
  3 402 874 /tmp/cmp  100 200 302 460
```

The arguments are the lab URL, the reference PNG, the device pixel ratio (3 for iOS, 2 for macOS),
the viewport in points, an output directory, and an optional region in points. It writes
`ref.png`, `ours.png`, `diff.png` and a `side.png` that puts all three next to each other, and prints
the mismatched-pixel ratio. Anti-aliased text edges differ between the simulator and a browser;
geometry and colour must not.

Measuring helpers live in `scripts/measure/`:

```sh
python3 scripts/measure/px.py bbox references/ios/captures/conv3-light.png 700 700   # flood-fill a shape
python3 scripts/measure/px.py row  references/ios/captures/conv3-light.png 700 300 1206  # colour runs
python3 scripts/measure/outline.py references/ios/captures/grouped-light.png 1060 1153 3  # trace an outline, fit corner radii
python3 scripts/measure/frames.py sheet <dir> <prefix> <start> <count> <step> <out.png>    # animation contact sheet
```

## References

`references/SPEC.md` is the source of truth. If a capture and the spec disagree, measure the capture
and fix the spec.

```text
references/SPEC.md          Every measured number, and how it was measured
references/PLAN.md          Component map and working rules
references/ios/captures/    iOS 26 simulator frames, 402x874 pt at 3x
references/ios/motion/      60 fps recordings and contact sheets: send, long press, search open/close
references/macos/captures/  macOS 26 window crops at 2x
references/group-avatar/    The only committed frames that show a group avatar
references/group-details/   The ChatKit cell renders behind the group details screen
references/*.md             One working note per surface that needed more than a capture
references/ios/bubble-tail-beziers.json  The traced bubble tail, as fitted cubics
```

Captures use dedicated fixture conversations only. The bubble outline in
`registry/imessage/bubble-shape.ts` is a trace of the real thing: the body's corner radius, the point
where the tail leaves the edge, its neck, bulge and tip are all fitted to sub-pixel coverage from a
3x capture, and rendering it back over the original leaves 1.5% mismatched pixels, all of them text.

Four findings shape the whole implementation:

- **Bubble fill is a screen-space gradient.** A bubble's colour depends on where it sits on screen,
  not on the bubble. `use-screen-space.ts` keeps every bubble's `--bubble-bottom` in sync while the
  list scrolls, so the gradient stays fixed to the screen the way it does natively.
- **Bubbles hug their longest wrapped line**, and centre text narrower than the minimum width. CSS
  shrink-to-fit cannot express either, so `message-bubble.tsx` measures the laid-out line boxes.
- **Only the last bubble of a cluster gets a tail**, on both platforms. A self-chat is misleading
  here: it mirrors every message, so each single-line bubble looks tailed.
- **The effects preview bubble is a flat #0088ff**, not the screen-space gradient, and iOS 26 has
  eight screen effects rather than nine. Both come from the captures in
  `references/ios/captures/effects-*.png`; the bubble-effect timings in
  `references/ios/motion/effects.md` come from 60 fps recordings of each one being sent.

## Components

The registry items plus an `index` style that pulls in all of them. Every one installs to
`components/message-ui/<name>.tsx` and is addressable on its own as `@message-ui/<name>`.
[/components](http://localhost:3100/components) renders the catalog with featured live previews, and
`/llms/<name>.txt` is the per-component agent doc.

| Group | Items |
|---|---|
| Foundations | `platform` `tokens` `palette` `bubble-shape` `use-screen-space` `use-long-press` |
| Transcript | `message-bubble` `message-list` `date-separator` `typing-indicator` `system-message` `ios-notices` `link-preview` `message-attachment` `message-image` `message-audio` `facetime-card` `avatar` `group-avatar` |
| Reactions and menus | `tapback` `tapback-bar` `tapback-details` `context-menu` `message-actions` |
| Motion and effects | `message-motion` `message-effects` `screen-effects` `ios-effects-picker` |
| Replies and editing | `message-reply` `message-edit` |
| iOS chrome and screens | `ios-status-bar` `ios-nav-bar` `ios-composer` `ios-conversation-list` `ios-new-message-sheet` `ios-search` `ios-select-mode` `ios-swipe-times` `ios-details` `group-details` `ios-plus-menu` |
| macOS chrome and screens | `macos-window` `macos-sidebar` `macos-header` `macos-composer` `macos-plus-menu` `macos-details` |
| Pickers and capture | `photo-picker` `sticker-picker` `image-viewer` `audio-recorder` |
| Blocks | `conversation` `ios-messages-app` `macos-messages-app` |

### What backs the ten newest surfaces

These ten are wired into both shells and into the harness. That is not the same as being measured,
and the difference matters, so it is spelled out. "Capture" means a frame in `references/` that
`compare.ts` can diff a lab against; "ChatKit/PhotoKit" means a value read out of Apple's own
framework with a Catalyst probe, which is Apple's number but not a picture of the screen.

| Surface | Component | What backs it |
|---|---|---|
| Photo viewer | `image-viewer` | 2 captures (`image-viewer-{chrome,fit}-dark.png`, dark only), plus PhotoKit constants for the motion |
| iOS search | `ios-search` | 2 captures (`search-active-light.png`, `search-noresults-dark.png`) and two 60 fps recordings for the open and the close |
| Photos picker | `photo-picker` | 1 capture (`photo-picker-light.png`, light, collapsed, nothing selected); the sheet's motion is borrowed, not measured |
| Sticker picker | `sticker-picker` | 1 capture (`sticker-picker-light.png`); the drag timings are ChatKit, the sheet's entrance is borrowed |
| Group avatar | `group-avatar` | dedicated captures in `references/group-avatar/` |
| Status lines | `system-message` | one capture, and only for the unknown-sender notice; the group lines' spacing is ChatKit, and `gapAbove` is unverified on both platforms |
| iOS group details | `group-details` | **no group capture exists anywhere in `references/`.** It shares its frame, cell for cell, with the measured one-to-one `ios-details`, and imports that screen's motion rather than restating it; the group-only parts are ChatKit |
| Tapback Details | `tapback-details` | **no capture.** ChatKit; the platter's entrance is judgement borrowed from the measured long-press overlay |
| Audio recorder | `audio-recorder` | **no capture, and none can be made** without driving the mic button — every geometric number is ChatKit (`references/audio-recorder.md` has the probe) |
| macOS inspector | `macos-details` | **no capture.** ChatKit; `/lab/macos-details` carries the recipe for taking one |

`references/SPEC.md` § "Still unverified" is the full list for the whole kit, and each of these
surfaces has a working note beside it (`references/image-viewer.md`, `ios-search.md`,
`photo-picker.md`, `sticker-picker.md`, `group-avatar.md`, `group-details.md`, `system-message.md`,
`tapback-details.md`, `audio-recorder.md`) recording the method rather than the result.

## Registry

```sh
# from an initialized shadcn consumer, with the dev server running
bunx shadcn@latest add http://localhost:3100/r/index.json
bunx shadcn@latest add http://localhost:3100/r/ios-messages-app.json
```

Or register `@message-ui` in the consumer's `components.json`:

```json
{ "registries": { "@message-ui": "http://localhost:3100/r/{name}.json" } }
```

Then `bunx shadcn@latest add @message-ui/conversation`. Components install under `components/message-ui/`
and use the project's own `cn` utility. React 19 and Tailwind CSS 4 are the targets. Apply `.dark` for
dark styles. Set `REGISTRY_URL=https://your-origin.example` when building for hosting;
`bun run registry:build` runs the official `shadcn build` and then rewrites dependency URLs and import
paths. `bun run test:registry` installs into clean root and `src/` consumers.

The two entry points are the whole apps. Left like this they own their own presented surfaces, so the
gesture that opens one natively opens it here with nothing wired: the composer's `+` opens the plus
menu, its mic opens the voice recorder, a photo in the transcript opens the full-screen viewer, the
nav bar's name pill opens details, the list's search field opens search, a tapback balloon opens the
Tapback Details platter.

```tsx
<IosMessagesApp contact={{ name: "Alex Morgan" }} messages={messages} composer={{ onSend }} />

<MacMessagesApp contact={{ name: "Alex Morgan" }} conversations={conversations} selectedId="alex"
  messages={messages} composer={{ onSend }} />
```

Pass a surface's prop instead and the caller owns it. Every one of them takes the same shape: a value
or `null` to state it, and an optional `progress` (0..1) that *seeks* its entrance rather than playing
it, which is what makes a harness checkpoint a pure function of its props. A group is `participants`
on either shell — two or more turns the avatar slot into the Snowglobe stack and the transcript into a
group one.

```tsx
<IosMessagesApp
  contact={{ name: "Alex Morgan" }}
  participants={[{ name: "Alex Morgan" }, { name: "Jamie Chen" }, { name: "Sam Rivera" }]}
  messages={messages}
  photos={library}                                   // what the Photos picker offers
  photoViewer={viewer}                               // { id, index, progress?, chrome?, dismiss? } | null
  onOpenPhoto={(id, index) => setViewer({ id, index })}
  onClosePhoto={() => setViewer(null)}
  search={search}                                    // { query?, sections?, progress?, closing? } | null
  onSearchQueryChange={setQuery}
  composer={{ onSend, onMic }}
/>

<MacMessagesApp
  contact={{ name: "Alex Morgan" }}
  conversations={conversations}
  selectedId="alex"
  messages={messages}
  details={{ open: true, tab: "photos" }}            // the inspector beside the transcript (⌥⌘I)
  detailsContent={{ photos: shared, links, attachments }}
  onQuickLook={(id, index) => showInQuickLook(id, index)}
  composer={{ onSend }}
/>
```

`onQuickLook` is not an oversight: macOS Messages has no in-window photo viewer, so this shell does
not draw one and hands the event out instead. `<Conversation platform="ios" | "macos">` is the single
pane without the app chrome, and every part is installable on its own. Applications own transport,
storage, uploads and real calls.


## Deploying

**https://imessage.swerdlow.dev** is live. Vercel builds it from this repo on every push to `main`
through its own GitHub integration, so there is no deploy step to run by hand and no token to keep.
`REGISTRY_URL` is set to the production origin in the project's environment, which is what makes the
installable JSON at `/r/*.json` point at real URLs rather than localhost.

The zone is the reason it is not on Cloudflare. A Workers custom domain needs the zone to live on
the same Cloudflare account, and `swerdlow.dev` is on Vercel DNS along with a dozen sibling
subdomains. Cloudflare Pages would have taken a plain CNAME, but the OpenNext adapter targets
Workers. So the hostname is an `A` record at Vercel's edge, like every other subdomain here.

The Cloudflare Worker is still a second target for the same commit, on its `workers.dev` hostname:

```sh
bun run preview   # build and run the Worker locally
bun run deploy    # build and deploy
```

`deploy.yml` does that in CI, gated on a repository variable so a missing token does not turn the
repo red. To turn it on, add the `CLOUDFLARE_API_TOKEN` secret (an "Edit Cloudflare Workers" token;
`CLOUDFLARE_ACCOUNT_ID` is already set) and set the repository variable `CLOUDFLARE_ENABLED` to
`true`.

`ci.yml` runs typecheck, lint and the unit tests on every push and pull request, plus the full
Playwright suite against a production build. That second job does not gate, because the visual
baselines are rendered on macOS and a Linux runner rasterises glyphs differently, so it reports the
diff rather than failing on it.

`registry:build` runs before every build and fails when a component's declared
`registryDependencies` do not match its real imports, or when a file under `registry/imessage` is
not shipped by any item. A drifted manifest breaks the build rather than shipping a registry that
cannot be installed.

## Layout

```text
registry/imessage/   Installable component source
registry.json        shadcn source manifest
public/r/            Generated registry items
public/llms/         Generated per-component agent docs
harness/             Scenario timeline, fixtures, and the workbench
app/lab/             Pixel labs, one per capture group
tests/e2e/           Interactions and visual checkpoints
scripts/measure/     Measuring and diffing tools
references/          Native captures and the measurement spec
```

Behaviour references:
[Tapbacks](https://support.apple.com/guide/iphone/react-with-tapbacks-iph018d3c336/ios),
[message effects](https://support.apple.com/en-ie/104970),
[FaceTime](https://support.apple.com/guide/iphone/make-facetime-calls-iph7801d5771/ios).


## Registry preview checks

Start a production server before running browser or simulator checks:

```sh
bun run build
bun run start
```

The public-preview matrix captures every listed component at 402px and 1440px, in light and dark,
with fixed clocks, decoded images and held animation frames. The viewer suite replays opening,
paging and dismissal after fresh navigations and compares decoded pixels exactly. It also covers
scaled gestures, cancelled pointers, Safari's coalesced double taps, modal focus and reaction layers.

```sh
PLAYWRIGHT_BASE_URL=http://localhost:3100 bunx playwright test tests/e2e/registry-previews.spec.ts tests/e2e/photo-viewer.spec.ts tests/e2e/registry-site.spec.ts tests/e2e/conversation-list.spec.ts --project=ios-chromium --project=ios-webkit
```

For the real simulator, use a dedicated iPhone 17 Pro running iOS 26.0. The native probe presents
ChatKit's `CKQLPreviewController` over fixture JPEGs. XCTest compares its fit, then drives Safari
through zoom, paging, dismissal, every public preview in both themes, and sending text and photos.
The runner saves screenshots, a screen recording, logs and an `.xcresult` bundle under `artifacts/`.
It boots Safari again after XCTest finishes.

```sh
bun run test:ios --udid YOUR_SIMULATOR_UDID
# If Xcode's newer SDK needs an explicit iOS 26.0 runtime mapping:
bun run test:ios --udid YOUR_SIMULATOR_UDID --runtime-build 23A343
# Run just the inbox journey: unread, search, opening threads, composing, dark mode and reset.
bun run test:ios --udid YOUR_SIMULATOR_UDID --initial-path /components/ios-conversation-list --only-testing SimulatorReview/SimulatorReview/testConversationList
```

The optional runtime mapping is reset to Xcode's default when the runner exits. These tests use
fixture conversations and do not send real messages. Browser regression screenshots stay under
`tests/e2e/baselines/`; only captures from Apple software belong in `references/`.
