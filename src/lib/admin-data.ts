// Admin data helper.
//
// Single place to compute the "what does the Society need from me?"
// digest for the operator landing page. The same digest is exposed
// through the MCP `club.get_daily_operations` capability.

import type { D1Database } from "@cloudflare/workers-types";

export interface AdminTask {
  readonly label: string;
  readonly detail: string;
  readonly urgency: "danger" | "warn" | "info" | "ok";
  readonly href?: string;
}

export interface DailyOps {
  readonly today: AdminTask[];
  readonly todayCount: number;
  readonly dangerousEvents: number;
  readonly retriedEmails: number;
  readonly overdueFulfilments: number;
  readonly deadLetters: number;
  readonly inboundReview: number;
}

export async function dailyOperations(env: { DB?: D1Database } | undefined): Promise<DailyOps> {
  if (!env?.DB) {
    return {
      today: [],
      todayCount: 0,
      dangerousEvents: 0,
      retriedEmails: 0,
      overdueFulfilments: 0,
      deadLetters: 0,
      inboundReview: 0,
    };
  }
  const today: AdminTask[] = [];

  // Critical events.
  const critical = await env.DB.prepare(
    `SELECT id, title, cancellation_due_at FROM events
         WHERE state IN ('CANCELLATION_FAILURE', 'CRITICAL_OPERATOR_ACTION', 'SEND_FAILURE')`,
  ).all<{ id: string; title: string; cancellation_due_at: string }>();
  for (const e of critical.results ?? []) {
    today.push({
      label: "CRITICAL",
      detail: `Event ${e.title} requires manual cancellation (${e.id})`,
      urgency: "danger",
      href: `/admin/events/`,
    });
  }

  // Overdue tasks.
  const overdue = await env.DB.prepare(
    `SELECT id, member_id, task_type, deadline FROM fulfilment_tasks
         WHERE state NOT IN ('COMPLETED', 'CANCELLED') AND deadline IS NOT NULL AND deadline <= ?`,
  )
    .bind(new Date().toISOString())
    .all<{ id: string; member_id: string; task_type: string; deadline: string }>();
  for (const t of overdue.results ?? []) {
    today.push({
      label: t.task_type,
      detail: `Overdue task for member ${t.member_id} (deadline ${t.deadline})`,
      urgency: "warn",
      href: `/admin/tasks/`,
    });
  }

  // Inbound review.
  const inbound = await env.DB.prepare(
    `SELECT id, from_address, subject FROM inbound_messages WHERE state = 'HUMAN_REVIEW' LIMIT 10`,
  ).all<{ id: string; from_address: string; subject: string }>();
  for (const m of inbound.results ?? []) {
    today.push({
      label: "REVIEW",
      detail: `${m.from_address} — ${m.subject ?? "(no subject)"}`,
      urgency: "info",
      href: `/admin/inbound/`,
    });
  }

  // Calls due.
  const callsDue = await env.DB.prepare(
    `SELECT id, member_id, window_start, window_end FROM calls
         WHERE state = 'SCHEDULED' AND window_start <= ?`,
  )
    .bind(new Date(Date.now() + 24 * 3600 * 1000).toISOString())
    .all<{ id: string; member_id: string; window_start: string; window_end: string }>();
  for (const c of callsDue.results ?? []) {
    today.push({
      label: "CALL",
      detail: `Call due for member ${c.member_id} (${c.window_start} → ${c.window_end})`,
      urgency: "info",
      href: `/admin/tasks/`,
    });
  }

  const retried = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM communications WHERE state = 'TRANSIENT_FAILURE'`,
  ).first<{ n: number }>();
  const deadLetters = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM jobs WHERE state = 'DEAD_LETTER'`,
  ).first<{ n: number }>();

  return {
    today,
    todayCount: today.length,
    dangerousEvents: critical.results?.length ?? 0,
    retriedEmails: retried?.n ?? 0,
    overdueFulfilments: overdue.results?.length ?? 0,
    deadLetters: deadLetters?.n ?? 0,
    inboundReview: inbound.results?.length ?? 0,
  };
}
