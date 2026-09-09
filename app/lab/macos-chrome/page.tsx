import { MacChromeScene } from "./scene";

export const metadata = { title: "Lab: macOS chrome" };

/**
 * Pixel lab for the macOS 26 Messages chrome. Renders the 960×640 window at native geometry so
 * `scripts/measure/compare.ts` can diff it against `references/macos/captures/*`.
 *
 * /lab/macos-chrome?scene=window|pane|plus-menu&theme=light|dark&active=0|1&text=...&focus=1&ox=-330&oy=-150
 *   scene=pane shifts the window left by 330 so the conversation pane lands at (0, 0), matching the
 *   captures (which start at window x 330); ox/oy override that offset (the light capture starts at y 150).
 *   menu=1 opens the "+" popover in any scene;
 *   scene=plus-menu renders a 200×270 viewport at window (330, 580) with the "+" popover open, matching
 *   plus-menu-{dark,light}-2x.png.
 */
export default async function MacChromeLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const str = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const scene = str("scene") === "pane" ? "pane" : str("scene") === "plus-menu" ? "plus-menu" : "window";
  const theme = str("theme") === "dark" ? "dark" : "light";
  const active = str("active") !== "0";
  const text = str("text") ?? "";
  const focus = str("focus") === "1";
  const menu = str("menu") === "1";
  const ox = str("ox") !== undefined ? Number(str("ox")) : scene === "window" ? 0 : -330;
  const oy = str("oy") !== undefined ? Number(str("oy")) : scene === "plus-menu" ? -580 : 0;
  return (
    <>
      <style>{"body > header, body > footer, body > a, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <MacChromeScene scene={scene} theme={theme} active={active} text={text} focus={focus} menu={menu} ox={ox} oy={oy} />
    </>
  );
}
