// iCalendar (ICS) generation.
//
// Produces standards-compliant iCalendar text for invitations and
// cancellations. The same UID is used for the invitation and the
// cancellation so a calendar app updates rather than duplicating.
//
// We do NOT use member OAuth for calendar integration in MVP.
// Members receive the .ics as an attachment and import it manually
// or via their mail client's auto-attach behaviour.
//
// References for current iCalendar semantics:
//   - RFC 5545
//   - RFC 7986 (per-event properties)
//   - RFC 7521 (mobile)
//
// Tested with local fixtures in tests/unit/calendar.test.ts. Final
// cross-client validation (Apple Calendar, Google Calendar, Outlook)
// is recorded as a manual check in docs/14.

export interface IcsEvent {
  readonly uid: string;
  readonly summary: string;
  readonly description?: string;
  readonly location?: string;
  /** ISO 8601 in UTC, e.g. "2026-09-12T11:00:00Z". */
  readonly startUtc: string;
  /** ISO 8601 in UTC. */
  readonly endUtc: string;
  /** Sequence number for updates. Higher = newer. RFC 5545 §3.8.7.4. */
  readonly sequence: number;
  /** Status of this specific ICS message. */
  readonly status: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
  /** IANA timezone id, e.g. "Australia/Melbourne". */
  readonly timezone?: string;
  /** Organiser CN + email. */
  readonly organizer?: { readonly name: string; readonly email: string };
  /** Optional attendees. */
  readonly attendees?: ReadonlyArray<{ readonly name: string; readonly email: string }>;
  /** Optional URL for the event's web representation. */
  readonly url?: string;
  /** When the event was created / last modified (ISO 8601 UTC). */
  readonly stampUtc: string;
  /** Optional category list. */
  readonly categories?: ReadonlyArray<string>;
}

/**
 * Format a JS Date as iCalendar UTC (YYYYMMDDTHHMMSSZ).
 */
function formatUtc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Escape a TEXT-typed iCalendar value per RFC 5545 §3.3.11. */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Fold long content lines per RFC 5545 §3.1 (max 75 octets per line). */
function fold(line: string): string {
  // Use byte length (octets) to be conservative — RFC 5545 says
  // "lines of text SHOULD NOT be longer than 75 octets, excluding
  // the line break." We approximate byte length as character
  // length, which is correct for ASCII.
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + (i === 0 ? 75 : 74));
    out.push((i === 0 ? "" : " ") + chunk);
    i += i === 0 ? 75 : 74;
  }
  return out.join("\r\n");
}

/**
 * Render a single IcsEvent to a complete VCALENDAR document.
 */
export function renderIcs(event: IcsEvent): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "PRODID:-//The Plans With You//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:" + (event.status === "CANCELLED" ? "CANCEL" : "REQUEST"),
  ];
  lines.push("BEGIN:VEVENT");
  lines.push("UID:" + event.uid);
  lines.push("SEQUENCE:" + event.sequence);
  lines.push("DTSTAMP:" + formatUtc(event.stampUtc));
  lines.push("DTSTART:" + formatUtc(event.startUtc));
  lines.push("DTEND:" + formatUtc(event.endUtc));
  lines.push("SUMMARY:" + escapeText(event.summary));
  if (event.description) lines.push("DESCRIPTION:" + escapeText(event.description));
  if (event.location) lines.push("LOCATION:" + escapeText(event.location));
  if (event.url) lines.push("URL:" + event.url);
  if (event.organizer) {
    lines.push(`ORGANIZER;CN=${escapeText(event.organizer.name)}:mailto:${event.organizer.email}`);
  }
  if (event.attendees) {
    for (const a of event.attendees) {
      lines.push(`ATTENDEE;CN=${escapeText(a.name)};RSVP=FALSE:mailto:${a.email}`);
    }
  }
  if (event.timezone) lines.push("TZID:" + event.timezone);
  if (event.categories) {
    lines.push("CATEGORIES:" + event.categories.map(escapeText).join(","));
  }
  lines.push("STATUS:" + event.status);
  lines.push("TRANSP:OPAQUE");
  if (event.status === "CANCELLED") {
    // X-property used by some clients; status alone is RFC-compliant.
    lines.push("X-MICROSOFT-CDO-STATUS:CANCELLED");
  }
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n");
}

/**
 * Stable UID for an event. Use the event id from D1 to make the UID
 * deterministic and to keep invitation and cancellation linked.
 */
export function calendarUid(eventId: string, appBaseUrl: string): string {
  const host = new URL(appBaseUrl).host;
  return `event-${eventId}@${host}`;
}
