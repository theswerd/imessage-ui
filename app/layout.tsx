import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Message UI", template: "%s · Message UI" },
  description: "iOS-style React components for the web. Message bubbles, Tapbacks, composers, and conversations you can install with shadcn and make your own.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><Providers><a href="#main" className="sr-only z-[100] bg-background p-3 focus:not-sr-only focus:fixed">Skip to content</a><SiteHeader />{children}</Providers></body></html>;
}
