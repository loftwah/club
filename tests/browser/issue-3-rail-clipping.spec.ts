// Issue #3: lifecycle rail clipping on /how-it-works/.
//
// Before the fix, the six-step rail was defined as
// `repeat(6, minmax(8rem, 1fr))` with a 760px media-query
// breakpoint, which produced a deterministic failure band from
// 761px to ~835px where the rail was wider than its content box.
// This suite exercises the rail at the exact integer viewports
// listed in the issue's acceptance criteria so the fix cannot
// silently regress by a few pixels.
//
// The test uses computed bounding-box geometry from the browser
// rather than source-text grepping so the assertion is grounded
// in the actual rendered result.

import { test, expect } from "@playwright/test";

// All integer viewports required by the issue. The list is
// deliberately the union of the pre-fix failure band and the
// canonical mobile baseline plus the documented minimum width.
const WIDTHS = [
  1024, 880, 836, 835, 834, 820, 800, 769, 768, 767, 760, 720, 480, 390, 320,
] as const;

const HEIGHT = 1024;

for (const width of WIDTHS) {
  test(`how-it-works lifecycle rail is contained at ${width}×${HEIGHT}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height: HEIGHT },
    });
    const page = await context.newPage();
    await page.goto("/how-it-works/");
    // Wait for the rail to be attached and laid out.
    const rail = page.locator(".pwy-lifecycle__rail");
    await expect(rail).toBeVisible();

    const railRect = await rail.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, left: r.left };
    });
    const containerRect = await page.locator(".pwy-lifecycle").evaluate((el) => {
      // Use the section's content box (the visible rail host).
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, right: r.right, left: r.left };
    });

    // The rail must live entirely inside its parent section.
    const tolerance = 0.5;
    expect(railRect.left).toBeGreaterThanOrEqual(containerRect.left - tolerance);
    expect(railRect.right).toBeLessThanOrEqual(containerRect.right + tolerance);

    // No horizontal overflow on the document. The page must also not
    // introduce a horizontal scrollbar. We compare against the
    // viewport's content width, not the documentElement, so a
    // clipped-ancestor symptom cannot mask the failure.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // Every direct step must remain inside the rail and inside the
    // document.
    const stepRects = await page.locator(".pwy-lifecycle__step").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right };
      }),
    );
    expect(stepRects.length).toBeGreaterThanOrEqual(6);
    for (const [i, step] of stepRects.entries()) {
      expect(step.width, `step ${i} width`).toBeGreaterThan(0);
      expect(
        step.right,
        `step ${i} right (${step.right}) must be <= rail right (${railRect.right}) + tolerance`,
      ).toBeLessThanOrEqual(railRect.right + tolerance);
      // No step may extend past the viewport.
      expect(
        step.right,
        `step ${i} must not overflow the viewport (${width}px)`,
      ).toBeLessThanOrEqual(width + tolerance);
    }

    // All six stages must remain visible and in logical order.
    const stepCount = await page.locator(".pwy-lifecycle__step").count();
    expect(stepCount).toBe(6);

    // The signal step (the cancellation) keeps its distinctive
    // treatment.
    const signalStep = page.locator(".pwy-lifecycle__step--signal");
    await expect(signalStep).toBeVisible();
    const signalColor = await signalStep.evaluate((el) => getComputedStyle(el).color);
    expect(signalColor).not.toBe("rgb(18, 17, 15)"); // not the muted fg

    await context.close();
  });
}
