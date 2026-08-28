// Issue #6: manifest-driven authenticated runner.
//
// A single reusable helper that, given a `VisualSurface`,
// applies the matching deterministic fixture (member /
// onboarding / operator), navigates to the intended
// authenticated target, and proves the page actually rendered
// the intended screen (not a redirect to the login surface).
//
// The runner is the only way the visual suite should ever
// render an authenticated member/onboarding/operator surface.
// Every geometry collector and baseline snapshot for a private
// surface must go through `renderSurface`, so the visual QA
// contract is: if a surface entry exists in the manifest, the
// runner either proves it renders or fails the test. The
// runner is a no-op for `setup: "none"` (public surfaces).
//
// Design notes:
//   - Uses the existing magic-link devUrl flow (no production
//     auth bypass, no shared session cookie, no NODE_ENV
//     shortcut).
//   - The ready signal in the manifest is checked; for
//     surfaces that explicitly provide a `urlIncludes` the
//     runner proves the page did not bounce to the login
//     page.
//   - For onboarding surfaces, `setup: "onboarding"` is the
//     canonical fixture; for operator, `setup: "operator"`.
//   - The runner returns the page + final response so callers
//     can take snapshots, walk the geometry, or perform
//     additional assertions.

import type { APIRequestContext, BrowserContext, Page, Response } from "@playwright/test";
import { VISUAL_VIEWPORTS, type VisualSurface, type VisualViewportId } from "./manifest";
import { applySetup as applyPersonaSetup, type VisualPersona } from "./visual-fixtures";

export interface RenderedSurface {
  readonly page: Page;
  readonly response: Response | null;
  readonly persona: VisualPersona | null;
  readonly surface: VisualSurface;
  readonly viewport: VisualViewportId;
}

export interface RenderOptions {
  /** Skip waiting for the manifest ready signal (used for some state-only probes). */
  readonly skipReady?: boolean;
  /** Override the operator email. Defaults to "operator@local.test". */
  readonly operatorEmail?: string;
}

/**
 * Render the intended authenticated surface and return the
 * page + response. Throws if the surface did not reach its
 * declared ready signal. For surfaces that should not redirect
 * (private surfaces), the runner also asserts the URL did not
 * resolve to the login surface.
 */
export async function renderSurface(
  context: BrowserContext,
  api: APIRequestContext,
  surface: VisualSurface,
  viewportId: VisualViewportId,
  options: RenderOptions = {},
): Promise<RenderedSurface> {
  const vp = VISUAL_VIEWPORTS[viewportId];
  const page = await context.newPage();
  await page.setViewportSize({ width: vp.width, height: vp.height });
  let persona: VisualPersona | null = null;
  if (surface.setup !== "none") {
    // Capture the persona so callers can do additional setup
    // (e.g. open a FAQ <details>) before the ready signal.
    if (surface.setup === "member") {
      await applyPersonaSetup(page, api, "member");
    } else if (surface.setup === "onboarding") {
      await applyPersonaSetup(page, api, "onboarding");
    } else {
      // Pass an empty string so the dev-fixture falls back to
      // the configured `OPERATOR_EMAIL` binding. The
      // server-side `requireOperator` middleware only grants
      // operator access to the exact email bound to
      // `OPERATOR_EMAIL`, so any test-only override would
      // fail the admin route guard. The runner intentionally
      // does not invent a fake operator email.
      await applyPersonaSetup(page, api, "operator", options.operatorEmail ?? "");
    }
  }
  const response = await page.goto(surface.path, { waitUntil: "domcontentloaded" });
  // For private surfaces, assert we did NOT land on the login
  // page. The ready signal below is the positive proof.
  if (surface.setup !== "none") {
    const url = page.url();
    if (url.includes("/portal/login")) {
      throw new Error(
        `Authenticated surface ${surface.id} redirected to login at ${url} after applySetup; the magic-link devUrl did not establish a session.`,
      );
    }
  }
  if (!options.skipReady) {
    await assertReady(surface, page);
  }
  if (surface.setup !== "none") {
    // Re-derive the persona for caller convenience. This is
    // only used for logging; the actual session cookie is
    // already on the context.
    persona =
      surface.setup === "member"
        ? { email: "member@local.test", devUrl: "(set by applySetup)" }
        : surface.setup === "onboarding"
          ? { email: "onboarding@local.test", devUrl: "(set by applySetup)" }
          : {
              email: options.operatorEmail || "(env.OPERATOR_EMAIL)",
              devUrl: "(set by applySetup)",
            };
  }
  return { page, response, persona, surface, viewport: viewportId };
}

async function assertReady(surface: VisualSurface, page: Page): Promise<void> {
  const ready = surface.ready;
  if (ready.heading) {
    // The heading text or pattern is part of the page's
    // visible H1. We use a broad text match so the assertion
    // works on state variants (e.g. "Welcome, Onboarding
    // Subject" vs "Onboarding").
    const pattern =
      ready.heading instanceof RegExp ? ready.heading : new RegExp(ready.heading, "i");
    const headings = await page.locator("h1, h2").allTextContents();
    const matched = headings.some((t) => pattern.test(t));
    if (!matched) {
      throw new Error(
        `Ready signal for ${surface.id}: no <h1>/<h2> matched ${pattern.toString()}; saw ${JSON.stringify(headings.slice(0, 5))}`,
      );
    }
  }
  if (ready.selector) {
    const count = await page.locator(ready.selector).count();
    if (count === 0) {
      throw new Error(
        `Ready signal for ${surface.id}: selector "${ready.selector}" not present on the page.`,
      );
    }
  }
  if (ready.urlIncludes) {
    const url = page.url();
    if (!url.includes(ready.urlIncludes)) {
      throw new Error(
        `Ready signal for ${surface.id}: URL ${url} does not include "${ready.urlIncludes}".`,
      );
    }
  }
}
