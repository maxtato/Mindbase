import type { MetadataRoute } from "next";

// Manifest PWA — installable depuis Safari iOS (Partager → Sur l'écran d'accueil)
// et depuis Chrome / Edge sur desktop & Android. Les icônes sont générées par
// `scripts/generate-icons.mjs` à partir du mark Mindbase.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mindbase",
    short_name: "Mindbase",
    description: "Reliez vos projets, tâches, fichiers et décisions en un seul endroit.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "fr",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
