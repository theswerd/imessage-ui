import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { platforms, scenarios, type Platform } from "../harness/scenarios";
import { deviceViewport, nativePixels, readManifest, type NativeCapture } from "./reference/import";

type Result = { platform: string; scene: string; theme: string; time: number; status: string; ratio?: number; scale?: number; source?: string };
const results: Result[] = [];
const output = "artifacts/native-comparison";
const root = process.env.REFERENCES_DIR ?? "references";
await mkdir(output, { recursive: true });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  for (const platform of Object.keys(platforms) as Platform[]) {
    const manifest = await readManifest(platform, root);
    // Throws if the suite's recorded viewport has drifted from the device the harness draws: the two
    // must be the same screen or the diff below is measuring the wrong thing.
    const viewport = deviceViewport(platform, manifest, root);
    for (const theme of ["light", "dark"]) for (const scenario of scenarios) for (const time of scenario.checkpoints) {
      const key = { platform, scene: scenario.id, theme, time };
      const capture = manifest.captures.find((entry: NativeCapture) => entry.scene === scenario.id && entry.theme === theme && entry.time === time);
      if (!capture || !manifest.osVersion) { results.push({ ...key, status: "missing-native-reference" }); continue; }
      const expectedPath = `${theme}/${scenario.id}-${time}.png`;
      if (capture.image !== expectedPath) throw new Error(`Invalid native image path for ${platform}/${scenario.id}`);
      const referenceBytes = await readFile(`${root}/${platform}/${expectedPath}`);
      if (createHash("sha256").update(referenceBytes).digest("hex") !== capture.sha256) throw new Error(`Native capture checksum changed: ${expectedPath}`);
      // The capture's own scale, not a global assumption: the page is rendered at the device scale
      // factor the reference was drawn at, so a 3x capture is diffed against a 3x render of our page
      // rather than against a 1x render blown up (or the capture shrunk) to meet it. Neither image is
      // ever resampled, which is the only way a sub-pixel claim in SPEC.md stays checkable.
      const scale = capture.scale ?? viewport.scale;
      if (!Number.isInteger(scale) || scale < 1) throw new Error(`Native capture ${platform}/${expectedPath} records no usable pixels-per-point scale. Re-import it.`);
      browser ??= await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: scale, locale: "en-US", timezoneId: "America/Los_Angeles" });
      await page.goto(`${process.env.HARNESS_URL ?? "http://localhost:3100"}/harness?embed=1&platform=${platform}&scene=${scenario.id}&theme=${theme}&t=${time}`);
      await page.getByTestId("harness-ready").waitFor();
      await page.evaluate(async time => { await document.fonts.ready; document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = time; }); }, time);
      const actualBytes = await page.getByTestId("device").screenshot({ animations: "allow", caret: "hide", scale: "device" });
      const actual = PNG.sync.read(actualBytes), reference = PNG.sync.read(referenceBytes);
      const pixels = nativePixels(platform, scale);
      if (reference.width !== pixels.width || reference.height !== pixels.height) throw new Error(`Native capture ${platform}/${expectedPath} is ${reference.width}x${reference.height}, not the ${pixels.width}x${pixels.height} its @${scale}x manifest entry claims.`);
      if (actual.width !== reference.width || actual.height !== reference.height) throw new Error(`Our page rendered ${actual.width}x${actual.height} at deviceScaleFactor ${scale} but the reference is ${reference.width}x${reference.height}: ${platform}/${expectedPath}`);
      const diff = new PNG({ width: actual.width, height: actual.height });
      const count = pixelmatch(actual.data, reference.data, diff.data, actual.width, actual.height, { threshold: 0.1, includeAA: true });
      const ratio = count / (actual.width * actual.height);
      const prefix = `${output}/${platform}-${theme}-${scenario.id}-${time}`;
      await writeFile(`${prefix}-actual.png`, actualBytes);
      await writeFile(`${prefix}-reference.png`, referenceBytes);
      await writeFile(`${prefix}-diff.png`, PNG.sync.write(diff));
      results.push({ ...key, status: ratio <= 0.001 ? "matched" : "mismatch", ratio, scale, source: capture.source });
      await page.close();
    }
  }
} finally { await browser?.close(); }
await writeFile(`${output}/report.json`, JSON.stringify({ generatedAt: new Date().toISOString(), kind: "native-fidelity", results }, null, 2));
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
await writeFile(`${output}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Native fidelity report</title><style>body{font:14px system-ui;margin:40px;max-width:1200px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px;border-bottom:1px solid #ddd}img{width:31%;vertical-align:top}details{margin:16px 0}</style><h1>Native fidelity report</h1><p>Missing native captures are incomplete, never passes. Maximum changed-pixel ratio: 0.1%. Includes antialiasing differences. Timings must also be reviewed against source recordings. Each comparison is made at the pixels-per-point the reference was captured at, with neither image resampled.</p><table><tr><th>Platform</th><th>Scenario</th><th>Theme</th><th>Time</th><th>Scale</th><th>Result</th></tr>${results.map(item => `<tr><td>${item.platform}</td><td>${item.scene}</td><td>${item.theme}</td><td>${item.time} ms</td><td>${item.scale ? `@${item.scale}x` : ""}</td><td>${item.status}${item.ratio !== undefined ? ` (${(item.ratio * 100).toFixed(3)}%)` : ""}</td></tr>`).join("")}</table>${results.filter(item => item.ratio !== undefined).map(item => { const prefix = `${item.platform}-${item.theme}-${item.scene}-${item.time}`; return `<details><summary>${prefix}</summary><p>${escape(item.source ?? "")}</p><img alt="Reference" src="${prefix}-reference.png"><img alt="Actual" src="${prefix}-actual.png"><img alt="Pixel difference" src="${prefix}-diff.png"></details>`; }).join("")}</html>`);
const matched = results.filter(item => item.status === "matched").length;
console.log(`${matched}/${results.length} native checkpoints matched. Report: ${output}/index.html`);
if (matched !== results.length) process.exitCode = 1;
