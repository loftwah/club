import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { loadPolicyContext } from "../../src/domain/policy-context";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";

function setup(): MockD1Database {
  const db = new MockD1Database();
  loadSchema(db);
  db.insert("chapters", {
    id: "chap_melbourne",
    slug: "melbourne",
    name: "Melbourne",
    status: "ACTIVE",
  });
  db.insert("members", {
    id: "mem_1",
    email: "member@example.com",
    preferred_name: "Alex",
    country: "AU",
    chapter_id: "chap_melbourne",
  });
  db.insert("membership_tiers", {
    id: "tier_core",
    slug: "core",
    display_name: "Member",
    price_cents: 500,
    currency: "AUD",
  });
  db.insert("tier_capabilities", {
    tier_id: "tier_core",
    capability: "EVENTS",
    enabled: 1,
  });
  db.insert("memberships", {
    id: "mship_1",
    member_id: "mem_1",
    tier_id: "tier_core",
    state: "ACTIVE",
  });
  return db;
}

function seedLegalAndBilling(db: MockD1Database): void {
  for (const [id, docType] of [
    ["doc_terms", "TERMS"],
    ["doc_privacy", "PRIVACY_POLICY"],
    ["doc_theatrical", "THEATRICAL_EXPERIENCE_ACKNOWLEDGEMENT"],
  ]) {
    db.insert("legal_documents", {
      id,
      doc_type: docType,
      version: "1.0.0",
      effective_at: "2026-01-01T00:00:00.000Z",
      content_hash: `hash_${id}`,
      body: null,
    });
    db.insert("member_acceptances", {
      id: `acc_${id}`,
      member_id: "mem_1",
      document_id: id,
      accepted_at: "2026-01-01T00:00:00.000Z",
      method: "WEB",
    });
  }
  db.insert("subscriptions", {
    id: "sub_1",
    member_id: "mem_1",
    provider: "fake",
    provider_customer_id: "cus_1",
    provider_subscription_id: "provider_sub_1",
    tier_id: "tier_core",
    status: "ACTIVE",
  });
  db.insert("billing_customers", {
    id: "bc_1",
    member_id: "mem_1",
    provider: "fake",
    provider_customer_id: "cus_1",
  });
}

describe("loadPolicyContext", () => {
  it("does not infer consent, terms, or billing from ACTIVE alone", async () => {
    const db = setup();
    const context = await loadPolicyContext(
      db as unknown as D1Database,
      "mem_1",
      "CORE_MEMBERSHIP",
    );
    expect(context.membershipState).toBe("ACTIVE");
    expect(context.consentCurrent).toBe(false);
    expect(context.termsCurrent).toBe(false);
    expect(context.billingActive).toBe(false);
  });

  it("returns true only when current legal acceptances and matching billing exist", async () => {
    const db = setup();
    seedLegalAndBilling(db);
    const context = await loadPolicyContext(
      db as unknown as D1Database,
      "mem_1",
      "CORE_MEMBERSHIP",
    );
    expect(context.consentCurrent).toBe(true);
    expect(context.termsCurrent).toBe(true);
    expect(context.billingActive).toBe(true);

    db.insert("legal_documents", {
      id: "doc_terms_2",
      doc_type: "TERMS",
      version: "2.0.0",
      effective_at: "2027-01-01T00:00:00.000Z",
      content_hash: "hash_terms_2",
      body: null,
    });
    const stale = await loadPolicyContext(db as unknown as D1Database, "mem_1", "CORE_MEMBERSHIP");
    expect(stale.termsCurrent).toBe(false);
  });
});
