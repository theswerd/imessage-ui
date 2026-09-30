# Message UI

A standalone shadcn registry that replicates Messages on iOS 26 and macOS 26. Components are measured
against native captures; `references/SPEC.md` is the source of truth for every number.

- Read `references/SPEC.md` and `references/PLAN.md` before changing a component. If a capture and the
  spec disagree, measure the capture and fix the spec.
- Measure, do not eyeball. Use `scripts/measure/px.py`, `outline.py` and `frames.py` on the captures in
  `references/`, and verify with `scripts/measure/compare.ts`, which diffs a `/lab` page against a
  native capture and writes a side-by-side image. Text anti-aliasing may differ between the simulator
  and a browser; geometry and colour may not.
- Implement reusable UI in `registry/imessage/`. `harness/` holds platform framing, the scenario
  timeline and fixtures only, and must import the registry sources rather than reimplement them.
  `app/lab/` holds one pixel lab per capture group.
- Anything with no native capture is marked unverified, both in `SPEC.md` and in the file's own
  comment. Do not describe it as measured.
- Add deterministic checkpoints for new interactions in `harness/scenarios.ts`, covering iOS and macOS
  in light and dark.
- Run the interaction tests and visual comparisons for what you changed. Keep traces and failure
  screenshots until the cause is understood. Use `bun run test:visual:update` only to accept a
  reviewed change. Implementation baselines in `tests/e2e/baselines/` are regression captures, never
  evidence of fidelity to Apple, and must never be copied into `references/`.
- Native captures record their OS version and provenance, contain fixture conversations only, and are
  never silently replaced or mixed across OS versions.
- Preserve keyboard input, IME composition, focus behaviour, and reduced motion. Harness fixtures must
  not send real messages or touch the microphone, camera, or a real call.
- Fixture data only. No em-dashes in UI copy. No new dependencies.
- Run `bun run registry:build` after source changes so `public/r/` and `public/llms/` stay in sync, and
  `bun run test:registry` when imports, dependencies, targets or the build process change.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
