// Issue #7: DOM geometry telemetry with hard invariants.
//
// The runner iterates the canonical visual manifest (issue #6),
// renders each public surface at the canonical 1440/1024/768/390
// viewports, and asserts no hard invariant is violated. The
// detector is also exercised by synthetic self-tests in
// `geometry.detector.spec.ts`.
//
// The visual runner intentionally focuses on public surfaces
// because they are the only ones reachable without an
// authenticated session. Authenticated surfaces are covered by
// the same detector when run with the operator/member fixture
// helpers in `visual-fixtures.ts`.

import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VISUAL_VIEWPORTS, VISUAL_SURFACES } from "./manifest";
import { collectGeometry, formatViolation } from "./geometry";

const OUTPUT_DIR = "test-results/geometry";

test.beforeAll(() => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
});

const PUBLIC_SURFACES = VISUAL_SURFACES.filter((s) => s.auth === "public");
const MOBILE_VIEWPORT = ["mobile", "minimum"] as const;

for (const surface of PUBLIC_SURFACES) {
  for (const viewportId of surface.viewports) {
    test(`geometry: ${surface.id} @ ${viewportId}`, async ({ browser }) => {
      const vp = VISUAL_VIEWPORTS[viewportId];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      const response = await page.goto(surface.path);
      // 4xx/5xx are surface failures, not invariant failures.
      expect(response, "response exists").not.toBeNull();
      const status = response?.status() ?? 0;
      // 404 is allowed for the not-found surface; otherwise we
      // expect 2xx/3xx.
      if (surface.id !== "not-found") {
        expect(status, `${surface.id} status`).toBeLessThan(400);
      }
      // Confirm the intended screen actually rendered.
      if (surface.ready.selector) {
        await expect(page.locator(surface.ready.selector).first()).toBeVisible();
      }

      const report = await collectGeometry(page, {
        surfaceId: surface.id,
        state: surface.state,
        path: surface.path,
      });
      const filename = join(
        OUTPUT_DIR,
        `${surface.id}--${surface.state ?? "default"}--${viewportId}.json`,
      );
      writeFileSync(filename, JSON.stringify(report, null, 2));

      // The contract for the public surface: no page-level
      // horizontal overflow and no visible interactive control
      // with impossible dimensions.
      const fatal = report.violations.filter(
        (v) => v.kind === "page-horizontal-overflow" || v.kind === "impossible-control",
      );
      if (fatal.length > 0) {
        const lines = fatal.map((v) => formatViolation(v)).join("\n\n");
        throw new Error(
          `Geometry invariant violations on ${surface.path} @ ${viewportId}:\n\n${lines}`,
        );
      }
      await context.close();
    });
  }
}

// Narrow viewport probe: every public surface must remain free
// of page-level horizontal overflow at the mobile and minimum
// viewports. This is the complement of the per-surface test
// above; failures here pin the regression to the specific
// viewport without re-running the full matrix.
for (const surface of PUBLIC_SURFACES) {
  for (const viewportId of MOBILE_VIEWPORT) {
    test(`no horizontal overflow: ${surface.id} @ ${viewportId}`, async ({ browser }) => {
      const vp = VISUAL_VIEWPORTS[viewportId];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      await page.goto(surface.path);
      // The faq-answer-open surface needs an open <details>
      // element. Click the first FAQ <summary> to open it.
      if (surface.id === "faq-answer-open") {
        await page.locator(".pwy-faq-list details").nth(1).locator("summary").click();
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${surface.path}`).toBeLessThanOrEqual(1);
      await context.close();
    });
  }
}
