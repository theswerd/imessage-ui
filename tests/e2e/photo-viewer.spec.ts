import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { openScene } from "./helpers";

async function finishMotion(page: Page) {
  await page.evaluate(() => document.getAnimations().forEach(animation => {
    if (animation.playState === "running" && Number.isFinite(Number(animation.effect?.getTiming().duration))) animation.finish();
  }));
}

async function slowRelease(page: Page, x: number, y: number, cancel = false) {
  // Hold the last coordinate to remove flick velocity, so this tests travel rather than CPU speed.
  await page.locator('[data-slot="viewer-stage"]').dispatchEvent("pointermove", { pointerId: 1, pointerType: "mouse", clientX: x, clientY: y });
  if (cancel) await page.locator('[data-slot="viewer-stage"]').dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse", clientX: x, clientY: y });
  await page.mouse.up();
  await finishMotion(page);
}

test("viewer preserves captured native fit and control geometry", async ({ page }) => {
  await page.goto("/lab/photoviewer?scene=fit");
  const photo = page.locator('[data-slot="viewer-photo"]');
  await expect.poll(() => photo.boundingBox()).toEqual({ x: 0, y: 169, width: 402, height: 536 });
  await page.goto("/lab/photoviewer?scene=chrome");
  await expect.poll(() => page.locator('[data-slot="viewer-close"]').boundingBox()).toEqual({ x: 342, y: 62, width: 44, height: 44 });
  await expect.poll(() => page.locator('[data-slot="viewer-reply"]').boundingBox()).toEqual({ x: 28, y: 798, width: 48, height: 48 });
  await expect.poll(() => page.locator('[data-slot="viewer-share"]').boundingBox()).toEqual({ x: 326, y: 798, width: 48, height: 48 });
});

for (const theme of ["light", "dark"]) {
  test(`${theme}: viewer checkpoints replay identical opening, paging and dismissal frames`, async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("ios"), "native photo-viewer harness targets iOS");
    for (const [scene, time] of [["photo-viewer", 60], ["photo-viewer", 120], ["photo-viewer-page", 150], ["photo-viewer-dismiss", 200], ["photo-viewer-dismiss", 300]] as const) {
      const device = await openScene(page, info, scene, time, theme);
      if (scene === "photo-viewer-page") {
        const transform = await page.locator('[data-slot="viewer-track"]').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41);
        expect(transform).toBe(-663); // 1.5 pages at the native 402 + 40pt pitch.
      }
      await expect(page.locator('[data-slot="photo-tile"][data-state="loading"]')).toHaveCount(0);
      await finishMotion(page);
      // The harness's decorative rounded device mask has compositor-dependent edge alpha.
      // Compare every content pixel with a square harness; the normal visual suite keeps the mask.
      await device.evaluate(el => { el.style.borderRadius = "0"; });
      const first = await device.screenshot({ path: info.outputPath(`${scene}-${time}-first.png`), animations: "allow" });
      await openScene(page, info, scene, time, theme);
      await expect(page.locator('[data-slot="photo-tile"][data-state="loading"]')).toHaveCount(0);
      await finishMotion(page);
      await device.evaluate(el => { el.style.borderRadius = "0"; });
      const second = await device.screenshot({ path: info.outputPath(`${scene}-${time}-replayed.png`), animations: "allow" });
      await info.attach(`${scene}-${time}-first`, { body: first, contentType: "image/png" });
      await info.attach(`${scene}-${time}-replayed`, { body: second, contentType: "image/png" });
      expect(PNG.sync.read(second).data.equals(PNG.sync.read(first).data), `${scene} at ${time} ms must render the same pixels after a fresh navigation`).toBe(true);
    }
  });
}

for (const scale of [1, 0.6]) {
  test(`viewer gestures use local coordinates at ${scale} scale and cancellation never commits`, async ({ page }) => {
    await page.goto("/lab/photoviewer?scene=live");
    await page.locator('[data-slot="viewer-lab"]').evaluate((el, scale) => { el.style.transform = `scale(${scale})`; el.style.transformOrigin = "top left"; }, scale);
    await finishMotion(page);
    const viewer = page.locator('[data-slot="image-viewer"]');
    const stage = page.locator('[data-slot="viewer-stage"]');
    const bounds = (await viewer.boundingBox())!;
    const start = { x: bounds.x + 300 * scale, y: bounds.y + 437 * scale };
    const end = { x: start.x - 180 * scale, y: start.y };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await slowRelease(page, end.x, end.y, true);
    await expect(stage).toHaveAttribute("aria-label", "Photo, attachment 2 of 5");
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await slowRelease(page, end.x, end.y);
    await expect(stage).toHaveAttribute("aria-label", "Photo, attachment 3 of 5");
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + 160 * scale);
    await slowRelease(page, start.x, start.y + 160 * scale, true);
    await expect(viewer).toBeVisible();
    await expect(stage).toHaveAttribute("aria-label", "Photo, attachment 3 of 5");
    await page.mouse.dblclick(bounds.x + 201 * scale, bounds.y + 437 * scale);
    await finishMotion(page);
    await expect.poll(() => page.locator('[data-slot="viewer-page"][data-index="2"] [data-slot="viewer-photo"]').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)).toBe(2.5);
  });
}

test("registry photo viewer fills its phone, pages, saves the current image and closes", async ({ page }) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/components/image-viewer");
    await finishMotion(page);
    const viewer = page.locator('[data-slot="image-viewer"]');
    const shell = page.locator('[data-slot="ios-messages-app"]');
    await expect(viewer).toBeVisible();
    await expect.poll(async () => {
      const a = (await viewer.boundingBox())!; const b = (await shell.boundingBox())!;
      return Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y), Math.abs(a.width-b.width), Math.abs(a.height-b.height));
    }).toBeLessThan(1);
    await expect.poll(() => viewer.evaluate(el => [el.clientWidth, el.clientHeight])).toEqual([402, 874]);
    await expect(page.locator('[data-slot="viewer-stage"]')).toHaveAttribute("aria-label", "Photo, attachment 1 of 3");
    await viewer.press("ArrowRight");
    await finishMotion(page);
    await expect(page.locator('[data-slot="viewer-stage"]')).toHaveAttribute("aria-label", "Photo, attachment 2 of 3");
    const [download] = await Promise.all([page.waitForEvent("download"), viewer.getByRole("button", { name: "Save photo", exact: true }).click()]);
    expect(download.suggestedFilename()).toBe("cabin.jpg");
    await viewer.press("Escape");
    await finishMotion(page);
    await expect(viewer).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});


test("an open viewer completely covers transcript reactions and blocks background input", async ({ page }, info) => {
  await page.goto("/components");
  const reaction = page.locator('[data-message-id="intro-3"] [data-slot="reactions"]');
  await expect(reaction).toBeVisible();
  await page.locator('[data-message-id="intro-photo"] img[data-tile]').click();
  await finishMotion(page);
  const viewer = page.locator('[data-slot="image-viewer"]');
  await expect(viewer).toBeVisible();
  await expect(page.locator('[data-slot="screen-conversation"]')).toHaveAttribute("inert", "");
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Love tapback, from you", exact: true })).toHaveCount(0);
  const covered = await viewer.screenshot({ animations: "disabled" });
  await reaction.evaluate(el => { el.style.visibility = "hidden"; });
  const removed = await viewer.screenshot({ animations: "disabled" });
  expect(PNG.sync.read(covered).data.equals(PNG.sync.read(removed).data), "covered reactions must contribute zero pixels to the viewer").toBe(true);
  await info.attach("viewer-over-transcript-reaction", { body: covered, contentType: "image/png" });
  await reaction.evaluate(el => { el.style.visibility = ""; });
  await viewer.press("Escape");
  await finishMotion(page);
  await expect(viewer).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Love tapback, from you", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeEditable();
});

test("keyboard navigation reveals hidden viewer controls and stays in the modal", async ({ page }) => {
  await page.clock.install();
  await page.goto("/components/image-viewer");
  await finishMotion(page);
  await page.clock.fastForward(3100);
  const viewer = page.locator('[data-slot="image-viewer"]');
  const header = page.locator('[data-slot="viewer-header"]');
  await finishMotion(page);
  await expect(header).toHaveCSS("opacity", "0");
  await viewer.press("Tab");
  await finishMotion(page);
  await expect(header).toHaveCSS("opacity", "1");
  await expect(viewer.getByRole("button", { name: "close", exact: true })).toBeFocused();
  await page.clock.fastForward(3100);
  await finishMotion(page);
  await expect(header).toHaveCSS("opacity", "1");
  await page.keyboard.press("Shift+Tab");
  await expect(viewer.getByRole("button", { name: "Share", exact: true })).toBeFocused();
});


test("Safari coalesced double taps zoom once, and zoomed photo edges can zoom back out", async ({ page }) => {
  await page.goto("/lab/photoviewer?scene=live");
  await finishMotion(page);
  const stage = page.locator('[data-slot="viewer-stage"]');
  const photo = page.locator('[data-index="1"] [data-slot="viewer-photo"]');
  const point = { clientX: 201, clientY: 437 };
  // The real simulator emits one touch pointer pair followed by dblclick for this gesture.
  await page.touchscreen.tap(point.clientX, point.clientY);
  await stage.evaluate((el, point) => {
    const event = new MouseEvent("dblclick", { ...point, bubbles: true, button: 0, detail: 2 });
    Object.defineProperty(event, "timeStamp", { value: 10000 });
    el.dispatchEvent(event);
  }, point);
  await finishMotion(page);
  await expect.poll(() => photo.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)).toBe(2.5);
  // At zoom this point is on the photo, but outside its original fitted rectangle (y = 169).
  await stage.evaluate(el => {
    const event = new MouseEvent("dblclick", { clientX: 201, clientY: 140, bubbles: true, button: 0, detail: 2 });
    Object.defineProperty(event, "timeStamp", { value: 10350 });
    el.dispatchEvent(event);
  });
  await finishMotion(page);
  await expect.poll(() => photo.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)).toBe(1);
});
