import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const privateNetworkDevOrigins = [
  "192.168.*.*",
  "10.*.*.*",
  ...Array.from({ length: 16 }, (_, index) => `172.${16 + index}.*.*`),
  "*.local",
  "*.lan",
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
  // Le route indicator de Next est utile sur desktop, mais il reste parfois en
  // chargement infini dans Safari iOS dev. On garde les erreurs Next, on masque
  // seulement ce panneau de statut dynamic/static.
  devIndicators: false,
  // Autorise l'accès dev depuis le LAN (iPhone, autre Mac…). Sans ça, Next.js
  // peut bloquer /_next/webpack-hmr et les chunks JS quand l'origine vient
  // d'une IP locale : l'HTML reste visible, mais React ne s'hydrate pas.
  allowedDevOrigins: privateNetworkDevOrigins,
  async headers() {
    // Cache headers only for production, not dev
    // Dev headers break Next.js development behavior
    if (process.env.NODE_ENV !== "production") return [];

    const noStoreHeaders = [
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
    ];

    return [
      {
        source: "/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/_next/:path*",
        headers: noStoreHeaders,
      },
    ];
  },
};

export default nextConfig;
