import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/how-it-works/", "/membership/", "/waiting-list/"] as const;

test.describe("targeted WebKit production-shape evidence", () => {
  for (const route of publicRoutes) {
    test(`${route} renders at mobile width without horizontal overflow`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();

      const overflow = await page.evaluate(() =>
        Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test("core promise and waitlist path survive reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Plans were made");
    await expect(page.getByRole("link", { name: /waitlist/i }).first()).toBeVisible();

    await page.goto("/waiting-list/");
    await expect(page.getByRole("button", { name: /list/i })).toBeVisible();
  });
});
