// Idempotency. Every side-effecting job carries an idempotency key. The
// IdempotencyStore remembers which keys have been applied, so a redelivered
// or replayed job cannot apply its effect twice.
//
// See MASTER_SPEC §5.9, §6.7, §13 side-effects-are-idempotent.

import type { D1Database } from "@cloudflare/workers-types";
import type { Clock } from "./clock.js";

export interface IdempotencyRecord {
  readonly key: string;
  readonly scope: string;
  readonly jobId: string | null;
  readonly result: unknown;
}

export interface IdempotencyStore {
  /**
   * Attempt to claim an idempotency key. Returns:
   *   - `{ status: "claimed" }` if this is the first time we are seeing
   *     this key in this scope;
   *   - `{ status: "duplicate", record }` if the key was already applied.
   */
  claim(input: {
    key: string;
    scope: string;
    jobId: string | null;
  }): Promise<{ status: "claimed" } | { status: "duplicate"; record: IdempotencyRecord }>;
  /** Record the result of a claimed operation. */
  record(input: {
    key: string;
    scope: string;
    jobId: string | null;
    result: unknown;
  }): Promise<void>;
  release(input: { key: string; scope: string }): Promise<void>;
}

export class D1IdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly db: D1Database,
    private readonly clock: Clock,
  ) {}

  async claim(input: {
    key: string;
    scope: string;
    jobId: string | null;
  }): Promise<{ status: "claimed" } | { status: "duplicate"; record: IdempotencyRecord }> {
    const existing = await this.db
      .prepare(
        `SELECT key, scope, job_id as jobId, result_json as resultJson
         FROM idempotency_records
         WHERE key = ? AND scope = ?`,
      )
      .bind(input.key, input.scope)
      .first<{ key: string; scope: string; jobId: string | null; resultJson: string | null }>();

    if (existing) {
      return {
        status: "duplicate",
        record: {
          key: existing.key,
          scope: existing.scope,
          jobId: existing.jobId,
          result: existing.resultJson ? JSON.parse(existing.resultJson) : null,
        },
      };
    }

    // Insert a placeholder so concurrent claims see the same key.
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO idempotency_records (key, scope, job_id, result_json, created_at)
         VALUES (?, ?, ?, NULL, ?)`,
      )
      .bind(input.key, input.scope, input.jobId, this.clock.nowIso())
      .run();

    const after = await this.db
      .prepare(
        `SELECT key, scope, job_id as jobId, result_json as resultJson
         FROM idempotency_records
         WHERE key = ? AND scope = ?`,
      )
      .bind(input.key, input.scope)
      .first<{ key: string; scope: string; jobId: string | null; resultJson: string | null }>();

    if (after && after.jobId === input.jobId) {
      return { status: "claimed" };
    }
    return {
      status: "duplicate",
      record: {
        key: after!.key,
        scope: after!.scope,
        jobId: after!.jobId,
        result: after!.resultJson ? JSON.parse(after!.resultJson) : null,
      },
    };
  }

  async record(input: {
    key: string;
    scope: string;
    jobId: string | null;
    result: unknown;
  }): Promise<void> {
    await this.db
      .prepare(
        `UPDATE idempotency_records
         SET result_json = ?, job_id = ?
         WHERE key = ? AND scope = ?`,
      )
      .bind(
        input.result == null ? null : JSON.stringify(input.result),
        input.jobId,
        input.key,
        input.scope,
      )
      .run();
  }

  async release(input: { key: string; scope: string }): Promise<void> {
    await this.db
      .prepare(`DELETE FROM idempotency_records WHERE key = ? AND scope = ?`)
      .bind(input.key, input.scope)
      .run();
  }
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly seen = new Map<string, { result: unknown; jobId: string | null }>();

  async claim(input: {
    key: string;
    scope: string;
    jobId: string | null;
  }): Promise<{ status: "claimed" } | { status: "duplicate"; record: IdempotencyRecord }> {
    const mapKey = `${input.scope}::${input.key}`;
    const existing = this.seen.get(mapKey);
    if (existing) {
      return {
        status: "duplicate",
        record: {
          key: input.key,
          scope: input.scope,
          jobId: existing.jobId,
          result: existing.result,
        },
      };
    }
    this.seen.set(mapKey, { result: undefined, jobId: input.jobId });
    return { status: "claimed" };
  }

  async record(input: {
    key: string;
    scope: string;
    jobId: string | null;
    result: unknown;
  }): Promise<void> {
    this.seen.set(`${input.scope}::${input.key}`, {
      result: input.result,
      jobId: input.jobId,
    });
  }

  async release(input: { key: string; scope: string }): Promise<void> {
    this.seen.delete(`${input.scope}::${input.key}`);
  }
}
