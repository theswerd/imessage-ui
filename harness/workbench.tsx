"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Copy, Monitor, Pause, Play, RotateCcw, Smartphone, Upload } from "lucide-react";
import { HarnessPreview } from "./preview";
import { platforms, scenarioGroups, scenarioRuns, scenarios, type Platform, type ScenarioId } from "./scenarios";
import { cn } from "@/lib/utils";

export function Workbench({ initialPlatform, initialScenario, initialTime, embed, initialTheme }: { initialPlatform: Platform; initialScenario: ScenarioId; initialTime: number; embed: boolean; initialTheme: "light" | "dark" }) {
  const [platform, setPlatform] = useState(initialPlatform);
  const [scenario, setScenario] = useState(initialScenario);
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [revision, setRevision] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const [reference, setReference] = useState<string>();
  const [opacity, setOpacity] = useState(50);
  const [copied, setCopied] = useState(false);
  const [scale, setScale] = useState(1);
  const [failSends, setFailSends] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const selected = scenarios.find(item => item.id === scenario)!;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let elapsed = time;
    function tick(now: number) {
      const delta = now - last; last = now;
      elapsed = Math.min(selected.duration, elapsed + delta);
      setTime(elapsed);
      if (elapsed < selected.duration) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Capture the scrubber position once when playback begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, selected.duration]);
  useEffect(() => { if (!reference) return; return () => URL.revokeObjectURL(reference); }, [reference]);
  useEffect(() => {
    if (embed || !stage.current) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, (entry.contentRect.width - 32) / platforms[platform].width)));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [platform, embed]);
  function reset(next = scenario) { setScenario(next); setTime(0); setPlaying(false); setRevision(current => current + 1); setEvents([]); setFailSends(false); }
  /**
   * Switching platform keeps the scenario when the other shell has that surface too, and otherwise
   * falls to the first one in the same group that it does have — so choosing "Switch conversation"
   * and then tapping iOS lands on another Screens row rather than on a sidebar with nothing selected
   * and a preview of a scenario that does not exist there.
   */
  function switchPlatform(next: Platform) {
    setPlatform(next);
    setReference(undefined);
    if (scenarioRuns(scenario, next)) { reset(); return; }
    const group = selected.group;
    const fallback = scenarios.find(item => item.group === group && scenarioRuns(item.id, next)) ?? scenarios.find(item => scenarioRuns(item.id, next))!;
    reset(fallback.id);
  }
  function seek(point: number) { setPlaying(false); setTime(point); setRevision(current => current + 1); setEvents([]); }
  function record(event: string) { setEvents(current => [...current.slice(-7), event]); }
  // Native captures must bypass optimization and keep their original pixels.
  /* eslint-disable @next/next/no-img-element */
  const preview = <div data-preview-theme={theme} className={cn(theme, "relative w-fit")} style={{ colorScheme: theme }}><HarnessPreview key={`${platform}-${scenario}-${revision}`} platform={platform} scenario={scenario} time={Math.round(time)} onEvent={record} failSends={failSends} />{reference && <img src={reference} alt="Native reference overlay" className="pointer-events-none absolute inset-0 h-full w-full object-contain" style={{ opacity: opacity / 100 }} />}</div>;
  /* eslint-enable @next/next/no-img-element */
  if (embed) return <main id="main" data-testid="harness-ready" className="w-fit">{preview}</main>;
  return <main id="main" data-testid="harness-ready" className="mx-auto max-w-[1600px] px-5 pt-9 pb-16 sm:px-10">
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="size-1.5 rounded-full bg-green-500" />COMPONENT LAB <ChevronRight className="size-3" /> v0.1</div><h1 className="text-3xl font-semibold tracking-[-1.2px]">The details make the difference.</h1><p className="mt-2 text-sm text-muted-foreground">Replay, inspect, and compare every interaction.</p></div><div className="flex items-center gap-3"><span className="rounded-full border border-green-500/20 bg-green-500/5 px-3 py-1.5 text-xs text-green-700 dark:text-green-400">Measured against iOS 26 and macOS 26</span><button type="button" onClick={async () => { try { const url = new URL("/harness", location.origin); url.search = new URLSearchParams({ platform, scene: scenario, t: String(Math.round(time)), theme }).toString(); await navigator.clipboard.writeText(url.href); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { record("copy.failed"); } }} aria-label="Copy scenario link" className="rounded-lg border p-2 hover:bg-muted">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button></div></div>
    <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
      <aside aria-label="Test scenarios" className="flex gap-5 overflow-x-auto lg:block lg:space-y-7">{scenarioGroups.map(group => <div key={group} className="min-w-[170px]"><h2 className="mb-2 px-2 text-xs font-semibold text-muted-foreground">{group}</h2><div className="space-y-0.5">{scenarios.filter(item => item.group === group && scenarioRuns(item.id, platform)).map(item => <button type="button" key={item.id} onClick={() => reset(item.id)} aria-pressed={scenario === item.id} className={cn("flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm", scenario === item.id ? "bg-blue-500/10 font-medium text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{item.title}{scenario === item.id && <ChevronRight className="size-3.5" />}</button>)}</div></div>)}</aside>
      <div className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border bg-background px-4 py-3"><div className="flex items-center gap-1 rounded-lg bg-muted p-1">{(["ios", "macos"] as Platform[]).map(value => <button type="button" key={value} aria-pressed={platform === value} onClick={() => switchPlatform(value)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", platform === value ? "bg-background shadow-sm" : "text-muted-foreground")}>{value === "ios" ? <Smartphone className="size-3.5" /> : <Monitor className="size-3.5" />}{platforms[value].title}</button>)}</div><div className="flex items-center gap-4 text-xs text-muted-foreground"><span className="hidden sm:inline">{platforms[platform].width} × {platforms[platform].height}</span><label className="flex items-center gap-2">Theme<select aria-label="Preview theme" value={theme} onChange={event => setTheme(event.target.value as "light" | "dark")} className="rounded-md border bg-background px-2 py-1 text-foreground"><option value="light">Light</option><option value="dark">Dark</option></select></label><label className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 hover:bg-muted"><Upload className="size-3" />Reference<input type="file" accept="image/png,image/jpeg" aria-label="Load native reference" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) setReference(URL.createObjectURL(file)); }} /></label></div></div>
        <div ref={stage} className="preview-grid flex min-w-0 justify-center overflow-hidden border-x bg-muted/30 p-4 sm:p-8"><div style={{ width: platforms[platform].width * scale, height: platforms[platform].height * scale }}><div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>{preview}</div></div></div>
        <div className="rounded-b-xl border bg-background px-5 py-4"><div className="flex items-center gap-4"><button type="button" disabled={!selected.duration} onClick={() => { if (time >= selected.duration) { reset(); } setPlaying(current => time >= selected.duration ? true : !current); }} aria-label={playing && time < selected.duration ? "Pause replay" : "Play replay"} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-30">{playing && time < selected.duration ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}</button><button type="button" onClick={() => reset()} aria-label="Reset scenario" className="text-muted-foreground hover:text-foreground"><RotateCcw className="size-4" /></button><input type="range" aria-label="Timeline" min={0} max={selected.duration || 1} step={1} value={Math.round(time)} disabled={!selected.duration} onChange={event => seek(Number(event.target.value))} className="h-1 w-full accent-blue-500" /><output className="w-24 shrink-0 text-right font-mono text-xs text-muted-foreground">{Math.round(time)} / {selected.duration} ms</output></div><div className="mt-4 flex flex-wrap items-center gap-2"><span className="mr-2 text-xs text-muted-foreground">Checkpoints</span>{selected.checkpoints.map(point => <button type="button" key={point} onClick={() => seek(point)} className={cn("rounded-md border px-2 py-1 font-mono text-xs", Math.round(time) === point ? "border-blue-500/30 bg-blue-500/5 text-blue-500" : "text-muted-foreground hover:bg-muted")}>{point} ms</button>)}<label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={failSends} onChange={event => setFailSends(event.target.checked)} aria-label="Simulate send failure" className="accent-blue-500" />Fail sends</label><span className="text-xs text-muted-foreground">Double-click or hold a bubble to react.</span></div>{reference && <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground"><label htmlFor="overlay-opacity">Reference opacity</label><input id="overlay-opacity" type="range" min={0} max={100} value={opacity} onChange={event => setOpacity(Number(event.target.value))} className="accent-blue-500" /><span>{opacity}%</span><button onClick={() => setReference(undefined)} className="ml-auto underline">Remove</button></div>}</div>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-xl border p-4"><h2 className="text-xs font-semibold">Interaction log</h2><div role="log" aria-label="Interaction log" className="mt-3 min-h-14 space-y-1 font-mono text-xs text-muted-foreground">{events.length ? events.map((event, index) => <p key={index}><span className="mr-3 text-blue-500">{String(index + 1).padStart(2, "0")}</span>{event}</p>) : <p>Interact with the preview to record state changes.</p>}</div></div><div className="rounded-xl border p-4"><h2 className="text-xs font-semibold">Two kinds of evidence</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Regression captures catch changes to our implementation. Native captures in references/ measure fidelity to Apple: iOS 26.0 (simulator, iPhone 17 Pro) and macOS 26.5 Messages. Every size and timing comes from references/SPEC.md.</p></div></div>
      </div>
    </div>
  </main>;
}
