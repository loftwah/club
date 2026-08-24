// Call service.
//
// A member-call is an explicit, opted-in phone call at a permitted
// window, briefed from confirmed facts only and respecting the
// do-not-mention list. If the member does not answer, the call
// follows the no-answer policy (one reschedule then closed).
//
// Per MASTER_SPEC §7.9, §8.18.

import type { D1Database } from "@cloudflare/workers-types";
import { newCallId, newFulfilmentId } from "../infra/ids.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";
import { canPerform } from "../domain/policy.js";
import { loadPolicyContext } from "../domain/policy-context.js";

export type CallState =
  | "PROPOSED"
  | "POLICY_ALLOWED"
  | "POLICY_DENIED"
  | "SCHEDULED"
  | "DUE"
  | "COMPLETED"
  | "NO_ANSWER"
  | "RESCHEDULED"
  | "PERMISSION_REVOKED"
  | "MEMBER_CANCELLED"
  | "CLOSED";

export interface Call {
  readonly id: string;
  readonly memberId: string;
  readonly purpose: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly state: CallState;
  readonly createdAt: string;
}

export interface CallServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

export class CallService {
  constructor(private readonly deps: CallServiceDeps) {}

  async propose(input: {
    readonly memberId: string;
    readonly purpose: string;
    readonly windowStart: string;
    readonly windowEnd: string;
  }): Promise<Call> {
    const id = newCallId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO calls (id, member_id, purpose, window_start, window_end, state, created_at)
         VALUES (?, ?, ?, ?, ?, 'PROPOSED', ?)`,
      )
      .bind(id, input.memberId, input.purpose, input.windowStart, input.windowEnd, now)
      .run();
    // Policy check.
    const decision = canPerform(
      "CALLS",
      await loadPolicyContext(this.deps.db, input.memberId, "CALLS"),
    );
    if (!decision.allowed) {
      await this.deps.db
        .prepare(`UPDATE calls SET state = 'POLICY_DENIED' WHERE id = ?`)
        .bind(id)
        .run();
      await this.deps.audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "CALL_POLICY_DENIED",
        entityType: "CALL",
        entityId: id,
        fromState: "PROPOSED",
        toState: "POLICY_DENIED",
        reasonCode: decision.evidence.join(";"),
        correlationId: null,
        metadata: null,
      });
    } else {
      await this.deps.db
        .prepare(`UPDATE calls SET state = 'POLICY_ALLOWED' WHERE id = ?`)
        .bind(id)
        .run();
      await this.deps.audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "CALL_POLICY_ALLOWED",
        entityType: "CALL",
        entityId: id,
        fromState: "PROPOSED",
        toState: "POLICY_ALLOWED",
        reasonCode: "OK",
        correlationId: null,
        metadata: null,
      });
    }
    return (await this.get(id))!;
  }

  async schedule(id: string): Promise<Call> {
    const c = await this.get(id);
    if (!c) throw new Error(`Unknown call: ${id}`);
    if (c.state !== "POLICY_ALLOWED" && c.state !== "RESCHEDULED") {
      throw new Error(`Cannot schedule call from state ${c.state}.`);
    }
    await this.deps.db.prepare(`UPDATE calls SET state = 'SCHEDULED' WHERE id = ?`).bind(id).run();
    // Also create a fulfilment task for the operator.
    const taskId = newFulfilmentId();
    await this.deps.db
      .prepare(
        `INSERT INTO fulfilment_tasks
          (id, member_id, task_type, state, context_json, deadline, created_at)
         VALUES (?, ?, 'MAKE_CALL', 'OPERATOR_NOTIFIED', ?, ?, ?)`,
      )
      .bind(
        taskId,
        c.memberId,
        JSON.stringify({ callId: id, purpose: c.purpose, window: [c.windowStart, c.windowEnd] }),
        c.windowEnd,
        this.deps.clock.nowIso(),
      )
      .run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "CALL_SCHEDULED",
      entityType: "CALL",
      entityId: id,
      fromState: c.state,
      toState: "SCHEDULED",
      reasonCode: null,
      correlationId: null,
      metadata: { taskId },
    });
    return (await this.get(id))!;
  }

  async markDue(id: string): Promise<Call> {
    await this.deps.db.prepare(`UPDATE calls SET state = 'DUE' WHERE id = ?`).bind(id).run();
    return (await this.get(id))!;
  }

  async markCompleted(id: string, operatorId: string): Promise<Call> {
    await this.deps.db.prepare(`UPDATE calls SET state = 'COMPLETED' WHERE id = ?`).bind(id).run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: operatorId,
      action: "CALL_COMPLETED",
      entityType: "CALL",
      entityId: id,
      fromState: "DUE",
      toState: "COMPLETED",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  async markNoAnswer(id: string, operatorId: string): Promise<Call> {
    const c = await this.get(id);
    if (!c) throw new Error(`Unknown call: ${id}`);
    if (c.state === "RESCHEDULED" || c.state === "CLOSED") return c;
    await this.deps.db.prepare(`UPDATE calls SET state = 'NO_ANSWER' WHERE id = ?`).bind(id).run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: operatorId,
      action: "CALL_NO_ANSWER",
      entityType: "CALL",
      entityId: id,
      fromState: "DUE",
      toState: "NO_ANSWER",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  async reschedule(id: string, windowStart: string, windowEnd: string): Promise<Call> {
    await this.deps.db
      .prepare(
        `UPDATE calls SET state = 'RESCHEDULED', window_start = ?, window_end = ? WHERE id = ?`,
      )
      .bind(windowStart, windowEnd, id)
      .run();
    return (await this.get(id))!;
  }

  async close(id: string, reason: string): Promise<Call> {
    await this.deps.db.prepare(`UPDATE calls SET state = 'CLOSED' WHERE id = ?`).bind(id).run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "CALL_CLOSED",
      entityType: "CALL",
      entityId: id,
      fromState: "RESCHEDULED",
      toState: "CLOSED",
      reasonCode: reason,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  /**
   * Permission revocation. Member has disabled calls. Cancel every
   * non-terminal call and audit it. Other birthday actions are
   * unaffected.
   */
  async cancelAllForMember(memberId: string, reason: string): Promise<number> {
    const result = await this.deps.db
      .prepare(
        `UPDATE calls SET state = 'PERMISSION_REVOKED' WHERE member_id = ? AND state NOT IN ('COMPLETED', 'CLOSED', 'PERMISSION_REVOKED')`,
      )
      .bind(memberId)
      .run();
    // Also mark fulfilment tasks for these calls as cancelled.
    await this.deps.db
      .prepare(
        `UPDATE fulfilment_tasks SET state = 'CANCELLED'
         WHERE member_id = ? AND task_type = 'MAKE_CALL' AND state IN ('CREATED', 'OPERATOR_NOTIFIED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESCHEDULED')`,
      )
      .bind(memberId)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: memberId,
      action: "CALLS_PERMISSION_REVOKED",
      entityType: "CALL",
      entityId: null,
      fromState: null,
      toState: "PERMISSION_REVOKED",
      reasonCode: reason,
      correlationId: null,
      metadata: { affected: result.meta.changes ?? 0 },
    });
    return result.meta.changes ?? 0;
  }

  /**
   * Build a call briefing. Includes only: member name, tenure,
   * purpose, allowed window, relevant confirmed facts, related prior
   * contact, do-not-mention list. Never dumps unrelated member data.
   */
  async buildBriefing(id: string): Promise<string> {
    const c = await this.get(id);
    if (!c) throw new Error(`Unknown call: ${id}`);
    const member = await this.deps.db
      .prepare(
        `SELECT m.preferred_name, m.created_at, m.society_alias,
                (SELECT COUNT(*) FROM member_milestones WHERE member_id = m.id) AS milestones,
                (SELECT COUNT(*) FROM event_invitations WHERE member_id = m.id) AS invitations
           FROM members m WHERE m.id = ?`,
      )
      .bind(c.memberId)
      .first<{
        preferred_name: string | null;
        created_at: string;
        society_alias: string | null;
        milestones: number;
        invitations: number;
      }>();
    const facts = await this.deps.db
      .prepare(
        `SELECT category, subject, value_json FROM member_facts
           WHERE member_id = ? AND status = 'CONFIRMED' AND do_not_use = 0
           ORDER BY created_at ASC LIMIT 20`,
      )
      .bind(c.memberId)
      .all<{ category: string; subject: string; value_json: string }>();
    const restricted = await this.deps.db
      .prepare(
        `SELECT category, subject FROM member_facts
           WHERE member_id = ? AND (do_not_use = 1 OR status IN ('REVOKED', 'REJECTED'))
           ORDER BY updated_at DESC LIMIT 10`,
      )
      .bind(c.memberId)
      .all<{ category: string; subject: string }>();

    const lines: string[] = [
      `Member: ${member?.preferred_name ?? "(no name)"} (${member?.society_alias ?? "no alias"})`,
      `Member since: ${member?.created_at?.slice(0, 10) ?? "unknown"}`,
      `Purpose: ${c.purpose}`,
      `Allowed window: ${c.windowStart} → ${c.windowEnd}`,
      `Member milestones: ${member?.milestones ?? 0}; past invitations: ${member?.invitations ?? 0}`,
    ];
    if ((facts.results ?? []).length > 0) {
      lines.push("Confirmed facts (use sparingly, do not invent):");
      for (const f of facts.results ?? []) {
        try {
          const v = JSON.parse(f.value_json);
          lines.push(
            `  - ${f.category}: ${f.subject} = ${typeof v === "string" ? v : JSON.stringify(v)}`,
          );
        } catch {
          lines.push(`  - ${f.category}: ${f.subject}`);
        }
      }
    }
    if ((restricted.results ?? []).length > 0) {
      lines.push("Do NOT mention:");
      for (const r of restricted.results ?? []) {
        lines.push(`  - ${r.category}: ${r.subject}`);
      }
    }
    return lines.join("\n");
  }

  async get(id: string): Promise<Call | null> {
    const row = await this.deps.db.prepare(`SELECT * FROM calls WHERE id = ?`).bind(id).first();
    if (!row) return null;
    return rowToCall(row as Record<string, unknown>);
  }
}

function rowToCall(r: Record<string, unknown>): Call {
  return {
    id: r.id as string,
    memberId: r.member_id as string,
    purpose: r.purpose as string,
    windowStart: r.window_start as string,
    windowEnd: r.window_end as string,
    state: r.state as CallState,
    createdAt: r.created_at as string,
  };
}
