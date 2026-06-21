import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chamuka Play",
    short_name: "Chamuka",
    description: "Make your own games and learn by making.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf3ff",
    theme_color: "#7a3cf0",
    categories: ["games", "education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
