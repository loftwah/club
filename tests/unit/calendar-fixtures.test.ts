import { describe, expect, it } from "vitest";
import { renderIcs, calendarUid } from "../../src/lib/calendar";

// RFC 5545 compliance tests using real fixtures.
// (Existing tests in tests/unit/calendar.test.ts cover the basics.
// This file adds the additional invariants the spec calls out:
//   stable UID across invitation and cancellation;
//   sequence number increases on update;
//   METHOD:REQUEST vs METHOD:CANCEL;
//   time format is UTC;
//   TZID included when a non-UTC zone is set.)

describe("calendar / iCalendar — fixture invariants", () => {
  const base = {
    uid: "event-abc123@club.loftwah.com",
    summary: "A small opening at Gertrude Contemporary",
    description: "Plausible invitation. We will cancel before the date.",
    location: "Gertrude Contemporary, 21-31 High Street, Fitzroy VIC",
    startUtc: "2026-09-12T11:00:00.000Z",
    endUtc: "2026-09-12T13:00:00.000Z",
    stampUtc: "2026-08-23T05:00:00.000Z",
    organizer: { name: "Plans With You", email: "hello@club.loftwah.com" },
    attendees: [{ name: "Test Member", email: "member@example.com" }],
  };

  it("invitation uses METHOD:REQUEST and SEQUENCE:1", () => {
    const ics = renderIcs({ ...base, sequence: 1, status: "CONFIRMED" });
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("SEQUENCE:1");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("cancellation uses METHOD:CANCEL and SEQUENCE:2", () => {
    const ics = renderIcs({ ...base, sequence: 2, status: "CANCELLED" });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("same UID is used for the invitation and the cancellation", () => {
    const inv = renderIcs({ ...base, sequence: 1, status: "CONFIRMED" });
    const cancel = renderIcs({ ...base, sequence: 2, status: "CANCELLED" });
    const invUid = inv.match(/UID:([^\r\n]+)/)?.[1];
    const cancelUid = cancel.match(/UID:([^\r\n]+)/)?.[1];
    expect(invUid).toBeTruthy();
    expect(invUid).toBe(cancelUid);
  });

  it("DTSTART and DTEND are formatted in UTC (suffix Z)", () => {
    const ics = renderIcs({ ...base, sequence: 1, status: "CONFIRMED" });
    expect(ics).toContain("DTSTART:20260912T110000Z");
    expect(ics).toContain("DTEND:20260912T130000Z");
  });

  it("TZID appears when a non-UTC zone is set", () => {
    const ics = renderIcs({
      ...base,
      sequence: 1,
      status: "CONFIRMED",
      timezone: "Australia/Melbourne",
    });
    expect(ics).toContain("TZID:Australia/Melbourne");
  });

  it("organizer and attendee are formatted as mailto", () => {
    const ics = renderIcs({ ...base, sequence: 1, status: "CONFIRMED" });
    expect(ics).toContain("ORGANIZER;CN=Plans With You:mailto:hello@club.loftwah.com");
    expect(ics).toContain("ATTENDEE;CN=Test Member;RSVP=FALSE:mailto:member@example.com");
  });

  it("calendarUid is stable for the same event id", () => {
    const a = calendarUid("evt_abc", "https://club.loftwah.com");
    const b = calendarUid("evt_abc", "https://club.loftwah.com");
    expect(a).toBe(b);
  });
});
