import { PpVerify } from "./client";

export const metadata = { title: "Lab: photo picker verify" };

export default async function PpVerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const raw = Number(one("progress"));
  const progress = Number.isFinite(raw) && one("progress") !== undefined ? Math.max(0, Math.min(1, raw)) : undefined;
  const initial = (one("selected") ?? "").split(",").filter(Boolean);
  return (
    <>
      <style>{"body > header, body > footer, nextjs-portal { display: none !important; } body { margin: 0; }"}</style>
      <PpVerify
        progress={progress}
        startOpen={one("open") !== "0"}
        theme={one("theme") === "dark" ? "dark" : "light"}
        ordered={one("ordered") === "1"}
        multiple={one("multiple") !== "0"}
        useFixtures={one("photos") !== "samples"}
        many={one("many") === "1"}
        initial={initial}
      />
    </>
  );
}
