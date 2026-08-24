// Member memory service.
//
// Member facts (categories: pet, interest, important date, etc.)
// are stored with explicit status (CANDIDATE / CONFIRMED / REJECTED
// / REVOKED) and provenance. AI may propose CANDIDATE facts via
// the `proposeMemberFact` MCP capability. CONFIRMED truth is
// deterministic-policy-driven (member confirmation, explicit
// statement, or admin approval).
//
// See MASTER_SPEC §6.3, §8.19, §10.4, and AGENTS.md invariant 6
// ("AI may not invent member facts").

import type { D1Database } from "@cloudflare/workers-types";
import { newMemberFactId } from "../infra/ids.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";

export type MemberFactStatus = "CANDIDATE" | "CONFIRMED" | "REJECTED" | "REVOKED";

export interface MemberFact {
  readonly id: string;
  readonly memberId: string;
  readonly category: string;
  readonly subject: string;
  readonly value: unknown;
  readonly status: MemberFactStatus;
  readonly sourceType: string | null;
  readonly sourceId: string | null;
  readonly confidence: number | null;
  readonly doNotUse: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProposeFactInput {
  readonly memberId: string;
  readonly category: string;
  readonly subject: string;
  readonly value: unknown;
  readonly sourceType: "INBOUND_EMAIL" | "ONBOARDING" | "OPERATOR" | "MEMBER_SELF";
  readonly sourceId: string | null;
  readonly confidence?: number;
}

export interface ConfirmFactInput {
  readonly factId: string;
  readonly reason: string;
  /** The authenticated member for portal mutations; omitted for trusted service/operator callers. */
  readonly memberId?: string;
}

export interface RejectFactInput {
  readonly factId: string;
  readonly reason: string;
  readonly memberId?: string;
}

export interface RevokeFactInput {
  readonly factId: string;
  readonly reason: string;
  readonly memberId?: string;
}

export class MemberOwnershipError extends Error {
  constructor() {
    super("Member does not own this fact.");
    this.name = "MemberOwnershipError";
  }
}

export interface MemberMemoryDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

export class MemberMemoryService {
  constructor(private readonly deps: MemberMemoryDeps) {}

  /** AI / operator / member proposes a fact. Initial state is CANDIDATE. */
  async propose(input: ProposeFactInput): Promise<MemberFact> {
    const id = newMemberFactId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO member_facts
          (id, member_id, category, subject, value_json, status, source_type, source_id, confidence, do_not_use, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'CANDIDATE', ?, ?, ?, 0, ?, ?)`,
      )
      .bind(
        id,
        input.memberId,
        input.category,
        input.subject,
        JSON.stringify(input.value),
        input.sourceType,
        input.sourceId,
        input.confidence ?? null,
        now,
        now,
      )
      .run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "MEMBER_FACT_PROPOSED",
      entityType: "MEMBER_FACT",
      entityId: id,
      fromState: null,
      toState: "CANDIDATE",
      reasonCode: input.sourceType,
      correlationId: null,
      metadata: { memberId: input.memberId, category: input.category, subject: input.subject },
    });
    return (await this.get(id))!;
  }

  /** Member / operator explicitly confirms a candidate fact. */
  async confirm(input: ConfirmFactInput): Promise<MemberFact> {
    const fact = await this.get(input.factId);
    if (!fact) throw new Error(`Unknown fact: ${input.factId}`);
    assertFactOwnership(fact, input.memberId);
    if (fact.status === "CONFIRMED") return fact;
    if (fact.status === "REVOKED") {
      throw new Error("REVOKED facts cannot be re-confirmed; create a new fact instead.");
    }
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(`UPDATE member_facts SET status = 'CONFIRMED', updated_at = ? WHERE id = ?`)
      .bind(now, input.factId)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: fact.memberId,
      action: "MEMBER_FACT_CONFIRMED",
      entityType: "MEMBER_FACT",
      entityId: input.factId,
      fromState: fact.status,
      toState: "CONFIRMED",
      reasonCode: input.reason,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(input.factId))!;
  }

  /** Member rejects a candidate fact. Terminal. */
  async reject(input: RejectFactInput): Promise<MemberFact> {
    const fact = await this.get(input.factId);
    if (!fact) throw new Error(`Unknown fact: ${input.factId}`);
    assertFactOwnership(fact, input.memberId);
    if (fact.status === "REJECTED") return fact;
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(`UPDATE member_facts SET status = 'REJECTED', updated_at = ? WHERE id = ?`)
      .bind(now, input.factId)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: fact.memberId,
      action: "MEMBER_FACT_REJECTED",
      entityType: "MEMBER_FACT",
      entityId: input.factId,
      fromState: fact.status,
      toState: "REJECTED",
      reasonCode: input.reason,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(input.factId))!;
  }

  /** Member revokes a confirmed fact. Used for "do not mention this any more". */
  async revoke(input: RevokeFactInput): Promise<MemberFact> {
    const fact = await this.get(input.factId);
    if (!fact) throw new Error(`Unknown fact: ${input.factId}`);
    assertFactOwnership(fact, input.memberId);
    if (fact.status === "REVOKED") return fact;
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(`UPDATE member_facts SET status = 'REVOKED', updated_at = ? WHERE id = ?`)
      .bind(now, input.factId)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: fact.memberId,
      action: "MEMBER_FACT_REVOKED",
      entityType: "MEMBER_FACT",
      entityId: input.factId,
      fromState: fact.status,
      toState: "REVOKED",
      reasonCode: input.reason,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(input.factId))!;
  }

  /** Mark a fact as "do not use" without revoking the source record. */
  async setDoNotUse(
    factId: string,
    doNotUse: boolean,
    reason: string,
    memberId?: string,
  ): Promise<MemberFact> {
    const fact = await this.get(factId);
    if (!fact) throw new Error(`Unknown fact: ${factId}`);
    assertFactOwnership(fact, memberId);
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(`UPDATE member_facts SET do_not_use = ?, updated_at = ? WHERE id = ?`)
      .bind(doNotUse ? 1 : 0, now, factId)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: fact.memberId,
      action: doNotUse ? "MEMBER_FACT_DNU_SET" : "MEMBER_FACT_DNU_CLEARED",
      entityType: "MEMBER_FACT",
      entityId: factId,
      fromState: null,
      toState: null,
      reasonCode: reason,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(factId))!;
  }

  async get(factId: string): Promise<MemberFact | null> {
    const row = await this.deps.db
      .prepare(`SELECT * FROM member_facts WHERE id = ?`)
      .bind(factId)
      .first();
    if (!row) return null;
    return rowToFact(row as Record<string, unknown>);
  }

  /** All facts for a member. Used for the "What we remember about you" portal UI. */
  async listForMember(memberId: string): Promise<MemberFact[]> {
    const rows = await this.deps.db
      .prepare(`SELECT * FROM member_facts WHERE member_id = ? ORDER BY created_at DESC`)
      .bind(memberId)
      .all();
    return (rows.results ?? []).map((r) => rowToFact(r as Record<string, unknown>));
  }

  /**
   * The subset of facts safe to use in correspondence: CONFIRMED,
   * not REVOKED, and not flagged do_not_use. The single chokepoint
   * for AI and human copy that mentions a member.
   */
  async usableForMember(memberId: string): Promise<MemberFact[]> {
    const all = await this.listForMember(memberId);
    return all.filter((f) => f.status === "CONFIRMED" && !f.doNotUse);
  }
}

function assertFactOwnership(fact: MemberFact, memberId: string | undefined): void {
  if (memberId !== undefined && fact.memberId !== memberId) throw new MemberOwnershipError();
}

function rowToFact(r: Record<string, unknown>): MemberFact {
  return {
    id: r.id as string,
    memberId: r.member_id as string,
    category: r.category as string,
    subject: r.subject as string,
    value: r.value_json ? JSON.parse(r.value_json as string) : null,
    status: r.status as MemberFactStatus,
    sourceType: (r.source_type as string | null) ?? null,
    sourceId: (r.source_id as string | null) ?? null,
    confidence: (r.confidence as number | null) ?? null,
    doNotUse: r.do_not_use === 1,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
