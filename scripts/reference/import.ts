/**
 * Import one native capture into a reference suite, at the scale the device actually drew it.
 *
 * A device does not draw in points. The iPhone 17 Pro simulator draws 1206x2622 pixels for its
 * 402x874 pt screen and Messages on a Retina Mac draws 1920x1280 for its 960x640 pt window, so the
 * only faithful reference is the full-resolution image: downscaling it to 1x throws away two thirds
 * of every edge and turns "is the corner radius 20.0107" into a question the file can no longer
 * answer. Nothing here resizes anything. A capture is accepted at exactly
 * `width * scale x height * scale` for the scale the suite is pinned to, and refused otherwise.
 *
 * The scale is recorded twice on purpose: on `viewport` where it pins the whole suite (like
 * `osVersion` does), and on each capture, so `compare-references.ts` can render our page at the
 * device scale factor of the very image it is about to diff rather than at a global assumption.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { platforms, scenarios, type Platform } from "../../harness/scenarios";

export type NativeCapture = {
  scene: string;
  time: number;
  theme: string;
  image: string;
  /** Pixels per point in the imported file. 3 for the iOS simulator, 2 for a Retina Mac. */
  scale: number;
  source: string;
  capturedAt: string;
  sha256: string;
};

export type ReferenceManifest = {
  platform: Platform;
  osVersion: string | null;
  status: string;
  viewport: { width: number; height: number; scale: number };
  captures: NativeCapture[];
};

export type ImportRequest = {
  platform: Platform;
  scene: string;
  theme: string;
  /** A checkpoint the scenario lists; a reference at any other time has nothing to compare against. */
  time: number;
  file: string;
  os: string;
  source: string;
  /** Pixels per point. Defaults to whatever the suite is already pinned to, then to the platform's. */
  scale?: number;
  /** Reference root, so a throwaway suite can be built outside the repo's `references/`. */
  root?: string;
};

export const themes = ["light", "dark"] as const;

/**
 * The suite's own record of what the device is, checked against the harness on every import: the iOS
 * manifest sat at a stale 390x760 while the harness drew 402x874, and nothing noticed because no
 * import ever read the viewport. Now a drifted viewport stops the import instead.
 */
export function deviceViewport(platform: Platform, manifest: ReferenceManifest, root = "references") {
  const device = platforms[platform];
  const viewport = manifest.viewport;
  if (!viewport || viewport.width !== device.width || viewport.height !== device.height)
    throw new Error(`${root}/${platform}/manifest.json records a ${viewport?.width}x${viewport?.height} pt viewport but the harness draws ${device.width}x${device.height}. Fix the manifest (and re-capture, if the old references were taken at the old size) rather than comparing two different devices.`);
  return viewport;
}

/** What a capture of `platform` at `scale` must measure, in pixels. Never a resize target. */
export function nativePixels(platform: Platform, scale: number) {
  const device = platforms[platform];
  return { width: device.width * scale, height: device.height * scale };
}

export async function readManifest(platform: Platform, root = "references"): Promise<ReferenceManifest> {
  return JSON.parse(await readFile(`${root}/${platform}/manifest.json`, "utf8"));
}

export async function importReference(request: ImportRequest): Promise<{ image: string; scale: number; pixels: { width: number; height: number } }> {
  const { platform, theme, time, os, source } = request;
  const root = request.root ?? "references";
  const scenario = scenarios.find(item => item.id === request.scene);
  if (!scenario || !(scenario.checkpoints as readonly number[]).includes(time) || !(themes as readonly string[]).includes(theme))
    throw new Error("Choose a listed scenario/checkpoint and light or dark theme.");

  const manifestPath = `${root}/${platform}/manifest.json`;
  const manifest = await readManifest(platform, root);
  const viewport = deviceViewport(platform, manifest, root);

  // One suite, one scale. Mixing a 1x and a 3x capture of the same screen would make half the
  // comparisons run at a resolution the other half cannot be judged at, so the first import pins it
  // exactly the way the first import pins the OS version.
  const scale = request.scale ?? viewport.scale ?? platforms[platform].scale;
  if (!Number.isInteger(scale) || scale < 1 || scale > 4) throw new Error(`Scale must be a whole number of pixels per point (1-4). Received ${request.scale}.`);
  if (viewport.scale && viewport.scale !== scale) throw new Error(`Suite is pinned to @${viewport.scale}x; import at that scale or create a separate reference suite. Never rescale a capture to fit.`);

  const bytes = await readFile(request.file);
  const png = PNG.sync.read(bytes);
  const pixels = nativePixels(platform, scale);
  if (png.width !== pixels.width || png.height !== pixels.height) {
    // If the file is some *other* whole multiple, say so: that is the difference between "you cropped
    // this wrong" and "this is the 1x export, go back for the one the device drew".
    const ratio = png.width / platforms[platform].width;
    const alsoSquare = ratio === png.height / platforms[platform].height && Number.isInteger(ratio);
    throw new Error(`Expected an explicitly cropped ${pixels.width}x${pixels.height} PNG (${platforms[platform].width}x${platforms[platform].height} pt @${scale}x). Received ${png.width}x${png.height}${alsoSquare ? `, which is @${ratio}x` : ""}. Images are never silently resized.`);
  }

  if (manifest.osVersion && manifest.osVersion !== os) throw new Error(`Suite is pinned to ${manifest.osVersion}; use the same OS version or create a separate reference suite.`);
  const image = `${theme}/${scenario.id}-${time}.png`;
  if (manifest.captures.some(capture => capture.image === image)) throw new Error(`Reference ${image} already exists. Review and remove its manifest entry before replacing a native baseline.`);

  await mkdir(`${root}/${platform}/${theme}`, { recursive: true });
  await writeFile(`${root}/${platform}/${image}`, bytes, { flag: "wx" });
  manifest.osVersion = os;
  manifest.status = "partial-native-captures";
  manifest.viewport = { width: viewport.width, height: viewport.height, scale };
  manifest.captures.push({ scene: scenario.id, time, theme, image, scale, source, capturedAt: new Date().toISOString(), sha256: createHash("sha256").update(bytes).digest("hex") });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return { image, scale, pixels };
}
