"use client";

import { useState } from "react";
import { PhotoPicker, photoPickerMetrics, type PhotoPickerPhoto } from "@/registry/imessage/photo-picker";

const fixtures: PhotoPickerPhoto[] = [
  { id: "bloom", src: "/fixtures/bloom.jpg", alt: "Bloom" },
  { id: "dusk", src: "/fixtures/dusk.jpg", alt: "Dusk" },
  { id: "frost", src: "/fixtures/frost.jpg", alt: "Frost" },
  { id: "ridge", src: "/fixtures/ridge.jpg", alt: "Ridge" },
  { id: "shore", src: "/fixtures/shore.jpg", alt: "Shore" },
  { id: "bloom2", src: "/fixtures/bloom.jpg", alt: "Bloom again" },
];

export function PpVerify({
  progress,
  startOpen,
  theme,
  ordered,
  multiple,
  useFixtures,
  many,
  initial,
}: {
  progress?: number;
  startOpen: boolean;
  theme: string;
  ordered: boolean;
  multiple: boolean;
  useFixtures: boolean;
  many: boolean;
  initial: string[];
}) {
  const [open, setOpen] = useState(startOpen);
  const [mounted, setMounted] = useState(true);
  const [exits, setExits] = useState(0);
  const [selected, setSelected] = useState<string[]>(initial);
  const [events, setEvents] = useState<string[]>([]);

  const base = useFixtures ? fixtures : undefined;
  const photos = many && base ? [...base, ...base, ...base].map((p, i) => ({ ...p, id: `${p.id}-${i}` })) : base;

  return (
    <div>
      <div
        data-testid="lab"
        className={theme}
        data-im-platform="ios"
        style={{ width: 402, height: 874, position: "relative", overflow: "hidden", background: "#f5f5f5" }}
      >
        {mounted ? (
          <PhotoPicker
            photos={photos}
            open={open}
            progress={progress}
            ordered={ordered}
            multiple={multiple}
            selected={selected}
            onSelectionChange={(next, photo, isSelected) => {
              setSelected(next);
              setEvents(prev => [...prev, `${photo.id}:${isSelected ? "on" : "off"}:${next.join("|")}`]);
            }}
            onExited={() => {
              setExits(n => n + 1);
              setMounted(false);
            }}
            style={{ top: photoPickerMetrics.top }}
          />
        ) : null}
      </div>
      <div style={{ position: "fixed", left: 420, top: 0, fontFamily: "monospace", fontSize: 12 }}>
        <button type="button" id="toggle" onClick={() => setOpen(v => !v)}>
          toggle
        </button>
        <button type="button" id="remount" onClick={() => { setMounted(true); setOpen(true); }}>
          remount
        </button>
        <div data-testid="open">{String(open)}</div>
        <div data-testid="mounted">{String(mounted)}</div>
        <div data-testid="exits">{exits}</div>
        <div data-testid="selected">{selected.join(",")}</div>
        <div data-testid="events">{events.join(" / ")}</div>
      </div>
    </div>
  );
}
