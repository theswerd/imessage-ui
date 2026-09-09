import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { findHairlines } from "../../scripts/measure/hairline";

/**
 * A guard against seams, not a fidelity check.
 *
 * The bubble body and its tail are two separately clipped layers that share an edge, and Chrome
 * snaps each layer's clip reference box to whole CSS px independently. When their shared edge lands
 * on different device rows the background shows through the row between them: a one-pixel white
 * line running out of the tail across the bubble. `tailSeamOverlap` closes it, and this test is
 * what keeps it closed.
 *
 * The detector looks for runs of pixels that are brighter (or darker) than their neighbours on both
 * sides, which an antialiased edge never is. Some chrome is *meant* to be a hairline - the macOS
 * composer field's rim, and the top-left highlight inset into the header's name pill - so instead of
 * raising `delta` past them, which would also blind this to a seam between two low-contrast greys,
 * each lab names the region the transcript occupies and the scan stays inside it.
 */
type Lab = { url: string; dpr: number; width: number; height: number; clip?: { x: number; y: number; width: number; height: number } };

const IOS = { dpr: 3, width: 402, height: 874 };
const MAC = { dpr: 2, width: 960, height: 640 };

const LABS: Lab[] = [
  { url: "/lab?scene=ios-conv3", ...IOS },
  { url: "/lab/list?platform=ios&scene=conversation", ...IOS },
  { url: "/lab/list?platform=ios&scene=grouped", ...IOS },
  { url: "/lab/list?platform=ios&scene=link", ...IOS },
  { url: "/lab/list?platform=ios&scene=typing", ...IOS },
  { url: "/lab/reply?platform=ios", ...IOS },
  { url: "/lab/list?platform=macos&scene=conversation", ...MAC },
  { url: "/lab/list?platform=macos&scene=grouped", ...MAC },
  { url: "/lab/reply?platform=macos", ...MAC },
  // The pane lab draws the whole window: skip the header's pill rim and the composer's.
  { url: "/lab/macos-chrome?scene=pane", ...MAC, clip: { x: 0, y: 92, width: 960, height: 480 } },
  // The photo stack is four separately clipped layers sharing edges — the front card carries the
  // body clip and the tail, the ones behind it carry a rim — which is the same shape of problem the
  // bubble's tail seam is. The scan skips the status bar, whose Dynamic Island and glyph edges are
  // meant to be sharp, and stops above the composer's own rim.
  { url: "/harness?platform=ios&scene=photos&embed=1", ...IOS, clip: { x: 0, y: 160, width: 402, height: 620 } },
  { url: "/harness?platform=ios&scene=photo-many&embed=1", ...IOS, clip: { x: 0, y: 160, width: 402, height: 620 } },
];

const DELTA = 12;
const MIN_RUN = 24; // 8pt at 3x, 12pt at 2x: longer than any glyph feature, shorter than a seam

for (const theme of ["light", "dark"] as const) {
  for (const lab of LABS) {
    test(`${theme} / no hairlines in ${lab.url}`, async ({ browser }, info) => {
      // The lab URL carries its own platform, so the ios/macos split of the project matrix would
      // only run each page twice. The browser engines do differ here, so keep both of those.
      test.skip(info.project.name.startsWith("macos-"), "the lab URL picks the platform");
      const context = await browser.newContext({
        viewport: { width: lab.width, height: lab.height },
        deviceScaleFactor: lab.dpr,
      });
      const page = await context.newPage();
      const sep = lab.url.includes("?") ? "&" : "?";
      await page.goto(`${lab.url}${sep}theme=${theme}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      const png = PNG.sync.read(await page.screenshot(lab.clip ? { clip: lab.clip } : undefined));
      await context.close();

      const runs = findHairlines(png, DELTA, MIN_RUN).map(
        (r) =>
          `${r.axis} ${r.sign > 0 ? "light" : "dark"} ${r.axis === "row" ? "y" : "x"}=` +
          `${(r.at / lab.dpr + (r.axis === "row" ? (lab.clip?.y ?? 0) : (lab.clip?.x ?? 0))).toFixed(2)} ` +
          `${(r.from / lab.dpr + (r.axis === "row" ? (lab.clip?.x ?? 0) : (lab.clip?.y ?? 0))).toFixed(2)}..` +
          `${(r.to / lab.dpr + (r.axis === "row" ? (lab.clip?.x ?? 0) : (lab.clip?.y ?? 0))).toFixed(2)} peak ${r.peak.toFixed(0)}`,
      );
      expect(runs, `hairlines in ${lab.url} (${theme})`).toEqual([]);
    });
  }
}
