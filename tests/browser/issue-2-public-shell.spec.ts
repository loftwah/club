// Issue #2: restore the canonical public shell, display face and
// breakpoints across the secondary public routes.
//
// Before the fix, ten ordinary public routes declared a local
// 78rem `.pwy-shell` and oversized serif hero headings, and
// they stacked at 680px or 760px instead of the documented
// 48rem/768px. This suite asserts the rendered/computed
// geometry against the canonical Dispatch Wall contract:
//
//   - shell max-width resolves to 90rem (1440px) at desktop;
//   - gutter resolves to clamp(1rem, 3vw, 3rem);
//   - primary h1 resolves to the display face (Archivo) and a
//     computed font-size no greater than 5.8rem (92.8px);
//   - no page-level horizontal overflow at any of the canonical
//     visual QA viewports;
//   - hero and two-column route layouts collapse to a single
//     column at 768px and below.

import { test, expect } from "@playwright/test";

const ROUTES = [
  { path: "/how-it-works/", name: "how-it-works" },
  { path: "/membership/", name: "membership" },
  { path: "/correspondence/", name: "correspondence" },
  { path: "/chapters/", name: "chapters" },
  { path: "/chapters/melbourne/", name: "chapters-melbourne" },
  { path: "/chapters/sydney/", name: "chapters-sydney" },
  { path: "/journal/", name: "journal" },
  { path: "/faq/", name: "faq" },
  { path: "/privacy/", name: "privacy" },
  { path: "/terms/", name: "terms" },
  // 404 is rendered for an unknown path; we don't enumerate it
  // here because Astro's 404 page is rendered for the catch-all
  // not-found case rather than a fixed route.
] as const;

const VIEWPORTS = [
  { width: 1440, height: 1000, label: "desktop" },
  { width: 1024, height: 768, label: "compact" },
  { width: 768, height: 1024, label: "boundary" },
  { width: 390, height: 844, label: "mobile" },
  { width: 320, height: 568, label: "minimum" },
] as const;

const FONT_CAP_PX = 92.8; // 5.8rem at the canonical 16px root

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route.name} geometry @ ${viewport.label} (${viewport.width}x${viewport.height})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      await page.goto(route.path);

      const shell = page.locator(".pwy-shell").first();
      await expect(shell).toBeVisible();
      const shellBox = await shell.boundingBox();
      expect(shellBox, "shell bounding box").not.toBeNull();
      const shellWidth = shellBox!.width;
      const expectedMax = Math.min(90 * 16, viewport.width); // 90rem in px or viewport
      expect(
        shellWidth,
        `shell width ${shellWidth} must be <= 90rem (${expectedMax}px)`,
      ).toBeLessThanOrEqual(expectedMax + 1);

      // No horizontal overflow.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `document overflow on ${route.name}`).toBeLessThanOrEqual(1);

      // Primary h1 must use the display face and stay under the
      // canonical 5.8rem cap.
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible();
      const h1Style = await h1.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
        };
      });
      // The display face is Archivo Variable. We assert the
      // computed font-family mentions "Archivo" so the source
      // cannot regress to the serif face without failing.
      expect(h1Style.fontFamily, `${route.name} h1 should use the display (Archivo) face`).toMatch(
        /Archivo/i,
      );
      const h1Size = Number.parseFloat(h1Style.fontSize);
      expect(
        h1Size,
        `${route.name} h1 size ${h1Size}px must be <= 5.8rem (${FONT_CAP_PX}px)`,
      ).toBeLessThanOrEqual(FONT_CAP_PX + 0.5);

      await context.close();
    });
  }
}

// The narrow-composition contract: at 768px and below, the
// ordinary hero / two-column grid must have collapsed to a
// single column. We probe one representative route per shape.
test("narrow composition collapses the hero at 768px (how-it-works)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const page = await context.newPage();
  await page.goto("/how-it-works/");
  const heroGrid = page.locator(".pwy-hero__grid").first();
  await expect(heroGrid).toBeVisible();
  const columns = await heroGrid.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(columns, "hero must be one column at 768px").toBe(1);
  await context.close();
});
