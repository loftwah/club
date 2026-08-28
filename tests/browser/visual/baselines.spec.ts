// Issue #8: reviewed Playwright visual baselines.
//
// This file defines the canonical visual regression suite. The
// mandatory surfaces (per the issue) have a reviewed baseline
// for both the first-viewport and full-page captures at the
// canonical 1440x1000, 1024x768, 768x1024, 390x844, 320x568
// sizes. The first-run baseline generation is opt-in via
// `pnpm test:visual:update`; normal `pnpm acceptance` does not
// update snapshots. The first run with empty baselines will
// fail; that is expected and surfaces as a "review snapshot"
// gate, not a regression.
//
// The visual suite is intentionally additive: a failure on a
// surface that has geometry/snapshot coverage in the manifest
// from #6 means the snapshot must be reviewed against the
// Dispatch Wall reference, not silently regenerated.

import { test, expect } from "@playwright/test";
import { VISUAL_SURFACES, VISUAL_VIEWPORTS } from "./manifest";

const HOMEPAGE_VIEWPORTS = ["desktop", "mobile"] as const;

const MANDATORY_PUBLIC_SURFACES = [
  { id: "home", path: "/" },
  { id: "how-it-works", path: "/how-it-works/" },
  { id: "membership", path: "/membership/" },
  { id: "correspondence", path: "/correspondence/" },
  { id: "chapters", path: "/chapters/" },
  { id: "chapters-melbourne", path: "/chapters/melbourne/" },
  { id: "journal", path: "/journal/" },
  { id: "faq", path: "/faq/" },
  { id: "waiting-list", path: "/waiting-list/" },
  { id: "privacy", path: "/privacy/" },
  { id: "terms", path: "/terms/" },
  { id: "portal-login", path: "/portal/login/" },
];

const CANONICAL_VIEWPORT_IDS = ["desktop", "compact", "boundary", "mobile", "minimum"] as const;

for (const surface of MANDATORY_PUBLIC_SURFACES) {
  for (const viewportId of CANONICAL_VIEWPORT_IDS) {
    test(`viewport snapshot: ${surface.id} @ ${viewportId}`, async ({ browser }) => {
      const vp = VISUAL_VIEWPORTS[viewportId];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      await page.goto(surface.path);
      // Ensure deterministic state: wait for fonts, disable
      // motion, then snapshot. Animations are disabled via
      // the test runner's `reducedMotion: 'reduce'` setting
      // (configured in playwright.config.ts).
      await page.evaluate(() => document.fonts.ready);
      await expect(page, `${surface.id} viewport snapshot @ ${viewportId}`).toHaveScreenshot(
        `public/${surface.id}--${viewportId}.png`,
        {
          fullPage: false,
        },
      );
      await context.close();
    });
  }
}

// Full-page captures are required for the homepage, waitlist,
// how-it-works, membership, and portal-login per the issue.
const FULLPAGE_SURFACES = [
  { id: "home", path: "/" },
  { id: "waiting-list", path: "/waiting-list/" },
  { id: "how-it-works", path: "/how-it-works/" },
  { id: "membership", path: "/membership/" },
  { id: "portal-login", path: "/portal/login/" },
];

for (const surface of FULLPAGE_SURFACES) {
  for (const viewportId of CANONICAL_VIEWPORT_IDS) {
    test(`full-page snapshot: ${surface.id} @ ${viewportId}`, async ({ browser }) => {
      const vp = VISUAL_VIEWPORTS[viewportId];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      await page.goto(surface.path);
      await page.evaluate(() => document.fonts.ready);
      await expect(page, `${surface.id} full-page snapshot @ ${viewportId}`).toHaveScreenshot(
        `public-full/${surface.id}--${viewportId}.png`,
        {
          fullPage: true,
        },
      );
      await context.close();
    });
  }
}

// Homepage reference-conformance contract. The numbers here
// are derived from the reviewed Dispatch Wall reference mock
// and are intentionally broad enough to absorb font-rendering
// noise while narrow enough that a visibly different
// composition fails. The contract is stored in one place so
// the reviewer can read the tolerances inline.
const HOME_REFERENCE = {
  heroHeading: { minTopPct: 5, maxTopPct: 35 },
  dispatchObject: { minRightPct: 50, maxTopPct: 80 },
  primaryAction: { minBottomPct: 60, maxBottomPct: 95 },
};

for (const viewportId of HOMEPAGE_VIEWPORTS) {
  test(`homepage reference-conformance: ${viewportId}`, async ({ browser }) => {
    const vp = VISUAL_VIEWPORTS[viewportId];
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const headingRect = await page.locator("h1#hero-title").first().boundingBox();
    const cardRect = await page.locator(".dispatch-card").first().boundingBox();
    const actionRect = await page.locator(".hero__cta").first().boundingBox();
    expect(headingRect).not.toBeNull();
    expect(cardRect).not.toBeNull();
    expect(actionRect).not.toBeNull();
    if (!headingRect || !cardRect || !actionRect) return;
    const headingTopPct = (headingRect.y / vp.height) * 100;
    const cardRightPct = (cardRect.x + cardRect.width) / vp.width;
    const cardTopPct = cardRect.y / vp.height;
    const actionBottomPct = ((actionRect.y + actionRect.height) / vp.height) * 100;
    expect(headingTopPct).toBeGreaterThan(HOME_REFERENCE.heroHeading.minTopPct);
    expect(headingTopPct).toBeLessThan(HOME_REFERENCE.heroHeading.maxTopPct);
    expect(cardRightPct).toBeGreaterThan(HOME_REFERENCE.dispatchObject.minRightPct);
    expect(cardTopPct).toBeLessThan(HOME_REFERENCE.dispatchObject.maxTopPct);
    expect(actionBottomPct).toBeGreaterThan(HOME_REFERENCE.primaryAction.minBottomPct);
    expect(actionBottomPct).toBeLessThan(HOME_REFERENCE.primaryAction.maxBottomPct);
    await context.close();
  });
}

// Surface a count of mandatory public surface entries so the
// completeness test can be re-anchored if a new mandatory
// surface is added to the manifest.
test("mandatory public surface inventory is non-empty", () => {
  expect(MANDATORY_PUBLIC_SURFACES.length).toBeGreaterThan(5);
  expect(VISUAL_SURFACES.length).toBeGreaterThanOrEqual(20);
});
