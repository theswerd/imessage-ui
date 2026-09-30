import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

async function openInspector(page: import("@playwright/test").Page) {
  const toggle = page.getByRole("button", { name: "Customize preview", exact: true });
  if (await toggle.isVisible()) await toggle.click();
}

test("the registry fits phones and desktop, with a component sidebar", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [320, 402, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Message UI,\s*for the web\./);
    await expect(page.getByRole("button", { name: "Copy prompt for your agent", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("link", { name: "Docs", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Lab", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Explore components" }).click();
    if (width <= 720) {
      await page.getByRole("button", { name: "Open components" }).click();
      await page.getByRole("dialog", { name: "Component navigation" }).getByRole("link", { name: "Photos", exact: true }).click();
    } else await page.locator(".registry-sidebar").getByRole("link", { name: "Photos", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Photos");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("the conversation sends and resets", async ({ page }) => {
  await page.goto("/components");
  const demo = page.locator(".conversation-demo");
  const field = demo.getByRole("textbox", { name: "Message", exact: true });
  await field.fill("Hello from the registry");
  await field.press("Enter");
  await expect(demo.getByRole("log", { name: "Messages" })).toContainText("Hello from the registry");
  await expect(field).toHaveValue("");
  await page.getByRole("button", { name: "Reset preview" }).click();
  await expect(demo.getByRole("log", { name: "Messages" })).not.toContainText("Hello from the registry");
});

test("palette controls affect the component and exported configuration", async ({ page }) => {
  await page.goto("/components/message-bubble");
  await openInspector(page);
  await page.getByRole("button", { name: "Iris color preset" }).click();
  const stage = page.locator(".component-stage");
  await expect.poll(() => stage.evaluate(el => getComputedStyle(el).getPropertyValue("--im-blue-top"))).toBe("#7c59d9");
  await page.getByRole("textbox", { name: "Message text" }).fill("My actual message");
  await expect(stage).toContainText("My actual message");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect.poll(() => stage.evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(0, 0, 0)");
  await page.getByLabel("Outgoing color", { exact: true }).fill("#ffff00");
  await expect.poll(() => stage.evaluate(el => getComputedStyle(el).getPropertyValue("--im-outgoing-text"))).toBe("#000000");
  await page.getByRole("button", { name: "Get the code" }).click();
  await expect(page.locator(".playground-code")).toContainText('"--im-blue-top": "#ffff00"');
  await expect(page.locator(".playground-code")).toContainText("My actual message");
  await expect(page.locator(".playground-code")).not.toContainText("@/registry/");
  await expect(page.locator(".playground-code")).not.toContainText("MacHeader");
});

test("typing animation is controlled from Customize without message colors", async ({ page }) => {
  for (const width of [1440, 402]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/components/typing-indicator");
    await openInspector(page);
    const inspector = page.locator(".preview-inspector");
    const preview = page.locator(".preview-canvas");
    const dots = preview.locator("[data-dot]");
    const states = () => dots.evaluateAll(elements => elements.flatMap(el => el.getAnimations().map(animation => animation.playState)));
    const messages = preview.locator('.typing-messages [data-slot="message-bubble"]');
    await expect(messages).toHaveText(["Contact: Oh my god.", "Contact: Dad just called"]);
    await expect(messages.locator('[data-slot="bubble"]')).toHaveCount(2);
    expect(await messages.evaluateAll(elements => elements.every(el => el.getAttribute("data-direction") === "incoming"))).toBe(true);
    const geometry = await preview.evaluate(element => {
      const stage = element.querySelector(".component-stage")!.getBoundingClientRect();
      const content = element.querySelector(".component-stage-content")!.getBoundingClientRect();
      const bubbles = Array.from(element.querySelectorAll('.typing-messages [data-slot="bubble"]')).map(el => el.getBoundingClientRect());
      const typing = element.querySelector('[data-slot="typing-indicator"]')!.getBoundingClientRect();
      const scale = stage.width / (element.querySelector(".component-stage") as HTMLElement).offsetWidth;
      return { inset: (typing.left - stage.left) / scale, firstTop: (bubbles[0].top - content.top) / scale,
        aligned: bubbles.every(bubble => Math.abs(bubble.left - typing.left) < 1), ordered: bubbles[0].bottom < bubbles[1].top && bubbles[1].bottom < typing.top };
    });
    expect(geometry.inset).toBeCloseTo(16, 0);
    expect(geometry.firstTop).toBeCloseTo(24, 0);
    expect(geometry.aligned).toBe(true);
    expect(geometry.ordered).toBe(true);
    await expect(dots).toHaveCount(3);
    await expect.poll(states).toEqual(["running", "running", "running"]);
    await expect(inspector.locator('input[type="color"], .color-presets')).toHaveCount(0);
    await expect(inspector).not.toContainText("Bubble color");
    await expect(preview.getByRole("button", { name: /animation/ })).toHaveCount(0);
    await inspector.getByRole("button", { name: "Pause animation", exact: true }).click();
    await expect.poll(states).toEqual(["paused", "paused", "paused"]);
    await inspector.getByRole("button", { name: "Dark", exact: true }).click();
    await expect.poll(states).toEqual(["paused", "paused", "paused"]);
    await inspector.getByRole("button", { name: "Play animation", exact: true }).click();
    await expect.poll(states).toEqual(["running", "running", "running"]);
    await inspector.getByRole("button", { name: "Pause animation", exact: true }).click();
    await page.getByRole("button", { name: "Reset preview", exact: true }).click();
    await expect(inspector.getByRole("button", { name: "Pause animation", exact: true })).toBeVisible();
    await expect.poll(states).toEqual(["running", "running", "running"]);
  }
});

test("light and dark previews remain isolated from the site theme", async ({ page }) => {
  await page.goto("/components");
  await page.getByRole("button", { name: "Toggle site appearance" }).click();
  const shell = page.locator('.phone-content [data-slot="ios-messages-app"]');
  const background = () => shell.evaluate(el => getComputedStyle(el).getPropertyValue("--im-bg").trim());
  await expect.poll(background).toBe("#ffffff");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect.poll(background).toBe("#000000");
});

test("command search opens on demand, navigates by keyboard, and restores focus", async ({ page }) => {
  await page.goto("/components");
  const trigger = page.getByRole("button", { name: "Search components", exact: true });
  const dialog = page.getByRole("dialog", { name: "Search components" });
  await expect(page.locator(".registry-sidebar input")).toHaveCount(0);
  await trigger.focus();
  await page.keyboard.press("Meta+k");
  const search = dialog.getByRole("combobox");
  await expect(search).toBeFocused();
  await search.fill("typing");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await expect(dialog.getByRole("option", { name: "Typing indicator", exact: true })).toHaveAttribute("aria-selected", "true");
  await search.press("Enter");
  await expect(page).toHaveURL(/components\/typing-indicator$/);
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await search.fill("no-such-component-zzz");
  await expect(dialog).toContainText("No components found");
  await search.fill("macos");
  await expect(dialog.getByRole("option")).toHaveCount(0);
  await search.fill("message");
  await search.press("ArrowDown");
  const selected = await dialog.getByRole("option", { selected: true }).textContent();
  await search.press("ArrowUp");
  expect(await dialog.getByRole("option", { selected: true }).textContent()).not.toBe(selected);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(dialog).not.toBeVisible();
  await page.goto("/components/message-bubble");
  await expect(page.getByLabel("Preview platform", { exact: true })).toHaveCount(0);
  await expect(page.locator(".install-command code")).toContainText(`${new URL(page.url()).origin}/r/message-bubble.json`);
  await page.locator(".source-details summary").first().click();
  await expect(page.locator(".source-details[open] pre")).toContainText("export type MessageBubbleProps");
});

test("search works on a small phone and does not interrupt another dialog", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: "Search components", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Search components" });
  await dialog.getByRole("combobox").fill("photos");
  await dialog.getByRole("option", { name: "Photos", exact: true }).click();
  await expect(page).toHaveURL(/components\/message-image$/);
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Customize preview", exact: true }).click();
  const inspector = page.locator(".preview-inspector");
  await expect(inspector).toBeVisible();
  const controls = await inspector.boundingBox();
  const preview = await page.locator(".preview-canvas").boundingBox();
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(preview!.y + 1);
  await page.getByRole("button", { name: "Copy prompt for your agent", exact: true }).click();
  await page.keyboard.press("Meta+k");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("dialog", { name: "Add to your agent" })).toBeVisible();
});

test("agent button copies the live onboarding prompt directly", async ({ page, request }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value: string) => { Object.assign(window, { copiedCommand: value }); } }, configurable: true });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Copy prompt for your agent", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add to your agent" });
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { copiedCommand: string }).copiedCommand)).toBe(`Read ${new URL(page.url()).origin}/onboard.md and install the Message UI skill. Use it when building Messages-style interfaces in my projects.`);
  await expect(dialog).not.toBeVisible();
  const onboard = await request.get("/onboard.md");
  expect(onboard.ok()).toBe(true);
  const text = await onboard.text();
  expect(text).toContain("<<<SKILL");
  expect(text).toContain("name: message-ui");
  expect(text).not.toContain("{{REGISTRY_URL}}");
});

test("photos load, open the viewer, and close with Escape", async ({ page }) => {
  await page.goto("/components/message-image");
  const photo = page.locator('.photo-example-scroll img[data-tile]').first();
  await expect.poll(() => photo.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(100);
  await photo.click();
  await expect(page.locator('[data-slot="image-viewer"]')).toBeVisible();
  await expect(page.locator('[data-slot="viewer-status-bar"]')).toHaveCount(0);
  await expect.poll(async () => {
    const viewer = (await page.locator('[data-slot="image-viewer"]').boundingBox())!;
    const stage = (await page.locator('.component-stage').boundingBox())!;
    return Math.max(Math.abs(viewer.x - stage.x), Math.abs(viewer.y - stage.y), Math.abs(viewer.width - stage.width), Math.abs(viewer.height - stage.height));
  }).toBeLessThanOrEqual(2);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save photo", exact: true }).click()]);
  expect(download.suggestedFilename()).toBe("lake.jpg");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-slot="image-viewer"]')).toHaveCount(0);
  await openInspector(page);
  await page.getByLabel("Photos in message", { exact: true }).selectOption("3");
  await expect(page.locator('.photo-example-scroll img[data-tile]')).toHaveCount(3);
});

test("rich links retain metadata with the photo disabled", async ({ page }) => {
  await page.goto("/components/link-preview");
  const card = page.locator('[data-slot="link-preview"]');
  await expect(card).toHaveAttribute("href", "https://www.visitdolomites.com/");
  await expect(card).toHaveAttribute("rel", "noopener noreferrer");
  await expect(card.getByRole("img")).toHaveAttribute("alt", /wooden boat/);
  await openInspector(page);
  await page.getByLabel("Link title", { exact: true }).fill("A real link title");
  await page.getByLabel("Show image", { exact: true }).uncheck();
  await expect(card.getByRole("img")).toHaveCount(0);
  await expect(card).toContainText("A real link title");
  await expect(card).toContainText("visitdolomites.com");
});

test("voice playback advances real media time, seeks, pauses, and replays", async ({ page }) => {
  // A real, finite WAV keeps media playback deterministic without depending on Apple's network.
  const sampleRate = 8000;
  const samples = sampleRate * 4;
  const clip = Buffer.alloc(44 + samples * 2);
  clip.write("RIFF", 0); clip.writeUInt32LE(clip.length - 8, 4); clip.write("WAVEfmt ", 8);
  clip.writeUInt32LE(16, 16); clip.writeUInt16LE(1, 20); clip.writeUInt16LE(1, 22);
  clip.writeUInt32LE(sampleRate, 24); clip.writeUInt32LE(sampleRate * 2, 28);
  clip.writeUInt16LE(2, 32); clip.writeUInt16LE(16, 34); clip.write("data", 36);
  clip.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) clip.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / sampleRate) * 1000), 44 + i * 2);
  await page.route("https://audio-ssl.itunes.apple.com/**", route => {
    const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), clip.length - 1) : clip.length - 1;
    return route.fulfill({ status: range ? 206 : 200, contentType: "audio/wav", body: clip.subarray(start, end + 1), headers: {
      "Accept-Ranges": "bytes", ...(range ? { "Content-Range": `bytes ${start}-${end}/${clip.length}` } : {}),
    } });
  });
  await page.goto("/components/message-audio");
  const audio = page.locator("audio");
  await page.getByRole("button", { name: "Play audio message" }).click();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime), { timeout: 20000 }).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Pause audio message" }).click();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
  const position = page.getByRole("slider", { name: "Playback position" });
  const before = Number(await position.getAttribute("aria-valuenow"));
  await position.press("ArrowRight");
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => Math.round(el.currentTime))).toBe(before + 1);
  // End the actual media element, then verify the control can restart it.
  await audio.evaluate((el: HTMLAudioElement) => { el.currentTime = el.duration - .2; });
  await page.getByRole("button", { name: "Play audio message" }).click();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.ended)).toBe(true);
  await page.getByRole("button", { name: "Play audio message" }).click();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime > 0 && el.currentTime < 3 && !el.paused)).toBe(true);
});


test("composer stays at the bottom and sends text and selected photos", async ({ page }) => {
  await page.goto("/components/ios-composer");
  const demo = page.locator(".conversation-demo");
  const form = demo.locator('[data-slot="ios-composer"]').first();
  const field = form.getByRole("textbox", { name: "Message", exact: true });
  const frame = await demo.locator(".phone-content").boundingBox();
  const composer = await form.boundingBox();
  expect(Math.abs(composer!.y + composer!.height - frame!.y - frame!.height)).toBeLessThan(2);
  await field.fill("First message");
  await form.getByRole("button", { name: "Send message", exact: true }).click();
  await field.fill("Second message");
  await field.press("Enter");
  const log = demo.getByRole("log", { name: "Messages" });
  await expect(log).toContainText("First message");
  await expect(log).toContainText("Second message");
  await expect(field).toHaveValue("");
  const before = await log.locator("[data-message-id]").count();
  await form.getByRole("button", { name: "Add attachment" }).click();
  await expect(log.locator("[data-message-id]")).toHaveCount(before);
  await demo.getByRole("menuitem", { name: "Photos", exact: true }).click();
  const picker = demo.locator('[data-slot="photo-picker"]');
  await picker.locator('[data-slot="photo-picker-tile"]').first().click();
  await expect(form.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
  await form.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(log.locator('[data-slot="message-images"]')).toHaveCount(1);
  await expect(log.locator('[data-slot="message-images"]')).toHaveAttribute("data-direction", "outgoing");
  await expect(field).toHaveValue("");
});

test("photo direction aligns the balloon and the tail preserves its image", async ({ page }) => {
  await page.goto("/components/message-image");
  // This pixel probe samples fixed native offsets. Viewport scaling is covered by preview-sizes.
  await page.getByRole("button", { name: "Auto Fit preview", exact: true }).click();
  const scroll = page.locator(".photo-example-scroll");
  const photo = scroll.locator(':scope > [data-slot="message-images"]');
  await expect(photo.locator('[data-slot="photo-tail-image"]')).toHaveCount(1);
  const withTail = PNG.sync.read(await photo.screenshot());
  await page.getByLabel("Bubble tail", { exact: true }).uncheck();
  const withoutTail = PNG.sync.read(await photo.screenshot());
  let maxDifference = 0;
  let totalDifference = 0;
  let channels = 0;
  for (let y = withTail.height - 19; y < withTail.height - 12; y++) {
    for (let x = withTail.width - 20; x < withTail.width - 14; x++) {
      for (let channel = 0; channel < 3; channel++) {
        const offset = (y * withTail.width + x) * 4 + channel;
        const difference = Math.abs(withTail.data[offset] - withoutTail.data[offset]);
        maxDifference = Math.max(maxDifference, difference);
        totalDifference += difference;
        channels++;
      }
    }
  }
  expect(maxDifference, "tail cutout should preserve the original photograph").toBeLessThanOrEqual(4);
  expect(totalDifference / channels, "tail texture should match despite subpixel resampling").toBeLessThan(4);
  await page.getByLabel("Bubble tail", { exact: true }).check();
  for (const direction of ["Sent", "Received"]) {
    await page.getByRole("button", { name: direction, exact: true }).click();
    const geometry = await photo.evaluate(el => {
      const box = el.getBoundingClientRect();
      const grid = el.querySelector('[data-slot="image-grid"]')!.getBoundingClientRect();
      const tail = el.querySelector('[data-slot="tail"]')!.getBoundingClientRect();
      const parent = el.parentElement!;
      const bounds = parent.getBoundingClientRect();
      const style = getComputedStyle(parent);
      return { left: box.left, right: box.right, bottom: box.bottom, gridBottom: grid.bottom, tailLeft: tail.left, tailRight: tail.right,
        parentLeft: bounds.left + parseFloat(style.paddingLeft), parentRight: bounds.right - parseFloat(style.paddingRight) };
    });
    expect(Math.abs(geometry.bottom - geometry.gridBottom)).toBeLessThan(1);
    if (direction === "Sent") {
      expect(Math.abs(geometry.right - geometry.parentRight)).toBeLessThan(1);
      expect(Math.abs(geometry.tailRight - geometry.right)).toBeLessThan(1);
    } else {
      expect(Math.abs(geometry.left - geometry.parentLeft)).toBeLessThan(1);
      expect(Math.abs(geometry.tailLeft - geometry.left)).toBeLessThan(1);
    }
  }
  await page.getByLabel("Photos in message", { exact: true }).selectOption("3");
  const last = scroll.locator('[data-slot="message-images"][data-count="1"]').last();
  await last.scrollIntoViewIfNeeded();
  expect(await last.evaluate(el => Math.abs(el.getBoundingClientRect().bottom - el.querySelector('[data-slot="image-grid"]')!.getBoundingClientRect().bottom))).toBeLessThan(1);
});


test("compact previews preserve bubble geometry through double click, hover, and reactions", async ({ page }) => {
  for (const width of [320, 402, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/components");
    const demo = page.locator(".conversation-demo");
    const field = demo.getByRole("textbox", { name: "Message", exact: true });
    await field.fill("Meet me where the mountains are, and bring enough coffee for the early start.");
    await field.press("Enter");
    for (const id of ["intro-2", "intro-3", "long-message"]) {
      const row = id === "long-message" ? demo.locator('[data-slot="message-list"] [data-message-id]').last() : demo.locator(`[data-message-id="${id}"]`);
      const original = row.locator('[data-slot="bubble"]');
      await original.scrollIntoViewIfNeeded();
      const before = await original.boundingBox();
      const frame = await demo.locator('[data-slot="ios-messages-app"]').boundingBox();
      const scale = frame!.width / 402;
      const lift = Math.min(1.15, 1 + 26.07 / (before!.width / scale));
      await original.dblclick();
      const options = demo.getByRole("dialog", { name: "Message options" });
      await expect(options).toBeVisible();
      // The lift spring crosses its final width before it stops moving. Measure the resting pose
      // before testing hover, rather than mistaking the rest of that entrance for a hover effect.
      await options.evaluate(async element => {
        await Promise.allSettled(element.getAnimations({ subtree: true })
          .filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
          .map(animation => animation.finished));
      });
      const lifted = options.locator('[data-slot="lifted-bubble"] [data-slot="bubble"]');
      await expect.poll(async () => (await lifted.boundingBox())!.width).toBeCloseTo(before!.width * lift, 0);
      const bounds = await lifted.boundingBox();
      expect(Math.abs(bounds!.height - before!.height * lift)).toBeLessThan(1);
      expect(Math.abs(id === "intro-3" ? bounds!.x - before!.x : bounds!.x + bounds!.width - before!.x - before!.width)).toBeLessThan(1);
      for (const label of ["Copy", "Translate", "Select"]) {
        await options.getByRole("menuitem", { name: label, exact: true }).hover();
        const afterHover = await lifted.boundingBox();
        expect(Math.abs(afterHover!.x - bounds!.x)).toBeLessThan(1);
        expect(Math.abs(afterHover!.height - bounds!.height)).toBeLessThan(1);
      }
      const menu = await options.locator('[data-slot="context-menu"]').boundingBox();
      expect(menu!.x).toBeGreaterThanOrEqual(frame!.x - 1);
      expect(menu!.x + menu!.width).toBeLessThanOrEqual(frame!.x + frame!.width + 1);
      expect(menu!.y + menu!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
      await options.getByRole("menuitemradio", { name: "Like", exact: true }).click();
      await expect(options).toHaveCount(0);
      await expect(row.getByRole("img", { name: "Like tapback, from you" })).toBeVisible();
    }
  }
});

test("hover and a cancelled hold leave compact previews at rest", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/components");
  const demo = page.locator(".conversation-demo");
  const bubble = demo.locator('[data-message-id="intro-2"] [data-slot="bubble"]');
  const before = await bubble.boundingBox();
  await bubble.hover();
  await page.waitForTimeout(550);
  await expect(demo.getByRole("dialog", { name: "Message options" })).toHaveCount(0);
  expect(await bubble.boundingBox()).toEqual(before);
  await page.mouse.down();
  await page.mouse.move(5, 100);
  await page.mouse.up();
  await page.waitForTimeout(550);
  await expect(demo.getByRole("dialog", { name: "Message options" })).toHaveCount(0);
  await bubble.hover();
  await page.mouse.down();
  await expect(demo.getByRole("dialog", { name: "Message options" })).toBeVisible();
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await expect(demo.getByRole("dialog", { name: "Message options" })).toHaveCount(0);
});

test("desktop preview keeps the composer within the window", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/components");
  const frame = await page.locator(".phone-frame").boundingBox();
  expect(frame!.y + frame!.height).toBeLessThan(900);
  expect(frame!.height / frame!.width).toBeCloseTo(874 / 402, 1);
  await expect(page.locator('.conversation-demo [data-slot="ios-composer"]')).toBeInViewport();
  const last = page.locator('.conversation-demo [data-message-id="intro-3"] [data-slot="bubble"]');
  const composer = page.locator('.conversation-demo textarea');
  await expect.poll(async () => {
    const message = await last.boundingBox();
    const input = await composer.boundingBox();
    return message!.y + message!.height <= input!.y;
  }).toBe(true);
});
