import { TapbackLabScene } from "./scene";

export const metadata = { title: "Tapback lab" };

/**
 * Pixel lab for the tapback UI, rendered at native geometry for `scripts/measure/compare.ts`.
 * /lab/tapback?scene=balloon|longpress|macos-menu&theme=light|dark&progress=0..1
 */
export default async function TapbackLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const scene = typeof query.scene === "string" ? query.scene : "balloon";
  const theme = query.theme === "dark" ? "dark" : "light";
  const progress = typeof query.progress === "string" ? Number(query.progress) : undefined;
  return <><style>{"body > header, body > footer, body > a, nextjs-portal { display: none !important; } body { margin: 0; }"}</style><TapbackLabScene scene={scene} theme={theme} progress={Number.isFinite(progress) ? progress : undefined} /></>;
}
