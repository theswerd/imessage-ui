# iMessage UI

A shadcn registry of Messages components for the web, measured against the real apps: **iOS 26.0** in the
iPhone 17 Pro simulator and **macOS 26.5 Messages 26.0**. Every size, colour, radius and timing in
`registry/imessage/` comes from a native capture, and `references/SPEC.md` records where each number
came from. The registry layout follows [theswerd/brainless](https://github.com/theswerd/brainless):
owned source in `registry/`, a generated catalog at `/r/registry.json`, installable item JSON, and
per-component agent docs at `/llms.txt`.

## Run it

```sh
bun install --frozen-lockfile
bunx playwright install chromium webkit
bun run dev
```

- [localhost:3100/harness](http://localhost:3100/harness) is the scenario lab: pick iOS or macOS, a
  scenario, a theme, and a checkpoint on the timeline, then keep interacting with the result. Deep
  links are reproducible, for example
  `/harness?platform=ios&scene=long-press&t=880&theme=light`, and `&embed=1` drops the site chrome.
- `/lab/...` holds the pixel labs. Each one reconstructs a specific native capture at native geometry
  so it can be diffed against it: `/lab` (bubbles), `/lab/ios-chrome`, `/lab/ios-screens`,
  `/lab/macos-chrome`, `/lab/list`, `/lab/tapback`, `/lab/effects` and `/lab/reply`. The effects lab
  also reconstructs the iOS "Send with effect" screen, which is measured:
  `/lab/effects?picker=1&choose=slam`, and `&tab=screen` for the other tab.
- [localhost:3100/docs](http://localhost:3100/docs) lists the catalog.

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

The visual suite makes hundreds of navigations per project. Against the dev server, on-demand route
compilation becomes the bottleneck and navigations time out; against a production server the same 336
tests finish in under two minutes. So for a full run:

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
references/ios/motion/      60 fps recordings and contact sheets of send and long press
references/macos/captures/  macOS 26 window crops at 2x
references/ios/bubble-tail-beziers.json  The traced bubble tail, as fitted cubics
```

Captures use dedicated fixture conversations only. The bubble outline in
`registry/imessage/bubble-shape.ts` is a trace of the real thing: the body's corner radius, the point
where the tail leaves the edge, its neck, bulge and tip are all fitted to sub-pixel coverage from a
3x capture, and rendering it back over the original leaves 1.5% mismatched pixels, all of them text.

Three findings shape the whole implementation:

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

## Registry

```sh
# from an initialized shadcn consumer, with the dev server running
bunx shadcn@latest add http://localhost:3100/r/index.json
bunx shadcn@latest add http://localhost:3100/r/ios-messages-app.json
```

Or register `@imessage` in the consumer's `components.json`:

```json
{ "registries": { "@imessage": "http://localhost:3100/r/{name}.json" } }
```

Then `bunx shadcn@latest add @imessage/conversation`. Components install under `components/imessage/`
and use the project's own `cn` utility. React 19 and Tailwind CSS 4 are the targets. Apply `.dark` for
dark styles. Set `REGISTRY_URL=https://your-origin.example` when building for hosting;
`bun run registry:build` runs the official `shadcn build` and then rewrites dependency URLs and import
paths. `bun run test:registry` installs into clean root and `src/` consumers.

The two entry points are the whole apps:

```tsx
<IosMessagesApp contact={{ name: "Alex Morgan" }} messages={messages} composer={{ onSend }} />
<MacMessagesApp contact={{ name: "Alex Morgan" }} conversations={conversations} selectedId="alex"
  messages={messages} composer={{ onSend }} />
```

`<Conversation platform="ios" | "macos">` is the single pane without the app chrome, and every part
is installable on its own. Applications own transport, storage, uploads and real calls.

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

Independent project, not affiliated with Apple. Behaviour references:
[Tapbacks](https://support.apple.com/guide/iphone/react-with-tapbacks-iph018d3c336/ios),
[message effects](https://support.apple.com/en-ie/104970),
[FaceTime](https://support.apple.com/guide/iphone/make-facetime-calls-iph7801d5771/ios).
