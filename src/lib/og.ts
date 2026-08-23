// Text-safe OG / social image generation.
//
// Renders a 1200×630 SVG using actual typography, then converts
// to PNG at request time via an Astro endpoint. The SVG is fully
// AI-typography-free: no MiniMax generation, no image-01
// rendering. Every glyph is real text in a real font stack.
//
// Per docs/03 §4.9 and the project invariants, OG images must NOT
// be MiniMax-generated typography. This module is the canonical
// implementation.

import { brand } from "../brand/config";

export type OgTemplate = "default" | "membership" | "how-it-works" | "chapter" | "journal";

export interface OgOptions {
  readonly template?: OgTemplate;
  readonly title?: string;
  readonly subtitle?: string;
  readonly chapter?: string;
  readonly date?: string;
}

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Render an OG card as an SVG string.
 *
 * The SVG is deliberately restrained: cream paper background,
 * the configured accent, the configured seal, real typography.
 * No AI imagery. No gradients beyond a single subtle vignette.
 */
export function renderOgSvg(opts: OgOptions = {}): string {
  const template = opts.template ?? "default";
  const title = opts.title ?? pickTitle(template, opts);
  const subtitle = opts.subtitle ?? pickSubtitle(template);
  const chapter = opts.chapter ?? null;
  const date = opts.date ?? null;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <radialGradient id="g" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1b2230" stop-opacity="0"/>
      <stop offset="100%" stop-color="#070a0f" stop-opacity="0.7"/>
    </radialGradient>
    <style>
      .bg { fill: ${brand.palette.bg}; }
      .fg { fill: ${brand.palette.fg}; }
      .muted { fill: ${brand.palette.fgMuted}; }
      .faint { fill: ${brand.palette.fgFaint}; }
      .accent { fill: ${brand.palette.accent}; }
      .serif { font-family: ${brand.typography.serif}; }
      .sans { font-family: ${brand.typography.sans}; }
      .mono { font-family: ${brand.typography.mono}; }
    </style>
  </defs>
  <rect class="bg" width="${WIDTH}" height="${HEIGHT}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
  ${renderCornerFrame()}
  ${renderSeal()}
  <g transform="translate(440, 168)">
    ${chapterLine(chapter, date)}
    <text class="serif fg" x="0" y="0" font-size="84" font-weight="400" letter-spacing="-1">${escapeXml(truncate(title, 28))}</text>
    <text class="sans muted" x="0" y="80" font-size="32" font-weight="400">${escapeXml(truncate(subtitle, 64))}</text>
    <line x1="0" x2="120" y1="160" y2="160" stroke="${brand.palette.accentDim}" stroke-width="2"/>
    <text class="serif accent" x="0" y="220" font-size="28" letter-spacing="2">${escapeXml(brand.name.toUpperCase())}</text>
    <text class="sans faint" x="0" y="260" font-size="20">${escapeXml(brand.tagline)}</text>
  </g>
</svg>`;
}

function renderCornerFrame(): string {
  const c = brand.palette.accentDim;
  return `
  <g stroke="${c}" stroke-width="2" fill="none">
    <path d="M 60 60 L 60 100 M 60 60 L 100 60"/>
    <path d="M ${WIDTH - 60} 60 L ${WIDTH - 60} 100 M ${WIDTH - 60} 60 L ${WIDTH - 100} 60"/>
    <path d="M 60 ${HEIGHT - 60} L 60 ${HEIGHT - 100} M 60 ${HEIGHT - 60} L 100 ${HEIGHT - 60}"/>
    <path d="M ${WIDTH - 60} ${HEIGHT - 60} L ${WIDTH - 60} ${HEIGHT - 100} M ${WIDTH - 60} ${HEIGHT - 60} L ${WIDTH - 100} ${HEIGHT - 60}"/>
  </g>`;
}

function renderSeal(): string {
  // Pure-SVG mark: monoline circle with the configured seal as a
  // monogram. This is rendered in the OG canvas at a fixed size.
  const cx = 230;
  const cy = HEIGHT / 2;
  const r = 130;
  return `
  <g transform="translate(${cx}, ${cy})">
    <circle r="${r}" fill="none" stroke="${brand.palette.accent}" stroke-width="2" opacity="0.6"/>
    <circle r="${r - 14}" fill="none" stroke="${brand.palette.accent}" stroke-width="1" opacity="0.4"/>
    <text class="serif accent" text-anchor="middle" dominant-baseline="central" font-size="64" letter-spacing="2">R</text>
    <text class="serif muted" text-anchor="middle" font-size="13" letter-spacing="6" y="60">RESERVED</text>
  </g>`;
}

function chapterLine(chapter: string | null, date: string | null): string {
  if (!chapter && !date) return "";
  const parts: string[] = [];
  if (chapter) parts.push(chapter.toUpperCase());
  if (date) parts.push(date.toUpperCase());
  return `<text class="sans faint" x="0" y="-40" font-size="18" letter-spacing="3">${escapeXml(parts.join(" · "))}</text>`;
}

function pickTitle(template: OgTemplate, _opts: OgOptions): string {
  switch (template) {
    case "membership":
      return "Three tiers of belonging";
    case "how-it-works":
      return "How the Society works";
    case "chapter":
      return "Chapter report";
    case "journal":
      return "From the journal";
    default:
      return brand.copy.hero.headline;
  }
}

function pickSubtitle(template: OgTemplate): string {
  switch (template) {
    case "membership":
      return "A$5 · A$20 · A$50. The same belonging, different intensity.";
    case "how-it-works":
      return "Invitations. Cancellations. The relationship continues.";
    case "chapter":
      return "Notes from a particular city at a particular time.";
    case "journal":
      return "Etiquette, history, chapter letters, and the cadence of ordinary things.";
    default:
      return "A real paid membership that takes your absence seriously.";
  }
}

function truncate(s: string, maxWords: number): string {
  const words = s.split(/\s+/);
  if (words.length <= maxWords) return s;
  return words.slice(0, maxWords).join(" ") + "…";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Get the public path for a given OG template. Pages reference
 * these paths; the actual SVG/PNG is generated at request time
 * by the /og/[template].svg endpoint below.
 */
export function ogPath(template: OgTemplate, opts: { chapter?: string } = {}): string {
  const search = new URLSearchParams();
  if (template !== "default") search.set("t", template);
  if (opts.chapter) search.set("chapter", opts.chapter);
  const q = search.toString();
  return q ? `/og/default.svg?${q}` : "/og/default.svg";
}
