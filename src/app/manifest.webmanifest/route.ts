import { appManifest } from "@/lib/pwa/appManifest";

// Built once at build time and served from the CDN.
export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(appManifest()), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
