// Dynamic OG image endpoint. Serves a 1200×630 SVG rendered from
// the brand config and the requested template.
//
// This endpoint exists for the rare cases where an OG image must
// be generated dynamically (e.g. with a chapter name or article
// title in the URL). For ordinary template-only OG, the static
// files in /public/og/*.svg are preferred — they have no runtime
// cost and are committed to the repository.

import type { APIRoute } from "astro";
import { renderOgSvg, type OgTemplate } from "../../lib/og";

function isOgTemplate(s: string): s is OgTemplate {
  return (
    s === "default" ||
    s === "membership" ||
    s === "how-it-works" ||
    s === "chapter" ||
    s === "journal"
  );
}

export const GET: APIRoute = async ({ url }) => {
  const tParam = url.searchParams.get("t");
  const template: OgTemplate = tParam && isOgTemplate(tParam) ? tParam : "default";
  const title = url.searchParams.get("title") ?? undefined;
  const subtitle = url.searchParams.get("subtitle") ?? undefined;
  const chapter = url.searchParams.get("chapter") ?? undefined;
  const date = url.searchParams.get("date") ?? undefined;

  const svg = renderOgSvg({ template, title, subtitle, chapter, date });
  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
