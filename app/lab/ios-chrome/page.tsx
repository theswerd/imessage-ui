import { IosChromeScene, type ChromeScene } from "./scene";

export const metadata = { title: "Lab: iOS chrome" };

const scenes: ChromeScene[] = ["conversation", "composer-text", "list", "new-message"];

/**
 * Pixel lab for the iOS 26 chrome components. Renders one scene at 402×874 so
 * `scripts/measure/compare.ts` can diff it against the simulator captures:
 * /lab/ios-chrome?scene=conversation|composer-text|list|new-message&theme=light|dark
 */
export default async function IosChromeLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const scene = scenes.includes(query.scene as ChromeScene) ? (query.scene as ChromeScene) : "conversation";
  const theme = query.theme === "dark" ? "dark" : "light";
  return <><style>{"body > header, body > footer, nextjs-portal { display: none !important; } body { margin: 0; }"}</style><IosChromeScene scene={scene} theme={theme} /></>;
}
