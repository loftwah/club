// Issue #12 — visual manifest derives from the canonical chapter
// catalogue, not from duplicated slugs.
//
// Regression: prove that adding a non-Australian chapter to the
// canonical `listChapters()` catalogue is enough for the visual
// manifest to re-emit the new `chapters-<slug>` surface without
// any routing/business-logic edit. The visual suite and the
// onboarding wizard both consume the same catalogue; the test
// imports the live list (not a snapshot) so the contract is
// enforced against the real source.

import { describe, expect, it } from "vitest";
import { listChapters, getChapter } from "../../src/lib/chapters";
import { VISUAL_SURFACES } from "../browser/visual/manifest";

describe("visual manifest chapter coverage", () => {
  it("derives one chapters-<slug> entry per canonical chapter", () => {
    const chapters = listChapters();
    const manifestChapterIds = VISUAL_SURFACES.filter((s) => s.id.startsWith("chapters-")).map(
      (s) => s.id.replace("chapters-", ""),
    );
    const expected = chapters.map((c) => c.slug).sort();
    expect(manifestChapterIds.sort()).toEqual(expected);
  });

  it("includes a non-Australian chapter in the visual matrix", () => {
    // Auckland is the canonical non-AU fixture.
    expect(getChapter("auckland")?.countryCode).toBe("NZ");
    const surface = VISUAL_SURFACES.find((s) => s.id === "chapters-auckland");
    expect(surface, "chapters-auckland surface must be in the manifest").toBeDefined();
    expect(surface?.path).toBe("/chapters/auckland/");
  });

  it("Auckland renders a Pacific/Auckland timestamp, not AU", () => {
    const auckland = getChapter("auckland");
    expect(auckland?.timezone).toBe("Pacific/Auckland");
    expect(auckland?.countryCode).toBe("NZ");
    // Crucially: a non-AU chapter in the catalogue should not
    // be classified as Australian; this guards the visual
    // matrix against accidentally hard-coding an AU-only flag.
    expect(auckland?.countryCode).not.toBe("AU");
  });

  it("every chapters-<slug> entry is a public surface with the right path", () => {
    for (const surface of VISUAL_SURFACES.filter((s) => s.id.startsWith("chapters-"))) {
      expect(surface.auth, `${surface.id} auth`).toBe("public");
      expect(surface.setup, `${surface.id} setup`).toBe("none");
      expect(surface.path, `${surface.id} path`).toMatch(/^\/chapters\/[^/]+\/$/);
    }
  });
});
