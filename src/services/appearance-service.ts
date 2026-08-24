// Appearance / actor service.
//
// Implements the architecture for a real-world Society
// representative service. Pricing is intentionally not hard-coded
// to public numbers — the public price is configuration. Disallowed
// use cases (impersonation of real authorities, fraud, coercion,
// etc.) are explicitly rejected by the suitability check.
//
// Per MASTER_SPEC §7.11 and §12.12.

import type { D1Database } from "@cloudflare/workers-types";
import { newAppearanceId } from "../infra/ids.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";
import { canPerform } from "../domain/policy.js";
import { loadPolicyContext } from "../domain/policy-context.js";

export type AppearanceState =
  | "REQUESTED"
  | "SUITABILITY_REVIEW"
  | "SUITABILITY_APPROVED"
  | "SUITABILITY_DECLINED"
  | "QUOTED"
  | "QUOTE_EXPIRED"
  | "ACCEPTED"
  | "PAYMENT_PENDING"
  | "PAYMENT_FAILED"
  | "BOOKED"
  | "PERFORMED"
  | "CUSTOMER_CANCELLED"
  | "CLUB_CANCELLED"
  | "SAFETY_CANCELLED"
  | "REFUND_RESOLUTION"
  | "CLOSED";

export interface Appearance {
  readonly id: string;
  readonly requesterId: string | null;
  readonly memberId: string | null;
  readonly state: AppearanceState;
  readonly role: string;
  readonly location: string;
  readonly travelRequired: boolean;
  readonly priceCents: number;
  readonly createdAt: string;
}

export interface AppearanceServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

const DISALLOWED_PHRASES = [
  "police",
  "lawyer",
  "doctor",
  "nurse",
  "paramedic",
  "government",
  "immigration",
  "judge",
  "court",
  "officer",
  "detective",
  "federal",
  "minister",
  "priest",
  "rabbi",
  "imam",
  "official",
  "bank",
  "accountant",
  "auditor",
  "celebrity",
];

export class AppearanceService {
  constructor(private readonly deps: AppearanceServiceDeps) {}

  /**
   * Request an appearance. Triggers a suitability review; if any
   * disallowed phrase is present, the request is declined without a
   * quote.
   */
  async request(input: {
    readonly requesterId: string | null;
    readonly memberId: string | null;
    readonly role: string;
    readonly location: string;
    readonly travelRequired: boolean;
    readonly brief: string;
  }): Promise<Appearance> {
    if (input.memberId) {
      const decision = canPerform(
        "APPEARANCE_MEMBER_BENEFIT",
        await loadPolicyContext(this.deps.db, input.memberId, "APPEARANCE_INTEREST"),
      );
      if (!decision.allowed) throw new Error(`Appearance not allowed: ${decision.reason}`);
    }
    const id = newAppearanceId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO appearance_requests
          (id, requester_id, member_id, role, location, travel_required, brief, state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?)`,
      )
      .bind(
        id,
        input.requesterId,
        input.memberId,
        input.role,
        input.location,
        input.travelRequired ? 1 : 0,
        input.brief,
        now,
      )
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: input.memberId ?? input.requesterId,
      action: "APPEARANCE_REQUESTED",
      entityType: "APPEARANCE_REQUEST",
      entityId: id,
      fromState: null,
      toState: "REQUESTED",
      reasonCode: null,
      correlationId: null,
      metadata: { role: input.role, location: input.location },
    });

    // Suitability review.
    const declinedReason = this.findDisallowed(input.brief + " " + input.role);
    if (declinedReason) {
      await this.deps.db
        .prepare(`UPDATE appearance_requests SET state = 'SUITABILITY_DECLINED' WHERE id = ?`)
        .bind(id)
        .run();
      await this.deps.audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "APPEARANCE_DECLINED",
        entityType: "APPEARANCE_REQUEST",
        entityId: id,
        fromState: "REQUESTED",
        toState: "SUITABILITY_DECLINED",
        reasonCode: declinedReason,
        correlationId: null,
        metadata: null,
      });
      return (await this.get(id))!;
    }
    await this.deps.db
      .prepare(`UPDATE appearance_requests SET state = 'SUITABILITY_APPROVED' WHERE id = ?`)
      .bind(id)
      .run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "APPEARANCE_APPROVED",
      entityType: "APPEARANCE_REQUEST",
      entityId: id,
      fromState: "REQUESTED",
      toState: "SUITABILITY_APPROVED",
      reasonCode: "OK",
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  /**
   * Issue a quote. The price is a function of base + travel
   * surcharge; in production this is configurable and the
   * `quote_price_cents` is a parameter to this method.
   */
  async quote(
    id: string,
    basePriceCents: number,
    travelSurchargeCents: number,
  ): Promise<Appearance> {
    const a = await this.get(id);
    if (!a) throw new Error(`Unknown appearance: ${id}`);
    if (a.state !== "SUITABILITY_APPROVED") {
      throw new Error(`Cannot quote from state ${a.state}.`);
    }
    const total = basePriceCents + (a.travelRequired ? travelSurchargeCents : 0);
    await this.deps.db
      .prepare(
        `UPDATE appearance_requests SET state = 'QUOTED', quote_base_cents = ?, quote_travel_cents = ?, quote_total_cents = ?, quote_expires_at = ? WHERE id = ?`,
      )
      .bind(
        basePriceCents,
        a.travelRequired ? travelSurchargeCents : 0,
        total,
        new Date(this.deps.clock.now().getTime() + 7 * 24 * 3600 * 1000).toISOString(),
        id,
      )
      .run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: null,
      action: "APPEARANCE_QUOTED",
      entityType: "APPEARANCE_REQUEST",
      entityId: id,
      fromState: "SUITABILITY_APPROVED",
      toState: "QUOTED",
      reasonCode: "OK",
      correlationId: null,
      metadata: { total },
    });
    return (await this.get(id))!;
  }

  async accept(id: string): Promise<Appearance> {
    const a = await this.get(id);
    if (!a) throw new Error(`Unknown appearance: ${id}`);
    if (a.state !== "QUOTED") {
      throw new Error(`Cannot accept from state ${a.state}.`);
    }
    await this.deps.db
      .prepare(`UPDATE appearance_requests SET state = 'ACCEPTED' WHERE id = ?`)
      .bind(id)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: a.memberId,
      action: "APPEARANCE_ACCEPTED",
      entityType: "APPEARANCE_REQUEST",
      entityId: id,
      fromState: "QUOTED",
      toState: "ACCEPTED",
      reasonCode: "OK",
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  async paymentPending(id: string): Promise<Appearance> {
    await this.deps.db
      .prepare(`UPDATE appearance_requests SET state = 'PAYMENT_PENDING' WHERE id = ?`)
      .bind(id)
      .run();
    return (await this.get(id))!;
  }

  async paymentFailed(id: string): Promise<Appearance> {
    await this.deps.db
      .prepare(`UPDATE appearance_requests SET state = 'PAYMENT_FAILED' WHERE id = ?`)
      .bind(id)
      .run();
    return (await this.get(id))!;
  }

  async book(id: string): Promise<Appearance> {
    const a = await this.get(id);
    if (!a) throw new Error(`Unknown appearance: ${id}`);
    if (a.state !== "PAYMENT_PENDING") {
      throw new Error(`Cannot book from state ${a.state}.`);
    }
    await this.deps.db
      .prepare(`UPDATE appearance_requests SET state = 'BOOKED' WHERE id = ?`)
      .bind(id)
      .run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "APPEARANCE_BOOKED",
      entityType: "APPEARANCE_REQUEST",
      entityId: id,
      fromState: "PAYMENT_PENDING",
      toState: "BOOKED",
      reasonCode: "OK",
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  async markPerformed(id: string, operatorId: string): Promise<Appearance> {
    await this.deps.db
      .prepare(`UPDATE appearance_requests SET state = 'PERFORMED' WHERE id = ?`)
      .bind(id)
      .run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: operatorId,
      action: "APPEARANCE_PERFORMED",
      entityType: "APPEARANCE_REQUEST",
      entityId: id,
      fromState: "BOOKED",
      toState: "PERFORMED",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  async cancelByCustomer(id: string, reason: string): Promise<Appearance> {
    await this.transitionCancellation(id, "CUSTOMER_CANCELLED", reason);
    return (await this.get(id))!;
  }

  async cancelByClub(id: string, reason: string): Promise<Appearance> {
    await this.transitionCancellation(id, "CLUB_CANCELLED", reason);
    return (await this.get(id))!;
  }

  async cancelBySafety(id: string, reason: string): Promise<Appearance> {
    await this.transitionCancellation(id, "SAFETY_CANCELLED", reason);
    return (await this.get(id))!;
  }

  async resolveRefund(id: string, operatorId: string): Promise<Appearance> {
    await this.deps.db
      .prepare(`UPDATE appearance_requests SET state = 'REFUND_RESOLUTION' WHERE id = ?`)
      .bind(id)
      .run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: operatorId,
      action: "APPEARANCE_REFUND_RESOLUTION",
      entityType: "APPEARANCE_REQUEST",
      entityId: id,
      fromState: null,
      toState: "REFUND_RESOLUTION",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  async close(id: string, operatorId: string): Promise<Appearance> {
    await this.deps.db
      .prepare(`UPDATE appearance_requests SET state = 'CLOSED' WHERE id = ?`)
      .bind(id)
      .run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: operatorId,
      action: "APPEARANCE_CLOSED",
      entityType: "APPEARANCE_REQUEST",
      entityId: id,
      fromState: null,
      toState: "CLOSED",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  async get(id: string): Promise<Appearance | null> {
    const row = await this.deps.db
      .prepare(
        `SELECT id, requester_id, member_id, state, role, location, travel_required, quote_total_cents, created_at FROM appearance_requests WHERE id = ?`,
      )
      .bind(id)
      .first();
    if (!row) return null;
    return {
      id: row.id as string,
      requesterId: (row.requester_id as string | null) ?? null,
      memberId: (row.member_id as string | null) ?? null,
      state: row.state as AppearanceState,
      role: row.role as string,
      location: row.location as string,
      travelRequired: row.travel_required === 1,
      priceCents: (row.quote_total_cents as number | null) ?? 0,
      createdAt: row.created_at as string,
    };
  }

  private findDisallowed(text: string): string | null {
    const lower = text.toLowerCase();
    for (const phrase of DISALLOWED_PHRASES) {
      if (lower.includes(phrase)) return `DISALLOWED_TERM:${phrase}`;
    }
    return null;
  }

  private async transitionCancellation(
    id: string,
    to: AppearanceState,
    reason: string,
  ): Promise<void> {
    const a = await this.get(id);
    if (!a) return;
    const valid: ReadonlyArray<AppearanceState> = [
      "BOOKED",
      "PAYMENT_PENDING",
      "ACCEPTED",
      "QUOTED",
    ];
    if (!valid.includes(a.state)) {
      await this.deps.audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "APPEARANCE_CANCEL_REJECTED",
        entityType: "APPEARANCE_REQUEST",
        entityId: id,
        fromState: a.state,
        toState: to,
        reasonCode: "INVALID_FROM_STATE",
        correlationId: null,
        metadata: null,
      });
      return;
    }
    await this.deps.db
      .prepare(`UPDATE appearance_requests SET state = ? WHERE id = ?`)
      .bind(to, id)
      .run();
    await this.deps.audit.record({
      actorType: to === "CUSTOMER_CANCELLED" ? "MEMBER" : "OPERATOR",
      actorId: a.memberId,
      action: `APPEARANCE_${to}`,
      entityType: "APPEARANCE_REQUEST",
      entityId: id,
      fromState: a.state,
      toState: to,
      reasonCode: reason,
      correlationId: null,
      metadata: null,
    });
  }
}
