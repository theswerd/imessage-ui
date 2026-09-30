"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { previewSizes, type PreviewSize } from "@/lib/preview-sizes";

export function usePhonePreview(fullHeight = false, fitKeyboard = false, size: PreviewSize = "auto", enabled = true, layout: "playground" | "standalone" = "playground") {
  const frame = useRef<HTMLDivElement>(null);
  const [screenHeight, setScreenHeight] = useState(680);
  const screenWidth = previewSizes[size].width;
  useLayoutEffect(() => {
    const element = frame.current!;
    element.style.removeProperty("width");
    element.style.removeProperty("max-width");
    if (!enabled) return;
    const preset = size === "auto" ? null : previewSizes[size];
    element.style.width = `${screenWidth + 2}px`;
    element.style.setProperty("--phone-width", `${screenWidth}px`);
    let settlingFocus = false;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const fit = () => {
      if (settlingFocus) return;
      const playground = element.closest(".playground");
      const toolbar = playground?.querySelector<HTMLElement>(".playground-toolbar");
      const canvas = element.closest(".preview-canvas") ?? element.parentElement!;
      const padding = getComputedStyle(canvas);
      const top = (playground ?? canvas).getBoundingClientRect().top + window.scrollY + (toolbar?.offsetHeight ?? 0);
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const editing = fitKeyboard && element.contains(document.activeElement) && document.activeElement?.matches("input, textarea");
      // Safari pans while the software keyboard is open. Cap the preview to the visible height;
      // adding offsetTop here would grow it back underneath the keyboard as Safari pans upward.
      const available = editing
        ? viewportHeight - Math.max(0, element.getBoundingClientRect().top) - 12
        : viewportHeight - top - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom) - 20;
      if (layout === "playground" && fullHeight && !preset) element.style.maxWidth = `min(100%, ${Math.max(200, Math.min(402, available * 402 / 874 + 2))}px)`;
      if (layout === "playground" && preset && !editing) element.style.maxWidth = `min(100%, ${Math.min(screenWidth + 2, Math.max(200, available) * screenWidth / preset.height + 2)}px)`;
      const scale = (element.clientWidth - 2) / screenWidth;
      element.style.setProperty("--phone-scale", String(scale));
      // Keep text at its width-based scale. Short windows get a shorter, scrollable transcript.
      // The photo viewer keeps the native 402 x 874 canvas, fitted as a whole into its preview.
      const height = preset
        ? editing ? Math.max(260, Math.min(preset.height, Math.floor(available / scale))) : preset.height
        : fullHeight ? 874 : Math.max(editing ? 260 : 560, Math.min(680, Math.floor(available / scale)));
      element.style.setProperty("--phone-height", `${height}px`);
      setScreenHeight(height);
    };
    const focusIn = () => {
      if (!document.activeElement?.matches("input, textarea")) return;
      clearTimeout(focusTimer); settlingFocus = false; fit();
    };
    const focusOut = () => {
      // A touch blurs Safari's input before it dispatches the click. Resizing between those
      // events moves the tapped result or composer away from the finger and loses the click.
      settlingFocus = true;
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => { settlingFocus = false; fit(); }, 180);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    if (fitKeyboard) {
      window.visualViewport?.addEventListener("scroll", fit);
      element.addEventListener("focusin", focusIn);
      element.addEventListener("focusout", focusOut);
    }
    return () => {
      observer.disconnect(); window.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
      element.removeEventListener("focusin", focusIn); element.removeEventListener("focusout", focusOut);
      clearTimeout(focusTimer);
    };
  }, [fullHeight, fitKeyboard, size, screenWidth, enabled, layout]);
  return { frame, screenHeight, screenWidth };
}
