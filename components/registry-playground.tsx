"use client";

import { useState, type CSSProperties } from "react";
import { Check, Code2, Info, Pause, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import { IosNavBar } from "@/registry/imessage/ios-nav-bar";
import { IosStatusBar } from "@/registry/imessage/ios-status-bar";
import { PaletteStyle } from "@/registry/imessage/palette";
import { palettes, paletteVars } from "@/registry/imessage/tokens";
import { showcasePhotos, songPreview } from "@/lib/showcase";
import { siteComponents } from "@/lib/site-catalog";
import { CodeBlock } from "./copy-code";
import { ComponentPreview, ConversationDemo, type PreviewOptions } from "./registry-preview";

import { ConversationListPreview } from "./conversation-list-preview";
import { usePhonePreview } from "./use-phone-preview";
import { previewSizes, type PreviewSize } from "@/lib/preview-sizes";

const availablePreviews = new Set<string>(siteComponents.map(([name]) => name));
const presets = [
  { name: "Blue", color: "#007aff" }, { name: "Matcha", color: "#388464" },
  { name: "Iris", color: "#7c59d9" }, { name: "Rose", color: "#bf4c77" }, { name: "Sunset", color: "#b96535" },
];
function ink(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  return r * .2126 + g * .7152 + b * .0722 > .179 ? "#000000" : "#ffffff";
}

export function RegistryPlayground({ name, usage }: { name: string; usage?: string }) {
  const [size, setSize] = useState<PreviewSize>("standard");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [view, setView] = useState<"preview" | "code">(availablePreviews.has(name) ? "preview" : "code");
  const [revision, setRevision] = useState(0);
  const [inspector, setInspector] = useState(false);
  const [unread, setUnread] = useState(true);
  const [groups, setGroups] = useState(true);
  const [rowCount, setRowCount] = useState(6);
  const [typingPaused, setTypingPaused] = useState(false);
  const defaults: PreviewOptions = { platform: "ios", direction: "outgoing", tail: true, text: name === "link-preview" ? "A weekend in the Dolomites" : "Meet me where the mountains are. 🏔️", photo: 0, photoCount: 1, richLink: true };
  const [options, setOptions] = useState(defaults);
  const native = palettes[options.platform][theme];
  const style = { ...paletteVars(native), ...(outgoing ? { "--im-blue-top": outgoing, "--im-blue-bottom": outgoing, "--im-outgoing-text": ink(outgoing) } : {}), ...(incoming ? { "--im-gray-top": incoming, "--im-gray-bottom": incoming, "--im-incoming-text": ink(incoming) } : {}), ...(background ? { "--im-bg": background } : {}) } as CSSProperties;
  const customVars = Object.fromEntries(Object.entries(style).filter(([key, value]) => value !== paletteVars(native)[key]));
  const list = name === "ios-conversation-list";
  const contact = name === "ios-details";
  const conversation = ["ios-messages-app", "conversation", "ios-composer", "image-viewer", "ios-conversation-list", "ios-details"].includes(name);
  const viewer = name === "image-viewer";
  const photo = name === "message-image";
  const link = name === "link-preview";
  const typing = name === "typing-indicator";
  const editableText = ["message-bubble", "tapback", "link-preview"].includes(name);
  const customize = availablePreviews.has(name);
  const sample = name === "message-bubble" ? `import { MessageBubble } from "@/components/message-ui/message-bubble";\n\n<MessageBubble direction="${options.direction}" tail={${options.tail}} platform="${options.platform}">\n  {${JSON.stringify(options.text)}}\n</MessageBubble>` :
    link ? `import { LinkPreview } from "@/components/message-ui/link-preview";\n\n<LinkPreview\n  href="https://www.visitdolomites.com/"\n  title={${JSON.stringify(options.text)}}\n  platform="${options.platform}"${options.richLink ? `\n  image="${showcasePhotos[options.photo].src}"\n  imageAlt={${JSON.stringify(showcasePhotos[options.photo].alt)}}` : ""}\n/>` :
    photo ? `import { MessageImages } from "@/components/message-ui/message-image";\n\n<MessageImages\n  direction="${options.direction}"\n  platform="${options.platform}"\n  tail={${options.tail}}\n  images={${JSON.stringify(Array.from({ length: options.photoCount }, (_, i) => showcasePhotos[(options.photo + i) % 3]), null, 2)}}\n  onOpenImage={(index, rect) => openViewer(index, rect)}\n/>` : name === "message-audio" ? usage?.replace("<MessageAudio duration", `<MessageAudio direction="${options.direction}" platform="${options.platform}" tail={${options.tail}} duration`) : usage;
  const configCode = `import type { CSSProperties } from "react";\nimport { PaletteStyle } from "@/components/message-ui/palette";\n\n<div className="${theme}"${theme === "light" ? ' data-preview-theme="light"' : ""}>\n  <div data-im-platform="${options.platform}" style={${JSON.stringify(customVars, null, 2)} as CSSProperties}>\n    <PaletteStyle platform="${options.platform}" />\n    {/* Place your components here. */}\n  </div>\n</div>\n${conversation ? "\n// App shells include PaletteStyle. Pass the same style object\n// directly to IosMessagesApp to customize its palette.\n" : ""}`;
  function reset() { setSize("standard"); setTheme("light"); setOutgoing(null); setIncoming(null); setBackground(null); setOptions(defaults); setUnread(true); setGroups(true); setRowCount(6); setTypingPaused(false); setRevision(value => value + 1); }
  const option = <K extends keyof PreviewOptions>(key: K, value: PreviewOptions[K]) => setOptions(current => ({ ...current, [key]: value }));
  return <section className="playground" aria-label="Component playground">
    <div className="playground-toolbar"><div className="view-tabs" aria-label="Example view">{customize && <button type="button" aria-pressed={view === "preview"} onClick={() => setView("preview")}>Preview</button>}<button type="button" aria-pressed={view === "code"} onClick={() => setView("code")}><Code2 size={13} /> Code</button></div><div className="playground-tools">{name === "message-audio" && <a className="icon-button" href={songPreview.url} target="_blank" rel="noreferrer" aria-label="Audio preview source: Never Gonna Give You Up by Rick Astley on Apple Music" title="Audio source on Apple Music"><Info size={14} /></a>}{customize && <><button type="button" className="icon-button" aria-label="Reset preview" onClick={reset}><RotateCcw size={14} /></button><button type="button" className="icon-button inspector-toggle" aria-label="Customize preview" aria-expanded={inspector} onClick={() => setInspector(!inspector)}><SlidersHorizontal size={16} /><span>Customize</span></button></>}</div></div>
    {view === "preview" ? <div className="playground-body">
      <div className={`preview-canvas ${conversation ? "conversation-canvas" : ""}`}>
        <div data-preview-theme={theme} className={`preview-theme ${theme}`} style={{ colorScheme: theme }}>
          {list ? <ConversationListPreview key={revision} size={size} theme={theme} unread={unread} groups={groups} count={rowCount} /> : conversation ? <ConversationDemo key={`${revision}-${viewer ? options.photo : "conversation"}`} size={size} theme={theme} palette={style} composerDemo={name === "ios-composer"} contactDemo={contact} viewerPhoto={viewer ? options.photo : undefined} /> : <SizedComponentPreview size={size} name={name} options={options} palette={style} revision={revision} typingPaused={typingPaused} />}
        </div>
      </div>
      <aside className={`preview-inspector ${inspector ? "is-open" : ""}`} aria-label="Customize preview"><div className="inspector-heading"><SlidersHorizontal size={14} /><h2>Customize</h2></div>
        <fieldset><legend>Appearance</legend><div className="segmented-control">{(["light", "dark"] as const).map(mode => <button type="button" key={mode} aria-pressed={theme === mode} onClick={() => setTheme(mode)}>{mode === "light" ? "Light" : "Dark"}</button>)}</div></fieldset>
        <fieldset><legend>Size</legend><div className="preview-sizes">{(Object.entries(previewSizes) as [PreviewSize, typeof previewSizes[PreviewSize]][]).map(([id, preset]) => <button type="button" key={id} aria-pressed={size === id} onClick={() => setSize(id)}><span>{preset.label}</span><small>{id === "auto" ? "Fit preview" : `${preset.width} × ${preset.height}`}</small></button>)}</div></fieldset>
        {typing && <fieldset><legend>Animation</legend><button type="button" className="animation-control" onClick={() => setTypingPaused(value => !value)}>{typingPaused ? <Play size={14} /> : <Pause size={14} />}{typingPaused ? "Play animation" : "Pause animation"}</button></fieldset>}
        {!viewer && !list && !contact && !typing && <><fieldset><legend>Bubble color <span>{presets.find(p => p.color === (outgoing ?? "#007aff"))?.name ?? "Custom"}</span></legend><div className="color-presets">{presets.map(preset => <button key={preset.name} type="button" style={{ background: preset.color }} aria-label={`${preset.name} color preset`} aria-pressed={preset.color === (outgoing ?? "#007aff")} onClick={() => setOutgoing(preset.name === "Blue" ? null : preset.color)}>{preset.color === (outgoing ?? "#007aff") && <Check size={13} />}</button>)}</div></fieldset>
        <div className="color-inputs">{[["Outgoing", outgoing ?? native.imessage.top, setOutgoing], ["Incoming", incoming ?? native.incoming.top, setIncoming], ["Background", background ?? native.background, setBackground]].map(([label, value, setter]) => <label key={label as string}><span>{label as string}</span><span className="color-input-value"><span>{(value as string).toUpperCase()}</span><input type="color" aria-label={`${label} color`} value={value as string} onChange={event => (setter as (value: string) => void)(event.target.value)} /></span></label>)}</div></>}
        {list && <>
          <label className="inspector-select">Conversations<select aria-label="Conversation count" value={rowCount} onChange={event => setRowCount(Number(event.target.value))}><option value={3}>3 conversations</option><option value={6}>6 conversations</option></select></label>
          <label className="inspector-toggle-row">Unread indicators<input type="checkbox" checked={unread} onChange={event => setUnread(event.target.checked)} /></label>
          <label className="inspector-toggle-row">Group conversations<input type="checkbox" checked={groups} onChange={event => setGroups(event.target.checked)} /></label>
        </>}
        {editableText && <label className="inspector-text">{link ? "Link title" : "Message"}<textarea aria-label={link ? "Link title" : "Message text"} rows={3} value={options.text} onChange={event => option("text", event.target.value)} /></label>}
        {!conversation && !["ios-composer", "typing-indicator", "avatar", "date-separator"].includes(name) && <fieldset><legend>Direction</legend><div className="segmented-control">{(["incoming", "outgoing"] as const).map(direction => <button key={direction} type="button" aria-pressed={options.direction === direction} onClick={() => option("direction", direction)}>{direction === "incoming" ? "Received" : "Sent"}</button>)}</div></fieldset>}
        {(photo || viewer || link) && <fieldset><legend>Photo</legend><div className="photo-options">{showcasePhotos.map((photo, i) => <button type="button" key={photo.src} aria-label={`Use ${photo.alt.toLowerCase()}`} aria-pressed={options.photo === i} onClick={() => option("photo", i)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt="" />
        </button>)}</div></fieldset>}
        {photo && <label className="inspector-select">Photos in message<select aria-label="Photos in message" value={options.photoCount} onChange={event => option("photoCount", Number(event.target.value))}><option value={1}>1 photo</option><option value={2}>2 photos</option><option value={3}>3 photos</option></select></label>}
        {link && <label className="inspector-toggle-row">Show image<input type="checkbox" checked={options.richLink} onChange={event => option("richLink", event.target.checked)} /></label>}
        {!conversation && !["ios-composer", "avatar", "date-separator", "link-preview", "typing-indicator"].includes(name) && <label className="inspector-toggle-row">Bubble tail<input type="checkbox" checked={options.tail} onChange={event => option("tail", event.target.checked)} /></label>}
        <button type="button" className="export-config" onClick={() => setView("code")}><Code2 size={14} /> Get the code <span>↗</span></button>
      </aside>
    </div> : <div className="playground-code">{sample && <CodeBlock label={`${name}.tsx`} code={sample} />}{customize && !list && !contact && <CodeBlock label="Your theme" code={configCode} />}{!sample && <p>This utility is installed with the components that use it. Expand its source below to inspect the exported API.</p>}{(photo || link) && <p>Copy the sample photos from <a href="/showcase/credits.md">the asset list</a> into your app, or use your own images.</p>}</div>}
  </section>;
}

function SizedComponentPreview({ size, name, options, palette, revision, typingPaused }: {
  size: PreviewSize; name: string; options: PreviewOptions; palette: CSSProperties; revision: number; typingPaused: boolean;
}) {
  const sized = size !== "auto";
  const { frame, screenHeight } = usePhonePreview(false, false, size, sized);
  return <div ref={frame} className={sized ? "conversation-demo sized-component" : "component-demo"}>
    <div className={sized ? "phone-frame" : "component-frame"}>
      <div className={sized ? "phone-content" : "component-content"} style={sized ? { height: screenHeight } : undefined}>
        <div data-im-platform={options.platform} className={`component-stage ${name === "message-image" ? "photo-stage" : name === "typing-indicator" ? "typing-stage" : ""}`} style={palette}>
          <PaletteStyle platform={options.platform} />
          <div className="component-preview-header">
            <IosStatusBar />
            <IosNavBar name="Jamie Lee" initials="JL" />
          </div>
          <div className="component-stage-content"><ComponentPreview key={revision} name={name} options={options} typingPaused={typingPaused} /></div>
          <div className="stage-footer">Message UI</div>
        </div>
      </div>
    </div>
  </div>;
}
