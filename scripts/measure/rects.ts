// Dump the laid-out geometry of a lab page: every message row, bubble body, tail and status label,
// in CSS px relative to the frame. usage: bun rects.ts <url> [w] [h] [dpr]
import { chromium } from "@playwright/test";

const [url, wS = "402", hS = "874", dprS = "3"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(wS), height: Number(hS) }, deviceScaleFactor: Number(dprS) });
await page.goto(url, { waitUntil: "load", timeout: 90000 });
await page.evaluate(async () => { await document.fonts.ready; });
await page.waitForTimeout(400);
const rows = await page.evaluate(() => {
  const frame = document.querySelector('[data-testid="lab"]') ?? document.body;
  const f = frame.getBoundingClientRect();
  const r = (el: Element) => { const b = el.getBoundingClientRect(); return { x: +(b.left - f.left).toFixed(2), y: +(b.top - f.top).toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2), bottom: +(b.bottom - f.top).toFixed(2), right: +(b.right - f.left).toFixed(2) }; };
  const out: unknown[] = [];
  document.querySelectorAll('[data-slot="date-separator"]').forEach(el => out.push({ kind: "date", text: el.textContent, ...r(el) }));
  document.querySelectorAll('[data-slot="message-row"]').forEach(el => {
    const body = el.querySelector('[data-slot="bubble"], [data-slot="emoji"]');
    const text = el.querySelector('[data-slot="text"]');
    const status = el.querySelector('[data-slot="status"]');
    out.push({ kind: "row", id: el.getAttribute("data-message-id"), row: r(el), body: body ? r(body) : null, text: text ? r(text) : null, status: status ? r(status) : null, label: body?.textContent?.slice(0, 28) });
  });
  return out;
});
console.log(JSON.stringify(rows, null, 1));
await browser.close();
