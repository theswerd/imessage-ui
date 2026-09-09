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

/** Opens one scenario checkpoint in the embedded harness and returns the device frame. */
export async function openScene(page: Page, info: TestInfo, scene = "conversation", time = 0, theme = "light"): Promise<Locator> {
  await page.goto(`/harness?platform=${platformFor(info)}&scene=${scene}&t=${time}&theme=${theme}&embed=1`, { waitUntil: "load" });
  await expect(page.getByTestId("harness-ready")).toBeVisible();
  await evaluateSettled(page, () => page.evaluate(async () => { await document.fonts.ready; }));
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
