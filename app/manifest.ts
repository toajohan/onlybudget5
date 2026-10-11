import type { MetadataRoute } from "next";

// Makes the site installable ("Add to home screen"): on iPhone this is what allows system notifications.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OnlyBudget",
    short_name: "OnlyBudget",
    description: "Suivi des ventes, dépenses et trésorerie de l'agence",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "fr",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
