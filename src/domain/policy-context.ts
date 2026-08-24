import type { D1Database } from "@cloudflare/workers-types";
import type { Capability, PolicyContext, ServiceGrantState } from "./policy.js";

/**
 * Load authoritative policy inputs from D1. Domain services call this at the
 * moment of action so a revoked grant or changed entitlement wins over any
 * previously scheduled or AI-proposed work.
 */
export async function loadPolicyContext(
  db: D1Database,
  memberId: string,
  service: string,
): Promise<PolicyContext> {
  const membership = await db
    .prepare(
      `SELECT state, tier_id FROM memberships
        WHERE member_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(memberId)
    .first<{ state: PolicyContext["membershipState"]; tier_id: string }>();
  const member = await db
    .prepare(`SELECT chapter_id FROM members WHERE id = ?`)
    .bind(memberId)
    .first<{ chapter_id: string | null }>();
  const chapter = member?.chapter_id
    ? await db
        .prepare(`SELECT status FROM chapters WHERE id = ?`)
        .bind(member.chapter_id)
        .first<{ status: string }>()
    : null;

  const capabilities = membership
    ? await db
        .prepare(`SELECT capability FROM tier_capabilities WHERE tier_id = ? AND enabled = 1`)
        .bind(membership.tier_id)
        .all<{ capability: Capability }>()
    : { results: [] as Array<{ capability: Capability }> };
  const grant = await db
    .prepare(`SELECT state FROM service_grants WHERE member_id = ? AND service = ?`)
    .bind(memberId, service)
    .first<{ state: ServiceGrantState }>();

  // Consent, terms, and billing are independent D1 facts. They must not be
  // inferred from the membership state: a stale or manually-corrupted ACTIVE
  // row must not grant a capability.
  const acceptanceForLatest = async (docType: string): Promise<boolean> => {
    const document = await db
      .prepare(
        `SELECT id, effective_at FROM legal_documents
         WHERE doc_type = ? ORDER BY effective_at DESC LIMIT 1`,
      )
      .bind(docType)
      .first<{ id: string; effective_at: string }>();
    if (!document) return false;
    const acceptance = await db
      .prepare(
        `SELECT accepted_at FROM member_acceptances
         WHERE member_id = ? AND document_id = ? AND accepted_at >= ? LIMIT 1`,
      )
      .bind(memberId, document.id, document.effective_at)
      .first<{ accepted_at: string }>();
    return Boolean(acceptance);
  };

  const termsCurrent = await acceptanceForLatest("TERMS");
  const privacyCurrent = await acceptanceForLatest("PRIVACY_POLICY");
  const theatricalAcknowledgementCurrent = await acceptanceForLatest(
    "THEATRICAL_EXPERIENCE_ACKNOWLEDGEMENT",
  );
  const subscription = await db
    .prepare(
      `SELECT provider, provider_customer_id, provider_subscription_id, tier_id, status
       FROM subscriptions WHERE member_id = ? ORDER BY updated_at DESC LIMIT 1`,
    )
    .bind(memberId)
    .first<{
      provider: string;
      provider_customer_id: string;
      provider_subscription_id: string;
      tier_id: string;
      status: string;
    }>();
  const billingCustomer = subscription
    ? await db
        .prepare(
          `SELECT id FROM billing_customers
           WHERE member_id = ? AND provider = ? AND provider_customer_id = ? LIMIT 1`,
        )
        .bind(memberId, subscription.provider, subscription.provider_customer_id)
        .first<{ id: string }>()
    : null;
  const billingActive = Boolean(
    subscription &&
    billingCustomer &&
    subscription.status === "ACTIVE" &&
    subscription.tier_id === membership?.tier_id &&
    subscription.provider &&
    subscription.provider_customer_id &&
    subscription.provider_subscription_id,
  );

  const membershipState = membership?.state ?? "ABANDONED";
  const grantState = grant?.state ?? null;
  return {
    membershipState,
    tierId: membership?.tier_id ?? null,
    tierCapabilities: new Set((capabilities.results ?? []).map((row) => row.capability)),
    serviceGrantState: grantState,
    explicitOptOut: grantState === "OPTED_OUT",
    consentCurrent: privacyCurrent && theatricalAcknowledgementCurrent,
    termsCurrent,
    billingActive,
    chapterSupported: chapter?.status === "ACTIVE",
    safetyBlocked: false,
    duplicate: false,
  };
}
