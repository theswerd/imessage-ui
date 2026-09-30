"use client";

import { useSyncExternalStore } from "react";
import { CopyCode } from "./copy-code";

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const serverOrigin = () => "";

/** The install URL follows the host serving the registry, including local previews. */
export function InstallCommand({ name = "message-bubble" }: { name?: string }) {
  const origin = useSyncExternalStore(subscribe, getOrigin, serverOrigin);
  const command = `npx shadcn@latest add ${origin || "https://YOUR_REGISTRY_HOST"}/r/${name}.json`;
  return <div className="install-command"><span className="install-dollar" aria-hidden="true">$</span><code>{command}</code><CopyCode value={command} label="Copy install command" /></div>;
}

export function NamespaceConfig() {
  const origin = useSyncExternalStore(subscribe, getOrigin, serverOrigin);
  const code = JSON.stringify({ registries: { "@message-ui": `${origin || "https://YOUR_REGISTRY_HOST"}/r/{name}.json` } }, null, 2);
  return <div className="source-block"><div className="source-toolbar"><span>components.json</span><CopyCode value={code} /></div><pre><code>{code}</code></pre></div>;
}
