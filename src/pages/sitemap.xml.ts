// Sitemap. Lists the public, indexable pages only. Excludes admin,
// member portal, brand-explorer, and the dynamic OG endpoint.

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";

const PUBLIC_PATHS = [
  "/",
  "/membership/",
  "/how-it-works/",
  "/chapters/",
  "/journal/",
  "/correspondence/",
  "/faq/",
  "/waiting-list/",
  "/privacy/",
  "/terms/",
];

export const GET: APIRoute = async ({ locals }) => {
  const base = getRuntimeEnv(locals).APP_BASE_URL ?? "https://club.loftwah.com";
  const now = new Date().toISOString().slice(0, 10);
  const entries = PUBLIC_PATHS.map(
    (p) => `  <url>
    <loc>${new URL(p, base).toString()}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p === "/" ? "1.0" : "0.7"}</priority>
  </url>`,
  ).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
