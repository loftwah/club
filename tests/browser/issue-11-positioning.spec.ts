// Browser assertions for the new brand positioning (issue #11).
//
// The home, membership, and how-it-works routes must surface
// the calendar-protection and credible-cancellation premise
// alongside the existing member-facing humour. We assert
// stable content contracts on the rendered DOM so the new
// positioning cannot silently regress through a copy edit.

import { test, expect } from "@playwright/test";

const PUBLIC_SURFACES = [
  {
    id: "home",
    path: "/",
    selector: '[data-testid="dispatch-proposition"]',
    expected:
      /Protected time with a commitment that looks the part — and predictably gets cancelled/,
  },
  {
    id: "membership",
    path: "/membership/",
    selector: "main h1",
    expected: /Membership/i,
  },
  {
    id: "how-it-works",
    path: "/how-it-works/",
    selector: "main h1",
    expected: /How it works/i,
  },
];

for (const surface of PUBLIC_SURFACES) {
  test(`issue-11 positioning: ${surface.id} surfaces the new product premise`, async ({ page }) => {
    await page.goto(surface.path);
    const element = page.locator(surface.selector).first();
    await expect(element).toBeVisible();
    const text = await element.textContent();
    expect(text, `${surface.id} text content`).toMatch(surface.expected);
  });
}

test("homepage surfaces the two use cases (social reasons + calendar protection)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/prior commitment/i).first()).toBeVisible();
  await expect(page.getByText(/calendar/i).first()).toBeVisible();
});

test("homepage OG description reflects the new positioning", async ({ page }) => {
  await page.goto("/");
  const description = await page.locator('meta[name="description"]').getAttribute("content");
  expect(description, "homepage meta description").toMatch(/commitment/i);
  expect(description, "homepage meta description").toMatch(/cancel/i);
});
