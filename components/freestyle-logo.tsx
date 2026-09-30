// Official mark from freestyle-website-next/apps/website/public/logo.svg.
export function FreestyleLogo({ width = 25, height = 21, color = "currentColor" }: { width?: number; height?: number; color?: string }) {
  return <svg width={width} height={height} viewBox="-16 -16 379 312" style={{ flexShrink: 0, overflow: "visible" }} fill="none" stroke={color} strokeWidth="25" strokeLinecap="round" aria-hidden="true">
    <path d="M70 267V235.793C37.4932 229.296 13 200.594 13 166.177C13 134.93 33.1885 108.399 61.2324 98.9148C61.9277 51.3467 100.705 13 148.438 13C183.979 13 214.554 34.2582 228.143 64.7527C234.182 63.4301 240.454 62.733 246.89 62.733C295.058 62.733 334.105 101.781 334.105 149.949C334.105 182.845 315.893 211.488 289 226.343V267" />
    <path d="M146 237V267M215 237V267" />
  </svg>;
}
