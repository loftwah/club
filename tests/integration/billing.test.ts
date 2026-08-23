import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { D1AuditWriter as _D1AuditWriter, InMemoryAuditWriter } from "../../src/infra/audit";
void _D1AuditWriter;
import { MembershipService } from "../../src/services/membership-service";
import { applyBillingEvent, FakeBillingProvider } from "../../src/services/billing-service";
import { brand, formatPrice } from "../../src/brand/config";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const membership = new MembershipService({
    db: db as unknown as D1Database,
    audit,
    clock,
  });
  return { db, clock, audit, membership };
}

function setupMember(db: MockD1Database) {
  db.insert("chapters", {
    id: "chap_melbourne",
    slug: "melbourne",
    name: "Melbourne",
    status: "ACTIVE",
  });
  db.insert("members", {
    id: "mem_1",
    email: "a@example.com",
    preferred_name: "Alex",
    postal_name: null,
    society_alias: null,
    country: "AU",
    metro_area: "Melbourne",
    chapter_id: "chap_melbourne",
    birthday: null,
    timezone: "Australia/Melbourne",
  });
  db.insert("membership_tiers", {
    id: "tier_core",
    slug: "core",
    display_name: "Core",
    price_cents: 500,
    currency: "AUD",
  });
  db.insert("memberships", {
    id: "mship_1",
    member_id: "mem_1",
    tier_id: "tier_core",
    state: "PAYMENT_PENDING",
    started_at: null,
    ended_at: null,
  });
  db.insert("subscriptions", {
    id: "sub_1",
    member_id: "mem_1",
    provider: "fake",
    provider_customer_id: "cus_1",
    provider_subscription_id: "sub_1",
    tier_id: "tier_core",
    status: "INCOMPLETE",
    current_period_end: null,
  });
  db.insert("billing_customers", {
    id: "bc_1",
    member_id: "mem_1",
    provider: "fake",
    provider_customer_id: "cus_1",
  });
}

function getMembershipState(db: MockD1Database, memberId: string): string | undefined {
  return db.all("memberships").find((r) => r.member_id === memberId)?.state as string | undefined;
}

describe("brand config", () => {
  it("is non-final by design: name and tiers are configurable", () => {
    expect(brand.name).toBeTruthy();
    expect(brand.tiers.core.priceAud).toBe(5);
    expect(brand.tiers.correspondence.priceAud).toBe(20);
    expect(brand.tiers.deluxe.priceAud).toBe(50);
    // Provisional identity marker — every agent session should
    // know that the brand is not locked.
    expect(brand.development.isProvisional).toBe(true);
  });
  it("formats prices as A$N", () => {
    expect(formatPrice(5)).toBe("A$5");
    expect(formatPrice(20)).toBe("A$20");
    expect(formatPrice(50)).toBe("A$50");
  });
});

describe("BillingService", () => {
  it("webhook-authoritative: invoice.payment_succeeded activates the membership", async () => {
    const { db, membership, clock, audit } = setup();
    setupMember(db);
    const deps = { db: db as unknown as D1Database, audit, clock, membership };
    const event = {
      id: "evt_1",
      type: "invoice.payment_succeeded",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      invoiceId: "in_1",
      payload: {},
    };
    const r = await applyBillingEvent(deps, event);
    expect(r.action).toBe("ACTIVATED");
    expect(getMembershipState(db, "mem_1")).toBe("ACTIVE");
  });

  it("replay of the same provider event is deduplicated", async () => {
    const { db, membership, clock, audit } = setup();
    setupMember(db);
    const deps = { db: db as unknown as D1Database, audit, clock, membership };
    const event = {
      id: "evt_1",
      type: "invoice.payment_succeeded",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      invoiceId: "in_1",
      payload: {},
    };
    const r1 = await applyBillingEvent(deps, event);
    const r2 = await applyBillingEvent(deps, event);
    expect(r1.action).toBe("ACTIVATED");
    expect(r2.duplicate).toBe(true);
  });

  it("payment_failed suspends the membership", async () => {
    const { db, membership, clock, audit } = setup();
    setupMember(db);
    const deps = { db: db as unknown as D1Database, audit, clock, membership };
    await applyBillingEvent(deps, {
      id: "evt_pay",
      type: "invoice.payment_succeeded",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      invoiceId: "in_pay",
      payload: {},
    });
    await applyBillingEvent(deps, {
      id: "evt_fail",
      type: "invoice.payment_failed",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      invoiceId: "in_fail",
      payload: {},
    });
    expect(getMembershipState(db, "mem_1")).toBe("SUSPENDED");
  });

  it("subscription.deleted cancels the membership", async () => {
    const { db, membership, clock, audit } = setup();
    setupMember(db);
    const deps = { db: db as unknown as D1Database, audit, clock, membership };
    await applyBillingEvent(deps, {
      id: "evt_pay",
      type: "invoice.payment_succeeded",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      invoiceId: "in_pay",
      payload: {},
    });
    await applyBillingEvent(deps, {
      id: "evt_del",
      type: "customer.subscription.deleted",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      invoiceId: null,
      payload: {},
    });
    expect(getMembershipState(db, "mem_1")).toBe("CANCELLED");
  });

  it("FakeBillingProvider rejects malformed bodies", () => {
    const p = new FakeBillingProvider();
    expect(p.verifyWebhook("not json", null)).toBeNull();
    expect(
      p.verifyWebhook(
        JSON.stringify({
          id: "x",
          type: "t",
          customerId: "c",
          subscriptionId: null,
          invoiceId: null,
          payload: {},
        }),
        null,
      ),
    ).not.toBeNull();
  });
});
