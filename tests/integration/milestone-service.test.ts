import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { MilestoneService } from "../../src/services/milestone-service";

function setup(today: string) {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at(`${today}T10:00:00.000Z`);
  const audit = new InMemoryAuditWriter();
  const service = new MilestoneService({ db: db as unknown as D1Database, audit, clock });
  return { db, clock, audit, service };
}

function setupMember(db: MockD1Database, opts: { tier: "core" | "correspondence" | "deluxe" }) {
  const tierMap = {
    core: "tier_core",
    correspondence: "tier_cor",
    deluxe: "tier_del",
  };
  db.insert("members", {
    id: "mem_1",
    email: "a@example.com",
    preferred_name: "Alex",
    postal_name: null,
    society_alias: null,
    country: "AU",
    metro_area: "Melbourne",
    chapter_id: null,
    birthday: "1985-08-15",
    timezone: "Australia/Melbourne",
  });
  db.insert("memberships", {
    id: "mship_1",
    member_id: "mem_1",
    tier_id: tierMap[opts.tier],
    state: "ACTIVE",
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: null,
  });
  db.insert("membership_tiers", {
    id: tierMap.correspondence,
    slug: "correspondence",
    display_name: "Correspondence",
    price_cents: 2000,
    currency: "AUD",
  });
  db.insert("membership_tiers", {
    id: tierMap.deluxe,
    slug: "deluxe",
    display_name: "Deluxe",
    price_cents: 5000,
    currency: "AUD",
  });
  db.insert("membership_tiers", {
    id: tierMap.core,
    slug: "core",
    display_name: "Core",
    price_cents: 500,
    currency: "AUD",
  });
  db.insert("tier_capabilities", {
    tier_id: tierMap[opts.tier],
    capability: "PHYSICAL_CORRESPONDENCE",
    enabled: 1,
  });
  db.insert("tier_capabilities", {
    tier_id: tierMap[opts.tier],
    capability: "DIGITAL_BIRTHDAY",
    enabled: 1,
  });
  db.insert("tier_capabilities", {
    tier_id: tierMap[opts.tier],
    capability: "EVENTS",
    enabled: 1,
  });
  if (opts.tier === "correspondence" || opts.tier === "deluxe") {
    db.insert("tier_capabilities", {
      tier_id: tierMap[opts.tier],
      capability: "GIFTS",
      enabled: 1,
    });
    db.insert("tier_capabilities", {
      tier_id: tierMap[opts.tier],
      capability: "CALLS",
      enabled: 1,
    });
    db.insert("tier_capabilities", {
      tier_id: tierMap[opts.tier],
      capability: "MILESTONE_ARTEFACT",
      enabled: 1,
    });
  }
  db.insert("service_grants", {
    id: "sg_p",
    member_id: "mem_1",
    service: "PHYSICAL_CORRESPONDENCE",
    state: "OPTED_IN",
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
}

describe("MilestoneService", () => {
  it("birthday for A$5 (Core) plans EMAIL only", async () => {
    const { db, service } = setup("2026-08-15");
    setupMember(db, { tier: "core" });
    const actions = await service.planActions("mem_1", "BIRTHDAY");
    expect(actions.map((a) => a.channel)).toEqual(["EMAIL"]);
  });

  it("birthday for A$20 (Correspondence) plans EMAIL + POSTAL", async () => {
    const { db, service } = setup("2026-08-15");
    setupMember(db, { tier: "correspondence" });
    const actions = await service.planActions("mem_1", "BIRTHDAY");
    expect(actions.map((a) => a.channel)).toContain("EMAIL");
    expect(actions.map((a) => a.channel)).toContain("POSTAL");
  });

  it("birthday for A$50 (Deluxe) plans EMAIL + POSTAL + GIFT + CALL", async () => {
    const { db, service } = setup("2026-08-15");
    setupMember(db, { tier: "deluxe" });
    const actions = await service.planActions("mem_1", "BIRTHDAY");
    expect(actions.map((a) => a.channel)).toContain("EMAIL");
    expect(actions.map((a) => a.channel)).toContain("POSTAL");
    expect(actions.map((a) => a.channel)).toContain("GIFT");
    expect(actions.map((a) => a.channel)).toContain("CALL");
  });

  it("milestone realisation is idempotent on (member, trigger, day)", async () => {
    const { db, service } = setup("2026-08-15");
    setupMember(db, { tier: "core" });
    const r1 = await service.realise("mem_1", "BIRTHDAY", "2026-08-15");
    const r2 = await service.realise("mem_1", "BIRTHDAY", "2026-08-15");
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
  });
});
