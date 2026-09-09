/**
 * Screenshot a page and print every hairline `findHairlines` sees in it.
 *
 *   bun scripts/measure/hairline-scan.ts <url> [dpr] [w] [h] [outDir] [--delta 12] [--run 10]
 *
 * One line per run: axis, position in points, extent, and how far off it is. `outDir` also writes
 * `shot.png` and `hairlines.png`, the same shot with every run painted magenta. Exit code 1 when
 * anything is found, so it can gate a shell loop.
 */
import { chromium } from "playwright";
import { PNG } from "pngjs";
import fs from "node:fs";
import { findHairlines } from "./hairline";

function flag(args: string[], name: string, fallback: number) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : fallback;
}
const [url, dprArg, wArg, hArg, outDir] = process.argv.slice(2);
if (!url) { console.error("usage: hairline-scan.ts <url> [dpr] [w] [h] [outDir] [--delta n] [--run n]"); process.exit(2); }
const dpr = Number(dprArg ?? 3);
const w = Number(wArg ?? 402);
const h = Number(hArg ?? 874);
const delta = flag(process.argv, "delta", 12);
const minRun = flag(process.argv, "run", 10);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const buf = await page.screenshot();
await browser.close();

const png = PNG.sync.read(buf);
const runs = findHairlines(png, delta, minRun);
if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(`${outDir}/shot.png`, buf);
  const marked = PNG.sync.read(buf);
  for (const r of runs) {
    for (let i = r.from; i <= r.to; i++) {
      const idx = r.axis === "row" ? (r.at * png.width + i) * 4 : (i * png.width + r.at) * 4;
      marked.data[idx] = 255; marked.data[idx + 1] = 0; marked.data[idx + 2] = 255;
    }
  }
  fs.writeFileSync(`${outDir}/hairlines.png`, PNG.sync.write(marked));
}
for (const r of runs.sort((a, b) => b.to - b.from - (a.to - a.from))) {
  const p = (n: number) => (n / dpr).toFixed(2);
  console.log(
    `${r.axis} ${r.sign > 0 ? "light" : "dark"}  ${r.axis === "row" ? "y" : "x"}=${p(r.at)}  ` +
      `${r.axis === "row" ? "x" : "y"} ${p(r.from)}..${p(r.to)}  len ${((r.to - r.from + 1) / dpr).toFixed(2)}pt  peak ${r.peak.toFixed(1)}`,
  );
}
console.log(`${runs.length} hairline run(s)  ${url}`);
process.exit(runs.length ? 1 : 0);