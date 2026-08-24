// Browser E2E tests. Run with the wrangler dev server already up
// (see scripts/acceptance.mjs). The dev server listens on
// PLAYWRIGHT_BASE_URL (default http://127.0.0.1:8788).
//
// These cover:
//   - homepage renders with the canonical proposition
//   - waiting-list page renders and submits
//   - public routes return 200
//   - unknown routes return 404
//   - mobile viewport
//   - reduced motion
//   - axe accessibility
//   - ThreeUI fallback path (no WebGL canvas should not break page)

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("public routes (semantic HTML, no essential JS)", () => {
  test("GET / renders the homepage", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    // The canonical proposition appears in the raw HTML.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /Plans were made|unmade|invited/i,
    );
    // The value proposition paragraph exists in the DOM.
    await expect(page.getByText(/You were on the list/i)).toBeVisible();
    // Tier preview is rendered, including the AUD/month qualifier.
    const prices = page.locator(".tier__price");
    await expect(prices).toHaveCount(3);
    await expect(prices.nth(0)).toContainText(/A\$5\s*AUD \/ month/);
    await expect(prices.nth(1)).toContainText(/A\$20\s*AUD \/ month/);
    await expect(prices.nth(2)).toContainText(/A\$50\s*AUD \/ month/);
    // SEO meta.
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toMatch(/^https:\/\/club\.loftwah\.com/);
    const desc = await page.locator('meta[name="description"]').getAttribute("content");
    expect(desc?.length ?? 0).toBeGreaterThan(20);
    // Skip link for keyboard users.
    await expect(page.locator(".skip-link")).toBeAttached();
    // Main landmark.
    await expect(page.locator('main[id="main"]')).toBeVisible();
  });

  test("GET /waiting-list renders the form", async ({ page }) => {
    const response = await page.goto("/waiting-list/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("form#wl-form")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    // The submit button must NOT mention payment, charge, or subscribe
    // (the waitlist is free).
    const submit = page.locator("#wl-submit");
    await expect(submit).not.toContainText(/pay|charge|subscribe|checkout/i);
  });

  test("GET /membership renders the tier preview", async ({ page }) => {
    const response = await page.goto("/membership/");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Member", level: 3, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Corresponding Member", level: 3, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Deluxe Member", level: 3, exact: true }),
    ).toBeVisible();
  });

  test("GET /membership tier CTAs route into the waitlist with the right tier", async ({
    page,
  }) => {
    await page.goto("/membership/");
    const member = page.getByTestId("tier-cta-member");
    const corresponding = page.getByTestId("tier-cta-corresponding");
    const deluxe = page.getByTestId("tier-cta-deluxe");
    await expect(member).toHaveAttribute("href", "/waiting-list/?tier=member");
    await expect(corresponding).toHaveAttribute("href", "/waiting-list/?tier=corresponding");
    await expect(deluxe).toHaveAttribute("href", "/waiting-list/?tier=deluxe");
  });

  test("GET /waiting-list/?tier=corresponding acknowledges the tier interest", async ({ page }) => {
    await page.goto("/waiting-list/?tier=corresponding");
    await expect(page.getByText(/Corresponding Member/).first()).toBeVisible();
    // The hidden field should be populated so the submission carries
    // the chosen tier.
    const tierField = page.locator("#interested-tier");
    await expect(tierField).toHaveValue("Corresponding Member");
  });

  test("GET /how-it-works renders the canonical arc", async ({ page }) => {
    const response = await page.goto("/how-it-works/");
    expect(response?.status()).toBe(200);
    await expect(page.getByText(/I was on the list|Plans were made/)).toBeVisible();
    await expect(page.getByText(/cancel(s|ed)? it/)).toBeVisible();
  });

  test("GET /chapters renders the chapter list", async ({ page }) => {
    const response = await page.goto("/chapters/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("link", { name: "Melbourne", exact: true })).toBeVisible();
  });

  test("GET /unknown returns 404", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist/");
    expect(response?.status()).toBe(404);
  });
});

test.describe("waiting-list form submission", () => {
  test("valid email submits and shows a success message", async ({ page }) => {
    await page.goto("/waiting-list/");
    const unique = `e2e_${Date.now()}@example.com`;
    await page.locator('input[type="email"]').fill(unique);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/You are on the list/)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("invalid email is rejected by the form", async ({ page }) => {
    await page.goto("/waiting-list/");
    // The form uses HTML5 validation on type=email, which prevents
    // submission for non-email values. The browser will show its own
    // validation message. We just confirm the form does not advance
    // to a success state.
    await page.locator('input[type="email"]').fill("not-an-email");
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/You are on the list/)).not.toBeVisible();
  });
});

test.describe("mobile viewport", () => {
  test("the homepage is usable on a phone-sized viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    // Headings, nav, and CTAs are reachable.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".site-header")).toBeVisible();
    await expect(page.locator(".hero__cta").first()).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test("prefers-reduced-motion: reduce still surfaces all essential content", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    // All canonical proposition text is present even when animations
    // are suppressed.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/made|unmade/);
    await expect(page.getByText(/You were on the list/i)).toBeVisible();
    // The ThreeUI canvas (or its fallback) is in the DOM but does not
    // hide the form links.
    await expect(page.locator(".hero__cta").first()).toBeVisible();
    // Waiting-list form is usable.
    await page.goto("/waiting-list/");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    // The CSS rule is shipped; the test verifies that with
    // prefers-reduced-motion, no required content is hidden.
    // We assert that the transition duration collapses to the
    // near-zero value our reduced-motion rule sets (0.001ms) rather
    // than the default 120ms.
    const computedTransition = await page
      .locator(".site-header")
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    const transitionMs = parseFloat(computedTransition) * 1000;
    expect(transitionMs).toBeLessThan(2);
    await context.close();
  });
});

test.describe("accessibility (axe)", () => {
  test("homepage has no serious axe violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious,
      `serious/critical violations: ${JSON.stringify(serious, null, 2)}`,
    ).toHaveLength(0);
  });

  test("waiting-list page has no serious axe violations", async ({ page }) => {
    await page.goto("/waiting-list/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toHaveLength(0);
  });

  test("membership page has no serious axe violations", async ({ page }) => {
    await page.goto("/membership/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toHaveLength(0);
  });

  test("how-it-works page has no serious axe violations", async ({ page }) => {
    await page.goto("/how-it-works/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toHaveLength(0);
  });
});

test.describe("ThreeUI fallback path", () => {
  test("the home page does not require JavaScript for essential content", async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    // The entire canonical proposition is in the raw HTML, not
    // generated by client-side JS.
    const html = await page.content();
    expect(html).toContain("Plans are made");
    expect(html).toContain("A$5");
    expect(html).toContain("A$20");
    expect(html).toContain("A$50");
    // The static wordmark remains visible without JavaScript.
    await expect(page.getByRole("link", { name: "Plans With You — home" })).toBeVisible();
    await context.close();
  });
});
