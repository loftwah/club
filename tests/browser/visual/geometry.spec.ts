// Issue #7: DOM geometry telemetry with hard invariants.
//
// The runner iterates the canonical visual manifest (issue #6),
// renders EVERY surface — public, member, onboarding, operator —
// at the canonical 1440/1024/768/390/320 viewports, and asserts
// no hard invariant is violated. The detector is also
// exercised by synthetic self-tests in
// `geometry.detector.spec.ts`.
//
// Authenticated surfaces go through the manifest-driven runner
// (`./runner.ts`) so the suite is identical for every entry.
// The dev-fixture endpoint mints a real magic-link devUrl and
// the runner follows it; no production auth bypass is used.
//
// All seven hard invariants are fatal: a violation on any of
// them fails the test unless narrowly documented and
// allowlisted in the geometry detector.

import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VISUAL_VIEWPORTS, VISUAL_SURFACES, type VisualSurface } from "./manifest";
import { collectGeometry, formatViolation, type ViolationKind } from "./geometry";
import { renderSurface } from "./runner";

const OUTPUT_DIR = "test-results/geometry";

const FATAL_VIOLATIONS: ReadonlyArray<ViolationKind> = [
  "page-horizontal-overflow",
  "ancestor-clipping",
  "containing-block-overflow",
  "impossible-control",
  "text-clipping",
  "peer-overlap",
  "weird-intrinsic-dimensions",
];

test.beforeAll(() => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
});

const MOBILE_VIEWPORT = ["mobile", "minimum"] as const;

function publicSurfaces(surfaces: ReadonlyArray<VisualSurface>): ReadonlyArray<VisualSurface> {
  return surfaces.filter((s) => s.auth === "public");
}

for (const surface of VISUAL_SURFACES) {
  for (const viewportId of surface.viewports) {
    test(`geometry: ${surface.id} @ ${viewportId}`, async ({ browser, request }) => {
      const context = await browser.newContext({
        viewport: VISUAL_VIEWPORTS[viewportId],
        reducedMotion: "reduce",
      });
      try {
        const rendered = await renderSurface(context, request, surface, viewportId);
        const { page } = rendered;
        const response = rendered.response;
        expect(response, "response exists").not.toBeNull();
        const status = response?.status() ?? 0;
        // 4xx/5xx are surface failures, not invariant failures.
        if (surface.id !== "not-found") {
          expect(status, `${surface.id} status`).toBeLessThan(400);
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

        // The contract for the full surface matrix: every one of
        // the seven hard invariants is fatal. Narrowly-documented
        // exceptions are encoded inside `geometry.ts` (e.g. the
        // skip-link pattern) rather than here.
        const fatal = report.violations.filter((v) => FATAL_VIOLATIONS.includes(v.kind));
        if (fatal.length > 0) {
          const lines = fatal.map((v) => formatViolation(v)).join("\n\n");
          throw new Error(
            `Geometry invariant violations on ${surface.path} @ ${viewportId}:\n\n${lines}`,
          );
        }
      } finally {
        await context.close();
      }
    });
  }
}

// Narrow viewport probe: every public surface must remain free
// of page-level horizontal overflow at the mobile and minimum
// viewports. This is the complement of the per-surface test
// above; failures here pin the regression to the specific
// viewport without re-running the full matrix.
for (const surface of publicSurfaces(VISUAL_SURFACES)) {
  for (const viewportId of MOBILE_VIEWPORT) {
    test(`no horizontal overflow: ${surface.id} @ ${viewportId}`, async ({ browser }) => {
      const vp = VISUAL_VIEWPORTS[viewportId];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      try {
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
      } finally {
        await context.close();
      }
    });
  }
}
