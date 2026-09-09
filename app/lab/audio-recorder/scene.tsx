"use client";

import { useState, type CSSProperties } from "react";
import {
  AudioRecorder,
  audioRecorderFallbackTake,
  audioRecorderMetrics,
  type AudioRecorderState,
} from "@/registry/imessage/audio-recorder";
import { PlatformProvider, type Platform } from "@/registry/imessage/platform";
import { palettes, paletteVars } from "@/registry/imessage/tokens";

/**
 * The recording row at native geometry, so it can be diffed against a capture the way every other
 * surface in this repo is.
 *
 * The frames are the measured ones: iOS 402 x 874 at 3x (`references/ios/captures`), macOS the
 * 630 x 640 conversation pane at 2x that `conversation-pane-*.png` crops to. The recorder positions
 * itself off the measured composer — iOS field x 80-374 with its bottom edge on y 846, macOS pane
 * field x 49-579 with its bottom on pane y 629 — so a capture of Messages mid-recording drops
 * straight onto this with `scripts/measure/compare.ts` and the composer band as the crop:
 *
 *   iOS    x 0 y 780 w 402 h 94
 *   macOS  x 0 y 570 w 630 h 70
 *
 * Nothing above the composer is drawn: no capture of this surface exists yet, and a message list
 * behind it would only add pixels a diff cannot check. `guides=1` outlines the measured field box
 * the row has to land on, so an offset shows up rather than hiding inside the row's own fill.
 */
const TAKE = audioRecorderFallbackTake(96);

export type LabProps = {
  platform: Platform;
  theme: "light" | "dark";
  state: AudioRecorderState;
  /** Seconds into the take. Seeked, so the frame is a pure function of the query string. */
  position: number;
  /** False plays (or, with `enter`, seeks) the exit. */
  open: boolean;
  /** Seeks the entrance or the exit to this fraction instead of playing it. */
  enter?: number;
  /** Seeks the state change out of `from` instead of playing it. */
  transitionFrom?: AudioRecorderState;
  transitionProgress?: number;
  /** Drops the seek so the row runs its own clock, which is what a screen recording wants. */
  run: boolean;
  guides: boolean;
};

export function AudioRecorderLab({ platform, theme, state, position, open, enter, transitionFrom, transitionProgress, run, guides }: LabProps) {
  const vars = paletteVars(palettes[platform][theme]) as CSSProperties;
  const size = platform === "ios" ? { width: 402, height: 874 } : { width: 630, height: 640 };
  const m = audioRecorderMetrics[platform];
  /** What a host holds: the state and, once stopped, the take that came off the row. */
  const [pose, setPose] = useState<{ state: AudioRecorderState; take: number[] } | null>(null);
  const shown = pose?.state ?? state;
  const take = pose?.take.length ? pose.take : TAKE;
  const duration = take.length / 12;

  return (
    <PlatformProvider platform={platform}>
      <div
        data-testid="lab"
        className={theme}
        style={{ ...vars, ...size, position: "relative", overflow: "hidden", background: "var(--im-bg)" }}
      >
        <AudioRecorder
          platform={platform}
          state={shown}
          levels={take}
          duration={duration}
          position={run ? undefined : position}
          progress={enter}
          open={open}
          transition={transitionFrom && transitionProgress !== undefined ? { from: transitionFrom, progress: transitionProgress } : undefined}
          onStop={stopped => setPose({ state: "stopped", take: stopped.levels })}
          onPlayChange={playing => setPose(previous => ({ state: playing ? "playing" : "stopped", take: previous?.take ?? TAKE }))}
          onAppend={() => setPose(previous => ({ state: "recording", take: previous?.take ?? TAKE }))}
          onCancel={() => setPose(null)}
          onSend={() => setPose(null)}
        />
        {guides ? (
          <div
            data-slot="lab-field-box"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: m.composer.fieldLeft,
              width: m.composer.fieldWidth,
              bottom: m.composer.bottom,
              height: platform === "ios" ? 40.33 : 31,
              outline: "1px solid rgba(255, 0, 0, 0.6)",
            }}
          />
        ) : null}
      </div>
    </PlatformProvider>
  );
}
