// Integration test for the waitlist service: it runs against the MockD1
// with the real schema loaded, the fake Resend, and the in-memory audit
// writer. It exercises the full happy path, the transient-failure retry,
// and the permanent-failure path.

import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { FixedClock } from "@infra/clock";
import { InMemoryAuditWriter } from "@infra/audit";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FakeResend } from "@adapters/resend-fake";
import { WaitlistService } from "@services/waitlist";

function makeDeps() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-23T00:00:00Z");
  const resend = new FakeResend();
  const audit = new InMemoryAuditWriter();
  const service = new WaitlistService({
    db: db as unknown as D1Database,
    resend,
    audit,
    clock,
    appBaseUrl: "https://club.loftwah.com",
    fromAddress: "club@loftwah.com",
  });
  return { db, clock, resend, audit, service };
}

describe("waitlist integration", () => {
  it("happy path: submit → welcome queued → delivered → ACTIVE_WAITLIST", async () => {
    const { service, resend, db } = makeDeps();
    const entry = await service.submit({ email: "Member@example.com" });
    expect(entry.state).toBe("ACTIVE_WAITLIST");
    expect(resend.sent.length).toBe(1);
    expect(resend.sent[0]!.to).toBe("member@example.com"); // lowercased
    const stored = db.all("waitlist_entries");
    expect(stored.length).toBe(1);
    expect(stored[0]!.state).toBe("ACTIVE_WAITLIST");
  });

  it("duplicate email is handled deterministically: returns existing row", async () => {
    const { service, resend } = makeDeps();
    const first = await service.submit({ email: "dup@example.com" });
    const second = await service.submit({ email: "dup@example.com" });
    expect(first.id).toBe(second.id);
    expect(resend.sent.length).toBe(1);
  });

  it("transient send failure: WELCOME_QUEUED → RETRY", async () => {
    const { service, resend, db } = makeDeps();
    resend.failNext("TRANSIENT");
    const entry = await service.submit({ email: "retry@example.com" });
    expect(entry.state).toBe("RETRY");
    const stored = db.all("waitlist_entries");
    expect(stored[0]!.state).toBe("RETRY");
  });

  it("hard bounce: WELCOME_QUEUED → INVALID_EMAIL (terminal)", async () => {
    const { service, resend, db } = makeDeps();
    resend.failNext("PERMANENT");
    const entry = await service.submit({ email: "bounce@example.com" });
    expect(entry.state).toBe("INVALID_EMAIL");
    const stored = db.all("waitlist_entries");
    expect(stored[0]!.state).toBe("INVALID_EMAIL");
  });

  it("rejects an invalid email (zod validation)", async () => {
    const { service } = makeDeps();
    await expect(service.submit({ email: "not-an-email" })).rejects.toThrow();
  });
});
