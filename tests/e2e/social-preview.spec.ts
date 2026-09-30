import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

test("homepage and component links share the generated social preview", async ({ page, request }) => {
  let imageUrl = "";
  for (const route of ["/", "/components/ios-details"]) {
    await page.goto(route);
    const image = page.locator('meta[property="og:image"]');
    await expect(image).toHaveAttribute("content", /^https?:\/\/.*\/opengraph-image/);
    const url = (await image.getAttribute("content"))!;
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", url);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /Message UI.*By Freestyle/);
    if (imageUrl) expect(url).toBe(imageUrl);
    imageUrl = url;
  }
  const response = await request.get(new URL(imageUrl).pathname);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  const image = PNG.sync.read(await response.body());
  expect([image.width, image.height]).toEqual([1200, 630]);
});
