"use client";

import { useEffect, useId, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * iOS 26 "New Message" sheet, measured from `references/ios/captures/newmsg-light.png` (402×874).
 * Rendered as an overlay inside the screen frame: the presenting screen is dimmed by 20% black
 * (white becomes #cccccc; the status bar stays visible under the dim, as on the device); the sheet
 * starts at y 62 with 38pt round top corners. Title 17pt bold with its cap height centered on
 * y 100; X glass button Ø44 centered (364, 100) with a 17.33pt cross; "To:" field x 16–386,
 * y 142–190 (continuous corners, radius 24) with 15pt text and a Ø27.67 #e7e7e8 "+" button centered
 * (360.67, 167.17). `children` render at the sheet's bottom (the capture shows the composer there).
 *
 * The "To:" field is not the same glass as the X button: the button's fill reads a flat #ffffff over
 * the sheet while the field reads #fdfdfd under a 0.67pt pure-white rim inset on all four sides
 * (measured on every edge of `newmsg-light.png`), which is why it carries its own fill and rim vars.
 * Dark values are standard system colors, not measured.
 */
export type IosNewMessageSheetProps = Omit<ComponentProps<"div">, "onChange"> & {
  title?: string;
  value?: string;
  onChange?: (value: string) => void;
  onClose?: () => void;
  onAddContact?: () => void;
  /** Draw a static caret in the "To:" field (the capture shows one although the field is idle). */
  caret?: boolean;
  children?: ReactNode;
};

const font = "-apple-system, BlinkMacSystemFont, sans-serif";

const vars =
  "[--ios-nm-dim:rgba(0,0,0,0.2)] [--ios-nm-sheet:#ffffff] [--ios-nm-label:#000000] [--ios-nm-glyph:#1a1919] [--ios-nm-glass:rgba(255,255,255,0.9)] [--ios-nm-rim:none] [--ios-nm-shadow:0_6px_36px_4px_rgba(0,0,0,0.065)] [--ios-nm-shadow-round:0_5px_20px_6px_rgba(0,0,0,0.055)] " +
  "[--ios-nm-to:#8a8a8a] [--ios-nm-plus:#e7e7e8] [--ios-nm-plus-glyph:#000000] [--ios-nm-caret:#ced8fa] " +
  "dark:[--ios-nm-dim:rgba(0,0,0,0.5)] dark:[--ios-nm-sheet:#1c1c1e] dark:[--ios-nm-label:#ffffff] dark:[--ios-nm-glyph:#f4f3f4] dark:[--ios-nm-glass:rgba(44,44,46,0.9)] dark:[--ios-nm-rim:inset_0_0_0_1px_rgba(255,255,255,0.09)] dark:[--ios-nm-shadow:none] dark:[--ios-nm-shadow-round:none] " +
  "dark:[--ios-nm-to:#8d8d93] dark:[--ios-nm-plus:#3a3a3c] dark:[--ios-nm-plus-glyph:#ffffff] dark:[--ios-nm-caret:#3a4a7a]";

/** Apple's continuous corner (superellipse n≈2.2). Browsers without corner-shape fall back to round. */
const capsule = { cornerShape: "superellipse(1.14)" } as CSSProperties;

/** `clip` stops the shadow at the midpoint of the 12pt gap toward a neighboring glass element, so the two shadows read as one (they never add up on the device). */
function GlassLayers({ round = false, clip }: { round?: boolean; clip?: "left" | "right" }) {
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] [corner-shape:inherit]" style={{ boxShadow: round ? "var(--ios-nm-shadow-round)" : "var(--ios-nm-shadow)", clipPath: clip ? `inset(-60px ${clip === "right" ? "-6px" : "-60px"} -60px ${clip === "left" ? "-6px" : "-60px"})` : undefined }} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] [corner-shape:inherit]" style={{ background: "var(--ios-nm-glass)", boxShadow: "var(--ios-nm-rim)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }} />
    </>
  );
}

export function IosNewMessageSheet({ title = "New Message", value, onChange, onClose, onAddContact, caret = false, children, className, style, ...props }: IosNewMessageSheetProps) {
  const id = useId();
  // Escape dismisses the sheet, the same as the close button.
  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div data-slot="ios-new-message-sheet" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      className={cn("absolute inset-0 select-none", vars, className)} style={{ fontFamily: font, background: "var(--ios-nm-dim)", ...style }} {...props}>
      <div data-slot="sheet" className="absolute isolate" style={{ top: 62, left: 0, right: 0, bottom: 0, borderRadius: "38px 38px 0 0", background: "var(--ios-nm-sheet)" }}>
        <h2 id={`${id}-title`} data-slot="title" className="absolute m-0 text-center" style={{ left: 0, right: 0, top: 29.6667, fontSize: 17, lineHeight: 1, fontWeight: 700, letterSpacing: 0, color: "var(--ios-nm-label)" }}>
          {title}
        </h2>
        <button type="button" data-slot="close" aria-label="Close" onClick={onClose}
          className="absolute flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-blue-500"
          style={{ right: 16, top: 16, width: 44, height: 44 }}>
          <GlassLayers round />
          <svg aria-hidden="true" className="relative" width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="var(--ios-nm-glyph)" strokeWidth="2.1" strokeLinecap="round">
            <path d="M14.05 14.72 29.28 29.95M29.28 14.72 14.05 29.95" />
          </svg>
        </button>
        <div data-slot="to-field" className="absolute flex items-center rounded-full [--ios-nm-glass:#fdfdfd] [--ios-nm-rim:inset_0_0_0_0.6667px_#ffffff] dark:[--ios-nm-glass:rgba(44,44,46,0.9)] dark:[--ios-nm-rim:inset_0_0_0_1px_rgba(255,255,255,0.09)]" style={{ left: 16, right: 16, top: 80, height: 48, paddingLeft: 14, ...capsule }}>
          <GlassLayers />
          <label htmlFor={`${id}-to`} data-slot="to-label" className="relative" style={{ transform: "translateY(-0.6667px)", fontSize: 15, lineHeight: 1, letterSpacing: 0, color: "var(--ios-nm-to)" }}>To:</label>
          {caret && <span aria-hidden="true" data-slot="caret" className="relative origin-left" style={{ marginLeft: 7, width: 2, height: 20, transform: "translateX(-0.3333px) scaleX(0.8333)", background: "var(--ios-nm-caret)", borderRadius: 1 }} />}
          <input id={`${id}-to`} type="text" autoComplete="off" value={value} onChange={event => onChange?.(event.target.value)}
            className="relative min-w-0 flex-1 border-0 bg-transparent outline-none select-text"
            style={{ marginLeft: caret ? 2 : 6, marginRight: 48, height: 20, padding: 0, fontFamily: font, fontSize: 15, lineHeight: "20px", color: "var(--ios-nm-label)", caretColor: "#0088ff" }} />
          <button type="button" data-slot="add" aria-label="Add contact" onClick={onAddContact}
            className="absolute flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-blue-500"
            style={{ right: 11.6667, top: 11.3333, width: 27.6667, height: 27.6667, background: "var(--ios-nm-plus)" }}>
            <svg aria-hidden="true" width="27.6667" height="27.6667" viewBox="0 0 27.6667 27.6667" fill="none" stroke="var(--ios-nm-plus-glyph)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M8.27 13.83H19.4M13.83 8.27V19.4" />
            </svg>
          </button>
        </div>
        {children && <div data-slot="footer" className="absolute" style={{ left: 0, right: 0, bottom: 0 }}>{children}</div>}
      </div>
    </div>
  );
}
