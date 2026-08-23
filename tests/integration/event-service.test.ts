import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { EventService } from "../../src/services/event-service";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const service = new EventService({
    db: db as unknown as D1Database,
    audit,
    clock,
    appBaseUrl: "https://club.loftwah.com",
    fromAddress: "hello@club.loftwah.com",
  });
  return { db, clock, audit, service };
}

function setupChapterAndLocation(db: MockD1Database) {
  db.insert("chapters", {
    id: "chap_melbourne",
    slug: "melbourne",
    name: "Melbourne",
    status: "ACTIVE",
  });
  db.insert("locations", {
    id: "loc_gertrude",
    chapter_id: "chap_melbourne",
    name: "Gertrude Street Gallery",
    suburb: "Fitzroy",
    address: "146 Gertrude St",
    source_url: "https://example.com/gertrude",
    location_type: "gallery",
    tags_json: null,
    status: "ACTIVE",
    verified_at: "2026-08-01T00:00:00.000Z",
  });
}

describe("EventService — ordinary event lifecycle", () => {
  it("creates an event, queues invitations, cancels it, and produces a stable calendar UID", async () => {
    const { db, service } = setup();
    setupChapterAndLocation(db);
    // Two members.
    db.insert("members", {
      id: "mem_a",
      email: "a@example.com",
      preferred_name: "A",
      postal_name: null,
      society_alias: null,
      country: "AU",
      metro_area: "Melbourne",
      chapter_id: "chap_melbourne",
      birthday: null,
      timezone: "Australia/Melbourne",
    });
    db.insert("members", {
      id: "mem_b",
      email: "b@example.com",
      preferred_name: "B",
      postal_name: null,
      society_alias: null,
      country: "AU",
      metro_area: "Melbourne",
      chapter_id: "chap_melbourne",
      birthday: null,
      timezone: "Australia/Melbourne",
    });
    db.insert("memberships", {
      id: "mship_a",
      member_id: "mem_a",
      tier_id: "tier_core",
      state: "ACTIVE",
      started_at: "2026-01-01T00:00:00.000Z",
      ended_at: null,
    });
    db.insert("memberships", {
      id: "mship_b",
      member_id: "mem_b",
      tier_id: "tier_core",
      state: "ACTIVE",
      started_at: "2026-01-01T00:00:00.000Z",
      ended_at: null,
    });
    db.insert("membership_tiers", {
      id: "tier_core",
      slug: "core",
      display_name: "Core",
      price_cents: 500,
      currency: "AUD",
    });
    db.insert("tier_capabilities", {
      tier_id: "tier_core",
      capability: "EVENTS",
      enabled: 1,
    });
    db.insert("service_grants", {
      id: "sg_a",
      member_id: "mem_a",
      service: "CALENDAR_MESSAGES",
      state: "OPTED_IN",
    });
    db.insert("service_grants", {
      id: "sg_b",
      member_id: "mem_b",
      service: "CALENDAR_MESSAGES",
      state: "AVAILABLE",
    });

    const event = await service.create({
      chapterId: "chap_melbourne",
      title: "An ordinary opening",
      eventType: "gallery",
      startAt: "2026-09-12T11:00:00.000Z",
      durationMinutes: 120,
      locationIds: ["loc_gertrude"],
      createdByActor: "operator_1",
    });
    expect(event.state).toBe("SCHEDULED");

    const queued = await service.queueInvitations(event.id);
    expect(queued).toBe(2);

    await service.cancel(event.id, "operator_1", "OK");
    const reloaded = await service.get(event.id);
    expect(reloaded?.state).toBe("ARCHIVED");

    // Calendar UID is stable.
    const cal1 = service.buildCalendarAttachment(reloaded!, "a@example.com", "A", "INVITATION");
    const cal2 = service.buildCalendarAttachment(reloaded!, "a@example.com", "A", "CANCELLATION");
    const uid1 = cal1.content.match(/UID:([^\r\n]+)/)?.[1];
    const uid2 = cal2.content.match(/UID:([^\r\n]+)/)?.[1];
    expect(uid1).toBeTruthy();
    expect(uid1).toBe(uid2);
  });

  it("rejects retired locations", async () => {
    const { db, service } = setup();
    setupChapterAndLocation(db);
    // Retire the location.
    db.insert("locations", {
      id: "loc_x",
      chapter_id: "chap_melbourne",
      name: "Old Place",
      suburb: null,
      address: null,
      source_url: null,
      location_type: "venue",
      tags_json: null,
      status: "RETIRED",
    });
    await expect(
      service.create({
        chapterId: "chap_melbourne",
        title: "Bad",
        eventType: "dinner",
        startAt: "2026-09-12T11:00:00.000Z",
        durationMinutes: 60,
        locationIds: ["loc_x"],
        createdByActor: "operator_1",
      }),
    ).rejects.toThrow(/retired/);
  });
});
