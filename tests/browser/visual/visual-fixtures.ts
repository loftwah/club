// Issue #6 visual fixtures.
//
// Deterministic local-D1 fixtures for the authenticated visual
// suite. Three personas are required by the issue:
//
//   1. member        — an active member with enough populated
//                       data to exercise member pages
//   2. onboarding    — a member in a valid onboarding state with
//                       persisted step data
//   3. operator      — a member whose email exactly matches the
//                       local OPERATOR_EMAIL, granting operator
//                       access through the ordinary member
//                       session
//
// Each persona returns a magic-link devUrl that the test runner
// can navigate to. The dev URL is the only authentication path
// the suite uses: no test-only auth bypass, no shared session
// cookie, no NODE_ENV-driven shortcut. The devUrl is only
// returned by the magic-link service when APP_BASE_URL is
// localhost/127.0.0.1 (see src/services/magic-link.ts).
//
// Implementation note: the seed API lives in
// `src/pages/internal/dev-fixture.ts` and is only mounted in
// local development. CI acceptance runs against a real local
// wrangler dev process, so the devUrl flow is available there
// too.

import type { APIRequestContext } from "@playwright/test";

export interface VisualPersona {
  readonly email: string;
  readonly devUrl: string;
}

async function postJSON(
  api: APIRequestContext,
  path: string,
  body: Record<string, unknown> = {},
): Promise<{ email: string; devUrl: string }> {
  const res = await api.post(path, { data: body });
  if (!res.ok()) {
    throw new Error(`fixture ${path} returned ${res.status()}: ${await res.text()}`);
  }
  const json = (await res.json()) as { email?: string; devUrl?: string };
  if (!json.email || !json.devUrl) {
    throw new Error(`fixture ${path} returned no email/devUrl: ${JSON.stringify(json)}`);
  }
  return { email: json.email, devUrl: json.devUrl };
}

export async function seedMember(api: APIRequestContext): Promise<VisualPersona> {
  return postJSON(api, "/api/internal/dev-fixture/member", {});
}

export async function seedOnboardingSubject(api: APIRequestContext): Promise<VisualPersona> {
  return postJSON(api, "/api/internal/dev-fixture/onboarding", {});
}

export async function seedOperator(
  api: APIRequestContext,
  operatorEmail: string,
): Promise<VisualPersona> {
  return postJSON(api, "/api/internal/dev-fixture/operator", {
    operatorEmail,
  });
}

/**
 * Apply a setup using the magic-link devUrl so the browser ends
 * up authenticated for the requested surface. The devUrl is only
 * minted when APP_BASE_URL is localhost/127.0.0.1; production
 * URLs would simply return 404 from the magic-link service.
 *
 * The `operatorEmail` argument is forwarded to the dev-fixture
 * endpoint's request body. An empty string lets the dev-fixture
 * fall back to the worker's configured `OPERATOR_EMAIL` binding
 * — which is the only email `requireOperator` will accept for
 * admin route access, so any test-side default would fail the
 * admin guard.
 */
export async function applySetup(
  page: import("@playwright/test").Page,
  api: APIRequestContext,
  setup: "none" | "member" | "onboarding" | "operator",
  operatorEmail = "",
): Promise<void> {
  if (setup === "none") return;
  let persona: VisualPersona;
  if (setup === "member") {
    persona = await seedMember(api);
  } else if (setup === "onboarding") {
    persona = await seedOnboardingSubject(api);
  } else {
    persona = await seedOperator(api, operatorEmail);
  }
  await page.goto(persona.devUrl);
}
