// Waitlist service.
//
// Handles the waiting-list-first launch: capture an email, persist it,
// queue a welcome email, retry on transient failure, terminal on hard
// bounce or permanent failure. See MASTER_SPEC §7.1 and §3.1.
//
// At the waitlist-only launch, the form also captures an optional
// `interested_tier` (the Member / Corresponding Member / Deluxe Member
// tier the visitor expressed interest in from a public tier CTA).
// The field is stored as-is and surfaced in the welcome email. It is
// NOT an activation, subscription, or payment record.

import type { D1Database } from "@cloudflare/workers-types";
import { newWaitlistId } from "../infra/ids.js";
import {
  waitlistMachine,
  type WaitlistEvent,
  type WaitlistState,
} from "../domain/machines/waitlist.js";
import type { ResendAdapter } from "../adapters/resend.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";
import { z } from "zod";

/** Production tier display names. Stored verbatim in `interested_tier`. */
export const INTERESTED_TIERS = ["Member", "Corresponding Member", "Deluxe Member"] as const;
export type InterestedTier = (typeof INTERESTED_TIERS)[number];

export const waitlistSubmissionSchema = z.object({
  email: z.email(),
  preferredName: z.string().min(1).max(120).optional(),
  chapterId: z.string().min(1).max(64).optional(),
  metroArea: z.string().min(1).max(120).optional(),
  whyJoining: z.array(z.string().min(1).max(200)).max(20).optional(),
  source: z.string().max(120).optional(),
  interestedTier: z.enum(INTERESTED_TIERS).optional(),
});

export type WaitlistSubmission = z.infer<typeof waitlistSubmissionSchema>;

export interface WaitlistEntry {
  readonly id: string;
  readonly email: string;
  readonly state: WaitlistState;
  readonly createdAt: string;
}

export interface WaitlistServiceDeps {
  readonly db: D1Database;
  readonly resend: ResendAdapter;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly appBaseUrl: string;
  readonly fromAddress: string;
}

export class WaitlistService {
  constructor(private readonly deps: WaitlistServiceDeps) {}

  /**
   * Submit a new waitlist entry. Validates, persists, queues welcome.
   * Returns the resulting entry. Duplicate emails are handled by returning
   * the existing entry in its current state (idempotent submit).
   */
  async submit(input: WaitlistSubmission): Promise<WaitlistEntry> {
    const parsed = waitlistSubmissionSchema.parse(input);

    // Idempotency: same email returns the existing entry, in its current
    // state. This is deterministic duplicate handling per
    // docs/13_TEST_PLAN.md §14.2.
    const existing = await this.deps.db
      .prepare(`SELECT * FROM waitlist_entries WHERE email = ?`)
      .bind(parsed.email.toLowerCase())
      .first<{
        id: string;
        email: string;
        state: WaitlistState;
        created_at: string;
      }>();

    if (existing) {
      return toEntry(existing);
    }

    const id = newWaitlistId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO waitlist_entries
          (id, email, preferred_name, chapter_id, metro_area, why_joining_json, source, interested_tier, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'WELCOME_QUEUED', ?, ?)`,
      )
      .bind(
        id,
        parsed.email.toLowerCase(),
        parsed.preferredName ?? null,
        parsed.chapterId ?? null,
        parsed.metroArea ?? null,
        parsed.whyJoining ? JSON.stringify(parsed.whyJoining) : null,
        parsed.source ?? null,
        parsed.interestedTier ?? null,
        now,
        now,
      )
      .run();

    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: null,
      action: "WAITLIST_SUBMIT",
      entityType: "WAITLIST_ENTRY",
      entityId: id,
      fromState: null,
      toState: "WELCOME_QUEUED",
      reasonCode: "OK",
      correlationId: null,
      metadata: {
        email: parsed.email.toLowerCase(),
        interested_tier: parsed.interestedTier ?? null,
      },
    });

    // Attempt to send the welcome email. Failures are recorded on the row
    // and (for transient errors) trigger a retry queue. For Phase 1 we
    // perform the send inline; Phase 4 will enqueue a job.
    try {
      const result = await this.deps.resend.send({
        to: parsed.email.toLowerCase(),
        from: this.deps.fromAddress,
        subject: "You're on the Plans With You waiting list",
        html: this.renderWelcomeHtml(parsed),
        text: this.renderWelcomeText(parsed),
        idempotencyKey: `waitlist-welcome:${id}`,
      });
      await this.markEvent(id, "DELIVER", {
        providerMessageId: result.providerMessageId,
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "PERMANENT") {
        await this.markEvent(id, "RECORD_HARD_BOUNCE", {
          error: String(err),
        });
      } else {
        await this.markEvent(id, "RECORD_TRANSIENT_FAILURE", {
          error: String(err),
        });
      }
    }

    const reloaded = await this.deps.db
      .prepare(`SELECT * FROM waitlist_entries WHERE id = ?`)
      .bind(id)
      .first<{ id: string; email: string; state: WaitlistState; created_at: string }>();
    if (!reloaded) throw new Error("Waitlist entry disappeared after insert");
    return toEntry(reloaded);
  }

  /** Re-drive a failed welcome. */
  async retry(id: string): Promise<WaitlistEntry> {
    const entry = await this.loadEntry(id);
    if (!entry) throw new Error(`Unknown waitlist entry: ${id}`);

    if (entry.state !== "RETRY") {
      // The state machine disallows other sources for RETRY_DELIVERY.
      // We jump straight to DELIVER; the result is updated by the audit.
      await this.markEvent(id, "RETRY_DELIVERY");
    }
    const fresh = await this.deps.db
      .prepare(
        `SELECT email, preferred_name, chapter_id, metro_area, source, interested_tier
           FROM waitlist_entries WHERE id = ?`,
      )
      .bind(id)
      .first<{
        email: string;
        preferred_name: string | null;
        chapter_id: string | null;
        metro_area: string | null;
        source: string | null;
        interested_tier: InterestedTier | null;
      }>();
    if (!fresh) throw new Error("Waitlist entry disappeared");

    const submission: WaitlistSubmission = {
      email: fresh.email,
      preferredName: fresh.preferred_name ?? undefined,
      chapterId: fresh.chapter_id ?? undefined,
      metroArea: fresh.metro_area ?? undefined,
      source: fresh.source ?? undefined,
      interestedTier: fresh.interested_tier ?? undefined,
    };

    try {
      await this.deps.resend.send({
        to: fresh.email,
        from: this.deps.fromAddress,
        subject: "You're on the Plans With You waiting list",
        html: this.renderWelcomeHtml(submission),
        text: this.renderWelcomeText(submission),
        idempotencyKey: `waitlist-welcome:${id}`,
      });
      await this.markEvent(id, "DELIVER");
    } catch (err) {
      await this.markEvent(id, "EXHAUST_RETRIES", { error: String(err) });
    }

    const reloaded = await this.deps.db
      .prepare(`SELECT * FROM waitlist_entries WHERE id = ?`)
      .bind(id)
      .first<{ id: string; email: string; state: WaitlistState; created_at: string }>();
    if (!reloaded) throw new Error("Waitlist entry disappeared after retry");
    return toEntry(reloaded);
  }

  private async loadEntry(id: string) {
    return this.deps.db
      .prepare(`SELECT * FROM waitlist_entries WHERE id = ?`)
      .bind(id)
      .first<{ id: string; email: string; state: WaitlistState; created_at: string }>();
  }

  /**
   * Apply a waitlist state-machine event. Looks up the current state,
   * validates the transition, writes the new state, and audits.
   * Optional side-effect metadata is stored in `last_error` for failure
   * paths and recorded in audit metadata.
   */
  private async markEvent(
    id: string,
    event: WaitlistEvent,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const row = await this.deps.db
      .prepare(`SELECT state FROM waitlist_entries WHERE id = ?`)
      .bind(id)
      .first<{ state: WaitlistState }>();
    if (!row) throw new Error(`Unknown waitlist entry: ${id}`);

    const result = waitlistMachine.next(row.state, event);
    if (!result.allowed) {
      // Terminal or invalid — record and skip.
      await this.deps.audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "WAITLIST_TRANSITION_REJECTED",
        entityType: "WAITLIST_ENTRY",
        entityId: id,
        fromState: row.state,
        toState: row.state,
        reasonCode: result.reasonCode,
        correlationId: null,
        metadata: { event, machine: "waitlist" },
      });
      return;
    }

    const lastError = metadata?.error ? String(metadata.error) : null;
    await this.deps.db
      .prepare(`UPDATE waitlist_entries SET state = ?, last_error = ?, updated_at = ? WHERE id = ?`)
      .bind(result.toState, lastError, this.deps.clock.nowIso(), id)
      .run();

    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "WAITLIST_TRANSITION",
      entityType: "WAITLIST_ENTRY",
      entityId: id,
      fromState: row.state,
      toState: result.toState,
      reasonCode: result.reasonCode,
      correlationId: null,
      metadata: { event, ...metadata },
    });
  }

  private renderWelcomeHtml(parsed: WaitlistSubmission): string {
    const greeting = parsed.preferredName ? `Hello ${escapeHtml(parsed.preferredName)},` : "Hello,";
    const tierLine = parsed.interestedTier
      ? `<p>We have noted your interest in the <strong>${escapeHtml(parsed.interestedTier)}</strong> tier. Nothing has been charged. We will be in touch when paid membership opens for that tier.</p>`
      : "";
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>You are on the list</title></head>
<body style="margin:0;background:#f5f1e7;color:#12110f;font-family:Arial,sans-serif;line-height:1.55;">
<div style="display:none;max-height:0;overflow:hidden;">Your place on the Plans With You waitlist is recorded. No payment has been taken.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1e7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #12110f;background:#fbf9f3;">
<tr><td style="padding:12px 20px;background:#12110f;color:#f5f1e7;font-family:monospace;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Plans With You / Waitlist recorded</td></tr>
<tr><td style="padding:40px 32px 20px;"><p style="margin:0 0 20px;font-family:Georgia,serif;font-size:20px;">${greeting}</p>
<h1 style="margin:0 0 24px;font-size:40px;line-height:1;letter-spacing:-1.5px;">You are on the list.</h1>
<p style="margin:0 0 16px;">Thank you for your interest in Plans With You. Nothing has been charged, and there is nothing you need to do.</p>
${tierLine}
<p style="margin:0 0 28px;">Paid membership remains closed. When a real opening is available, chapter by chapter, we will write with the next step. We will not activate or charge a membership without your confirmation.</p>
<div style="padding:14px 16px;background:#f7d9cc;border-left:5px solid #e94616;font-family:monospace;font-size:12px;line-height:1.5;">WAITLIST OPEN<br>PAYMENTS CLOSED<br>SILENCE WELCOME</div>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #d5cfc1;color:#69655d;font-size:11px;">${escapeHtml(this.deps.appBaseUrl)} · You are wanted. You don't have to go.</td></tr>
</table></td></tr></table></body></html>`;
  }

  private renderWelcomeText(parsed: WaitlistSubmission): string {
    const greeting = parsed.preferredName ? `Hello ${parsed.preferredName},` : "Hello,";
    const tierLine = parsed.interestedTier
      ? `We have noted your interest in the ${parsed.interestedTier} tier. Nothing has been charged. We will be in touch when paid membership opens for that tier.\n`
      : "";
    return `${greeting}\n\nYou are on the Plans With You waiting list. Thank you for your interest.\n${tierLine}\nPlans With You is a real paid membership that takes your absence seriously. When paid membership opens chapter by chapter, we will write to you with the next step. We will not charge anything until you confirm a paid membership.\n${this.deps.appBaseUrl}\n`;
  }
}

function toEntry(row: {
  id: string;
  email: string;
  state: WaitlistState;
  created_at: string;
}): WaitlistEntry {
  return { id: row.id, email: row.email, state: row.state, createdAt: row.created_at };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
