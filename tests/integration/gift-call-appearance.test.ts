import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { GiftService } from "../../src/services/gift-service";
import { CallService } from "../../src/services/call-service";
import { AppearanceService } from "../../src/services/appearance-service";

function setupAll() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const gifts = new GiftService({ db: db as unknown as D1Database, audit, clock });
  const calls = new CallService({ db: db as unknown as D1Database, audit, clock });
  const appearance = new AppearanceService({ db: db as unknown as D1Database, audit, clock });
  return { db, clock, audit, gifts, calls, appearance };
}

function setupMember(db: MockD1Database) {
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
  db.insert("chapters", {
    id: "chap_melbourne",
    slug: "melbourne",
    name: "Melbourne",
    status: "ACTIVE",
  });
  db.insert("memberships", {
    id: "mship_1",
    member_id: "mem_1",
    tier_id: "tier_deluxe",
    state: "ACTIVE",
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: null,
  });
  db.insert("membership_tiers", {
    id: "tier_deluxe",
    slug: "deluxe",
    display_name: "Deluxe",
    price_cents: 5000,
    currency: "AUD",
  });
  db.insert("tier_capabilities", {
    tier_id: "tier_deluxe",
    capability: "GIFTS",
    enabled: 1,
  });
  db.insert("tier_capabilities", {
    tier_id: "tier_deluxe",
    capability: "CALLS",
    enabled: 1,
  });
  db.insert("service_grants", {
    id: "sg_g",
    member_id: "mem_1",
    service: "GIFTS",
    state: "OPTED_IN",
  });
  db.insert("service_grants", {
    id: "sg_c",
    member_id: "mem_1",
    service: "CALLS",
    state: "OPTED_IN",
  });
  db.insert("member_acceptances", {
    id: "acc_1",
    member_id: "mem_1",
    document_id: "doc_terms",
    accepted_at: "2026-01-01T00:00:00.000Z",
    method: "WEB",
  });
}

describe("GiftService", () => {
  it("full lifecycle: trigger → suggest → approve → purchased → dispatched → delivered", async () => {
    const { db, gifts } = setupAll();
    setupMember(db);
    const g = await gifts.trigger({
      memberId: "mem_1",
      occasion: "BIRTHDAY",
      description: "A small thoughtful gift",
      budgetCents: 5000,
    });
    expect(g.state).toBe("ELIGIBLE");
    await gifts.suggest(g.id, "Pen + notebook set", 5000);
    await gifts.approve(g.id, "operator_1");
    await gifts.markPurchased(g.id, "operator_1");
    await gifts.markDispatched(g.id, "operator_1");
    await gifts.markDelivered(g.id, "operator_1");
    const final = await gifts.get(g.id);
    expect(final?.state).toBe("DELIVERED");
  });

  it("permission revocation cancels all non-terminal gifts for the member", async () => {
    const { db, gifts } = setupAll();
    setupMember(db);
    const g1 = await gifts.trigger({
      memberId: "mem_1",
      occasion: "BIRTHDAY",
      description: "A",
      budgetCents: 1000,
    });
    const g2 = await gifts.trigger({
      memberId: "mem_1",
      occasion: "ANNIVERSARY",
      description: "B",
      budgetCents: 2000,
    });
    const n = await gifts.cancelAllForMember("mem_1", "MEMBER_OPTED_OUT");
    expect(n).toBe(2);
    const after1 = await gifts.get(g1.id);
    const after2 = await gifts.get(g2.id);
    expect(after1?.state).toBe("CANCELLED");
    expect(after2?.state).toBe("CANCELLED");
  });
});

describe("CallService", () => {
  it("proposes, allows, schedules, completes", async () => {
    const { db, calls } = setupAll();
    setupMember(db);
    const c = await calls.propose({
      memberId: "mem_1",
      purpose: "Birthday",
      windowStart: "2026-08-15T10:00:00.000Z",
      windowEnd: "2026-08-15T12:00:00.000Z",
    });
    expect(c.state).toBe("POLICY_ALLOWED");
    await calls.schedule(c.id);
    await calls.markDue(c.id);
    await calls.markCompleted(c.id, "operator_1");
    const final = await calls.get(c.id);
    expect(final?.state).toBe("COMPLETED");
  });

  it("revocation cancels scheduled calls", async () => {
    const { db, calls } = setupAll();
    setupMember(db);
    const c = await calls.propose({
      memberId: "mem_1",
      purpose: "Birthday",
      windowStart: "2026-08-15T10:00:00.000Z",
      windowEnd: "2026-08-15T12:00:00.000Z",
    });
    await calls.schedule(c.id);
    await calls.cancelAllForMember("mem_1", "MEMBER_OPTED_OUT");
    const after = await calls.get(c.id);
    expect(after?.state).toBe("PERMISSION_REVOKED");
  });

  it("builds a briefing that excludes do-not-mention facts", async () => {
    const { db, calls } = setupAll();
    setupMember(db);
    db.insert("member_facts", {
      id: "fact_pet",
      member_id: "mem_1",
      category: "pet",
      subject: "Max",
      value_json: JSON.stringify("dog"),
      status: "CONFIRMED",
      source_type: "MEMBER_SELF",
      source_id: null,
      confidence: null,
      do_not_use: 0,
    });
    db.insert("member_facts", {
      id: "fact_prev_emp",
      member_id: "mem_1",
      category: "employer",
      subject: "Acme",
      value_json: JSON.stringify("Acme"),
      status: "CONFIRMED",
      source_type: "MEMBER_SELF",
      source_id: null,
      confidence: null,
      do_not_use: 1,
    });
    const c = await calls.propose({
      memberId: "mem_1",
      purpose: "Birthday",
      windowStart: "2026-08-15T10:00:00.000Z",
      windowEnd: "2026-08-15T12:00:00.000Z",
    });
    const briefing = await calls.buildBriefing(c.id);
    expect(briefing).toContain("Max");
    expect(briefing).toContain("Do NOT mention");
    expect(briefing).toContain("Acme");
  });
});

describe("AppearanceService", () => {
  it("safe request reaches BOOKED", async () => {
    const { appearance } = setupAll();
    const r = await appearance.request({
      requesterId: "ext_1",
      memberId: null,
      role: "friend",
      location: "Carlton, VIC",
      travelRequired: false,
      brief: "Casual friend for a wedding-adjacent dinner. Outgoing, can hold a conversation.",
    });
    expect(r.state).toBe("SUITABILITY_APPROVED");
    await appearance.quote(r.id, 25000, 5000);
    await appearance.accept(r.id);
    await appearance.paymentPending(r.id);
    await appearance.book(r.id);
    const booked = await appearance.get(r.id);
    expect(booked?.state).toBe("BOOKED");
  });

  it("disallowed use case is declined", async () => {
    const { appearance } = setupAll();
    const r = await appearance.request({
      requesterId: "ext_1",
      memberId: null,
      role: "lawyer",
      location: "Sydney, NSW",
      travelRequired: true,
      brief: "Pretend to be my lawyer in a meeting.",
    });
    expect(r.state).toBe("SUITABILITY_DECLINED");
  });

  it("customer can cancel", async () => {
    const { appearance } = setupAll();
    const r = await appearance.request({
      requesterId: "ext_1",
      memberId: null,
      role: "plus-one",
      location: "Fitzroy, VIC",
      travelRequired: false,
      brief: "A polite plus-one.",
    });
    await appearance.quote(r.id, 20000, 0);
    await appearance.accept(r.id);
    await appearance.paymentPending(r.id);
    await appearance.book(r.id);
    await appearance.cancelByCustomer(r.id, "changed plans");
    const after = await appearance.get(r.id);
    expect(after?.state).toBe("CUSTOMER_CANCELLED");
  });
});
