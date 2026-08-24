// Gift service.
//
// A gift is suggested by AI, approved by a human operator, purchased
// by the operator, dispatched, and then recorded as delivered. AI
// may suggest and may not independently purchase.
//
// Per MASTER_SPEC §7.8 and §8.17.

import type { D1Database } from "@cloudflare/workers-types";
import { newGiftId } from "../infra/ids.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";
import { canPerform } from "../domain/policy.js";
import { loadPolicyContext } from "../domain/policy-context.js";

export type GiftState =
  | "TRIGGERED"
  | "ELIGIBILITY_CHECK"
  | "ELIGIBLE"
  | "SUGGESTED"
  | "HUMAN_APPROVED"
  | "PURCHASED"
  | "DISPATCHED"
  | "DELIVERED"
  | "NOT_ELIGIBLE"
  | "BUDGET_DENIED"
  | "MEMBER_OPTED_OUT"
  | "ALTERNATIVE"
  | "CANCELLED";

export interface Gift {
  readonly id: string;
  readonly memberId: string;
  readonly occasion: string;
  readonly description: string;
  readonly budgetCents: number;
  readonly state: GiftState;
  readonly createdAt: string;
}

export interface GiftServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

export class GiftService {
  constructor(private readonly deps: GiftServiceDeps) {}

  /**
   * Trigger a gift. Eligibility check is mandatory. If the member
   * is not entitled (e.g. tier A$5 or GIFTS service grant off)
   * the gift is closed with NOT_ELIGIBLE.
   */
  async trigger(input: {
    readonly memberId: string;
    readonly occasion: string;
    readonly description: string;
    readonly budgetCents: number;
  }): Promise<Gift> {
    const id = newGiftId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO gifts (id, member_id, occasion, description, budget_cents, state, created_at)
         VALUES (?, ?, ?, ?, ?, 'TRIGGERED', ?)`,
      )
      .bind(id, input.memberId, input.occasion, input.description, input.budgetCents, now)
      .run();

    // Eligibility check.
    const decision = canPerform(
      "GIFTS",
      await loadPolicyContext(this.deps.db, input.memberId, "GIFTS"),
    );
    if (!decision.allowed) {
      await this.transition(id, "DENY", decision.evidence.join(";"));
      return (await this.get(id))!;
    }
    // Budget enforcement.
    const maxBudget = 10000; // A$100 per single gift by default
    if (input.budgetCents > maxBudget) {
      await this.transition(id, "BUDGET_DENIED", `budget=${input.budgetCents} > max=${maxBudget}`);
      return (await this.get(id))!;
    }
    await this.transition(id, "ELIGIBLE", "OK");
    return (await this.get(id))!;
  }

  async suggest(id: string, description: string, budgetCents: number): Promise<Gift> {
    await this.deps.db
      .prepare(`UPDATE gifts SET description = ?, budget_cents = ? WHERE id = ?`)
      .bind(description, budgetCents, id)
      .run();
    await this.transition(id, "SUGGEST", "OK");
    return (await this.get(id))!;
  }

  async approve(id: string, operatorId: string): Promise<Gift> {
    const g = await this.get(id);
    if (!g) throw new Error(`Unknown gift: ${id}`);
    if (g.state !== "SUGGESTED" && g.state !== "BUDGET_DENIED") {
      throw new Error(`Cannot approve gift in state ${g.state}.`);
    }
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: operatorId,
      action: "GIFT_APPROVED",
      entityType: "GIFT",
      entityId: id,
      fromState: g.state,
      toState: "HUMAN_APPROVED",
      reasonCode: "OK",
      correlationId: null,
      metadata: { budget: g.budgetCents },
    });
    await this.deps.db
      .prepare(`UPDATE gifts SET state = 'HUMAN_APPROVED' WHERE id = ?`)
      .bind(id)
      .run();
    return (await this.get(id))!;
  }

  async markPurchased(id: string, operatorId: string): Promise<Gift> {
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: operatorId,
      action: "GIFT_PURCHASED",
      entityType: "GIFT",
      entityId: id,
      fromState: "HUMAN_APPROVED",
      toState: "PURCHASED",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
    await this.deps.db.prepare(`UPDATE gifts SET state = 'PURCHASED' WHERE id = ?`).bind(id).run();
    return (await this.get(id))!;
  }

  async markDispatched(id: string, operatorId: string): Promise<Gift> {
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: operatorId,
      action: "GIFT_DISPATCHED",
      entityType: "GIFT",
      entityId: id,
      fromState: "PURCHASED",
      toState: "DISPATCHED",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
    await this.deps.db.prepare(`UPDATE gifts SET state = 'DISPATCHED' WHERE id = ?`).bind(id).run();
    return (await this.get(id))!;
  }

  async markDelivered(id: string, operatorId: string): Promise<Gift> {
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: operatorId,
      action: "GIFT_DELIVERED",
      entityType: "GIFT",
      entityId: id,
      fromState: "DISPATCHED",
      toState: "DELIVERED",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
    await this.deps.db.prepare(`UPDATE gifts SET state = 'DELIVERED' WHERE id = ?`).bind(id).run();
    return (await this.get(id))!;
  }

  async cancel(id: string, reason: string): Promise<Gift> {
    const g = await this.get(id);
    if (!g) throw new Error(`Unknown gift: ${id}`);
    if (g.state === "DELIVERED" || g.state === "CANCELLED") return g;
    await this.transition(id, "CANCEL", reason);
    return (await this.get(id))!;
  }

  async get(id: string): Promise<Gift | null> {
    const row = await this.deps.db.prepare(`SELECT * FROM gifts WHERE id = ?`).bind(id).first();
    if (!row) return null;
    return rowToGift(row as Record<string, unknown>);
  }

  /**
   * Permission revocation: cancel every non-terminal gift for the
   * member. Other (non-gift) actions are unaffected. The same
   * pattern is used by calls and manufactured commitments.
   */
  async cancelAllForMember(memberId: string, reason: string): Promise<number> {
    const result = await this.deps.db
      .prepare(
        `UPDATE gifts SET state = 'CANCELLED' WHERE member_id = ? AND state NOT IN ('DELIVERED', 'CANCELLED')`,
      )
      .bind(memberId)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: memberId,
      action: "GIFTS_PERMISSION_REVOKED",
      entityType: "GIFT",
      entityId: null,
      fromState: null,
      toState: "CANCELLED",
      reasonCode: reason,
      correlationId: null,
      metadata: { affected: result.meta.changes ?? 0 },
    });
    return result.meta.changes ?? 0;
  }

  private async transition(id: string, event: string, reason: string | null): Promise<void> {
    const map: Record<string, GiftState> = {
      DENY: "NOT_ELIGIBLE",
      BUDGET_DENIED: "BUDGET_DENIED",
      ELIGIBLE: "ELIGIBLE",
      SUGGEST: "SUGGESTED",
      CANCEL: "CANCELLED",
    };
    const to = map[event];
    if (!to) {
      throw new Error(`Unknown gift transition event: ${event}`);
    }
    const row = await this.deps.db
      .prepare(`SELECT state FROM gifts WHERE id = ?`)
      .bind(id)
      .first<{ state: GiftState }>();
    if (!row) return;
    await this.deps.db.prepare(`UPDATE gifts SET state = ? WHERE id = ?`).bind(to, id).run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "GIFT_TRANSITION",
      entityType: "GIFT",
      entityId: id,
      fromState: row.state,
      toState: to,
      reasonCode: reason,
      correlationId: null,
      metadata: { event },
    });
  }
}

function rowToGift(r: Record<string, unknown>): Gift {
  return {
    id: r.id as string,
    memberId: r.member_id as string,
    occasion: r.occasion as string,
    description: r.description as string,
    budgetCents: r.budget_cents as number,
    state: r.state as GiftState,
    createdAt: r.created_at as string,
  };
}
