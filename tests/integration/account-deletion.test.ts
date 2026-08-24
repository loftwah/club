import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { AccountDeletionError, AccountDeletionService } from "../../src/services/account-deletion";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-24T06:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  db.insert("members", { id: "mem_alice", email: "alice@example.com" });
  db.insert("members", { id: "mem_bob", email: "bob@example.com" });
  const service = new AccountDeletionService({
    db: db as unknown as D1Database,
    audit,
    clock,
  });
  return { db, clock, audit, service };
}

describe("account deletion confirmation", () => {
  it("stores only a hash and requires the owning member", async () => {
    const { db, service } = setup();
    const confirmation = await service.begin("mem_alice");
    const row = db.all("deletion_requests")[0];
    expect(row?.confirm_token_hash).toBeTruthy();
    expect(row?.confirm_token_hash).not.toBe(confirmation.token);
    await expect(
      service.inspect("mem_bob", confirmation.requestId, confirmation.token),
    ).rejects.toMatchObject({ code: "NOT_OWNER" });
    await expect(
      service.inspect("mem_alice", confirmation.requestId, "wrong-token"),
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" });
    await expect(
      service.inspect("mem_alice", confirmation.requestId, confirmation.token),
    ).resolves.toEqual({ state: "PENDING_CONFIRM" });
  });

  it("expires and cancels confirmation when email delivery fails", async () => {
    const { db, clock, service } = setup();
    const first = await service.begin("mem_alice");
    clock.advanceMs(31 * 60 * 1000);
    await expect(service.inspect("mem_alice", first.requestId, first.token)).rejects.toBeInstanceOf(
      AccountDeletionError,
    );

    const second = await service.begin("mem_alice");
    await service.markConfirmationDeliveryFailed("mem_alice", second.requestId, "EMAIL_FAILED");
    const row = db.all("deletion_requests").find((candidate) => candidate.id === second.requestId);
    expect(row?.state).toBe("CANCELLED");
    expect(row?.confirm_token_hash).toBeFalsy();
  });

  it("removes service grants before reaching terminal deletion", async () => {
    const { db, service } = setup();
    db.insert("service_grants", {
      id: "grant_alice_gifts",
      member_id: "mem_alice",
      service: "GIFTS",
      state: "OPTED_IN",
      updated_at: "2026-08-24T06:00:00.000Z",
    });
    const confirmation = await service.begin("mem_alice");

    await service.confirmAndDelete("mem_alice", confirmation.requestId, confirmation.token);

    expect(db.all("service_grants").filter((row) => row.member_id === "mem_alice")).toEqual([]);
    expect(
      db.all("deletion_requests").find((row) => row.id === confirmation.requestId)?.state,
    ).toBe("DELETED");
  });
});
