import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { catalog, usage } from "@/lib/catalog";
import { featuredItems } from "@/lib/showcase";
import { RegistryPlayground } from "./registry-playground";
import { InstallCommand } from "./install-command";
import { CodeBlock } from "./copy-code";

export async function RegistryPage({ name, overview = false }: { name: string; overview?: boolean }) {
  const item = catalog.find(item => item.name === name)!;
  const featured = featuredItems.find(item => item.name === name);
  const sources = await Promise.all((item.files ?? []).map(async file => ({ name: path.basename(file.path), content: (await readFile(path.join(process.cwd(), file.path), "utf8")).replaceAll("@/registry/imessage/", "@/components/message-ui/") })));
  return <main id="main" className="registry-main"><div className="registry-content">
    <div className="page-heading">
      <div className="page-heading-meta"><Link href="/components">Components</Link><ChevronRight size={12} aria-hidden="true" /><span>iOS</span></div>
      <h1>{overview ? "Messages" : featured?.title ?? item.title}</h1>
      <p>{featured?.description ?? item.description}</p>
    </div>
    <RegistryPlayground key={name} name={name} usage={usage[name]} />
    <section className="installation-section" id="installation"><h2>Install</h2><InstallCommand name={name} /></section>
    <section className="source-section" id="source">{sources.map(source => <details key={source.name} className="source-details"><summary><span>{source.name}</span><span>View source</span></summary><CodeBlock code={source.content} label={source.name} /></details>)}</section>
    <div className="registry-bottom"><a href={`/r/${name}.json`}>Registry JSON ↗</a></div>
  </div></main>;
}
