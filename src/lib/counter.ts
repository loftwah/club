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

export interface CancellationCounter {
  /** Number of ordinary events that reached the CANCELLED state. */
  readonly cancelledEvents: number;
  /**
   * Sum of (event.duration_minutes × invited_member_count) for
   * cancelled events. This is the estimate of attendance hours
   * avoided. Labelled "estimate" everywhere it appears publicly.
   */
  readonly estimatedHoursAvoided: number;
}

/**
 * Read the cancellation counter from D1. Returns zeros if the
 * database is unavailable so the homepage degrades gracefully
 * without throwing during local dev or in an early production
 * cold start.
 */
export async function readCancellationCounter(
  db: D1Database | undefined,
): Promise<CancellationCounter> {
  if (!db) return { cancelledEvents: 0, estimatedHoursAvoided: 0 };
  try {
    const cancelledRow = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM events WHERE state IN ('CANCELLED', 'CALENDAR_CANCELLATION_PROCESSED', 'ARCHIVED')`,
      )
      .first<{ n: number }>();
    const cancelled = Number(cancelledRow?.n ?? 0);

    const hoursRow = await db
      .prepare(
        `SELECT COALESCE(SUM(e.duration_minutes * inv.cnt), 0) AS total_minutes
           FROM events e
           LEFT JOIN (
             SELECT event_id, COUNT(*) AS cnt
             FROM event_invitations
             GROUP BY event_id
           ) inv ON inv.event_id = e.id
          WHERE e.state IN ('CANCELLED', 'CALENDAR_CANCELLATION_PROCESSED', 'ARCHIVED')`,
      )
      .first<{ total_minutes: number }>();
    const totalMinutes = Number(hoursRow?.total_minutes ?? 0);
    const estimatedHoursAvoided = Math.round(totalMinutes / 6) / 10; // one decimal place
    return { cancelledEvents: cancelled, estimatedHoursAvoided };
  } catch {
    // Tables might not exist on a fresh deploy before migrations
    // have run. The homepage must not 500.
    return { cancelledEvents: 0, estimatedHoursAvoided: 0 };
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
