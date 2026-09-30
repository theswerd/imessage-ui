import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AddToAgent } from "@/components/add-to-agent";
import { HomePreview } from "@/components/home-preview";

export default function Home() {
  return <main id="main" className="registry-main home-main">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-copy">
        <h1 id="home-title">Message UI,<br /><span>for the web.</span></h1>
        <p>Familiar conversations. React components you can make your own.</p>
        <div className="home-actions"><AddToAgent /><Link href="/components" className="home-components-link">Explore components <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </div>
      <HomePreview />
    </section>
  </main>;
}
