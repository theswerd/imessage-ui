import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { conversationList, unreadConversationList } from "../../harness/scenarios";
import {
  actionsMenu, bubbleBody, composerField, composerForm, defaultGesture, effectsScreen, messageLog, messageRow, messageRows,
  openEffectsScreen, openScene, openTapbackMenu, openWorkbench, platformFor, tapbackMenu, watchPageErrors,
} from "./helpers";

/**
 * User journeys through the two app shells, driven from the harness. Every assertion goes through an
 * accessible role, name or state; nothing here knows about class names or pixel geometry. No test
 * sleeps: waits are either expect polling or a real gesture the page itself times (the 500 ms hold).
 *
 * The one deliberate exception is the block at the bottom of this file. A press, a hover and a drag
 * have no accessible state to poll: the row a finger is on is a *paint*, so proving it exists means
 * reading the computed style before, during and after the gesture — and, crucially, driving a real
 * gesture rather than dispatching an event. On 2026-09-09 a measurement of this kit found a list row
 * held under a finger at `rgba(0, 0, 0, 0)` before and after, a sidebar row identical at rest, hover
 * and press, a Hide Alerts switch that answered `aria-checked="false"` to a click, no timestamps
 * under a leftward drag and not one unread dot in either list. Every one of those shipped because a
 * screenshot suite renders states and never drives them. These tests drive them.
 */

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { pageErrors.set(page, watchPageErrors(page)); });
test.afterEach(({ page }) => { expect(pageErrors.get(page) ?? [], "the journey raised an uncaught page error").toEqual([]); });

test("an empty composer offers audio, and text swaps in the send affordance", async ({ page }, info) => {
  const platform = platformFor(info);
  await openScene(page, info);
  const form = composerForm(page);
  const field = composerField(page);
  const audio = form.getByRole("button", { name: "Record audio message" });
  const send = form.getByRole("button", { name: "Send message" });

  await expect(field).toHaveValue("");
  await expect(audio).toBeVisible();
  await expect(send).toHaveCount(0);

  await field.fill("Blue for iMessage.");
  await expect(audio).toHaveCount(0);
  if (platform === "ios") {
    // iOS puts the send arrow inside the field once there is text.
    await expect(send).toBeVisible();
    await expect(send).toBeEnabled();
  } else {
    // macOS Messages has no send button at all: Return sends.
    await expect(send).toHaveCount(0);
  }

  await field.fill("");
  await expect(audio).toBeVisible();
  await expect(send).toHaveCount(0);
});

test("typing, Shift+Enter and Enter send one multiline message and clear the field", async ({ page }, info) => {
  await openScene(page, info);
  const field = composerField(page);
  const before = await messageRows(page).count();

  await field.click();
  await field.pressSequentially("First line");
  await field.press("Shift+Enter");
  await field.pressSequentially("Second line");
  await expect(field).toHaveValue("First line\nSecond line");

  await field.press("Enter");

  const sent = messageRow(page, "sent-1");
  await expect(sent).toBeVisible();
  await expect(messageRows(page)).toHaveCount(before + 1);
  await expect(messageLog(page)).toContainText("Second line");
  // The bubble keeps the line break exactly where the composer put it.
  await expect.poll(() => sent.locator("[data-slot='text']").textContent()).toBe("First line\nSecond line");
  // The delivery label moves to the newest outgoing message.
  await expect(sent).toContainText("Delivered");
  await expect(messageRow(page, "m6")).not.toContainText("Delivered");

  await expect(field).toHaveValue("");
  await expect(composerForm(page).getByRole("button", { name: "Send message" })).toHaveCount(0);
});

test("a blank or whitespace-only draft cannot be sent", async ({ page }, info) => {
  await openScene(page, info);
  const field = composerField(page);
  const before = await messageRows(page).count();

  await field.click();
  await field.press("Enter");
  await expect(messageRows(page)).toHaveCount(before);

  await field.fill("   ");
  // Whitespace is not a message on either platform, though only iOS keeps the audio button for it.
  const audio = composerForm(page).getByRole("button", { name: "Record audio message" });
  await expect(audio).toHaveCount(platformFor(info) === "ios" ? 1 : 0);
  await field.press("Enter");
  await expect(messageRows(page)).toHaveCount(before);
  await expect(field).toHaveValue("   ");

  await field.fill("Real text");
  await field.press("Enter");
  await expect(messageRows(page)).toHaveCount(before + 1);
  await expect(field).toHaveValue("");
});

test("the Tapback menu applies a reaction to the bubble and toggles it back off", async ({ page }, info) => {
  const platform = platformFor(info);
  await openScene(page, info);
  const target = messageRow(page, "m6");
  await expect(target.getByRole("img", { name: "Love tapback, from you" })).toHaveCount(0);

  await openTapbackMenu(page, "m6", defaultGesture(platform));
  const menu = tapbackMenu(page);
  await expect(menu.getByRole("menuitemradio", { name: "Love", exact: true })).toHaveAttribute("aria-checked", "false");
  await menu.getByRole("menuitemradio", { name: "Love", exact: true }).click();

  await expect(menu).toBeHidden();
  await expect(target.getByRole("img", { name: "Love tapback, from you" })).toBeVisible();

  // Re-opening shows the reaction as the chosen one; choosing it again removes it.
  await openTapbackMenu(page, "m6", defaultGesture(platform));
  await expect(tapbackMenu(page).getByRole("menuitemradio", { name: "Love", exact: true })).toBeChecked();
  await tapbackMenu(page).getByRole("menuitemradio", { name: "Love", exact: true }).click();
  await expect(tapbackMenu(page)).toBeHidden();
  await expect(target.getByRole("img", { name: "Love tapback, from you" })).toHaveCount(0);
});

test("several people reacting to one message is one balloon, not one each", async ({ page }, info) => {
  await openScene(page, info, "reactions");
  // m3 carries a laugh from them and an emphasize from me. ChatKit collapses that into a single
  // CKAggregateAcknowledgmentChatItem with one acknowledgmentImageName, so the transcript shows the
  // most recent reaction once and says how many there are - not a balloon per person.
  const both = messageRow(page, "m3");
  await expect(both.getByRole("img")).toHaveCount(1);
  await expect(both.getByRole("img", { name: "Emphasize tapback, 2, from you" })).toBeVisible();

  // One reaction still reads as one reaction, with no count.
  const one = messageRow(page, "m1");
  await expect(one.getByRole("img")).toHaveCount(1);
  await expect(one.getByRole("img", { name: "Love tapback, from you" })).toBeVisible();
});

test("every gesture that opens the reaction menu offers the six classic Tapbacks", async ({ page }, info) => {
  const platform = platformFor(info);
  await openScene(page, info);
  // iOS opens on a hold, a right click or a double click; the macOS pane opens on a right click.
  const gestures = platform === "ios" ? (["hold", "right-click", "double-click"] as const) : (["right-click"] as const);

  for (const gesture of gestures) {
    await openTapbackMenu(page, "m5", gesture);
    const menu = tapbackMenu(page);
    for (const name of ["Love", "Like", "Dislike", "Laugh", "Emphasize", "Question"]) {
      await expect(menu.getByRole("menuitemradio", { name, exact: true }), `${gesture} shows ${name}`).toBeVisible();
    }
    await expect(actionsMenu(page)).toBeVisible();
    await menu.getByRole("menuitemradio", { name: "Love", exact: true }).press("Escape");
    await expect(menu).toBeHidden();
  }
});

test("Escape closes the reaction menu and leaves the conversation untouched", async ({ page }, info) => {
  const platform = platformFor(info);
  await openScene(page, info);
  const before = await messageRows(page).count();

  await openTapbackMenu(page, "m6", defaultGesture(platform));
  const menu = tapbackMenu(page);
  await menu.getByRole("menuitemradio", { name: "Love", exact: true }).focus();
  await page.keyboard.press("Escape");

  await expect(menu).toBeHidden();
  await expect(actionsMenu(page)).toBeHidden();
  await expect(messageRows(page)).toHaveCount(before);
  await expect(messageRow(page, "m6").getByRole("img")).toHaveCount(0);
  await expect(bubbleBody(page, "m6")).toBeVisible();
});

test("Escape closes the reaction menu even when focus is not inside it", async ({ page }, info) => {
  const platform = platformFor(info);
  // Both shells listen for Escape on the document, so a pointer user who never focused the menu can
  // still dismiss it. macOS additionally closes on a click anywhere outside the menu.
  await openScene(page, info);
  await openTapbackMenu(page, "m6", defaultGesture(platform));

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Escape");
  await expect(tapbackMenu(page)).toBeHidden();
});

test("the Tapback bar moves focus with the left and right arrows", async ({ page }, info) => {
  const platform = platformFor(info);
  await openScene(page, info);
  await openTapbackMenu(page, "m6", defaultGesture(platform));
  const menu = tapbackMenu(page);
  const option = (name: string) => menu.getByRole("menuitemradio", { name, exact: true });

  await option("Love").focus();
  await expect(option("Love")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(option("Like")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(option("Dislike")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(option("Like")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(option("Love")).toBeFocused();
  // Only the focused option is in the tab order; the rest are reachable with the arrows.
  await expect(option("Love")).toHaveAttribute("tabindex", "0");
  await expect(option("Like")).toHaveAttribute("tabindex", "-1");
});

test("Home and End jump to the ends of the Tapback bar", async ({ page }, info) => {
  const platform = platformFor(info);
  // The macOS bar sits in the context menu's header; the menu lets keys that start inside the bar
  // through so the bar keeps its own Home and End behaviour.
  const timeout = platform === "macos" ? 2000 : 7000;
  await openScene(page, info);
  await openTapbackMenu(page, "m6", defaultGesture(platform));
  const menu = tapbackMenu(page);
  const option = (name: string) => menu.getByRole("menuitemradio", { name, exact: true });

  await option("Like").focus();
  await page.keyboard.press("Home");
  await expect(option("Love")).toBeFocused({ timeout });
  await page.keyboard.press("End");
  const last = platform === "ios" ? option("👍") : menu.getByRole("menuitem", { name: "More emoji", exact: true });
  await expect(last).toBeFocused({ timeout });
});

test("the message actions menu moves focus with the arrow keys, Home and End", async ({ page }, info) => {
  const platform = platformFor(info);
  await openScene(page, info);
  await openTapbackMenu(page, "m6", defaultGesture(platform));
  const menu = actionsMenu(page);
  await expect(menu).toBeVisible();

  const [first, second, third] = platform === "ios" ? ["Copy", "Translate", "Select"] : ["Reply…", "Attach Sticker…", "Forward…"];
  const last = platform === "ios" ? "More…" : "Show Times";
  const item = (name: string) => menu.getByRole("menuitem", { name, exact: true });

  await item(first).focus();
  await page.keyboard.press("ArrowDown");
  await expect(item(second)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(item(third)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(item(second)).toBeFocused();
  await page.keyboard.press("End");
  await expect(item(last)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(menu.getByRole("menuitem").first()).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("the conversation list opens a conversation and comes back", async ({ page }, info) => {
  const platform = platformFor(info);

  if (platform === "ios") {
    await openScene(page, info, "list");
    await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
    await expect(messageLog(page)).toHaveCount(0);

    await page.getByRole("button", { name: /^Alex Morgan,/ }).click();
    await expect(messageLog(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Alex Morgan, details" })).toBeVisible();
    await expect(composerField(page)).toBeVisible();

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
    await expect(messageLog(page)).toHaveCount(0);
    return;
  }

  // macOS shows the list and the conversation at once: selecting a row never pushes a screen.
  await openWorkbench(page, info);
  const sidebar = page.getByRole("navigation", { name: "Conversations" });
  await expect(sidebar.getByRole("button", { name: /^Alex Morgan/ })).toHaveAttribute("aria-current", "true");
  await expect(sidebar.getByRole("button", { name: /^Jamie Chen/ })).not.toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
  await expect(messageLog(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Alex Morgan, show details" })).toBeVisible();

  await sidebar.getByRole("button", { name: /^Jamie Chen/ }).click();
  await expect(page.getByRole("log", { name: "Interaction log" })).toContainText("navigation.open jamie");
  await expect(messageLog(page)).toBeVisible();
});

test("the compose surface opens and closes again", async ({ page }, info) => {
  const platform = platformFor(info);

  if (platform === "ios") {
    await openScene(page, info, "list");
    await page.getByRole("button", { name: "New message", exact: true }).click();

    const sheet = page.getByRole("dialog", { name: "New Message" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("textbox", { name: "To:", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Add contact" })).toBeVisible();

    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
    return;
  }

  // macOS has no New Message sheet; the composer's "+" opens the attachments popover.
  await openScene(page, info);
  const attach = page.getByRole("button", { name: "Add attachment" });
  await expect(attach).toHaveAttribute("aria-haspopup", "menu");
  await attach.click();

  const menu = page.getByRole("menu", { name: "Attachments" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Photos", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveCount(6);

  await attach.click();
  await expect(menu).toBeHidden();
});

test("the conversation list shows every fixture conversation and its controls", async ({ page }, info) => {
  const platform = platformFor(info);
  if (platform === "ios") {
    await openScene(page, info, "list");
    await expect(page.getByRole("list").getByRole("listitem")).toHaveCount(conversationList.length);
    await expect(page.getByRole("button", { name: /^Alex Morgan,/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New message", exact: true })).toBeVisible();
    return;
  }
  await openScene(page, info);
  const sidebar = page.getByRole("navigation", { name: "Conversations" });
  await expect(sidebar.getByRole("listitem")).toHaveCount(conversationList.length);
  // The pinned conversation sits above the rows, as a tile of its own.
  const pinned = conversationList.filter(conversation => conversation.pinned);
  await expect(sidebar.getByRole("list", { name: "Pinned" }).getByRole("listitem")).toHaveCount(pinned.length);
  await expect(sidebar.getByRole("button", { name: new RegExp(`^${pinned[0].name}`) })).toBeVisible();
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.getByRole("button", { name: "New message", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "FaceTime Alex Morgan" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Muted" })).toBeVisible();
});

test("scenes render without an uncaught page error", async ({ page }, info) => {
  // Seven navigations where every other test in this file makes one, so give it the room. Measured
  // 2026-09-09: served from a build every navigation here settles in under a second and the whole
  // file runs in 23 s, but against the dev server two engines navigating at once can leave a single
  // /harness document request in flight for 15-20 s, and this test - the only one that pays that
  // cost seven times over - is the one that runs out of budget. Prefer `serve:test` for a full run.
  test.slow();
  for (const scene of ["conversation", "list", "new-message", "typing", "reactions", "long-press"]) {
    await openScene(page, info, scene, 0);
    await expect(page.getByTestId("device")).toBeVisible();
  }
  // 1017 ms (f134) is where the recording moves "Delivered" onto the new bubble, and it is now the
  // `outgoing` scenario's own duration.
  await openScene(page, info, "outgoing", 1017);
  await expect(messageRow(page, "new-outgoing")).toContainText("Delivered");
  expect(pageErrors.get(page)).toEqual([]);
});

test("holding send opens the effects screen, and choosing one sends with it", async ({ page }, info) => {
  test.skip(platformFor(info) === "macos", "the effects screen is an iOS surface; macOS uses a popover that is not built");
  await openWorkbench(page, info);
  const field = composerField(page);
  await field.fill("Every detail, down to the last bubble.");

  await openEffectsScreen(page);
  const screen = effectsScreen(page);
  await expect(screen.getByRole("tab", { name: "Bubble" })).toHaveAttribute("aria-selected", "true");
  const before = await messageRows(page).count();

  // Nothing is chosen yet, so every row is a plain radio and none of them sends.
  const slam = screen.getByRole("radio", { name: "Slam" });
  await expect(slam).toHaveAttribute("aria-checked", "false");
  await slam.click();
  await expect(screen.getByRole("radio", { name: "Send with Slam" })).toHaveAttribute("aria-checked", "true");
  await expect(screen.getByText("SEND WITH SLAM")).toBeVisible();

  await screen.getByRole("radio", { name: "Send with Slam" }).click();
  await expect(screen).toHaveCount(0);
  await expect(messageRows(page)).toHaveCount(before + 1);
  await expect(field).toHaveValue("");
});

test("the effects screen switches tabs and cancels without sending", async ({ page }, info) => {
  test.skip(platformFor(info) === "macos", "the effects screen is an iOS surface");
  await openWorkbench(page, info);
  await composerField(page).fill("Every detail, down to the last bubble.");
  const before = await messageRows(page).count();

  await openEffectsScreen(page);
  const screen = effectsScreen(page);
  await screen.getByRole("tab", { name: "Screen" }).click();
  await expect(screen.getByRole("tab", { name: "Screen" })).toHaveAttribute("aria-selected", "true");
  // The Screen tab drops the rail entirely.
  await expect(screen.getByRole("radiogroup", { name: "Bubble effects" })).toHaveCount(0);
  await expect(screen.getByRole("button", { name: "Send" })).toBeVisible();

  await screen.getByRole("button", { name: "Cancel" }).click();
  await expect(screen).toHaveCount(0);
  await expect(messageRows(page)).toHaveCount(before);
  await expect(composerField(page)).toHaveValue("Every detail, down to the last bubble.");
});

/* ───────────────────────────── Pressed, held and dragged ─────────────────────────────
 *
 * Everything below drives a gesture and reads what the page paints while it is in flight. Nothing
 * here is a screenshot and nothing here dispatches a synthetic event: a pressed row, a hovered row,
 * a dimmed button and a revealed timestamp only exist while a pointer is down, so a suite that
 * navigates and screenshots cannot reach any of them — which is why every one of these states was
 * shipped inert.
 */

/**
 * The pointer these tests drive with.
 *
 * On iOS under Chromium it is a REAL touch, dispatched through CDP's `Input.dispatchTouchEvent`.
 * That matters twice over: a synthesised `pointerdown` proves nothing about a gesture the browser
 * would take over for panning, and `:active` never latches under a CDP touch at all — so an
 * `:active`-based assertion passes on a screen that does nothing, which is exactly the class of
 * defect this block exists to catch. WebKit exposes no CDP, so it drives the mouse, which raises the
 * same pointer events these components listen for; the macOS shell is a mouse target either way.
 *
 * Each `touchPoints` entry MUST carry an `id`. Chromium accepts a point without one and then
 * dispatches no `pointerdown` at all, so the test reads a resting row and reports a bug that is its
 * own — measured 2026-09-09, and the reason this helper exists rather than an inline `cdp.send`.
 */
async function beginGesture(page: Page, info: TestInfo) {
  const touch = platformFor(info) === "ios" && info.project.name.endsWith("chromium");
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  let at = { x: 0, y: 0 };
  const points = () => [{ x: at.x, y: at.y, id: 0, radiusX: 5, radiusY: 5, force: 1 }];
  const centre = async (target: Locator) => {
    const box = (await target.boundingBox())!;
    at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    return at;
  };
  return {
    /** A real finger, or the mouse standing in for one. A touch has no hover; a mouse pans nothing. */
    touch: cdp !== null,
    async hover(target: Locator) { const { x, y } = await centre(target); await page.mouse.move(x, y); },
    /** Puts the pointer down at a stated point rather than at a control's centre. */
    async downAt(x: number, y: number) {
      at = { x, y };
      if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points() });
      else { await page.mouse.move(at.x, at.y); await page.mouse.down(); }
    },
    async down(target: Locator) {
      await centre(target);
      if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points() });
      else { await page.mouse.move(at.x, at.y); await page.mouse.down(); }
    },
    async moveTo(x: number, y: number) {
      at = { x, y };
      if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points() });
      else await page.mouse.move(x, y);
    },
    /** A real lift, which also activates whatever is under it. */
    async up() {
      if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      else await page.mouse.up();
    },
    /**
     * Ends the hold WITHOUT the activation a lift fires, so a press state can be watched going out
     * on a control whose click would navigate away from the thing being measured. A cancelled touch
     * is what the browser itself sends when a gesture is taken over for panning, and it is the path
     * `UITableView` treats as "a touch that became a scroll never highlights".
     *
     * The mouse has no such event. Moving off the control and releasing there is not enough either:
     * these buttons take the pointer with `setPointerCapture`, and WebKit delivers the compatibility
     * click to the capture target however far the mouse has travelled — measured 2026-09-09, where a
     * released hold on "Back" popped the conversation and left the next assertion looking at a list.
     * So the release is fenced with a one-shot capture-phase listener on `document`, which runs ahead
     * of React's root listener and stops the click before any handler sees it. It is scoped to this
     * teardown and to nothing else: no test asserts through it, and a click that a test means to
     * deliver goes through `up()` or through Playwright's own `click()`.
     */
    async abort() {
      if (cdp) { await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); return; }
      await page.mouse.move(2, 2);
      await page.evaluate(() => {
        const swallow = (event: Event) => { event.stopPropagation(); event.preventDefault(); document.removeEventListener("click", swallow, true); };
        document.addEventListener("click", swallow, true);
        setTimeout(() => document.removeEventListener("click", swallow, true), 500);
      });
      await page.mouse.up();
    },
  };
}

/** What the element paints right now, plus whether it is drawing a keyboard focus ring. */
function styleOf(target: Locator) {
  return target.evaluate(element => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, opacity: style.opacity, transform: style.transform, focusVisible: element.matches(":focus-visible") };
  });
}
const TRANSPARENT = "rgba(0, 0, 0, 0)";

/**
 * Everything the element and its subtree paint, as one string to compare rest against held.
 *
 * The subtree is the point. A pressed control does not always change its own box: the composer's
 * glass buttons dim the glass layer rather than the button, and a row that delegates its fill to a
 * child would look untouched from the outside. Comparing the whole subtree asks the only question
 * worth asking — did anything change on screen — without pinning a colour this file has no
 * measurement of its own for. The two colours it does have measured are asserted exactly, above.
 */
function paintOf(target: Locator) {
  return paintFrom(target);
}

/**
 * The same, rooted one level up. A pressed row does not always paint inside itself either:
 * `ios-details.tsx` puts the highlight on a `row-press` layer that is a SIBLING of the button, both
 * inside the cell's clip, so a subtree query rooted at the button sees a screen that never changes.
 * The parent is the smallest box that holds both.
 */
function paintAround(target: Locator) {
  return paintFrom(target.locator("xpath=.."));
}

/**
 * The settled paint. A press release is a 100 ms eased transition, and reading the next control's
 * rest pose while the last one is still easing back reads a pressed button and calls it rest —
 * measured 2026-09-09, on the composer's send arrow, which React reuses as the DOM node the mic had.
 * Two identical reads in a row means nothing is in flight.
 */
async function settled(page: Page, read: () => Promise<string>): Promise<string> {
  let previous = await read();
  for (let attempt = 0; attempt < 40; attempt++) {
    // A frame apart, deliberately: `getComputedStyle` samples a transition once per frame, so two
    // round trips inside one frame return the same value and a still-easing control reads settled.
    await nextFrame(page);
    const next = await read();
    if (next === previous) return next;
    previous = next;
  }
  return previous;
}

/** Waits for the page to paint, so the next computed style is a new sample and not a cached one. */
function nextFrame(page: Page) {
  return page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

function paintFrom(target: Locator) {
  return target.evaluate(root => [root, ...root.querySelectorAll("*")].map(element => {
    const style = getComputedStyle(element);
    // `backgroundImage` is in here because the macOS inspector's glass buttons press by swapping a
    // gradient over an unchanged `background-color`; a signature of colours alone reads them inert.
    return `${style.backgroundColor}|${style.backgroundImage}|${style.opacity}|${style.transform}|${style.color}|${style.boxShadow}`;
  }).join("\n"));
}

/**
 * Flips the harness's preview between the two palettes in place. The theme is a `dark` class on the
 * preview wrapper — exactly what the workbench's own Theme control sets — so switching it here is
 * the same switch a reader makes, without a second navigation. That matters: a WebKit navigation
 * against the dev server takes 0.6 s on a good day and hangs past 15 s on a bad one (see the note on
 * `scenes render without an uncaught page error`), so a test that loads twice to compare two colours
 * is a test that reports the dev server rather than the kit.
 */
async function setPreviewTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate(next => {
    const preview = document.querySelector<HTMLElement>("[data-preview-theme]");
    if (!preview) throw new Error("the harness preview is not on the page");
    preview.classList.toggle("dark", next === "dark");
    preview.dataset.previewTheme = next;
    preview.style.colorScheme = next;
  }, theme);
}

test("a finger on a conversation row lights it, and letting go puts it out", async ({ page }, info) => {
  test.skip(platformFor(info) === "macos", "the iOS list is the touch surface; the sidebar's own press is the test below");
  // Light and dark are two different colours out of ChatKit and only one of them can be wrong at a
  // time, so both are driven. The row is the THIRD: the row above a pressed one drops its separator
  // as well, and picking the first would leave that half of the behaviour unobserved.
  await openScene(page, info, "list");
  for (const [theme, fill] of [["light", "rgb(220, 220, 220)"], ["dark", "rgb(70, 70, 70)"]] as const) {
    await setPreviewTheme(page, theme);
    const row = page.locator('[data-slot="row"]').nth(2);
    const button = row.locator("button");
    const separators = page.locator('[data-slot="separator"]');
    const restSeparators = await separators.count();

    expect((await styleOf(button)).background, `${theme}: a row at rest paints nothing`).toBe(TRANSPARENT);
    await expect(row).not.toHaveAttribute("data-pressed");

    const gesture = await beginGesture(page, info);
    await gesture.down(row);
    await expect(row).toHaveAttribute("data-pressed");
    const held = await styleOf(button);
    // `-[CKUITheme conversationListSelectedCellColor]` read at idiom 0, not a guess and not from a
    // capture: scanning both list captures returns one flat run each, so neither holds a pressed row.
    expect(held.background, `${theme}: the held row`).toBe(fill);
    // A press opened by a finger must never draw a focus ring. Both engines match `:focus-visible`
    // on a programmatic focus while a pointer is still down, which is the trap `tapback-bar.tsx` and
    // `audio-recorder.tsx` had to work around; the list avoids it by focusing nothing at all.
    expect(held.focusVisible, `${theme}: a finger must not raise a focus ring`).toBe(false);
    // The highlight is one unbroken band: the pressed row's separator and the one above it go too.
    await expect(separators).toHaveCount(restSeparators - 2);

    await gesture.abort();
    await expect(row).not.toHaveAttribute("data-pressed");
    await expect.poll(async () => (await styleOf(button)).background, { message: `${theme}: the highlight goes out` }).toBe(TRANSPARENT);
    await expect(separators).toHaveCount(restSeparators);
  }
});

test("a sidebar row answers hover and press with two different fills", async ({ page }, info) => {
  test.skip(platformFor(info) === "ios", "the sidebar is a macOS surface");
  await openScene(page, info, "list");
  // An UNSELECTED row: the selected one is already filled, so it could not tell a working press from
  // a broken one. Row 1 is Design Crit; row 0, Alex Morgan, is the scene's selection.
  const row = page.locator('[data-slot="sidebar-row"]').nth(1);
  const button = row.locator("button");
  const hoverLayer = row.locator('[data-slot="row-hover"]');

  expect((await styleOf(button)).background).toBe(TRANSPARENT);
  expect((await styleOf(hoverLayer)).opacity, "nothing is hovered before the mouse arrives").toBe("0");

  const gesture = await beginGesture(page, info);
  await gesture.hover(row);
  // Hover is the wash, drawn by a layer of its own rather than by the row's background: on 2026-09-09
  // rest, hover and press all measured `rgba(0, 0, 0, 0)` here, which is the whole reason for this.
  await expect.poll(async () => (await styleOf(hoverLayer)).opacity, { message: "hover raises the wash" }).toBe("1");
  expect((await styleOf(button)).background, "hover is not the press fill").toBe(TRANSPARENT);

  await gesture.down(row);
  await expect(row).toHaveAttribute("data-pressed");
  const held = await styleOf(button);
  // #3478f6, the key window's selection: `CKConversationListCell` is a `UITableViewCell` and a table
  // cell paints one `selectedBackgroundView` for `highlighted` and `selected` alike.
  expect(held.background, "a held row wears the selection fill").toBe("rgb(52, 120, 246)");
  expect(held.focusVisible, "a mouse press must not raise a focus ring").toBe(false);

  await gesture.abort();
  await expect(row).not.toHaveAttribute("data-pressed");
  await expect.poll(async () => (await styleOf(button)).background, { message: "the fill goes out on release" }).toBe(TRANSPARENT);
});

/**
 * Every button in the two shells' chrome, with the pose it takes. The iOS ones dim and shrink
 * (`iosNavPress` / `iosComposerPress`: alpha 0.4, scale 0.85 — the name pill takes the alpha alone,
 * because 0.85 on a 187 pt capsule reads as a different control rather than a pressed one); the
 * macOS glass buttons darken their fill and the waveform, which has no fill, dims instead.
 *
 * The release is asserted as the pointer LEAVING the control rather than as a lift: a macOS fill
 * eases back over `macComposerMetrics.press.release` to the HOVER colour, not to the rest one, so
 * "the paint returned" is not a claim that holds with the mouse still on the button. "The press let
 * go" is, on both platforms, and it is the invariant that was missing.
 */
const chromeButtons = {
  ios: [
    { slot: "back", scene: "conversation", draft: false },
    { slot: "title", scene: "conversation", draft: false },
    { slot: "attach", scene: "conversation", draft: false },
    { slot: "mic", scene: "conversation", draft: false },
    { slot: "send", scene: "conversation", draft: true },
  ],
  macos: [
    { slot: "attach-button", scene: "conversation", draft: false },
    { slot: "emoji-button", scene: "conversation", draft: false },
    { slot: "audio-button", scene: "conversation", draft: false },
  ],
} as const;

test("every chrome button takes a press, changes what it paints, and raises no focus ring", async ({ page }, info) => {
  // One page for the whole table. A load per button would be the obvious way to keep the buttons
  // from presenting things on each other, but a WebKit navigation against the dev server takes
  // anywhere from 0.6 to 15 s (the file's own note on `scenes render…` says why), so five of them is
  // a test that times out rather than a test that fails. `beginGesture().abort()` fences the release
  // instead, and `settled()` keeps the previous button's 100 ms ease-back out of the next one's rest
  // pose — which matters most on the send arrow, since React hands it the DOM node the mic released.
  await openScene(page, info, "conversation");
  for (const button of chromeButtons[platformFor(info)]) {
    // The send arrow only exists while there is a draft; the mic and the waveform only while there
    // is not. So the field is set per button rather than once.
    await composerField(page).fill(button.draft ? "Blue for iMessage." : "");
    const target = page.locator(`[data-slot="${button.slot}"]`).first();
    await expect(target, `${button.slot} is on screen`).toBeVisible();
    const rest = await settled(page, () => paintOf(target));
    await expect(target).not.toHaveAttribute("data-pressed");

    const gesture = await beginGesture(page, info);
    await gesture.down(target);
    await expect(target, `${button.slot} takes a press`).toHaveAttribute("data-pressed");
    // The marker alone would pass on a button that draws nothing, so the paint has to move too.
    // Polled, not sampled once: the macOS glass buttons ease their fill in over `press.release`, so
    // on the frame the marker lands they are still painting the colour they had.
    await expect.poll(async () => (await paintOf(target)) === rest ? "unchanged" : "moves",
      { message: `${button.slot} must look pressed, not merely be marked pressed` }).toBe("moves");
    expect((await styleOf(target)).focusVisible, `${button.slot} must not raise a focus ring under a pointer`).toBe(false);

    // A press that wanders off the control commits nothing and paints nothing: `usePress` tracks the
    // pointer against the button's own box, so dragging away is the release path that does not also
    // activate the button. That is the native rule, and it is what makes this assertion safe here.
    await gesture.moveTo(2, 2);
    await expect(target, `${button.slot} drops the press when the pointer leaves it`).not.toHaveAttribute("data-pressed");
    await gesture.abort();
  }
});

/**
 * The Hide Alerts switch, on all three details surfaces. It is driven UNCONTROLLED — the harness
 * passes neither a value nor a handler, which is the case the shells themselves hit when their
 * caller hands over no details content, and the only case in which the switch was ever broken: both
 * controls used to be fully controlled with a `false` default, so a consumer that wired nothing got
 * `aria-checked="false"` before the tap and `aria-checked="false"` after it. Every lab route wires
 * both props, which is why nothing caught it.
 */
const detailsScreens = { ios: ["details", "group-details"], macos: ["details"] } as const;

test("the Hide Alerts switch toggles with nothing controlling it", async ({ page }, info) => {
  for (const scene of detailsScreens[platformFor(info)]) {
    await openScene(page, info, scene);
    const control = page.getByRole("switch", { name: "Hide Alerts" }).or(page.getByRole("checkbox", { name: "Hide Alerts" }));
    await expect(control, `${scene}: the switch is on screen`).toHaveCount(1);
    await expect(control, `${scene}: off to start with`).toHaveAttribute("aria-checked", "false");

    await control.click();
    await expect(control, `${scene}: a click turns it on`).toHaveAttribute("aria-checked", "true");

    await control.click();
    await expect(control, `${scene}: and back off`).toHaveAttribute("aria-checked", "false");

    // It is a real switch, so the keyboard reaches it too.
    await control.press("Space");
    await expect(control, `${scene}: Space toggles it`).toHaveAttribute("aria-checked", "true");
  }
});

/** The rows and buttons each details screen makes pressable, by the slot each one carries. */
const detailsPressables = {
  ios: { details: ["action", "block"], "group-details": ["action", "participant", "leave"] },
  // `details-link`, `details-attachment` and `details-handle` are NOT here: the harness fixtures give
  // them no handler, so `MacDetails` renders them as plain divs with no press to drive. Giving them
  // one would turn the handle rows blue (`tone={handle.onPress ? "tint" : "label"}`) and move the
  // inspector's visual baselines, which is a change for whoever owns those, not for this file.
  macos: { details: ["details-close", "details-tab", "details-action", "details-photo"] },
} as const;

test("the details screens answer a press on every row that has one", async ({ page }, info) => {
  const platform = platformFor(info);
  for (const [scene, slots] of Object.entries(detailsPressables[platform]) as [string, readonly string[]][]) {
    await openScene(page, info, scene);
    for (const slot of slots) {
      const target = page.locator(`[data-slot="${slot}"]`).first();
      await expect(target, `${scene}: ${slot} is on screen`).toBeVisible();
      await target.scrollIntoViewIfNeeded();
      const rest = await settled(page, () => paintAround(target));
      await expect(target).not.toHaveAttribute("data-pressed");

      const gesture = await beginGesture(page, info);
      await gesture.down(target);
      // `data-pressed` rather than `:active`: the state is pointer-driven, and `:active` never
      // latches under a CDP touch, so an `:active` assertion would pass on a screen that does
      // nothing — which is what these screens did.
      await expect(target, `${scene}: ${slot} takes a press`).toHaveAttribute("data-pressed");
      await expect.poll(async () => (await paintAround(target)) === rest ? "unchanged" : "moves",
        { message: `${scene}: ${slot} must paint its press, not merely be marked` }).toBe("moves");
      expect((await styleOf(target)).focusVisible, `${scene}: ${slot} must not raise a focus ring under a pointer`).toBe(false);

      await gesture.abort();
      await expect(target, `${scene}: ${slot} lets go`).not.toHaveAttribute("data-pressed");
    }
  }
});

test("dragging the transcript left reveals the times, and they spring back", async ({ page }, info) => {
  test.skip(platformFor(info) === "macos", "the drawer is an iOS gesture; the Mac has no such thing");
  await openScene(page, info, "conversation");
  const rows = page.locator('[data-slot="swipe-times"]');
  const content = page.locator('[data-slot="swipe-content"]').first();
  const time = rows.first().locator('[data-slot="time"]');
  await expect(rows.first()).toBeVisible();

  // At rest the row carries no transform at all — not `translateX(0)`, none — because a transform
  // node layerises the row and a composited layer loses subpixel text antialiasing.
  expect((await styleOf(content)).transform, "a resting row has no transform").toBe("none");
  expect((await styleOf(time)).opacity, "and no time showing").toBe("0");
  await expect(time, "the time is out of the accessibility tree while it is off screen").toHaveAttribute("aria-hidden", "true");

  const log = page.locator('[data-slot="message-list"]');
  const box = (await log.boundingBox())!;
  const startX = box.x + box.width - 40;
  const y = box.y + box.height / 2;
  const gesture = await beginGesture(page, info);
  // Down where the drag starts, not at the log's centre: the gesture measures its travel from the
  // point the finger LANDED, so a hop to the start line would be the first move and count as travel.
  await gesture.downAt(startX, y);
  // Twelve steps over 70 px: past the 8 px slop that decides the axis, then tracking one to one,
  // which is ChatKit's `transcriptDrawerGestureAcceleration` = 1 read off `CKUIBehaviorPhone`.
  for (let step = 1; step <= 12; step++) await gesture.moveTo(startX - (70 * step) / 12, y);

  // `matrix(1, 0, 0, 1, tx, ty)`: the fifth number is the travel. Parsed here rather than with
  // `DOMMatrix`, which is a browser API and does not exist in the test runner.
  const shift = Number((await styleOf(content)).transform.split(/[(),]/)[5]);
  expect(shift, "the messages have travelled left").toBeLessThan(-50);
  await expect.poll(async () => (await styleOf(time)).opacity, { message: "the time is fully in" }).toBe("1");
  await expect(time, "and back in the accessibility tree").not.toHaveAttribute("aria-hidden", "true");
  // Every row moves together: it is one drawer, not a per-message reveal.
  const progresses = await rows.evaluateAll(elements => elements.map(element => element.getAttribute("data-progress")));
  expect(new Set(progresses).size, "every row is at the same progress").toBe(1);

  await gesture.up();
  await expect.poll(async () => (await styleOf(content)).transform, { message: "the drawer springs shut", timeout: 3000 }).toBe("none");
  expect((await styleOf(time)).opacity, "and the times go with it").toBe("0");
});

test("a mostly vertical drag scrolls the transcript instead of opening the drawer", async ({ page }, info) => {
  test.skip(platformFor(info) === "macos", "the drawer is an iOS gesture");
  // `photos` is the scene with somewhere to scroll: the log overflows by 125 pt there.
  await openScene(page, info, "photos");
  // The log is its own scroller: `[data-slot="message-list"]` carries `overflow-y-auto`.
  const log = page.locator('[data-slot="message-list"]');
  const scrollTop = () => log.evaluate(element => element.scrollTop);
  const before = await scrollTop();
  expect(before, "the log opens scrolled to the newest message").toBeGreaterThan(0);

  const box = (await log.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const gesture = await beginGesture(page, info);
  await gesture.downAt(x, y);
  // Mostly down, a little left: the axis lock has to drop the finger whole and let the log scroll.
  for (let step = 1; step <= 10; step++) await gesture.moveTo(x - 4, y + 8 * step);
  const progress = await page.locator('[data-slot="swipe-times"]').first().getAttribute("data-progress");
  await gesture.up();

  expect(progress, "a vertical drag opens no drawer at all").toBe("0.000");
  // Only a real touch pans a scroller. A held mouse dragged down over an `overflow-y-auto` box moves
  // nothing in either engine, so on the mouse path the assertion above — that the drawer stayed shut
  // — is the whole of what this gesture can prove, and asserting a scroll there would be asserting
  // the browser rather than the axis lock.
  if (gesture.touch) await expect.poll(scrollTop, { message: "the log scrolled instead" }).toBeLessThan(before);
});

test("unread conversations draw a dot, announce themselves, and go white on the selection", async ({ page }, info) => {
  const platform = platformFor(info);
  await openScene(page, info, "list-unread");
  const unread = unreadConversationList.filter(item => item.unread);
  const read = unreadConversationList.filter(item => !item.unread);
  expect(unread.length, "the fixture has unread rows to find").toBeGreaterThan(0);
  expect(read.length, "and a read one to read them against").toBeGreaterThan(0);

  if (platform === "ios") {
    // Every unread row, pinned or not: iOS has no pinned collection, so all six are in one list.
    await expect(page.locator('[data-slot="unread"]')).toHaveCount(unread.length);
    // #0088ff, `-[CKUIThemePhone unreadIndicatorColor]`. A count is a dot here: nothing in the
    // phone's cell draws a number.
    const dot = page.locator('[data-slot="unread"]').first();
    expect((await styleOf(dot)).background).toBe("rgb(0, 136, 255)");
    // The announcement leads, so a screen reader says "Unread" before the name.
    await expect(page.getByRole("button", { name: /^Unread\. Jamie Chen,/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Alex Morgan,/ }), "a read row announces no such thing").toBeVisible();
    return;
  }

  // macOS splits the same six: the pinned one is a tile with its dot hung off the label's leading
  // edge, the rest are rows with theirs in the 18 pt gutter.
  const pinnedUnread = unread.filter(item => item.pinned);
  await expect(page.locator('[data-slot="row-unread"]')).toHaveCount(unread.length - pinnedUnread.length);
  await expect(page.locator('[data-slot="pinned-unread"]')).toHaveCount(pinnedUnread.length);
  // A count is announced and never painted — macOS Messages draws no number on a row.
  await expect(page.getByRole("button", { name: /^3 unread messages\./ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Unread\..*Jamie Chen/ })).toBeVisible();

  // The one behaviour the two platforms do not share: on the selected row the dot takes the white
  // the labels take (`unreadIndicatorSelectedImage`), while every other row keeps the blue.
  const selectedRow = page.locator('[data-slot="sidebar-row"][data-selected="true"]');
  await expect(selectedRow.locator('[data-slot="row-unread"]'), "the scene selects an unread row").toHaveCount(1);
  expect((await styleOf(selectedRow.locator('[data-slot="row-unread"]'))).background).toBe("rgb(255, 255, 255)");
  const unselected = page.locator('[data-slot="sidebar-row"][data-selected="false"] [data-slot="row-unread"]').first();
  expect((await styleOf(unselected)).background).toBe("rgb(0, 136, 255)");
});

/**
 * The macOS attachment popovers are placed by measuring the DOM, and the measurement used to be
 * taken through the node the *iOS* entrance animation had left a `translateY` on: `useHostPlatform`
 * sniffs in a layout effect, so the first client commit renders the iOS sheet, React reuses the div
 * for the macOS branch, and the `fill: "both"` keyframe was still on it. The popover ended up
 * `top: -398px` - one `restHeight + inset` too high, hanging over the sidebar and the titlebar -
 * every time it was opened by clicking, which is the only path the shell has.
 *
 * Neither of the routes the work was checked on could see it: `?scene=photo-picker` mounts with
 * `progress` set, so the animation is seeked rather than running, and `/lab/macos-pickers` passes
 * `platform="macos"`, so there is no iOS commit at all. So this test drives the button.
 */
test("a macOS attachment popover opened by clicking lands on its button", async ({ page }, info) => {
  test.skip(platformFor(info) !== "macos", "the popover presentation is the Mac's");
  const device = await openScene(page, info, "conversation");
  const pane = await device.boundingBox();

  for (const [row, slot] of [["Photos", "photo-picker"], ["Stickers", "sticker-picker"]] as const) {
    await page.locator('[data-slot="attach-button"]').click();
    await page.getByRole("menuitem", { name: row }).click();
    const popover = page.locator(`[data-slot="${slot}"][data-platform="macos"] [data-slot="mac-popover"]`);
    await expect(popover).toBeVisible();
    const box = (await popover.boundingBox())!;
    const button = (await page.locator('[data-slot="attach-button"]').boundingBox())!;

    // Inside the window it belongs to, on every edge. The old bug put its top 172 px above the pane.
    expect(box.y, `${row} popover top is inside the pane`).toBeGreaterThanOrEqual(pane!.y - 1);
    expect(box.x, `${row} popover left is inside the pane`).toBeGreaterThanOrEqual(pane!.x - 1);
    expect(box.y + box.height, `${row} popover sits above the + button`).toBeLessThanOrEqual(button.y + 1);
    // It opens upward off the button, so its bottom edge is within an arrow's height of the top of
    // the button rather than somewhere else entirely.
    expect(button.y - (box.y + box.height), `${row} popover hugs the button`).toBeLessThan(24);
    await page.keyboard.press("Escape");
  }
});

/**
 * Opening a photo from a stack must leave the stack behind it. The cards carry a `zIndex` so the
 * front one paints last, and a `zIndex` on an absolutely positioned element hoists it to the nearest
 * ancestor *stacking context* — which, with none between the stack and the screen, was above the
 * photo viewer: tapping a photo opened the viewer with the stack still floating over the full-screen
 * image it had just opened. `isolation: isolate` on the stack is what contains them, and this is the
 * check that keeps it there.
 */
test("opening a photo from the stack leaves the stack behind the viewer", async ({ page }, info) => {
  test.skip(platformFor(info) !== "ios", "the transcript stack and its viewer are driven here on the phone");
  await openScene(page, info, "photos");
  const front = page.locator('[data-slot="photo-tile"][data-index="0"]');
  const box = (await front.boundingBox())!;
  await front.tap();
  await expect(page.locator('[data-slot="image-viewer"]')).toBeVisible();
  await page.waitForTimeout(600);

  // The viewer covers the whole screen, so whatever is painted at the middle of where the front card
  // used to be has to belong to the viewer and not to the transcript underneath it.
  const owner = await page.evaluate(point => {
    const el = document.elementFromPoint(point.x, point.y);
    return {
      inViewer: !!el?.closest('[data-slot="image-viewer"]'),
      slot: el?.closest("[data-slot]")?.getAttribute("data-slot") ?? el?.tagName ?? "none",
    };
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(owner.inViewer, `the viewer owns that point, not ${owner.slot}`).toBe(true);

  // And the stack itself is contained: a stacking context of its own, so its cards cannot climb out.
  const isolated = await page.evaluate(() => {
    const stack = document.querySelector('[data-slot="photo-stack"]');
    return stack ? getComputedStyle(stack).isolation : null;
  });
  expect(isolated, "the stack makes its own stacking context").toBe("isolate");
});

/**
 * The composer's smiley opens the sticker browser and closes it again. It used to call an `onEmoji`
 * the shell never passed, so on this app the button was dead: it took the click, kept its pressed
 * look, and opened nothing. Two things had to change for the second click to close it — the button
 * is now exempt from the popovers' press-outside dismissal, or the dismissal and the button's own
 * handler cancelled each other out inside one gesture — and the popover anchors to whichever button
 * raised it rather than always to the "+".
 */
test("the macOS composer's smiley opens the sticker browser on itself, and closes it", async ({ page }, info) => {
  test.skip(platformFor(info) !== "macos", "the composer's smiley is the Mac's");
  await openScene(page, info, "conversation");
  const smiley = page.locator('[data-slot="emoji-button"]');
  const plus = page.locator('[data-slot="attach-button"]');

  await smiley.click();
  const popover = page.locator('[data-slot="sticker-picker"][data-platform="macos"] [data-slot="mac-popover"]');
  await expect(popover).toBeVisible();
  const box = (await popover.boundingBox())!;
  const smileyBox = (await smiley.boundingBox())!;
  const plusBox = (await plus.boundingBox())!;
  // Nearer the button that opened it than the one that did not: the old placement put it on the "+".
  expect(Math.abs(box.x + box.width - (smileyBox.x + smileyBox.width)))
    .toBeLessThan(Math.abs(box.x - plusBox.x));
  // Above the composer, as a popover that has nowhere below it must be.
  expect(box.y + box.height).toBeLessThanOrEqual(smileyBox.y + smileyBox.height);

  await smiley.click();
  await expect(popover).toBeHidden();
});

/**
 * The sidebar's list-options button declares `aria-haspopup="menu"`, and used to open nothing at all:
 * `MacSidebar` takes an `onOptions` the shell never passed. It now opens the inbox menu, whose rows
 * are ChatKit's own strings (`ALL_MESSAGES`, `KNOWN_SENDERS`, `UNKNOWN_SENDERS`, `UNREAD_MESSAGES`,
 * `RECENTLY_DELETED`), and Unread Messages actually filters the list.
 */
test("the macOS sidebar's options button opens the inbox menu and Unread filters the list", async ({ page }, info) => {
  test.skip(platformFor(info) !== "macos", "the sidebar is the Mac's");
  await openScene(page, info, "list-unread");
  const rows = page.locator('[data-slot="sidebar-row"]');
  const all = await rows.count();
  expect(all, "the unread scene has rows to filter").toBeGreaterThan(1);

  await page.locator('[data-slot="sidebar-options"]').click();
  const menu = page.locator('[data-slot="menu-item"]');
  await expect(menu).toHaveText(["All Messages", "Known Senders", "Unknown Senders", "Unread Messages", "Recently Deleted"]);

  await page.getByRole("menuitem", { name: "Unread Messages" }).click();
  await expect(menu).toHaveCount(0);
  const unread = await rows.count();
  expect(unread, "an inbox with fewer rows in it").toBeLessThan(all);
  // Every row left is one that announces itself unread.
  for (let i = 0; i < unread; i++) {
    await expect(rows.nth(i).locator('[data-slot="row-unread"], [data-slot="pinned-unread"]')).toHaveCount(1);
  }

  await page.locator('[data-slot="sidebar-options"]').click();
  await page.getByRole("menuitem", { name: "All Messages" }).click();
  await expect(rows).toHaveCount(all);
});
