// Configurable brand layer — LOCKED for production.
//
// This is the single source of truth for the public-facing name,
// palette, typography, taglines, seal and tier names. The rest of
// the application reads from `brand` so re-locking the brand later
// is an inexpensive change to this file (and possibly the SVG
// seal in `public/brand/seal.svg`).
//
// LOCKED IDENTITY (final):
//   Name:      "Plans With You"
//   Short:     "Plans With You"
//   Legal:     "Plans With You Pty Ltd"
//   Tagline:   "You are wanted. You don't have to go."
//   Voice:     "Plans were made. Plans were unmade. You were on the list the whole time."
//
// VISUAL DIRECTION (locked):
//   Primary:   World 1 — On Schedule / Dispatch Wall
//              the calendar is the artefact. Cancellation is the design.
//              Contemporary administrative register, ink on warm paper,
//              cobalt schedule logic and a distinctive orange-vermilion
//              cancellation/status signal. No crest or faux heritage.
//   Supporting warmth from World 2 — In The Post
//              ONLY for personal correspondence, physical letters,
//              birthday/anniversary material, envelopes, packages.
//              Digital product stays contemporary; physical product
//              feels warm.
//
// Earlier (Round 1) directions (heritage, modernist, quiet modern)
// and the superseded name "The Reserved Society" remain in
// `explorations/brand/` as historical reference and are NOT the
// current production identity.
//
// TIER NAMES (locked, A$ / month):
//   A$5    — Member
//   A$20   — Corresponding Member
//   A$50   — Deluxe Member
//
// Higher tiers mean more costly fulfilment, not greater belonging.

// ----- Palette (locked) -----------------------------------------------------

export interface BrandPalette {
  /** Background canvas — warm off-white paper. */
  readonly bg: string;
  /** Slightly elevated surface (cards, raised panels). */
  readonly bgElev: string;
  /** Primary foreground — near-black ink. */
  readonly fg: string;
  /** Muted foreground — softer neutral for body / captions. */
  readonly fgMuted: string;
  /** Faintest foreground — footers, micro-copy. WCAG AA on bg. */
  readonly fgFaint: string;
  /** Primary signal — text-safe orange-vermilion (AA on bg). */
  readonly accent: string;
  /** Brighter signal used only for large graphics / non-text. */
  readonly accentBright: string;
  /** Dim variant of the accent — borders, hairlines. */
  readonly accentDim: string;
  /** Soft accent background — for status pills, banners. */
  readonly accentSoft: string;
  /** Secondary accent — deep oxblood for physical/cancellation mark. */
  readonly accentSecondary: string;
  /** Success / ok feedback. */
  readonly success: string;
  /** Error / failure feedback. */
  readonly error: string;
  /** Surface dividers, hairlines. */
  readonly line: string;
}

// All foreground/background pairs in the production palette
// pass WCAG AA (4.5:1) for normal text. Confirmed:
// Bright #E94616 is a non-text signal; use #B9340E wherever the
// cancellation colour carries white or normal-size text.
export interface BrandTypography {
  /** Display / wordmark / serif body — editorial character. */
  readonly serif: string;
  /** UI / nav / forms — system stack for performance + no CDN. */
  readonly sans: string;
  /** Mono — status codes, dates, member numbers. */
  readonly mono: string;
}

export interface BrandTier {
  readonly name: string;
  readonly priceAud: number;
  readonly tagline: string;
  /** One-line positioning sentence used on pricing surfaces. */
  readonly positioning: string;
  /** A short list of included capabilities used in tier cards. */
  readonly includes: ReadonlyArray<string>;
}

export interface BrandTiers {
  readonly member: BrandTier;
  readonly corresponding: BrandTier;
  readonly deluxe: BrandTier;
}

export interface BrandSeal {
  /** Public path to the production SVG mark. */
  readonly publicPath: string;
  /** Accessible label for the mark. */
  readonly ariaLabel: string;
}

export interface Brand {
  readonly name: string;
  readonly shortName: string;
  readonly legalName: string;
  /** Headline tagline (used in hero, social). */
  readonly tagline: string;
  /** Long proposition sentence (used in meta description, hero sub). */
  readonly proposition: string;
  /** Short internal-shorthand proposition used by surfaces that
   * need to fit a single sentence (hero lede, OG description). */
  readonly shortProposition: string;
  /** Brand voice principles. */
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
    readonly hero: {
      readonly headline: string;
      readonly sub: string;
      /** Primary hero CTA — leads to the waitlist. */
      readonly cta: string;
    };
    readonly waitlist: {
      /** Hero copy for /waiting-list. */
      readonly headline: string;
      readonly sub: string;
      /** Submit-button copy on /waiting-list. */
      readonly submit: string;
      /** Reassurance shown beneath the form (no payment, no nag). */
      readonly reassurance: string;
      /** Tier-intent acknowledgement, shown when ?tier= is present. */
      readonly tierInterestHeadline: string;
      readonly tierInterestBody: string;
    };
    readonly howItWorks: {
      readonly headline: string;
      readonly lede: string;
    };
    readonly emotionalArc: ReadonlyArray<string>;
    readonly aboutClosing: string;
    readonly correspondence: {
      readonly headline: string;
      readonly lede: string;
    };
    readonly privacyLead: string;
  };
  /** Marker showing the brand is locked. */
  readonly locked: true;
  /** ISO date the brand was locked. */
  readonly lockedOn: string;
}

/**
 * The production brand. Locked.
 */
export const brand: Brand = {
  name: "Plans With You",
  shortName: "Plans With You",
  legalName: "Plans With You Pty Ltd",
  tagline: "You are wanted. You don't have to go.",
  proposition:
    "A real scheduled commitment you can rely on, with credible supporting correspondence, predictably cancelled on time. Plans With You reserves a block in your calendar, makes the commitment look ordinary to anyone else, and unbreaks your week when the time comes.",
  shortProposition:
    "Protected time with a commitment that looks the part — and predictably gets cancelled.",
  voice: {
    precision: "precise, dry",
    warmth: "warm, never sentimental",
    dry: "dry, never arch",
  },
  palette: {
    bg: "#F5F1E7", // warm schedule paper
    bgElev: "#FBF9F3", // raised paper
    fg: "#12110F", // near-black ink
    fgMuted: "#4E4B44", // soft ink
    fgFaint: "#69655D", // dim, AA on paper
    accent: "#B9340E", // text-safe vermilion
    accentBright: "#E94616", // bright signal (graphics / dark text only)
    accentDim: "#12110F", // rule
    accentSoft: "#F7D9CC", // correspondence warmth
    accentSecondary: "#1932BE", // text-safe calendar cobalt
    success: "#126B3A",
    error: "#A5261E",
    line: "rgba(18, 17, 15, 0.19)",
  },
  typography: {
    // All production faces are bundled by Fontsource. There is no font CDN,
    // cross-origin dependency or client-side loader.
    serif: '"Source Serif 4 Variable", "Iowan Old Style", Georgia, serif',
    sans: '"Archivo Variable", "Arial Narrow", Arial, sans-serif',
    mono: '"Fragment Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  tiers: {
    member: {
      name: "Member",
      priceAud: 5,
      tagline: "The digital proof of a real commitment.",
      positioning:
        "A scheduled commitment that blocks your calendar and a credible email confirming it. The same product at every tier, plus more credibility outside the website as the price rises.",
      includes: [
        "Club identity and member number",
        "Calendar Meetings that block your time as busy",
        "A scheduled cancellation, sent on time",
        "Personalised digital correspondence",
        "Birthday and anniversary recognition",
        "Memory of the things you choose to share",
      ],
    },
    corresponding: {
      name: "Corresponding Member",
      priceAud: 20,
      tagline: "Human validation, posted letters.",
      positioning:
        "Everything in Member, with a real person able to confirm the commitment by letter or phone when someone asks.",
      includes: [
        "Welcome pack and physical membership card",
        "Posted birthday card",
        "Posted anniversary card",
        "Signed letters from our team",
        "Milestone artefacts",
        "Human validation of the commitment by phone or letter on request",
        "More personal attention from our team",
      ],
    },
    deluxe: {
      name: "Deluxe Member",
      priceAud: 50,
      tagline: "Physical evidence, presence if you ever need it.",
      positioning:
        "Everything in Corresponding Member, with posted parcels, optional calls, and access to a real person who can be physically present if the commitment ever needs it.",
      includes: [
        "All of the above",
        "Posted parcels and gifts",
        "Opted-in calls at permitted windows",
        "Premium milestone treatment",
        "Operator who can travel, attend or be present if the commitment requires it (quoted separately)",
        "Higher-quality physical items",
        "Deeper personal attention from our team",
      ],
    },
  },
  seal: {
    publicPath: "/brand/mark.svg",
    ariaLabel: "Plans With You mark",
  },
  seo: {
    titleTemplate: "%s — Plans With You",
    description:
      "Plans With You is a real paid membership that takes your absence seriously. We make plans and unmake them on purpose, so you are remembered without having to show up.",
    keywords: ["membership", "cancelled plans", "low pressure", "contemporary", "plans with you"],
  },
  copy: {
    hero: {
      headline: "Plans were made. Plans were unmade.",
      sub: "You were on the list the whole time.",
      cta: "Join the waitlist",
    },
    waitlist: {
      headline: "Be among the first members.",
      sub: "Membership opens slowly, chapter by chapter. Add your name to the list and we will write to you when we are ready for you.",
      submit: "Add me to the list",
      reassurance:
        "We will not charge anything. We will not chase you. We will write to you when paid membership opens for your tier.",
      tierInterestHeadline: "Noted: you're interested in this tier.",
      tierInterestBody:
        "Nothing has been charged. When paid membership opens, you will be invited to confirm at your own pace.",
    },
    howItWorks: {
      headline: "How it works",
      lede: "You join. Plans With You remembers you. From time to time we send you a plausible invitation to a small, ordinary plan. The date approaches. We cancel it on purpose. The relationship continues.",
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
      "Optional extras — physical mail, gifts, calls, help with a commitment, or agreed in-person help — add attention, not belonging.",
    correspondence: {
      headline: "Correspondence",
      lede: "We write to you. We write properly. Letters are signed. Envelopes are real. We don't send you four emails a week about nothing.",
    },
    privacyLead:
      "We collect what you give us, we use it to look after you, and you can ask us to forget any of it. We never sell, share, or train on your data.",
  },
  locked: true,
  lockedOn: "2026-08-24",
};

/**
 * Format an AUD price string consistently: `A$5`, `A$20`, `A$50`.
 */
export function formatPrice(aud: number): string {
  return `A$${aud}`;
}

/**
 * All production tier references, in canonical order. Used by pricing
 * tables, OG cards, and policy documents so the tier list lives in
 * exactly one place.
 */
export const ALL_TIERS: ReadonlyArray<BrandTier> = [
  brand.tiers.member,
  brand.tiers.corresponding,
  brand.tiers.deluxe,
];
