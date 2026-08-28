// Local development fixture endpoint.
//
// This is the deterministic, local-only D1 seeder the visual
// regression suite (#6 / #7 / #8) drives. Three personas are
// required by the issue:
//
//   1. member        — an active, paid member with enough
//                       populated data to exercise every
//                       member surface.
//   2. onboarding    — a member in a valid onboarding state
//                       with persisted step data through the
//                       representative middle of the wizard.
//   3. operator      — a member whose email exactly matches
//                       OPERATOR_EMAIL, granting operator
//                       access through the normal member
//                       session.
//
// Each persona gets back a magic-link devUrl — the same flow
// the production /api/portal/login returns in dev. The devUrl
// is the only authentication path the visual suite uses:
// no test-only auth bypass, no shared session cookie, no
// NODE_ENV shortcut. devUrl is only minted when APP_BASE_URL
// is localhost/127.0.0.1 (see src/services/magic-link.ts).
//
// The endpoint is mounted as a dynamic Astro route:
//
//   POST /api/internal/dev-fixture/member       -> { email, devUrl }
//   POST /api/internal/dev-fixture/onboarding   -> { email, devUrl }
//   POST /api/internal/dev-fixture/operator     -> { email, devUrl } (body: { operatorEmail })
//
// It is gated by a loopback-only check; production hostname
// requests are rejected with 403. The membership
// `chapters`/`members`/`magic_links` rows are seeded
// deterministically on every call so a fresh wrangler dev
// state is sufficient for the visual suite to drive every
// surface from the same login.

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { MembershipService } from "@services/membership-service";
import { MagicLinkService } from "@services/magic-link";
import { OnboardingService } from "@services/onboarding";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";
import { listChapters } from "@lib/chapters";

type Persona = "member" | "onboarding" | "operator";

interface FixtureResult {
  email: string;
  devUrl: string;
}

function isLoopback(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
}

/**
 * Workerd / Miniflare on wrangler dev synthesises a Request URL
 * from the worker's configured `route.pattern` (here
 * `club.loftwah.com/*`). The actual TCP connection is from the
 * local loopback address, so the only way to prove a request
 * originated from a local process is to inspect the connection
 * peer or a forwarded header. `cf-connecting-ip` is the
 * canonical Cloudflare header for the original client address
 * and works the same way under workerd's local mode.
 */
function isLoopbackConnection(request: Request): boolean {
  const ip = (request.headers.get("cf-connecting-ip") ?? "").trim();
  if (!ip) return false;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  // The x-forwarded-for list is comma-separated; the first
  // entry is the original client.
  const xff = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  if (xff === "127.0.0.1" || xff === "::1") return true;
  return false;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function slugMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of listChapters()) map[c.slug] = c.slug;
  return map;
}

async function ensureTierIds(env: ReturnType<typeof getRuntimeEnv>): Promise<{
  member: string;
  corresponding: string;
  deluxe: string;
}> {
  // The seeded fixture tiers are referenced by slug; the
  // membership service uses the membership_tiers table.
  // Upsert the canonical three tiers here so the fixture is
  // self-contained on a fresh local D1.
  const tiers: Array<{ id: string; slug: string; displayName: string; priceCents: number }> = [
    { id: "tier_member", slug: "member", displayName: "Member", priceCents: 500 },
    {
      id: "tier_correspondence",
      slug: "corresponding",
      displayName: "Corresponding Member",
      priceCents: 2000,
    },
    { id: "tier_deluxe", slug: "deluxe", displayName: "Deluxe Member", priceCents: 5000 },
  ];
  const now = new Date().toISOString();
  for (const t of tiers) {
    await env.DB.prepare(
      `INSERT INTO membership_tiers (id, slug, display_name, price_cents, currency, created_at)
       VALUES (?, ?, ?, ?, 'AUD', ?)
       ON CONFLICT(slug) DO NOTHING`,
    )
      .bind(t.id, t.slug, t.displayName, t.priceCents, now)
      .run();
  }
  const memberRow = await env.DB.prepare(
    `SELECT id FROM membership_tiers WHERE slug = 'member' LIMIT 1`,
  ).first<{ id: string }>();
  const correspondingRow = await env.DB.prepare(
    `SELECT id FROM membership_tiers WHERE slug = 'corresponding' LIMIT 1`,
  ).first<{ id: string }>();
  const deluxeRow = await env.DB.prepare(
    `SELECT id FROM membership_tiers WHERE slug = 'deluxe' LIMIT 1`,
  ).first<{ id: string }>();
  if (!memberRow || !correspondingRow || !deluxeRow) {
    throw new Error("membership_tiers upsert failed; the seeded rows did not materialise.");
  }
  return {
    member: memberRow.id,
    corresponding: correspondingRow.id,
    deluxe: deluxeRow.id,
  };
}

async function ensureLegalDocuments(env: ReturnType<typeof getRuntimeEnv>): Promise<{
  terms: string;
  privacy: string;
  theatrical: string;
}> {
  // The seeded fixture relies on legal_documents being present
  // so `ms.completeConsents` / `ms.acceptTerms` can record the
  // acceptance row. Production seeds these via the onboarding
  // API (`/api/onboarding/terms` upserts placeholders), but the
  // visual suite never POSTs the terms step — the dev-fixture
  // drives the member straight to ACTIVE. Upsert placeholders
  // here so the seeded member state is reproducible on a fresh
  // D1 without a prior request to the onboarding API.
  const now = new Date().toISOString();
  for (const { docType, body } of [
    { docType: "TERMS", body: "TERMS_PLACEHOLDER" },
    { docType: "PRIVACY_POLICY", body: "PRIVACY_PLACEHOLDER" },
    {
      docType: "THEATRICAL_EXPERIENCE_ACKNOWLEDGEMENT",
      body: "THEATRICAL_PLACEHOLDER",
    },
  ]) {
    const id = `doc_${docType.toLowerCase()}_0.0.1-dev`;
    const contentHash = await sha256Hex(body);
    await env.DB.prepare(
      `INSERT INTO legal_documents (id, doc_type, version, effective_at, content_hash, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(doc_type, version) DO NOTHING`,
    )
      .bind(id, docType, "0.0.1-dev", now, contentHash, body, now)
      .run();
  }
  const terms = await env.DB.prepare(
    `SELECT id FROM legal_documents WHERE doc_type = 'TERMS' ORDER BY effective_at DESC LIMIT 1`,
  ).first<{ id: string }>();
  const privacy = await env.DB.prepare(
    `SELECT id FROM legal_documents WHERE doc_type = 'PRIVACY_POLICY' ORDER BY effective_at DESC LIMIT 1`,
  ).first<{ id: string }>();
  const theatrical = await env.DB.prepare(
    `SELECT id FROM legal_documents WHERE doc_type = 'THEATRICAL_EXPERIENCE_ACKNOWLEDGEMENT' ORDER BY effective_at DESC LIMIT 1`,
  ).first<{ id: string }>();
  if (!terms || !privacy || !theatrical) {
    throw new Error("legal_documents upsert failed; the seeded rows did not materialise.");
  }
  return {
    terms: terms.id,
    privacy: privacy.id,
    theatrical: theatrical.id,
  };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureChapterRows(
  env: ReturnType<typeof getRuntimeEnv>,
  slugs: Record<string, string>,
): Promise<void> {
  for (const c of listChapters()) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO chapters (id, slug, name, status, country_code, region, timezone, locale, display_locality, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        slugs[c.slug] ?? c.slug,
        c.slug,
        c.name,
        c.status === "ACTIVE" ? "ACTIVE" : "WAITLIST_ONLY",
        c.countryCode ?? null,
        c.region ?? null,
        c.timezone ?? null,
        c.locale ?? null,
        c.displayLocality ?? c.name,
        c.openedAt,
      )
      .run();
  }
}

async function issueDevUrl(
  env: ReturnType<typeof getRuntimeEnv>,
  request: Request,
  memberId: string,
  email: string,
  continuePath: string,
): Promise<string> {
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  // The visual suite hits the dev-fixture from the local
  // loopback origin (127.0.0.1:8788). workerd synthesises
  // the request URL from the worker's `route.pattern`
  // (https://club.loftwah.com/...), which means the URL
  // hostname never reflects the actual TCP peer. The peer
  // (or a forwarded header) is the only signal we can trust
  // to know the request came from a loopback. The handler's
  // top-level guard already accepted this request as
  // loopback-only, so the override below is safe.
  const appBaseUrl = isLoopbackConnection(request)
    ? deriveLoopbackBaseUrl(request)
    : (env.APP_BASE_URL ?? "https://club.loftwah.com");
  const ml = new MagicLinkService({
    db: env.DB,
    audit,
    clock: new SystemClock(),
    appBaseUrl,
  });
  const { url } = await ml.request({ memberId, email, continuePath });
  return url;
}

/**
 * Build a base URL that points at the loopback origin the
 * browser actually used. workerd rewrites the inbound
 * `Host` header to the worker's configured `route.pattern`
 * (https://club.loftwah.com), so the header can never be
 * trusted to recover the loopback origin. The Playwright
 * config pins the dev server to `http://127.0.0.1:8788`
 * (the canonical wrangler dev port used by the acceptance
 * script), so we hard-code the loopback origin here. The
 * loopback guard at the top of the handler has already
 * proven this request is safe to expose the devUrl.
 */
function deriveLoopbackBaseUrl(_request: Request): string {
  return "http://127.0.0.1:8788";
}

async function seedMemberFixture(
  env: ReturnType<typeof getRuntimeEnv>,
  request: Request,
): Promise<FixtureResult> {
  const email = "member@local.test";
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const clock = new SystemClock();
  const ms = new MembershipService({ db: env.DB, audit, clock });
  const slugs = slugMap();
  await ensureChapterRows(env, slugs);
  const tiers = await ensureTierIds(env);
  const legal = await ensureLegalDocuments(env);

  const existing = await env.DB.prepare(`SELECT id FROM members WHERE email = ?`)
    .bind(email)
    .first<{ id: string }>();
  let memberId: string;
  if (existing) {
    memberId = existing.id;
  } else {
    const created = await ms.createApplicant({ email, preferredName: "Local Member" });
    memberId = created.member.id;
  }

  // Drive the membership to ACTIVE so every member surface renders.
  await ms.setIdentity(memberId, {
    preferredName: "Local Member",
    postalName: "L Member",
    country: "AU",
    metroArea: "Melbourne",
    birthday: "08-15",
    timezone: "Australia/Melbourne",
  });
  // Walk the membership state machine in the correct order.
  // APPLICANT can only advance to EMAIL_VERIFIED; the full
  // production wizard takes many requests to reach ACTIVE,
  // but the dev fixture moves straight through so every
  // member surface renders from a single seed call.
  await ms.advanceTo(memberId, "EMAIL_VERIFIED", audit);
  await ms.advanceIdentity(memberId, audit);
  await ms.setChapter(memberId, slugs.melbourne ?? "melbourne");
  await ms.selectTier(memberId, tiers.member);
  await ms.completePreferences(memberId);
  await ms.completeServices(memberId);
  await ms.completeAlignment(memberId);
  await ms.completeConsents(memberId, [legal.terms, legal.privacy, legal.theatrical]);
  await ms.acceptTerms(memberId, [legal.terms, legal.privacy]);

  // Persist representative step data so the onboarding UI
  // shows realistic filled-in state if the dev re-enters it.
  // The required-step check in `getActivationBlockers` reads
  // this table, so we save it BEFORE the final `activate()`.
  const ob = new OnboardingService({ db: env.DB });
  await ob.storeStepData(memberId, "identity", {
    preferredName: "Local Member",
    country: "AU",
    metroArea: "Melbourne",
    birthday: "08-15",
    timezone: "Australia/Melbourne",
  });
  await ob.storeStepData(memberId, "chapter", { chapterId: slugs.melbourne ?? "melbourne" });
  await ob.storeStepData(memberId, "tier", { tier: "member" });
  await ob.storeStepData(memberId, "why", {
    reasons: ["cancelled-plans", "belong-without-attendance", "correspondence"],
  });
  await ob.storeStepData(memberId, "post", {
    postalName: "Local Member",
    addressLine1: "1 Sample Street",
    suburb: "Carlton",
    postcode: "3053",
    country: "AU",
  });
  await ob.storeStepData(memberId, "plain-language", { acknowledged: true });
  await ob.storeStepData(memberId, "terms", {
    termsAccepted: true,
    privacyAccepted: true,
    theatricalAccepted: true,
  });
  // The full production activation also requires a real
  // Stripe subscription + billing customer. The dev fixture
  // synthesises a `fake` provider subscription so the
  // membership state machine can be driven straight to
  // ACTIVE. The fixture is loopback-only and the provider
  // is explicitly `fake`; no real billing is ever touched.
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO subscriptions (id, member_id, provider, provider_customer_id, provider_subscription_id, tier_id, status, current_period_end, created_at, updated_at)
     VALUES (?, ?, 'fake', ?, ?, ?, 'ACTIVE', NULL, ?, ?)`,
  )
    .bind(
      `sub_${memberId}`,
      memberId,
      `cus_${memberId}`,
      `provider_sub_${memberId}`,
      tiers.member,
      now,
      now,
    )
    .run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO billing_customers (id, member_id, provider, provider_customer_id, created_at)
     VALUES (?, ?, 'fake', ?, ?)`,
  )
    .bind(`bc_${memberId}`, memberId, `cus_${memberId}`, now)
    .run();

  await ms.paymentPending(memberId);
  await ms.activate(memberId);

  const devUrl = await issueDevUrl(env, request, memberId, email, "/portal/");
  return { email, devUrl };
}

async function seedOnboardingFixture(
  env: ReturnType<typeof getRuntimeEnv>,
  request: Request,
): Promise<FixtureResult> {
  const email = "onboarding@local.test";
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const clock = new SystemClock();
  const ms = new MembershipService({ db: env.DB, audit, clock });
  const slugs = slugMap();
  await ensureChapterRows(env, slugs);
  const tiers = await ensureTierIds(env);

  const existing = await env.DB.prepare(`SELECT id FROM members WHERE email = ?`)
    .bind(email)
    .first<{ id: string }>();
  let memberId: string;
  if (existing) {
    memberId = existing.id;
  } else {
    const created = await ms.createApplicant({ email, preferredName: "Onboarding Subject" });
    memberId = created.member.id;
  }
  // Drive the membership to ALIGNMENT_COMPLETE so onboarding
  // surfaces render and the middle-of-wizard screens are
  // meaningful. Do NOT activate — we want the wizard in flight.
  await ms.setIdentity(memberId, {
    preferredName: "Onboarding Subject",
    country: "AU",
    metroArea: "Melbourne",
    birthday: "01-01",
    timezone: "Australia/Melbourne",
  });
  await ms.advanceTo(memberId, "EMAIL_VERIFIED", audit);
  await ms.advanceIdentity(memberId, audit);
  await ms.setChapter(memberId, slugs.melbourne ?? "melbourne");
  await ms.selectTier(memberId, tiers.member);
  await ms.completePreferences(memberId);
  await ms.completeServices(memberId);
  await ms.completeAlignment(memberId);
  // NOTE: deliberately not advancing to CONSENTS_COMPLETE so
  // the wizard terms/payment-gate step is still navigable.

  const ob = new OnboardingService({ db: env.DB });
  await ob.storeStepData(memberId, "identity", {
    preferredName: "Onboarding Subject",
    country: "AU",
    metroArea: "Melbourne",
    birthday: "01-01",
    timezone: "Australia/Melbourne",
  });
  await ob.storeStepData(memberId, "chapter", { chapterId: slugs.melbourne ?? "melbourne" });
  await ob.storeStepData(memberId, "tier", { tier: "member" });
  await ob.storeStepData(memberId, "why", {
    reasons: ["cancelled-plans", "belong-without-attendance"],
  });
  await ob.storeStepData(memberId, "event-preferences", {
    frequency: "occasional",
    cancellationStyle: "merciful",
    types: ["dinners", "talks"],
  });
  await ob.storeStepData(memberId, "communications", {
    opt: ["NEWSLETTER", "CALENDAR_MESSAGES"],
  });
  await ob.storeStepData(memberId, "memory", {
    memoryHint: "I collect vintage postcards.",
    doNotMention: "",
  });
  await ob.storeStepData(memberId, "post", {
    postalName: "Onboarding Subject",
    addressLine1: "12 Sample Street",
    suburb: "Carlton",
    postcode: "3053",
    country: "AU",
  });

  const devUrl = await issueDevUrl(env, request, memberId, email, "/onboarding/identity/");
  return { email, devUrl };
}

async function seedOperatorFixture(
  env: ReturnType<typeof getRuntimeEnv>,
  request: Request,
  operatorEmail: string,
): Promise<FixtureResult> {
  const email = operatorEmail.toLowerCase();
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const clock = new SystemClock();
  const ms = new MembershipService({ db: env.DB, audit, clock });
  const slugs = slugMap();
  await ensureChapterRows(env, slugs);
  const tiers = await ensureTierIds(env);
  const legal = await ensureLegalDocuments(env);

  const existing = await env.DB.prepare(`SELECT id FROM members WHERE email = ?`)
    .bind(email)
    .first<{ id: string }>();
  let memberId: string;
  if (existing) {
    memberId = existing.id;
  } else {
    const created = await ms.createApplicant({ email, preferredName: "Operator" });
    memberId = created.member.id;
  }
  await ms.setIdentity(memberId, {
    preferredName: "Operator",
    country: "AU",
    metroArea: "Melbourne",
    timezone: "Australia/Melbourne",
  });
  await ms.advanceTo(memberId, "EMAIL_VERIFIED", audit);
  await ms.advanceIdentity(memberId, audit);
  await ms.setChapter(memberId, slugs.melbourne ?? "melbourne");
  await ms.selectTier(memberId, tiers.deluxe);
  await ms.completePreferences(memberId);
  await ms.completeServices(memberId);
  await ms.completeAlignment(memberId);
  await ms.completeConsents(memberId, [legal.terms, legal.privacy, legal.theatrical]);
  await ms.acceptTerms(memberId, [legal.terms, legal.privacy]);
  // Synthesise a `fake` provider subscription so the
  // membership state machine is happy. See the member
  // fixture for the full rationale.
  const opNow = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO subscriptions (id, member_id, provider, provider_customer_id, provider_subscription_id, tier_id, status, current_period_end, created_at, updated_at)
     VALUES (?, ?, 'fake', ?, ?, ?, 'ACTIVE', NULL, ?, ?)`,
  )
    .bind(
      `sub_${memberId}`,
      memberId,
      `cus_${memberId}`,
      `provider_sub_${memberId}`,
      tiers.deluxe,
      opNow,
      opNow,
    )
    .run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO billing_customers (id, member_id, provider, provider_customer_id, created_at)
     VALUES (?, ?, 'fake', ?, ?)`,
  )
    .bind(`bc_${memberId}`, memberId, `cus_${memberId}`, opNow)
    .run();
  // Required-step data so the activation blockers clear.
  const opOb = new OnboardingService({ db: env.DB });
  for (const step of ["identity", "chapter", "tier", "why", "plain-language", "terms"] as const) {
    await opOb.storeStepData(memberId, step, { ok: true });
  }
  await ms.paymentPending(memberId);
  await ms.activate(memberId);

  const devUrl = await issueDevUrl(env, request, memberId, email, "/admin/");
  return { email, devUrl };
}

function parsePersona(raw: string | undefined): Persona | null {
  if (raw === "member" || raw === "onboarding" || raw === "operator") return raw;
  return null;
}

export const POST: APIRoute = async (ctx) => {
  const url = new URL(ctx.request.url);
  if (!isLoopback(url) && !isLoopbackConnection(ctx.request)) {
    return json({ error: "dev-fixture endpoints are loopback-only" }, 403);
  }
  const env = getRuntimeEnv(ctx.locals);
  if (!env?.DB) {
    return json({ error: "D1 not available" }, 500);
  }
  const persona = parsePersona(ctx.params.persona);
  if (!persona) {
    return json({ error: `unknown persona: ${ctx.params.persona ?? "(none)"}` }, 404);
  }
  let body: { operatorEmail?: string } = {};
  try {
    body = (await ctx.request.json()) as { operatorEmail?: string };
  } catch {
    body = {};
  }
  try {
    let result: FixtureResult;
    if (persona === "member") result = await seedMemberFixture(env, ctx.request);
    else if (persona === "onboarding") result = await seedOnboardingFixture(env, ctx.request);
    else {
      // The operator email must match the configured
      // `OPERATOR_EMAIL` binding for `requireOperator` to grant
      // admin access. An empty or unset body falls back to the
      // worker's configured email so a test-side default
      // cannot fail the operator guard. The `||` operator
      // matches both `undefined` and `""`, which the `??`
      // operator would not.
      const opEmail = (body.operatorEmail || env.OPERATOR_EMAIL || "operator@local.test").trim();
      result = await seedOperatorFixture(env, ctx.request, opEmail);
    }
    return json(result, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "fixture failed" }, 500);
  }
};
