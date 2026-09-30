import { expect, test, type Page } from "@playwright/test";
import { componentHref, siteComponents } from "../../lib/site-catalog";

async function holdPreview(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>(".preview-canvas img")).map(image => image.decode()));
  });
  await page.clock.pauseAt(new Date("2026-09-29T17:41:00Z"));
  await page.evaluate(() => document.getAnimations().forEach(animation => {
    if (animation.playState === "paused") return;
    const timing = animation.effect?.getTiming();
    if (timing?.iterations === Infinity) { animation.pause(); animation.currentTime = 0; }
    else if (animation.playState === "running") animation.finish();
  }));
}

for (const width of [402, 1440]) {
  for (const theme of ["light", "dark"]) {
    for (const [name] of siteComponents) {
      test(`${name} / ${width} / ${theme} has a complete, stable public preview`, async ({ page }, info) => {
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.setViewportSize({ width, height: 1000 });
        await page.clock.install({ time: new Date("2026-09-29T16:41:00Z") });
        await page.goto(componentHref(name));
        const preview = page.locator(".preview-canvas > .preview-theme");
        await expect(preview).toBeVisible();
        await expect(preview.locator("[data-slot]").first()).toBeAttached();
        if (theme === "dark") {
          const customize = page.getByRole("button", { name: "Customize preview", exact: true });
          if (await customize.isVisible()) await customize.click();
          await page.getByRole("button", { name: "Dark", exact: true }).click();
          if (await customize.isVisible()) await customize.click();
        }
        await holdPreview(page);
        await expect(page.locator(".page-heading-meta")).toHaveText("ComponentsiOS");
        await expect(page.locator(".page-heading p")).not.toBeEmpty();
        const header = preview.locator(".component-preview-header");
        if (await header.count()) {
          await expect(header.locator('[data-slot="ios-status-bar"]')).toBeVisible();
          await expect(header.locator('[data-slot="ios-nav-bar"]')).toBeVisible();
          const geometry = await header.evaluate(element => {
            const status = element.querySelector('[data-slot="ios-status-bar"]')!.getBoundingClientRect();
            const nav = element.querySelector('[data-slot="ios-nav-bar"]')!.getBoundingClientRect();
            const island = element.querySelector('[data-slot="dynamic-island"]')!.getBoundingClientRect();
            return { gap: nav.top - status.bottom, centered: Math.abs((island.left + island.right) / 2 - (status.left + status.right) / 2), contained: island.top >= status.top && island.bottom <= status.bottom };
          });
          expect(Math.abs(geometry.gap)).toBeLessThan(1);
          expect(geometry.centered).toBeLessThan(0.1);
          expect(geometry.contained).toBe(true);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page.getByText("Not affiliated with Apple.", { exact: true })).toHaveCount(0);
        await expect(page.locator(".component-navigation [aria-current=page] svg").first()).toBeAttached();
        expect(await page.locator(".registry-sidebar .component-navigation [aria-current=page] svg").count()).toBe(1);
        const photos = await preview.locator("img").evaluateAll(images => images.map(image => ({ src: (image as HTMLImageElement).src, loaded: (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0 })));
        expect(photos.filter(photo => !photo.loaded)).toEqual([]);
        if (process.env.PREVIEW_CAPTURE_DIR) {
          await preview.screenshot({ path: `${process.env.PREVIEW_CAPTURE_DIR}/${info.project.name}/${name}-${width}-${theme}.png`, animations: "allow" });
        } else await expect(preview).toHaveScreenshot(["registry", `${name}-${width}-${theme}.png`], { animations: "allow" });
        await info.attach("preview", { body: await preview.screenshot({ animations: "allow" }), contentType: "image/png" });
        await page.getByRole("button", { name: "Code", exact: true }).click();
        await expect(page.locator(".playground-code")).not.toContainText("This utility is installed");
        expect(errors).toEqual([]);
      });
    }
  }
}
