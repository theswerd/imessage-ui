/**
 * Import one native capture as a reference baseline.
 *
 *   bun scripts/import-reference.ts --platform ios --scene outgoing --theme dark --at 690 \
 *     --file shot.png --os 'iOS 26.0 (23A343)' --source 'how this frame was obtained'
 *
 * The file must be the pixels the device drew: 402x874 pt @3x = 1206x2622 for iOS, 960x640 pt @2x =
 * 1920x1280 for macOS. `--scale` states a different pixels-per-point only for a device that really
 * drew at it; nothing is ever resized to fit. See `scripts/reference/import.ts`.
 */
import { parseArgs } from "node:util";
import { platforms, type Platform } from "../harness/scenarios";
import { importReference } from "./reference/import";

const { values } = parseArgs({ args: process.argv.slice(2), options: {
  platform: { type: "string" }, scene: { type: "string" }, theme: { type: "string", default: "light" },
  at: { type: "string", default: "0" }, file: { type: "string" }, os: { type: "string" }, source: { type: "string" },
  scale: { type: "string" }, root: { type: "string" },
} });
if (!values.platform || !(values.platform in platforms) || !values.scene || !values.file || !values.os || !values.source) throw new Error("Required: --platform ios|macos --scene NAME --file capture.png --os 'exact OS version' --source 'native device/recording provenance' [--theme light|dark] [--at MS] [--scale PIXELS-PER-POINT] [--root references]");
const platform = values.platform as Platform;
const imported = await importReference({
  platform, scene: values.scene, theme: values.theme!, time: Number(values.at),
  file: values.file, os: values.os, source: values.source,
  scale: values.scale === undefined ? undefined : Number(values.scale), root: values.root,
});
console.log(`Imported native reference: ${platform}/${imported.image} (${values.os}, ${imported.pixels.width}x${imported.pixels.height} @${imported.scale}x)`);
