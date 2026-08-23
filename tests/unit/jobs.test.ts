import { describe, expect, it } from "vitest";
import { FixedClock } from "@infra/clock";
import { InMemoryJobQueue } from "@infra/jobs";
import { newJobId } from "@infra/ids";

describe("in-memory job queue", () => {
  it("enqueue and claim produce exactly one claim per job", async () => {
    const clock = FixedClock.at("2026-08-23T00:00:00Z");
    const q = new InMemoryJobQueue(clock);
    const enq = await q.enqueue({
      type: "TEST",
      payload: { hello: "world" },
      idempotencyKey: "test:1",
    });
    const claim = await q.claim("agent_a", 30_000);
    expect(claim).not.toBeNull();
    expect(claim!.job.id).toBe(enq.id);
    // A second claim while the lease is active must not return the same job.
    const second = await q.claim("agent_b", 30_000);
    expect(second).toBeNull();
  });

  it("expired lease makes the job AVAILABLE again (lease expiry path)", async () => {
    const clock = FixedClock.at("2026-08-23T00:00:00Z");
    const q = new InMemoryJobQueue(clock);
    await q.enqueue({
      type: "TEST",
      payload: {},
      idempotencyKey: "test:2",
    });
    const first = await q.claim("agent_a", 30_000);
    expect(first).not.toBeNull();
    // Advance the clock past the lease.
    clock.advanceMs(31_000);
    const reaped = await q.reapExpired(clock.nowIso());
    expect(reaped).toBe(1);
    const second = await q.claim("agent_b", 30_000);
    expect(second).not.toBeNull();
    expect(second!.job.id).toBe(first!.job.id);
  });

  it("failed claim re-queues with backoff up to maxAttempts → DEAD_LETTER", async () => {
    const clock = FixedClock.at("2026-08-23T00:00:00Z");
    const q = new InMemoryJobQueue(clock);
    const enq = await q.enqueue({
      type: "TEST",
      payload: {},
      idempotencyKey: "test:3",
      maxAttempts: 3,
    });
    // Attempt 1.
    let claim = await q.claim("agent_a", 30_000);
    expect(claim).not.toBeNull();
    await claim!.fail("boom");
    // Backoff after attempt 1 = 2^1 * 1000 = 2000ms. Advance past it.
    clock.advanceMs(3_000);
    // Attempt 2.
    claim = await q.claim("agent_a", 30_000);
    expect(claim).not.toBeNull();
    await claim!.fail("boom");
    // Backoff after attempt 2 = 2^2 * 1000 = 4000ms. Advance past it.
    clock.advanceMs(5_000);
    // Attempt 3 — should land in DEAD_LETTER (attempt 3 == maxAttempts).
    claim = await q.claim("agent_a", 30_000);
    expect(claim).not.toBeNull();
    await claim!.fail("still broken");
    const dead = await q.listDeadLetters();
    expect(dead.some((j) => j.id === enq.id)).toBe(true);
  });
});

describe("ids", () => {
  it("newJobId returns unique ids", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(newJobId());
    expect(ids.size).toBe(1000);
  });
});
