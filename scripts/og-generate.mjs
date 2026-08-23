#!/usr/bin/env node
// Generate the canonical OG / social image SVGs at build time.
// Uses a self-contained renderer (mirror of src/lib/og.ts logic)
// to avoid TS-extension import issues in plain Node.

import { writeFileSync, mkdirSync } from "node:fs";

const BRAND = {
  name: "Plans With You",
  shortName: "The Society",
  tagline: "You belong. You are invited. You are remembered. You do not have to show up.",
  palette: {
    bg: "#0e1116",
    fg: "#e7ecf2",
    fgMuted: "#9aa4b1",
    fgFaint: "#7a8392",
    accent: "#c8a25a",
    accentDim: "#8a6d36",
  },
  typography: {
    serif: '"Iowan Old Style", "Palatino Linotype", Palatino, "Source Serif Pro", Georgia, serif',
    sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  copy: {
    hero: {
      headline: "You belong. You are invited. You are remembered.",
      sub: "You do not have to show up.",
    },
  },
};

const WIDTH = 1200;
const HEIGHT = 630;

const TEMPLATES = {
  default: {
    title: BRAND.copy.hero.headline,
    subtitle: "A real paid membership that takes your absence seriously.",
  },
  membership: {
    title: "Three tiers of belonging",
    subtitle: "A$5 · A$20 · A$50. The same belonging, different intensity.",
  },
  "how-it-works": {
    title: "How the Society works",
    subtitle: "Invitations. Cancellations. The relationship continues.",
  },
  chapter: {
    title: "Chapter report",
    subtitle: "Notes from a particular city at a particular time.",
  },
  journal: {
    title: "From the journal",
    subtitle: "Etiquette, history, chapter letters, and the cadence of ordinary things.",
  },
};

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderOg(template) {
  const { title, subtitle } = TEMPLATES[template];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <radialGradient id="g" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1b2230" stop-opacity="0"/>
      <stop offset="100%" stop-color="#070a0f" stop-opacity="0.7"/>
    </radialGradient>
  </defs>
  <rect fill="${BRAND.palette.bg}" width="${WIDTH}" height="${HEIGHT}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
  <g stroke="${BRAND.palette.accentDim}" stroke-width="2" fill="none">
    <path d="M 60 60 L 60 100 M 60 60 L 100 60"/>
    <path d="M ${WIDTH - 60} 60 L ${WIDTH - 60} 100 M ${WIDTH - 60} 60 L ${WIDTH - 100} 60"/>
    <path d="M 60 ${HEIGHT - 60} L 60 ${HEIGHT - 100} M 60 ${HEIGHT - 60} L 100 ${HEIGHT - 60}"/>
    <path d="M ${WIDTH - 60} ${HEIGHT - 60} L ${WIDTH - 60} ${HEIGHT - 100} M ${WIDTH - 60} ${HEIGHT - 60} L ${WIDTH - 100} ${HEIGHT - 60}"/>
  </g>
  <g transform="translate(230, ${HEIGHT / 2})">
    <circle r="130" fill="none" stroke="${BRAND.palette.accent}" stroke-width="2" opacity="0.6"/>
    <circle r="116" fill="none" stroke="${BRAND.palette.accent}" stroke-width="1" opacity="0.4"/>
    <text font-family='${BRAND.typography.serif}' fill="${BRAND.palette.accent}" text-anchor="middle" dominant-baseline="central" font-size="64" letter-spacing="2">R</text>
    <text font-family='${BRAND.typography.serif}' fill="${BRAND.palette.fgMuted}" text-anchor="middle" font-size="13" letter-spacing="6" y="60">RESERVED</text>
  </g>
  <g transform="translate(440, 168)">
    <text font-family='${BRAND.typography.serif}' fill="${BRAND.palette.fg}" x="0" y="0" font-size="84" font-weight="400" letter-spacing="-1">${escapeXml(title)}</text>
    <text font-family='${BRAND.typography.sans}' fill="${BRAND.palette.fgMuted}" x="0" y="80" font-size="32" font-weight="400">${escapeXml(subtitle)}</text>
    <line x1="0" x2="120" y1="160" y2="160" stroke="${BRAND.palette.accentDim}" stroke-width="2"/>
    <text font-family='${BRAND.typography.serif}' fill="${BRAND.palette.accent}" x="0" y="220" font-size="28" letter-spacing="2">${escapeXml(BRAND.name.toUpperCase())}</text>
    <text font-family='${BRAND.typography.sans}' fill="${BRAND.palette.fgFaint}" x="0" y="260" font-size="20">${escapeXml(BRAND.tagline)}</text>
  </g>
</svg>`;
}

mkdirSync("public/og", { recursive: true });
for (const t of Object.keys(TEMPLATES)) {
  const svg = renderOg(t);
  writeFileSync(`public/og/${t}.svg`, svg);
  console.info(`wrote public/og/${t}.svg (${svg.length} bytes)`);
}
