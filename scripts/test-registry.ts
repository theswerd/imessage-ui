import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { registryItemSchema, registrySchema } from "shadcn/schema";

const project = process.cwd();
const origin = process.env.HARNESS_URL ?? "http://localhost:3100";
const manifest = registrySchema.parse(await (await fetch(`${origin}/r/registry.json`)).json());
for (const item of manifest.items) {
  const response = await fetch(`${origin}/r/${item.name}.json`);
  if (!response.ok) throw new Error(`Missing item ${item.name}`);
  const data = registryItemSchema.parse(await response.json());
  for (const file of data.files ?? []) {
    if (!file.content || file.content.includes("@/registry/")) throw new Error(`Unportable source in ${file.path}`);
  }
}
for (const layout of ["root", "src"]) {
  const fixture = await mkdtemp(path.join(tmpdir(), `imessage-consumer-${layout}-`));
  const prefix = layout === "src" ? "src/" : "";
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  await writeFile(path.join(fixture, "package.json"), JSON.stringify({ name: `imessage-consumer-${layout}`, private: true, dependencies: { react: pkg.dependencies.react, "react-dom": pkg.dependencies["react-dom"], next: pkg.dependencies.next, tailwindcss: pkg.devDependencies.tailwindcss, clsx: pkg.dependencies.clsx, "tailwind-merge": pkg.dependencies["tailwind-merge"] }, devDependencies: { typescript: pkg.devDependencies.typescript, "@types/react": pkg.devDependencies["@types/react"], "@types/node": pkg.devDependencies["@types/node"] } }, null, 2));
  await mkdir(path.join(fixture, prefix, "app"), { recursive: true });
  await mkdir(path.join(fixture, prefix, "lib"), { recursive: true });
  await writeFile(path.join(fixture, prefix, "app/globals.css"), '@import "tailwindcss";\n');
  await writeFile(path.join(fixture, prefix, "lib/utils.ts"), await readFile("lib/utils.ts", "utf8"));
  await writeFile(path.join(fixture, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["ES2022", "DOM", "DOM.Iterable"], skipLibCheck: true, strict: true, noEmit: true, jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler", esModuleInterop: true, paths: { "@/*": [`./${prefix}*`] } }, include: [`${prefix}**/*.tsx`, `${prefix}**/*.ts`], exclude: ["node_modules"] }));
  const config = JSON.parse(await readFile("components.json", "utf8"));
  config.tailwind.css = `${prefix}app/globals.css`;
  config.registries = {};
  await writeFile(path.join(fixture, "components.json"), JSON.stringify(config));
  function run(command: string, args: string[]) { const result = spawnSync(command, args, { cwd: fixture, stdio: "inherit" }); if (result.error) throw result.error; if (result.status !== 0) throw new Error(`Consumer ${layout}: ${command} failed. Fixture retained at ${fixture}`); }
  run(process.execPath, ["install"]);
  run(process.execPath, [path.join(project, "node_modules/shadcn/dist/index.js"), "add", `${origin}/r/index.json`, "--yes"]);
  // Exercise the whole surface a consumer is likely to touch: both app shells, the pane, and the
  // pieces that are installable on their own.
  const page = [
    'import { IosMessagesApp } from "@/components/imessage/ios-messages-app";',
    'import { MacMessagesApp } from "@/components/imessage/macos-messages-app";',
    'import { Conversation } from "@/components/imessage/conversation";',
    'import { MessageBubble } from "@/components/imessage/message-bubble";',
    'import { Tapback } from "@/components/imessage/tapback";',
    'import { FaceTimeCard } from "@/components/imessage/facetime-card";',
    'import { MessageImages } from "@/components/imessage/message-image";',
    'import { MessageAudio } from "@/components/imessage/message-audio";',
    'import { ReplyMessage } from "@/components/imessage/message-reply";',
    'import { EditableBubble } from "@/components/imessage/message-edit";',
    'import { BubbleEffect } from "@/components/imessage/message-effects";',
    'import { ScreenEffect } from "@/components/imessage/screen-effects";',
    'const messages = [{ id: "1", text: "Hey", direction: "incoming" as const, sentAt: 0 }];',
    'export default function Page() {',
    '  return (',
    '    <>',
    '      <IosMessagesApp contact={{ name: "Alex Morgan" }} messages={messages} />',
    '      <MacMessagesApp contact={{ name: "Alex Morgan" }} messages={messages} />',
    '      <Conversation platform="ios" name="Alex Morgan" messages={messages} />',
    '      <MessageBubble direction="outgoing" tail>Hello</MessageBubble>',
    '      <Tapback reaction="love" />',
    '      <FaceTimeCard />',
    '      <MessageImages images={[{ src: "/a.jpg", alt: "A" }]} />',
    '      <MessageAudio duration={12} />',
    '      <ReplyMessage quote={{ id: "1", text: "Hey", direction: "incoming" }}>Sure</ReplyMessage>',
    '      <EditableBubble value="Hello" />',
    '      <BubbleEffect kind="slam"><MessageBubble>Hi</MessageBubble></BubbleEffect>',
    '      <div style={{ position: "relative" }}><ScreenEffect kind="confetti" progress={0.5} /></div>',
    '    </>',
    '  );',
    '}',
  ].join("\n");
  await writeFile(path.join(fixture, prefix, "app/page.tsx"), page + "\n");
  run(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"]);
  console.log(`Verified ${layout} consumer: ${fixture}`);
}
