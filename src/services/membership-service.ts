// Membership service.
//
// Implements the full onboarding state machine and the
// permissions/revocation behaviour from MASTER_SPEC §7.2, §3.15
// and AGENTS.md invariant 8 ("Optional services require entitlement
// + permission + prerequisites").
//
// Phases:
//   APPLICANT → EMAIL_VERIFIED → IDENTITY_COMPLETE →
//   CHAPTER_RESOLUTION → TIER_SELECTED → PREFERENCES_COMPLETE →
//   SERVICES_SELECTED → ALIGNMENT_COMPLETE → CONSENTS_COMPLETE →
//   TERMS_ACCEPTED → PAYMENT_PENDING → ACTIVE
//
// Each phase has its own minimal API. The single `evaluateActivation`
// method returns what is still missing.

import type { D1Database } from "@cloudflare/workers-types";
import { newMemberId, newMembershipId, newServiceGrantId, newAcceptanceId } from "../infra/ids.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";

export type MembershipState =
  | "APPLICANT"
  | "EMAIL_VERIFIED"
  | "IDENTITY_COMPLETE"
  | "CHAPTER_RESOLUTION"
  | "TIER_SELECTED"
  | "PREFERENCES_COMPLETE"
  | "SERVICES_SELECTED"
  | "ALIGNMENT_COMPLETE"
  | "CONSENTS_COMPLETE"
  | "TERMS_ACCEPTED"
  | "PAYMENT_PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELLED"
  | "WAITLIST_ONLY"
  | "ABANDONED"
  | "NOT_ACTIVATED";

export type ServiceGrantState =
  "AVAILABLE" | "OPTED_IN" | "OPTED_OUT" | "INELIGIBLE" | "PAUSED" | "SUSPENDED";

export interface Member {
  readonly id: string;
  readonly email: string;
  readonly preferredName: string | null;
  readonly postalName: string | null;
  readonly societyAlias: string | null;
  readonly country: string | null;
  readonly metroArea: string | null;
  readonly chapterId: string | null;
  readonly birthday: string | null;
  readonly timezone: string | null;
  readonly createdAt: string;
}

export interface MembershipServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

export class MembershipService {
  constructor(private readonly deps: MembershipServiceDeps) {}

  /**
   * Create a new applicant. Always begins as APPLICANT. The
   * membership row tracks onboarding progress.
   */
  async createApplicant(input: {
    email: string;
    preferredName?: string;
  }): Promise<{ member: Member; membershipId: string; state: MembershipState }> {
    const id = newMemberId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO members (id, email, preferred_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, input.email.toLowerCase(), input.preferredName ?? null, now, now)
      .run();
    const membershipId = newMembershipId();
    await this.deps.db
      .prepare(
        `INSERT INTO memberships (id, member_id, tier_id, state, created_at, updated_at)
         VALUES (?, ?, NULL, 'APPLICANT', ?, ?)`,
      )
      .bind(membershipId, id, now, now)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: id,
      action: "MEMBER_APPLICANT_CREATED",
      entityType: "MEMBER",
      entityId: id,
      fromState: null,
      toState: "APPLICANT",
      reasonCode: null,
      correlationId: null,
      metadata: { email: input.email.toLowerCase() },
    });
    const member = (await this.get(id))!;
    return { member, membershipId, state: "APPLICANT" };
  }

  async setIdentity(
    id: string,
    input: {
      preferredName?: string;
      postalName?: string;
      societyAlias?: string;
      country?: string;
      metroArea?: string;
      birthday?: string;
      timezone?: string;
    },
  ): Promise<Member> {
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `UPDATE members SET
          preferred_name = COALESCE(?, preferred_name),
          postal_name = COALESCE(?, postal_name),
          society_alias = COALESCE(?, society_alias),
          country = COALESCE(?, country),
          metro_area = COALESCE(?, metro_area),
          birthday = COALESCE(?, birthday),
          timezone = COALESCE(?, timezone),
          updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        input.preferredName ?? null,
        input.postalName ?? null,
        input.societyAlias ?? null,
        input.country ?? null,
        input.metroArea ?? null,
        input.birthday ?? null,
        input.timezone ?? null,
        now,
        id,
      )
      .run();
    return (await this.get(id))!;
  }

  /**
   * Advance to IDENTITY_COMPLETE. Used by the onboarding wizard
   * after the identity form is saved.
   */
  async advanceIdentity(memberId: string, audit: AuditWriter): Promise<void> {
    await this.advanceTo(memberId, "IDENTITY_COMPLETE", audit);
  }

  /**
   * Advance to ALIGNMENT_COMPLETE after the plain-language
   * acknowledgement is saved.
   */
  async advanceAlignment(memberId: string, audit: AuditWriter): Promise<void> {
    await this.advanceTo(memberId, "ALIGNMENT_COMPLETE", audit);
  }

  async setChapter(id: string, chapterId: string): Promise<Member> {
    const now = this.deps.clock.nowIso();
    const chapter = await this.deps.db
      .prepare(`SELECT id, status FROM chapters WHERE id = ? OR slug = ?`)
      .bind(chapterId, chapterId)
      .first<{ id: string; status: string }>();
    if (!chapter) throw new Error(`Unknown chapter: ${chapterId}`);
    await this.deps.db
      .prepare(`UPDATE members SET chapter_id = ?, updated_at = ? WHERE id = ?`)
      .bind(chapter.id, now, id)
      .run();
    if (chapter.status === "WAITLIST_ONLY") {
      await this.advance(id, "WAITLIST_ONLY");
    } else {
      await this.advance(id, "CHAPTER_RESOLUTION");
    }
    return (await this.get(id))!;
  }

  async selectTier(memberId: string, tierId: string): Promise<Member> {
    const tier = await this.deps.db
      .prepare(`SELECT id, slug FROM membership_tiers WHERE id = ? OR slug = ?`)
      .bind(tierId, tierId)
      .first<{ id: string; slug: string }>();
    if (!tier) throw new Error(`Unknown tier: ${tierId}`);
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `UPDATE memberships SET tier_id = ?, updated_at = ? WHERE member_id = ? AND state NOT IN ('ACTIVE', 'CANCELLED', 'ABANDONED')`,
      )
      .bind(tier.id, now, memberId)
      .run();
    await this.advance(memberId, "TIER_SELECTED");
    return (await this.get(memberId))!;
  }

  async completePreferences(memberId: string): Promise<void> {
    await this.advance(memberId, "PREFERENCES_COMPLETE");
  }

  async completeServices(memberId: string): Promise<void> {
    await this.advance(memberId, "SERVICES_SELECTED");
  }

  async completeAlignment(memberId: string): Promise<void> {
    await this.advance(memberId, "ALIGNMENT_COMPLETE");
  }

  async completeConsents(memberId: string, documentIds: ReadonlyArray<string>): Promise<void> {
    const now = this.deps.clock.nowIso();
    for (const docId of documentIds) {
      await this.deps.db
        .prepare(
          `INSERT OR IGNORE INTO member_acceptances (id, member_id, document_id, accepted_at, method)
           VALUES (?, ?, ?, ?, 'WEB')`,
        )
        .bind(newAcceptanceId(), memberId, docId, now)
        .run();
    }
    await this.advance(memberId, "CONSENTS_COMPLETE");
  }

  async acceptTerms(memberId: string, documentIds: ReadonlyArray<string>): Promise<void> {
    const now = this.deps.clock.nowIso();
    for (const docId of documentIds) {
      await this.deps.db
        .prepare(
          `INSERT OR IGNORE INTO member_acceptances (id, member_id, document_id, accepted_at, method)
           VALUES (?, ?, ?, ?, 'WEB')`,
        )
        .bind(newAcceptanceId(), memberId, docId, now)
        .run();
    }
    await this.advance(memberId, "TERMS_ACCEPTED");
  }

  /**
   * Mark payment as pending. Used by the Stripe webhook before
   * authoritative activation. In MVP (no Stripe) this is a
   * deterministic flag for fake billing in tests.
   */
  async paymentPending(memberId: string): Promise<void> {
    await this.advance(memberId, "PAYMENT_PENDING");
  }

  /**
   * Authoritative activation. Stripe webhook calls this after
   * verifying a successful invoice payment. No browser success
   * can activate membership.
   */
  async activate(memberId: string): Promise<void> {
    const now = this.deps.clock.nowIso();
    const row = await this.deps.db
      .prepare(`SELECT started_at FROM memberships WHERE member_id = ?`)
      .bind(memberId)
      .first<{ started_at: string | null }>();
    const startedAt = row?.started_at ?? now;
    await this.deps.db
      .prepare(
        `UPDATE memberships SET state = 'ACTIVE', started_at = ?, updated_at = ? WHERE member_id = ?`,
      )
      .bind(startedAt, now, memberId)
      .run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "MEMBERSHIP_ACTIVATED",
      entityType: "MEMBER",
      entityId: memberId,
      fromState: null,
      toState: "ACTIVE",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
  }

  async suspend(memberId: string, reason: string): Promise<void> {
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(`UPDATE memberships SET state = 'SUSPENDED', updated_at = ? WHERE member_id = ?`)
      .bind(now, memberId)
      .run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "MEMBERSHIP_SUSPENDED",
      entityType: "MEMBER",
      entityId: memberId,
      fromState: "ACTIVE",
      toState: "SUSPENDED",
      reasonCode: reason,
      correlationId: null,
      metadata: null,
    });
  }

  async cancel(memberId: string, reason: string): Promise<void> {
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `UPDATE memberships SET state = 'CANCELLED', ended_at = ?, updated_at = ? WHERE member_id = ?`,
      )
      .bind(now, now, memberId)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: memberId,
      action: "MEMBERSHIP_CANCELLED",
      entityType: "MEMBER",
      entityId: memberId,
      fromState: "ACTIVE",
      toState: "CANCELLED",
      reasonCode: reason,
      correlationId: null,
      metadata: null,
    });
  }

  /**
   * Set the state of a single service grant for a member. The
   * service grant is the on/off switch for optional services; the
   * tier capability is the ceiling.
   */
  async setServiceGrant(
    memberId: string,
    service: string,
    state: ServiceGrantState,
  ): Promise<void> {
    const id = newServiceGrantId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO service_grants (id, member_id, service, state, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(member_id, service) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
      )
      .bind(id, memberId, service, state, now)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: memberId,
      action: "SERVICE_GRANT_UPDATED",
      entityType: "SERVICE_GRANT",
      entityId: null,
      fromState: null,
      toState: state,
      reasonCode: service,
      correlationId: null,
      metadata: { service },
    });
  }

  async getServiceGrant(memberId: string, service: string): Promise<ServiceGrantState | null> {
    const row = await this.deps.db
      .prepare(`SELECT state FROM service_grants WHERE member_id = ? AND service = ?`)
      .bind(memberId, service)
      .first<{ state: ServiceGrantState }>();
    return row?.state ?? null;
  }

  async getMemberState(memberId: string): Promise<MembershipState | null> {
    const row = await this.deps.db
      .prepare(`SELECT state FROM memberships WHERE member_id = ?`)
      .bind(memberId)
      .first<{ state: MembershipState }>();
    return row?.state ?? null;
  }

  async get(memberId: string): Promise<Member | null> {
    const row = await this.deps.db
      .prepare(`SELECT * FROM members WHERE id = ?`)
      .bind(memberId)
      .first();
    if (!row) return null;
    return rowToMember(row as Record<string, unknown>);
  }

  /**
   * Evaluate what is still required for a member to reach ACTIVE.
   * Used by the onboarding UI to render "what's left" and by tests.
   */
  async evaluateActivation(memberId: string): Promise<{
    ready: boolean;
    state: MembershipState;
    blockers: string[];
  }> {
    const m = await this.get(memberId);
    if (!m) return { ready: false, state: "ABANDONED", blockers: ["member_not_found"] };
    const row = await this.deps.db
      .prepare(`SELECT state FROM memberships WHERE member_id = ?`)
      .bind(memberId)
      .first<{ state: MembershipState }>();
    const state: MembershipState = row?.state ?? "ABANDONED";
    const blockers: string[] = [];
    if (!m.preferredName) blockers.push("identity: preferred_name");
    if (!m.country) blockers.push("identity: country");
    if (!m.chapterId) blockers.push("chapter: not set");
    const chapter = m.chapterId
      ? await this.deps.db
          .prepare(`SELECT status FROM chapters WHERE id = ?`)
          .bind(m.chapterId)
          .first<{ status: string }>()
      : null;
    if (chapter && chapter.status !== "ACTIVE") blockers.push("chapter: not ACTIVE");
    const tier = await this.deps.db
      .prepare(`SELECT tier_id FROM memberships WHERE member_id = ?`)
      .bind(memberId)
      .first<{ tier_id: string | null }>();
    if (!tier?.tier_id) blockers.push("tier: not selected");
    const acceptanceCount = await this.deps.db
      .prepare(`SELECT COUNT(*) AS n FROM member_acceptances WHERE member_id = ?`)
      .bind(memberId)
      .first<{ n: number }>();
    if (!acceptanceCount || acceptanceCount.n < 1) blockers.push("terms: not accepted");
    if (state === "ACTIVE") return { ready: true, state, blockers: [] };
    return { ready: blockers.length === 0, state, blockers };
  }

  /**
   * Advance the membership state via the documented transitions.
   * Invalid transitions are recorded in the audit log and silently
   * ignored — the row's state is unchanged.
   */
  private async advance(memberId: string, to: MembershipState): Promise<void> {
    await this.advanceTo(memberId, to, this.deps.audit);
  }

  /**
   * Public variant of advance() that takes an explicit audit
   * writer. Used by the onboarding wizard so a single audit
   * session can be reused across many step transitions.
   */
  async advanceTo(memberId: string, to: MembershipState, audit: AuditWriter): Promise<void> {
    const validFrom: Record<MembershipState, MembershipState[]> = {
      APPLICANT: ["EMAIL_VERIFIED", "ABANDONED"],
      EMAIL_VERIFIED: ["IDENTITY_COMPLETE", "ABANDONED"],
      IDENTITY_COMPLETE: ["CHAPTER_RESOLUTION", "ABANDONED"],
      CHAPTER_RESOLUTION: ["TIER_SELECTED", "WAITLIST_ONLY", "ABANDONED"],
      TIER_SELECTED: ["PREFERENCES_COMPLETE", "ABANDONED"],
      PREFERENCES_COMPLETE: ["SERVICES_SELECTED", "ABANDONED"],
      SERVICES_SELECTED: ["ALIGNMENT_COMPLETE", "ABANDONED"],
      ALIGNMENT_COMPLETE: ["CONSENTS_COMPLETE", "ABANDONED"],
      CONSENTS_COMPLETE: ["TERMS_ACCEPTED", "ABANDONED"],
      TERMS_ACCEPTED: ["PAYMENT_PENDING", "ABANDONED"],
      PAYMENT_PENDING: ["ACTIVE", "NOT_ACTIVATED", "ABANDONED"],
      ACTIVE: ["PAST_DUE", "SUSPENDED", "CANCELLED"],
      PAST_DUE: ["ACTIVE", "SUSPENDED", "CANCELLED"],
      SUSPENDED: ["ACTIVE", "CANCELLED"],
      CANCELLED: [],
      WAITLIST_ONLY: [],
      ABANDONED: [],
      NOT_ACTIVATED: [],
    };
    const row = await this.deps.db
      .prepare(`SELECT state FROM memberships WHERE member_id = ?`)
      .bind(memberId)
      .first<{ state: MembershipState }>();
    if (!row) return;
    const from = row.state;
    if (!validFrom[from]?.includes(to)) {
      await audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "MEMBERSHIP_TRANSITION_REJECTED",
        entityType: "MEMBER",
        entityId: memberId,
        fromState: from,
        toState: to,
        reasonCode: "INVALID_TRANSITION",
        correlationId: null,
        metadata: null,
      });
      return;
    }
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(`UPDATE memberships SET state = ?, updated_at = ? WHERE member_id = ?`)
      .bind(to, now, memberId)
      .run();
    await audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "MEMBERSHIP_TRANSITION",
      entityType: "MEMBER",
      entityId: memberId,
      fromState: from,
      toState: to,
      reasonCode: "OK",
      correlationId: null,
      metadata: null,
    });
  }
}

function rowToMember(r: Record<string, unknown>): Member {
  return {
    id: r.id as string,
    email: r.email as string,
    preferredName: (r.preferred_name as string | null) ?? null,
    postalName: (r.postal_name as string | null) ?? null,
    societyAlias: (r.society_alias as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    metroArea: (r.metro_area as string | null) ?? null,
    chapterId: (r.chapter_id as string | null) ?? null,
    birthday: (r.birthday as string | null) ?? null,
    timezone: (r.timezone as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}
