// Onboarding wizard action endpoints.
// /api/onboarding/[step] handles the per-step POST. The
// onboarding service stores the per-step data and advances
// the wizard.

import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { OnboardingService, ONBOARDING_STEPS, type OnboardingStepId } from "../../services/onboarding";
import { MembershipService } from "../../services/membership-service";
import { D1AuditWriter } from "../../infra/audit";
import { SystemClock } from "../../infra/clock";

export const POST: APIRoute = async ({ request, locals, url, redirect }) => {
  const env = locals.runtime.env;
  if (!env?.DB) return new Response("DB not available", { status: 500 });
  const step = (url.pathname.split("/").pop() ?? "") as OnboardingStepId;
  if (!ONBOARDING_STEPS.find((s) => s.id === step)) {
    return new Response("Unknown step", { status: 404 });
  }
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const clock = new SystemClock();
  const onboarding = new OnboardingService({ db: env.DB });
  const ms = new MembershipService({ db: env.DB, audit, clock });

  // Look up the most-recent applicant. (Local dev: there is
  // typically exactly one.) When the portal auth is wired, this
  // becomes `ctx.member.id`.
  const applicant = await env.DB
    .prepare(
      `SELECT m.id FROM members m
         JOIN memberships ms ON ms.member_id = m.id
         WHERE ms.state = 'APPLICANT'
         ORDER BY m.created_at DESC LIMIT 1`,
    )
    .first<{ id: string }>();
  if (!applicant) return new Response("No applicant to onboard", { status: 400 });

  const form = await request.formData();

  switch (step) {
    case "identity": {
      await ms.setIdentity(applicant.id, {
        preferredName: String(form.get("preferredName") ?? "").trim(),
        country: String(form.get("country") ?? "").trim(),
        metroArea: String(form.get("metroArea") ?? "").trim(),
        birthday: String(form.get("birthday") ?? "").trim(),
        timezone: String(form.get("timezone") ?? "Australia/Melbourne").trim(),
      });
      await ms.advanceIdentity(applicant.id, audit);
      await onboarding.storeStepData(applicant.id, step, {
        preferredName: String(form.get("preferredName") ?? ""),
        country: String(form.get("country") ?? ""),
        metroArea: String(form.get("metroArea") ?? ""),
        birthday: String(form.get("birthday") ?? ""),
        timezone: String(form.get("timezone") ?? ""),
      });
      break;
    }
    case "chapter": {
      const chapterId = String(form.get("chapterId") ?? "");
      await ms.setChapter(applicant.id, chapterId);
      await onboarding.storeStepData(applicant.id, step, { chapterId });
      break;
    }
    case "tier": {
      const tier = String(form.get("tier") ?? "");
      await ms.selectTier(applicant.id, tier);
      await onboarding.storeStepData(applicant.id, step, { tier });
      break;
    }
    case "why": {
      const values = form.getAll("why").map(String);
      await onboarding.storeStepData(applicant.id, step, { why: values });
      break;
    }
    case "event-preferences": {
      const types = form.getAll("types").map(String);
      await onboarding.storeStepData(applicant.id, step, {
        frequency: form.get("frequency"),
        cancellationStyle: form.get("cancellationStyle"),
        types,
      });
      break;
    }
    case "communications": {
      const opt = form.getAll("opt").map(String);
      for (const svc of opt) {
        await ms.setServiceGrant(applicant.id, svc, "OPTED_IN");
      }
      await onboarding.storeStepData(applicant.id, step, { opt });
      break;
    }
    case "memory": {
      await onboarding.storeStepData(applicant.id, step, {
        memoryHint: form.get("memoryHint"),
        doNotMention: form.get("doNotMention"),
      });
      break;
    }
    case "post": {
      const optIn = form.get("surprisePackages") === "true";
      if (optIn) await ms.setServiceGrant(applicant.id, "PHYSICAL_CORRESPONDENCE", "OPTED_IN");
      await onboarding.storeStepData(applicant.id, step, {
        postalName: form.get("postalName"),
        addressLine1: form.get("addressLine1"),
        addressLine2: form.get("addressLine2"),
        suburb: form.get("suburb"),
        postcode: form.get("postcode"),
        country: form.get("country"),
        surprisePackages: optIn,
      });
      break;
    }
    case "gifts": {
      const enabled = form.get("gifts") === "enabled";
      if (enabled) await ms.setServiceGrant(applicant.id, "GIFTS", "OPTED_IN");
      else await ms.setServiceGrant(applicant.id, "GIFTS", "OPTED_OUT");
      await onboarding.storeStepData(applicant.id, step, {
        enabled,
        surprises: form.get("surprises") === "enabled",
        interests: form.get("interests"),
        neverSend: form.get("neverSend"),
      });
      break;
    }
    case "calls": {
      const mode = String(form.get("callMode") ?? "NO_CALLS");
      if (mode === "NO_CALLS") await ms.setServiceGrant(applicant.id, "CALLS", "OPTED_OUT");
      else await ms.setServiceGrant(applicant.id, "CALLS", "OPTED_IN");
      await onboarding.storeStepData(applicant.id, step, {
        callMode: mode,
        callWindow: form.get("callWindow"),
        voicemail: form.get("voicemail") === "ok",
        surpriseCall: form.get("surpriseCall") === "ok",
      });
      break;
    }
    case "manufactured-commitments": {
      const optIn = form.get("mcOptIn") === "true";
      if (optIn) await ms.setServiceGrant(applicant.id, "MANUFACTURED_COMMITMENTS", "OPTED_IN");
      else await ms.setServiceGrant(applicant.id, "MANUFACTURED_COMMITMENTS", "OPTED_OUT");
      await onboarding.storeStepData(applicant.id, step, { optIn });
      break;
    }
    case "appearance-interest": {
      const interest = String(form.get("appearance") ?? "ASK_LATER");
      const state = interest === "INTERESTED" ? "OPTED_IN" : interest === "NOT_INTERESTED" ? "OPTED_OUT" : "AVAILABLE";
      await ms.setServiceGrant(applicant.id, "APPEARANCE_INTEREST", state);
      await onboarding.storeStepData(applicant.id, step, { interest });
      break;
    }
    case "plain-language": {
      const acked = form.get("acknowledged") === "true";
      if (!acked) return new Response("You must acknowledge the plain-language terms.", { status: 400 });
      await ms.advanceAlignment(applicant.id, audit);
      await onboarding.storeStepData(applicant.id, step, { acknowledged: acked });
      break;
    }
    case "terms": {
      const terms = form.get("termsAccepted") === "true";
      const privacy = form.get("privacyAccepted") === "true";
      const theatrical = form.get("theatricalAccepted") === "true";
      if (!(terms && privacy && theatrical)) {
        return new Response("All three acceptances are required.", { status: 400 });
      }
      // Look up (or create) the legal document rows. In MVP we
      // upsert placeholders with the current date.
      await ensureLegalDocument(env.DB, "TERMS", "0.0.1-dev", "TERMS_PLACEHOLDER");
      await ensureLegalDocument(env.DB, "PRIVACY_POLICY", "0.0.1-dev", "PRIVACY_PLACEHOLDER");
      await ensureLegalDocument(env.DB, "THEATRICAL_EXPERIENCE_ACKNOWLEDGEMENT", "0.0.1-dev", "THEATRICAL_PLACEHOLDER");
      await ms.completeConsents(applicant.id, [
        ...(await documentIds(env.DB, ["TERMS", "PRIVACY_POLICY", "THEATRICAL_EXPERIENCE_ACKNOWLEDGEMENT"])),
      ]);
      await ms.acceptTerms(applicant.id, [
        ...(await documentIds(env.DB, ["TERMS"])),
      ]);
      await onboarding.storeStepData(applicant.id, step, { terms, privacy, theatrical });
      break;
    }
    case "payment-gate": {
      // The payment gate is disabled. The web-authoritative
      // activation happens in the Stripe webhook handler.
      await ms.paymentPending(applicant.id);
      break;
    }
    default:
      return new Response("Unknown step", { status: 404 });
  }

  // Advance to next step in the canonical order.
  const next = await onboarding.nextStep(applicant.id);
  return redirect(`/onboarding/${next?.id ?? "payment-gate"}/`, 303);
};

async function ensureLegalDocument(
  db: D1Database,
  docType: string,
  version: string,
  body: string,
): Promise<void> {
  const id = `doc_${docType.toLowerCase()}_${version}`;
  const content_hash = await sha256Hex(body);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO legal_documents (id, doc_type, version, effective_at, content_hash, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(doc_type, version) DO NOTHING`,
    )
    .bind(id, docType, version, now, content_hash, body, now)
    .run();
}

async function documentIds(db: D1Database, types: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const t of types) {
    const row = await db
      .prepare(`SELECT id FROM legal_documents WHERE doc_type = ? ORDER BY effective_at DESC LIMIT 1`)
      .bind(t)
      .first<{ id: string }>();
    if (row) ids.push(row.id);
  }
  return ids;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
