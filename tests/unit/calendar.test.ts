import { describe, expect, it } from "vitest";
import { calendarUid, renderIcs } from "../../src/lib/calendar";

describe("calendar / iCalendar", () => {
  const baseEvent = {
    uid: "event-abc123@club.loftwah.com",
    summary: "An ordinary dinner at Gertrude Street",
    description: "Plausible invitation.",
    location: "The Reserved Society",
    startUtc: "2026-09-12T11:00:00.000Z",
    endUtc: "2026-09-12T13:00:00.000Z",
    sequence: 1,
    status: "CONFIRMED" as const,
    organizer: { name: "The Reserved Society", email: "hello@club.loftwah.com" },
    attendees: [{ name: "Test Member", email: "member@example.com" }],
    stampUtc: "2026-08-23T05:00:00.000Z",
  };

  it("renders a valid VCALENDAR/VEVENT document", () => {
    const ics = renderIcs(baseEvent);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("UID:event-abc123@club.loftwah.com");
    expect(ics).toContain("SUMMARY:An ordinary dinner at Gertrude Street");
    expect(ics).toContain("DTSTART:20260912T110000Z");
    expect(ics).toContain("DTEND:20260912T130000Z");
  });

  it("uses METHOD:CANCEL for cancellation status", () => {
    const ics = renderIcs({ ...baseEvent, status: "CANCELLED", sequence: 2 });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("uses METHOD:REQUEST for invitation", () => {
    const ics = renderIcs({ ...baseEvent, status: "CONFIRMED" });
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("escapes special characters in TEXT properties", () => {
    const ics = renderIcs({
      ...baseEvent,
      summary: "A; B, C\\D\nE",
    });
    expect(ics).toContain("SUMMARY:A\\; B\\, C\\\\D\\nE");
  });

  it("folds long lines per RFC 5545 §3.1", () => {
    const longSummary = "x".repeat(200);
    const ics = renderIcs({ ...baseEvent, summary: longSummary });
    // Find the SUMMARY line — it's the line that contains our x's.
    const summaryIndex = ics.indexOf("SUMMARY:") + "SUMMARY:".length;
    const continuationMarker = ics.indexOf("\r\n", summaryIndex);
    const firstChunk = ics.slice(summaryIndex, continuationMarker);
    expect(firstChunk.length).toBeLessThanOrEqual(75);
    // Continuation lines start with a single space (RFC 5545 §3.1).
    expect(ics).toMatch(/\r\n /);
  });

  it("produces a stable UID for the same event id", () => {
    const uid1 = calendarUid("evt_abc", "https://club.loftwah.com");
    const uid2 = calendarUid("evt_abc", "https://club.loftwah.com");
    expect(uid1).toBe(uid2);
    expect(uid1).toBe("event-evt_abc@club.loftwah.com");
  });
});
