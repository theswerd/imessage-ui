"use client";

import { useRef, useState } from "react";
import { MessageAudio } from "@/registry/imessage/message-audio";
import type { Direction } from "@/registry/imessage/tokens";
import type { Platform } from "@/registry/imessage/platform";
import { songPreview } from "@/lib/showcase";

export function AudioPreview({ direction = "outgoing", platform = "ios", tail = true }: { direction?: Direction; platform?: Platform; tail?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(30);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState("");
  async function play(next: boolean) {
    const element = audio.current;
    if (!element) return;
    if (!next) { element.pause(); return; }
    setError("");
    if (element.ended) element.currentTime = 0;
    try { await element.play(); }
    catch { setError("The preview couldn’t play. Try again or listen on Apple Music."); }
  }
  function seek(seconds: number) {
    const element = audio.current;
    if (!element || !Number.isFinite(element.duration)) return;
    element.currentTime = Math.min(element.duration, Math.max(0, seconds));
    setPosition(element.currentTime);
  }
  return <div className="audio-example">
    <audio ref={audio} src={songPreview.src} preload="metadata" aria-label={`${songPreview.title} by ${songPreview.artist}`}
      onLoadedMetadata={event => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration); }}
      onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onError={() => { setPlaying(false); setError("Preview unavailable. Listen on Apple Music."); }} />
    <MessageAudio direction={direction} platform={platform} tail={tail} duration={duration} position={position} playing={playing} onPlayChange={play} onSeek={seek} />
    {error && <p role="alert" className="audio-error">{error}</p>}
  </div>;
}
