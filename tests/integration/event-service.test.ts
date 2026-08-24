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

function seedPolicyTruth(db: MockD1Database, memberId: string, tierId: string): void {
  for (const [id, docType] of [
    ["doc_terms", "TERMS"],
    ["doc_privacy", "PRIVACY_POLICY"],
    ["doc_theatrical", "THEATRICAL_EXPERIENCE_ACKNOWLEDGEMENT"],
  ]) {
    if (!db.all("legal_documents").some((row) => row.id === id)) {
      db.insert("legal_documents", {
        id,
        doc_type: docType,
        version: "1.0.0",
        effective_at: "2026-01-01T00:00:00.000Z",
        content_hash: `hash_${id}`,
        body: null,
      });
    }
    db.insert("member_acceptances", {
      id: `acc_${memberId}_${id}`,
      member_id: memberId,
      document_id: id,
      accepted_at: "2026-01-01T00:00:00.000Z",
      method: "WEB",
    });
  }
  db.insert("subscriptions", {
    id: `sub_${memberId}`,
    member_id: memberId,
    provider: "fake",
    provider_customer_id: `cus_${memberId}`,
    provider_subscription_id: `provider_sub_${memberId}`,
    tier_id: tierId,
    status: "ACTIVE",
    current_period_end: null,
  });
  db.insert("billing_customers", {
    id: `bc_${memberId}`,
    member_id: memberId,
    provider: "fake",
    provider_customer_id: `cus_${memberId}`,
  });
}

describe("EventService — ordinary event lifecycle", () => {
  it("creates an event, queues invitations, cancels it, and produces a stable calendar UID", async () => {
    const { db, service } = setup();
    setupChapterAndLocation(db);
    // Two complete members and one ACTIVE-looking row with no policy truth.
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
    db.insert("members", {
      id: "mem_incomplete",
      email: "incomplete@example.com",
      preferred_name: "Incomplete",
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
    db.insert("memberships", {
      id: "mship_incomplete",
      member_id: "mem_incomplete",
      tier_id: "tier_core",
      state: "ACTIVE",
      started_at: "2026-01-01T00:00:00.000Z",
      ended_at: null,
    });
    db.insert("membership_tiers", {
      id: "tier_core",
      slug: "core",
      display_name: "Member",
      price_cents: 500,
      currency: "AUD",
    });
    seedPolicyTruth(db, "mem_a", "tier_core");
    seedPolicyTruth(db, "mem_b", "tier_core");
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
    const invitations = db.all("event_invitations");
    expect(invitations.map((row) => row.member_id)).toEqual(["mem_a", "mem_b"]);

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
