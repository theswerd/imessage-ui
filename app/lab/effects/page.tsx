import { EffectsScene } from "./scene";

export const metadata = { title: "Effects lab" };

export default async function EffectsLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  return (
    <>
      <style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style>
      <EffectsScene
        platform={one("platform") === "macos" ? "macos" : "ios"}
        theme={one("theme") === "dark" ? "dark" : "light"}
        bubble={one("bubble")}
        screen={one("screen")}
        progress={one("t") === undefined ? undefined : Number(one("t"))}
        picker={one("picker") === "1"}
        pickerTab={one("tab")}
        previewText={one("text")}
        pickerSelection={one("choose") ? (one("tab") === "screen" ? { screen: one("choose") as never } : { bubble: one("choose") as never }) : null}
      />
    </>
  );
}
