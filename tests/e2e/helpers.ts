import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

export type Platform = "ios" | "macos";

/** The Playwright projects are named `<platform>-<browser>`. */
export function platformFor(info: TestInfo): Platform {
  return info.project.name.startsWith("macos") ? "macos" : "ios";
}

/**
 * `page.evaluate` right after a navigation can lose its execution context: the dev server's client
 * router swaps the document out from under it, which WebKit hits on fast successive navigations.
 * Retry once rather than failing a screenshot test for a harness race.
 */
async function evaluateSettled(page: Page, run: () => Promise<unknown>): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await run(); return; }
    catch (error) {
      if (!/Execution context was destroyed|Target closed|context or browser has been closed/.test(String(error))) throw error;
      await page.waitForLoadState("load").catch(() => {});
      await page.waitForTimeout(120);
    }
  }
}

/**
 * Every `<img>` in the frame, decoded. Fonts were already waited on; photographs were not, and a
 * scene whose layout depends on one — the viewer sizing its page to the photo it is zooming into —
 * settles a frame later than the rest of the scene does. Under four workers that landed on the wrong
 * side of the screenshot often enough to fail a checkpoint that passes on its own, which is exactly
 * the shape of flake to remove rather than retry.
 */
async function imagesDecoded(page: Page) {
  await evaluateSettled(page, () => page.evaluate(async () => {
    const images = Array.from(document.images).filter(image => image.src && !image.src.startsWith("data:"));
    // Raced against a deadline, because `decode()` on an image the engine has parked never settles
    // at all — not rejected, just pending — and one of those in a scene full of effect artwork hangs
    // the whole checkpoint rather than failing it. A photograph that has not decoded in 400 ms was
    // never going to be the thing the frame is waiting on.
    const deadline = new Promise(resolve => setTimeout(resolve, 400));
    await Promise.all(images.map(image => Promise.race([image.decode().catch(() => undefined), deadline])));
  }));
}

/**
 * Waits until the device frame stops moving. Fonts and images are waited on above, but a scene can
 * still take one more frame to settle after them — the photo viewer sizes its page from the image it
 * is showing, so until that has been measured the photo is drawn at a size no checkpoint means. A
 * screenshot landing in that window produced a `photo-viewer` failure on a different checkpoint every
 * run, 0.42 of the frame different, with nothing wrong on screen a person would ever see.
 *
 * Two consecutive identical samples of every slot's box is the condition; `toHaveScreenshot` applies
 * the same idea to pixels, and this applies it to layout, which is what actually settles late.
 */
async function layoutSettled(page: Page) {
  await evaluateSettled(page, () => page.evaluate(async () => {
    const sample = () => Array.from(document.querySelectorAll("[data-slot]")).map(node => {
      const box = node.getBoundingClientRect();
      return `${box.x.toFixed(2)},${box.y.toFixed(2)},${box.width.toFixed(2)},${box.height.toFixed(2)}`;
    }).join("|");
    const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
    let previous = sample();
    let stable = 0;
    // Three consecutive identical frames, not two. One pair is not enough: a scene whose entrance
    // timeline is built in a `useLayoutEffect` commits a frame or two after the images decode, and a
    // single matching pair before that commit reads as settled. That is what made
    // `group-details-open at 0 ms` fail on WebKit in about half of runs — the group avatars sampled
    // mid-settle, 1637 or 2331 pixels off, with nothing wrong with the page itself. A checkpoint that
    // is right half the time cannot measure anything.
    //
    // The bound stays at 12 frames, and that number is load-bearing rather than arbitrary. A scene
    // with a looping animation on a positioned element — the audio recorder's waveform is the one
    // here — never settles at all, so it always runs the bound out, and the bound is therefore what
    // decides which frame of that loop gets photographed. Raising it to 30 re-phased the waveform and
    // moved 1,619 pixels in a scene nothing had touched. Wait for stability *within* the same window;
    // do not widen the window.
    for (let attempt = 0; attempt < 12; attempt++) {
      await frame();
      const next = sample();
      if (next === previous) { if (++stable >= 3) return; } else { stable = 0; previous = next; }
    }
  }));
}

/**
 * Waits for every animation that is going to end to have ended.
 *
 * `layoutSettled` samples boxes, so it is blind to an animation that only moves colour or opacity —
 * and the audio recorder's row plays a 260 ms entrance that no checkpoint seeks. The capture landed
 * somewhere inside it, differently each run: `audio-playback at 0 ms` failed about four runs in five,
 * always by exactly 1637 pixels, because there were two poses and no way to say which one a run got.
 *
 * Only *running*, *finite* animations are waited on. A scene that seeks its own motion leaves those
 * animations `paused`, which is the whole point of seeking them, and an infinite one never finishes
 * by definition; waiting on either would hang the checkpoint rather than settle it.
 */
async function animationsSettled(page: Page) {
  await evaluateSettled(page, () => page.evaluate(async () => {
    const pending = () => document.getAnimations().filter(animation => {
      if (animation.playState !== "running") return false;
      const duration = animation.effect?.getTiming().duration;
      return typeof duration === "number" && Number.isFinite(duration);
    });
    const deadline = performance.now() + 1500;
    while (pending().length && performance.now() < deadline) {
      // `finished` and not a poll: it resolves on the frame the animation ends, so nothing is waited
      // on for longer than it actually runs. The deadline is the backstop for one that never settles.
      await Promise.race([
        Promise.allSettled(pending().map(animation => animation.finished)),
        new Promise(resolve => setTimeout(resolve, 250)),
      ]);
    }
  }));
}

/** Opens one scenario checkpoint in the embedded harness and returns the device frame. */
export async function openScene(page: Page, info: TestInfo, scene = "conversation", time = 0, theme = "light"): Promise<Locator> {
  await page.goto(`/harness?platform=${platformFor(info)}&scene=${scene}&t=${time}&theme=${theme}&embed=1`, { waitUntil: "load" });
  await expect(page.getByTestId("harness-ready")).toBeVisible();
  await evaluateSettled(page, () => page.evaluate(async () => { await document.fonts.ready; }));
  await imagesDecoded(page);
  if (scene.startsWith("photo-viewer")) {
    // The dimmed transcript remains visible during dismissal. Load its lazy photos too, including
    // tiles below the fold, so a checkpoint cannot capture a partially decoded background image.
    await page.locator('[data-testid="device"] img').evaluateAll(async nodes => {
      await Promise.all(nodes.map(async node => {
        const image = node as HTMLImageElement;
        image.loading = "eager";
        await image.decode();
      }));
    });
    await expect(page.locator('[data-slot="photo-tile"][data-state="loading"]')).toHaveCount(0);
  }
  // Twice, with the layout pass between. An entrance built in a `useLayoutEffect` can register its
  // animation *after* the first sample — under a full-suite load on WebKit that race showed up as one
  // scene in ~880 failing per run, a different one each time, which is the worst kind of failure to
  // chase. The second pass costs nothing when there is nothing left to wait for.
  await animationsSettled(page);
  await layoutSettled(page);
  await animationsSettled(page);
  return page.getByTestId("device");
}

/** Opens the full workbench (controls, checkpoint buttons, interaction log) rather than the bare device. */
export async function openWorkbench(page: Page, info: TestInfo, scene = "conversation"): Promise<Locator> {
  await page.goto(`/harness?platform=${platformFor(info)}&scene=${scene}`, { waitUntil: "load" });
  await expect(page.getByTestId("harness-ready")).toBeVisible();
  await evaluateSettled(page, () => page.evaluate(async () => { await document.fonts.ready; }));
  return page.getByTestId("device");
}

/**
 * CSS animations use their own timeline; freeze them separately from JS timers. Anything the scene
 * already scrubbed (the send and receive motion, the long-press entrance, the bubble and screen
 * effects) is paused on the frame the scenario asked for, so leave those alone and pin only what is
 * still running on its own clock.
 */
export async function freezeAnimations(page: Page, milliseconds: number) {
  await evaluateSettled(page, () => page.evaluate(time => {
    for (const animation of document.getAnimations()) {
      if (animation.playState !== "running") continue;
      animation.pause();
      try { animation.currentTime = time; } catch { /* an animation whose timeline is not resolved yet */ }
    }
  }, milliseconds));
}

/**
 * Collects uncaught exceptions so a test can prove the journey raised none. The Next dev server's
 * hot-reload client rejects with a ChunkLoadError when a page is navigated away from mid-fetch
 * (WebKit hits it on every fast navigation); that is the harness's dev server, not a component.
 */
const IGNORED_PAGE_ERRORS = /ChunkLoadError|Failed to load chunk|hmr-client/;
export function watchPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", error => {
    const message = `${error.name}: ${error.message}`;
    if (!IGNORED_PAGE_ERRORS.test(message)) errors.push(message);
  });
  return errors;
}

export function messageLog(page: Page): Locator {
  return page.getByRole("log", { name: "Messages" });
}
export function messageRows(page: Page): Locator {
  return page.locator("[data-slot='message-row'][data-message-id]");
}
export function messageRow(page: Page, id: string): Locator {
  return page.locator(`[data-message-id="${id}"]`);
}
/**
 * The body a message actually draws, whichever kind it is: the target of a press, a right click or a
 * double click. Only text and audio draw a `bubble`, so a query for that alone cannot reach an
 * emoji-only message, a photo, a link card or a file card, and the suite could not express a test for
 * reacting to one. `:not([data-stub] *)` drops the quoted stub above a reply, which draws a scaled
 * copy of the message it quotes and would otherwise be the row's first bubble.
 */
export const messageBodySelector = '[data-slot="bubble"], [data-slot="emoji"], [data-slot="image-grid"], [data-slot="link-preview"], [data-slot="message-attachment"]';

export function messageBody(page: Page, id: string): Locator {
  return page.locator(`[data-message-id="${id}"] :is(${messageBodySelector}):not([data-stub] *)`);
}

/** @deprecated Use `messageBody`, which reaches every kind and not only a text bubble. */
export function bubbleBody(page: Page, id: string): Locator {
  return messageBody(page, id);
}

/**
 * One fixture per message kind the log can draw, with the scene that holds it and the slot it renders
 * in place of a bubble. Every one of these has to open the reaction menu: on 2026-09-08 only text and
 * audio did, because the iOS shell measured the pressed message with `[data-slot="bubble"]` alone and
 * never found a rect for the rest.
 */
export const messageKinds = [
  { kind: "text", scene: "conversation", id: "m6", slot: "bubble" },
  { kind: "emoji-only", scene: "emoji", id: "e1", slot: "emoji" },
  { kind: "photo", scene: "photos", id: "ph", slot: "image-grid" },
  { kind: "audio", scene: "audio", id: "au2", slot: "bubble" },
  { kind: "link card", scene: "link-preview", id: "link", slot: "link-preview" },
  { kind: "file card", scene: "attachment", id: "file", slot: "message-attachment" },
] as const;
export function composerForm(page: Page): Locator {
  return page.getByRole("form", { name: "Send a message" });
}
export function composerField(page: Page): Locator {
  return page.getByRole("textbox", { name: "Message", exact: true });
}
/**
 * The Tapback bar, whichever shell drew it. iOS floats it above the pressed message as a `menu` of
 * its own; the macOS bar is the header *of* the context menu, so it is a `group` inside that single
 * `menu` - a nested `menu` would be announced as a submenu with no parent item, and `menuitemradio`
 * still needs a menu ancestor (see registry/imessage/tapback-bar.tsx). Either way the options are
 * reached from here.
 */
export function tapbackMenu(page: Page): Locator {
  return page.getByRole("menu", { name: "Tapback" }).or(page.getByRole("group", { name: "Tapback" }));
}
export function actionsMenu(page: Page): Locator {
  return page.getByRole("menu", { name: "Message actions" });
}

export type TapbackGesture = "hold" | "right-click" | "double-click";

/**
 * Opens the reaction menu on a message. iOS listens for a 500 ms hold, a right click and a double
 * click; the macOS pane opens its menu on a right click.
 */
export async function openTapbackMenu(page: Page, id: string, gesture: TapbackGesture) {
  const body = messageBody(page, id).first();
  if (gesture === "right-click") {
    await body.click({ button: "right" });
  } else if (gesture === "double-click") {
    await body.dblclick();
  } else {
    const box = (await body.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // The hold is a real 500 ms timer in the page; poll for the menu instead of sleeping.
    await expect(tapbackMenu(page)).toBeVisible();
    await page.mouse.up();
  }
  await expect(tapbackMenu(page)).toBeVisible();
}

export function effectsScreen(page: Page): Locator {
  return page.getByRole("dialog", { name: "Send with effect" });
}

/**
 * Press and hold the composer's send button, which is how iOS opens "Send with effect". The hold is a
 * real 500 ms timer in the page, so poll for the screen instead of sleeping.
 */
export async function openEffectsScreen(page: Page) {
  const send = composerForm(page).getByRole("button", { name: "Send message" });
  await send.scrollIntoViewIfNeeded();
  const box = (await send.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(effectsScreen(page)).toBeVisible();
  await page.mouse.up();
  await expect(effectsScreen(page)).toBeVisible();
}

/** The gesture each platform's users actually have (iOS also accepts a right click and a double click). */
export function defaultGesture(platform: Platform): TapbackGesture {
  return platform === "ios" ? "hold" : "right-click";
}
