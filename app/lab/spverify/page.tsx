import { SpScene } from "./scene";

export const metadata = { title: "Sticker picker verify" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const theme = query.theme === "dark" ? "dark" : "light";
  const tab = typeof query.tab === "string" ? query.tab : "recents";
  const progress = typeof query.progress === "string" ? Number(query.progress) : undefined;
  const open = query.open !== "0";
  const q = typeof query.q === "string" ? query.q : "";
  return <><style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style><SpScene theme={theme} tab={tab} progress={progress} open={open} query={q} /></>;
}
