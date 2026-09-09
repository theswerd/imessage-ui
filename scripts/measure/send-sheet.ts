// Contact sheet of our own send animation, seeked to the given times, cropped to the same region as
// references/ios/motion/*.png so the two can be read side by side.
// usage: bun send-sheet.ts <lab-url> <out.png> [ms,ms,...] [x y w h]
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import fs from "node:fs";

type LabWindow = { __lab: { send(): void; seek(ms: number): void } };

const [url, out, timesArg, xS = "0", yS = "600", wS = "402", hS = "274"] = process.argv.slice(2);
const times = (timesArg ?? "0,33,67,100,133,167,200,233,267,300,350,400,450,520").split(",").map(Number);
const clip = { x: Number(xS), y: Number(yS), width: Number(wS), height: Number(hS) };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 });
await page.goto(url, { waitUntil: "load", timeout: 90000 });
await page.evaluate(async () => { await document.fonts.ready; });
await page.waitForTimeout(400);
await page.evaluate(() => (window as unknown as LabWindow).__lab.send());
const shots: PNG[] = [];
for (const t of times) {
  await page.evaluate((ms: number) => (window as unknown as LabWindow).__lab.seek(ms), t);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  shots.push(PNG.sync.read(await page.screenshot({ clip })));
}
await browser.close();

const cols = Math.min(7, shots.length);
const rows = Math.ceil(shots.length / cols);
const cw = shots[0].width, ch = shots[0].height;
const sheet = new PNG({ width: cols * (cw + 6), height: rows * (ch + 6) });
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 40; sheet.data[i + 1] = 40; sheet.data[i + 2] = 40; sheet.data[i + 3] = 255; }
shots.forEach((s, i) => PNG.bitblt(s, sheet, 0, 0, cw, ch, (i % cols) * (cw + 6), Math.floor(i / cols) * (ch + 6)));
fs.writeFileSync(out, PNG.sync.write(sheet));
console.log(out, sheet.width, sheet.height, "times", times.join(" "));
