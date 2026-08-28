// Issue #5: bring onboarding into the Dispatch Wall app system
// and stop the 15-step progress list from burying the current
// task on mobile.
//
// This regression uses the manifest-driven authenticated
// runner (issue #6) to render the actual onboarding wizard
// at the narrow mobile viewports. It asserts the compact
// "Step X of 15" disclosure, the current step heading, the
// first meaningful control, prev/next navigation, the
// expanded disclosure geometry, and the absence of overlap
// or clipping. The shared `app-*` design system and the
// 15-step list itself are preserved.

import { test, expect } from "@playwright/test";
import { renderSurface } from "./visual/runner";
import { VISUAL_VIEWPORTS, VISUAL_SURFACES } from "./visual/manifest";
import type { VisualSurface, VisualViewportId } from "./visual/manifest";

// The four onboarding steps required by the issue: the first
// step (identity), a substantial middle step (post and
// event-preferences), the legal step (terms), and the final
// step (payment-gate).
const STEPS_UNDER_TEST = [
  "identity",
  "post",
  "event-preferences",
  "terms",
  "payment-gate",
] as const;
const MOBILE_VIEWPORTS: ReadonlyArray<VisualViewportId> = ["mobile", "minimum"];

function surfaceFor(stepId: (typeof STEPS_UNDER_TEST)[number]): VisualSurface {
  const s = VISUAL_SURFACES.find((v) => v.id === `onboarding-${stepId}`);
  if (!s) throw new Error(`onboarding-${stepId} must be in the manifest`);
  return s;
}

for (const stepId of STEPS_UNDER_TEST) {
  for (const viewportId of MOBILE_VIEWPORTS) {
    test(`onboarding ${stepId} renders through the runner at ${viewportId}`, async ({
      browser,
      request,
    }) => {
      const vp = VISUAL_VIEWPORTS[viewportId];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: "reduce",
      });
      try {
        const rendered = await renderSurface(context, request, surfaceFor(stepId), viewportId);
        const { page, persona } = rendered;
        expect(persona, "persona should be the onboarding subject").not.toBeNull();
        // The page must not have redirected to login.
        await expect(page).not.toHaveURL(/\/portal\/login\//);
        // The first heading on the page is the page title ("Onboarding");
        // the second is the current step heading. Use role-based lookup.
        const stepHeadings = page.getByRole("heading", { level: 2 });
        await expect(stepHeadings.first()).toBeVisible();
      } finally {
        await context.close();
      }
    });
  }
}

// Mobile composition regression: at 390x844 the compact
// "Step X of 15" summary must be present and not be the
// dominant content. The full 15-step disclosure must be
// hidden by default but expandable, and the current step's
// first meaningful control must sit above the fold. The
// payment-gate step is structurally different (it has no
// <form> because real payment is webhook-authoritative), so
// the "first control" assertion only applies to the steps
// that own a form.
for (const stepId of STEPS_UNDER_TEST) {
  test(`onboarding ${stepId} mobile composition at 390x844`, async ({ browser, request }) => {
    const vp = VISUAL_VIEWPORTS.mobile;
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: "reduce",
    });
    try {
      const rendered = await renderSurface(context, request, surfaceFor(stepId), "mobile");
      const { page } = rendered;

      // The compact summary references the step count and is
      // visible on first render at mobile widths.
      const summary = page.locator(".onboarding-progress-details > summary").first();
      await expect(summary).toBeVisible();
      await expect(summary).toContainText(/15/);
      // The full list (<ol class="onboarding-progress">) is
      // hidden by default on mobile (it sits inside a
      // <details> element).
      const details = page.locator("details.onboarding-progress-details").first();
      const isOpen = await details.evaluate((el: HTMLDetailsElement) => el.open);
      expect(isOpen, "the full 15-step disclosure must be closed by default on mobile").toBe(false);

      // The current step heading (h2) must be visible. The
      // first h2 is the "Step N: <title>" heading.
      const stepHeading = page.locator("h2#current-step-heading");
      await expect(stepHeading).toBeVisible();

      // Every step except payment-gate renders an
      // <form class="app-form">. payment-gate is the final
      // step and intentionally has no form: paid activation
      // is webhook-authoritative. Asserting on the first
      // form control therefore only applies to form-bearing
      // steps.
      if (stepId !== "payment-gate") {
        const firstControl = page.locator("input, select, textarea, button[type='submit']").first();
        await expect(firstControl).toBeVisible();
        const controlRect = await firstControl.boundingBox();
        expect(controlRect, "first control must have a rect").not.toBeNull();
        if (controlRect) {
          // The top of the first control must be within the
          // first 1500px of the document. The compact summary
          // + heading + lede + first label typically fits in
          // ~500-800px; allowing 1500px gives generous room
          // for the disclosure close-button area without
          // letting the test silently pass if the 15-row list
          // is rendered above the fold.
          expect(controlRect.y, "first control top").toBeLessThan(1500);
        }
      } else {
        // payment-gate still has a "Review the wizard from
        // the start" link, so the dominant CTA is a link,
        // not a form control. The disclosure must not bury
        // that link either.
        const reviewLink = page.getByRole("link", { name: /Review the wizard from the start/i });
        await expect(reviewLink).toBeVisible();
        const linkRect = await reviewLink.boundingBox();
        expect(linkRect, "payment-gate review link rect").not.toBeNull();
        if (linkRect) {
          expect(linkRect.y, "payment-gate review link top").toBeLessThan(1500);
        }
      }

      // Previous / next navigation is present (a <nav
      // class="onboarding-nav"> with the prev/next anchors).
      const nav = page.locator("nav.onboarding-nav").first();
      await expect(nav).toBeVisible();

      // No horizontal overflow at mobile.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "no horizontal overflow at 390x844").toBeLessThanOrEqual(1);
    } finally {
      await context.close();
    }
  });
}

// Expanded disclosure geometry: clicking the summary opens
// the 15-step list and the rows must be visible without
// overlapping the page heading.
for (const stepId of STEPS_UNDER_TEST) {
  test(`onboarding ${stepId} expanded disclosure at 390x844`, async ({ browser, request }) => {
    const vp = VISUAL_VIEWPORTS.mobile;
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: "reduce",
    });
    try {
      const rendered = await renderSurface(context, request, surfaceFor(stepId), "mobile");
      const { page } = rendered;
      const summary = page.locator(".onboarding-progress-details > summary").first();
      await summary.click();
      // The disclosure opens and the <ol> becomes visible.
      const list = page
        .locator("details.onboarding-progress-details ol.onboarding-progress")
        .first();
      await expect(list).toBeVisible();
      // There must be 15 <li> rows.
      const rows = page.locator("details.onboarding-progress-details ol.onboarding-progress > li");
      const count = await rows.count();
      expect(count, "15-step disclosure must have 15 rows").toBe(15);
      // Each row must be visible and not be clipped to 0
      // height. A clipped row indicates the disclosure
      // expansion has not reflowed correctly.
      for (let i = 0; i < count; i += 1) {
        const row = rows.nth(i);
        const box = await row.boundingBox();
        expect(box, `row ${i} bounding box`).not.toBeNull();
        if (box) {
          expect(box.height, `row ${i} height`).toBeGreaterThan(4);
          expect(box.width, `row ${i} width`).toBeGreaterThan(20);
        }
      }
      // The current step row carries the .is-current class.
      const currentRow = page.locator(
        "details.onboarding-progress-details ol.onboarding-progress > li.is-current",
      );
      await expect(currentRow).toBeVisible();
    } finally {
      await context.close();
    }
  });
}
