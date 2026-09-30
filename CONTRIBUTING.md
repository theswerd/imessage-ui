# Contributing to Message UI

Use issues for reproducible bugs and concrete feature ideas. For a UI bug, include the component
URL, browser or iOS version, preview size, theme, steps, and a screenshot or recording using sample data.

## Setup

```sh
bun install --frozen-lockfile
bunx playwright install chromium webkit
bun run dev
```

The site runs at `http://localhost:3100`. Components live in `registry/imessage/`; the public website
lives in `app/` and `components/`. The directory name is historical; installed source goes into
`components/message-ui/`.

Read [AGENTS.md](AGENTS.md), [references/PLAN.md](references/PLAN.md), and
[references/SPEC.md](references/SPEC.md) before changing component geometry or motion.
Preserve keyboard access, focus, IME composition, reduced motion, and both themes.
Keep fixtures fictional and keep credentials, personal conversations, and local build artifacts out of commits.

## Checks

```sh
bun run registry:build
bun run typecheck
bun run lint
bun test tests/unit
bun run build
```

Generated registry files in `public/r/` and agent guidance in `public/llms/` are committed. Regenerate
them from source instead of editing them directly. Leave `REGISTRY_URL` unset for the checked-in local build.
Run `bun run test:registry` when imports, dependencies, install targets, or the build process change;
it verifies installation into clean consumer projects.

Start a production server with `bun run start`, then run the suites relevant to the change:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:3100 bunx playwright test tests/e2e/homepage.spec.ts tests/e2e/registry-site.spec.ts --project ios-chromium --project ios-webkit
```

The full suite is `PLAYWRIGHT_BASE_URL=http://localhost:3100 bun run test:all`. Visual baselines depend
on the capture OS and fonts. Inspect every changed image before accepting a baseline; do not update
baselines just to hide a failing test. Browser images belong under `tests/e2e/baselines/`, never `references/`.

For native Safari checks, use Xcode and a dedicated iPhone 17 Pro simulator with iOS 26.0:

```sh
bun run test:ios --udid YOUR_SIMULATOR_UDID
```

The runner saves screenshots, a screen recording, and XCTest results under ignored `artifacts/`.
See the [development guide](docs/development.md) for runtime selection and individual journeys.

## Pull requests

Keep changes focused. Explain the visible behavior, include before/after captures for visual changes,
and report the checks you ran. Mark unmeasured behavior as such. Include attribution and license
information with any new third-party asset.

Contributions to project code are made under the repository's [MIT license](LICENSE).
