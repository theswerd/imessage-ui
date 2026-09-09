// Seek the lab's send animation and report where the flying bubble's body sits at each time, so the
// trajectory can be compared with references/ios/motion/send-60fps.mp4 frame by frame.
// usage: bun send-track.ts <lab-url> [ms,ms,ms...]
import { chromium } from "@playwright/test";

type LabWindow = { __lab: { send(): void; seek(ms: number): void } };

const url = process.argv[2];
const times = (process.argv[3] ?? "133,150,167,183,200,217,233,250,267,283,300,317,333,350,367,383,400,417,433,450,467,483,520").split(",").map(Number);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 });
await page.goto(url, { waitUntil: "load", timeout: 90000 });
await page.evaluate(async () => { await document.fonts.ready; });
await page.waitForTimeout(400);
await page.evaluate(() => (window as unknown as LabWindow).__lab.send());
await page.waitForTimeout(100);
const rows = await page.evaluate(async (ts: number[]) => {
  const frame = document.querySelector('[data-testid="lab"]')!;
  const out: Array<Record<string, number | null>> = [];
  for (const t of ts) {
    (window as unknown as { __lab: { seek(ms: number): void } }).__lab.seek(t);
    await new Promise(r => requestAnimationFrame(() => r(null)));
    const f = frame.getBoundingClientRect();
    const clone = document.querySelector('[data-slot="send-clone"]');
    const body = clone?.querySelector('[data-slot="bubble"]');
    const ghost = document.querySelector('[data-slot="send-ghost"]');
    const g = ghost?.getBoundingClientRect();
    const b = body?.getBoundingClientRect();
    const visible = clone ? Number(getComputedStyle(clone).opacity) : 0;
    out.push({
      t,
      top: b && visible > 0.5 ? +(b.top - f.top).toFixed(1) : null,
      bottom: b && visible > 0.5 ? +(b.bottom - f.top).toFixed(1) : null,
      h: b && visible > 0.5 ? +b.height.toFixed(1) : null,
      w: b && visible > 0.5 ? +b.width.toFixed(1) : null,
      ghostTop: g && Number(getComputedStyle(ghost!).opacity) > 0.5 ? +(g.top - f.top).toFixed(1) : null,
      ghostW: g && Number(getComputedStyle(ghost!).opacity) > 0.5 ? +g.width.toFixed(1) : null,
    });
  }
  return out;
}, times);
for (const r of rows) console.log(`t=${String(r.t).padStart(4)}  top=${r.top ?? "-"}  bottom=${r.bottom ?? "-"}  h=${r.h ?? "-"}  w=${r.w ?? "-"}  ghost top=${r.ghostTop ?? "-"} w=${r.ghostW ?? "-"}`);
await browser.close();
