"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowUpRight, MessageCircle, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  return <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
    <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-5 px-5 sm:gap-10 sm:px-10">
      <Link href="/" aria-label="iMessage UI home" className="flex shrink-0 items-center gap-2.5"><span className="brand-mark flex size-8 items-center justify-center rounded-[10px]"><MessageCircle className="size-[23px] fill-white text-white" strokeWidth={1.5} /></span><span className="text-[18px] font-semibold tracking-[-0.6px]">iMessage<span className="ml-1 font-normal text-muted-foreground">UI</span></span></Link>
      <nav aria-label="Main navigation" className="ml-auto flex items-center gap-4 text-sm sm:ml-1 sm:gap-7">{[{ href: "/harness", title: "Lab" }, { href: "/r/registry.json", title: "Registry" }, { href: "/docs", title: "Docs" }].map(link => <Link key={link.href} href={link.href} className={cn("transition-colors hover:text-foreground", pathname === link.href ? "text-foreground" : "text-muted-foreground")}>{link.title}</Link>)}</nav>
      <div className="ml-auto hidden items-center gap-5 sm:flex"><a href="/llms.txt" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">llms.txt <ArrowUpRight className="size-3" /></a><div className="h-4 w-px bg-border" /><button type="button" aria-label="Switch to dark theme" onClick={() => setTheme("dark")} className="rounded-full p-2 hover:bg-muted dark:hidden"><Moon className="size-4" /></button><button type="button" aria-label="Switch to light theme" onClick={() => setTheme("light")} className="hidden rounded-full p-2 hover:bg-muted dark:block"><Sun className="size-4" /></button></div>
    </div>
  </header>;
}
