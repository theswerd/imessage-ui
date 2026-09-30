import { FreestyleLogo } from "./freestyle-logo";

export function SiteFooter() {
  return <footer className="site-footer">
    <span>By <a href="https://twitter.com/benswerd" target="_blank" rel="noopener noreferrer">Ben Swerdlow</a></span>
    <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true" className="footer-diamond"><path d="m4 0 4 4-4 4-4-4Z" /></svg>
    <a href="https://www.freestyle.sh" target="_blank" rel="noopener noreferrer" className="footer-freestyle">
      <FreestyleLogo />
      <span>Freestyle</span>
    </a>
  </footer>;
}
