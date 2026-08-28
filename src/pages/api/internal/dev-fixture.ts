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
// The endpoint is mounted at /api/internal/dev-fixture/* and
// is gated by the same loopback-only check that protects the
// rest of /internal — production hostname requests are
// rejected by middleware.
//
//   POST /api/internal/dev-fixture/member       -> { email, devUrl }
//   POST /api/internal/dev-fixture/onboarding   -> { email, devUrl }
//   POST /api/internal/dev-fixture/operator     -> { email, devUrl } (body: { operatorEmail })

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { MembershipService } from "@services/membership-service";
import { MagicLinkService } from "@services/magic-link";
import { OnboardingService } from "@services/onboarding";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";
import { listChapters } from "@lib/chapters";

interface FixtureResult {
  email: string;
  devUrl: string;
}

function isLoopback(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function ensureChapterIds(): Promise<{
  melbourne: string;
  sydney: string;
  brisbane: string;
  adelaide: string;
  perth: string;
  auckland: string;
}> {
  const chapters = listChapters();
  const map: Record<string, string> = {};
  for (const c of chapters) {
    map[c.slug] = c.slug;
  }
  return {
    melbourne: map.melbourne ?? "melbourne",
    sydney: map.sydney ?? "sydney",
    brisbane: map.brisbane ?? "brisbane",
    adelaide: map.adelaide ?? "adelaide",
    perth: map.perth ?? "perth",
    auckland: map.auckland ?? "auckland",
  };
}

async function ensureTierIds(env: ReturnType<typeof getRuntimeEnv>): Promise<{
  member: string;
  corresponding: string;
  deluxe: string;
}> {
  // The seeded fixture tiers are referenced by slug; the
  // membership service uses the membership_tiers table.
  // We look the row up by slug and create if missing so
  // acceptance runs on a fresh local D1 still work.
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
    throw new Error(
      "membership_tiers table is missing the member/corresponding/deluxe rows. Run acceptance first to seed them.",
    );
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
    throw new Error(
      "legal_documents table is missing TERMS/PRIVACY_POLICY/THEATRICAL_EXPERIENCE_ACKNOWLEDGEMENT rows. Run acceptance first to seed them.",
    );
  }
  return {
    terms: terms.id,
    privacy: privacy.id,
    theatrical: theatrical.id,
  };
}

async function ensureChapterRows(
  env: ReturnType<typeof getRuntimeEnv>,
  slugs: Record<string, string>,
): Promise<void> {
  const chapters = listChapters();
  for (const c of chapters) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO chapters (id, slug, name, status, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        slugs[c.slug] ?? c.slug,
        c.slug,
        c.name,
        c.status === "ACTIVE" ? "ACTIVE" : "WAITLIST_ONLY",
        c.openedAt,
      )
      .run();
  }
}

async function issueDevUrl(
  env: ReturnType<typeof getRuntimeEnv>,
  memberId: string,
  email: string,
  continuePath: string,
): Promise<string> {
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const ml = new MagicLinkService({
    db: env.DB,
    audit,
    clock: new SystemClock(),
    appBaseUrl: env.APP_BASE_URL ?? "http://127.0.0.1:8787",
  });
  const { url } = await ml.request({ memberId, email, continuePath });
  return url;
}

async function seedMemberFixture(env: ReturnType<typeof getRuntimeEnv>): Promise<FixtureResult> {
  const email = "member@local.test";
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const clock = new SystemClock();
  const ms = new MembershipService({ db: env.DB, audit, clock });
  const slugs = await ensureChapterIds();
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
  await ms.advanceIdentity(memberId, audit);
  await ms.setChapter(memberId, slugs.melbourne);
  await ms.selectTier(memberId, tiers.member);
  await ms.completePreferences(memberId);
  await ms.completeServices(memberId);
  await ms.completeAlignment(memberId);
  await ms.completeConsents(memberId, [legal.terms, legal.privacy, legal.theatrical]);
  await ms.acceptTerms(memberId, [legal.terms, legal.privacy]);
  await ms.paymentPending(memberId);
  await ms.activate(memberId);

  // Persist representative step data so the onboarding UI
  // shows realistic filled-in state if the dev re-enters it.
  const ob = new OnboardingService({ db: env.DB });
  await ob.storeStepData(memberId, "identity", {
    preferredName: "Local Member",
    country: "AU",
    metroArea: "Melbourne",
    birthday: "08-15",
    timezone: "Australia/Melbourne",
  });
  await ob.storeStepData(memberId, "chapter", { chapterId: slugs.melbourne });
  await ob.storeStepData(memberId, "tier", { tier: "member" });
  await ob.storeStepData(memberId, "why", {
    reasons: ["cancelled-plans", "belong-without-attendance", "correspondence"],
  });

  const devUrl = await issueDevUrl(env, memberId, email, "/portal/");
  return { email, devUrl };
}

async function seedOnboardingFixture(
  env: ReturnType<typeof getRuntimeEnv>,
): Promise<FixtureResult> {
  const email = "onboarding@local.test";
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const clock = new SystemClock();
  const ms = new MembershipService({ db: env.DB, audit, clock });
  const slugs = await ensureChapterIds();
  await ensureChapterRows(env, slugs);

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
  // Drive the membership to IDENTITY_COMPLETE so onboarding
  // surfaces render and the middle-of-wizard screens are
  // meaningful. Do NOT activate — we want the wizard in flight.
  await ms.setIdentity(memberId, {
    preferredName: "Onboarding Subject",
    country: "AU",
    metroArea: "Melbourne",
    birthday: "01-01",
    timezone: "Australia/Melbourne",
  });
  await ms.advanceIdentity(memberId, audit);
  await ms.setChapter(memberId, slugs.melbourne);
  await ms.selectTier(memberId, "member");
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
  await ob.storeStepData(memberId, "chapter", { chapterId: slugs.melbourne });
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

  const devUrl = await issueDevUrl(env, memberId, email, "/onboarding/identity/");
  return { email, devUrl };
}

async function seedOperatorFixture(
  env: ReturnType<typeof getRuntimeEnv>,
  operatorEmail: string,
): Promise<FixtureResult> {
  const email = operatorEmail.toLowerCase();
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const clock = new SystemClock();
  const ms = new MembershipService({ db: env.DB, audit, clock });
  const slugs = await ensureChapterIds();
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
  await ms.advanceIdentity(memberId, audit);
  await ms.setChapter(memberId, slugs.melbourne);
  await ms.selectTier(memberId, tiers.deluxe);
  await ms.completePreferences(memberId);
  await ms.completeServices(memberId);
  await ms.completeAlignment(memberId);
  await ms.completeConsents(memberId, [legal.terms, legal.privacy, legal.theatrical]);
  await ms.acceptTerms(memberId, [legal.terms, legal.privacy]);
  await ms.paymentPending(memberId);
  await ms.activate(memberId);

  const devUrl = await issueDevUrl(env, memberId, email, "/admin/");
  return { email, devUrl };
}

async function handle(
  request: Request,
  context: { locals: unknown },
  persona: "member" | "onboarding" | "operator",
): Promise<Response> {
  const url = new URL(request.url);
  if (!isLoopback(url)) {
    return json({ error: "dev-fixture endpoints are loopback-only" }, 403);
  }
  const env = getRuntimeEnv(context.locals);
  if (!env?.DB) {
    return json({ error: "D1 not available" }, 500);
  }
  if (request.method !== "POST") {
    return json({ error: "POST required" }, 405);
  }
  let body: { operatorEmail?: string } = {};
  try {
    body = (await request.json()) as { operatorEmail?: string };
  } catch {
    body = {};
  }
  try {
    let result: FixtureResult;
    if (persona === "member") result = await seedMemberFixture(env);
    else if (persona === "onboarding") result = await seedOnboardingFixture(env);
    else {
      const opEmail = (body.operatorEmail ?? env.OPERATOR_EMAIL ?? "operator@local.test").trim();
      result = await seedOperatorFixture(env, opEmail);
    }
    return json(result, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "fixture failed" }, 500);
  }
}

export const POST_member: APIRoute = (ctx) => handle(ctx.request, ctx, "member");
export const POST_onboarding: APIRoute = (ctx) => handle(ctx.request, ctx, "onboarding");
export const POST_operator: APIRoute = (ctx) => handle(ctx.request, ctx, "operator");
