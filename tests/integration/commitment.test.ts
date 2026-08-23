import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { CommitmentService } from "../../src/services/commitment-service";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const service = new CommitmentService({
    db: db as unknown as D1Database,
    audit,
    clock,
  });
  return { db, clock, audit, service };
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
    chapter_id: null,
    birthday: null,
    timezone: "Australia/Melbourne",
  });
  db.insert("memberships", {
    id: "mship_1",
    member_id: "mem_1",
    tier_id: "tier_correspondence",
    state: "ACTIVE",
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: null,
  });
  db.insert("membership_tiers", {
    id: "tier_correspondence",
    slug: "correspondence",
    display_name: "Correspondence",
    price_cents: 2000,
    currency: "AUD",
  });
  db.insert("tier_capabilities", {
    tier_id: "tier_correspondence",
    capability: "MANUFACTURED_COMMITMENTS",
    enabled: 1,
  });
  db.insert("service_grants", {
    id: "sg_1",
    member_id: "mem_1",
    service: "MANUFACTURED_COMMITMENTS",
    state: "OPTED_IN",
  });
}

describe("CommitmentService", () => {
  it("full lifecycle: request → goal → scenario → confirm → schedule → reminder → close", async () => {
    const { db, service } = setup();
    setupMember(db);
    const c = await service.request({
      memberId: "mem_1",
      goal: "Clean the apartment",
      scenarioText: "An old friend is visiting from out of town.",
    });
    expect(c.state).toBe("GOAL_CAPTURED");
    await service.proposeScenario(c.id, "An old friend is visiting from out of town on Saturday.");
    const proposed = await service.get(c.id);
    expect(proposed?.state).toBe("SCENARIO_PROPOSED");
    await service.confirm(c.id);
    const confirmed = await service.get(c.id);
    expect(confirmed?.state).toBe("REMINDER_PHASE");
    await service.close(c.id, "operator_1");
    const closed = await service.get(c.id);
    expect(closed?.state).toBe("COMPLETED");
    expect(closed?.completedAt).toBeTruthy();
  });

  it("abort at any pre-completion state is terminal", async () => {
    const { db, service } = setup();
    setupMember(db);
    const c = await service.request({
      memberId: "mem_1",
      goal: "Clean the apartment",
      scenarioText: "An old friend is visiting from out of town.",
    });
    await service.proposeScenario(c.id, "An old friend is visiting from out of town on Saturday.");
    await service.abort(c.id, "MEMBER_OPTED_OUT");
    const aborted = await service.get(c.id);
    expect(aborted?.state).toBe("ABORTED");
  });
});
