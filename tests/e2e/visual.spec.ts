import { expect, test } from "@playwright/test";
import { scenarioRuns, scenarios } from "../../harness/scenarios";
import { freezeAnimations, openScene, platformFor } from "./helpers";

/**
 * Regression captures of the device frame at every checkpoint of every scenario, in both themes and
 * in all four browser/platform projects. Files land at
 * `tests/e2e/baselines/<project>/<theme>/<scenario>-<time>.png` (snapshotPathTemplate in
 * playwright.config.ts). These are captures of this implementation, not of Apple; regenerate them
 * with `bun run test:visual:update` after reviewing the change that moved them.
 */
for (const theme of ["light", "dark"] as const) {
  for (const scenario of scenarios) {
    test(`${theme} / ${scenario.id} checkpoints`, async ({ page }, info) => {
      test.skip(!scenarioRuns(scenario.id, platformFor(info)), "this surface does not exist on the other platform");
      // Every checkpoint is its own navigation plus an image comparison, and a comparison retries.
      test.setTimeout(20_000 + scenario.checkpoints.length * 15_000);
      for (const time of scenario.checkpoints) {
        const device = await openScene(page, info, scenario.id, time, theme);
        // The scene is already scrubbed to `time`; this only pins whatever still runs on its own clock.
        await freezeAnimations(page, time);
        // Soft, so one moved checkpoint still reports (and updates) the rest of the timeline.
        await expect.soft(device, `${scenario.id} at ${time} ms, ${theme}`)
          .toHaveScreenshot([theme, `${scenario.id}-${time}.png`], { animations: "allow" });
      }
    });
  }
}
