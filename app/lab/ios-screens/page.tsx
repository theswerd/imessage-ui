import { IosScreensScene, type ScreenScene } from "./scene";

/** Kept here, not in the client module: a server component only sees client references for its exports. */
const scenes: ScreenScene[] = ["details", "plus-menu", "select-mode", "swipe-times", "notice", "attachment", "photo-picker"];

export const metadata = { title: "Lab: iOS screens" };

/**
 * Pixel lab for the iOS 26 secondary screens and states. Each scene reconstructs one capture at its
 * native geometry so `scripts/measure/compare.ts` can diff it:
 * /lab/ios-screens?scene=details|plus-menu|select-mode|swipe-times|notice|attachment|photo-picker&theme=light|dark
 * `&progress=0..1` scrubs the entrance of the scenes that animate (details, plus-menu, swipe-times);
 * `&progress=live` hands them their own spring and, for swipe-times, a real pointer/keyboard drag.
 */
export default async function IosScreensLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const scene = scenes.includes(query.scene as ScreenScene) ? (query.scene as ScreenScene) : "details";
  const theme = query.theme === "dark" ? "dark" : "light";
  const live = query.progress === "live";
  const raw = typeof query.progress === "string" ? Number(query.progress) : Number.NaN;
  const progress = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : undefined;
  return (
    <>
      <style>{"body > header, body > footer, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <IosScreensScene scene={scene} theme={theme} progress={progress} live={live} />
    </>
  );
}
