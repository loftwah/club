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

  it("persists interested_tier (Member) when supplied", async () => {
    const { service, db } = makeDeps();
    const entry = await service.submit({
      email: "tier-member@example.com",
      interestedTier: "Member",
    });
    expect(entry.state).toBe("ACTIVE_WAITLIST");
    const stored = db.all("waitlist_entries");
    expect(stored.length).toBe(1);
    expect(stored[0]!.interested_tier).toBe("Member");
  });

  it("persists interested_tier (Corresponding Member) when supplied", async () => {
    const { service, db } = makeDeps();
    await service.submit({
      email: "tier-corresponding@example.com",
      interestedTier: "Corresponding Member",
    });
    const stored = db.all("waitlist_entries");
    expect(stored[0]!.interested_tier).toBe("Corresponding Member");
  });

  it("persists interested_tier (Deluxe Member) when supplied", async () => {
    const { service, db } = makeDeps();
    await service.submit({
      email: "tier-deluxe@example.com",
      interestedTier: "Deluxe Member",
    });
    const stored = db.all("waitlist_entries");
    expect(stored[0]!.interested_tier).toBe("Deluxe Member");
  });

  it("leaves interested_tier null when not supplied", async () => {
    const { service, db } = makeDeps();
    await service.submit({ email: "no-tier@example.com" });
    const stored = db.all("waitlist_entries");
    expect(stored[0]!.interested_tier).toBeNull();
  });

  it("rejects an unknown interested_tier value (zod validation)", async () => {
    const { service } = makeDeps();
    await expect(
      service.submit({
        email: "bad-tier@example.com",
        // Cast to bypass TS so we can prove runtime validation
        interestedTier: "Imaginary Tier" as unknown as "Member",
      }),
    ).rejects.toThrow();
  });

  it("welcome email acknowledges the chosen tier (and does not imply payment)", async () => {
    const { service, resend } = makeDeps();
    await service.submit({
      email: "tier-ack@example.com",
      interestedTier: "Corresponding Member",
    });
    expect(resend.sent.length).toBe(1);
    const mail = resend.sent[0]!;
    expect(mail.subject).toContain("Plans With You");
    // The subject must not assert activation, payment, or subscription.
    expect(mail.subject).not.toMatch(/paid|active|subscript|receipt|invoice/i);
    const body = `${mail.html ?? ""} ${mail.text ?? ""}`;
    expect(body).toContain("Corresponding Member");
    // The email must not claim the tier membership is active or that
    // a subscription exists. The safe phrasing "Nothing has been charged"
    // is allowed (and asserted below).
    expect(body).not.toMatch(/your corresponding member account is active/i);
    expect(body).not.toMatch(/subscription (started|active|created)/i);
    expect(body).not.toMatch(/payment (was )?(taken|received|processed)/i);
    expect(body).toMatch(/nothing has been charged/i);
  });
});
