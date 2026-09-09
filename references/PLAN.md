# Replica plan

Goal: a pixel- and motion-faithful web replica of Messages on iOS 26 and macOS 26, measured from the
native apps, shipped as installable registry components plus two full app shells.

## Reference material

- `references/SPEC.md` is the source of truth for every measured number. If a capture and the spec
  disagree, measure the capture (tools in `scripts/measure/`) and fix the spec.
- `references/ios/captures/*.png` — iOS 26 simulator frames at 3x (402×874 pt).
- `references/ios/motion/` — 60 fps recordings and contact sheets of the send and long-press motion.
- `references/macos/captures/*.png` — macOS 26 window crops at 2x.
- `references/ios/bubble-tail-beziers.json` — the traced tail, encoded in `bubble-shape.ts`.

Captures use dedicated fixture conversations. Nothing from a real conversation goes in the repo.

## Component map (`registry/imessage/`)

| File | Owns |
|---|---|
| `platform.tsx` | `PlatformProvider` / `usePlatform()` |
| `tokens.ts` | colours, screen-space gradients, type scale, metrics per platform |
| `palette.tsx` | emits a platform's palette as CSS variables |
| `bubble-shape.ts` | the traced bubble outline and tail |
| `use-screen-space.ts` | keeps bubble fills aligned to the screen while scrolling |
| `message-bubble.tsx` | body, tail, gradient fill, native text fit, status, edited, reactions, emoji-only |
| `message-list.tsx` | clusters and tails, date headers, status placement, senders, links, typing |
| `date-separator.tsx` | iOS two-line and mid-list one-line, macOS one-line |
| `typing-indicator.tsx` | the shape and the dot animation |
| `link-preview.tsx` | compact and rich link cards |
| `message-attachment.tsx` | file cards and the failed-send state |
| `message-motion.tsx` | the measured send and receive animations, seekable |
| `tapback.tsx` | the reaction balloon |
| `tapback-bar.tsx` | the iOS picker pill and the macOS two-row picker |
| `context-menu.tsx` | the iOS tinted menu and the macOS menu |
| `message-actions.tsx` | the iOS long-press overlay |
| `use-long-press.ts` | the 500 ms hold with keyboard and pointer alternatives |
| `message-effects.tsx` | slam, loud, gentle, and the Invisible Ink reveal |
| `ios-effects-picker.tsx` | the measured iOS "Send with effect" screen |
| `screen-effects.tsx` | the full-screen send effects |
| `message-reply.tsx` | the quoted stub, reply count, and thread view |
| `facetime-card.tsx` | the FaceTime link card and call states |
| `avatar.tsx` | initials gradient, photo, silhouette |
| `ios-status-bar.tsx` `ios-nav-bar.tsx` `ios-composer.tsx` `ios-conversation-list.tsx` `ios-new-message-sheet.tsx` | iOS chrome |
| `ios-details.tsx` `ios-plus-menu.tsx` `ios-select-mode.tsx` `ios-swipe-times.tsx` `ios-notices.tsx` | iOS secondary screens and states |
| `macos-window.tsx` `macos-sidebar.tsx` `macos-header.tsx` `macos-composer.tsx` `macos-plus-menu.tsx` | macOS chrome |
| `conversation.tsx` | one pane, either platform |
| `ios-messages-app.tsx` `macos-messages-app.tsx` | the whole apps |

## Working rules

- Measure, do not eyeball. Every size in CSS px equals the native point value.
- Verify with a 3x (iOS) or 2x (macOS) screenshot diffed against the reference crop. Text
  anti-aliasing may differ; geometry and colour may not.
- Anything without a native capture is marked unverified in `SPEC.md` and in the file's own comment.
  Do not describe it as measured.
- Fixture data only. No em-dashes in UI copy. No new dependencies.
- Keep `use client` on interactive files and `data-slot` on component roots.

## Known gaps

Tracked in the "Still unverified" section of `SPEC.md`: the typing indicator's geometry, the iOS link
card, the receive animation, group-chat sender placement, date-header wording beyond "Today", and the
effect animations, replies and edit-in-place surfaces, which are built from documented behaviour
rather than a capture. The screen that chooses an effect is measured; the macOS equivalent is not.
The iOS iMessage blue gradient is still the macOS one, because no iOS capture holds a blue bubble.
