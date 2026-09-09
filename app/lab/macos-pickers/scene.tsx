"use client";

import { useEffect } from "react";
import { PhotoPicker, macPhotoPickerMetrics } from "@/registry/imessage/photo-picker";
import { StickerPicker, macStickerPickerMetrics } from "@/registry/imessage/sticker-picker";
import { macComposerMetrics } from "@/registry/imessage/macos-composer";

export type PickerScene = "photos" | "stickers";

/** The pane the two macOS pane captures are of: the window less its sidebar, 630 x 640. */
export const paneSize = { width: 630, height: 640 };

/**
 * A bare macOS pane with nothing in it but the "+" button and one picker.
 *
 * The app shell (`/harness?platform=macos&scene=photo-picker`) is where the popovers are reviewed in
 * place. This route exists for the other half of the contract: it stands each picker up **outside**
 * `macos-messages-app.tsx`, with no popover wrapper drawn for it and no props but `platform`, which
 * is the only way to see that the component owns its own presentation rather than borrowing the
 * shell's. It is also where the anchoring can be moved: `?plus=` slides the "+" button, and the
 * popover and its arrow have to follow, because the button is looked up in the DOM rather than
 * assumed.
 *
 * The composer here is a stand-in and is deliberately *not* `MacComposer`: only the one attribute
 * the pickers anchor to — `data-slot="attach-button"` — and the button's own measured box
 * (`macComposerMetrics.plus`, 30 square at left 9, 11 up from the composer's bottom) matter, and a
 * stand-in makes it obvious that nothing else is being leaned on.
 */
export function PickerScene({
  scene,
  theme,
  progress,
  open,
  plus,
}: {
  scene: PickerScene;
  theme: "light" | "dark";
  progress?: number;
  open: boolean;
  plus?: number;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    return () => root.classList.remove("dark");
  }, [theme]);

  const plusLeft = plus ?? macComposerMetrics.plus.left;
  return (
    <div
      data-im-platform="macos"
      className="relative overflow-hidden"
      style={{ width: paneSize.width, height: paneSize.height, background: theme === "dark" ? "#1e1e1e" : "#ffffff" }}
    >
      {/* Something for the popover's blur to have behind it, and a ruler for where its edges land. */}
      <div aria-hidden="true" className="absolute inset-x-0" style={{ top: 120, height: 360, background: theme === "dark" ? "linear-gradient(120deg,#2a3a55,#4b2f52)" : "linear-gradient(120deg,#cfe0ff,#ffd9e8)" }} />

      <div className="absolute inset-x-0 bottom-0" style={{ height: macComposerMetrics.bottom + macComposerMetrics.field.height + 10 }}>
        <button
          type="button"
          data-slot="attach-button"
          aria-label="Add attachment"
          className="absolute flex items-center justify-center rounded-full border-0 bg-[#ffffff] shadow-[0_5px_25px_rgba(0,0,0,0.07)] dark:bg-[#232323]"
          style={{ left: plusLeft, bottom: macComposerMetrics.bottom, width: macComposerMetrics.plus.size, height: macComposerMetrics.plus.size }}
        >
          <svg aria-hidden="true" viewBox="0 0 30 30" width="30" height="30" fill="none" stroke={theme === "dark" ? "#f1f1f1" : "#000000"} strokeWidth="1.7" strokeLinecap="round">
            <path d="M14.8 9.74v10.88M9.36 15.2h10.88" />
          </svg>
        </button>
      </div>

      {scene === "photos" ? (
        <PhotoPicker platform="macos" open={open} progress={progress} defaultSelected={["bloom", "falls"]} />
      ) : (
        <StickerPicker platform="macos" open={open} progress={progress} defaultTab="emoji" scrim={false} />
      )}
    </div>
  );
}

/** Re-exported so the page can print the boxes it is about to draw without importing both pickers. */
export const boxes = { photos: macPhotoPickerMetrics, stickers: macStickerPickerMetrics };
