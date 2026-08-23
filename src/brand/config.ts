// Configurable brand layer.
//
// The public-facing name, palette, typography, taglines and seal are
// not final. This file is the single place that describes them. The
// rest of the application reads from `brand` so that re-locking the
// brand later is an inexpensive change to this file (and possibly
// the SVG seal in `public/explorations/brand/seals/`).
//
// Per AGENTS.md, the final name, tier names, palette, fonts, and
// tagline are explicitly "ask before locking" decisions. The values
// below are the provisional candidate set the user can later
// approve or replace.
//
// PROVISIONAL IDENTITY (Round 2 of brand exploration):
//   Name:      "Plans With You"
//   Direction: World 1 — On Schedule
//   Concept:   the calendar is the artefact. Cancellation is the
//              design. Contemporary editorial register, ink on
//              cream, single orange accent.
//
// Earlier (Round 1) directions (heritage, modernist, quiet modern)
// remain in `explorations/brand/` as historical reference and are
// NOT the current recommendation. See
// `explorations/brand/docs/09-DECISION-PACKAGE-R2.md`.

export interface BrandPalette {
  /** Background canvas. */
  readonly bg: string;
  /** Slightly elevated surfaces. */
  readonly bgElev: string;
  /** Primary foreground. */
  readonly fg: string;
  /** Muted foreground (body, captions). */
  readonly fgMuted: string;
  /** Faintest foreground (footers, micro-copy). */
  readonly fgFaint: string;
  /** Single accent. Used sparingly. */
  readonly accent: string;
  /** Dim variant of the accent (borders, hairlines). */
  readonly accentDim: string;
  /** Secondary accent for the cancellation mark. */
  readonly accentSecondary: string;
  /** Success / ok feedback. */
  readonly success: string;
  /** Error / failure feedback. */
  readonly error: string;
  /** Surface dividers, hairlines. */
  readonly line: string;
}

export interface BrandTypography {
  /** Display / wordmark / serif body. */
  readonly serif: string;
  /** UI / nav / forms. */
  readonly sans: string;
  /** Optional monospace for seals, codes, memberships, dates. */
  readonly mono: string;
}

export interface BrandTiers {
  readonly core: { readonly name: string; readonly priceAud: number; readonly tagline: string };
  readonly correspondence: {
    readonly name: string;
    readonly priceAud: number;
    readonly tagline: string;
  };
  readonly deluxe: { readonly name: string; readonly priceAud: number; readonly tagline: string };
}

export interface BrandSeal {
  /** Public path to the production SVG seal. */
  readonly publicPath: string;
  /** Accessible label for the seal. */
  readonly ariaLabel: string;
}

export interface Brand {
  readonly name: string;
  readonly shortName: string;
  readonly legalName: string;
  readonly tagline: string;
  readonly proposition: string;
  readonly voice: {
    readonly precision: string;
    readonly warmth: string;
    readonly dry: string;
  };
  readonly palette: BrandPalette;
  readonly typography: BrandTypography;
  readonly tiers: BrandTiers;
  readonly seal: BrandSeal;
  readonly seo: {
    readonly titleTemplate: string;
    readonly description: string;
    readonly keywords: ReadonlyArray<string>;
  };
  readonly copy: {
    readonly hero: { readonly headline: string; readonly sub: string; readonly cta: string };
    readonly howItWorks: { readonly headline: string; readonly lede: string };
    readonly emotionalArc: ReadonlyArray<string>;
    readonly aboutClosing: string;
  };
  readonly development: {
    /** Marker so anyone reading the repo knows this is provisional. */
    readonly isProvisional: true;
    /** Round 2 of brand exploration. */
    readonly explorationRound: 2;
  };
}

/**
 * The current provisional brand. Round 2 — "Plans With You" / On
 * Schedule. World 1's recurring graphic device is a calendar cell
 * with a state. The cancellation is the same form as the invitation.
 *
 * The palette and typography are designed to read as "contemporary
 * editorial — ink on cream, single orange accent" — not as a
 * heritage club. The seal is the production-ready SVG that
 * already exists at `public/explorations/brand/seals/`.
 */
export const brand: Brand = {
  name: "Plans With You",
  shortName: "Plans With You",
  legalName: "Plans With You Pty Ltd (provisional)",
  tagline: "Plans were made. Plans were unmade.",
  proposition:
    "A real paid membership that takes your absence seriously. Plans were made. Plans were unmade.",
  voice: {
    precision: "precise, dry",
    warmth: "warm, never sentimental",
    dry: "dry, never arch",
  },
  palette: {
    bg: "#F5F2EA", // --paper
    bgElev: "#E8E3D2", // --paper-2
    fg: "#111111", // --ink
    fgMuted: "#3A3A3A", // --ink-soft
    fgFaint: "#9A9A9A", // --dim
    accent: "#FF5A1F", // --signal: cancelled orange
    accentDim: "#222222", // --rule
    accentSecondary: "#5C1A1B", // --oxblood: secondary, for cancellation mark
    success: "#1B6E3A",
    error: "#A12622",
    line: "rgba(17, 17, 17, 0.12)",
  },
  typography: {
    serif: '"Iowan Old Style", "Palatino Linotype", Palatino, "Source Serif Pro", Georgia, serif',
    sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },
  tiers: {
    core: {
      name: "Core",
      priceAud: 5,
      tagline: "Plans, cancellations, memory.",
    },
    correspondence: {
      name: "Correspondence",
      priceAud: 20,
      tagline: "Plans arrive in the post.",
    },
    deluxe: {
      name: "Deluxe",
      priceAud: 50,
      tagline: "Genuine attention from the people behind it.",
    },
  },
  seal: {
    publicPath: "/explorations/brand/seals/seal-a-modernist.svg",
    ariaLabel: "Plans With You seal",
  },
  seo: {
    titleTemplate: "%s — Plans With You",
    description:
      "A real paid membership that takes your absence seriously. Plans were made. Plans were unmade.",
    keywords: ["membership", "low pressure", "cancelled plans", "social club", "contemporary"],
  },
  copy: {
    hero: {
      headline: "Plans were made. Plans were unmade.",
      sub: "You were on the list the whole time.",
      cta: "Add your name to the list",
    },
    howItWorks: {
      headline: "How it works",
      lede: "You join. The Society remembers you. From time to time the Society sends you a plausible invitation to a small, ordinary, deliberately constructed event. The plan is real. The date approaches. The Society cancels it. The relationship continues.",
    },
    emotionalArc: [
      "I was on the list",
      "Plans were made",
      "The plan felt plausible",
      "The date approached",
      "The plan was unmade",
      "I am still on the list",
    ],
    aboutClosing:
      "Optional services — physical mail, gifts, calls, manufactured commitments, real-world representative services — are intensity, not belonging.",
  },
  development: {
    isProvisional: true,
    explorationRound: 2,
  },
};

/**
 * Format an AUD price string consistently: `A$5`, `A$20`, `A$50`.
 */
export function formatPrice(aud: number): string {
  return `A$${aud}`;
}
