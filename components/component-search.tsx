"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpLeft, Search, X } from "lucide-react";
import { componentHref, componentSearchItems } from "@/lib/site-catalog";

export function ComponentSearch() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();
  const terms = query.toLowerCase().trim().split(/[\s-]+/).filter(Boolean);
  const items = componentSearchItems.filter(item => terms.every(term => `${item.name} ${item.title}`.toLowerCase().includes(term)));

  const show = useCallback(() => {
    if (document.querySelector("dialog[open]")) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setActive(0);
    setOpen(true);
    dialog.current?.showModal();
    input.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !event.isComposing) {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else show();
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [show]);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const update = () => dialog.current?.style.setProperty("--search-viewport-height", `${viewport?.height ?? innerHeight}px`);
    update();
    viewport?.addEventListener("resize", update);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      viewport?.removeEventListener("resize", update);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  function choose(name: string) {
    dialog.current?.close();
    router.push(componentHref(name));
  }

  return <>
    <button ref={trigger} type="button" className="search-trigger" aria-label="Search components" aria-keyshortcuts="Meta+K Control+K" aria-haspopup="dialog" aria-expanded={open} onClick={() => { show(); previousFocus.current = trigger.current; }}>
      <Search size={17} aria-hidden="true" /><kbd>⌘ K</kbd>
    </button>
    <dialog ref={dialog} className="component-search-dialog" aria-label="Search components" onClose={() => {
      setOpen(false);
      const target = previousFocus.current?.isConnected ? previousFocus.current : trigger.current;
      target?.focus({ preventScroll: true });
    }} onClick={event => {
      if (event.target === dialog.current) {
        const bounds = dialog.current.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current.close();
      }
    }}>
      <div className="search-dialog-field"><Search size={20} aria-hidden="true" />
        <input ref={input} type="search" role="combobox" aria-label="Search components" placeholder="Search components…" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-results`} aria-activedescendant={items[active] ? `${id}-${items[active].name}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            dialog.current?.close();
          } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && items.length) {
            event.preventDefault();
            const next = (active + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            setActive(next);
            document.getElementById(`${id}-${items[next].name}`)?.scrollIntoView({ block: "nearest" });
          } else if (event.key === "Enter" && items[active]) {
            event.preventDefault();
            choose(items[active].name);
          }
        }} />
        <button type="button" className="icon-button" aria-label="Close search" onClick={() => dialog.current?.close()}><X size={18} /></button>
      </div>
      <div className="search-results" id={`${id}-results`} role="listbox" aria-label="Components">
        {items.map((item, index) => <button type="button" role="option" id={`${id}-${item.name}`} key={item.name} aria-selected={active === index} tabIndex={-1} onPointerMove={event => { if (event.pointerType === "mouse") setActive(index); }} onClick={() => choose(item.name)}><span>{item.title}</span><ArrowUpLeft size={15} aria-hidden="true" /></button>)}
      </div>
      {!items.length && <p className="search-empty" role="status">No components found.</p>}
    </dialog>
  </>;
}
