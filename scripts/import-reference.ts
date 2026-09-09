import { parseArgs } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { platforms, scenarios, type Platform } from "../harness/scenarios";

const { values } = parseArgs({ args: process.argv.slice(2), options: {
  platform: { type: "string" }, scene: { type: "string" }, theme: { type: "string", default: "light" },
  at: { type: "string", default: "0" }, file: { type: "string" }, os: { type: "string" }, source: { type: "string" },
} });
if (!values.platform || !(values.platform in platforms) || !values.file || !values.os || !values.source) throw new Error("Required: --platform ios|macos --scene NAME --file capture.png --os 'exact OS version' --source 'native device/recording provenance' [--theme light|dark] [--at MS]");
const platform = values.platform as Platform;
const scenario = scenarios.find(item => item.id === values.scene);
const time = Number(values.at);
if (!scenario || !(scenario.checkpoints as readonly number[]).includes(time) || !["light", "dark"].includes(values.theme!)) throw new Error("Choose a listed scenario/checkpoint and light or dark theme.");
const bytes = await readFile(values.file);
const png = PNG.sync.read(bytes);
if (png.width !== platforms[platform].width || png.height !== platforms[platform].height) throw new Error(`Expected an explicitly cropped ${platforms[platform].width}×${platforms[platform].height} PNG. Received ${png.width}×${png.height}. Images are never silently resized.`);
const manifestPath = `references/${platform}/manifest.json`;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.osVersion && manifest.osVersion !== values.os) throw new Error(`Suite is pinned to ${manifest.osVersion}; use the same OS version or create a separate reference suite.`);
const image = `${values.theme}/${scenario.id}-${time}.png`;
if (manifest.captures.some((capture: { image: string }) => capture.image === image)) throw new Error(`Reference ${image} already exists. Review and remove its manifest entry before replacing a native baseline.`);
await mkdir(`references/${platform}/${values.theme}`, { recursive: true });
await writeFile(`references/${platform}/${image}`, bytes, { flag: "wx" });
manifest.osVersion = values.os;
manifest.status = "partial-native-captures";
manifest.captures.push({ scene: scenario.id, time, theme: values.theme, image, source: values.source, capturedAt: new Date().toISOString(), sha256: createHash("sha256").update(bytes).digest("hex") });
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Imported native reference: ${platform}/${image} (${values.os})`);
