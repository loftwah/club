// Issue #12 — a new non-AU chapter can be added without editing
// chapter-routing business logic.
//
// Regression: appending a row to the `chapters` table alone
// (without touching `CANONICAL_CHAPTERS`) is enough for the
// `resolveChapters` helper to surface the new chapter. The
// visual manifest derives its `chapters-<slug>` entries from
// the catalogue via `listChapters()`; the test exercises
// `resolveChapters` with a MockD1Database so the contract is
// real, not a hand-rolled array.

import { describe, expect, it } from "vitest";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { resolveChapters } from "../../src/lib/chapters";
import { listChapters } from "../../src/lib/chapters";

describe("chapter catalogue merge", () => {
  it("a D1-only chapter appears in resolveChapters without editing CANONICAL_CHAPTERS", async () => {
    const db = new MockD1Database();
    loadSchema(db);
    // The canonical list already includes Auckland; add a brand
    // new non-AU chapter that exists ONLY in the DB row.
    db.insert("chapters", {
      id: "chap_singapore",
      slug: "singapore",
      name: "Singapore",
      status: "WAITLIST_ONLY",
      country_code: "SG",
      region: null,
      timezone: "Asia/Singapore",
      locale: "en-SG",
      display_locality: "Singapore",
      created_at: "2026-08-15T10:00:00.000Z",
    });
    const merged = await resolveChapters({ db: db as unknown as D1Database });
    const slugs = merged.map((c) => c.slug);
    expect(slugs).toContain("singapore");
    // The canonical six are still there.
    const canonical = listChapters().map((c) => c.slug);
    for (const c of canonical) expect(slugs).toContain(c);
    // The DB-only chapter is classified as non-AU.
    const singapore = merged.find((c) => c.slug === "singapore");
    expect(singapore?.countryCode).toBe("SG");
    expect(singapore?.timezone).toBe("Asia/Singapore");
  });

  it("Auckland (NZ) appears in resolveChapters when seeded with a D1 row", async () => {
    const db = new MockD1Database();
    loadSchema(db);
    // The canonical row for Auckland isn't in the DB; resolveChapters
    // should fall back to CANONICAL_CHAPTERS.
    const merged = await resolveChapters({ db: db as unknown as D1Database });
    const auckland = merged.find((c) => c.slug === "auckland");
    expect(auckland, "Auckland must surface even when not in the DB").toBeDefined();
    expect(auckland?.countryCode).toBe("NZ");
    expect(auckland?.timezone).toBe("Pacific/Auckland");
  });
});
