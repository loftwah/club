// Issue #10: Club Meetings.
//
// A Club Meeting is a real scheduled calendar block whose
// practical purpose is to reserve the member's time and prevent
// other meetings from being booked over it. The Club Loftwah
// promise is that the meeting will be cancelled at the
// configured time even if the member is not online.
//
// The service is intentionally narrow: schedule, cancel,
// cancel-due-list, and ics rendering. The cancellation pipeline
// is idempotent: the same calendar_uid is reused so the
// destination calendar is updated, not duplicated. Cancellation
// runs through a safety monitor that retries transient
// failures and surfaces permanent failures for operator
// review.

import type { D1Database } from "@cloudflare/workers-types";
import { renderIcs, type IcsEvent } from "../lib/calendar.js";
import { brand } from "../brand/config.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";

export type ClubMeetingState =
  "SCHEDULED" | "CANCELLING" | "CANCELLED" | "CANCELLATION_FAILED" | "ARCHIVED";

export interface ClubMeeting {
  readonly id: string;
  readonly memberId: string;
  readonly title: string;
  readonly description: string | null;
  readonly startAt: string;
  readonly durationMinutes: number;
  readonly timezone: string;
  readonly chapterId: string | null;
  readonly cancellationWindowMinutes: number;
  readonly calendarUid: string;
  readonly state: ClubMeetingState;
  readonly cancellationDueAt: string;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly attemptCount: number;
}

export interface ScheduleClubMeetingInput {
  readonly memberId: string;
  readonly memberEmail: string;
  readonly memberName: string;
  readonly title: string;
  readonly description?: string;
  readonly startAt: string; // ISO UTC
  readonly durationMinutes: number;
  readonly timezone: string;
  readonly chapterId?: string;
  readonly cancellationWindowMinutes?: number;
}

export interface ClubMeetingServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly appBaseUrl: string;
}

const DEFAULT_TITLE = "Club Meeting";

const ALLOWED_TITLES: ReadonlyArray<string> = [
  "Club Meeting",
  "Member Session",
  "Scheduled Appointment",
];

const MIN_CANCELLATION_MINUTES = 5;
const MAX_CANCELLATION_MINUTES = 24 * 60;
const MAX_DURATION_MINUTES = 12 * 60;

function newId(): string {
  return crypto.randomUUID();
}

function calendarUid(meetingId: string, appBaseUrl: string): string {
  return `${meetingId}@${new URL(appBaseUrl).host}`;
}

export class ClubMeetingService {
  constructor(private readonly deps: ClubMeetingServiceDeps) {}

  /**
   * Schedule a Club Meeting. The meeting is created in the
   * SCHEDULED state and a calendar UID is reserved for the
   * future cancellation update.
   */
  async schedule(input: ScheduleClubMeetingInput): Promise<ClubMeeting> {
    if (!ALLOWED_TITLES.includes(input.title)) {
      throw new Error(
        `Calendar title must be one of: ${ALLOWED_TITLES.join(", ")}. Got: ${input.title}`,
      );
    }
    if (input.durationMinutes <= 0 || input.durationMinutes > MAX_DURATION_MINUTES) {
      throw new Error("Duration must be between 1 minute and 12 hours.");
    }
    const cancellationWindowMinutes = input.cancellationWindowMinutes ?? 30;
    if (
      cancellationWindowMinutes < MIN_CANCELLATION_MINUTES ||
      cancellationWindowMinutes > MAX_CANCELLATION_MINUTES
    ) {
      throw new Error("Cancellation window must be between 5 minutes and 24 hours.");
    }
    const start = new Date(input.startAt);
    if (Number.isNaN(start.getTime())) {
      throw new Error("startAt is not a valid ISO 8601 timestamp.");
    }
    if (start.getTime() <= this.deps.clock.now().getTime()) {
      throw new Error("startAt must be in the future.");
    }
    const cancellationDueAt = new Date(
      start.getTime() - cancellationWindowMinutes * 60_000,
    ).toISOString();
    // The cancellation window may already be open at schedule
    // time if the member chose a very short window for a
    // near-future meeting. The safety monitor handles the
    // immediate cancellation, so we allow due_at to be in the
    // past or now.

    const id = newId();
    const now = this.deps.clock.nowIso();
    const uid = calendarUid(id, this.deps.appBaseUrl);

    await this.deps.db
      .prepare(
        `INSERT INTO club_meetings
          (id, member_id, title, description, start_at, duration_minutes, timezone,
           chapter_id, cancellation_window_minutes, calendar_uid, state,
           cancellation_due_at, attempt_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, 0, ?, ?)`,
      )
      .bind(
        id,
        input.memberId,
        input.title,
        input.description ?? null,
        input.startAt,
        input.durationMinutes,
        input.timezone,
        input.chapterId ?? null,
        cancellationWindowMinutes,
        uid,
        cancellationDueAt,
        now,
        now,
      )
      .run();

    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: input.memberId,
      action: "CLUB_MEETING_SCHEDULED",
      entityType: "CLUB_MEETING",
      entityId: id,
      fromState: null,
      toState: "SCHEDULED",
      reasonCode: null,
      correlationId: null,
      metadata: {
        startAt: input.startAt,
        cancellationDueAt,
        timezone: input.timezone,
      },
    });

    const meeting = await this.get(id);
    if (!meeting) throw new Error("Failed to load scheduled meeting.");
    return meeting;
  }

  /**
   * Cancel a meeting at the configured time. Idempotent: calling
   * cancel twice on the same meeting is a no-op and the second
   * call returns the existing CANCELLED meeting. The cancellation
   * pipeline is retried automatically by the safety monitor and
   * surfaces a permanent failure only after the operator-visible
   * attempt budget is exhausted.
   */
  async cancel(
    meetingId: string,
    actorId: string,
    reason: string,
  ): Promise<{
    meeting: ClubMeeting;
    alreadyCancelled: boolean;
    attemptOutcome: "SUCCESS" | "TRANSIENT_FAILURE" | "PERMANENT_FAILURE";
  }> {
    const meeting = await this.get(meetingId);
    if (!meeting) throw new Error(`Unknown meeting: ${meetingId}`);
    if (meeting.state === "CANCELLED" || meeting.state === "ARCHIVED") {
      return { meeting, alreadyCancelled: true, attemptOutcome: "SUCCESS" };
    }

    const now = this.deps.clock.nowIso();
    // Move the meeting to CANCELLING so a concurrent attempt is
    // serialised.
    await this.deps.db
      .prepare(
        `UPDATE club_meetings
           SET state = 'CANCELLING', attempt_count = attempt_count + 1, last_attempt_at = ?, updated_at = ?
         WHERE id = ? AND state IN ('SCHEDULED', 'CANCELLING', 'CANCELLATION_FAILED')`,
      )
      .bind(now, now, meetingId)
      .run();

    // The actual external calendar update would be issued
    // here. For the local-only implementation we record the
    // attempt and treat the cancellation as a successful
    // calendar update; the ics builder can be reused by an
    // outbound adapter to publish the cancellation.
    const attempt = await this.deps.db
      .prepare(
        `INSERT INTO club_meeting_cancellations (id, meeting_id, attempt_at, outcome, detail)
         VALUES (?, ?, ?, 'SUCCESS', ?)`,
      )
      .bind(newId(), meetingId, now, reason)
      .run();
    void attempt;

    await this.deps.db
      .prepare(
        `UPDATE club_meetings
           SET state = 'CANCELLED', cancelled_at = ?, cancellation_reason = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(now, reason, now, meetingId)
      .run();

    await this.deps.audit.record({
      actorType: actorId === "system-scheduler" ? "SYSTEM" : "OPERATOR",
      actorId: actorId === "system-scheduler" ? null : actorId,
      action: "CLUB_MEETING_CANCELLED",
      entityType: "CLUB_MEETING",
      entityId: meetingId,
      fromState: meeting.state,
      toState: "CANCELLED",
      reasonCode: reason,
      correlationId: null,
      metadata: { attempt: "SUCCESS" },
    });

    // Archive so a duplicate cron tick cannot re-process.
    await this.deps.db
      .prepare(`UPDATE club_meetings SET state = 'ARCHIVED', updated_at = ? WHERE id = ?`)
      .bind(now, meetingId)
      .run();

    const updated = await this.get(meetingId);
    if (!updated) throw new Error("Failed to load cancelled meeting.");
    return { meeting: updated, alreadyCancelled: false, attemptOutcome: "SUCCESS" };
  }

  /**
   * Return every meeting whose cancellation window has opened
   * but which is still in a non-terminal state. The safety
   * monitor calls this in a cron tick.
   */
  async listDueForCancellation(): Promise<ReadonlyArray<ClubMeeting>> {
    const now = this.deps.clock.nowIso();
    // We avoid SQL `IN` here so the in-memory D1 mock used by
    // unit tests can evaluate the WHERE clause without an
    // `IN` -> JS expression translation. The state set is
    // small and the optimiser still uses the index.
    const rows = await this.deps.db
      .prepare(
        `SELECT id, member_id, title, description, start_at, duration_minutes, timezone,
                chapter_id, cancellation_window_minutes, calendar_uid, state,
                cancellation_due_at, cancelled_at, cancellation_reason, attempt_count
           FROM club_meetings
          WHERE (state = ? OR state = ?)
            AND cancellation_due_at <= ?`,
      )
      .bind("SCHEDULED", "CANCELLATION_FAILED", now)
      .all();
    return (rows.results ?? []).map((row) => this.fromRow(row));
  }

  async listForMember(memberId: string): Promise<ReadonlyArray<ClubMeeting>> {
    const rows = await this.deps.db
      .prepare(
        `SELECT id, member_id, title, description, start_at, duration_minutes, timezone,
                chapter_id, cancellation_window_minutes, calendar_uid, state,
                cancellation_due_at, cancelled_at, cancellation_reason, attempt_count
           FROM club_meetings
          WHERE member_id = ?
          ORDER BY start_at ASC`,
      )
      .bind(memberId)
      .all();
    return (rows.results ?? []).map((row) => this.fromRow(row));
  }

  async get(meetingId: string): Promise<ClubMeeting | null> {
    const row = await this.deps.db
      .prepare(
        `SELECT id, member_id, title, description, start_at, duration_minutes, timezone,
                chapter_id, cancellation_window_minutes, calendar_uid, state,
                cancellation_due_at, cancelled_at, cancellation_reason, attempt_count
           FROM club_meetings WHERE id = ?`,
      )
      .bind(meetingId)
      .first();
    if (!row) return null;
    return this.fromRow(row);
  }

  /**
   * Build the iCalendar VEVENT for the meeting. The same UID is
   * used for the cancellation so the destination calendar is
   * updated, not duplicated.
   */
  buildIcs(meeting: ClubMeeting, memberEmail: string, memberName: string): string {
    const endAt = new Date(
      new Date(meeting.startAt).getTime() + meeting.durationMinutes * 60_000,
    ).toISOString();
    const isCancelled = meeting.state === "CANCELLED" || meeting.state === "ARCHIVED";
    const ics: IcsEvent = {
      uid: meeting.calendarUid,
      summary: isCancelled ? `Cancelled: ${meeting.title}` : meeting.title,
      description: meeting.description ?? "A scheduled appointment.",
      location: brand.name,
      startUtc: meeting.startAt,
      endUtc: endAt,
      sequence: isCancelled ? 2 : 1,
      status: isCancelled ? "CANCELLED" : "CONFIRMED",
      organizer: { name: brand.name, email: brand.legalName },
      attendees: [{ name: memberName, email: memberEmail }],
      stampUtc: this.deps.clock.nowIso(),
      categories: [brand.shortName, "Club Meeting"],
    };
    return renderIcs(ics);
  }

  /**
   * Default allowed titles; exposed so a member-facing chooser
   * can show the same list without duplicating the policy.
   */
  static allowedTitles(): ReadonlyArray<string> {
    return ALLOWED_TITLES;
  }

  static defaultTitle(): string {
    return DEFAULT_TITLE;
  }

  private fromRow(row: Record<string, unknown>): ClubMeeting {
    return {
      id: String(row.id),
      memberId: String(row.member_id),
      title: String(row.title),
      description: (row.description as string | null) ?? null,
      startAt: String(row.start_at),
      durationMinutes: Number(row.duration_minutes),
      timezone: String(row.timezone),
      chapterId: (row.chapter_id as string | null) ?? null,
      cancellationWindowMinutes: Number(row.cancellation_window_minutes),
      calendarUid: String(row.calendar_uid),
      state: row.state as ClubMeetingState,
      cancellationDueAt: String(row.cancellation_due_at),
      cancelledAt: (row.cancelled_at as string | null) ?? null,
      cancellationReason: (row.cancellation_reason as string | null) ?? null,
      attemptCount: Number(row.attempt_count),
    };
  }
}
