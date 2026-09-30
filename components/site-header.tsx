"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useRef } from "react";
import { AudioLines, CalendarDays, Circle, Code2, House, ImageIcon, Link2, Maximize2, Menu, MessageCircle, Moon, PanelLeft, Smile, Sun, UserRound, X } from "lucide-react";
import { componentHref, siteComponents } from "@/lib/site-catalog";
import { ComponentSearch } from "./component-search";
import { Brand } from "./brand";
import { GithubMark } from "./github-mark";
import { AddToAgent } from "./add-to-agent";

const icons = [MessageCircle, PanelLeft, UserRound, MessageCircle, Smile, ImageIcon, Link2, AudioLines, Circle, Code2, PanelLeft, Maximize2, UserRound, CalendarDays];
const navigation = siteComponents.map(([name, title], i) => ({ name, title, Icon: icons[i] }));

function ComponentNavigation({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const selected = pathname === "/components" ? "ios-messages-app" : pathname.split("/").pop();
  return <>
    <nav className="component-navigation" aria-label="Components">
      <Link href="/" className="home-nav-link" onClick={close} aria-current={pathname === "/" ? "page" : undefined}><House size={17} aria-hidden="true" /><span>Home</span></Link>
      <h2>Components</h2>
      {navigation.map(({name, title, Icon}) => <Link key={name} href={componentHref(name)} onClick={close} aria-current={selected === name ? "page" : undefined}><Icon size={17} aria-hidden="true" /><span>{title}</span></Link>)}
    </nav>
  </>;
}

export function SiteHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const menu = useRef<HTMLDialogElement>(null);
  if (pathname.startsWith("/harness") || pathname.startsWith("/lab")) return null;
  const home = pathname === "/";
  return <>
    <header className={`registry-header ${home ? "home-header" : ""}`}>
      <div className="header-breadcrumb">
        {!home && <button type="button" className="icon-button mobile-menu" aria-label="Open components" onClick={() => menu.current?.showModal()}><Menu size={19} /></button>}
        <Link href="/" className="site-brand" aria-label="Message UI home"><Brand /><strong>Message UI</strong></Link>
      </div>
      <div className="header-actions">{home && <Link href="/components" className="header-components-link">Components</Link>}<ComponentSearch /><a className="icon-button github-link" href="https://github.com/theswerd/imessage-ui" target="_blank" rel="noopener noreferrer" aria-label="Message UI on GitHub" title="GitHub"><GithubMark /></a><button type="button" className="icon-button theme-switch" aria-label="Toggle site appearance" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><Sun size={17} className="hidden dark:block" /><Moon size={17} className="dark:hidden" /></button>{!home && <AddToAgent />}</div>
    </header>
    {!home && <><aside className="registry-sidebar"><ComponentNavigation /></aside><dialog ref={menu} className="mobile-sidebar-dialog" aria-label="Component navigation"><button type="button" aria-label="Close components" className="icon-button mobile-close" onClick={() => menu.current?.close()}><X size={20} /></button><ComponentNavigation close={() => menu.current?.close()} /></dialog></>}
  </>;
}
