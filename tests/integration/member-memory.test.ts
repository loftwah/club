import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { MemberMemoryService } from "../../src/services/member-memory";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const service = new MemberMemoryService({
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
}

describe("MemberMemoryService", () => {
  it("proposes a candidate fact, then confirms it", async () => {
    const { db, service } = setup();
    setupMember(db);
    const candidate = await service.propose({
      memberId: "mem_1",
      category: "pet",
      subject: "Frank",
      value: "dog",
      sourceType: "INBOUND_EMAIL",
      sourceId: "inb_1",
    });
    expect(candidate.status).toBe("CANDIDATE");
    const confirmed = await service.confirm({ factId: candidate.id, reason: "OK" });
    expect(confirmed.status).toBe("CONFIRMED");
    const usable = await service.usableForMember("mem_1");
    expect(usable).toHaveLength(1);
  });

  it("revoked facts are not usable for correspondence", async () => {
    const { db, service } = setup();
    setupMember(db);
    const f = await service.propose({
      memberId: "mem_1",
      category: "employer",
      subject: "Acme",
      value: "Acme Pty",
      sourceType: "MEMBER_SELF",
      sourceId: null,
    });
    await service.confirm({ factId: f.id, reason: "OK" });
    await service.revoke({ factId: f.id, reason: "MEMBER_OPTED_OUT" });
    const usable = await service.usableForMember("mem_1");
    expect(usable).toHaveLength(0);
  });

  it("do_not_use flag excludes from usable", async () => {
    const { db, service } = setup();
    setupMember(db);
    const f = await service.propose({
      memberId: "mem_1",
      category: "interest",
      subject: "pottery",
      value: true,
      sourceType: "ONBOARDING",
      sourceId: null,
    });
    await service.confirm({ factId: f.id, reason: "OK" });
    await service.setDoNotUse(f.id, true, "MEMBER_OPTED_OUT");
    const usable = await service.usableForMember("mem_1");
    expect(usable).toHaveLength(0);
  });

  it("rejected fact is terminal", async () => {
    const { db, service } = setup();
    setupMember(db);
    const f = await service.propose({
      memberId: "mem_1",
      category: "pet",
      subject: "Frank",
      value: "dog",
      sourceType: "INBOUND_EMAIL",
      sourceId: null,
    });
    const r = await service.reject({ factId: f.id, reason: "MEMBER_OPTED_OUT" });
    expect(r.status).toBe("REJECTED");
  });
});
