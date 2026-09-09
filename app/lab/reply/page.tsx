import { ReplyScene } from "./scene";

export const metadata = { title: "Reply lab" };

export default async function ReplyLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  return (
    <>
      <style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style>
      <ReplyScene platform={one("platform") === "macos" ? "macos" : "ios"} theme={one("theme") === "dark" ? "dark" : "light"} thread={one("thread") === "1"} photoCount={one("photos") ? Number(one("photos")) : undefined} audio={one("audio") === "1"} edit={one("edit") === "1"} />
    </>
  );
}
