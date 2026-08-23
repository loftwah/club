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
  /** Optional monospace for seals, codes, memberships. */
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
}

/**
 * The current provisional brand. All values are placeholders the
 * user can lock or replace without changing application code.
 *
 * The palette and typography are designed to read as "premium,
 * restrained, editorial, warm, slightly mysterious" — not as a
 * heritage club. The seal is the production-ready SVG that
 * already exists at `public/explorations/brand/seals/`.
 */
export const brand: Brand = {
  name: "The Reserved Society",
  shortName: "The Society",
  legalName: "The Reserved Society Pty Ltd (provisional)",
  tagline: "You belong. You are invited. You are remembered. You do not have to show up.",
  proposition: "A real paid membership that takes your absence seriously.",
  voice: {
    precision: "precise, dry",
    warmth: "warm, never sentimental",
    dry: "dry, never arch",
  },
  palette: {
    bg: "#0e1116",
    bgElev: "#161b22",
    fg: "#e7ecf2",
    fgMuted: "#9aa4b1",
    fgFaint: "#7a8392",
    accent: "#c8a25a",
    accentDim: "#8a6d36",
    success: "#7fc59c",
    error: "#d97a7a",
    line: "rgba(255, 255, 255, 0.08)",
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
      tagline: "The relationship, the cadence, the memory.",
    },
    correspondence: {
      name: "Correspondence",
      priceAud: 20,
      tagline: "The Society arrives in the letterbox.",
    },
    deluxe: {
      name: "Deluxe Human",
      priceAud: 50,
      tagline: "Genuine attention from the people behind it.",
    },
  },
  seal: {
    publicPath: "/explorations/brand/seals/seal-a-modernist.svg",
    ariaLabel: "The Reserved Society seal",
  },
  seo: {
    titleTemplate: "%s — The Reserved Society",
    description:
      "A real paid membership that takes your absence seriously. Invitations, cancellations, correspondence, gifts, calls, manufactured commitments.",
    keywords: [
      "social club",
      "introvert",
      "low pressure",
      "belonging without participating",
      "cancelled plans",
      "social membership",
    ],
  },
  copy: {
    hero: {
      headline: "You belong. You are invited. You are remembered.",
      sub: "You do not have to show up.",
      cta: "Join the waiting list",
    },
    howItWorks: {
      headline: "How it works",
      lede: "You join. The Society remembers you. From time to time the Society sends you a plausible invitation to a small, ordinary, deliberately constructed event. You are not expected to attend. The plan feels plausible, the date approaches, and the Society cancels it. The relationship continues.",
    },
    emotionalArc: [
      "I belong",
      "I am invited",
      "I have plans",
      "the plan feels plausible",
      "the date approaches",
      "the Society cancels it",
      "relief",
      "the relationship continues",
    ],
    aboutClosing:
      "Optional services — physical mail, gifts, calls, manufactured commitments, real-world Society representative services — are intensity, not belonging.",
  },
};

/**
 * Format an AUD price string consistently: `A$5`, `A$20`, `A$50`.
 */
export function formatPrice(aud: number): string {
  return `A$${aud}`;
}
