// Issue #7 self-tests: synthetic fixtures that prove the geometry
// detector catches the failure modes it is meant to catch and
// does not flag a valid layout. Each test injects DOM directly
// into the rendered document and then exercises the
// `collectGeometry` helper through a Playwright Page that
// navigates to a blank but JS-rich surface.

import { test, expect } from "@playwright/test";
import { collectGeometry } from "./geometry";

async function injectDOM(page: import("@playwright/test").Page, html: string) {
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8" /><style>body{margin:0;padding:0;font-family:system-ui;}</style></head><body>${html}</body></html>`,
    { waitUntil: "load" },
  );
}

test("detector flags a child wider than a clipped parent", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await injectDOM(
    page,
    `<div class="clip" style="width:200px;height:200px;overflow:hidden;background:lightgray;">
       <div class="wide" style="width:400px;height:50px;background:tomato;">Wide child</div>
     </div>`,
  );
  const report = await collectGeometry(page, { surfaceId: "synth-clip", path: "/synth" });
  // The clipped parent (overflow: hidden) prevents the wide
  // child from contributing to document horizontal scroll,
  // so we expect the ancestor-clipping invariant to fire.
  const clipping = report.violations.find(
    (v) => v.kind === "ancestor-clipping" || v.kind === "page-horizontal-overflow",
  );
  expect(clipping, "clipping or page-overflow violation on the wide-child case").toBeDefined();
});

test("detector flags a zero-area interactive control", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await injectDOM(
    page,
    `<div style="width:100px;height:100px;">
       <button style="width:1px;height:0;background:transparent;display:inline-block;padding:0;border:0;">Invisible</button>
       <input type="text" style="width:200px;height:2rem;" />
     </div>`,
  );
  const report = await collectGeometry(page, { surfaceId: "synth-zero", path: "/synth" });
  const impossible = report.violations.find((v) => v.kind === "impossible-control");
  expect(impossible, "impossible-control on a zero-area button").toBeDefined();
});

test("detector flags a clipped text element", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await injectDOM(
    page,
    `<div style="width:200px;overflow:hidden;background:lightgray;">
       <p style="white-space:nowrap;width:600px;background:white;">A very long unbreakable line of text that overflows the container</p>
     </div>`,
  );
  const report = await collectGeometry(page, { surfaceId: "synth-text", path: "/synth" });
  const text = report.violations.find((v) => v.kind === "text-clipping");
  expect(text, "text-clipping violation").toBeDefined();
});

test("detector does not flag a clean layout", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await injectDOM(
    page,
    `<header style="padding:1rem;border-bottom:1px solid #ccc;">
       <h1>Title</h1>
     </header>
     <main style="padding:1rem;">
       <p>Body copy stays inside the container.</p>
       <button type="button">Save</button>
     </main>`,
  );
  const report = await collectGeometry(page, { surfaceId: "synth-clean", path: "/synth" });
  const fatal = report.violations.filter(
    (v) => v.kind === "page-horizontal-overflow" || v.kind === "impossible-control",
  );
  expect(
    fatal,
    `clean layout should not produce fatal violations: ${JSON.stringify(fatal)}`,
  ).toHaveLength(0);
});
