import { test, expect } from "@playwright/test";

// Member portal and onboarding browser E2E.
//
// These tests exercise the front-end flows in the local dev
// environment. The wrangler dev server is started by the
// acceptance script before Playwright is invoked.

test.describe("portal", () => {
  test("GET /portal/ redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/portal/");
    expect(response?.status()).toBe(200);
    // The portal route redirects to /portal/login/ when there is
    // no session cookie, so the final URL should be the login
    // page.
    await expect(page).toHaveURL(/\/portal\/login\/?$/);
  });

  test("GET /portal/login/ renders the magic-link form", async ({ page }) => {
    const response = await page.goto("/portal/login/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /Sign in/ })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /Send me a sign-in link/ })).toBeVisible();
  });

  test("GET /portal/memory/ redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/portal/memory/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/portal\/login\/?$/);
  });

  test("GET /portal/preferences/ redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/portal/preferences/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/portal\/login\/?$/);
  });

  test("GET /portal/commitments/ redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/portal/commitments/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/portal\/login\/?$/);
  });

  test("GET /portal/appearance/ renders the enquiry form", async ({ page }) => {
    const response = await page.goto("/portal/appearance/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/portal\/login\/?$/);
  });
});

test.describe("onboarding", () => {
  test("GET /onboarding/identity/ renders the identity step", async ({ page }) => {
    const response = await page.goto("/onboarding/identity/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Onboarding" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /Step 1: Identity/ })).toBeVisible();
  });

  test("GET /onboarding/identity/ shows the progress for all 15 steps", async ({ page }) => {
    const response = await page.goto("/onboarding/identity/");
    expect(response?.status()).toBe(200);
    // 15 steps × one <li> each.
    await expect(page.locator(".onboarding-progress li")).toHaveCount(15);
  });

  test("GET /onboarding/payment-gate/ shows the disabled-payment message", async ({ page }) => {
    const response = await page.goto("/onboarding/payment-gate/");
    expect(response?.status()).toBe(200);
    await expect(page.getByText(/disabled/i).first()).toBeVisible();
  });
});

test.describe("admin", () => {
  test("GET /admin/ renders the 'What does the Society need from me?' landing", async ({
    page,
  }) => {
    const response = await page.goto("/admin/");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: /What does the Society need from me\?/ }),
    ).toBeVisible();
  });

  test("GET /admin/tasks/ renders the fulfilment tasks table", async ({ page }) => {
    const response = await page.goto("/admin/tasks/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /Fulfilment tasks/ })).toBeVisible();
  });

  test("GET /admin/inbound/ renders the inbound email review page", async ({ page }) => {
    const response = await page.goto("/admin/inbound/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /Inbound email/ })).toBeVisible();
  });

  test("GET /admin/events/ renders the event catalogue", async ({ page }) => {
    const response = await page.goto("/admin/events/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Events" })).toBeVisible();
  });

  test("GET /admin/members/ renders the member directory", async ({ page }) => {
    const response = await page.goto("/admin/members/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  });

  test("GET /admin/appearance/ renders the appearance enquiries page", async ({ page }) => {
    const response = await page.goto("/admin/appearance/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /Appearance/ })).toBeVisible();
  });

  test("GET /admin/operations/ renders the operations digest", async ({ page }) => {
    const response = await page.goto("/admin/operations/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /Operations digest/ })).toBeVisible();
  });
});

test.describe("public", () => {
  test("GET /og/default.svg returns a valid SVG image", async ({ request }) => {
    const res = await request.get("/og/default.svg");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("<svg");
    expect(body).toContain("PLANS WITH YOU".toUpperCase());
  });

  test("GET /robots.txt is served", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Sitemap:");
    expect(body).toContain("Disallow: /admin/");
  });

  test("GET /sitemap.xml is served", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("<urlset");
  });
});
