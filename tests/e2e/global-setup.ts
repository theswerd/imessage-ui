import type { FullConfig } from "@playwright/test";

/**
 * The harness runs on the Next dev server, which compiles a route the first time it is asked for.
 * With four projects navigating in parallel, that first compile can outlast a test's own budget, so
 * warm every route the suite touches once, in series, before any test starts.
 */
export default async function globalSetup(config: FullConfig) {
  const base = config.projects[0]?.use?.baseURL ?? "http://localhost:3100";
  const routes = [
    "/harness?platform=ios&scene=conversation&t=0&theme=light&embed=1",
    "/harness?platform=macos&scene=conversation&t=0&theme=dark&embed=1",
    "/harness?platform=ios&scene=conversation&t=0&theme=light",
    "/lab?scene=ios-conv3&theme=light",
    "/lab/ios-chrome?scene=conversation&theme=light",
    "/lab/ios-screens?scene=details&theme=light",
    "/lab/macos-chrome?scene=pane&theme=dark",
    "/lab/list?platform=ios&theme=light",
    "/lab/tapback?scene=balloon&theme=light",
    "/lab/effects?platform=ios&screen=confetti&t=0.4",
    "/lab/reply?platform=ios&theme=light",
    "/",
    "/components/message-image",
    "/components/message-audio",
  ];
  for (const route of routes) {
    try {
      const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(180_000) });
      await response.text();
    } catch (error) {
      // A warm-up miss is not fatal; the test that needs the route will compile it itself.
      console.warn(`warm-up failed for ${route}: ${(error as Error).message}`);
    }
  }
}
