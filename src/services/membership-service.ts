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

import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
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

const ONBOARDING_UNSELECTED_TIER_ID = "tier_onboarding_unselected";
const ONBOARDING_UNSELECTED_TIER_SLUG = "__onboarding_unselected";

const REQUIRED_ONBOARDING_STEPS = [
  "identity",
  "chapter",
  "tier",
  "why",
  "plain-language",
  "terms",
] as const;

const REQUIRED_LEGAL_DOCUMENTS = [
  { type: "TERMS", label: "terms" },
  { type: "PRIVACY_POLICY", label: "privacy" },
  { type: "THEATRICAL_EXPERIENCE_ACKNOWLEDGEMENT", label: "theatrical acknowledgement" },
] as const;

export interface ActivationCheckOptions {
  /** Used by the billing adapter before it marks the payment's subscription active. */
  readonly requireActiveBilling?: boolean;
  readonly expectedSubscriptionId?: string | null;
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
         VALUES (?, ?, ?, 'APPLICANT', ?, ?)`,
      )
      .bind(membershipId, id, ONBOARDING_UNSELECTED_TIER_ID, now, now)
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
    if (
      tier.id === ONBOARDING_UNSELECTED_TIER_ID ||
      tier.slug === ONBOARDING_UNSELECTED_TIER_SLUG
    ) {
      throw new Error("The onboarding sentinel is not a selectable membership tier.");
    }
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
    const blockers = await this.getActivationBlockers(memberId);
    if (blockers.length > 0) {
      throw new Error(`Membership activation blocked: ${blockers.join(", ")}`);
    }
    const now = this.deps.clock.nowIso();
    const row = await this.deps.db
      .prepare(`SELECT state, started_at FROM memberships WHERE member_id = ?`)
      .bind(memberId)
      .first<{ state: MembershipState; started_at: string | null }>();
    if (!row) throw new Error("Membership activation blocked: membership_not_found");
    if (row.state === "ACTIVE") return;
    if (!["PAYMENT_PENDING", "PAST_DUE", "SUSPENDED"].includes(row.state)) {
      throw new Error(`Membership activation blocked: invalid_state:${row.state}`);
    }
    const startedAt = row?.started_at ?? now;
    await this.deps.db
      .prepare(
        `UPDATE memberships SET state = 'ACTIVE', started_at = ?, updated_at = ?
         WHERE member_id = ? AND state = ?`,
      )
      .bind(startedAt, now, memberId, row.state)
      .run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "MEMBERSHIP_ACTIVATED",
      entityType: "MEMBER",
      entityId: memberId,
      fromState: row.state,
      toState: "ACTIVE",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
  }

  /**
   * Return the authoritative reasons a membership cannot become ACTIVE.
   * This is deliberately a D1 read rather than a state-name shortcut: an
   * ACTIVE row without onboarding, legal, entitlement, or billing evidence
   * is not a valid active membership.
   */
  async getActivationBlockers(
    memberId: string,
    options: ActivationCheckOptions = {},
  ): Promise<string[]> {
    const blockers: string[] = [];
    const member = await this.deps.db
      .prepare(`SELECT preferred_name, country, chapter_id FROM members WHERE id = ?`)
      .bind(memberId)
      .first<{
        preferred_name: string | null;
        country: string | null;
        chapter_id: string | null;
      }>();
    if (!member) return ["member_not_found"];

    const membership = await this.deps.db
      .prepare(
        `SELECT state, tier_id FROM memberships WHERE member_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(memberId)
      .first<{ state: MembershipState; tier_id: string }>();
    if (!membership) return ["membership_not_found"];
    if (!["PAYMENT_PENDING", "PAST_DUE", "SUSPENDED", "ACTIVE"].includes(membership.state)) {
      blockers.push(`membership_state:${membership.state}`);
    }
    if (!member.preferred_name) blockers.push("identity:preferred_name");
    if (!member.country) blockers.push("identity:country");
    if (!member.chapter_id) {
      blockers.push("chapter:not_set");
    } else {
      const chapter = await this.deps.db
        .prepare(`SELECT status FROM chapters WHERE id = ?`)
        .bind(member.chapter_id)
        .first<{ status: string }>();
      if (chapter?.status !== "ACTIVE") blockers.push("chapter:not_active");
    }

    const tier = await this.deps.db
      .prepare(`SELECT id FROM membership_tiers WHERE id = ?`)
      .bind(membership.tier_id)
      .first<{ id: string }>();
    if (!tier || membership.tier_id === ONBOARDING_UNSELECTED_TIER_ID) {
      blockers.push("tier:not_selected");
    }

    const completedSteps = await this.deps.db
      .prepare(`SELECT step, data_json FROM onboarding_step_data WHERE member_id = ?`)
      .bind(memberId)
      .all<{ step: string; data_json: string }>();
    const stepData = new Map(
      (completedSteps.results ?? []).map((row) => [row.step, row.data_json]),
    );
    for (const step of REQUIRED_ONBOARDING_STEPS) {
      const data = stepData.get(step);
      if (!data) {
        blockers.push(`onboarding:${step}`);
        continue;
      }
      try {
        const parsed = JSON.parse(data) as unknown;
        if (!parsed || typeof parsed !== "object") blockers.push(`onboarding:${step}`);
      } catch {
        blockers.push(`onboarding:${step}`);
      }
    }

    for (const required of REQUIRED_LEGAL_DOCUMENTS) {
      const document = await this.deps.db
        .prepare(
          `SELECT id, effective_at FROM legal_documents
           WHERE doc_type = ? ORDER BY effective_at DESC LIMIT 1`,
        )
        .bind(required.type)
        .first<{ id: string; effective_at: string }>();
      if (!document) {
        blockers.push(`legal:${required.label}`);
        continue;
      }
      const acceptance = await this.deps.db
        .prepare(
          `SELECT accepted_at FROM member_acceptances
           WHERE member_id = ? AND document_id = ? AND accepted_at >= ? LIMIT 1`,
        )
        .bind(memberId, document.id, document.effective_at)
        .first<{ accepted_at: string }>();
      if (!acceptance) blockers.push(`legal:${required.label}`);
    }

    const subscription = await this.deps.db
      .prepare(
        `SELECT id, provider, provider_customer_id, provider_subscription_id, tier_id, status
         FROM subscriptions WHERE member_id = ? ORDER BY updated_at DESC LIMIT 1`,
      )
      .bind(memberId)
      .first<{
        id: string;
        provider: string;
        provider_customer_id: string;
        provider_subscription_id: string;
        tier_id: string;
        status: string;
      }>();
    if (!subscription) {
      blockers.push("billing:subscription_missing");
    } else {
      if (
        options.expectedSubscriptionId &&
        subscription.provider_subscription_id !== options.expectedSubscriptionId
      ) {
        blockers.push("billing:subscription_mismatch");
      }
      if (options.requireActiveBilling !== false && subscription.status !== "ACTIVE") {
        blockers.push(`billing:subscription_${subscription.status.toLowerCase()}`);
      }
      if (subscription.tier_id !== membership.tier_id) blockers.push("billing:tier_mismatch");
      if (
        !subscription.provider ||
        !subscription.provider_customer_id ||
        !subscription.provider_subscription_id
      ) {
        blockers.push("billing:subscription_invalid");
      }
      const customer = await this.deps.db
        .prepare(
          `SELECT id FROM billing_customers
           WHERE member_id = ? AND provider = ? AND provider_customer_id = ? LIMIT 1`,
        )
        .bind(memberId, subscription.provider, subscription.provider_customer_id)
        .first<{ id: string }>();
      if (!customer) blockers.push("billing:customer_missing");
    }

    return blockers;
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
    if (state === "OPTED_OUT" || state === "SUSPENDED" || state === "PAUSED") {
      await this.cancelFutureWorkForRevokedService(memberId, service, state);
    }
  }

  private async cancelFutureWorkForRevokedService(
    memberId: string,
    service: string,
    state: ServiceGrantState,
  ): Promise<void> {
    let affected = 0;
    const count = async (statement: D1PreparedStatement): Promise<void> => {
      const result = await statement.run();
      affected += result.meta.changes ?? 0;
    };

    if (service === "GIFTS") {
      await count(
        this.deps.db
          .prepare(
            `UPDATE gifts SET state = 'CANCELLED'
              WHERE member_id = ? AND state NOT IN ('DELIVERED', 'CANCELLED')`,
          )
          .bind(memberId),
      );
    } else if (service === "CALLS") {
      await count(
        this.deps.db
          .prepare(
            `UPDATE calls SET state = 'PERMISSION_REVOKED'
              WHERE member_id = ? AND state NOT IN ('COMPLETED', 'CLOSED', 'PERMISSION_REVOKED')`,
          )
          .bind(memberId),
      );
      await count(
        this.deps.db
          .prepare(
            `UPDATE fulfilment_tasks SET state = 'CANCELLED'
              WHERE member_id = ? AND task_type = 'MAKE_CALL'
                AND state NOT IN ('COMPLETED', 'CANCELLED')`,
          )
          .bind(memberId),
      );
    } else if (service === "MANUFACTURED_COMMITMENTS") {
      await count(
        this.deps.db
          .prepare(
            `UPDATE commitment_scenarios SET state = 'ABORTED', completed_at = ?
              WHERE member_id = ? AND state NOT IN ('COMPLETED', 'ABORTED', 'DECLINED')`,
          )
          .bind(this.deps.clock.nowIso(), memberId),
      );
    } else if (service === "APPEARANCE_INTEREST") {
      await count(
        this.deps.db
          .prepare(
            `UPDATE appearance_requests SET state = 'CLUB_CANCELLED'
              WHERE member_id = ?
                AND state NOT IN ('PERFORMED','CUSTOMER_CANCELLED','CLUB_CANCELLED','SAFETY_CANCELLED','REFUND_RESOLUTION','CLOSED')`,
          )
          .bind(memberId),
      );
    } else {
      const channel = service === "CALENDAR_MESSAGES" ? "CALENDAR" : null;
      await count(
        this.deps.db
          .prepare(
            `UPDATE communications SET state = 'CANCELLED_BEFORE_SEND'
              WHERE member_id = ?
                AND state IN ('DRAFT','GENERATED','VALIDATED','SCHEDULED','QUEUED','TRANSIENT_FAILURE')
                AND (? IS NULL OR channel = ?)`,
          )
          .bind(memberId, channel, channel),
      );
    }

    await count(
      this.deps.db
        .prepare(
          `UPDATE jobs SET state = 'DEAD_LETTER', failure_reason = 'PERMISSION_REVOKED',
              payload_json = NULL, completed_at = ?
            WHERE state IN ('AVAILABLE','CLAIMED','RUNNING')
              AND (entity_id = ? OR payload_json LIKE ?)`,
        )
        .bind(this.deps.clock.nowIso(), memberId, `%${memberId}%`),
    );
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: memberId,
      action: "SERVICE_FUTURE_WORK_CANCELLED",
      entityType: "SERVICE_GRANT",
      entityId: null,
      fromState: null,
      toState: state,
      reasonCode: service,
      correlationId: null,
      metadata: { service, affected },
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
    const row = await this.deps.db
      .prepare(`SELECT state FROM memberships WHERE member_id = ?`)
      .bind(memberId)
      .first<{ state: MembershipState }>();
    const state: MembershipState = row?.state ?? "ABANDONED";
    const blockers = await this.getActivationBlockers(memberId);
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
