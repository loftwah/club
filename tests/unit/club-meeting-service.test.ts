// Unit tests for the Club Meeting service (issue #10).
//
// Coverage:
//   - schedule() validates title, duration, cancellation window
//     and refuses past start times
//   - schedule() persists a SCHEDULED meeting and reserves a
//     calendar UID
//   - cancel() is idempotent: the second call is a no-op
//   - cancel() records a SUCCESS cancellation attempt and moves
//     the meeting to CANCELLED then ARCHIVED
//   - listDueForCancellation() returns meetings whose window
//     has opened but are not yet CANCELLED
//   - the ics builder uses the meeting's calendar UID so the
//     destination calendar is updated, not duplicated

import { beforeEach, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { ClubMeetingService } from "../../src/services/club-meeting-service";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { newId } from "../../src/infra/ids";

function makeService(opts: { appBaseUrl?: string; now?: string } = {}) {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at(opts.now ?? "2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const service = new ClubMeetingService({
    db: db as unknown as D1Database,
    audit,
    clock,
    appBaseUrl: opts.appBaseUrl ?? "https://club.loftwah.com",
  });
  return { db, clock, audit, service };
}

async function seedMember(db: MockD1Database, email = "alice@example.test") {
  const id = newId("m");
  db.insert("members", {
    id,
    email,
    preferred_name: "Alice",
    country: "AU",
    metro_area: "Melbourne",
    timezone: "Australia/Melbourne",
    chapter_id: "chap_melbourne",
  });
  db.insert("chapters", {
    id: "chap_melbourne",
    slug: "melbourne",
    name: "Melbourne",
    status: "ACTIVE",
  });
  return id;
}

describe("ClubMeetingService", () => {
  let setup: ReturnType<typeof makeService>;
  let memberId: string;
  beforeEach(async () => {
    setup = makeService();
    memberId = await seedMember(setup.db);
  });

  it("schedules a meeting with the default cancellation window", async () => {
    const startAt = "2026-08-16T18:00:00.000Z";
    const meeting = await setup.service.schedule({
      memberId,
      memberEmail: "alice@example.test",
      memberName: "Alice",
      title: "Club Meeting",
      startAt,
      durationMinutes: 60,
      timezone: "Australia/Melbourne",
    });
    expect(meeting.state).toBe("SCHEDULED");
    expect(meeting.calendarUid).toMatch(/^[\w-]+@club\.loftwah\.com$/);
    // Default cancellation window is 30 minutes before start.
    expect(meeting.cancellationDueAt).toBe("2026-08-16T17:30:00.000Z");
    expect(meeting.cancellationWindowMinutes).toBe(30);
  });

  it("rejects a calendar title that is not in the allowed list", async () => {
    await expect(
      setup.service.schedule({
        memberId,
        memberEmail: "alice@example.test",
        memberName: "Alice",
        title: "Highly confidential product launch",
        startAt: "2026-08-16T18:00:00.000Z",
        durationMinutes: 60,
        timezone: "Australia/Melbourne",
      }),
    ).rejects.toThrow(/Calendar title must be one of/);
  });

  it("rejects a duration outside 1-720 minutes", async () => {
    await expect(
      setup.service.schedule({
        memberId,
        memberEmail: "alice@example.test",
        memberName: "Alice",
        title: "Club Meeting",
        startAt: "2026-08-16T18:00:00.000Z",
        durationMinutes: 0,
        timezone: "Australia/Melbourne",
      }),
    ).rejects.toThrow(/Duration must be between 1 minute and 12 hours/);
  });

  it("rejects a cancellation window shorter than 5 minutes", async () => {
    await expect(
      setup.service.schedule({
        memberId,
        memberEmail: "alice@example.test",
        memberName: "Alice",
        title: "Club Meeting",
        startAt: "2026-08-16T18:00:00.000Z",
        durationMinutes: 60,
        timezone: "Australia/Melbourne",
        cancellationWindowMinutes: 1,
      }),
    ).rejects.toThrow(/Cancellation window must be between 5 minutes and 24 hours/);
  });

  it("rejects a start time in the past", async () => {
    await expect(
      setup.service.schedule({
        memberId,
        memberEmail: "alice@example.test",
        memberName: "Alice",
        title: "Club Meeting",
        startAt: "2026-08-15T09:00:00.000Z",
        durationMinutes: 60,
        timezone: "Australia/Melbourne",
      }),
    ).rejects.toThrow(/startAt must be in the future/);
  });

  it("cancels a meeting and archives it, recording a SUCCESS attempt", async () => {
    const meeting = await setup.service.schedule({
      memberId,
      memberEmail: "alice@example.test",
      memberName: "Alice",
      title: "Club Meeting",
      startAt: "2026-08-16T18:00:00.000Z",
      durationMinutes: 60,
      timezone: "Australia/Melbourne",
    });
    const result = await setup.service.cancel(meeting.id, "system-scheduler", "AUTO");
    expect(result.attemptOutcome).toBe("SUCCESS");
    expect(result.alreadyCancelled).toBe(false);
    expect(result.meeting.state).toBe("ARCHIVED");
    expect(result.meeting.cancelledAt).not.toBeNull();
    expect(result.meeting.cancellationReason).toBe("AUTO");
  });

  it("cancel() is idempotent — a second call is a no-op", async () => {
    const meeting = await setup.service.schedule({
      memberId,
      memberEmail: "alice@example.test",
      memberName: "Alice",
      title: "Club Meeting",
      startAt: "2026-08-16T18:00:00.000Z",
      durationMinutes: 60,
      timezone: "Australia/Melbourne",
    });
    const first = await setup.service.cancel(meeting.id, "system-scheduler", "AUTO");
    const second = await setup.service.cancel(meeting.id, "system-scheduler", "AUTO");
    expect(second.alreadyCancelled).toBe(true);
    expect(second.attemptOutcome).toBe("SUCCESS");
    // The cancellation ledger should have only one SUCCESS row
    // because the second call short-circuits.
    const ledger = setup.db
      .all("club_meeting_cancellations")
      .filter((row: Record<string, unknown>) => row.outcome === "SUCCESS");
    expect(ledger.length).toBe(1);
    void first;
  });

  it("listDueForCancellation returns only meetings whose window has opened", async () => {
    // The first meeting starts 30 minutes from now with a
    // 60-minute cancellation window, so its cancellation_due_at
    // is 30 minutes in the past — it is due.
    await setup.service.schedule({
      memberId,
      memberEmail: "alice@example.test",
      memberName: "Alice",
      title: "Club Meeting",
      startAt: "2026-08-15T10:30:00.000Z",
      durationMinutes: 60,
      timezone: "Australia/Melbourne",
      cancellationWindowMinutes: 60,
    });
    await setup.service.schedule({
      memberId,
      memberEmail: "alice@example.test",
      memberName: "Alice",
      title: "Member Session",
      startAt: "2026-08-16T18:00:00.000Z",
      durationMinutes: 60,
      timezone: "Australia/Melbourne",
    });
    const due = await setup.service.listDueForCancellation();
    expect(due.length).toBe(1);
    expect(due[0]?.title).toBe("Club Meeting");
  });

  it("ics builder reuses the same calendar UID for the cancellation", async () => {
    const meeting = await setup.service.schedule({
      memberId,
      memberEmail: "alice@example.test",
      memberName: "Alice",
      title: "Club Meeting",
      startAt: "2026-08-16T18:00:00.000Z",
      durationMinutes: 60,
      timezone: "Australia/Melbourne",
    });
    const inviteIcs = setup.service.buildIcs(meeting, "alice@example.test", "Alice");
    expect(inviteIcs).toContain("UID:");
    expect(inviteIcs).toContain(meeting.calendarUid);
    expect(inviteIcs).toContain("STATUS:CONFIRMED");

    const cancelled = await setup.service.cancel(meeting.id, "system-scheduler", "AUTO");
    const cancelIcs = setup.service.buildIcs(cancelled.meeting, "alice@example.test", "Alice");
    expect(cancelIcs).toContain("UID:");
    expect(cancelIcs).toContain(meeting.calendarUid);
    expect(cancelIcs).toContain("STATUS:CANCELLED");
    // Same UID means the destination calendar updates rather
    // than creating a duplicate event.
    const inviteUid = inviteIcs.match(/UID:[^\r\n]+/)?.[0];
    const cancelUid = cancelIcs.match(/UID:[^\r\n]+/)?.[0];
    expect(inviteUid).toBe(cancelUid);
  });
});
