import { AudioRecorderLab } from "./scene";
import type { AudioRecorderState } from "@/registry/imessage/audio-recorder";
import type { Platform } from "@/registry/imessage/platform";

export const metadata = { title: "Lab: audio recorder" };

const STATES: AudioRecorderState[] = ["recording", "stopped", "playing"];

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function number(value: string | string[] | undefined, fallback: number): number {
  const parsed = Number(one(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function state(value: string | string[] | undefined): AudioRecorderState | undefined {
  const found = STATES.find(candidate => candidate === one(value));
  return found;
}

/**
 * The recording row at native geometry, for diffing against a capture.
 *
 *   /lab/audio-recorder?platform=ios&state=recording&theme=light&t=2.5
 *   /lab/audio-recorder?platform=macos&state=stopped&theme=dark&t=1.75
 *   /lab/audio-recorder?platform=ios&state=recording&from=stopped&tprog=0.35   the state change, seeked
 *   /lab/audio-recorder?platform=ios&open=0&enter=0.5                          the exit, seeked
 *   /lab/audio-recorder?platform=ios&run=1                                     no seek: the row runs itself
 *
 * | query | meaning |
 * |---|---|
 * | `platform` | `ios` (402 x 874) or `macos` (the 630 x 640 conversation pane) |
 * | `theme` | `light` or `dark` |
 * | `state` | `recording`, `stopped` or `playing` |
 * | `t` | seconds into the take; the clock is seeked, not run |
 * | `run` | `1` drops the seek and lets the row run its own clock |
 * | `open` | `0` poses the exit |
 * | `enter` | seeks the entrance or the exit to this fraction |
 * | `from` + `tprog` | seeks the state change out of `from` to that fraction |
 * | `guides` | `1` outlines the measured composer field the row has to land on |
 */
export default async function AudioRecorderLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const platform: Platform = one(query.platform) === "macos" ? "macos" : "ios";
  return (
    <>
      <style>{"body > header, body > footer { display: none !important; } body { margin: 0; }"}</style>
      <AudioRecorderLab
        platform={platform}
        theme={one(query.theme) === "dark" ? "dark" : "light"}
        state={state(query.state) ?? "recording"}
        position={number(query.t, 2.5)}
        open={one(query.open) !== "0"}
        enter={one(query.enter) === undefined ? undefined : number(query.enter, 1)}
        transitionFrom={state(query.from)}
        transitionProgress={one(query.tprog) === undefined ? undefined : number(query.tprog, 1)}
        run={one(query.run) === "1"}
        guides={one(query.guides) === "1"}
      />
    </>
  );
}
