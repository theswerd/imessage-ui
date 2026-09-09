import { LabScene } from "./scene";

export const metadata = { title: "Lab" };

/**
 * Pixel lab: renders a scene at the exact native geometry so Playwright can diff it against a capture.
 * /lab?scene=ios-conv3&theme=light
 */
export default async function LabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const scene = typeof query.scene === "string" ? query.scene : "ios-conv3";
  const theme = query.theme === "dark" ? "dark" : "light";
  return <><style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style><LabScene scene={scene} theme={theme} /></>;
}
