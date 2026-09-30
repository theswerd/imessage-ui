import { notFound } from "next/navigation";
import { siteCatalog } from "@/lib/site-catalog";
import { RegistryPage } from "@/components/registry-page";

export function generateStaticParams() { return siteCatalog.map(item => ({ name: item.name })); }
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const item = siteCatalog.find(item => item.name === name);
  return { title: item?.title ?? "Component", description: item?.description };
}
export default async function ComponentPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!siteCatalog.some(item => item.name === name)) notFound();
  return <RegistryPage name={name} />;
}
