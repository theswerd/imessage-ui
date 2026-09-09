// Screenshot a lab URL at native scale and diff a region against a reference capture.
// usage: bun compare.ts <url> <ref.png> <dpr> <w> <h> <out-dir> [x y w h] [threshold] [--flag=value ...]
//   region is in CSS px (points); output: ref.png, ours.png, diff.png, side.png (ref | ours | diff),
//   heat.png (signed-error heatmap, blue = ours darker than the capture, red = lighter)
//   flags: --heat-scale (16) --edge-threshold (8) --erode (3) --blob-threshold (4)
// The first printed line is pixelmatch's mismatched-pixel ratio, unchanged, so every number already
// recorded in SPEC's fidelity table stays comparable. The block under it is the colour error that
// ratio cannot express; see shift.ts for what each column means.
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "node:fs";
import { analyzeShift, formatShiftReport, heatmap, parseFlags } from "./shift";

const { positional, flags } = parseFlags(process.argv.slice(2));
const [url, refPath, dprS, wS, hS, out, xS, yS, rwS, rhS, thS] = positional;
const dpr = Number(dprS); const W = Number(wS); const H = Number(hS);
const region = xS ? { x: Number(xS), y: Number(yS), w: Number(rwS), h: Number(rhS) } : { x: 0, y: 0, w: W, h: H };
const threshold = thS ? Number(thS) : 0.1;
const heatScale = flags["heat-scale"] ?? 16;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
await page.goto(url, { waitUntil: "load", timeout: 90000 });
await page.evaluate(async () => { await document.fonts.ready; });
await page.waitForTimeout(400); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
const shotBuf = await page.screenshot({ clip: { x: region.x, y: region.y, width: region.w, height: region.h } });
await browser.close();

const ours = PNG.sync.read(shotBuf);
const refFull = PNG.sync.read(fs.readFileSync(refPath));
const ref = new PNG({ width: Math.round(region.w * dpr), height: Math.round(region.h * dpr) });
PNG.bitblt(refFull, ref, Math.round(region.x * dpr), Math.round(region.y * dpr), ref.width, ref.height, 0, 0);
const diff = new PNG({ width: ref.width, height: ref.height });
const mismatched = pixelmatch(ref.data, ours.data, diff.data, ref.width, ref.height, { threshold, includeAA: false });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/ref.png`, PNG.sync.write(ref));
fs.writeFileSync(`${out}/ours.png`, PNG.sync.write(ours));
fs.writeFileSync(`${out}/diff.png`, PNG.sync.write(diff));
const side = new PNG({ width: ref.width * 3 + 20, height: ref.height });
for (let i = 0; i < side.data.length; i += 4) { side.data[i] = 255; side.data[i + 1] = 0; side.data[i + 2] = 255; side.data[i + 3] = 255; }
PNG.bitblt(ref, side, 0, 0, ref.width, ref.height, 0, 0);
PNG.bitblt(ours, side, 0, 0, ref.width, ref.height, ref.width + 10, 0);
PNG.bitblt(diff, side, 0, 0, ref.width, ref.height, ref.width * 2 + 20, 0);
fs.writeFileSync(`${out}/side.png`, PNG.sync.write(side));
const pct = (100 * mismatched) / (ref.width * ref.height);
console.log(`mismatch ${mismatched}px of ${ref.width * ref.height} = ${pct.toFixed(2)}%  -> ${out}/side.png`);

const report = analyzeShift(ref.data, ours.data, ref.width, ref.height, {
  edgeThreshold: flags["edge-threshold"],
  erode: flags["erode"],
  blobThreshold: flags["blob-threshold"],
});
fs.writeFileSync(`${out}/heat.png`, PNG.sync.write(heatmap(report.signed, ref.width, ref.height, heatScale)));
console.log(formatShiftReport(report, mismatched / (ref.width * ref.height), heatScale));
console.log(`-> ${out}/heat.png`);
