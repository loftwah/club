// Waitlist service.
//
// Handles the waiting-list-first launch: capture an email, persist it,
// queue a welcome email, retry on transient failure, terminal on hard
// bounce or permanent failure. See MASTER_SPEC §7.1 and §3.1.

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

export const waitlistSubmissionSchema = z.object({
  email: z.string().email(),
  preferredName: z.string().min(1).max(120).optional(),
  chapterId: z.string().min(1).max(64).optional(),
  metroArea: z.string().min(1).max(120).optional(),
  whyJoining: z.array(z.string().min(1).max(200)).max(20).optional(),
  source: z.string().max(120).optional(),
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
          (id, email, preferred_name, chapter_id, metro_area, why_joining_json, source, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'WELCOME_QUEUED', ?, ?)`,
      )
      .bind(
        id,
        parsed.email.toLowerCase(),
        parsed.preferredName ?? null,
        parsed.chapterId ?? null,
        parsed.metroArea ?? null,
        parsed.whyJoining ? JSON.stringify(parsed.whyJoining) : null,
        parsed.source ?? null,
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
      metadata: { email: parsed.email.toLowerCase() },
    });

    // Attempt to send the welcome email. Failures are recorded on the row
    // and (for transient errors) trigger a retry queue. For Phase 1 we
    // perform the send inline; Phase 4 will enqueue a job.
    try {
      const result = await this.deps.resend.send({
        to: parsed.email.toLowerCase(),
        from: this.deps.fromAddress,
        subject: "Welcome to the waiting list",
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
      .prepare(`SELECT * FROM waitlist_entries WHERE id = ?`)
      .bind(id)
      .first<{ email: string }>();
    if (!fresh) throw new Error("Waitlist entry disappeared");

    try {
      await this.deps.resend.send({
        to: fresh.email,
        from: this.deps.fromAddress,
        subject: "Welcome to the waiting list",
        html: "(retry) welcome",
        text: "(retry) welcome",
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
    return `<!doctype html>
<html><body>
<p>${greeting}</p>
<p>This is the Social Club. You are on the waiting list.</p>
<p>You will be invited to small, ordinary, deliberately constructed events. Most of them will be cancelled. You are not expected to attend.</p>
<p>More soon.</p>
<p style="font-size:12px;color:#666">${escapeHtml(this.deps.appBaseUrl)}</p>
</body></html>`;
  }

  private renderWelcomeText(parsed: WaitlistSubmission): string {
    const greeting = parsed.preferredName ? `Hello ${parsed.preferredName},` : "Hello,";
    return `${greeting}\n\nThis is the Social Club. You are on the waiting list.\nYou will be invited to small, ordinary, deliberately constructed events. Most of them will be cancelled. You are not expected to attend.\n\nMore soon.\n${this.deps.appBaseUrl}\n`;
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
