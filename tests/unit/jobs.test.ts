import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { FixedClock } from "@infra/clock";
import { D1JobQueue, InMemoryJobQueue, JobLeaseLostError } from "@infra/jobs";
import { newJobId } from "@infra/ids";

type FakeJobRow = Record<string, unknown>;

/** Small D1 surface for enqueue tests, including the unique-key race. */
class FakeJobD1 {
  readonly rows: FakeJobRow[] = [];

  prepare(sql: string) {
    const values: unknown[] = [];
    return {
      bind: (...binds: unknown[]) => {
        values.splice(0, values.length, ...binds);
        return this.prepareBound(sql, values);
      },
    };
  }

  private prepareBound(sql: string, values: unknown[]) {
    return {
      first: async <T>() => {
        if (/WHERE idempotency_key = \?/i.test(sql)) {
          return (this.rows.find((row) => row.idempotency_key === values[0]) ?? null) as T | null;
        }
        if (/WHERE id = \?/i.test(sql)) {
          return (this.rows.find((row) => row.id === values[0]) ?? null) as T | null;
        }
        throw new Error(`Unsupported fake SELECT: ${sql}`);
      },
      run: async () => {
        if (!/^INSERT INTO jobs/i.test(sql)) throw new Error(`Unsupported fake mutation: ${sql}`);
        const idempotencyKey = values[7] ?? null;
        if (
          idempotencyKey !== null &&
          this.rows.some((row) => row.idempotency_key === idempotencyKey)
        ) {
          throw new Error("UNIQUE constraint failed: jobs.idempotency_key");
        }
        this.rows.push({
          id: values[0],
          type: values[1],
          entity_type: values[2],
          entity_id: values[3],
          payload_version: "1",
          priority: values[4],
          attempt: 0,
          max_attempts: values[5],
          available_at: values[6],
          state: "AVAILABLE",
          idempotency_key: idempotencyKey,
          correlation_id: values[8],
          payload_json: values[9],
          result_json: null,
          created_at: values[10],
          completed_at: null,
        });
        return { meta: { changes: 1 } };
      },
    };
  }
}

describe("in-memory job queue", () => {
  it("retries with a key return the existing job and result", async () => {
    const clock = FixedClock.at("2026-08-23T00:00:00Z");
    const q = new InMemoryJobQueue(clock);
    const first = await q.enqueue({
      type: "TEST",
      payload: { first: true },
      idempotencyKey: "retry:1",
    });
    const claim = await q.claim("agent", 30_000);
    await claim!.complete({ ok: true });

    const retry = await q.enqueue({
      type: "TEST",
      payload: { second: true },
      idempotencyKey: "retry:1",
    });
    expect(retry.id).toBe(first.id);
    expect(retry.result).toEqual({ ok: true });
  });

  it("null keys deliberately allow distinct jobs", async () => {
    const clock = FixedClock.at("2026-08-23T00:00:00Z");
    const q = new InMemoryJobQueue(clock);
    const first = await q.enqueue({ type: "TEST", payload: {}, idempotencyKey: null });
    const second = await q.enqueue({ type: "TEST", payload: {}, idempotencyKey: null });
    expect(second.id).not.toBe(first.id);
  });

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
    await expect(first!.complete({ stale: true })).rejects.toBeInstanceOf(JobLeaseLostError);
    await second!.complete({ owner: "agent_b" });
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

describe("D1 job queue idempotency", () => {
  it("returns the existing job on retry and on a competing insert", async () => {
    const clock = FixedClock.at("2026-08-23T00:00:00Z");
    const db = new FakeJobD1();
    const q = new D1JobQueue(db as unknown as D1Database, clock);

    const first = await q.enqueue({
      type: "TEST",
      payload: { first: true },
      idempotencyKey: "d1-retry:1",
    });
    db.rows[0]!.result_json = JSON.stringify({ completed: true });
    db.rows[0]!.state = "COMPLETED";
    const retry = await q.enqueue({
      type: "TEST",
      payload: { second: true },
      idempotencyKey: "d1-retry:1",
    });
    expect(retry.id).toBe(first.id);
    expect(retry.result).toEqual({ completed: true });

    // Both calls read before either caller can rely on its own response; the
    // unique constraint on the insert is resolved by returning the winner.
    const raced = await Promise.all(
      ["a", "b"].map((suffix) =>
        q.enqueue({ type: "RACE", payload: { suffix }, idempotencyKey: "d1-race:1" }),
      ),
    );
    expect(raced).toHaveLength(2);
    expect(raced[0]!.id).toBe(raced[1]!.id);
    expect(db.rows.filter((row) => row.idempotency_key === "d1-race:1")).toHaveLength(1);
  });

  it("keeps null-key jobs independent", async () => {
    const clock = FixedClock.at("2026-08-23T00:00:00Z");
    const db = new FakeJobD1();
    const q = new D1JobQueue(db as unknown as D1Database, clock);
    const first = await q.enqueue({ type: "TEST", payload: {}, idempotencyKey: null });
    const second = await q.enqueue({ type: "TEST", payload: {}, idempotencyKey: null });
    expect(second.id).not.toBe(first.id);
    expect(db.rows.filter((row) => row.idempotency_key === null)).toHaveLength(2);
  });
});

describe("ids", () => {
  it("newJobId returns unique ids", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(newJobId());
    expect(ids.size).toBe(1000);
  });
});
