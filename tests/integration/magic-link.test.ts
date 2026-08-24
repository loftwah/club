import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { MagicLinkService, MagicLinkError, safeInternalPath } from "../../src/services/magic-link";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const service = new MagicLinkService({
    db: db as unknown as D1Database,
    audit,
    clock,
    appBaseUrl: "https://club.loftwah.com",
    ttlMs: 15 * 60 * 1000,
  });
  return { db, clock, audit, service };
}

function addMember(db: MockD1Database) {
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

describe("MagicLinkService", () => {
  it("issues a token, then consumes it once", async () => {
    const { db, service } = setup();
    addMember(db);
    const issued = await service.request({ memberId: "mem_1", email: "a@example.com" });
    expect(issued.token).toBeTruthy();
    expect(issued.url).toContain("token=");
    const session = await service.consume(issued.token);
    expect(session.memberId).toBe("mem_1");
  });

  it("preserves only a safe internal continuation path", async () => {
    const { db, service } = setup();
    addMember(db);
    const issued = await service.request({
      memberId: "mem_1",
      email: "a@example.com",
      continuePath: "/admin/",
    });
    expect(new URL(issued.url).searchParams.get("next")).toBe("/admin/");
    const unsafe = await service.request({
      memberId: "mem_1",
      email: "a@example.com",
      continuePath: "https://evil.example/steal",
    });
    expect(new URL(unsafe.url).searchParams.get("next")).toBeNull();
    expect(safeInternalPath("//evil.example")).toBeNull();
    expect(safeInternalPath("/admin/?view=queue")).toBe("/admin/?view=queue");
  });

  it("rejects a second consumption (replay detection)", async () => {
    const { db, service } = setup();
    addMember(db);
    const issued = await service.request({ memberId: "mem_1", email: "a@example.com" });
    await service.consume(issued.token);
    let captured: MagicLinkError | null = null;
    try {
      await service.consume(issued.token);
    } catch (err) {
      captured = err as MagicLinkError;
    }
    expect(captured).toBeInstanceOf(MagicLinkError);
    expect(captured?.code).toBe("ALREADY_CONSUMED");
  });

  it("rejects a token that is too old (expiry)", async () => {
    const { db, service, clock } = setup();
    addMember(db);
    const issued = await service.request({ memberId: "mem_1", email: "a@example.com" });
    // Advance the clock past the TTL.
    (clock as FixedClock).set(new Date(clock.now().getTime() + 20 * 60 * 1000).toISOString());
    await expect(service.consume(issued.token)).rejects.toBeInstanceOf(MagicLinkError);
    try {
      await service.consume(issued.token);
    } catch (err) {
      expect((err as MagicLinkError).code).toBe("EXPIRED");
    }
  });

  it("rejects an unknown token", async () => {
    const { service } = setup();
    await expect(service.consume("not-a-real-token")).rejects.toBeInstanceOf(MagicLinkError);
  });

  it("rejects an unknown member id", async () => {
    const { service } = setup();
    await expect(
      service.request({ memberId: "mem_unknown", email: "x@example.com" }),
    ).rejects.toThrow(/Unknown member/);
  });

  it("revokes a session and refuses subsequent verification", async () => {
    const { db, service } = setup();
    addMember(db);
    const issued = await service.request({ memberId: "mem_1", email: "a@example.com" });
    const session = await service.consume(issued.token);
    await service.revokeSession(session.id, "MEMBER_LOGOUT");
    await expect(service.verifySession(session.id)).rejects.toBeInstanceOf(MagicLinkError);
  });

  it("revokeAllForMember revokes every active session for the member", async () => {
    const { db, service } = setup();
    addMember(db);
    const s1 = await service.issueSession("mem_1");
    const s2 = await service.issueSession("mem_1");
    const n = await service.revokeAllForMember("mem_1", "RESET");
    expect(n).toBe(2);
    await expect(service.verifySession(s1.id)).rejects.toBeInstanceOf(MagicLinkError);
    await expect(service.verifySession(s2.id)).rejects.toBeInstanceOf(MagicLinkError);
  });
});
