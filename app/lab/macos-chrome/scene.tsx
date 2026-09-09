"use client";

import { useState } from "react";
import { MacWindow } from "@/registry/imessage/macos-window";
import { MacSidebar, type SidebarConversation } from "@/registry/imessage/macos-sidebar";
import { MacHeader } from "@/registry/imessage/macos-header";
import { MacComposer } from "@/registry/imessage/macos-composer";
import { MacPlusMenu, macPlusMenuMetrics } from "@/registry/imessage/macos-plus-menu";
import { macWindowMetrics } from "@/registry/imessage/macos-window";

/** Fixture conversations only. "Ben" is the label the native capture shows in the header pill. */
const conversations: SidebarConversation[] = [
  { id: "freestyle", name: "Freestyle", initials: "F", preview: "Deploy finished. Every detail, down to the last bubble.", time: "1:47 AM", pinned: true },
  { id: "ben", name: "Ben", initials: "B", preview: "Every detail, down to the last bubble.", time: "1:47 AM" },
  { id: "alex", name: "Alex Morgan", initials: "AM", preview: "Hey! How's the new project going? It's all in the little details.", time: "Yesterday" },
  { id: "jamie", name: "Jamie Chen", initials: "JC", preview: "Sounds good 👍", time: "Tuesday" },
  { id: "sam", name: "Sam Rivera", initials: "SR", preview: "Tuesday morning at 9?", time: "Monday", muted: true },
];

export type MacChromeSceneProps = {
  scene: "window" | "pane" | "plus-menu";
  theme: "light" | "dark";
  active: boolean;
  text: string;
  focus: boolean;
  menu?: boolean;
  ox: number;
  oy: number;
};

export function MacChromeScene({ scene, theme, active, text, focus, menu = false, ox, oy }: MacChromeSceneProps) {
  const [selected, setSelected] = useState("ben");
  const [sent, setSent] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(menu || scene === "plus-menu");
  // The "+" popover hangs 200 pt below the window, so the window scene grows to show it when it is open.
  const size = scene === "pane" ? { width: 630, height: 640 } : scene === "plus-menu" ? { width: 200, height: 270 } : { width: 960, height: menu ? 860 : 640 };
  return (
    <div data-testid="lab" className={theme} style={{ ...size, position: "relative", overflow: "hidden", background: theme === "dark" ? "#1a1d21" : "#d4d4d4" }}>
      <div style={{ position: "absolute", left: ox, top: oy }}>
        <MacWindow
          active={active}
          sidebar={<MacSidebar conversations={conversations} selectedId={selected} onSelect={setSelected} active={active} footer="Syncing with iCloud Paused" />}
          content={
            <div data-slot="pane" className="relative h-full w-full">
              {/* The sidebar edge casts a soft shadow onto the pane (measured: 12/255 at x 0 fading out by x 25). */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-[25px]" style={{ background: theme === "dark" ? "linear-gradient(to right, rgba(0,0,0,0.07), rgba(0,0,0,0))" : "linear-gradient(to right, rgba(0,0,0,0.045), rgba(0,0,0,0))" }} />
              <MacHeader name="Ben" initials="B" />
              <ul aria-label="Messages" className="sr-only">{sent.map((message, index) => <li key={index}>{message}</li>)}</ul>
              <MacComposer defaultValue={text} autoFocus={focus} attachExpanded={menuOpen} onAttach={() => setMenuOpen(open => !open)} onSend={message => setSent(list => [...list, message])} />
            </div>
          }
        />
        {/* Popovers are separate windows natively, so the menu lives outside the window's clipped box. */}
        <MacPlusMenu open={menuOpen} left={macWindowMetrics.sidebarWidth + macPlusMenuMetrics.left} top={macPlusMenuMetrics.top} onClose={() => setMenuOpen(false)} onSelect={() => setMenuOpen(false)} />
      </div>
    </div>
  );
}
