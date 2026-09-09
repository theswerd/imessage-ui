import { ListLab } from "./scene";

export const metadata = { title: "List lab" };

/**
 * Message-list lab: reconstructs a native capture's message area at exact geometry so Playwright can diff it.
 * /lab/list?platform=ios|macos&theme=light|dark&scene=conversation|send|receive|typing|link|grouped
 */
export default async function ListLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const platform = query.platform === "macos" ? "macos" : "ios";
  const theme = query.theme === "dark" ? "dark" : "light";
  const scene = typeof query.scene === "string" ? query.scene : "conversation";
  return <><style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style><ListLab platform={platform} theme={theme} scene={scene} /></>;
}
