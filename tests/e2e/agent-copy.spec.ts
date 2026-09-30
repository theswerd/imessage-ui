import { expect, test } from "@playwright/test";

const label = "Copy prompt for your agent";
const promptFor = (url: string) => `Read ${new URL(url).origin}/onboard.md and install the Message UI skill. Use it when building Messages-style interfaces in my projects.`;

for (const route of ["/", "/components/tapback"]) {
  test(`agent prompt copies without a dialog and resets its confirmation / ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 402, height: 874 });
    await page.addInitScript(() => {
      Object.assign(window, { copiedPrompts: [] });
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: async (text: string) => (window as unknown as { copiedPrompts: string[] }).copiedPrompts.push(text),
      } });
    });
    await page.goto(route);
    await page.clock.install({ time: new Date("2026-09-29T17:41:00Z") });
    await page.clock.pauseAt(new Date("2026-09-29T17:42:00Z"));
    const button = page.locator(".agent-install-button");
    const before = await button.boundingBox();
    await button.click();
    await expect(button).toHaveAccessibleName("Copied");
    await expect(page.getByRole("dialog", { name: "Add to your agent" })).not.toBeVisible();
    expect(await button.boundingBox()).toEqual(before);
    await page.clock.runFor(1500);
    await button.click();
    await page.clock.runFor(1500);
    await expect(button).toHaveAccessibleName("Copied");
    expect(await page.evaluate(() => (window as unknown as { copiedPrompts: string[] }).copiedPrompts)).toEqual([promptFor(page.url()), promptFor(page.url())]);
    await page.clock.runFor(1000);
    await expect(button).toHaveAccessibleName(label);
  });
}

for (const failure of ["denied", "unavailable"]) {
  test(`agent prompt remains copyable when the clipboard is ${failure}`, async ({ page }) => {
    await page.addInitScript(mode => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: mode === "unavailable" ? undefined : {
        writeText: async () => { throw new DOMException("Permission denied", "NotAllowedError"); },
      } });
    }, failure);
    await page.goto("/");
    const trigger = page.getByRole("button", { name: label, exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Add to your agent" });
    await expect(dialog).toBeVisible();
    const text = dialog.getByRole("textbox", { name: "Paste into your agent" });
    await expect(text).toHaveValue(promptFor(page.url()));
    await expect(text).toBeFocused();
    expect(await text.evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBe(promptFor(page.url()).length);
    await expect(trigger).not.toHaveText("Copied");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: async (text: string) => { Object.assign(window, { copiedPrompt: text }); },
      } });
    });
    await dialog.getByRole("button", { name: "Copy agent prompt" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { copiedPrompt: string }).copiedPrompt)).toBe(promptFor(page.url()));
  });
}

test("agent button writes to the actual Chromium clipboard", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Clipboard read permission is exposed by Chromium.");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  for (const route of ["/", "/components/tapback"]) {
    await page.goto(route);
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(promptFor(page.url()));
  }
});
