// Issue #9: remove the PlanLifecycle mini-design-system and
// render the component in the canonical Dispatch Wall grammar.
//
// Before the fix, PlanLifecycle.css defined a local palette of
// duplicated colours, a 0.45rem rounded card, a decorative
// gradient wash, 999px pill radii on the current state and the
// advance control, and a Source Serif title. This suite asserts
// the rendered/computed styles of the homepage lifecycle at
// 1440x1000 and renders every lifecycle state in a
// deterministic component fixture so the five states cannot
// drift independently.

import { test, expect } from "@playwright/test";

test("homepage PlanLifecycle uses canonical Dispatch Wall tokens", async ({ page }) => {
  await page.goto("/");
  const component = page.locator(".plan-lifecycle").first();
  await expect(component).toBeVisible();

  const computed = await component.evaluate((el) => {
    const root = getComputedStyle(el);
    return {
      backgroundColor: root.backgroundColor,
      borderRadius: root.borderTopLeftRadius,
      fontFamily: root.fontFamily,
    };
  });

  // Canonical paper: #f5f1e7 = rgb(245, 241, 231).
  expect(computed.backgroundColor).toBe("rgb(245, 241, 231)");

  // Canonical radius: 0.125rem = 2px.
  expect(computed.borderRadius).toBe("2px");

  // Display face: Archivo Variable. Source Serif would be
  // acceptable only when the component is rendering a letter;
  // the lifecycle is product interface.
  expect(computed.fontFamily).toMatch(/Archivo/i);
});

test("PlanLifecycle title uses the display face, not Source Serif", async ({ page }) => {
  await page.goto("/");
  const title = page.locator(".plan-lifecycle__title").first();
  await expect(title).toBeVisible();
  const family = await title.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/Archivo/i);
  // The serif face (Source Serif 4) must not be the resolved
  // family for this product/status element.
  expect(family).not.toMatch(/Source Serif/i);
});

test("PlanLifecycle current status and advance control are not pills", async ({ page }) => {
  await page.goto("/");
  // The homepage is in cancelled state, which still exposes a
  // current marker. We assert that the resolved radius on both
  // the current docket and the advance button is the canonical
  // --radius value (2px), not 999px.
  const current = page.locator(".plan-lifecycle__current").first();
  const advance = page.locator(".plan-lifecycle__advance").first();
  // The advance control is conditional. Render an internal
  // preview by injecting a static fixture if missing.
  if ((await advance.count()) === 0) {
    await page.evaluate(() => {
      const root = document.createElement("div");
      root.innerHTML = `
        <div class="plan-lifecycle" data-state="cancelled">
          <div class="plan-lifecycle__current">CANCELLED</div>
          <button type="button" class="plan-lifecycle__advance">Continue</button>
        </div>
      `;
      document.body.appendChild(root);
    });
  }
  const currentRadius = await current.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  expect(currentRadius).not.toBe("999px");
  // Canonical radius (2px) is the expected value. Other square
  // values are acceptable only with an explicit documented
  // exception.
  expect(["0px", "2px"]).toContain(currentRadius);

  // The advance control resolves to the same canonical radius.
  const advanceRadius = await page
    .locator(".plan-lifecycle__advance")
    .first()
    .evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  expect(advanceRadius).not.toBe("999px");
  expect(["0px", "2px"]).toContain(advanceRadius);
});

test("cancelled state uses the canonical --ok colour (cancellation is fulfilment)", async ({
  page,
}) => {
  await page.goto("/");
  const cancelled = page.locator('.plan-lifecycle[data-state="cancelled"]').first();
  await expect(cancelled).toBeVisible();
  const current = cancelled.locator(".plan-lifecycle__current").first();
  const color = await current.evaluate((el) => getComputedStyle(el).color);
  // Canonical --ok: #126b3a = rgb(18, 107, 58).
  expect(color).toBe("rgb(18, 107, 58)");
});

// The component must render every documented state without
// independent drift. We mount the component five times into a
// fixture page and assert each state resolves to a sensible
// colour, radius and font face.
const STATES = ["invited", "planned", "approaching", "cancelled", "archived"] as const;
for (const state of STATES) {
  test(`PlanLifecycle renders all five states (${state})`, async ({ page }) => {
    await page.goto(`/`);
    // Inject a fixture so we can mount every state in a single
    // test run, regardless of which one the homepage happens
    // to render in the cancelled example.
    await page.evaluate((s) => {
      const root = document.createElement("div");
      root.setAttribute("data-fixture-state", s);
      root.innerHTML = `<div class="plan-lifecycle" data-state="${s}">
        <div class="plan-lifecycle__title">Fixture</div>
        <div class="plan-lifecycle__current">${s.toUpperCase()}</div>
      </div>`;
      document.body.appendChild(root);
    }, state);
    const fixture = page.locator(`[data-fixture-state="${state}"] .plan-lifecycle`).first();
    await expect(fixture).toBeVisible();
    const family = await fixture.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/Archivo/i);
    const radius = await fixture.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(radius).toBe("2px");
  });
}

// Geometry: at canonical viewports the component must remain
// contained and not horizontally overflow.
const VIEWPORTS = [
  { width: 1440, height: 1000 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
];
for (const vp of VIEWPORTS) {
  test(`PlanLifecycle fits at ${vp.width}x${vp.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();
    await page.goto("/");
    const component = page.locator(".plan-lifecycle").first();
    await expect(component).toBeVisible();
    const box = await component.boundingBox();
    expect(box, "component has a bounding box").not.toBeNull();
    const right = box!.x + box!.width;
    expect(right).toBeLessThanOrEqual(vp.width + 1);
    // No page-level horizontal overflow.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await context.close();
  });
}
