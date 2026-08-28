// Canonical chapter catalogue.
//
// The chapter list is the single source of truth for every
// public, member, onboarding and visual surface. Adding a
// non-Australian chapter must require zero routing or
// business-logic edits: just append an entry here (and, if
// the chapter is going to receive real members immediately,
// seed a row in the `chapters` table).
//
// The list is exposed through `listChapters()` and
// `getChapter(slug)`. Both are pure functions: they read
// from D1 when a row exists and fall back to the canonical
// in-code catalogue otherwise. This means:
//
//   - A fresh local D1 has every chapter visible immediately.
//   - A new chapter can be configured in two ways:
//       1. Append to CANONICAL_CHAPTERS (one file, one list).
//       2. Or insert a row into the `chapters` table with the
//          same slug and a status of WAITLIST_ONLY or ACTIVE.
//   - The visual manifest derives its `chapters-<slug>`
//     entries from this catalogue so any addition shows up
//     in the QA matrix automatically.
//
// The shape is the same `ChapterGeography` used by
// `lib/geography.ts`; status and `note` ride along.

import type { ChapterGeography } from "./geography.js";
import type { D1Database } from "@cloudflare/workers-types";

export type ChapterStatus = "ACTIVE" | "WAITLIST_ONLY" | "COMING" | "RETIRED";

export interface Chapter extends ChapterGeography {
  readonly slug: string;
  readonly name: string;
  readonly status: ChapterStatus;
  readonly note: string;
  /** When the chapter first appeared in the catalogue. Used as a stable sort tiebreaker. */
  readonly openedAt: string;
}

const CANONICAL_CHAPTERS: ReadonlyArray<Chapter> = [
  {
    slug: "melbourne",
    name: "Melbourne",
    status: "ACTIVE",
    note: "The opening chapter. Waitlist signups are accepted now.",
    countryCode: "AU",
    region: "VIC",
    timezone: "Australia/Melbourne",
    locale: "en-AU",
    displayLocality: "Melbourne",
    openedAt: "2024-08-01T00:00:00.000Z",
  },
  {
    slug: "sydney",
    name: "Sydney",
    status: "COMING",
    note: "Locations under research. Waitlist open for expressions of interest.",
    countryCode: "AU",
    region: "NSW",
    timezone: "Australia/Sydney",
    locale: "en-AU",
    displayLocality: "Sydney",
    openedAt: "2024-09-01T00:00:00.000Z",
  },
  {
    slug: "brisbane",
    name: "Brisbane",
    status: "COMING",
    note: "Locations under research. Waitlist open for expressions of interest.",
    countryCode: "AU",
    region: "QLD",
    timezone: "Australia/Brisbane",
    locale: "en-AU",
    displayLocality: "Brisbane",
    openedAt: "2024-10-01T00:00:00.000Z",
  },
  {
    slug: "adelaide",
    name: "Adelaide",
    status: "COMING",
    note: "Locations under research. Waitlist open for expressions of interest.",
    countryCode: "AU",
    region: "SA",
    timezone: "Australia/Adelaide",
    locale: "en-AU",
    displayLocality: "Adelaide",
    openedAt: "2024-11-01T00:00:00.000Z",
  },
  {
    slug: "perth",
    name: "Perth",
    status: "COMING",
    note: "Locations under research. Waitlist open for expressions of interest.",
    countryCode: "AU",
    region: "WA",
    timezone: "Australia/Perth",
    locale: "en-AU",
    displayLocality: "Perth",
    openedAt: "2024-12-01T00:00:00.000Z",
  },
  {
    slug: "auckland",
    name: "Auckland",
    status: "COMING",
    note: "Locations under research. Waitlist open for expressions of interest.",
    countryCode: "NZ",
    region: "Auckland",
    timezone: "Pacific/Auckland",
    locale: "en-NZ",
    displayLocality: "Auckland",
    openedAt: "2025-02-01T00:00:00.000Z",
  },
];

const SLUG_INDEX: ReadonlyMap<string, Chapter> = new Map(
  CANONICAL_CHAPTERS.map((c) => [c.slug, c]),
);

export function listChapters(): ReadonlyArray<Chapter> {
  return CANONICAL_CHAPTERS;
}

export function getChapter(slug: string): Chapter | null {
  return SLUG_INDEX.get(slug) ?? null;
}

/**
 * Resolve a chapter by slug using the D1 row when present and
 * falling back to the in-code catalogue. The D1 row wins for
 * status/note/display locality so operators can edit a chapter
 * without redeploying, but the canonical entry guarantees a
 * never-missing base layer for new non-Australian chapters.
 */
export interface ChapterResolutionSource {
  readonly db: D1Database | null;
}

interface ChapterRow {
  readonly slug: string;
  readonly name: string;
  readonly status: string;
  readonly country_code: string | null;
  readonly region: string | null;
  readonly timezone: string | null;
  readonly locale: string | null;
  readonly display_locality: string | null;
}

export async function resolveChapter(
  source: ChapterResolutionSource,
  slug: string,
): Promise<Chapter | null> {
  const canonical = getChapter(slug);
  if (!source.db) return canonical;
  try {
    const row = await source.db
      .prepare(
        `SELECT slug, name, status, country_code, region, timezone, locale, display_locality
           FROM chapters WHERE slug = ?`,
      )
      .bind(slug)
      .first<ChapterRow>();
    if (!row) return canonical;
    if (!canonical) {
      // A non-canonical slug exists in the DB (operator-inserted
      // chapter that was never added to CANONICAL_CHAPTERS). This
      // is supported: a chapter can be created by inserting a row
      // alone. We synthesise the rest from the row.
      return {
        slug: row.slug,
        name: row.name,
        status: normaliseStatus(row.status),
        note: "",
        countryCode: row.country_code ?? undefined,
        region: row.region ?? undefined,
        timezone: row.timezone ?? "UTC",
        locale: row.locale ?? "en-AU",
        displayLocality: row.display_locality ?? row.name,
        openedAt: new Date().toISOString(),
      };
    }
    return {
      ...canonical,
      name: row.name,
      status: normaliseStatus(row.status),
      countryCode: row.country_code ?? canonical.countryCode,
      region: row.region ?? canonical.region,
      timezone: row.timezone ?? canonical.timezone,
      locale: row.locale ?? canonical.locale,
      displayLocality: row.display_locality ?? canonical.displayLocality,
    };
  } catch {
    return canonical;
  }
}

export async function resolveChapters(
  source: ChapterResolutionSource,
): Promise<ReadonlyArray<Chapter>> {
  const canonical = listChapters();
  if (!source.db) return canonical;
  const rows = await source.db
    .prepare(
      `SELECT slug, name, status, country_code, region, timezone, locale, display_locality FROM chapters`,
    )
    .all<ChapterRow>();
  const bySlug = new Map<string, ChapterRow>();
  for (const row of rows.results ?? []) bySlug.set(row.slug, row);
  // Start with the canonical list (in order), then append any
  // D1-only chapters that aren't in the canonical catalogue.
  // This means a brand-new non-Australian chapter can be
  // introduced by inserting one row into the DB.
  const merged: Chapter[] = canonical.map((c) => {
    const row = bySlug.get(c.slug);
    if (!row) return c;
    return {
      ...c,
      name: row.name,
      status: normaliseStatus(row.status),
      countryCode: row.country_code ?? c.countryCode,
      region: row.region ?? c.region,
      timezone: row.timezone ?? c.timezone,
      locale: row.locale ?? c.locale,
      displayLocality: row.display_locality ?? c.displayLocality,
    };
  });
  for (const row of rows.results ?? []) {
    if (canonical.find((c) => c.slug === row.slug)) continue;
    merged.push({
      slug: row.slug,
      name: row.name,
      status: normaliseStatus(row.status),
      note: "",
      countryCode: row.country_code ?? undefined,
      region: row.region ?? undefined,
      timezone: row.timezone ?? "UTC",
      locale: row.locale ?? "en-AU",
      displayLocality: row.display_locality ?? row.name,
      openedAt: new Date().toISOString(),
    });
  }
  return merged;
}

function normaliseStatus(s: string): ChapterStatus {
  switch ((s ?? "").toUpperCase()) {
    case "ACTIVE":
      return "ACTIVE";
    case "WAITLIST_ONLY":
      return "WAITLIST_ONLY";
    case "RETIRED":
      return "RETIRED";
    default:
      return "COMING";
  }
}
