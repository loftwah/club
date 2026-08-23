// Agent lease primitive.
//
// Local or hosted agents that work on AI_AGENT_WORK jobs must claim a lease
// before they begin. If the agent disappears, the lease expires and the job
// becomes AVAILABLE again. After a configurable number of failed claims the
// job escalates to NEEDS_OPERATOR.
//
// See MASTER_SPEC §8.25 and docs/13_TEST_PLAN.md §14.24.

import type { D1Database } from "@cloudflare/workers-types";
import { newLeaseId } from "./ids.js";
import type { Clock } from "./clock.js";

export interface AgentLease {
  readonly id: string;
  readonly jobId: string;
  readonly agentId: string;
  readonly claimedAt: string;
  readonly claimedUntil: string;
  readonly attempt: number;
  readonly state: "ACTIVE" | "RELEASED" | "EXPIRED";
}

export interface AgentLeaseManager {
  claim(input: { jobId: string; agentId: string; leaseMs: number; attempt: number }): Promise<{
    lease: AgentLease;
    duplicate: boolean;
  }>;
  release(leaseId: string): Promise<void>;
  /** Mark a lease expired (called by reap). */
  expire(leaseId: string): Promise<void>;
  reap(now: string): Promise<number>;
  listExpiredForJob(jobId: string): Promise<AgentLease[]>;
}

export class D1AgentLeaseManager implements AgentLeaseManager {
  constructor(
    private readonly db: D1Database,
    private readonly clock: Clock,
  ) {}

  async claim(input: {
    jobId: string;
    agentId: string;
    leaseMs: number;
    attempt: number;
  }): Promise<{ lease: AgentLease; duplicate: boolean }> {
    const now = this.clock.now();
    const claimedUntil = new Date(now.getTime() + input.leaseMs).toISOString();

    // If there is already an active lease for this job, return it.
    const existing = await this.db
      .prepare(
        `SELECT id, job_id, agent_id, claimed_at, claimed_until, attempt, state
         FROM agent_leases
         WHERE job_id = ? AND state = 'ACTIVE'
         ORDER BY claimed_at DESC
         LIMIT 1`,
      )
      .bind(input.jobId)
      .first<{
        id: string;
        job_id: string;
        agent_id: string;
        claimed_at: string;
        claimed_until: string;
        attempt: number;
        state: "ACTIVE" | "RELEASED" | "EXPIRED";
      }>();

    if (existing && new Date(existing.claimed_until) > now) {
      return {
        lease: rowToLease(existing),
        duplicate: true,
      };
    }

    if (existing) {
      // Existing lease has expired but is still flagged ACTIVE — expire it
      // before issuing a new one.
      await this.db
        .prepare(`UPDATE agent_leases SET state = 'EXPIRED' WHERE id = ?`)
        .bind(existing.id)
        .run();
    }

    const id = newLeaseId();
    await this.db
      .prepare(
        `INSERT INTO agent_leases (id, job_id, agent_id, claimed_at, claimed_until, attempt, state)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      )
      .bind(id, input.jobId, input.agentId, now.toISOString(), claimedUntil, input.attempt)
      .run();
    return {
      lease: {
        id,
        jobId: input.jobId,
        agentId: input.agentId,
        claimedAt: now.toISOString(),
        claimedUntil,
        attempt: input.attempt,
        state: "ACTIVE",
      },
      duplicate: false,
    };
  }

  async release(leaseId: string): Promise<void> {
    await this.db
      .prepare(`UPDATE agent_leases SET state = 'RELEASED' WHERE id = ?`)
      .bind(leaseId)
      .run();
  }

  async expire(leaseId: string): Promise<void> {
    await this.db
      .prepare(`UPDATE agent_leases SET state = 'EXPIRED' WHERE id = ?`)
      .bind(leaseId)
      .run();
  }

  async reap(now: string): Promise<number> {
    const result = await this.db
      .prepare(
        `UPDATE agent_leases
         SET state = 'EXPIRED'
         WHERE state = 'ACTIVE' AND claimed_until <= ?`,
      )
      .bind(now)
      .run();
    return result.meta.changes ?? 0;
  }

  async listExpiredForJob(jobId: string): Promise<AgentLease[]> {
    const rows = await this.db
      .prepare(
        `SELECT id, job_id, agent_id, claimed_at, claimed_until, attempt, state
         FROM agent_leases
         WHERE job_id = ? AND state = 'EXPIRED'
         ORDER BY claimed_at ASC`,
      )
      .bind(jobId)
      .all();
    return (rows.results ?? []).map((r) => rowToLease(r as Record<string, unknown>));
  }
}

function rowToLease(r: Record<string, unknown>): AgentLease {
  return {
    id: r.id as string,
    jobId: r.job_id as string,
    agentId: r.agent_id as string,
    claimedAt: r.claimed_at as string,
    claimedUntil: r.claimed_until as string,
    attempt: (r.attempt as number) ?? 1,
    state: r.state as AgentLease["state"],
  };
}

interface MutableAgentLease {
  id: string;
  jobId: string;
  agentId: string;
  claimedAt: string;
  claimedUntil: string;
  attempt: number;
  state: AgentLease["state"];
}

export class InMemoryAgentLeaseManager implements AgentLeaseManager {
  private readonly leases = new Map<string, MutableAgentLease>();

  constructor(private readonly clock: Clock) {}

  async claim(input: {
    jobId: string;
    agentId: string;
    leaseMs: number;
    attempt: number;
  }): Promise<{ lease: AgentLease; duplicate: boolean }> {
    const now = this.clock.now();
    const claimedUntil = new Date(now.getTime() + input.leaseMs).toISOString();

    const active = [...this.leases.values()].find(
      (l) => l.jobId === input.jobId && l.state === "ACTIVE",
    );
    if (active && new Date(active.claimedUntil) > now) {
      return { lease: { ...active }, duplicate: true };
    }
    if (active) {
      active.state = "EXPIRED";
    }

    const id = newLeaseId();
    const lease: MutableAgentLease = {
      id,
      jobId: input.jobId,
      agentId: input.agentId,
      claimedAt: now.toISOString(),
      claimedUntil,
      attempt: input.attempt,
      state: "ACTIVE",
    };
    this.leases.set(id, lease);
    return { lease: { ...lease }, duplicate: false };
  }

  async release(leaseId: string): Promise<void> {
    const l = this.leases.get(leaseId);
    if (l) l.state = "RELEASED";
  }

  async expire(leaseId: string): Promise<void> {
    const l = this.leases.get(leaseId);
    if (l) l.state = "EXPIRED";
  }

  async reap(now: string): Promise<number> {
    const cutoff = new Date(now);
    let n = 0;
    for (const l of this.leases.values()) {
      if (l.state === "ACTIVE" && new Date(l.claimedUntil) <= cutoff) {
        l.state = "EXPIRED";
        n++;
      }
    }
    return n;
  }

  async listExpiredForJob(jobId: string): Promise<AgentLease[]> {
    return [...this.leases.values()]
      .filter((l) => l.jobId === jobId && l.state === "EXPIRED")
      .map((l) => ({ ...l }));
  }
}
