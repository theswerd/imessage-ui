import { SearchVerify } from "./client";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]);
  return <><style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style><SearchVerify theme={one("theme") === "dark" ? "dark" : "light"} scene={one("scene") ?? "results"} progress={one("progress")} /></>;
}
