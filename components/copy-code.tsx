"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCode({ value, label = "Copy code" }: { value: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }
  return <>
    <button type="button" onClick={copy} onBlur={() => setStatus("idle")} aria-label={status === "copied" ? "Copied" : label} className="copy-button">
      {status === "copied" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
    </button>
    <span role="status" className={status === "failed" ? "copy-error" : "sr-only"}>{status === "copied" ? "Copied to clipboard" : status === "failed" ? "Select the code and copy it manually." : ""}</span>
  </>;
}

export function CodeBlock({ code, label = "tsx" }: { code: string; label?: string }) {
  return <div className="source-block"><div className="source-toolbar"><span>{label}</span><CopyCode value={code} /></div><pre><code>{code}</code></pre></div>;
}
