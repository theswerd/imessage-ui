"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Check, Copy, X } from "lucide-react";

const agents = [
  { name: "Claude Code", icon: "/agents/claude-code.svg", monochrome: false },
  { name: "Codex", icon: "/agents/codex.svg", monochrome: true },
  { name: "Cursor", icon: "/agents/cursor-mark.svg", monochrome: true },
];

export function AddToAgent() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => () => clearTimeout(resetTimer.current), []);
  useEffect(() => {
    if (status) dialog.current?.showModal();
  }, [status]);
  async function copy() {
    const text = `Read ${window.location.origin}/onboard.md and install the Message UI skill. Use it when building Messages-style interfaces in my projects.`;
    setPrompt(text);
    clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      dialog.current?.close();
      resetTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setStatus("Select the prompt below and copy it manually.");
    }
  }
  return <>
    <button ref={trigger} type="button" className="agent-button agent-install-button" aria-label={copied ? "Copied" : "Copy prompt for your agent"} aria-live="polite" onClick={copy}>
      <span className="agent-logos" aria-hidden="true">{agents.map(agent => <span className="agent-logo" key={agent.name} title={agent.name}><Image className={agent.monochrome ? "agent-logo-monochrome" : undefined} src={agent.icon} alt="" width={20} height={20} unoptimized /></span>)}</span>
      <span className="relative"><span className={copied ? "invisible" : undefined}>Copy prompt for your agent</span>{copied && <span className="absolute inset-0 flex items-center justify-center gap-1.5"><Check size={14} aria-hidden="true" />Copied</span>}</span>
    </button>
    <dialog ref={dialog} onClose={() => { setStatus(""); trigger.current?.focus(); }} className="agent-dialog" aria-labelledby="agent-setup-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="agent-dialog-content"><button className="icon-button dialog-close" type="button" aria-label="Close agent setup" onClick={() => dialog.current?.close()}><X size={18} /></button>
        <h2 id="agent-setup-title">Add to your agent</h2>
        <label htmlFor="agent-prompt">Paste into your agent</label><textarea id="agent-prompt" autoFocus readOnly value={prompt} onFocus={event => event.currentTarget.select()} />
        <button type="button" className="agent-button" onClick={copy}><Copy size={15} /> Copy agent prompt</button>
        <p className="agent-status" role="status">{status}</p>
        <a href="/onboard.md" target="_blank" rel="noreferrer" className="onboard-link">Read onboard.md <ArrowUpRight size={13} /></a>
      </div>
    </dialog>
  </>;
}
