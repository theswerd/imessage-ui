import { expect, test, type Page } from "@playwright/test";

async function holdSends(page: Page) {
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      const duration = animation.effect?.getTiming().duration;
      if (duration === 690 && (this.closest('[data-slot="send-ghost"], [data-slot="send-clone"]') || this.getAttribute("data-slot") === "message-bubble")) {
        animation.pause();
        animation.currentTime = 0;
      }
      return animation;
    };
  });
}

async function seekSend(page: Page, time: number) {
  await page.evaluate(ms => {
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getTiming().duration === 690) animation.currentTime = ms;
    }
  }, time);
}

async function finishSend(page: Page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getTiming().duration === 690) animation.finish();
    }
  });
  await expect(page.locator('[data-slot="send-clone"], [data-slot="send-ghost"]')).toHaveCount(0);
}

const routes = ["/", "/components", "/components/ios-composer", "/components/ios-conversation-list", "/components/ios-details", "/components/image-viewer"];
for (const route of routes) {
  test(`a real send flies from the composer and lands in its slot: ${route}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 402, height: 1000 });
    await page.goto(route);
    const app = page.locator('[data-slot="ios-messages-app"]');
    if (route.endsWith("ios-conversation-list")) await app.getByRole("button", { name: /^Unread\. Jamie Lee,/ }).click();
    if (route.endsWith("ios-details")) {
      await app.getByRole("dialog").getByRole("button", { name: "Back", exact: true }).click();
      await expect(app.getByRole("dialog")).toHaveCount(0);
    }
    if (route.endsWith("image-viewer")) await app.getByRole("button", { name: "close", exact: true }).click();
    await expect(app.locator('[data-slot="ios-composer"]')).toBeVisible();
    await expect(app.locator('[data-slot="screen-conversation"]')).toHaveCSS("transform", "none");
    await holdSends(page);
    const field = app.getByRole("textbox", { name: "Message", exact: true });
    await field.fill("Watch this message fly.");
    await field.press("Enter");
    const clone = app.locator('[data-slot="send-clone"]');
    const ghost = app.locator('[data-slot="send-ghost"]');
    await expect(clone).toHaveCount(1);
    await expect(ghost).toHaveCount(1);
    await expect(field).toHaveValue("");
    const bubble = app.locator('[data-slot="message-list"] [data-slot="message-bubble"]').last();
    await expect(bubble).toHaveCSS("opacity", "0");

    await seekSend(page, 15);
    const start = await ghost.boundingBox();
    const composer = await app.locator('[data-slot="field"]').boundingBox();
    expect(Math.abs(start!.x - composer!.x)).toBeLessThan(1);
    expect(Math.abs(start!.width - composer!.width)).toBeLessThan(1);

    await seekSend(page, 233);
    await expect(clone).toHaveCSS("opacity", "1");
    const flying = await clone.locator('[data-slot="bubble"]').boundingBox();
    const landing = await bubble.locator('[data-slot="bubble"]').boundingBox();
    expect(flying!.y).toBeGreaterThan(landing!.y + 3);
    expect(flying!.y).toBeLessThan(composer!.y);
    await app.screenshot({ path: `artifacts/send-animation/${info.project.name}-${route.split("/").pop() || "home"}-233.png`, animations: "allow" });

    await seekSend(page, 689);
    const final = await clone.locator('[data-slot="bubble"]').boundingBox();
    for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(final![key] - landing![key]), key).toBeLessThan(1);
    await finishSend(page);
    await expect(bubble).toHaveCSS("opacity", "1");
    // A second send must create a new flight after cleanup, including multi-line input.
    await field.fill("One more message.\nStill flying.");
    await app.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(clone).toHaveCount(1);
    await seekSend(page, 689);
    const secondReal = await app.locator('[data-slot="message-list"] [data-slot="message-bubble"]').last().locator('[data-slot="bubble"]').boundingBox();
    const secondClone = await clone.locator('[data-slot="bubble"]').boundingBox();
    expect(Math.abs(secondClone!.y - secondReal!.y)).toBeLessThan(1);
    await finishSend(page);
  });
}

test("new conversations animate their first send but opening existing history does not", async ({ page }) => {
  await page.goto("/components/ios-conversation-list");
  await holdSends(page);
  const app = page.locator('[data-slot="ios-messages-app"]');
  await app.getByRole("button", { name: "New message", exact: true }).click();
  await page.getByRole("textbox", { name: "To:", exact: true }).fill("Riley Brooks");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("First message");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(app.locator('[data-slot="send-clone"]')).toHaveCount(1);
  await expect(app.locator('[data-slot="screen-conversation"]')).toHaveCSS("transform", "none");
  await seekSend(page, 689);
  const positions = await app.evaluate(root => {
    const a = root.querySelector('[data-slot="message-list"] [data-slot="bubble"]')!.getBoundingClientRect();
    const b = root.querySelector('[data-slot="send-clone"] [data-slot="bubble"]')!.getBoundingClientRect();
    return { dx: a.x - b.x, dy: a.y - b.y };
  });
  expect(Math.abs(positions.dx)).toBeLessThan(1);
  expect(Math.abs(positions.dy)).toBeLessThan(1);
  await finishSend(page);
  await app.getByRole("button", { name: "Back", exact: true }).click();
  await app.getByRole("button", { name: /^Riley Brooks,/ }).click();
  await expect(app.locator('[data-slot="screen-conversation"]')).toHaveCSS("transform", "none");
  await expect(app.locator('[data-slot="send-clone"]')).toHaveCount(0);
});

test("reduced motion sends settle without a flying copy", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("A calmer send");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator('[data-slot="send-clone"], [data-slot="send-ghost"]')).toHaveCount(0);
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("A calmer send");
  await expect(page.locator('[data-slot="message-list"] [data-slot="message-bubble"]').last()).toHaveCSS("opacity", "1");
});

test("overflow and rapid sends cancel old copies and land at the visible end of the transcript", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 740 });
  await page.goto("/components/ios-composer");
  await holdSends(page);
  const field = page.getByRole("textbox", { name: "Message", exact: true });
  for (let i = 0; i < 6; i++) {
    await field.fill(`${i}: A longer message that wraps across several lines in this small conversation preview. We should always land next to the composer.`);
    await field.press("Enter");
    await expect(page.locator('[data-slot="send-clone"]')).toHaveCount(1);
    await seekSend(page, 233);
  }
  await seekSend(page, 689);
  const positions = await page.locator('[data-slot="screen-conversation"]').evaluate(root => {
    const log = root.querySelector('[data-slot="message-list"]')!;
    const body = log.querySelectorAll('[data-slot="bubble"]');
    const real = body[body.length - 1].getBoundingClientRect();
    const clone = root.querySelector('[data-slot="send-clone"] [data-slot="bubble"]')!.getBoundingClientRect();
    const field = root.querySelector('[data-slot="field"]')!.getBoundingClientRect();
    return { overflow: log.scrollHeight > log.clientHeight, dx: clone.x - real.x, dy: clone.y - real.y, visible: real.bottom <= field.top };
  });
  expect(positions.overflow).toBe(true);
  expect(positions.visible).toBe(true);
  expect(Math.abs(positions.dx)).toBeLessThan(1);
  expect(Math.abs(positions.dy)).toBeLessThan(1);
  await finishSend(page);
});
