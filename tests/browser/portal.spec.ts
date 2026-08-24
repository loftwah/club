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
  test("GET /onboarding/identity/ requires member authentication", async ({ page }) => {
    const response = await page.goto("/onboarding/identity/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/portal\/login\/?\?next=%2Fonboarding%2Fidentity%2F?$/);
  });

  test("GET /onboarding/payment-gate/ requires member authentication", async ({ page }) => {
    const response = await page.goto("/onboarding/payment-gate/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/portal\/login\/?\?next=%2Fonboarding%2Fpayment-gate%2F?$/);
  });

  test("POST /api/onboarding/identity rejects unauthenticated writes", async ({ request }) => {
    const response = await request.post("/api/onboarding/identity", {
      form: { preferredName: "Attacker" },
    });
    // Astro's built-in cross-site form protection may reject first; the
    // application boundary returns 401 for same-origin unauthenticated POSTs.
    expect([401, 403]).toContain(response.status());
  });
});

test.describe("admin", () => {
  for (const path of [
    "/admin/",
    "/admin/tasks/",
    "/admin/inbound/",
    "/admin/events/",
    "/admin/members/",
    "/admin/appearance/",
    "/admin/operations/",
    "/admin/creative/",
  ]) {
    test(`GET ${path} requires operator authentication`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(
        new RegExp(`/portal/login/\\?next=${path.replaceAll("/", "%2F")}$`),
      );
    });
  }

  for (const path of ["/%61dmin/", "/%61dmin/members/", "/%2561dmin/events/"]) {
    test(`GET ${path} cannot bypass operator authentication`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(302);
      expect(response.headers().location).toContain("/portal/login/?next=%2Fadmin");
    });
  }

  test("encoded internal route cannot bypass operator authentication", async ({ request }) => {
    const response = await request.get("/%69nternal/threeui-bakeoff/", { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers().location).toContain("/portal/login/?next=%2Finternal");
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
    expect(body).toContain("Disallow: /onboarding/");
  });

  test("public responses carry baseline browser security headers", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers()["permissions-policy"]).toContain("camera=()");
    expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
  });

  test("GET /sitemap.xml is served", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("<urlset");
  });
});
