// Public cancellation counter.
//
// Computes the public-facing "cancelled events" metric from real
// D1 records. The value is derived (rebuildable) and the source of
// truth is D1. We never hard-code a fake number.
//
// In local acceptance runs we use a deterministic zero result; the
// integration test seeds and verifies the math. Production
// deployments get the same query against the real database.
//
// See MASTER_SPEC §8.14.

import type { D1Database } from "@cloudflare/workers-types";

export type CancellationCounter =
  | {
      readonly status: "available";
      /** Number of ordinary events that reached a completed cancellation state. */
      readonly cancelledEvents: number;
    }
  | {
      readonly status: "unavailable";
      readonly cancelledEvents: null;
    };

/**
 * Read the cancellation counter from D1. An unavailable database
 * is distinct from a confirmed zero so the public page never turns
 * an outage into a factual claim.
 */
export async function readCancellationCounter(
  db: D1Database | undefined,
): Promise<CancellationCounter> {
  if (!db) return { status: "unavailable", cancelledEvents: null };
  try {
    const cancelledRow = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM events WHERE state IN ('CANCELLED', 'CALENDAR_CANCELLATION_PROCESSED', 'ARCHIVED')`,
      )
      .first<{ n: number }>();
    const cancelled = Number(cancelledRow?.n ?? 0);
    return { status: "available", cancelledEvents: cancelled };
  } catch (error) {
    // The homepage remains usable, but it must not present an outage as a real zero.
    console.error("public cancellation counter unavailable", error);
    return { status: "unavailable", cancelledEvents: null };
  }
}

/**
 * Frontmatter-friendly form: pass the native Cloudflare env directly.
 */
export async function withCounter(
  env: { DB?: D1Database } | undefined,
): Promise<CancellationCounter> {
  return readCancellationCounter(env?.DB);
}
