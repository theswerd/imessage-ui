import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Brand } from "@/components/brand";
import { FreestyleLogo } from "@/components/freestyle-logo";

export const alt = "Message UI, for the web. iOS-style React components. By Freestyle.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [regular, bold] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Inter-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Inter-Bold.ttf")),
  ]);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", background: "linear-gradient(125deg, #ffffff 25%, #f3f7fd 100%)", color: "#17181b", padding: "52px 72px", fontFamily: "Inter" }}>
      <div style={{ display: "flex", position: "absolute", right: -94, bottom: -70, opacity: 0.12 }}><FreestyleLogo width={740} height={598} color="#617e9e" /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 600 }}><Brand size={50} /><span>Message UI</span></div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 70, fontSize: 96, fontWeight: 700, letterSpacing: -6, lineHeight: 1.03 }}>
        <span>Message UI,</span>
        <span style={{ color: "#007aff" }}>for the web.</span>
      </div>
      <div style={{ display: "flex", marginTop: 26, fontSize: 28, color: "#6c6e76", letterSpacing: -0.6 }}>iOS-style React components.</div>
      <div style={{ display: "flex", position: "absolute", bottom: 45, left: 72, alignItems: "center", gap: 10, fontSize: 23, color: "#6c6e76" }}>
        <span>By</span><FreestyleLogo width={30} height={25} color="#17181b" /><span style={{ color: "#17181b", fontWeight: 600 }}>Freestyle</span>
      </div>
    </div>,
    { ...size, fonts: [{ name: "Inter", data: regular, weight: 400, style: "normal" }, { name: "Inter", data: bold, weight: 700, style: "normal" }] },
  );
}
