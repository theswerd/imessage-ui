import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { registryItemSchema, registrySchema } from "shadcn/schema";
import { usage } from "../lib/catalog";
import { siteCatalog } from "../lib/site-catalog";
import { attachmentText } from "../harness/fixtures";

const origin = new URL(process.env.REGISTRY_URL ?? "http://localhost:3100");
if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
  throw new Error("REGISTRY_URL must be an HTTP(S) origin without credentials, a path, query, or fragment.");
}
const base = origin.origin;
const source = registrySchema.parse(JSON.parse(await readFile("registry.json", "utf8")));

// registry.json is what a consumer installs, so it has to describe the source exactly: every
// component file shipped once, with a title, a description, and a dependency list that is the
// file's own imports, no more and no less. A missing dependency breaks the install (shadcn never
// fetches the file the component imports); a stray one drags in code nobody asked for. Anything
// unreachable from `index` is a component `add index.json` silently skips.
const componentDir = "registry/imessage";
const sourceFiles = (await readdir(componentDir)).filter(name => /\.tsx?$/.test(name)).map(name => `${componentDir}/${name}`);
const importSpecifier = /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;
const preinstalled = new Set(["react", "react-dom"]);
const names = new Set(source.items.map(entry => entry.name));
const owner = new Map<string, string>();
const problems: string[] = [];
for (const entry of source.items) {
  if (!entry.title) problems.push(`${entry.name}: no title`);
  if (!entry.description) problems.push(`${entry.name}: no description`);
  const declared = new Set(entry.registryDependencies ?? []);
  const declaredPackages = new Set(entry.dependencies ?? []);
  const imported = new Set<string>();
  const importedPackages = new Set<string>();
  for (const file of entry.files ?? []) {
    const claimed = owner.get(file.path);
    if (claimed) problems.push(`${file.path}: claimed by both ${claimed} and ${entry.name}`);
    owner.set(file.path, entry.name);
    if (!sourceFiles.includes(file.path)) { problems.push(`${entry.name}: ${file.path} does not exist`); continue; }
    for (const [, specifier] of (await readFile(file.path, "utf8")).matchAll(importSpecifier)) {
      if (specifier.startsWith(`@/${componentDir}/`)) imported.add(`@message-ui/${specifier.slice(componentDir.length + 3)}`);
      else if (specifier.startsWith("@/components/ui/")) imported.add(specifier.slice("@/components/ui/".length));
      else if (specifier.startsWith("@/") || specifier.startsWith(".")) continue;
      else {
        const pkg = specifier.startsWith("@") ? specifier.split("/", 2).join("/") : specifier.split("/")[0];
        if (!preinstalled.has(pkg)) importedPackages.add(pkg);
      }
    }
  }
  imported.delete(`@message-ui/${entry.name}`);
  for (const dependency of declared) {
    if (dependency.startsWith("@message-ui/") && !names.has(dependency.slice("@message-ui/".length))) problems.push(`${entry.name}: depends on ${dependency}, which is not an item`);
    else if (entry.files?.length && !dependency.includes("://") && !imported.has(dependency)) problems.push(`${entry.name}: declares ${dependency} but never imports it`);
  }
  for (const dependency of imported) if (!declared.has(dependency)) problems.push(`${entry.name}: imports ${dependency} but does not declare it`);
  for (const pkg of declaredPackages) if (!importedPackages.has(pkg)) problems.push(`${entry.name}: declares the package ${pkg} but never imports it`);
  for (const pkg of importedPackages) if (!declaredPackages.has(pkg)) problems.push(`${entry.name}: imports the package ${pkg} but does not declare it`);
}
for (const file of sourceFiles) if (!owner.has(file)) problems.push(`${file}: no registry item ships it`);
const reachable = new Set<string>();
const reach = (name: string) => {
  if (reachable.has(name)) return;
  reachable.add(name);
  for (const dependency of source.items.find(entry => entry.name === name)?.registryDependencies ?? []) if (dependency.startsWith("@message-ui/")) reach(dependency.slice("@message-ui/".length));
};
reach("index");
for (const entry of source.items) if (!reachable.has(entry.name)) problems.push(`${entry.name}: not reachable from index, so "add index.json" leaves it out`);
if (problems.length) throw new Error(`registry.json does not match registry/imessage:\n  ${problems.join("\n  ")}`);

const result = spawnSync(process.execPath, ["node_modules/shadcn/dist/index.js", "build"], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`shadcn build exited with ${result.status}`);

await mkdir("public/llms", { recursive: true });
await writeFile("public/design-notes.txt", attachmentText);
await writeFile("public/onboard.md", (await readFile("content/onboard.md", "utf8")).replaceAll("{{REGISTRY_URL}}", base));
const items = [];
for (const entry of source.items) {
  const item = registryItemSchema.parse(JSON.parse(await readFile(`public/r/${entry.name}.json`, "utf8")));
  item.registryDependencies = item.registryDependencies?.map(dependency => dependency.replace(/^@message-ui\//, `${base}/r/`) + (dependency.startsWith("@message-ui/") ? ".json" : ""));
  for (const file of item.files ?? []) {
    file.content = file.content?.replaceAll("@/registry/imessage/", "@/components/message-ui/");
  }
  await writeFile(`public/r/${item.name}.json`, JSON.stringify(item, null, 2) + "\n");
  items.push(item);
  const sourceUrl = siteCatalog.some(component => component.name === item.name)
    ? `${base}/components/${item.name}#source`
    : `${base}/r/${item.name}.json`;
  const doc = `# ${item.title}\n\n${item.description}\n\n## Requirements\n\nReact 19, Tailwind CSS 4, and an initialized shadcn project. Uses the standard cn utility at @/lib/utils. Enable dark mode with a .dark ancestor. Standalone primitives need PaletteStyle inside a data-im-platform wrapper; full conversation and app shells include it. Setup: ${base}/onboard.md\n\n## Install\n\n\`\`\`sh\nnpx shadcn@latest add ${base}/r/${item.name}.json\n\`\`\`\n\n## Usage\n\n\`\`\`tsx\n${usage[item.name] ?? `// Exported props and source: ${sourceUrl}`}\n\`\`\`\n\nComponents render UI only. Supply your own message data, persistence, uploads, and send handlers. Connect your own messaging service.\n`;
  await writeFile(`public/llms/${item.name}.txt`, doc);
}
const output = registrySchema.parse({ ...source, homepage: base, items });
await writeFile("public/r/registry.json", JSON.stringify(output, null, 2) + "\n");
await writeFile("public/registry.json", JSON.stringify(output, null, 2) + "\n");
await writeFile("public/llms.txt", `# Message UI\n\nA shadcn registry of Messages-style components for the web. Native captures and framework measurements inform many surfaces; source comments document approximations and remaining gaps.\n\nRegistry: ${base}/r/registry.json\nNamespace: @message-ui → ${base}/r/{name}.json\n\n${items.filter(item => item.name !== "index").map(item => `- [${item.title}](${base}/llms/${item.name}.txt): ${item.description}`).join("\n")}\n`);

// public/ is served as-is and is committed, so a renamed or dropped item must stop answering at its
// old URL instead of installing a component the source no longer has.
for (const [directory, extension] of [["public/r", ".json"], ["public/llms", ".txt"]] as const) {
  for (const file of await readdir(directory)) {
    if (!file.endsWith(extension)) continue;
    const name = file.slice(0, -extension.length);
    if (name !== "registry" && !items.some(item => item.name === name)) await rm(`${directory}/${file}`);
  }
}
console.log(`Built ${items.length} registry items for ${base}`);
