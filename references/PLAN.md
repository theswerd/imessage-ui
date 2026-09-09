# Replica plan

Goal: a pixel- and motion-faithful web replica of Messages on iOS 26 and macOS 26, measured from the
native apps, shipped as installable registry components plus two full app shells.

## Reference material

- `references/SPEC.md` is the source of truth for every measured number. If a capture and the spec
  disagree, measure the capture (tools in `scripts/measure/`) and fix the spec.
- `references/ios/captures/*.png` — iOS 26 simulator frames at 3x (402×874 pt).
- `references/ios/motion/` — 60 fps recordings and contact sheets: send, long press, and the search
  screen opening and closing.
- `references/macos/captures/*.png` — macOS 26 window crops at 2x.
- `references/group-avatar/*.png` — the only committed frames that show a group avatar.
- `references/ios/bubble-tail-beziers.json` — the traced tail, encoded in `bubble-shape.ts`.
- `references/<surface>.md` — one working note per surface that needed more than a capture
  (`audio-recorder`, `group-avatar`, `group-details`, `image-viewer`, `ios-search`, `photo-picker`,
  `sticker-picker`, `system-message`, `tapback-details`). Each records the *method*: the probe, the
  command, the sample. SPEC.md carries the results.

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
| `message-image.tsx` | photo tiles in the bubble outline, and the grid for two to four or more |
| `message-audio.tsx` | a received voice message: waveform, playhead, duration |
| `message-edit.tsx` | edit in place and undo send |
| `system-message.tsx` | the centred grey transcript lines: renames, joins, leaves, the group photo |
| `message-motion.tsx` | the measured send and receive animations, seekable |
| `tapback.tsx` | the reaction balloon |
| `tapback-bar.tsx` | the iOS picker pill and the macOS two-row picker |
| `tapback-details.tsx` | the "who reacted" platter, its tallies and its Remove Tapback cell |
| `context-menu.tsx` | the iOS tinted menu and the macOS menu |
| `message-actions.tsx` | the iOS long-press overlay |
| `use-long-press.ts` | the 500 ms hold with keyboard and pointer alternatives |
| `message-effects.tsx` | slam, loud, gentle, and the Invisible Ink reveal |
| `ios-effects-picker.tsx` | the measured iOS "Send with effect" screen |
| `screen-effects.tsx` | the full-screen send effects |
| `message-reply.tsx` | the quoted stub, reply count, and thread view |
| `facetime-card.tsx` | the FaceTime link card and call states |
| `avatar.tsx` | initials gradient, photo, silhouette |
| `group-avatar.tsx` | the Snowglobe stack, and the sender gutter's avatar hand-off |
| `image-viewer.tsx` | the full-screen photo viewer: open zoom, paging, drag to dismiss, chrome |
| `photo-picker.tsx` | the Photos picker under the composer, and its popover form on the Mac |
| `sticker-picker.tsx` | the sticker sheet, its categories, and the drag onto a bubble |
| `audio-recorder.tsx` | recording a voice message: live waveform, timer, stop, play, send |
| `ios-status-bar.tsx` `ios-nav-bar.tsx` `ios-composer.tsx` `ios-conversation-list.tsx` `ios-new-message-sheet.tsx` | iOS chrome |
| `ios-details.tsx` `ios-plus-menu.tsx` `ios-select-mode.tsx` `ios-swipe-times.tsx` `ios-notices.tsx` | iOS secondary screens and states |
| `ios-search.tsx` | the iOS search screen over the list, and its two measured transitions |
| `group-details.tsx` | the iOS details screen for a group; imports `ios-details.tsx`'s motion rather than restating it |
| `macos-window.tsx` `macos-sidebar.tsx` `macos-header.tsx` `macos-composer.tsx` `macos-plus-menu.tsx` | macOS chrome |
| `macos-details.tsx` | the macOS details inspector beside the transcript |
| `conversation.tsx` | one pane, either platform |
| `ios-messages-app.tsx` `macos-messages-app.tsx` | the whole apps |

Both shells present their surfaces on one contract: leave a surface's prop out and the shell owns it
(the native gesture opens it with nothing wired); pass it, and the caller owns it, with `progress`
(0..1) seeking the entrance instead of playing it. A scrubbed checkpoint is then a pure function of
its props, which is what lets one component be both an application and a harness fixture.

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

Four of the newest surfaces have **no capture at all** and are built from ChatKit readings instead.
They are wired into both shells and into the harness, which is not the same as being measured, and
they must not be described as measured:

| Surface | Why there is no capture | Route to one |
|---|---|---|
| `audio-recorder.tsx` | reaching the mic button needs a pointer event, which this project forbids | none from the committed material; the probe in `references/audio-recorder.md` is the substitute |
| `tapback-details.tsx` | the platter needs a tap on a balloon | same |
| `macos-details.tsx` | no macOS capture in the repo shows the inspector | ⌥⌘I in Messages at 960×640, then `screencapture -o -l<windowid>` at 2x; `/lab/macos-details` has the full recipe |
| `group-details.tsx` | not one of the committed iOS frames shows a group | seed a booted simulator's `Library/SMS/sms.db` with a group thread, then `xcrun simctl io booted screenshot`; the sandbox declined that write once already |

Partly measured, and worth naming so nobody rounds it up: `system-message.tsx` has a capture only for
the unknown-sender notice (the group lines' `gapAbove` is unverified on both platforms);
`photo-picker.tsx` and `sticker-picker.tsx` each have one capture and borrow their sheet motion from
the long-press menu's measured pair; `image-viewer.tsx` has two captures, both dark.

`SPEC.md` § "Still unverified" ends with "Edit-in-place, and the sticker and Genmoji pickers, are not
built." That line predates `message-edit.tsx` and `sticker-picker.tsx` and is stale; Genmoji is still
correct.
