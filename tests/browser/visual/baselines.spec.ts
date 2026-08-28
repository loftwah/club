// Issue #8: reviewed Playwright visual baselines.
//
// This file is the canonical visual regression suite. The
// mandatory surfaces (per the issue) have a reviewed baseline
// for both the first-viewport and full-page captures at the
// canonical 1440x1000, 1024x768, 768x1024, 390x844, 320x568
// sizes. The first-run baseline generation is opt-in via
// `pnpm test:visual:update`; normal `pnpm acceptance` does
// not run this file (see playwright.config.ts: the `visual`
// project is opt-in, and the default test project ignores
// this file). The first run with empty baselines will fail
// for any surface without a committed review; that is
// expected and surfaces as a "review snapshot" gate, not a
// regression.
//
// Surface coverage is manifest-driven (issue #6): the
// canonical matrix iterates every entry in `VISUAL_SURFACES`
// whose `snapshot: true` flag is set, plus the explicit
// full-page and FAQ-open variants below. Adding a new
// mandatory surface is a one-line manifest edit; the runner
// picks it up automatically.
//
// The visual suite is intentionally additive: a failure on
// a surface that has snapshot coverage in the manifest
// means the snapshot must be reviewed against the Dispatch
// Wall reference, not silently regenerated. The test cases
// themselves are committed so CI can prove the matrix
// covers the issue's required surfaces; the actual baseline
// PNGs are produced on the first opt-in `pnpm
// test:visual:update` run and committed separately.

import { test, expect } from "@playwright/test";
import {
  VISUAL_SURFACES,
  VISUAL_VIEWPORTS,
  type VisualSurface,
  type VisualViewportId,
} from "./manifest";
import { renderSurface } from "./runner";

// Surfaces that require a full-page capture (per the issue).
// The full-page set is intentionally narrow: most surfaces
// fit the first-viewport capture and adding a full-page
// snapshot is only worth it where the issue requires it.
const FULLPAGE_SURFACES: ReadonlyArray<string> = [
  "home",
  "waiting-list",
  "how-it-works",
  "membership",
  "portal-login",
  "chapters",
];

const CANONICAL_VIEWPORT_IDS: ReadonlyArray<VisualViewportId> = [
  "desktop",
  "compact",
  "boundary",
  "mobile",
  "minimum",
];

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

const HOMEPAGE_VIEWPORTS = ["desktop", "mobile"] as const;

function publicSnapshotSurfaces(): ReadonlyArray<VisualSurface> {
  return VISUAL_SURFACES.filter((s) => s.auth === "public" && s.snapshot);
}

function privateSnapshotSurfaces(): ReadonlyArray<VisualSurface> {
  return VISUAL_SURFACES.filter((s) => s.auth !== "public" && s.snapshot);
}

// First-viewport snapshot for every mandatory public surface.
for (const surface of publicSnapshotSurfaces()) {
  for (const viewportId of CANONICAL_VIEWPORT_IDS) {
    test(`viewport snapshot: ${surface.id} @ ${viewportId}`, async ({ browser }) => {
      const vp = VISUAL_VIEWPORTS[viewportId];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      try {
        const page = await context.newPage();
        await page.goto(surface.path);
        await page.evaluate(() => document.fonts.ready);
        await expect(page, `${surface.id} viewport snapshot @ ${viewportId}`).toHaveScreenshot(
          `public/${surface.id}--${viewportId}.png`,
          { fullPage: false },
        );
      } finally {
        await context.close();
      }
    });
  }
}

// First-viewport snapshot for every required private surface
// (member, onboarding, operator). Rendered through the
// manifest-driven runner so the authentication state is real
// and the ready signal is proven before the snapshot is
// taken. The visual suite remains opt-in: the `visual`
// project is excluded from the default acceptance path in
// playwright.config.ts.
for (const surface of privateSnapshotSurfaces()) {
  for (const viewportId of surface.viewports) {
    test(`viewport snapshot: ${surface.id} @ ${viewportId}`, async ({ browser, request }) => {
      const vp = VISUAL_VIEWPORTS[viewportId];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      try {
        const rendered = await renderSurface(context, request, surface, viewportId);
        const { page } = rendered;
        await page.evaluate(() => document.fonts.ready);
        await expect(page, `${surface.id} viewport snapshot @ ${viewportId}`).toHaveScreenshot(
          `${surface.auth}/${surface.id}--${viewportId}.png`,
          { fullPage: false },
        );
      } finally {
        await context.close();
      }
    });
  }
}

// Full-page captures for the required surfaces.
for (const surfaceId of FULLPAGE_SURFACES) {
  const surface = VISUAL_SURFACES.find((s) => s.id === surfaceId);
  if (!surface) {
    throw new Error(
      `Full-page surface ${surfaceId} is not in the visual manifest. Update the manifest or remove the entry.`,
    );
  }
  for (const viewportId of CANONICAL_VIEWPORT_IDS) {
    test(`full-page snapshot: ${surface.id} @ ${viewportId}`, async ({ browser }) => {
      const vp = VISUAL_VIEWPORTS[viewportId];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      try {
        const page = await context.newPage();
        await page.goto(surface.path);
        await page.evaluate(() => document.fonts.ready);
        await expect(page, `${surface.id} full-page snapshot @ ${viewportId}`).toHaveScreenshot(
          `public-full/${surface.id}--${viewportId}.png`,
          { fullPage: true },
        );
      } finally {
        await context.close();
      }
    });
  }
}

// Homepage reference-conformance contract.
for (const viewportId of HOMEPAGE_VIEWPORTS) {
  test(`homepage reference-conformance: ${viewportId}`, async ({ browser }) => {
    const vp = VISUAL_VIEWPORTS[viewportId];
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: "reduce",
    });
    try {
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
    } finally {
      await context.close();
    }
  });
}

// The mandatory matrix must include the surfaces the issue
// requires. This is a coverage gate; if a required surface
// is dropped from the manifest, this test fails. The set is
// intentionally the union of: every canonical chapter
// variant, FAQ open/closed, waitlist chapter and tier
// variants, the 404 surface, all required member surfaces,
// the four required onboarding steps, and every required
// operator surface. If a surface does not yet have a
// committed baseline, the snapshot test will fail on first
// run; that is the expected review gate.
test("visual matrix covers the mandatory issue #8 surface set", () => {
  const surfaceIds = new Set(VISUAL_SURFACES.map((s) => s.id));
  const required: ReadonlyArray<string> = [
    // Public surfaces
    "home",
    "how-it-works",
    "membership",
    "correspondence",
    "chapters",
    "journal",
    "faq",
    "faq-answer-open",
    "waiting-list",
    "waiting-list-chapter",
    "waiting-list-tier-and-chapter",
    "privacy",
    "terms",
    "not-found",
    "portal-login",
    // Every canonical chapter variant
    "chapters-melbourne",
    "chapters-sydney",
    "chapters-brisbane",
    "chapters-adelaide",
    "chapters-perth",
    "chapters-auckland",
    // Member surfaces
    "portal-home",
    "portal-preferences",
    "portal-memory",
    "portal-commitments",
    "portal-appearance",
    "portal-account-delete",
    "portal-club-meetings",
    // Onboarding (identity + representative middle form + terms + payment-gate)
    "onboarding-identity",
    "onboarding-post",
    "onboarding-event-preferences",
    "onboarding-terms",
    "onboarding-payment-gate",
    // Operator surfaces
    "admin-home",
    "admin-operations",
    "admin-tasks",
    "admin-inbound",
    "admin-events",
    "admin-members",
    "admin-appearance",
    "admin-creative",
  ];
  const missing = required.filter((id) => !surfaceIds.has(id));
  expect(
    missing,
    `Required surfaces missing from visual manifest: ${JSON.stringify(missing, null, 2)}`,
  ).toEqual([]);
});
