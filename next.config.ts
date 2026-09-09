import type { NextConfig } from "next";

const config: NextConfig = {
  turbopack: { root: process.cwd() },
  // The dev badge would land inside pixel-diffed lab screenshots.
  devIndicators: false,
  async rewrites() {
    return {
      beforeFiles: [{
        source: "/",
        has: [{ type: "header", key: "accept", value: "(.*)application/vnd\\.shadcn\\.v1\\+json(.*)" }],
        destination: "/r/index.json",
      }],
    };
  },
  async headers() {
    return [
      { source: "/", headers: [{ key: "Vary", value: "Accept" }] },
      { source: "/r/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
    ];
  },
};

export default config;
