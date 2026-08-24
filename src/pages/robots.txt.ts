// robots.txt. Allows the public site, blocks admin, member,
// brand-explorer, and the dynamic OG endpoint.

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";

export const GET: APIRoute = async ({ locals }) => {
  const base = getRuntimeEnv(locals).APP_BASE_URL ?? "https://club.loftwah.com";
  const body = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /portal/
Disallow: /onboarding/
Disallow: /internal/
Disallow: /brand-explorer/
Disallow: /brand-r2/
Disallow: /api/
Disallow: /og/

Sitemap: ${new URL("sitemap.xml", base).toString()}
`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
