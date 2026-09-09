import { expect, test, type Page } from "@playwright/test";
import { conversationList } from "../../harness/scenarios";
import {
  actionsMenu, bubbleBody, composerField, composerForm, defaultGesture, effectsScreen, messageLog, messageRow, messageRows,
  openEffectsScreen, openScene, openTapbackMenu, openWorkbench, platformFor, tapbackMenu, watchPageErrors,
} from "./helpers";

/**
 * User journeys through the two app shells, driven from the harness. Every assertion goes through an
 * accessible role, name or state; nothing here knows about class names or pixel geometry. No test
 * sleeps: waits are either expect polling or a real gesture the page itself times (the 500 ms hold).
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
  for (const scene of ["conversation", "list", "new-message", "typing", "reactions", "long-press"]) {
    await openScene(page, info, scene, 0);
    await expect(page.getByTestId("device")).toBeVisible();
  }
  await openScene(page, info, "outgoing", 1200);
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
