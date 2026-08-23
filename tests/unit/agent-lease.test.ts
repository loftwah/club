// Test 14.24 — Agent lease expiry.
//
// Scenario A: agent A claims with a 30s lease, disappears, lease expires,
//   second agent B claims, business effect occurs exactly once.
// Scenario B: repeated claim/lease failure → operator escalation.
// Scenario C: normal completion under valid lease.

import { describe, expect, it } from "vitest";
import { FixedClock } from "@infra/clock";
import { InMemoryAgentLeaseManager } from "@infra/agent-lease";
import { InMemoryJobQueue } from "@infra/jobs";
import { InMemoryIdempotencyStore } from "@infra/idempotency";

describe("agent lease expiry (Test 14.24 Scenario A)", () => {
  it("disappearing agent → lease expires → second agent claims → exactly-once effect", async () => {
    const clock = FixedClock.at("2026-08-23T00:00:00Z");
    const leases = new InMemoryAgentLeaseManager(clock);
    const jobs = new InMemoryJobQueue(clock);
    const idempotency = new InMemoryIdempotencyStore();

    const job = await jobs.enqueue({
      type: "AI_AGENT_WORK",
      payload: { work: "chapter-research" },
      idempotencyKey: "aiwork:chapter-1",
      maxAttempts: 3,
    });

    // First claim.
    const first = await leases.claim({
      jobId: job.id,
      agentId: "agent_a",
      leaseMs: 30_000,
      attempt: 1,
    });
    expect(first.duplicate).toBe(false);
    expect(first.lease.state).toBe("ACTIVE");
    // Business effect not applied yet.
    expect(
      (await idempotency.claim({ key: "aiwork:chapter-1", scope: "ai", jobId: job.id })).status,
    ).toBe("claimed");
    await idempotency.release({ key: "aiwork:chapter-1", scope: "ai" });

    // Agent A disappears. Advance the clock past the lease.
    clock.advanceMs(31_000);
    const reaped = await leases.reap(clock.nowIso());
    expect(reaped).toBe(1);

    // The lease is now EXPIRED. A second claim for the same job must succeed
    // and produce a new lease.
    const second = await leases.claim({
      jobId: job.id,
      agentId: "agent_b",
      leaseMs: 30_000,
      attempt: 2,
    });
    expect(second.duplicate).toBe(false);
    expect(second.lease.attempt).toBe(2);

    // Agent B applies the business effect. The idempotency key guarantees
    // exactly-once.
    const claim = await idempotency.claim({
      key: "aiwork:chapter-1",
      scope: "ai",
      jobId: job.id,
    });
    expect(claim.status).toBe("claimed");
    await idempotency.record({
      key: "aiwork:chapter-1",
      scope: "ai",
      jobId: job.id,
      result: { completed: true },
    });

    // A third claim, even after a successful effect, must see the effect
    // already applied.
    clock.advanceMs(31_000);
    await leases.reap(clock.nowIso());
    const third = await leases.claim({
      jobId: job.id,
      agentId: "agent_c",
      leaseMs: 30_000,
      attempt: 3,
    });
    const claimAgain = await idempotency.claim({
      key: "aiwork:chapter-1",
      scope: "ai",
      jobId: job.id,
    });
    // The duplicate detection should fire on the second attempt at the
    // idempotency layer (after we re-record or re-claim the same key).
    if (claimAgain.status === "duplicate") {
      expect(claimAgain.record.result).toEqual({ completed: true });
    } else {
      // If for some reason the key was released, the agent must not produce
      // a second effect: this test asserts the lease/exactly-once chain.
      throw new Error("expected duplicate detection on second effect");
    }
    void third;
  });
});

describe("agent lease expiry (Test 14.24 Scenario B)", () => {
  it("repeated claim/lease failure escalates beyond threshold", async () => {
    const clock = FixedClock.at("2026-08-23T00:00:00Z");
    const leases = new InMemoryAgentLeaseManager(clock);
    const jobs = new InMemoryJobQueue(clock);
    const idempotency = new InMemoryIdempotencyStore();

    const job = await jobs.enqueue({
      type: "AI_AGENT_WORK",
      payload: { work: "stuck-job" },
      idempotencyKey: "aiwork:stuck-1",
      maxAttempts: 3,
    });

    // Threshold = maxAttempts. Each attempt: claim with lease, then the
    // agent disappears, then we mark the job failed. After maxAttempts
    // failed attempts the job should be in DEAD_LETTER.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const claim = await leases.claim({
        jobId: job.id,
        agentId: `agent_${attempt}`,
        leaseMs: 30_000,
        attempt,
      });
      expect(claim.duplicate).toBe(false);
      // Advance the clock past the backoff so the next claim can proceed.
      clock.advanceMs(2 ** attempt * 1000 + 31_000);
      // Reap the lease (the agent is gone).
      const reaped = await leases.reap(clock.nowIso());
      expect(reaped).toBe(1);
      // The job queue's reap_expired makes it AVAILABLE again.
      await jobs.reapExpired(clock.nowIso());
      // Re-claim the job from the queue and mark it failed.
      const jClaim = await jobs.claim(`agent_${attempt}`, 30_000);
      expect(jClaim).not.toBeNull();
      await jClaim!.fail("agent disappeared");
      // The lease we held for this attempt is no longer "active" in the
      // eyes of the lease manager once it is reaped; for a subsequent
      // claim by a fresh agent, the manager creates a new lease.
      void idempotency;
    }

    // After maxAttempts failures, the job should be in DEAD_LETTER.
    const dead = await jobs.listDeadLetters();
    expect(dead.some((j) => j.id === job.id)).toBe(true);
    // The number of expired leases for this job equals the number of
    // attempts — every one of them reaped cleanly.
    const expired = await leases.listExpiredForJob(job.id);
    expect(expired.length).toBe(3);
  });
});

describe("agent lease expiry (Test 14.24 Scenario C)", () => {
  it("normal completion under valid lease does not produce a re-claim", async () => {
    const clock = FixedClock.at("2026-08-23T00:00:00Z");
    const leases = new InMemoryAgentLeaseManager(clock);
    const jobs = new InMemoryJobQueue(clock);
    const idempotency = new InMemoryIdempotencyStore();

    const job = await jobs.enqueue({
      type: "AI_AGENT_WORK",
      payload: { work: "normal-job" },
      idempotencyKey: "aiwork:normal-1",
    });
    const claim = await leases.claim({
      jobId: job.id,
      agentId: "agent_x",
      leaseMs: 30_000,
      attempt: 1,
    });
    expect(claim.lease.state).toBe("ACTIVE");

    // Apply the effect and release the lease.
    await idempotency.claim({ key: "aiwork:normal-1", scope: "ai", jobId: job.id });
    await idempotency.record({
      key: "aiwork:normal-1",
      scope: "ai",
      jobId: job.id,
      result: { done: true },
    });
    await leases.release(claim.lease.id);

    // A second claim attempt for the same job would see the lease is no
    // longer ACTIVE. Since the effect is already applied, a new attempt
    // must hit the idempotency duplicate check.
    const second = await leases.claim({
      jobId: job.id,
      agentId: "agent_y",
      leaseMs: 30_000,
      attempt: 2,
    });
    expect(second.duplicate).toBe(false); // Lease is RELEASED, not ACTIVE
    const dup = await idempotency.claim({
      key: "aiwork:normal-1",
      scope: "ai",
      jobId: job.id,
    });
    expect(dup.status).toBe("duplicate");
  });
});
