"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

const reducedMotionQuery = () => (typeof window === "undefined" ? null : window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null);
function subscribeReducedMotion(onChange: () => void) {
  const query = reducedMotionQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}
/** True when the viewer prefers reduced motion; false during server rendering. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, () => reducedMotionQuery()?.matches ?? false, () => false);
}

/**
 * iOS-style long press (see references/SPEC.md "iOS long-press"): 500 ms hold with the bubble
 * scaling up slightly over the hold, cancelled by 8 px of movement. Right-click, double-click and
 * the keyboard (Enter, Space, Shift+F10, ContextMenu) open the same actions immediately.
 */
export type LongPressOptions = {
  onLongPress: (origin: { x: number; y: number; source: "press" | "contextmenu" | "dblclick" | "keyboard" }) => void;
  onCancel?: () => void;
  /** Hold duration in ms (native ≈ 500). */
  threshold?: number;
  /** Pointer travel that cancels the press, in px (native 8). */
  moveTolerance?: number;
  /** Scale reached at the end of the hold (a subtle 1.03 native). */
  holdScale?: number;
  disabled?: boolean;
};

export function useLongPress({ onLongPress, onCancel, threshold = 500, moveTolerance = 8, holdScale = 1.03, disabled = false }: LongPressOptions) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const fired = useRef(false);
  const reduced = useReducedMotion();

  const clear = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; }, []);
  const cancel = useCallback(() => { const was = timer.current !== null; clear(); setHolding(false); if (was) onCancel?.(); }, [clear, onCancel]);
  useEffect(() => () => clear(), [clear]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (disabled || event.button !== 0) return;
    clear(); fired.current = false; origin.current = { x: event.clientX, y: event.clientY };
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null; fired.current = true; setHolding(false);
      onLongPress({ x: origin.current.x, y: origin.current.y, source: "press" });
    }, threshold);
  }, [disabled, clear, threshold, onLongPress]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (timer.current && Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > moveTolerance) cancel();
  }, [moveTolerance, cancel]);

  const onPointerUp = useCallback(() => { if (timer.current) cancel(); else setHolding(false); }, [cancel]);
  const onContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    if (disabled) return;
    event.preventDefault(); clear(); setHolding(false);
    if (!fired.current) onLongPress({ x: event.clientX, y: event.clientY, source: "contextmenu" });
    fired.current = false;
  }, [disabled, clear, onLongPress]);
  const onDoubleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (disabled) return;
    if (!fired.current) onLongPress({ x: event.clientX, y: event.clientY, source: "dblclick" });
    fired.current = false;
  }, [disabled, onLongPress]);
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " " || event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      onLongPress({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, source: "keyboard" });
    }
  }, [disabled, onLongPress]);

  /** Apply to the pressed element: the slow scale-up over the hold, snapping back on cancel. */
  const holdStyle: CSSProperties = reduced ? {} : {
    transform: holding ? `scale(${holdScale})` : "scale(1)",
    transition: holding ? `transform ${threshold}ms cubic-bezier(0.4, 0, 0.9, 0.6)` : "transform 160ms ease-out",
    willChange: holding ? "transform" : undefined,
  };

  return {
    holding,
    holdStyle,
    cancel,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancel, onPointerLeave: cancel, onContextMenu, onDoubleClick, onKeyDown },
    /** Accessibility attributes for the pressable element. */
    a11y: { role: "button" as const, tabIndex: 0, "aria-haspopup": "menu" as const },
  };
}
