import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Compile every harness and lab route once before the projects start; see the file for why.
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 3,
  timeout: 30_000,
  expect: { timeout: 7000, toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled", caret: "hide", scale: "css" } },
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "{testDir}/baselines/{projectName}/{arg}{ext}",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "ios-chromium", use: { browserName: "chromium", hasTouch: true } },
    { name: "macos-chromium", use: { browserName: "chromium" } },
    { name: "ios-webkit", use: { browserName: "webkit", hasTouch: true } },
    { name: "macos-webkit", use: { browserName: "webkit" } },
  ],
  // Point PLAYWRIGHT_BASE_URL at a server you started yourself to skip this. The visual suite makes
  // hundreds of navigations per project; a dev server compiling routes on demand becomes the
  // bottleneck and times out navigations, so prefer a production server for a full run.
  //
  // For WebKit it is not a preference, it is the difference between running and not running. Against
  // `bun run dev`, every navigation after the first fails to load Turbopack's chunks — twenty-odd
  // scripts left pending and a `ChunkLoadError` for each — so `page.goto`'s `load` never fires and
  // the navigation times out at 30 s. `?scene=typing` measures 31 ms against a production server and
  // times out against the dev one; the whole WebKit half of the visual suite is unrunnable that way,
  // which is why its baselines were stale for so long. `bun run test:all:prod` is the whole recipe.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : { command: "bun run dev", url: "http://localhost:3100/harness", reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
