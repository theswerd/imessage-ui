import { Workbench } from "@/harness/workbench";
import { scenarios, type Platform, type ScenarioId } from "@/harness/scenarios";

export const metadata = { title: "Component lab" };

export default async function HarnessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const platform: Platform = query.platform === "macos" ? "macos" : "ios";
  const scenario: ScenarioId = scenarios.some(item => item.id === query.scene) ? query.scene as ScenarioId : "conversation";
  const duration = scenarios.find(item => item.id === scenario)!.duration;
  const time = Math.max(0, Math.min(duration, Number(query.t) || 0));
  const embed = query.embed === "1";
  return <>{embed && <style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style>}<Workbench key={`${platform}-${scenario}-${time}-${query.theme}`} initialPlatform={platform} initialScenario={scenario} initialTime={time} initialTheme={query.theme === "dark" ? "dark" : "light"} embed={embed} /></>;
}
