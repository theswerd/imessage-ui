import { expect, test } from "@playwright/test";
import { componentHref, siteComponents } from "../../lib/site-catalog";

test("Message UI branding is consistent across the public site and agent setup", async ({ page, request, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-write"]);
  for (const route of ["/", ...siteComponents.map(([name]) => componentHref(name))]) {
    await page.goto(route);
    await expect(page).toHaveTitle(/Message UI/);
    await expect(page.locator("header").getByRole("link", { name: "Message UI home" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\biMessage\b/i, { useInnerText: true });
    await expect(page.locator('[placeholder*="imessage" i], [aria-label*="imessage" i]')).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Copy prompt for your agent", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const onboarding = await (await request.get("/onboard.md")).text();
  expect(onboarding).toContain("name: message-ui");
  expect(onboarding).not.toMatch(/imessage/i);
  const index = await (await request.get("/llms.txt")).text();
  expect(index).toContain("Namespace: @message-ui");
  expect(index).not.toMatch(/imessage/i);
  const icon = await (await request.get("/icon.svg")).text();
  expect(icon).toContain('fill="#007AFF"');
});

test("homepage has a working conversation, agent setup, and routes to the playground", async ({ page, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-write"]);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Message UI,\s*for the web\./);
  await expect(page.locator(".registry-sidebar")).toHaveCount(0);
  await expect(page.locator("header").getByRole("link", { name: "Message UI home" })).toBeVisible();
  await expect(page.locator(".preview-inspector")).toHaveCount(0);
  const agentButton = page.getByRole("button", { name: "Copy prompt for your agent", exact: true });
  await expect(agentButton).toHaveCSS("background-color", "rgb(17, 17, 17)");
  await expect(agentButton.locator(".agent-logo")).toHaveCount(3);
  await expect.poll(() => agentButton.locator("img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const message = page.getByRole("textbox", { name: "Message", exact: true });
  await message.fill("Hello from the homepage");
  await message.press("Enter");
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Hello from the homepage");
  await page.reload();
  await expect(page.getByRole("log", { name: "Messages" })).not.toContainText("Hello from the homepage");
  await page.getByRole("button", { name: "Copy prompt for your agent", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Add to your agent" })).not.toBeVisible();
  await page.getByRole("link", { name: "Explore components" }).click();
  await expect(page).toHaveURL(/\/components$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Messages");
  await expect(page.locator('.registry-sidebar a[aria-current="page"]')).toHaveText("Overview");
  await page.locator(".registry-sidebar").getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Explore components" })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`homepage inbox keeps chats, avatars, links, and sends working / ${theme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(value => localStorage.setItem("theme", value), theme);
    await page.goto("/");
    const app = page.locator('.home-preview [data-slot="ios-messages-app"]');
    const back = app.getByRole("button", { name: "Back", exact: true });
    const log = app.getByRole("log", { name: "Messages", exact: true });
    await expect(log).toContainText("Wait. You went outside?");
    await back.click();
    const freestyle = app.getByRole("button", { name: /Freestyle guy, 9:40 AM/ });
    await expect(freestyle).toBeVisible();
    await expect.poll(() => freestyle.locator("img").evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect(app.locator('[data-slot="screen-list"]')).toHaveCSS("transform", "none");
    await app.screenshot({ path: `artifacts/home-inbox/${info.project.name}-${theme}-list.png` });
    await freestyle.click();
    await expect(log).toContainText("I need more VMs.");
    await expect(log).toContainText("Yes.");
    const link = log.getByRole("link", { name: /More VMs\? Right this way/ });
    await expect(link).toHaveAttribute("href", "https://www.freestyle.sh/");
    const previewImage = link.locator('[data-slot="media"] img');
    await expect(previewImage).toHaveAttribute("src", "/showcase/freestyle-og.png");
    await expect.poll(() => previewImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const imageBounds = await previewImage.boundingBox();
    const titleBounds = await link.locator('[data-slot="title"]').boundingBox();
    expect(imageBounds!.height).toBeGreaterThan(0);
    expect(imageBounds!.y + imageBounds!.height).toBeLessThanOrEqual(titleBounds!.y);
    await expect(app.locator('[data-slot="ios-nav-bar"] img')).toHaveAttribute("src", "/showcase/freestyle.png");
    await app.getByRole("button", { name: "Freestyle guy, details" }).click();
    const details = app.getByRole("dialog");
    await expect(details.locator('[data-slot="avatar"] img').last()).toHaveAttribute("src", "/showcase/freestyle.png");
    await details.getByRole("button", { name: "Back", exact: true }).click();
    await expect(details).toHaveCount(0);
    await app.screenshot({ path: `artifacts/home-inbox/${info.project.name}-${theme}-freestyle.png` });
    const draft = app.getByRole("textbox", { name: "Message", exact: true });
    await draft.fill("Make that 100 VMs.");
    await draft.press("Enter");
    await expect(log).toContainText("Make that 100 VMs.");
    await expect(draft).toHaveValue("");
    await back.click();
    await app.getByRole("button", { name: /Jamie Lee,/ }).click();
    await expect(log).not.toContainText("Make that 100 VMs.");
    await expect(log).toContainText("Briefly. The Wi-Fi was terrible.");
    await back.click();
    await app.getByRole("button", { name: "Search", exact: true }).click();
    await app.getByRole("searchbox").fill("Freestyle");
    const result = app.getByRole("button", { name: /Freestyle guy,/ });
    await expect(result.locator("img")).toHaveAttribute("src", "/showcase/freestyle.png");
    await result.click();
    await expect(log).toContainText("Make that 100 VMs.");
    await page.reload();
    await expect(log).toContainText("Wait. You went outside?");
    await back.click();
    await app.getByRole("button", { name: /Freestyle guy,/ }).click();
    await expect(log).not.toContainText("Make that 100 VMs.");
  });
}

test("homepage inbox can start a new conversation", async ({ page }) => {
  await page.goto("/");
  const preview = page.locator(".home-preview");
  await preview.getByRole("button", { name: "Back", exact: true }).click();
  await preview.getByRole("button", { name: "New message", exact: true }).click();
  const sheet = preview.getByRole("dialog", { name: "New Message", exact: true });
  await sheet.getByRole("textbox", { name: "To:", exact: true }).fill("Pizza hotline");
  await sheet.getByRole("textbox", { name: "Message", exact: true }).fill("One emergency pizza please.");
  await sheet.getByRole("button", { name: "Send message" }).click();
  await expect(preview.getByRole("log")).toContainText("One emergency pizza please.");
  await preview.getByRole("button", { name: "Back", exact: true }).click();
  await expect(preview.getByRole("button", { name: /Pizza hotline,/ })).toBeVisible();
});

for (const width of [402, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`homepage / ${width} / ${theme}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(value => localStorage.setItem("theme", value), theme);
    await page.goto("/");
    await expect.poll(() => page.locator('[data-slot="ios-messages-app"]').evaluate(el => getComputedStyle(el).getPropertyValue("--im-bg").trim())).toBe(theme === "dark" ? "#000000" : "#ffffff");
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>(".home-preview img, .agent-logos img")).map(img => img.decode()));
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const frame = await page.locator(".phone-frame").boundingBox();
    expect(frame!.height / frame!.width).toBeCloseTo(874 / 402, 1);
    await expect(page.getByRole("button", { name: "Copy prompt for your agent", exact: true })).toBeInViewport();
    if (width > 720) await expect(page.locator('.home-preview [data-slot="ios-composer"]')).toBeInViewport();
    await page.screenshot({ path: `artifacts/homepage/${info.project.name}-${width}-${theme}.png`, fullPage: true, animations: "disabled" });
    expect(errors).toEqual([]);
  });
}
