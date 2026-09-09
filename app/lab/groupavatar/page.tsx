import { GroupAvatarLab } from "./scene";

export const metadata = { title: "Group avatar lab" };

/**
 * Group-avatar lab.
 *
 * `/lab/groupavatar?scene=snowglobe&theme=light|dark` reconstructs
 * `references/group-avatar/snowglobe-{light,dark}.png` at native geometry (402 x 874, dpr 3), so:
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/private/tmp/imessage-playwright-browsers \
 *     bun scripts/measure/compare.ts \
 *       'http://localhost:3100/lab/groupavatar?scene=snowglobe&theme=light' \
 *       references/group-avatar/snowglobe-light.png 3 402 874 /tmp/ga-light
 *
 * `?scene=gutter&platform=ios|macos&progress=0..1` draws the transcript gutter and scrubs the
 * sender-avatar hand-off. No capture backs that one; it is the framework anchor drawn out.
 */
export default async function GroupAvatarLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const theme = query.theme === "dark" ? "dark" : "light";
  const platform = query.platform === "macos" ? "macos" : "ios";
  const scene = typeof query.scene === "string" ? query.scene : "snowglobe";
  const raw = typeof query.progress === "string" ? Number(query.progress) : NaN;
  const progress = Number.isFinite(raw) ? raw : undefined;
  const dir = query.dir === "rtl" ? "rtl" : undefined;
  return (
    <>
      <style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style>
      <div dir={dir}>
        <GroupAvatarLab scene={scene} theme={theme} platform={platform} progress={progress} />
      </div>
    </>
  );
}
