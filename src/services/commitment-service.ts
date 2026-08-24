// Manufactured commitment service.
//
// Implements the full state machine for an optional artificial
// social obligation a member asks the Society to construct.
//
// Per MASTER_SPEC §7.10 and §2.7:
//   request → goal → proposed scenario → explicit confirm →
//   schedule → reminder phase → pressure window →
//   cancellation/closure → COMPLETED
//
// The member can abort at any pre-completion state. If the
// cancellation fails, the scenario escalates to operator.

import type { D1Database } from "@cloudflare/workers-types";
import { newCommitmentId } from "../infra/ids.js";
import {
  commitmentMachine,
  type CommitmentEvent,
  type CommitmentState,
} from "../domain/machines/manufactured-commitment.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";
import { canPerform } from "../domain/policy.js";
import { loadPolicyContext } from "../domain/policy-context.js";

export interface RequestCommitmentInput {
  readonly memberId: string;
  readonly goal: string;
  readonly scenarioText: string;
}

export interface Commitment {
  readonly id: string;
  readonly memberId: string;
  readonly state: CommitmentState;
  readonly goal: string | null;
  readonly scenarioText: string | null;
  readonly confirmedAt: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface CommitmentServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

export class CommitmentOwnershipError extends Error {
  constructor() {
    super("Member does not own this commitment.");
    this.name = "CommitmentOwnershipError";
  }
}

export class CommitmentService {
  constructor(private readonly deps: CommitmentServiceDeps) {}

  /**
   * Member requests a manufactured commitment. The Society
   * automatically checks entitlement + permission + opt-in.
   */
  async request(input: RequestCommitmentInput): Promise<Commitment> {
    const decision = canPerform(
      "MANUFACTURED_COMMITMENTS",
      await loadPolicyContext(this.deps.db, input.memberId, "MANUFACTURED_COMMITMENTS"),
    );
    if (!decision.allowed) {
      throw new Error(`Commitment not allowed: ${decision.reason}`);
    }
    const id = newCommitmentId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO commitment_scenarios
          (id, member_id, goal, scenario_text, state, created_at)
         VALUES (?, ?, ?, ?, 'REQUESTED', ?)`,
      )
      .bind(id, input.memberId, input.goal, input.scenarioText, now)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: input.memberId,
      action: "COMMITMENT_REQUESTED",
      entityType: "COMMITMENT_SCENARIO",
      entityId: id,
      fromState: null,
      toState: "REQUESTED",
      reasonCode: null,
      correlationId: null,
      metadata: { goal: input.goal },
    });
    await this.transition(id, "CAPTURE_GOAL");
    return (await this.get(id))!;
  }

  async proposeScenario(id: string, scenarioText: string): Promise<Commitment> {
    await this.transition(id, "PROPOSE_SCENARIO");
    await this.deps.db
      .prepare(`UPDATE commitment_scenarios SET scenario_text = ? WHERE id = ?`)
      .bind(scenarioText, id)
      .run();
    return (await this.get(id))!;
  }

  async confirm(id: string): Promise<Commitment> {
    const c = await this.get(id);
    if (!c) throw new Error(`Unknown commitment: ${id}`);
    if (c.state !== "SCENARIO_PROPOSED") {
      throw new Error(`Commitment is not in SCENARIO_PROPOSED; current ${c.state}.`);
    }
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(`UPDATE commitment_scenarios SET confirmed_at = ? WHERE id = ?`)
      .bind(now, id)
      .run();
    await this.transition(id, "CONFIRM");
    await this.transition(id, "SCHEDULE");
    await this.transition(id, "ENTER_REMINDER_PHASE");
    return (await this.get(id))!;
  }

  async decline(id: string, reason: string): Promise<Commitment> {
    await this.transition(id, "DECLINE");
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: null,
      action: "COMMITMENT_DECLINED",
      entityType: "COMMITMENT_SCENARIO",
      entityId: id,
      fromState: "SCENARIO_PROPOSED",
      toState: "DECLINED",
      reasonCode: reason,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  /**
   * Member aborts at any pre-completion state. All future
   * scheduled work for the scenario is cancelled.
   */
  async abort(id: string, reason: string, memberId?: string): Promise<Commitment> {
    const c = await this.get(id);
    if (!c) throw new Error(`Unknown commitment: ${id}`);
    if (memberId !== undefined && c.memberId !== memberId) throw new CommitmentOwnershipError();
    if (c.state === "COMPLETED" || c.state === "ABORTED" || c.state === "DECLINED") {
      return c;
    }
    await this.transition(id, "ABORT");
    // Cancel any future jobs for this scenario.
    await this.deps.db
      .prepare(
        `UPDATE jobs SET state = 'DEAD_LETTER', failure_reason = 'COMMITMENT_ABORTED' WHERE state IN ('AVAILABLE', 'CLAIMED', 'RUNNING') AND type IN ('SEND_EMAIL', 'CREATE_HUMAN_TASK', 'AI_AGENT_WORK') AND json_extract(payload_json, '$.commitmentId') = ?`,
      )
      .bind(id)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: c.memberId,
      action: "COMMITMENT_ABORTED",
      entityType: "COMMITMENT_SCENARIO",
      entityId: id,
      fromState: c.state,
      toState: "ABORTED",
      reasonCode: reason,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  /**
   * The Society cancels the scenario at the agreed point.
   * This is the expected end-of-life. Cancellation must be
   * explicit; it must not dangle.
   *
   * Accepts the commitment from any pre-completion state, advances
   * it to the cancellation state, then to COMPLETED.
   */
  async close(id: string, operatorId: string | null): Promise<Commitment> {
    const c = await this.get(id);
    if (!c) throw new Error(`Unknown commitment: ${id}`);
    if (c.state === "COMPLETED" || c.state === "ABORTED" || c.state === "DECLINED") {
      return c;
    }
    // The state machine requires that the scenario reach
    // PRESSURE_WINDOW before QUEUE_CANCELLATION. From any
    // pre-completion state we walk forward as far as the
    // state machine permits.
    const forward: ReadonlyArray<CommitmentEvent> = [
      "ENTER_PRESSURE_WINDOW",
      "QUEUE_CANCELLATION",
      "CANCEL",
    ];
    for (const ev of forward) {
      const cur = await this.get(id);
      if (!cur) break;
      if (cur.state === "COMPLETED" || cur.state === "ABORTED" || cur.state === "DECLINED") {
        break;
      }
      await this.transition(id, ev);
    }
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(`UPDATE commitment_scenarios SET completed_at = ? WHERE id = ?`)
      .bind(now, id)
      .run();
    // Clear any remaining future jobs.
    await this.deps.db
      .prepare(
        `UPDATE jobs SET state = 'DEAD_LETTER', failure_reason = 'COMMITMENT_CLOSED' WHERE state IN ('AVAILABLE', 'CLAIMED', 'RUNNING') AND type IN ('SEND_EMAIL', 'CREATE_HUMAN_TASK', 'AI_AGENT_WORK') AND json_extract(payload_json, '$.commitmentId') = ?`,
      )
      .bind(id)
      .run();
    await this.deps.audit.record({
      actorType: operatorId ? "OPERATOR" : "SYSTEM",
      actorId: operatorId,
      action: "COMMITMENT_CLOSED",
      entityType: "COMMITMENT_SCENARIO",
      entityId: id,
      fromState: c.state,
      toState: "COMPLETED",
      reasonCode: "CANCELLATION",
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  /**
   * If the close() side effects (cancellation communications) fail,
   * escalate. The state machine permits an OPERATOR_ESCALATION
   * state from CANCELLATION_QUEUED.
   */
  async escalate(id: string, reason: string): Promise<Commitment> {
    const c = await this.get(id);
    if (!c) throw new Error(`Unknown commitment: ${id}`);
    if (c.state !== "CANCELLATION_QUEUED") {
      throw new Error(`Commitment must be in CANCELLATION_QUEUED to escalate; current ${c.state}.`);
    }
    await this.transition(id, "ESCALATE");
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "COMMITMENT_ESCALATED",
      entityType: "COMMITMENT_SCENARIO",
      entityId: id,
      fromState: "CANCELLATION_QUEUED",
      toState: "OPERATOR_ESCALATION",
      reasonCode: reason,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  async get(id: string): Promise<Commitment | null> {
    const row = await this.deps.db
      .prepare(`SELECT * FROM commitment_scenarios WHERE id = ?`)
      .bind(id)
      .first();
    if (!row) return null;
    return rowToCommitment(row as Record<string, unknown>);
  }

  private async transition(id: string, event: CommitmentEvent): Promise<void> {
    const row = await this.deps.db
      .prepare(`SELECT state FROM commitment_scenarios WHERE id = ?`)
      .bind(id)
      .first<{ state: CommitmentState }>();
    if (!row) throw new Error(`Unknown commitment: ${id}`);
    const result = commitmentMachine.next(row.state, event);
    if (!result.allowed) {
      await this.deps.audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "COMMITMENT_TRANSITION_REJECTED",
        entityType: "COMMITMENT_SCENARIO",
        entityId: id,
        fromState: row.state,
        toState: row.state,
        reasonCode: result.reasonCode,
        correlationId: null,
        metadata: { event },
      });
      return;
    }
    await this.deps.db
      .prepare(`UPDATE commitment_scenarios SET state = ? WHERE id = ?`)
      .bind(result.toState, id)
      .run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "COMMITMENT_TRANSITION",
      entityType: "COMMITMENT_SCENARIO",
      entityId: id,
      fromState: row.state,
      toState: result.toState,
      reasonCode: result.reasonCode,
      correlationId: null,
      metadata: { event },
    });
  }
}

function rowToCommitment(r: Record<string, unknown>): Commitment {
  return {
    id: r.id as string,
    memberId: r.member_id as string,
    state: r.state as CommitmentState,
    goal: (r.goal as string | null) ?? null,
    scenarioText: (r.scenario_text as string | null) ?? null,
    confirmedAt: (r.confirmed_at as string | null) ?? null,
    createdAt: r.created_at as string,
    completedAt: (r.completed_at as string | null) ?? null,
  };
}
