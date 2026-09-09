import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "iMessage UI — A shadcn registry", template: "%s · iMessage UI" },
  description: "iMessage-style React components for the web. Message bubbles, Tapbacks, composers, and conversations you can install with shadcn and make your own.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><Providers><a href="#main" className="sr-only z-[100] bg-background p-3 focus:not-sr-only focus:fixed">Skip to content</a><SiteHeader />{children}<footer className="mx-auto flex max-w-[1280px] flex-col justify-between gap-3 border-t px-6 py-7 text-xs text-muted-foreground sm:flex-row sm:px-10"><p>Built with React, Tailwind CSS, and shadcn/ui.</p><p>Independent project. Not affiliated with Apple.</p></footer></Providers></body></html>;
}
