// Drive the app shells' sendAnimation/receiveAnimation props and report the flying bubble's position,
// so the shell wiring is checked against the same numbers as the standalone lab scene.
// usage: bun shell-send.ts <lab-url> <w> <h> [send|receive] [ms,ms,...]
import { chromium } from "@playwright/test";

type LabWindow = { __lab: { send(): void; receive(): void; seek(ms: number): void } };

const [url, wS = "402", hS = "874", kind = "send", timesArg = "0,100,200,267,350,383,520"] = process.argv.slice(2);
const times = timesArg.split(",").map(Number);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(wS), height: Number(hS) }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "load", timeout: 90000 });
await page.evaluate(async () => { await document.fonts.ready; });
await page.waitForTimeout(500);
await page.evaluate(k => (k === "send" ? (window as unknown as LabWindow).__lab.send() : (window as unknown as LabWindow).__lab.receive()), kind);
await page.waitForTimeout(200);
for (const t of times) {
  await page.evaluate(ms => (window as unknown as LabWindow).__lab.seek(ms), t);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  const row = await page.evaluate(() => {
    const frame = document.querySelector('[data-slot="ios-messages-app"], [data-slot="pane"]');
    if (!frame) return "no frame";
    const f = frame.getBoundingClientRect();
    const clone = document.querySelector('[data-slot="send-clone"]');
    const ghost = document.querySelector('[data-slot="send-ghost"]');
    const body = (clone ?? document.querySelector('[data-slot="message-list"] [data-slot="message-row"]:last-child'))?.querySelector('[data-slot="bubble"]');
    const b = body?.getBoundingClientRect();
    const g = ghost?.getBoundingClientRect();
    return `bubble top=${b ? (b.top - f.top).toFixed(1) : "-"} h=${b ? b.height.toFixed(1) : "-"} w=${b ? b.width.toFixed(1) : "-"} | ghost ${g ? `${(g.top - f.top).toFixed(1)} w${g.width.toFixed(1)}` : "-"} | clone=${clone ? "yes" : "no"}`;
  });
  console.log(`t=${String(t).padStart(4)}  ${row}`);
}
await browser.close();
