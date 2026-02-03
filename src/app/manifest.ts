import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ICC WebRadio",
    short_name: "ICC",
    description: "Plateforme de streaming chrétienne ICC WebRadio",
    start_url: "/?source=pwa",
    scope: "/",
    id: "/?source=pwa",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    background_color: "#ffffff",
    theme_color: "#2563eb",
    orientation: "portrait",
    categories: ["music", "education", "lifestyle"],
    shortcuts: [
      {
        name: "Radio en direct",
        short_name: "Radio",
        url: "/radio",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Dernières vidéos",
        short_name: "Vidéos",
        url: "/videos",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Reprendre",
        short_name: "Reprendre",
        url: "/?tab=continue",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    screenshots: [
      {
        src: "/hero-radio-new.jpg",
        sizes: "1280x720",
        type: "image/jpeg",
      },
      {
        src: "/hero-radio.jpg",
        sizes: "1280x720",
        type: "image/jpeg",
      },
    ],
    icons: [
      {
        src: "/icons/app-icon-pwa-192.jpg",
        sizes: "192x192",
        type: "image/jpeg",
      },
      {
        src: "/icons/app-icon-pwa.jpg",
        sizes: "512x512",
        type: "image/jpeg",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
