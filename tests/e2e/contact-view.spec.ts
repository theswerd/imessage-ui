import { expect, test } from "@playwright/test";

test("contact view opens from the sidebar and its settings, back and reset work", async ({ page }) => {
  await page.goto("/components/avatar");
  await page.locator(".registry-sidebar").getByRole("link", { name: "Contact view", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Contact view", exact: true })).toBeVisible();
  const demo = page.locator(".conversation-demo");
  const contact = demo.getByRole("dialog", { name: "Jamie Lee", exact: true });
  await expect(contact).toBeVisible();
  await expect(contact).toContainText("+1 (415) 555-0142");
  const alerts = contact.getByRole("switch", { name: "Hide Alerts", exact: true });
  await alerts.click();
  await expect(alerts).toBeChecked();
  await contact.getByRole("button", { name: "Block Contact", exact: true }).click();
  await expect(contact.getByRole("button", { name: "Unblock Contact", exact: true })).toBeVisible();
  await contact.getByRole("button", { name: "Back", exact: true }).click();
  await expect(contact).toHaveCount(0);
  await demo.getByRole("button", { name: "Jamie Lee, details", exact: true }).click();
  await expect(contact).toBeVisible();
  await page.getByRole("button", { name: "Reset preview", exact: true }).click();
  await expect(contact.getByRole("switch", { name: "Hide Alerts", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(page.locator(".playground-code")).toContainText("IosDetails");
});
