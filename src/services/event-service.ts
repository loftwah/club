// Event service.
//
// Orchestrates the full ordinary-event lifecycle. The state machine
// in `src/domain/machines/events.ts` is the source of truth for
// state transitions; this service adds the database persistence,
// invitation creation, communication enqueueing, and safety
// monitoring required to actually run an event end to end.
//
// Per AGENTS.md invariants 1-3, ordinary events have no attendance
// state and cancellation is successful fulfilment.

import type { D1Database } from "@cloudflare/workers-types";
import { newCommunicationId, newEventId, newInvitationId } from "../infra/ids.js";
import {
  ordinaryEventMachine,
  type EventState,
  type EventEvent,
} from "../domain/machines/events.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";
import { canPerform } from "../domain/policy.js";
import { loadPolicyContext } from "../domain/policy-context.js";
import { calendarUid, renderIcs, type IcsEvent } from "../lib/calendar.js";
import { brand } from "../brand/config.js";

export interface CreateEventInput {
  readonly chapterId: string;
  readonly title: string;
  readonly eventType: string;
  readonly description?: string;
  readonly startAt: string; // ISO UTC
  readonly durationMinutes: number;
  readonly locationIds: ReadonlyArray<string>;
  readonly dressGuidance?: string | null;
  readonly createdByActor: string;
  readonly cancellationWindowHours?: number;
}

export interface OrdinaryEvent {
  readonly id: string;
  readonly state: EventState;
  readonly title: string;
  readonly chapterId: string;
  readonly startAt: string;
  readonly durationMinutes: number;
  readonly cancellationDueAt: string;
  readonly cancelledAt: string | null;
}

export interface EventServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly appBaseUrl: string;
  readonly fromAddress: string;
}

export class EventService {
  constructor(private readonly deps: EventServiceDeps) {}

  /**
   * Propose a new event. Validates locations, persists it in DRAFT,
   * then transitions to VALIDATING and APPROVED.
   */
  async create(input: CreateEventInput): Promise<OrdinaryEvent> {
    if (input.locationIds.length === 0) {
      throw new Error("At least one location is required.");
    }
    if (new Date(input.startAt).getTime() <= this.deps.clock.now().getTime()) {
      throw new Error("Event must be in the future.");
    }
    if (input.durationMinutes <= 0 || input.durationMinutes > 60 * 12) {
      throw new Error("Event duration must be 1-720 minutes.");
    }
    // Validate locations.
    for (const locId of input.locationIds) {
      const loc = await this.deps.db
        .prepare(`SELECT id, status, chapter_id FROM locations WHERE id = ?`)
        .bind(locId)
        .first<{ id: string; status: string; chapter_id: string }>();
      if (!loc) throw new Error(`Unknown location: ${locId}`);
      if (loc.status === "RETIRED") {
        throw new Error(`Location ${locId} is retired and cannot be used.`);
      }
      if (loc.chapter_id !== input.chapterId) {
        throw new Error(`Location ${locId} does not belong to chapter ${input.chapterId}.`);
      }
    }

    const id = newEventId();
    const now = this.deps.clock.nowIso();
    const cancelHours = input.cancellationWindowHours ?? 36;
    const start = new Date(input.startAt);
    const cancellationDueAt = new Date(start.getTime() - cancelHours * 3600 * 1000).toISOString();

    await this.deps.db
      .prepare(
        `INSERT INTO events
          (id, chapter_id, title, event_type, start_at, duration_minutes, cancellation_due_at,
           state, description, dress_guidance, created_by_actor, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.chapterId,
        input.title,
        input.eventType,
        input.startAt,
        input.durationMinutes,
        cancellationDueAt,
        input.description ?? null,
        input.dressGuidance ?? null,
        input.createdByActor,
        now,
        now,
      )
      .run();

    for (const locId of input.locationIds) {
      await this.deps.db
        .prepare(`INSERT INTO event_locations (event_id, location_id) VALUES (?, ?)`)
        .bind(id, locId)
        .run();
    }

    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: input.createdByActor,
      action: "EVENT_CREATED",
      entityType: "EVENT",
      entityId: id,
      fromState: null,
      toState: "DRAFT",
      reasonCode: null,
      correlationId: null,
      metadata: { chapterId: input.chapterId, title: input.title },
    });

    await this.transition(id, "SUBMIT_FOR_VALIDATION");
    await this.transition(id, "MARK_VALID");
    await this.transition(id, "SCHEDULE");
    return (await this.get(id))!;
  }

  /**
   * Enqueue invitations for every eligible member in the chapter.
   * Each member is policy-checked (tier, service grant, opt-out).
   */
  async queueInvitations(eventId: string): Promise<number> {
    const event = await this.get(eventId);
    if (!event) throw new Error(`Unknown event: ${eventId}`);
    if (event.state !== "SCHEDULED") {
      throw new Error(
        `Event must be SCHEDULED to queue invitations; current state ${event.state}.`,
      );
    }
    await this.transition(eventId, "QUEUE_INVITATIONS");

    // Find members in this chapter and no existing invitation. Membership
    // state, entitlement, consent, billing, and service permission are read
    // again per member below so a stale candidate cannot receive an invite.
    const chapterMembers = await this.deps.db
      .prepare(
        `SELECT id, email, preferred_name
           FROM members
           WHERE chapter_id = ?`,
      )
      .bind(event.chapterId)
      .all<{ id: string; email: string; preferred_name: string | null }>();
    const alreadyInvitedRows = await this.deps.db
      .prepare(`SELECT member_id FROM event_invitations WHERE event_id = ?`)
      .bind(eventId)
      .all<{ member_id: string }>();
    const alreadyInvited = new Set((alreadyInvitedRows.results ?? []).map((r) => r.member_id));
    const eligible = (chapterMembers.results ?? []).filter((m) => !alreadyInvited.has(m.id));

    let queued = 0;
    for (const m of eligible) {
      // Policy check is authoritative at send-queue time. CORE_MEMBERSHIP
      // has no opt-in requirement by default, but an explicit revocation is
      // still honoured by the policy engine.
      const context = await loadPolicyContext(this.deps.db, m.id, "CORE_MEMBERSHIP");
      const decision = canPerform("EVENTS", context);
      if (!decision.allowed) continue;

      // Per-member opt-out for the calendar.
      const grantRow = await this.deps.db
        .prepare(
          `SELECT state FROM service_grants WHERE member_id = ? AND service = 'CALENDAR_MESSAGES'`,
        )
        .bind(m.id)
        .first<{ state: string }>();
      const calendarEnabled =
        !grantRow || grantRow.state === "OPTED_IN" || grantRow.state === "AVAILABLE";

      const invitationId = newInvitationId();
      await this.deps.db
        .prepare(
          `INSERT INTO event_invitations (id, event_id, member_id, calendar_payload)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(invitationId, eventId, m.id, calendarEnabled ? 1 : 0)
        .run();

      // Enqueue EMAIL communication.
      const commId = newCommunicationId();
      const startAt = event.startAt;
      const endAt = new Date(
        new Date(startAt).getTime() + event.durationMinutes * 60 * 1000,
      ).toISOString();
      await this.deps.db
        .prepare(
          `INSERT INTO communications
            (id, member_id, channel, template_key, state, related_entity_type, related_entity_id,
             metadata_json, created_at)
           VALUES (?, ?, 'EMAIL', 'EVENT_INVITATION', 'SCHEDULED', 'EVENT', ?, ?, ?)`,
        )
        .bind(
          commId,
          m.id,
          eventId,
          JSON.stringify({
            eventTitle: event.title,
            startAt,
            endAt,
            chapterId: event.chapterId,
            calendarEnabled,
          }),
          this.deps.clock.nowIso(),
        )
        .run();
      queued++;
    }

    await this.transition(eventId, "MARK_INVITED");
    await this.transition(eventId, "ENTER_REMINDER_WINDOW");
    return queued;
  }

  /**
   * Cancel the event. The cancellation copy is deterministic when
   * AI generation is unavailable (AI outage / config disabled), so
   * the cancellation safety net never depends on MiniMax.
   */
  async cancel(eventId: string, actorId: string, reason: string): Promise<void> {
    const event = await this.get(eventId);
    if (!event) throw new Error(`Unknown event: ${eventId}`);
    if (
      ![
        "INVITED",
        "REMINDER_WINDOW",
        "CANCELLATION_QUEUED",
        "CANCELLATION_FAILURE",
        "CRITICAL_OPERATOR_ACTION",
      ].includes(event.state)
    ) {
      throw new Error(`Cannot cancel from state ${event.state}.`);
    }
    if (event.state === "INVITED" || event.state === "REMINDER_WINDOW") {
      await this.transition(eventId, "QUEUE_CANCELLATION");
    }
    if (event.state === "CANCELLATION_FAILURE") {
      await this.transition(eventId, "RETRY_CANCELLATION");
    }
    if (event.state === "CRITICAL_OPERATOR_ACTION") {
      await this.transition(eventId, "RECOVER_VIA_OPERATOR");
    } else {
      await this.transition(eventId, "CANCEL");
    }
    const cancelled = await this.get(eventId);
    if (cancelled?.state !== "CANCELLED") {
      throw new Error(`Cancellation did not reach CANCELLED from ${event.state}.`);
    }

    // Cancellation communications. The same UID is used for the
    // calendar update so existing imports get updated, not duplicated.
    const invitations = await this.deps.db
      .prepare(`SELECT member_id, calendar_payload FROM event_invitations WHERE event_id = ?`)
      .bind(eventId)
      .all<{ member_id: string; calendar_payload: number }>();

    const now = this.deps.clock.nowIso();
    for (const inv of invitations.results ?? []) {
      const commId = newCommunicationId();
      const startAt = event.startAt;
      const endAt = new Date(
        new Date(startAt).getTime() + event.durationMinutes * 60 * 1000,
      ).toISOString();
      await this.deps.db
        .prepare(
          `INSERT INTO communications
            (id, member_id, channel, template_key, state, related_entity_type, related_entity_id,
             metadata_json, created_at)
           VALUES (?, ?, 'EMAIL', 'EVENT_CANCELLATION', 'QUEUED', 'EVENT', ?, ?, ?)`,
        )
        .bind(
          commId,
          inv.member_id,
          eventId,
          JSON.stringify({
            eventTitle: event.title,
            startAt,
            endAt,
            chapterId: event.chapterId,
            calendarEnabled: inv.calendar_payload === 1,
            reason,
          }),
          now,
        )
        .run();
    }

    await this.deps.db
      .prepare(`UPDATE events SET cancelled_at = ?, updated_at = ? WHERE id = ?`)
      .bind(now, now, eventId)
      .run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId,
      action: "EVENT_CANCELLED",
      entityType: "EVENT",
      entityId: eventId,
      fromState: event.state,
      toState: "CANCELLED",
      reasonCode: reason,
      correlationId: null,
      metadata: null,
    });

    await this.transition(eventId, "PROCESS_CALENDAR_CANCELLATION");
    await this.transition(eventId, "ARCHIVE");
  }

  /**
   * Cancellation safety monitor. For every event whose cancellation
   * is due soon, if it isn't CANCELLED, escalate to operator and
   * enqueue a priority cancellation.
   */
  async safetyMonitor(): Promise<{ criticalCount: number; rescured: string[] }> {
    const now = this.deps.clock.nowIso();
    const dueSoon = await this.deps.db
      .prepare(
        `SELECT id, state, cancellation_due_at FROM events
           WHERE state IN ('INVITED', 'REMINDER_WINDOW', 'CANCELLATION_QUEUED', 'CANCELLATION_FAILURE', 'SEND_FAILURE')
             AND cancellation_due_at <= ?`,
      )
      .bind(now)
      .all<{ id: string; state: EventState; cancellation_due_at: string }>();

    let criticalCount = 0;
    const rescured: string[] = [];
    for (const e of dueSoon.results ?? []) {
      if (e.state === "SEND_FAILURE" || e.state === "CANCELLATION_FAILURE") {
        // Priority retry. The consumer will re-attempt the cancellation
        // email; if it fails again, the state machine escalates.
        await this.deps.db
          .prepare(
            `UPDATE jobs SET priority = 10, available_at = ? WHERE state = 'AVAILABLE' AND type = 'SEND_EMAIL' AND json_extract(payload_json, '$.related_entity_id') = ?`,
          )
          .bind(now, e.id)
          .run();
        if (e.state === "CANCELLATION_FAILURE") {
          await this.transition(e.id, "ESCALATE_TO_OPERATOR");
          criticalCount++;
          rescured.push(e.id);
        } else {
          // Invitation delivery failure can never leave an ordinary plan live.
          // Close the invitation retry path, then force the normal cancellation.
          await this.transition(e.id, "EXHAUST_INVITATION_RETRIES");
          await this.cancel(e.id, "system-safety-monitor", "INVITATION_SEND_FAILURE_SAFETY");
          rescured.push(e.id);
        }
      } else if (e.state === "INVITED" || e.state === "REMINDER_WINDOW") {
        // Not yet cancelled but cancellation window has opened/closed.
        // We never want an event to actually start, so we force-cancel.
        await this.cancel(e.id, "system-safety-monitor", "AUTO_SAFETY");
        rescured.push(e.id);
      }
    }
    return { criticalCount, rescured };
  }

  async get(eventId: string): Promise<OrdinaryEvent | null> {
    const row = await this.deps.db
      .prepare(
        `SELECT id, state, title, chapter_id, start_at, duration_minutes, cancellation_due_at, cancelled_at FROM events WHERE id = ?`,
      )
      .bind(eventId)
      .first<{
        id: string;
        state: EventState;
        title: string;
        chapter_id: string;
        start_at: string;
        duration_minutes: number;
        cancellation_due_at: string;
        cancelled_at: string | null;
      }>();
    if (!row) return null;
    return {
      id: row.id,
      state: row.state,
      title: row.title,
      chapterId: row.chapter_id,
      startAt: row.start_at,
      durationMinutes: row.duration_minutes,
      cancellationDueAt: row.cancellation_due_at,
      cancelledAt: row.cancelled_at,
    };
  }

  /**
   * Build the iCalendar VEVENT for the invitation or cancellation.
   */
  buildCalendarAttachment(
    event: OrdinaryEvent,
    memberEmail: string,
    memberName: string,
    kind: "INVITATION" | "CANCELLATION",
  ): { filename: string; content: string } {
    const uid = calendarUid(event.id, this.deps.appBaseUrl);
    const endAt = new Date(
      new Date(event.startAt).getTime() + event.durationMinutes * 60 * 1000,
    ).toISOString();
    const isCancellation = kind === "CANCELLATION";
    const ics: IcsEvent = {
      uid,
      summary: isCancellation ? `Cancelled: ${event.title}` : event.title,
      description: isCancellation
        ? `The ${brand.shortName} regrets to inform you that this engagement has been — as is customary — cancelled. The relationship continues.`
        : `You are invited. The ${brand.shortName} will cancel before the date.`,
      location: brand.name,
      startUtc: event.startAt,
      endUtc: endAt,
      sequence: isCancellation ? 2 : 1,
      status: isCancellation ? "CANCELLED" : "CONFIRMED",
      organizer: { name: brand.name, email: this.deps.fromAddress },
      attendees: [{ name: memberName, email: memberEmail }],
      stampUtc: this.deps.clock.nowIso(),
      categories: [brand.shortName, "Ordinary engagement"],
    };
    return { filename: `${event.id}.ics`, content: renderIcs(ics) };
  }

  private async transition(eventId: string, event: EventEvent): Promise<void> {
    const row = await this.deps.db
      .prepare(`SELECT state FROM events WHERE id = ?`)
      .bind(eventId)
      .first<{ state: EventState }>();
    if (!row) throw new Error(`Unknown event: ${eventId}`);
    const result = ordinaryEventMachine.next(row.state, event);
    if (!result.allowed) {
      await this.deps.audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "EVENT_TRANSITION_REJECTED",
        entityType: "EVENT",
        entityId: eventId,
        fromState: row.state,
        toState: row.state,
        reasonCode: result.reasonCode,
        correlationId: null,
        metadata: { event, machine: "events" },
      });
      return;
    }
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(`UPDATE events SET state = ?, updated_at = ? WHERE id = ?`)
      .bind(result.toState, now, eventId)
      .run();
    await this.deps.db
      .prepare(
        `INSERT INTO event_transitions (id, event_id, from_state, to_state, reason_code, actor_type, occurred_at)
         VALUES (?, ?, ?, ?, ?, 'SYSTEM', ?)`,
      )
      .bind(crypto.randomUUID(), eventId, row.state, result.toState, result.reasonCode, now)
      .run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "EVENT_TRANSITION",
      entityType: "EVENT",
      entityId: eventId,
      fromState: row.state,
      toState: result.toState,
      reasonCode: result.reasonCode,
      correlationId: null,
      metadata: { event, machine: "events" },
    });
  }
}
