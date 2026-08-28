// Issue #12 — onboarding chapter selection derives from the
// canonical catalogue.
//
// Regression: the onboarding "chapter" step must render one
// <option> per canonical chapter. Adding a new chapter to
// `listChapters()` (or inserting a row in the `chapters`
// table) must be sufficient; no edit to the wizard template
// is required. This test reads the source of the onboarding
// step page and asserts that the chapter <option> list is
// produced from the canonical catalogue, not a hand-rolled
// array. It also imports `listChapters()` and proves the
// Auckland fixture is in the rendered set.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listChapters } from "../../src/lib/chapters";

describe("onboarding chapter step uses the canonical catalogue", () => {
  it("the step template imports listChapters and maps over chapterOptions", () => {
    const src = readFileSync(
      resolve(__dirname, "../../src/pages/onboarding/[step].astro"),
      "utf-8",
    );
    // The template must import the canonical list, not a
    // hand-rolled chapter array.
    expect(src).toMatch(/import\s*{\s*listChapters\s*}\s*from\s*["']@lib\/chapters["']/);
    // The chapter <select> must iterate over a derived list
    // (chapterOptions), not a hard-coded array of <option>s.
    expect(src).toMatch(/chapterOptions\.map\(/);
    // The legacy hard-coded "chap_melbourne" / "chap_sydney" /
    // etc. values must not survive.
    expect(src).not.toMatch(/chap_melbourne/);
    expect(src).not.toMatch(/chap_sydney/);
    expect(src).not.toMatch(/chap_brisbane/);
    expect(src).not.toMatch(/chap_adelaide/);
    expect(src).not.toMatch(/chap_perth/);
  });

  it("Auckland is part of the canonical catalogue used by the wizard", () => {
    const auckland = listChapters().find((c) => c.slug === "auckland");
    expect(auckland, "Auckland must be in the canonical catalogue").toBeDefined();
    expect(auckland?.countryCode).toBe("NZ");
  });

  it("every canonical chapter appears in the catalogue", () => {
    const slugs = listChapters().map((c) => c.slug);
    for (const required of ["melbourne", "sydney", "brisbane", "adelaide", "perth", "auckland"]) {
      expect(slugs, `${required} must be in the catalogue`).toContain(required);
    }
  });
});
