import type { D1Database, D1Result } from "@cloudflare/workers-types";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";
import { newId } from "../infra/ids.js";

const CONFIRM_TTL_MS = 30 * 60 * 1000;

export interface AccountDeletionDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

export interface DeletionConfirmation {
  readonly requestId: string;
  readonly token: string;
  readonly expiresAt: string;
}

type DeletionState =
  | "PENDING_CONFIRM"
  | "CONFIRMED"
  | "ACTIVITY_SUSPENDED"
  | "FUTURE_JOBS_CANCELLED"
  | "PERSONAL_DATA_DELETION"
  | "RETENTION_SEPARATED"
  | "DELETED"
  | "CANCELLED";

export class AccountDeletionError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "NOT_OWNER"
      | "NOT_PENDING"
      | "TOKEN_INVALID"
      | "TOKEN_EXPIRED"
      | "ALREADY_CONSUMED",
    message: string,
  ) {
    super(message);
    this.name = "AccountDeletionError";
  }
}

/**
 * Resumable, auditable account closure. D1 remains the source of truth:
 * the confirmation token is one-time and hashed at rest, each completed
 * stage is persisted, and a failure creates an explicit operator escalation.
 */
export class AccountDeletionService {
  constructor(private readonly deps: AccountDeletionDeps) {}

  async begin(memberId: string): Promise<DeletionConfirmation> {
    const now = this.deps.clock.now();
    const requestId = newId("del");
    const token = generateToken();
    const tokenHash = await sha256B64(token);
    const expiresAt = new Date(now.getTime() + CONFIRM_TTL_MS).toISOString();

    await this.deps.db.batch([
      this.deps.db
        .prepare(
          `UPDATE deletion_requests
              SET state = 'CANCELLED', last_error = 'SUPERSEDED', confirm_token_hash = NULL
            WHERE member_id = ? AND state = 'PENDING_CONFIRM'`,
        )
        .bind(memberId),
      this.deps.db
        .prepare(
          `INSERT INTO deletion_requests (
             id, member_id, requested_at, state, confirm_token_hash, confirm_expires_at, last_error
           ) VALUES (?, ?, ?, 'PENDING_CONFIRM', ?, ?, NULL)`,
        )
        .bind(requestId, memberId, now.toISOString(), tokenHash, expiresAt),
    ]);

    await this.audit(memberId, requestId, "DELETION_REQUESTED", null, "PENDING_CONFIRM", "OK");
    return { requestId, token, expiresAt };
  }

  async markConfirmationDeliveryFailed(
    memberId: string,
    requestId: string,
    reason: string,
  ): Promise<void> {
    await this.deps.db
      .prepare(
        `UPDATE deletion_requests
            SET state = 'CANCELLED', last_error = ?, confirm_token_hash = NULL
          WHERE id = ? AND member_id = ? AND state = 'PENDING_CONFIRM'`,
      )
      .bind(reason.slice(0, 200), requestId, memberId)
      .run();
    await this.audit(
      memberId,
      requestId,
      "DELETION_CONFIRMATION_DELIVERY_FAILED",
      "PENDING_CONFIRM",
      "CANCELLED",
      "DELIVERY_FAILED",
    );
  }

  async inspect(
    memberId: string,
    requestId: string,
    token: string,
  ): Promise<{ state: DeletionState }> {
    const row = await this.loadOwned(memberId, requestId);
    await this.assertUsableToken(row, token);
    return { state: row.state };
  }

  async confirmAndDelete(memberId: string, requestId: string, token: string): Promise<void> {
    const row = await this.loadOwned(memberId, requestId);
    await this.assertUsableToken(row, token);
    const now = this.deps.clock.nowIso();
    const tokenHash = await sha256B64(token);

    const consumed = await this.deps.db
      .prepare(
        `UPDATE deletion_requests
            SET state = 'CONFIRMED', confirmed_at = ?, confirm_token_hash = NULL, last_error = NULL
          WHERE id = ? AND member_id = ? AND state = 'PENDING_CONFIRM'
            AND confirm_token_hash = ? AND confirm_expires_at > ?`,
      )
      .bind(now, requestId, memberId, tokenHash, now)
      .run();
    if ((consumed.meta.changes ?? 0) !== 1) {
      throw new AccountDeletionError("ALREADY_CONSUMED", "The confirmation has already been used.");
    }
    await this.audit(
      memberId,
      requestId,
      "DELETION_CONFIRMED",
      "PENDING_CONFIRM",
      "CONFIRMED",
      "OK",
    );

    try {
      await this.suspendActivity(memberId, requestId, now);
      await this.cancelFutureWork(memberId, requestId, now);
      await this.removePersonalData(memberId, requestId, now);
      await this.separateRetainedRecords(memberId, requestId, now);
      await this.transition(memberId, requestId, "RETENTION_SEPARATED", "DELETED", now, true);
    } catch (error) {
      await this.escalateFailure(memberId, requestId, error);
      throw error;
    }
  }

  private async suspendActivity(memberId: string, requestId: string, now: string): Promise<void> {
    const results = await this.deps.db.batch([
      this.deps.db
        .prepare(
          `UPDATE memberships SET state = 'CANCELLED', ended_at = COALESCE(ended_at, ?), updated_at = ?
            WHERE member_id = ? AND state != 'CANCELLED'`,
        )
        .bind(now, now, memberId),
      this.deps.db
        .prepare(
          `UPDATE service_grants SET state = 'SUSPENDED', updated_at = ? WHERE member_id = ?`,
        )
        .bind(now, memberId),
      this.deps.db
        .prepare(
          `UPDATE subscriptions SET status = 'CANCELLED', updated_at = ?
            WHERE member_id = ? AND status != 'CANCELLED'`,
        )
        .bind(now, memberId),
      this.deps.db
        .prepare(
          `UPDATE communications SET state = 'CANCELLED_BEFORE_SEND'
            WHERE member_id = ? AND state IN ('DRAFT','GENERATED','VALIDATED','SCHEDULED','QUEUED','TRANSIENT_FAILURE')`,
        )
        .bind(memberId),
      this.deps.db
        .prepare(
          `UPDATE deletion_requests SET state = 'ACTIVITY_SUSPENDED'
            WHERE id = ? AND member_id = ? AND state = 'CONFIRMED'`,
        )
        .bind(requestId, memberId),
    ]);
    assertStageTransition(results.at(-1), "CONFIRMED", "ACTIVITY_SUSPENDED");
    await this.audit(
      memberId,
      requestId,
      "DELETION_ACTIVITY_SUSPENDED",
      "CONFIRMED",
      "ACTIVITY_SUSPENDED",
      "OK",
    );
  }

  private async cancelFutureWork(memberId: string, requestId: string, now: string): Promise<void> {
    const memberPattern = `%${escapeLike(memberId)}%`;
    const results = await this.deps.db.batch([
      this.deps.db
        .prepare(
          `UPDATE jobs
              SET state = 'DEAD_LETTER', failure_reason = 'ACCOUNT_DELETION',
                  payload_json = NULL, completed_at = ?
            WHERE state NOT IN ('COMPLETED','FAILED','DEAD_LETTER')
              AND (entity_id = ? OR payload_json LIKE ? ESCAPE '\\')`,
        )
        .bind(now, memberId, memberPattern),
      this.deps.db
        .prepare(
          `UPDATE fulfilment_tasks SET state = 'CANCELLED', completed_at = ?
            WHERE member_id = ? AND state NOT IN ('COMPLETED','CANCELLED')`,
        )
        .bind(now, memberId),
      this.deps.db
        .prepare(
          `UPDATE commitment_scenarios SET state = 'ABORTED', completed_at = ?
            WHERE member_id = ? AND state NOT IN ('COMPLETED','ABORTED','DECLINED')`,
        )
        .bind(now, memberId),
      this.deps.db
        .prepare(
          `UPDATE gifts SET state = 'CANCELLED' WHERE member_id = ?
            AND state NOT IN ('DELIVERED','NOT_ELIGIBLE','BUDGET_DENIED','MEMBER_OPTED_OUT','CANCELLED')`,
        )
        .bind(memberId),
      this.deps.db
        .prepare(
          `UPDATE calls SET state = 'CLOSED' WHERE member_id = ?
            AND state NOT IN ('COMPLETED','CLOSED')`,
        )
        .bind(memberId),
      this.deps.db
        .prepare(
          `UPDATE appearance_requests SET state = 'CLOSED'
            WHERE member_id = ?
              AND state NOT IN ('PERFORMED','CUSTOMER_CANCELLED','CLUB_CANCELLED','SAFETY_CANCELLED','REFUND_RESOLUTION','CLOSED')`,
        )
        .bind(memberId),
      this.deps.db.prepare(`DELETE FROM event_invitations WHERE member_id = ?`).bind(memberId),
      this.deps.db
        .prepare(
          `UPDATE deletion_requests SET state = 'FUTURE_JOBS_CANCELLED'
            WHERE id = ? AND member_id = ? AND state = 'ACTIVITY_SUSPENDED'`,
        )
        .bind(requestId, memberId),
    ]);
    assertStageTransition(results.at(-1), "ACTIVITY_SUSPENDED", "FUTURE_JOBS_CANCELLED");
    await this.audit(
      memberId,
      requestId,
      "DELETION_FUTURE_WORK_CANCELLED",
      "ACTIVITY_SUSPENDED",
      "FUTURE_JOBS_CANCELLED",
      "OK",
    );
  }

  private async removePersonalData(
    memberId: string,
    requestId: string,
    now: string,
  ): Promise<void> {
    const results = await this.deps.db.batch([
      this.deps.db.prepare(`DELETE FROM member_facts WHERE member_id = ?`).bind(memberId),
      this.deps.db.prepare(`DELETE FROM member_timeline WHERE member_id = ?`).bind(memberId),
      this.deps.db.prepare(`DELETE FROM member_milestones WHERE member_id = ?`).bind(memberId),
      this.deps.db.prepare(`DELETE FROM onboarding_step_data WHERE member_id = ?`).bind(memberId),
      this.deps.db.prepare(`DELETE FROM onboarding_progress WHERE member_id = ?`).bind(memberId),
      // Service grants are permissions, not retained audit, financial, or
      // legal records. Remove them at the personal-data stage so a terminal
      // deletion can never leave an entitlement/permission row attached to
      // the anonymised member record.
      this.deps.db.prepare(`DELETE FROM service_grants WHERE member_id = ?`).bind(memberId),
      this.deps.db
        .prepare(
          `UPDATE communications
              SET member_id = NULL, metadata_json = NULL
            WHERE member_id = ?`,
        )
        .bind(memberId),
      this.deps.db
        .prepare(
          `UPDATE inbound_messages
              SET from_address = NULL, from_name = NULL, to_addresses_json = NULL,
                  cc_addresses_json = NULL, subject = '[redacted]', message_id_header = NULL,
                  body_text = NULL, body_html = NULL, attachments_json = NULL,
                  raw_metadata_json = NULL, match_member_id = NULL
            WHERE match_member_id = ?`,
        )
        .bind(memberId),
      this.deps.db
        .prepare(
          `UPDATE ai_generations SET member_id = NULL, member_fact_ids_json = NULL WHERE member_id = ?`,
        )
        .bind(memberId),
      this.deps.db
        .prepare(
          `UPDATE gifts SET occasion = '[redacted]', description = '[redacted]' WHERE member_id = ?`,
        )
        .bind(memberId),
      this.deps.db
        .prepare(
          `UPDATE calls SET purpose = '[redacted]', window_start = ?, window_end = ? WHERE member_id = ?`,
        )
        .bind(now, now, memberId),
      this.deps.db
        .prepare(
          `UPDATE commitment_scenarios SET goal = NULL, scenario_text = NULL WHERE member_id = ?`,
        )
        .bind(memberId),
      this.deps.db
        .prepare(
          `UPDATE appearance_requests
              SET requester_id = NULL, role = '[redacted]', location = '[redacted]', brief = NULL
            WHERE member_id = ?`,
        )
        .bind(memberId),
      this.deps.db
        .prepare(
          `UPDATE deletion_requests SET state = 'PERSONAL_DATA_DELETION'
            WHERE id = ? AND member_id = ? AND state = 'FUTURE_JOBS_CANCELLED'`,
        )
        .bind(requestId, memberId),
    ]);
    assertStageTransition(results.at(-1), "FUTURE_JOBS_CANCELLED", "PERSONAL_DATA_DELETION");
    await this.audit(
      memberId,
      requestId,
      "DELETION_PERSONAL_DATA_REMOVED",
      "FUTURE_JOBS_CANCELLED",
      "PERSONAL_DATA_DELETION",
      "OK",
    );
  }

  private async separateRetainedRecords(
    memberId: string,
    requestId: string,
    now: string,
  ): Promise<void> {
    const member = await this.deps.db
      .prepare(`SELECT email FROM members WHERE id = ?`)
      .bind(memberId)
      .first<{ email: string }>();
    if (!member) throw new Error("Member disappeared during deletion.");
    const anonymisedEmail = `deleted+${await shortHash(memberId)}@invalid.club.loftwah`;

    const results = await this.deps.db.batch([
      this.deps.db
        .prepare(
          `UPDATE waitlist_entries
              SET email = ?, preferred_name = NULL, metro_area = NULL, why_joining_json = NULL,
                  source = NULL, interested_tier = NULL, state = 'DELETED', last_error = NULL,
                  updated_at = ?
            WHERE lower(email) = lower(?)`,
        )
        .bind(anonymisedEmail, now, member.email),
      this.deps.db
        .prepare(
          `UPDATE member_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE member_id = ?`,
        )
        .bind(now, memberId),
      this.deps.db
        .prepare(`UPDATE magic_links SET revoked_at = COALESCE(revoked_at, ?) WHERE member_id = ?`)
        .bind(now, memberId),
      this.deps.db
        .prepare(
          `UPDATE members
              SET email = ?, preferred_name = NULL, postal_name = NULL, society_alias = NULL,
                  country = NULL, metro_area = NULL, chapter_id = NULL, birthday = NULL,
                  timezone = NULL, updated_at = ?
            WHERE id = ?`,
        )
        .bind(anonymisedEmail, now, memberId),
      this.deps.db
        .prepare(
          `UPDATE deletion_requests SET state = 'RETENTION_SEPARATED'
            WHERE id = ? AND member_id = ? AND state = 'PERSONAL_DATA_DELETION'`,
        )
        .bind(requestId, memberId),
    ]);
    assertStageTransition(results.at(-1), "PERSONAL_DATA_DELETION", "RETENTION_SEPARATED");
    await this.audit(
      null,
      requestId,
      "DELETION_RETENTION_SEPARATED",
      "PERSONAL_DATA_DELETION",
      "RETENTION_SEPARATED",
      "OK",
    );
  }

  private async transition(
    actorId: string | null,
    requestId: string,
    from: DeletionState,
    to: DeletionState,
    now: string,
    completed = false,
  ): Promise<void> {
    // Keep the terminal write explicit so a retry cannot accidentally alter
    // an already-completed request or clear its completion timestamp.
    const result = completed
      ? await this.deps.db
          .prepare(
            `UPDATE deletion_requests SET state = ?, completed_at = ?
             WHERE id = ? AND state = ?`,
          )
          .bind(to, now, requestId, from)
          .run()
      : await this.deps.db
          .prepare(`UPDATE deletion_requests SET state = ? WHERE id = ? AND state = ?`)
          .bind(to, requestId, from)
          .run();
    if ((result.meta.changes ?? 0) !== 1)
      throw new Error(`Deletion transition ${from} -> ${to} failed.`);
    await this.audit(actorId, requestId, `DELETION_${to}`, from, to, "OK");
  }

  private async escalateFailure(
    memberId: string,
    requestId: string,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : "Unknown deletion failure";
    const taskId = newId("ft");
    const now = this.deps.clock.nowIso();
    await this.deps.db.batch([
      this.deps.db
        .prepare(`UPDATE deletion_requests SET last_error = ? WHERE id = ?`)
        .bind(message.slice(0, 500), requestId),
      this.deps.db
        .prepare(
          `INSERT INTO fulfilment_tasks (
             id, member_id, task_type, state, context_json, deadline, created_at
           ) VALUES (?, ?, 'PRIVACY_REQUEST', 'ESCALATED', ?, ?, ?)`,
        )
        .bind(
          taskId,
          memberId,
          JSON.stringify({ deletionRequestId: requestId, failure: message.slice(0, 200) }),
          now,
          now,
        ),
    ]);
    await this.audit(
      memberId,
      requestId,
      "DELETION_WORKFLOW_ESCALATED",
      null,
      null,
      "WORKFLOW_FAILURE",
    );
  }

  private async loadOwned(
    memberId: string,
    requestId: string,
  ): Promise<{
    member_id: string;
    state: DeletionState;
    confirm_token_hash: string | null;
    confirm_expires_at: string | null;
  }> {
    const row = await this.deps.db
      .prepare(
        `SELECT member_id, state, confirm_token_hash, confirm_expires_at
           FROM deletion_requests WHERE id = ?`,
      )
      .bind(requestId)
      .first<{
        member_id: string;
        state: DeletionState;
        confirm_token_hash: string | null;
        confirm_expires_at: string | null;
      }>();
    if (!row) throw new AccountDeletionError("NOT_FOUND", "Deletion request not found.");
    if (row.member_id !== memberId)
      throw new AccountDeletionError("NOT_OWNER", "Deletion request not found.");
    return row;
  }

  private async assertUsableToken(
    row: {
      state: DeletionState;
      confirm_token_hash: string | null;
      confirm_expires_at: string | null;
    },
    token: string,
  ): Promise<void> {
    if (row.state !== "PENDING_CONFIRM") {
      throw new AccountDeletionError("NOT_PENDING", "Deletion request is no longer pending.");
    }
    if (!row.confirm_token_hash) {
      throw new AccountDeletionError("ALREADY_CONSUMED", "The confirmation has already been used.");
    }
    if (!row.confirm_expires_at || row.confirm_expires_at <= this.deps.clock.nowIso()) {
      throw new AccountDeletionError("TOKEN_EXPIRED", "The confirmation has expired.");
    }
    const actual = await sha256B64(token);
    if (!constantTimeEqual(actual, row.confirm_token_hash)) {
      throw new AccountDeletionError("TOKEN_INVALID", "The confirmation is invalid.");
    }
  }

  private audit(
    actorId: string | null,
    requestId: string,
    action: string,
    fromState: string | null,
    toState: string | null,
    reasonCode: string,
  ): Promise<void> {
    return this.deps.audit.record({
      actorType: actorId ? "MEMBER" : "SYSTEM",
      actorId,
      action,
      entityType: "DELETION_REQUEST",
      entityId: requestId,
      fromState,
      toState,
      reasonCode,
      correlationId: requestId,
      metadata: null,
    });
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256B64(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64url(new Uint8Array(digest));
}

async function shortHash(input: string): Promise<string> {
  return (await sha256B64(input)).slice(0, 24).toLowerCase();
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function assertStageTransition(
  result: D1Result<unknown> | undefined,
  from: DeletionState,
  to: DeletionState,
): void {
  if ((result?.meta.changes ?? 0) !== 1) {
    throw new Error(`Deletion transition ${from} -> ${to} failed.`);
  }
}
