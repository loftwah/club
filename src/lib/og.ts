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
 * Dispatch Wall social card: schedule grid, large editorial copy and a
 * cancelled calendar object. All typography remains real SVG text.
 */
export function renderOgSvg(opts: OgOptions = {}): string {
  const template = opts.template ?? "default";
  const title = opts.title ?? pickTitle(template, opts);
  const subtitle = opts.subtitle ?? pickSubtitle(template);
  const chapter = opts.chapter ?? null;
  const date = opts.date ?? null;

  const titleLines = wrapLines(title, 20, 3);
  const subtitleLines = wrapLines(subtitle, 42, 3);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#12110f" stroke-opacity=".055" stroke-width="1"/></pattern>
    <style>
      .display { font-family: "Archivo", "Arial Narrow", sans-serif; font-weight: 700; }
      .letter { font-family: "Source Serif 4", Georgia, serif; }
      .data { font-family: "Fragment Mono", ui-monospace, monospace; }
    </style>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f5f1e7"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>
  <rect width="${WIDTH}" height="54" fill="#12110f"/>
  <circle cx="64" cy="27" r="6" fill="#e94616"/>
  <text class="data" x="82" y="33" fill="#f5f1e7" font-size="13" letter-spacing="2">PLANS WITH YOU / ON SCHEDULE</text>
  <text class="data" x="1136" y="33" fill="#f5f1e7" font-size="13" letter-spacing="2" text-anchor="end">WAITLIST OPEN</text>
  <g transform="translate(64, 144)">
    ${chapterLine(chapter, date)}
    ${renderTextLines(titleLines, { className: "display", y: 0, size: 67, lineHeight: 66, fill: "#12110f", letterSpacing: -2 })}
    ${renderTextLines(subtitleLines, { className: "letter", y: 248, size: 24, lineHeight: 31, fill: "#4e4b44", letterSpacing: 0 })}
    <line x1="0" x2="630" y1="380" y2="380" stroke="#12110f" stroke-width="1"/>
    <text class="data" x="0" y="412" fill="#b9340e" font-size="15" letter-spacing="1.5">${escapeXml(brand.tagline.toUpperCase())}</text>
  </g>
  ${renderCalendarObject()}
</svg>`;
}

function renderCalendarObject(): string {
  return `
  <g transform="translate(820, 102) rotate(1 160 220)">
    <rect x="12" y="14" width="316" height="442" fill="#12110f" opacity=".1"/>
    <rect width="316" height="442" fill="#fbf9f3" stroke="#12110f" stroke-width="2"/>
    <rect width="316" height="38" fill="#2447ff"/>
    <text class="data" x="14" y="24" fill="white" font-size="10" letter-spacing="1">ORDINARY PLAN / ILLUSTRATION</text>
    <text class="display" x="158" y="190" fill="#12110f" font-size="142" letter-spacing="-10" text-anchor="middle">24</text>
    <line x1="0" x2="316" y1="220" y2="220" stroke="#12110f"/>
    <text class="letter" x="16" y="256" fill="#12110f" font-size="22">Something plausible</text>
    <text class="data" x="16" y="278" fill="#69655d" font-size="9">NO ATTENDANCE REQUIRED</text>
    <rect y="300" width="316" height="98" fill="#e94616"/>
    <text class="data" x="16" y="326" fill="#12110f" font-size="10" letter-spacing="1">PLAN UPDATE</text>
    <text class="display" x="16" y="368" fill="#12110f" font-size="31">CANCELLED.</text>
    <text class="data" x="16" y="386" fill="#12110f" font-size="9">FULFILMENT COMPLETE</text>
    <text class="data" x="16" y="424" fill="#69655d" font-size="9">THE RELATIONSHIP CONTINUES</text>
  </g>`;
}

function chapterLine(chapter: string | null, date: string | null): string {
  if (!chapter && !date) return "";
  const parts: string[] = [];
  if (chapter) parts.push(chapter.toUpperCase());
  if (date) parts.push(date.toUpperCase());
  return `<text class="data" x="0" y="-38" fill="#69655d" font-size="12" letter-spacing="2">${escapeXml(parts.join(" / "))}</text>`;
}

function pickTitle(template: OgTemplate, _opts: OgOptions): string {
  switch (template) {
    case "membership":
      return "Three tiers of belonging";
    case "how-it-works":
      return "How Plans With You works";
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
      return brand.proposition;
  }
}

function wrapLines(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (!last || `${last} ${word}`.length > maxChars) lines.push(word);
    else lines[lines.length - 1] = `${last} ${word}`;
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return kept;
}

function renderTextLines(
  lines: string[],
  options: {
    className: string;
    y: number;
    size: number;
    lineHeight: number;
    fill: string;
    letterSpacing: number;
  },
): string {
  return lines
    .map(
      (line, index) =>
        `<text class="${options.className}" x="0" y="${options.y + index * options.lineHeight}" fill="${options.fill}" font-size="${options.size}" letter-spacing="${options.letterSpacing}">${escapeXml(line)}</text>`,
    )
    .join("\n");
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
