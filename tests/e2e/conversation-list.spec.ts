import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 1000 });
  await page.goto("/components/ios-conversation-list");
});

test("opening a conversation clears unread and keeps replies in the correct thread", async ({ page }) => {
  const demo = page.locator('[data-slot="conversation-list-demo"]');
  await demo.getByRole("button", { name: /^Unread\. Jamie Lee,/ }).click();
  await expect(demo.getByRole("log", { name: "Messages" })).toContainText("The Dolomites. Italy");
  await demo.getByRole("textbox", { name: "Message", exact: true }).fill("Let’s book the cabin.");
  await demo.getByRole("button", { name: "Send message", exact: true }).click();
  await demo.getByRole("button", { name: "Back", exact: true }).click();
  await expect(demo.locator('[data-slot="ios-conversation-row"]').first()).toHaveAccessibleName(/^Jamie Lee,.*Let’s book the cabin/);
  await demo.getByRole("button", { name: /^Alex Morgan,/ }).click();
  await expect(demo.getByRole("log", { name: "Messages" })).not.toContainText("Let’s book the cabin.");
  await demo.getByRole("button", { name: "Back", exact: true }).click();
  await demo.getByRole("button", { name: /^Jamie Lee,/ }).click();
  await expect(demo.getByRole("log", { name: "Messages" })).toContainText("Let’s book the cabin.");
});

test("search matches names and previews, opens results, and handles no results", async ({ page }) => {
  const demo = page.locator('[data-slot="conversation-list-demo"]');
  await demo.getByRole("button", { name: "Search", exact: true }).click();
  const search = demo.getByRole("searchbox");
  await search.fill("a");
  await expect(demo.getByRole("button", { name: /Morgan Chen/ })).toBeVisible();
  await search.fill("COFFEE");
  await expect(demo.getByRole("button", { name: /^Unread\. Jamie Lee,/ })).toHaveCount(0);
  await demo.getByRole("button", { name: /Weekend plans/ }).click();
  await expect(demo.getByRole("log", { name: "Messages" })).toContainText("I’ll bring the coffee");
  await demo.getByRole("button", { name: "Back", exact: true }).click();
  await demo.getByRole("button", { name: "Search", exact: true }).click();
  await search.fill("nothing-matches-this");
  await expect(demo.getByText("No Results", { exact: true })).toBeVisible();
  await search.press("Escape");
  await expect(demo.locator('[data-slot="ios-search"]')).toHaveCount(0);
  await expect(demo.locator('[data-slot="ios-conversation-row"]')).toHaveCount(6);
});

test("compose creates a conversation and updates an existing recipient without duplicates", async ({ page }) => {
  const demo = page.locator('[data-slot="conversation-list-demo"]');
  for (const name of ["Riley Brooks", "Jamie Lee"]) {
    await demo.getByRole("button", { name: "New message", exact: true }).click();
    const sheet = demo.getByRole("dialog", { name: "New Message", exact: true });
    await expect(sheet.getByRole("textbox", { name: "Message", exact: true })).toBeDisabled();
    await sheet.getByRole("textbox", { name: "To:", exact: true }).fill(name);
    await sheet.getByRole("textbox", { name: "Message", exact: true }).fill(`Hello ${name}`);
    await sheet.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(demo.getByRole("log", { name: "Messages" })).toContainText(`Hello ${name}`);
    await demo.getByRole("button", { name: "Back", exact: true }).click();
    await expect(demo.locator('[data-slot="ios-conversation-row"]').filter({ hasText: name })).toHaveCount(1);
    await expect(demo.locator('[data-slot="ios-conversation-row"]').first()).toContainText(name);
  }
});

test("list configuration changes groups, unread, row count and appearance; reset restores them", async ({ page }) => {
  const demo = page.locator('[data-slot="conversation-list-demo"]');
  const customize = page.getByRole("button", { name: "Customize preview", exact: true });
  await customize.click();
  await page.getByLabel("Unread indicators", { exact: true }).uncheck();
  await expect(demo.locator('[data-slot="unread"]')).toHaveCount(0);
  await page.getByLabel("Group conversations", { exact: true }).uncheck();
  await expect(demo.getByRole("button", { name: /Weekend plans/ })).toHaveCount(0);
  await page.getByLabel("Conversation count", { exact: true }).selectOption("3");
  await expect(demo.locator('[data-slot="ios-conversation-row"]')).toHaveCount(3);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(demo.locator('[data-slot="ios-conversation-list"]')).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await customize.click();
  const first = demo.locator('[data-slot="ios-conversation-row"]').first();
  await first.focus(); await first.press("Enter");
  await expect(demo.getByRole("log", { name: "Messages" })).toBeVisible();
  await page.getByRole("button", { name: "Reset preview", exact: true }).click();
  await expect(demo.locator('[data-slot="ios-conversation-row"]')).toHaveCount(6);
  await expect(demo.locator('[data-slot="unread"]')).toHaveCount(2);
  await expect(demo.locator('[data-slot="ios-conversation-list"]')).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("recipient focus keeps the composer inside a shortened and panned viewport", async ({ page }) => {
  const demo = page.locator('[data-slot="conversation-list-demo"]');
  await demo.getByRole("button", { name: "New message", exact: true }).click();
  await demo.getByRole("textbox", { name: "To:", exact: true }).fill("Riley Brooks");
  await page.setViewportSize({ width: 402, height: 560 });
  await page.evaluate(() => {
    // Reproduce Safari panning the visual viewport upward while its keyboard is open.
    Object.defineProperty(visualViewport, "offsetTop", { configurable: true, get: () => 320 });
    visualViewport!.dispatchEvent(new Event("scroll"));
  });
  const field = demo.getByRole("textbox", { name: "Message", exact: true });
  await expect.poll(() => field.evaluate(element => element.getBoundingClientRect().bottom <= (visualViewport?.height ?? innerHeight))).toBe(true);
  const blur = await demo.getByRole("textbox", { name: "To:", exact: true }).evaluate(element => {
    const preview = element.closest(".conversation-demo")!;
    const before = preview.getBoundingClientRect().height;
    (element as HTMLInputElement).blur();
    visualViewport!.dispatchEvent(new Event("resize"));
    return { before, after: preview.getBoundingClientRect().height };
  });
  expect(blur.after).toBe(blur.before);
  await field.click();
  await expect(field).toBeFocused();
  await field.fill("The keyboard fits.");
  await demo.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(demo.getByRole("log", { name: "Messages" })).toContainText("The keyboard fits.");
});

for (const theme of ["light", "dark"]) {
  test(`chat navigation animates both layers and retains the departing thread / ${theme}`, async ({ page }, info) => {
    if (theme === "dark") {
      await page.getByRole("button", { name: "Customize preview" }).click();
      await page.getByRole("button", { name: "Dark", exact: true }).click();
      await page.getByRole("button", { name: "Customize preview" }).click();
    }
    const demo = page.locator('[data-slot="conversation-list-demo"]');
    const app = demo.locator('[data-slot="ios-messages-app"]');
    // Freeze the actual click-triggered timelines, rather than supplying a fake transition prop.
    await page.evaluate(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const animation = animate.apply(this, args);
        if (["screen-list", "screen-conversation", "screen-dim"].includes(this.getAttribute("data-slot") ?? "")) {
          animation.pause(); animation.currentTime = 0;
        }
        return animation;
      };
    });
    await expect(app).toHaveCount(1);
    await app.evaluate(element => element.setAttribute("data-navigation-instance", "retained"));
    await demo.getByRole("button", { name: /^Unread\. Jamie Lee,/ }).click();
    await expect(app).toHaveAttribute("data-navigation-instance", "retained");
    for (const direction of ["push", "pop"]) {
      if (direction === "pop") await demo.getByRole("button", { name: "Back", exact: true }).click();
      await expect(app).toHaveAttribute("data-transition", direction);
      const layers = app.locator('[data-slot="screen-list"], [data-slot="screen-conversation"]');
      await expect(layers).toHaveCount(2);
      await expect(app.locator('[data-slot="screen-conversation"]')).toContainText("The Dolomites. Italy");
      await expect(app.locator('[data-slot="screen-conversation"]')).toHaveCSS("background-color", theme === "dark" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
      const duration = direction === "push" ? 350 : 320;
      for (const time of [0, 90, duration]) {
        const positions = await layers.evaluateAll((nodes, time) => nodes.map(element => {
          for (const animation of element.getAnimations({ subtree: true })) {
            animation.currentTime = time;
          }
          return new DOMMatrixReadOnly(getComputedStyle(element).transform).m41 / element.clientWidth;
        }), time);
        if (time === 0 || time === duration) {
          const pushed = direction === "push" ? time === duration : time === 0;
          expect(positions[0]).toBeCloseTo(pushed ? -0.3 : 0, 3);
          expect(positions[1]).toBeCloseTo(pushed ? 0 : 1, 3);
        } else {
          expect(positions[0]).toBeGreaterThan(-0.3);
          expect(positions[0]).toBeLessThan(0);
          expect(positions[1]).toBeGreaterThan(0);
          expect(positions[1]).toBeLessThan(1);
        }
        await demo.screenshot({ path: info.outputPath(`${direction}-${time}.png`), animations: "allow" });
      }
      const departing = app.locator(`[data-slot="screen-${direction === "push" ? "list" : "conversation"}"]`);
      await expect(departing).toHaveAttribute("inert", "");
      await app.evaluate(element => element.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
      await expect(app).not.toHaveAttribute("data-transition");
      await expect(departing).toHaveCount(0);
    }
    await expect(demo.getByRole("button", { name: /^Jamie Lee,/ })).toBeVisible();
  });
}

test("reduced motion goes straight to the chat and back without leaving inactive layers", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const demo = page.locator('[data-slot="conversation-list-demo"]');
  const app = demo.locator('[data-slot="ios-messages-app"]');
  await demo.getByRole("button", { name: /^Unread\. Jamie Lee,/ }).click();
  await expect(app).not.toHaveAttribute("data-transition");
  await expect(app.locator('[data-slot="screen-list"]')).toHaveCount(0);
  await expect(demo.getByRole("log", { name: "Messages" })).toBeVisible();
  await demo.getByRole("button", { name: "Back", exact: true }).click();
  await expect(app).not.toHaveAttribute("data-transition");
  await expect(app.locator('[data-slot="screen-conversation"]')).toHaveCount(0);
  await expect(demo.getByRole("button", { name: /^Jamie Lee,/ })).toBeVisible();
});
