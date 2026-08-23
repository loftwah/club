import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { MembershipService } from "../../src/services/membership-service";
import { EventService } from "../../src/services/event-service";
import { MemberMemoryService } from "../../src/services/member-memory";
import { LocationService } from "../../src/services/location-service";
import { MilestoneService } from "../../src/services/milestone-service";
import { CommitmentService } from "../../src/services/commitment-service";
import { MagicLinkService } from "../../src/services/magic-link";

interface DevFixture {
  readonly db: MockD1Database;
  readonly audit: InMemoryAuditWriter;
  readonly clock: FixedClock;
  readonly location: LocationService;
  readonly membership: MembershipService;
  readonly memory: MemberMemoryService;
  readonly events: EventService;
  readonly milestones: MilestoneService;
  readonly commitments: CommitmentService;
  readonly magicLink: MagicLinkService;
}

async function setupFixture(): Promise<DevFixture> {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();

  db.insert("chapters", {
    id: "chap_melbourne",
    slug: "melbourne",
    name: "Melbourne",
    status: "ACTIVE",
  });
  for (const t of ["core", "correspondence", "deluxe"]) {
    const prices = { core: 500, correspondence: 2000, deluxe: 5000 };
    db.insert("membership_tiers", {
      id: `tier_${t}`,
      slug: t,
      display_name: t.charAt(0).toUpperCase() + t.slice(1),
      price_cents: prices[t as keyof typeof prices],
      currency: "AUD",
    });
    for (const cap of [
      "EVENTS",
      "PHYSICAL_CORRESPONDENCE",
      "MILESTONE_ARTEFACT",
      "DIGITAL_BIRTHDAY",
    ]) {
      if (t === "core" && (cap === "PHYSICAL_CORRESPONDENCE" || cap === "MILESTONE_ARTEFACT"))
        continue;
      db.insert("tier_capabilities", { tier_id: `tier_${t}`, capability: cap, enabled: 1 });
    }
    if (t !== "core") {
      for (const cap of ["GIFTS", "CALLS"]) {
        db.insert("tier_capabilities", { tier_id: `tier_${t}`, capability: cap, enabled: 1 });
      }
    }
  }

  const location = new LocationService({ db: db as unknown as D1Database, audit, clock });
  const membership = new MembershipService({ db: db as unknown as D1Database, audit, clock });
  const memory = new MemberMemoryService({ db: db as unknown as D1Database, audit, clock });
  const events = new EventService({
    db: db as unknown as D1Database,
    audit,
    clock,
    appBaseUrl: "https://club.loftwah.com",
    fromAddress: "hello@club.loftwah.com",
  });
  const milestones = new MilestoneService({ db: db as unknown as D1Database, audit, clock });
  const commitments = new CommitmentService({ db: db as unknown as D1Database, audit, clock });
  const magicLink = new MagicLinkService({
    db: db as unknown as D1Database,
    audit,
    clock,
    appBaseUrl: "https://club.loftwah.com",
  });

  return {
    db,
    audit,
    clock,
    location,
    membership,
    memory,
    events,
    milestones,
    commitments,
    magicLink,
  };
}

async function seedMember(
  fx: DevFixture,
  opts: { id: string; email: string; name: string; tier: "core" | "correspondence" | "deluxe" },
): Promise<void> {
  const { db, memory } = fx;
  db.insert("members", {
    id: opts.id,
    email: opts.email,
    preferred_name: opts.name,
    postal_name: null,
    society_alias: null,
    country: "AU",
    metro_area: "Melbourne",
    chapter_id: "chap_melbourne",
    birthday: "1990-08-15",
    timezone: "Australia/Melbourne",
  });
  db.insert("memberships", {
    id: `mship_${opts.id}`,
    member_id: opts.id,
    tier_id: `tier_${opts.tier}`,
    state: "ACTIVE",
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: null,
  });
  for (const svc of ["PHYSICAL_CORRESPONDENCE", "GIFTS", "CALLS"]) {
    db.insert("service_grants", {
      id: `sg_${opts.id}_${svc}`,
      member_id: opts.id,
      service: svc,
      state: "OPTED_IN",
    });
  }
  const f = await memory.propose({
    memberId: opts.id,
    category: "pet",
    subject: "Frank",
    value: "dog",
    sourceType: "MEMBER_SELF",
    sourceId: null,
  });
  await memory.confirm({ factId: f.id, reason: "OK" });
}

describe("dev fixture end-to-end", () => {
  it("runs the full system: locations, members, event, milestone, commitment, magic-link", async () => {
    const fx = await setupFixture();
    // 1. Locations.
    const locIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = `loc_${i}`;
      const l = await fx.location.propose({
        chapterId: "chap_melbourne",
        name: `Test Location ${id}`,
        suburb: "Fitzroy",
        address: "Test address",
        sourceUrl: "https://example.com/",
        locationType: "gallery",
      });
      await fx.location.activate(l.id, "operator_1");
      locIds.push(l.id);
    }
    expect(locIds).toHaveLength(5);

    // 2. Members.
    await seedMember(fx, {
      id: "mem_alice",
      email: "alice@example.com",
      name: "Alice",
      tier: "core",
    });
    await seedMember(fx, {
      id: "mem_bob",
      email: "bob@example.com",
      name: "Bob",
      tier: "correspondence",
    });
    await seedMember(fx, {
      id: "mem_carol",
      email: "carol@example.com",
      name: "Carol",
      tier: "deluxe",
    });

    // 3. Real event lifecycle.
    const event = await fx.events.create({
      chapterId: "chap_melbourne",
      title: "Test opening",
      eventType: "gallery",
      startAt: new Date(fx.clock.now().getTime() + 14 * 24 * 3600 * 1000).toISOString(),
      durationMinutes: 120,
      locationIds: [locIds[0]!],
      createdByActor: "operator_1",
    });
    const queued = await fx.events.queueInvitations(event.id);
    expect(queued).toBe(3);
    await fx.events.cancel(event.id, "operator_1", "OK");
    const final = await fx.events.get(event.id);
    expect(final?.state).toBe("ARCHIVED");

    // 4. Birthday milestones.
    for (const id of ["mem_alice", "mem_bob", "mem_carol"]) {
      const r = await fx.milestones.realise(id, "BIRTHDAY", "2026-08-15");
      expect(r.created).toBe(true);
      const actions = await fx.milestones.planActions(id, "BIRTHDAY");
      // Every tier gets EMAIL at minimum.
      const channels = new Set(actions.map((a) => a.channel));
      expect(channels.has("EMAIL")).toBe(true);
    }

    // 5. Manufactured commitment.
    const c = await fx.commitments.request({
      memberId: "mem_alice",
      goal: "Clean the apartment",
      scenarioText: "An old friend is visiting on Saturday.",
    });
    await fx.commitments.proposeScenario(c.id, "An old friend is visiting on Saturday.");
    await fx.commitments.confirm(c.id);
    await fx.commitments.close(c.id, "operator_1");
    const finalC = await fx.commitments.get(c.id);
    expect(finalC?.state).toBe("COMPLETED");

    // 6. Magic-link.
    const issued = await fx.magicLink.request({
      memberId: "mem_alice",
      email: "alice@example.com",
    });
    const session = await fx.magicLink.consume(issued.token);
    expect(session.memberId).toBe("mem_alice");

    // 7. Memory recall.
    const usable = await fx.memory.usableForMember("mem_alice");
    expect(usable).toHaveLength(1);

    // 8. Public counter.
    const cancelled = fx.db
      .all("events")
      .filter(
        (e) =>
          e.state === "ARCHIVED" ||
          e.state === "CANCELLED" ||
          e.state === "CALENDAR_CANCELLATION_PROCESSED",
      ).length;
    expect(cancelled).toBe(1);

    // Audit log is real.
    expect(fx.audit.events.length).toBeGreaterThan(10);
  });
});
