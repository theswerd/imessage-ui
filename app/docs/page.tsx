import Link from "next/link";
import { blocks, components, usage } from "@/lib/catalog";

export const metadata = { title: "Docs" };

const labs: Array<[string, string]> = [
  ["/harness", "Scenario lab: every state on a timeline, on both platforms, in both themes"],
  ["/lab", "Bubbles at native geometry, against the iOS conversation capture"],
  ["/lab/ios-chrome", "Status bar, nav bar, composer, conversation list, New Message sheet"],
  ["/lab/ios-screens", "Details, plus menu, selection mode, swipe for times, notices, attachments"],
  ["/lab/macos-chrome", "Window, sidebar, header, composer, plus menu"],
  ["/lab/list", "The message log: clusters, tails, date headers, motion"],
  ["/lab/tapback", "Balloons, the picker bar, and the long-press overlay"],
  ["/lab/effects", "Bubble and screen send effects"],
  ["/lab/reply", "Replies, photos, audio, edit in place"],
];

export default function DocsPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-14">
      <p className="mb-3 text-sm text-blue-500">Documentation</p>
      <h1 className="text-4xl font-semibold tracking-tight">Measured against the real thing.</h1>
      <p className="mt-5 leading-7 text-muted-foreground">
        Every size, colour, radius and timing in this registry comes from a capture of Messages on iOS 26
        in the iPhone 17 Pro simulator, or macOS 26.5 Messages. The numbers and how they were measured
        live in <code className="text-foreground">references/SPEC.md</code>. Anything without a native
        capture is marked unverified there and in the component itself, so you can tell what is
        reproduced from what is inferred.
      </p>

      <h2 className="mt-12 text-lg font-semibold">Two gates</h2>
      <div className="mt-4 space-y-6">
        <section>
          <h3 className="text-sm font-semibold">Did our rendering change?</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Playwright screenshots every scenario checkpoint on both platforms and themes, in Chromium
            and WebKit. These baselines catch regressions in this implementation. They are not evidence
            of fidelity to Apple, and are never copied into the reference set.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-semibold">Do we match Apple?</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            A lab page is diffed against the native capture it reconstructs, at the device pixel ratio
            of the capture. The tool writes reference, actual and diff images side by side and prints
            the mismatched-pixel ratio. Text anti-aliasing differs between a simulator and a browser;
            geometry and colour must not.
          </p>
        </section>
      </div>

      <h2 className="mt-12 text-lg font-semibold">Labs</h2>
      <ul className="mt-4 space-y-2">
        {labs.map(([href, description]) => (
          <li key={href} className="text-sm leading-7">
            <Link href={href} className="font-medium text-blue-500">{href}</Link>
            <span className="text-muted-foreground"> {description}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-lg font-semibold">Install</h2>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-muted p-5 text-xs leading-7">
        {"bunx shadcn@latest add http://localhost:3100/r/index.json          # everything\nbunx shadcn@latest add http://localhost:3100/r/ios-messages-app.json  # one item"}
      </pre>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        Or register <code className="text-foreground">@imessage</code> in your{" "}
        <code className="text-foreground">components.json</code> and run{" "}
        <code className="text-foreground">bunx shadcn@latest add @imessage/conversation</code>.
        Components install under <code className="text-foreground">components/imessage/</code> and use
        your own <code className="text-foreground">cn</code> helper.
      </p>

      <h2 className="mt-12 text-lg font-semibold">Blocks</h2>
      <div className="mt-4 space-y-6">
        {blocks.map(item => (
          <section key={item.name}>
            <h3 className="text-sm font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">{item.description}</p>
            {usage[item.name] && <pre className="code-block mt-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs">{usage[item.name]}</pre>}
          </section>
        ))}
      </div>

      <h2 className="mt-12 text-lg font-semibold">Components</h2>
      <ul className="mt-4 divide-y">
        {components.map(item => (
          <li key={item.name} className="py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium">{item.title}</span>
              <code className="shrink-0 text-xs text-muted-foreground">@imessage/{item.name}</code>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm text-muted-foreground">
        Applications own transport, storage, uploads and real calls. Independent project, not
        affiliated with Apple.
      </p>
      <Link href="/harness" className="mt-8 inline-block text-sm font-medium text-blue-500">Open the scenario lab</Link>
    </main>
  );
}
