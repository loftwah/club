// Job infrastructure.
//
// Jobs are durable work units enqueued by Cron and other systems. Each
// job has a type, an idempotency key, a priority, and a claim/lease window.
// Idempotency is enforced at the consumer layer via the IdempotencyStore.
//
// See MASTER_SPEC §5.9, §6.7, §8.5.

import type { D1Database } from "@cloudflare/workers-types";
import type { Clock } from "./clock.js";
import { newJobId } from "./ids.js";

export type JobState = "AVAILABLE" | "CLAIMED" | "RUNNING" | "COMPLETED" | "FAILED" | "DEAD_LETTER";

export interface JobRecord {
  readonly id: string;
  readonly type: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly payload: unknown;
  readonly priority: number;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly availableAt: string;
  readonly claimedUntil: string | null;
  readonly claimedBy: string | null;
  readonly state: JobState;
  readonly failureReason: string | null;
  readonly idempotencyKey: string | null;
  readonly correlationId: string | null;
  /** The durable result, when a completed job has one. */
  readonly result: unknown;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface EnqueueJobInput {
  type: string;
  entityType?: string;
  entityId?: string;
  payload: unknown;
  /** Null/omitted keys intentionally opt out of deduplication. */
  idempotencyKey?: string | null;
  priority?: number;
  availableAt?: string;
  correlationId?: string;
  maxAttempts?: number;
}

export interface ClaimedJob {
  readonly job: JobRecord;
  /** Mark the job COMPLETED. The lease is released implicitly. */
  complete(result: unknown): Promise<void>;
  /** Mark the job FAILED. If attempt < maxAttempts, the job becomes AVAILABLE again after a backoff. Otherwise DEAD_LETTER. */
  fail(reason: string): Promise<void>;
}

export interface JobQueue {
  enqueue(input: EnqueueJobInput): Promise<JobRecord>;
  /** Claim one available job for the given agent. */
  claim(agentId: string, leaseMs: number): Promise<ClaimedJob | null>;
  /** Reap all jobs whose lease expired. They become AVAILABLE again. */
  reapExpired(now: string): Promise<number>;
  /** Jobs whose attempts are exhausted. */
  listDeadLetters(): Promise<JobRecord[]>;
}

export class JobLeaseLostError extends Error {
  constructor(readonly jobId: string) {
    super(`Job lease is no longer owned for ${jobId}.`);
    this.name = "JobLeaseLostError";
  }
}

export class D1JobQueue implements JobQueue {
  constructor(
    private readonly db: D1Database,
    private readonly clock: Clock,
  ) {}

  async enqueue(input: EnqueueJobInput): Promise<JobRecord> {
    const id = newJobId();
    const now = this.clock.nowIso();
    const idempotencyKey = input.idempotencyKey ?? null;

    // The read makes the common retry path cheap. The insert remains the
    // authority: two callers can race between this read and the insert, so
    // the write path below re-reads the winner after a uniqueness failure.
    if (idempotencyKey !== null) {
      const existing = await this.getByIdempotencyKey(idempotencyKey);
      if (existing) return existing;
    }

    try {
      const inserted = await this.db
        .prepare(
          `INSERT INTO jobs (
             id, type, entity_type, entity_id, payload_version, priority, attempt,
             max_attempts, available_at, state, idempotency_key, correlation_id,
             payload_json, created_at
           ) VALUES (?, ?, ?, ?, '1', ?, 0, ?, ?, 'AVAILABLE', ?, ?, ?, ?)`,
        )
        .bind(
          id,
          input.type,
          input.entityType ?? null,
          input.entityId ?? null,
          input.priority ?? 100,
          input.maxAttempts ?? 5,
          input.availableAt ?? now,
          idempotencyKey,
          input.correlationId ?? null,
          JSON.stringify(input.payload),
          now,
        )
        .run();
      if (idempotencyKey !== null && (inserted.meta.changes ?? 0) === 0) {
        const existing = await this.getByIdempotencyKey(idempotencyKey);
        if (existing) return existing;
      }
    } catch (error) {
      if (idempotencyKey !== null) {
        // D1 may report a unique-constraint error after the competing write
        // commits. Returning that row makes retries idempotent even when the
        // initial request timed out after its insert was accepted.
        const existing = await this.getByIdempotencyKey(idempotencyKey);
        if (existing) return existing;
      }
      throw error;
    }
    const row = await this.getById(id);
    if (!row) throw new Error(`Failed to load enqueued job ${id}`);
    return row;
  }

  async claim(agentId: string, leaseMs: number): Promise<ClaimedJob | null> {
    const now = this.clock.now();
    const claimedUntil = new Date(now.getTime() + leaseMs).toISOString();
    // Atomic claim: pick one AVAILABLE job and lock it. We use a single
    // UPDATE-with-RETURNING style via batch.
    const result = await this.db
      .prepare(
        `UPDATE jobs
         SET state = 'CLAIMED', claimed_by = ?, claimed_until = ?
         WHERE id = (
           SELECT id FROM jobs
           WHERE state = 'AVAILABLE' AND available_at <= ?
           ORDER BY priority ASC, created_at ASC
           LIMIT 1
         )
         RETURNING id`,
      )
      .bind(agentId, claimedUntil, now.toISOString())
      .first<{ id: string }>();

    if (!result) return null;
    const row = await this.getById(result.id);
    if (!row) return null;

    const db = this.db;
    const clock = this.clock;
    return {
      job: row,
      async complete(result: unknown): Promise<void> {
        const completedAt = clock.nowIso();
        const updated = await db
          .prepare(
            `UPDATE jobs
             SET state = 'COMPLETED', result_json = ?, completed_at = ?,
                 claimed_by = NULL, claimed_until = NULL
             WHERE id = ? AND state IN ('CLAIMED', 'RUNNING')
               AND claimed_by = ? AND claimed_until > ?`,
          )
          .bind(
            result == null ? null : JSON.stringify(result),
            completedAt,
            row.id,
            agentId,
            completedAt,
          )
          .run();
        if ((updated.meta.changes ?? 0) !== 1) throw new JobLeaseLostError(row.id);
      },
      async fail(reason: string): Promise<void> {
        const nextAttempt = row.attempt + 1;
        const failedAt = clock.nowIso();
        if (nextAttempt >= row.maxAttempts) {
          const updated = await db
            .prepare(
              `UPDATE jobs
               SET state = 'DEAD_LETTER', attempt = ?, failure_reason = ?, completed_at = ?,
                   claimed_by = NULL, claimed_until = NULL
               WHERE id = ? AND state IN ('CLAIMED', 'RUNNING')
                 AND claimed_by = ? AND claimed_until > ?`,
            )
            .bind(nextAttempt, reason, failedAt, row.id, agentId, failedAt)
            .run();
          if ((updated.meta.changes ?? 0) !== 1) throw new JobLeaseLostError(row.id);
        } else {
          const updated = await db
            .prepare(
              `UPDATE jobs
               SET state = 'AVAILABLE', attempt = ?, failure_reason = ?,
                   claimed_by = NULL, claimed_until = NULL,
                   available_at = ?
               WHERE id = ? AND state IN ('CLAIMED', 'RUNNING')
                 AND claimed_by = ? AND claimed_until > ?`,
            )
            .bind(
              nextAttempt,
              reason,
              new Date(clock.now().getTime() + 2 ** nextAttempt * 1000).toISOString(),
              row.id,
              agentId,
              failedAt,
            )
            .run();
          if ((updated.meta.changes ?? 0) !== 1) throw new JobLeaseLostError(row.id);
        }
      },
    };
  }

  async reapExpired(now: string): Promise<number> {
    const result = await this.db
      .prepare(
        `UPDATE jobs
         SET state = 'AVAILABLE', claimed_by = NULL, claimed_until = NULL
         WHERE state IN ('CLAIMED', 'RUNNING') AND claimed_until IS NOT NULL
           AND claimed_until <= ?`,
      )
      .bind(now)
      .run();
    return result.meta.changes ?? 0;
  }

  async listDeadLetters(): Promise<JobRecord[]> {
    const rows = await this.db
      .prepare(`SELECT * FROM jobs WHERE state = 'DEAD_LETTER' ORDER BY created_at ASC`)
      .all();
    return (rows.results ?? []).map((r) => rowToRecord(r as Record<string, unknown>));
  }

  private async getById(id: string): Promise<JobRecord | null> {
    const row = await this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(id).first();
    if (!row) return null;
    return rowToRecord(row as Record<string, unknown>);
  }

  private async getByIdempotencyKey(key: string): Promise<JobRecord | null> {
    const row = await this.db
      .prepare(`SELECT * FROM jobs WHERE idempotency_key = ? LIMIT 1`)
      .bind(key)
      .first();
    if (!row) return null;
    return rowToRecord(row as Record<string, unknown>);
  }
}

function rowToRecord(r: Record<string, unknown>): JobRecord {
  return {
    id: r.id as string,
    type: r.type as string,
    entityType: (r.entity_type as string | null) ?? null,
    entityId: (r.entity_id as string | null) ?? null,
    payload: r.payload_json ? JSON.parse(r.payload_json as string) : null,
    priority: (r.priority as number) ?? 100,
    attempt: (r.attempt as number) ?? 0,
    maxAttempts: (r.max_attempts as number) ?? 5,
    availableAt: r.available_at as string,
    claimedUntil: (r.claimed_until as string | null) ?? null,
    claimedBy: (r.claimed_by as string | null) ?? null,
    state: r.state as JobState,
    failureReason: (r.failure_reason as string | null) ?? null,
    idempotencyKey: (r.idempotency_key as string | null) ?? null,
    correlationId: (r.correlation_id as string | null) ?? null,
    result: r.result_json ? JSON.parse(r.result_json as string) : null,
    createdAt: r.created_at as string,
    completedAt: (r.completed_at as string | null) ?? null,
  };
}

/** In-memory job queue for tests. */
export class InMemoryJobQueue implements JobQueue {
  private readonly jobs = new Map<string, JobRecord>();

  constructor(private readonly clock: Clock) {}

  async enqueue(input: EnqueueJobInput): Promise<JobRecord> {
    const idempotencyKey = input.idempotencyKey ?? null;
    if (idempotencyKey !== null) {
      const existing = [...this.jobs.values()].find((job) => job.idempotencyKey === idempotencyKey);
      if (existing) return existing;
    }
    const id = newJobId();
    const now = this.clock.nowIso();
    const record: JobRecord = {
      id,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      payload: input.payload,
      priority: input.priority ?? 100,
      attempt: 0,
      maxAttempts: input.maxAttempts ?? 5,
      availableAt: input.availableAt ?? now,
      claimedUntil: null,
      claimedBy: null,
      state: "AVAILABLE",
      failureReason: null,
      idempotencyKey,
      correlationId: input.correlationId ?? null,
      result: null,
      createdAt: now,
      completedAt: null,
    };
    this.jobs.set(id, record);
    return record;
  }

  async claim(agentId: string, leaseMs: number): Promise<ClaimedJob | null> {
    const now = this.clock.now();
    const available = [...this.jobs.values()]
      .filter((j) => j.state === "AVAILABLE" && new Date(j.availableAt) <= now)
      .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
    if (available.length === 0) return null;
    const job = available[0];
    if (!job) return null;
    const claimedUntil = new Date(now.getTime() + leaseMs).toISOString();
    const updated: JobRecord = {
      ...job,
      state: "CLAIMED",
      claimedBy: agentId,
      claimedUntil,
    };
    this.jobs.set(job.id, updated);
    return this.wrapClaim(updated);
  }

  async reapExpired(now: string): Promise<number> {
    const cutoff = new Date(now);
    let count = 0;
    for (const [id, job] of this.jobs) {
      if (
        (job.state === "CLAIMED" || job.state === "RUNNING") &&
        job.claimedUntil &&
        new Date(job.claimedUntil) <= cutoff
      ) {
        this.jobs.set(id, { ...job, state: "AVAILABLE", claimedBy: null, claimedUntil: null });
        count++;
      }
    }
    return count;
  }

  async listDeadLetters(): Promise<JobRecord[]> {
    return [...this.jobs.values()].filter((j) => j.state === "DEAD_LETTER");
  }

  private wrapClaim(job: JobRecord): ClaimedJob {
    const jobs = this.jobs;
    const clock = this.clock;
    const stillOwnsLease = (): boolean => {
      const current = jobs.get(job.id);
      return Boolean(
        current &&
        (current.state === "CLAIMED" || current.state === "RUNNING") &&
        current.claimedBy === job.claimedBy &&
        current.claimedUntil &&
        current.claimedUntil > clock.nowIso(),
      );
    };
    return {
      job,
      async complete(result: unknown): Promise<void> {
        if (!stillOwnsLease()) throw new JobLeaseLostError(job.id);
        jobs.set(job.id, {
          ...job,
          state: "COMPLETED",
          claimedBy: null,
          claimedUntil: null,
          result,
          completedAt: clock.nowIso(),
        });
        // result is informational in the in-memory queue; production uses
        // D1 columns. Keep it for parity.
        void result;
      },
      async fail(reason: string): Promise<void> {
        if (!stillOwnsLease()) throw new JobLeaseLostError(job.id);
        const nextAttempt = job.attempt + 1;
        if (nextAttempt >= job.maxAttempts) {
          jobs.set(job.id, {
            ...job,
            state: "DEAD_LETTER",
            attempt: nextAttempt,
            failureReason: reason,
            claimedBy: null,
            claimedUntil: null,
            completedAt: clock.nowIso(),
          });
        } else {
          jobs.set(job.id, {
            ...job,
            state: "AVAILABLE",
            attempt: nextAttempt,
            failureReason: reason,
            claimedBy: null,
            claimedUntil: null,
            availableAt: new Date(clock.now().getTime() + 2 ** nextAttempt * 1000).toISOString(),
          });
        }
      },
    };
  }
}
