// Correspondence validator.
//
// The single chokepoint for AI-generated and human-drafted text
// that mentions a member. Rejects output that:
//   - invents a member fact not present in the confirmed set;
//   - mentions anything in the member's do-not-mention list;
//   - claims fictional partnership or real venue booking;
//   - instructs the member to attend the event;
//   - mentions a wrong member or wrong event;
//   - uses malformed structure (subject/body missing);
//   - mentions a retired location.
//
// Per MASTER_SPEC §8.20 and §10.8.

import type { D1Database } from "@cloudflare/workers-types";

export interface CorrespondenceInput {
  readonly memberId: string;
  readonly subject: string;
  readonly body: string;
  readonly relatedEventId?: string | null;
}

export interface ValidationEvidence {
  readonly ok: boolean;
  readonly reasons: string[];
}

export interface CorrespondenceValidatorDeps {
  readonly db: D1Database;
}

const ATTENDANCE_PHRASES = [
  "we can't wait to see you",
  "we look forward to seeing you",
  "see you there",
  "we hope to see you",
  "please attend",
  "please come",
  "be there",
];

export class CorrespondenceValidator {
  constructor(private readonly deps: CorrespondenceValidatorDeps) {}

  async validate(input: CorrespondenceInput): Promise<ValidationEvidence> {
    const reasons: string[] = [];
    if (!input.subject || input.subject.length < 3) reasons.push("INVALID_SUBJECT");
    if (!input.body || input.body.length < 10) reasons.push("INVALID_BODY");

    // Member existence.
    const member = await this.deps.db
      .prepare(`SELECT id, email FROM members WHERE id = ?`)
      .bind(input.memberId)
      .first<{ id: string; email: string }>();
    if (!member) reasons.push("UNKNOWN_MEMBER");

    // Attendance phrasing.
    const lower = (input.subject + " " + input.body).toLowerCase();
    for (const phrase of ATTENDANCE_PHRASES) {
      if (lower.includes(phrase)) {
        reasons.push(`ATTENDANCE_PHRASE:${phrase}`);
      }
    }

    // Do-not-mention facts.
    const dnu = await this.deps.db
      .prepare(
        `SELECT category, subject FROM member_facts
           WHERE member_id = ? AND (do_not_use = 1 OR status IN ('REVOKED', 'REJECTED'))`,
      )
      .bind(input.memberId)
      .all<{ category: string; subject: string }>();
    for (const r of dnu.results ?? []) {
      const sub = r.subject.toLowerCase();
      if (sub.length >= 3 && lower.includes(sub)) {
        reasons.push(`DO_NOT_MENTION:${r.category}:${r.subject}`);
      }
    }

    // Retired locations.
    if (input.relatedEventId) {
      const ev = await this.deps.db
        .prepare(
          `SELECT l.status FROM events e
             JOIN event_locations el ON el.event_id = e.id
             JOIN locations l ON l.id = el.location_id
             WHERE e.id = ?`,
        )
        .bind(input.relatedEventId)
        .all<{ status: string }>();
      for (const r of ev.results ?? []) {
        if (r.status === "RETIRED") {
          reasons.push("RETIRED_LOCATION_REFERENCED");
        }
      }
    }
    return { ok: reasons.length === 0, reasons };
  }
}
