// Milestone engine.
//
// Members experience milestones on dates that matter to them:
// birthday, join anniversary, 3/6/12 months tenure, multi-year
// tenure, and special Society dates. The engine is data-driven:
// the actions to take for a milestone are computed by policy
// (tier, opt-in, budget) not hard-coded.
//
// A milestone is idempotent on (member_id, trigger_type, triggered_on).
// One failed channel must not erase the whole milestone.
//
// Per MASTER_SPEC §2.8, §7.7, §8.15.

import type { D1Database } from "@cloudflare/workers-types";
import { newCommunicationId, newFulfilmentId, newMilestoneId } from "../infra/ids.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";

export type MilestoneTriggerType =
  | "BIRTHDAY"
  | "JOIN_ANNIVERSARY"
  | "TENURE_3_MONTHS"
  | "TENURE_6_MONTHS"
  | "TENURE_1_YEAR"
  | "TENURE_3_YEARS"
  | "TENURE_5_YEARS"
  | "TENURE_10_YEARS"
  | "CUSTOM";

export interface MilestoneAction {
  readonly channel: "EMAIL" | "POSTAL" | "GIFT" | "CALL" | "TASK";
  readonly detail: string;
  readonly subject: string;
}

export interface MilestoneServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

export class MilestoneService {
  constructor(private readonly deps: MilestoneServiceDeps) {}

  /**
   * Resolve the actions for a milestone given the member's tier,
   * service grants, preferences and budget. The result is the
   * canonical action list. Channels can fail independently.
   */
  async planActions(memberId: string, trigger: MilestoneTriggerType): Promise<MilestoneAction[]> {
    const member = await this.deps.db
      .prepare(`SELECT * FROM members WHERE id = ?`)
      .bind(memberId)
      .first<Record<string, unknown>>();
    if (!member) return [];
    // Two-step query (no JOIN): the mock D1 doesn't handle JOIN, and
    // the real D1 doesn't care — both reads are cheap.
    const membership = await this.deps.db
      .prepare(`SELECT tier_id FROM memberships WHERE member_id = ?`)
      .bind(memberId)
      .first<{ tier_id: string | null }>();
    let tierPrice = 0;
    if (membership?.tier_id) {
      const tier = await this.deps.db
        .prepare(`SELECT price_cents FROM membership_tiers WHERE id = ?`)
        .bind(membership.tier_id)
        .first<{ price_cents: number }>();
      tierPrice = tier?.price_cents ?? 0;
    }
    const grant = (service: string) =>
      this.deps.db
        .prepare(`SELECT state FROM service_grants WHERE member_id = ? AND service = ?`)
        .bind(memberId, service)
        .first<{ state: string }>();
    const actions: MilestoneAction[] = [];

    // Every tier: EMAIL.
    actions.push({
      channel: "EMAIL",
      subject: `Your ${labelForTrigger(trigger)} from the ${shortBrand()}`,
      detail: "A personalised digital note from the Society.",
    });

    // A$20+: POSTAL if PHYSICAL_CORRESPONDENCE is OPTED_IN.
    if (tierPrice >= 2000) {
      const g = await grant("PHYSICAL_CORRESPONDENCE");
      if (g?.state === "OPTED_IN") {
        actions.push({
          channel: "POSTAL",
          subject: "Posted card",
          detail: "A physical card is printed, signed and posted.",
        });
        // Create a fulfilment task.
        await this.createFulfilmentTask(memberId, "PRINT_AND_SIGN", trigger);
      }
    }

    // A$50+: GIFT if GIFTS is OPTED_IN.
    if (tierPrice >= 5000 && trigger === "BIRTHDAY") {
      const g = await grant("GIFTS");
      if (g?.state === "OPTED_IN") {
        actions.push({
          channel: "GIFT",
          subject: "Birthday gift",
          detail: "A thoughtful gift is selected and dispatched.",
        });
        await this.createFulfilmentTask(memberId, "SELECT_GIFT", trigger);
      }
    }

    // A$50+: CALL if calls entitlement + opt-in + birthday/milestone.
    if (tierPrice >= 5000 && (trigger === "BIRTHDAY" || trigger === "TENURE_1_YEAR")) {
      const g = await grant("CALLS");
      if (g?.state === "OPTED_IN") {
        actions.push({
          channel: "CALL",
          subject: "Birthday call",
          detail: "An opt-in call at a permitted window.",
        });
        await this.createFulfilmentTask(memberId, "MAKE_CALL", trigger);
      }
    }
    return actions;
  }

  /**
   * Materialise a milestone for one member. Idempotent on
   * (member_id, trigger_type, triggered_on).
   */
  async realise(
    memberId: string,
    trigger: MilestoneTriggerType,
    triggeredOn: string,
  ): Promise<{ created: boolean; actions: MilestoneAction[] }> {
    const existing = await this.deps.db
      .prepare(
        `SELECT id FROM member_milestones WHERE member_id = ? AND trigger_type = ? AND triggered_on = ?`,
      )
      .bind(memberId, trigger, triggeredOn)
      .first<{ id: string }>();
    if (existing) {
      return { created: false, actions: [] };
    }
    const id = newMilestoneId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO member_milestones (id, member_id, trigger_type, triggered_on, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, memberId, trigger, triggeredOn, now)
      .run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "MILESTONE_REALISED",
      entityType: "MEMBER_MILESTONE",
      entityId: id,
      fromState: null,
      toState: trigger,
      reasonCode: "OK",
      correlationId: null,
      metadata: { memberId, triggeredOn },
    });
    const actions = await this.planActions(memberId, trigger);
    for (const a of actions) {
      if (a.channel === "EMAIL") {
        const commId = newCommunicationId();
        await this.deps.db
          .prepare(
            `INSERT INTO communications
              (id, member_id, channel, template_key, state, related_entity_type, related_entity_id,
               metadata_json, created_at)
             VALUES (?, ?, 'EMAIL', 'BIRTHDAY', 'SCHEDULED', 'MEMBER_MILESTONE', ?, ?, ?)`,
          )
          .bind(commId, memberId, id, JSON.stringify({ subject: a.subject, detail: a.detail }), now)
          .run();
      }
    }
    return { created: true, actions };
  }

  /**
   * Scan for milestones due today. Run from cron.
   */
  async scanDueMilestones(): Promise<{ realised: number }> {
    const today = this.deps.clock.now().toISOString().slice(0, 10);
    const members = await this.deps.db
      .prepare(
        `SELECT m.id, m.birthday, m.created_at
           FROM members m JOIN memberships ms ON ms.member_id = m.id
           WHERE ms.state = 'ACTIVE'`,
      )
      .all<{ id: string; birthday: string | null; created_at: string }>();
    let realised = 0;
    for (const m of members.results ?? []) {
      // Birthday.
      if (m.birthday) {
        const md = m.birthday.slice(5); // MM-DD
        const todayMd = today.slice(5);
        if (md === todayMd) {
          const r = await this.realise(m.id, "BIRTHDAY", today);
          if (r.created) realised++;
        }
      }
      // Tenure milestones.
      const joined = new Date(m.created_at);
      const now = this.deps.clock.now();
      const months =
        (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth());
      const tenureMap: Array<[MilestoneTriggerType, number]> = [
        ["TENURE_3_MONTHS", 3],
        ["TENURE_6_MONTHS", 6],
        ["TENURE_1_YEAR", 12],
        ["TENURE_3_YEARS", 36],
        ["TENURE_5_YEARS", 60],
        ["TENURE_10_YEARS", 120],
      ];
      for (const [tt, monthsRequired] of tenureMap) {
        if (months >= monthsRequired) {
          const r = await this.realise(m.id, tt, today);
          if (r.created) realised++;
        }
      }
    }
    return { realised };
  }

  private async createFulfilmentTask(
    memberId: string,
    type: string,
    trigger: string,
  ): Promise<void> {
    const id = newFulfilmentId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO fulfilment_tasks
          (id, member_id, task_type, state, context_json, deadline, created_at)
         VALUES (?, ?, ?, 'CREATED', ?, NULL, ?)`,
      )
      .bind(id, memberId, type, JSON.stringify({ trigger }), now)
      .run();
  }
}

function shortBrand(): string {
  return "Society";
}

function labelForTrigger(t: MilestoneTriggerType): string {
  switch (t) {
    case "BIRTHDAY":
      return "birthday";
    case "JOIN_ANNIVERSARY":
      return "anniversary";
    case "TENURE_3_MONTHS":
      return "3-month tenure";
    case "TENURE_6_MONTHS":
      return "6-month tenure";
    case "TENURE_1_YEAR":
      return "1-year anniversary";
    case "TENURE_3_YEARS":
      return "3-year anniversary";
    case "TENURE_5_YEARS":
      return "5-year anniversary";
    case "TENURE_10_YEARS":
      return "10-year anniversary";
    default:
      return "milestone";
  }
}
