#!/usr/bin/env node
// Generate canonical 1200×630 Dispatch Wall social cards.
// The layout mirrors src/lib/og.ts without importing TypeScript into Node.

import { mkdirSync, writeFileSync } from "node:fs";

const WIDTH = 1200;
const HEIGHT = 630;
const BRAND = {
  name: "Plans With You",
  tagline: "You are wanted. You don't have to go.",
};

const TEMPLATES = {
  default: {
    title: "Plans were made. Then unmade.",
    subtitle: "A membership that remembers you without asking you to show up.",
  },
  membership: {
    title: "More tangible. Never more belonging.",
    subtitle: "Member A$5 · Corresponding Member A$20 · Deluxe Member A$50.",
  },
  "how-it-works": {
    title: "Cancellation is the destination.",
    subtitle: "Invited. Planned. Approaching. Cancelled. Archived.",
  },
  chapter: {
    title: "A chapter opens slowly.",
    subtitle: "Local context without a local obligation to attend.",
  },
  journal: {
    title: "Notes from the plans we unmade.",
    subtitle: "Correspondence, etiquette, chapters, memory and accumulated history.",
  },
};

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapLines(value, maxChars, maxLines) {
  const lines = [];
  for (const word of value.trim().split(/\s+/)) {
    const last = lines.at(-1);
    if (!last || `${last} ${word}`.length > maxChars) lines.push(word);
    else lines[lines.length - 1] = `${last} ${word}`;
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return kept;
}

function textLines(lines, { className, y, size, lineHeight, fill, letterSpacing }) {
  return lines
    .map(
      (line, index) =>
        `<text class="${className}" x="0" y="${y + index * lineHeight}" fill="${fill}" font-size="${size}" letter-spacing="${letterSpacing}">${escapeXml(line)}</text>`,
    )
    .join("\n");
}

function calendarObject() {
  return `<g transform="translate(820, 102) rotate(1 160 220)">
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

function renderOg({ title, subtitle }) {
  const titleLines = wrapLines(title, 20, 3);
  const subtitleLines = wrapLines(subtitle, 42, 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#12110f" stroke-opacity=".055" stroke-width="1"/></pattern>
    <style>.display{font-family:"Archivo","Arial Narrow",sans-serif;font-weight:700}.letter{font-family:"Source Serif 4",Georgia,serif}.data{font-family:"Fragment Mono",ui-monospace,monospace}</style>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f5f1e7"/><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>
  <rect width="${WIDTH}" height="54" fill="#12110f"/><circle cx="64" cy="27" r="6" fill="#e94616"/>
  <text class="data" x="82" y="33" fill="#f5f1e7" font-size="13" letter-spacing="2">PLANS WITH YOU / ON SCHEDULE</text>
  <text class="data" x="1136" y="33" fill="#f5f1e7" font-size="13" letter-spacing="2" text-anchor="end">WAITLIST OPEN</text>
  <g transform="translate(64, 144)">
    ${textLines(titleLines, { className: "display", y: 0, size: 67, lineHeight: 66, fill: "#12110f", letterSpacing: -2 })}
    ${textLines(subtitleLines, { className: "letter", y: 248, size: 24, lineHeight: 31, fill: "#4e4b44", letterSpacing: 0 })}
    <line x1="0" x2="630" y1="380" y2="380" stroke="#12110f"/>
    <text class="data" x="0" y="412" fill="#b9340e" font-size="15" letter-spacing="1.5">${escapeXml(BRAND.tagline.toUpperCase())}</text>
  </g>${calendarObject()}
  </svg>`;
}

mkdirSync("public/og", { recursive: true });
for (const [name, template] of Object.entries(TEMPLATES)) {
  const svg = renderOg(template);
  writeFileSync(`public/og/${name}.svg`, svg);
  console.info(`wrote public/og/${name}.svg (${svg.length} bytes)`);
}
