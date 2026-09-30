import { expect, test } from "@playwright/test";
import { previewSizes } from "../../lib/preview-sizes";
import { componentHref, siteComponents } from "../../lib/site-catalog";

test("the default is a tall iPhone canvas that fits the window", async ({ page }) => {
  for (const width of [402, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/components/ios-conversation-list");
    await expect(page.locator(".phone-content")).toHaveCSS("width", "402px");
    await expect(page.locator(".phone-content")).toHaveCSS("height", "874px");
    const box = await page.locator(".phone-frame").boundingBox();
    expect(box!.height / box!.width).toBeCloseTo(874 / 402, 1);
    expect(box!.y + box!.height).toBeLessThan(1000);
  }
});

test("size and conversation controls fit inside the phone inspector", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 1000 });
  await page.goto("/components/ios-conversation-list");
  await page.getByRole("button", { name: "Customize preview", exact: true }).click();
  const row = await page.locator(".inspector-select").boundingBox();
  const select = await page.getByLabel("Conversation count", { exact: true }).boundingBox();
  const unread = await page.getByLabel("Unread indicators", { exact: true }).boundingBox();
  expect(select!.x + select!.width).toBeLessThanOrEqual(row!.x + row!.width);
  expect(unread!.y).toBeGreaterThan(row!.y + row!.height);
});

for (const viewport of [402, 1440]) {
  for (const size of ["compact", "standard", "large"] as const) {
    test(`${size} viewports fit every preview at ${viewport}px`, async ({ page }, info) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: viewport, height: 1000 });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const preset = previewSizes[size];
      for (const [name] of siteComponents) {
        await page.goto(componentHref(name));
        // The photo viewer is an actual modal and intentionally hides the surrounding controls.
        if (name === "image-viewer") await page.getByRole("button", { name: "close", exact: true }).click();
        const customize = page.getByRole("button", { name: "Customize preview", exact: true });
        if (viewport === 402) await customize.click();
        await page.getByRole("button", { name: `${preset.label} ${preset.width} × ${preset.height}`, exact: true }).click();
        if (viewport === 402) await customize.click();
        const content = page.locator(".phone-content");
        await expect(content).toHaveCSS("width", `${preset.width}px`);
        await expect(content).toHaveCSS("height", `${preset.height}px`);
        const geometry = await page.locator(".phone-frame").evaluate(frame => {
          const box = frame.getBoundingClientRect();
          const canvas = frame.closest(".preview-canvas")!.getBoundingClientRect();
          return { withinCanvas: box.left >= canvas.left && box.right <= canvas.right, noOverflow: document.documentElement.scrollWidth <= innerWidth };
        });
        expect(geometry).toEqual({ withinCanvas: true, noOverflow: true });
        const app = content.locator('[data-slot="ios-messages-app"]');
        if (await app.count()) {
          await expect(app).toHaveCSS("width", `${preset.width}px`);
          const island = app.locator('[data-slot="dynamic-island"]').first();
          const center = await island.evaluate(element => {
            const box = element.getBoundingClientRect();
            const parent = element.parentElement!.getBoundingClientRect();
            return Math.abs((box.left + box.right) / 2 - (parent.left + parent.right) / 2);
          });
          expect(center).toBeLessThan(0.1);
        }
        if (["ios-conversation-list", "ios-details", "message-image", "message-bubble", "image-viewer"].includes(name)) {
          if (name === "image-viewer") await page.getByRole("button", { name: "A wooden boat on a turquoise alpine lake", exact: true }).click();
          await page.locator(".preview-canvas").screenshot({ path: info.outputPath(`${name}.png`), animations: "disabled" });
        }
      }
      expect(errors).toEqual([]);
    });
  }
}

test("changing size keeps the open chat and its draft; reset restores the tall Standard frame", async ({ page }) => {
  await page.goto("/components/ios-conversation-list");
  await page.getByRole("button", { name: /^Unread\. Jamie Lee,/ }).click();
  const field = page.getByRole("textbox", { name: "Message", exact: true });
  await field.fill("Keep this draft.");
  await page.getByRole("button", { name: "Large 440 × 956", exact: true }).click();
  await expect(field).toHaveValue("Keep this draft.");
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("The Dolomites");
  await page.getByRole("button", { name: "Auto Fit preview", exact: true }).click();
  await expect(field).toHaveValue("Keep this draft.");
  await expect(page.locator(".phone-content")).toHaveCSS("width", "402px");
  await page.getByRole("button", { name: "Compact 375 × 667", exact: true }).click();
  await page.getByRole("button", { name: "Reset preview", exact: true }).click();
  await expect(page.getByRole("button", { name: "Standard 402 × 874", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".phone-content")).toHaveCSS("width", "402px");
  await expect(page.getByRole("button", { name: /^Unread\. Jamie Lee,/ })).toBeVisible();
});
