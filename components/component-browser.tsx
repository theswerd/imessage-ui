"use client";

import { featuredItems } from "@/lib/showcase";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, X } from "lucide-react";
import { siteCatalog } from "@/lib/site-catalog";
import { ComponentPreview, PreviewSurface } from "./registry-preview";

const filters = ["All", "Components", "Blocks", "Utilities"] as const;
type Filter = typeof filters[number];
export function ComponentBrowser({ initialQuery = "", initialFilter = "All" }: { initialQuery?: string; initialFilter?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>(filters.includes(initialFilter as Filter) ? initialFilter as Filter : "All");
  function update(nextQuery: string, nextFilter: Filter) {
    setQuery(nextQuery); setFilter(nextFilter);
    const url = new URL(location.href);
    if (nextQuery) url.searchParams.set("q", nextQuery); else url.searchParams.delete("q");
    if (nextFilter !== "All") url.searchParams.set("type", nextFilter); else url.searchParams.delete("type");
    history.replaceState(null, "", url);
  }
  const items = siteCatalog.filter(item => (`${item.title} ${item.name} ${item.description}`).toLowerCase().includes(query.toLowerCase()) && (filter === "All" || (filter === "Blocks" ? item.type === "registry:block" : filter === "Components" ? item.type === "registry:ui" : item.type !== "registry:block" && item.type !== "registry:ui")));
  return <>
    <div className="catalog-controls"><div className="catalog-filters" aria-label="Filter components">{filters.map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => update(query, value)}>{value}</button>)}</div><div className="catalog-search"><Search size={16} aria-hidden="true" /><input aria-label="Search components" name="component-search" autoComplete="off" placeholder="Search components…" value={query} onChange={event => update(event.target.value, filter)} />{query && <button type="button" aria-label="Clear search" onClick={() => update("", filter)}><X size={15} aria-hidden="true" /></button>}</div></div>
    <p className="catalog-count" role="status">{items.length} {items.length === 1 ? "item" : "items"}</p>
    {items.length ? <div className="catalog-grid">{items.map(item => { const featured = featuredItems.find(example => example.name === item.name); return <article className="catalog-item" key={item.name}>{featured && <PreviewSurface><ComponentPreview name={item.name} /></PreviewSurface>}<div className="catalog-item-content"><span className="eyebrow">{item.type.replace("registry:", "").replace("ui", "component")}</span><h2><Link href={`/components/${item.name}`}>{item.title}<ArrowUpRight size={16} aria-hidden="true" /></Link></h2><p>{item.description}</p><code>@message-ui/{item.name}</code></div></article>; })}</div> : <div className="catalog-empty"><h2>No components found</h2><p>Try a different name or browse the full collection.</p><button className="button-secondary" type="button" onClick={() => update("", "All")}>Clear filters</button></div>}
  </>;
}
