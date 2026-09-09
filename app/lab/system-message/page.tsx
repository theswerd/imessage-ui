import type { Platform } from "@/registry/imessage/platform";
import { SystemMessageScene, type SystemMessageSceneName } from "./scene";

export const metadata = { title: "System message verify" };

/**
 * Native-geometry lab for the centred transcript lines.
 *
 * - `/lab/system-message?scene=notice` reconstructs `references/ios/captures/incoming-light.png`:
 *   the unknown-sender notice under a spacer whose bottom edge is the capture's measured body bottom.
 *   Diff it with
 *   `bun scripts/measure/compare.ts http://localhost:3100/lab/system-message?scene=notice \
 *      references/ios/captures/incoming-light.png 3 402 874 <outdir> 0 712 402 40`
 * - `?scene=run` puts three lines in a row, to show the gaps do not double.
 * - `?scene=family` renders every event type at that platform's metrics.
 *
 * `&platform=macos`, `&theme=dark` and `&progress=0..1` (which seeks the arrival animation instead of
 * playing it) all apply.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const raw = typeof query.scene === "string" ? query.scene : "notice";
  const scene: SystemMessageSceneName = raw === "family" || raw === "run" ? raw : "notice";
  const theme = query.theme === "dark" ? "dark" : "light";
  const platform: Platform = query.platform === "macos" ? "macos" : "ios";
  const progress = typeof query.progress === "string" && query.progress !== "" ? Number(query.progress) : undefined;
  const letterSpacing = typeof query.ls === "string" && query.ls !== "" ? Number(query.ls) : undefined;
  const gapAbove = typeof query.gap === "string" && query.gap !== "" ? Number(query.gap) : undefined;
  return (
    <>
      <style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style>
      <SystemMessageScene scene={scene} theme={theme} platform={platform} progress={progress} letterSpacing={letterSpacing} gapAbove={gapAbove} />
    </>
  );
}
