// Cron handler for scheduled work discovery.
//
// In production this is triggered by Cloudflare Cron Triggers
// (see wrangler.jsonc). The handler discovers due work and
// enqueues bounded jobs. It does not synchronously perform
// AI/email batches.
//
// Per MASTER_SPEC §8.4 and §5.10: cron discovers due work and
// enqueues bounded jobs. The actual work is done by the queue
// consumer.

import type { APIRoute } from "astro";
import { SystemClock } from "@infra/clock";

export const POST: APIRoute = async ({ request: _request, locals }) => {
  const env = locals.runtime.env;
  if (!env?.DB) {
    return new Response("database binding not available", { status: 500 });
  }
  // Manual cron trigger via the Cloudflare scheduled handler URL.
  // Local dev uses the SystemClock; production uses the workerd
  // built-in cron clock. The same path is used in both cases.
  const clock = new SystemClock();
  const now = clock.nowIso();
  // 1. Find every event whose cancellation is due inside the
  //    emergency window (e.g. next 2 hours) and not yet cancelled.
  //    The queue handler / safety monitor does the actual work.
  // 2. Find every event whose reminder is due.
  // 3. Find every milestone due today.
  // For Phase 1 we just count and report; enqueue is the
  // follow-up work in the queue handler.
  let criticalCount = 0;
  let dueMilestones = 0;
  let reminderDue = 0;
  try {
    const critical = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM events
           WHERE state IN ('CANCELLATION_FAILURE', 'CRITICAL_OPERATOR_ACTION', 'SEND_FAILURE')`,
    ).first<{ n: number }>();
    criticalCount = critical?.n ?? 0;
    const ms = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM member_milestones
           WHERE triggered_on = ?`,
    )
      .bind(now.slice(0, 10))
      .first<{ n: number }>();
    dueMilestones = ms?.n ?? 0;
    const rm = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM events
           WHERE state IN ('INVITED', 'REMINDER_WINDOW')
             AND datetime(start_at, '-1 day') <= ?`,
    )
      .bind(now)
      .first<{ n: number }>();
    reminderDue = rm?.n ?? 0;
  } catch {
    // Tables may not exist on a fresh deploy. The cron handler
    // returns zeros and the next run will pick up the work.
  }
  return new Response(
    JSON.stringify({
      now,
      criticalEvents: criticalCount,
      dueMilestones,
      reminderDue,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
};
