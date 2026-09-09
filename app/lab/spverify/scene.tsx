"use client";

import { useState } from "react";
import { StickerPicker } from "@/registry/imessage/sticker-picker";
import { fontStack } from "@/registry/imessage/tokens";

export function SpScene({ theme, tab, progress, open, query }: { theme: string; tab: string; progress?: number; open: boolean; query: string }) {
  const [log, setLog] = useState("");
  const [exited, setExited] = useState(false);
  return (
    <div className={theme === "dark" ? "dark" : undefined} style={{ fontFamily: fontStack }}>
      <div data-log={log} data-exited={exited ? "yes" : "no"} style={{ position: "relative", width: 402, height: 874, overflow: "hidden", background: theme === "dark" ? "#000000" : "#ffffff" }}>
        <div style={{ position: "absolute", inset: 0, padding: 24, color: theme === "dark" ? "#888" : "#bbb", fontSize: 17 }}>
          {Array.from({ length: 18 }, (_, i) => <p key={i} style={{ margin: "10px 0" }}>Conversation text behind the sheet {i + 1}</p>)}
        </div>
        <StickerPicker
          defaultTab={tab}
          defaultQuery={query}
          progress={progress}
          open={open}
          onPlace={(s, p) => setLog(`place:${s.id}:${Math.round(p.x)},${Math.round(p.y)}:${p.rotation.toFixed(2)}:${p.size.toFixed(2)}`)}
          onSelect={s => setLog(`select:${s.id}`)}
          onDismiss={() => setLog("dismiss")}
          onExited={() => setExited(true)}
        />
      </div>
    </div>
  );
}
