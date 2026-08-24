// Inbound email service.
//
// Handles POST /api/webhooks/resend. Critical correctness rules:
//   1. The webhook payload is metadata only — body and attachments must be
//      fetched via the Resend Received Emails API and Attachments API.
//      See MASTER_SPEC §9.6 and docs/08_RESEND_EMAIL_CALENDAR.md.
//   2. Signature is verified on the RAW request body (Svix-style:
//      svix-id + svix-timestamp + svix-signature). Do not parse/re-serialise
//      before verification.
//   3. Replays (same provider event id) are deduped.
//   4. Unknown senders are kept on the unmatched branch and never silently
//      fuzzy-matched to a member.

import type { D1Database } from "@cloudflare/workers-types";
import { newInboundId } from "../infra/ids.js";
import type {
  ReceivedEmailBody,
  ReceivedEmailMetadata,
  ResendAdapter,
} from "../adapters/resend.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";
import {
  inboundEmailMachine,
  type InboundEvent,
  type InboundState,
} from "../domain/machines/inbound-email.js";
import { Webhook } from "svix";

export interface InboundWebhookDeps {
  readonly db: D1Database;
  readonly resend: ResendAdapter;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly signingSecret: string;
}

export interface ResendWebhookPayload {
  readonly type: string;
  readonly created_at: string;
  readonly data: {
    readonly email_id: string;
    readonly from: string;
    readonly to: ReadonlyArray<string>;
    readonly subject: string;
    readonly message_id?: string;
    readonly created_at?: string;
  };
}

export type HandleResult =
  | { status: "processed"; inboundId: string; matched: boolean }
  | { status: "duplicate"; providerEventId: string }
  | { status: "ignored"; reason: string }
  | { status: "rejected"; reason: string };

export class InboundEmailService {
  constructor(private readonly deps: InboundWebhookDeps) {}

  /**
   * Verify the Resend webhook signature on the raw body and dispatch.
   * Returns a HandleResult the Worker route can use to choose the HTTP
   * status (2xx for processed/duplicate/ignored, 400 for rejected).
   */
  async handleRaw(rawBody: string, headers: Record<string, string>): Promise<HandleResult> {
    const eventId = headers["svix-id"];
    if (!eventId) {
      return { status: "rejected", reason: "missing svix-id header" };
    }
    let payload: ResendWebhookPayload;
    try {
      const wh = new Webhook(this.deps.signingSecret);
      const verified = wh.verify(rawBody, {
        "svix-id": eventId,
        "svix-timestamp": headers["svix-timestamp"] ?? "",
        "svix-signature": headers["svix-signature"] ?? "",
      });
      payload = verified as ResendWebhookPayload;
    } catch (err) {
      await this.deps.audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "INBOUND_WEBHOOK_SIGNATURE_INVALID",
        entityType: "INBOUND_MESSAGE",
        entityId: null,
        fromState: "RECEIVED",
        toState: "REJECTED",
        reasonCode: "INVALID_SIGNATURE",
        correlationId: null,
        metadata: { eventId, error: String(err) },
      });
      return { status: "rejected", reason: "invalid signature" };
    }

    if (payload.type !== "email.received") {
      return { status: "ignored", reason: `unsupported event type: ${payload.type}` };
    }

    return this.processEvent(eventId, payload);
  }

  private async processEvent(
    eventId: string,
    payload: ResendWebhookPayload,
  ): Promise<HandleResult> {
    // Dedupe.
    const existing = await this.deps.db
      .prepare(`SELECT id, state FROM inbound_messages WHERE provider_event_id = ?`)
      .bind(eventId)
      .first<{ id: string; state: InboundState }>();
    if (existing) {
      await this.deps.audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "INBOUND_WEBHOOK_DUPLICATE",
        entityType: "INBOUND_MESSAGE",
        entityId: existing.id,
        fromState: existing.state,
        toState: "ACKNOWLEDGED_NOOP",
        reasonCode: "DUPLICATE",
        correlationId: null,
        metadata: { eventId },
      });
      return { status: "duplicate", providerEventId: eventId };
    }

    const id = newInboundId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO inbound_messages
          (id, provider_event_id, provider_email_id, from_address, from_name,
           to_addresses_json, subject, message_id_header, signature_verified, state,
           received_at, raw_metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'SIGNATURE_VERIFIED', ?, ?, ?)`,
      )
      .bind(
        id,
        eventId,
        payload.data.email_id,
        payload.data.from,
        null,
        JSON.stringify(payload.data.to),
        payload.data.subject,
        payload.data.message_id ?? null,
        now,
        JSON.stringify(payload),
        now,
      )
      .run();

    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "INBOUND_WEBHOOK_VERIFIED",
      entityType: "INBOUND_MESSAGE",
      entityId: id,
      fromState: "RECEIVED",
      toState: "SIGNATURE_VERIFIED",
      reasonCode: "OK",
      correlationId: null,
      metadata: { eventId, emailId: payload.data.email_id },
    });

    // Move to STORED.
    await this.transition(id, "PERSIST_METADATA");

    // Fetch the body via the Resend Received Emails API.
    const emailId = payload.data.email_id;
    let matched = false;
    await this.transition(id, "FETCH_BODY");
    try {
      const metadata = await this.deps.resend.getReceivedMetadata(emailId);
      const body = await this.deps.resend.getReceivedBody(emailId);
      matched = await this.persistAndRoute(id, metadata, body);
    } catch {
      await this.transition(id, "BODY_FETCH_FAILED");
      // Single retry once; escalation if that fails.
      try {
        await this.transition(id, "RETRY_FETCH");
        const metadata = await this.deps.resend.getReceivedMetadata(emailId);
        const body = await this.deps.resend.getReceivedBody(emailId);
        matched = await this.persistAndRoute(id, metadata, body);
      } catch {
        await this.transition(id, "BODY_FETCH_FAILED");
        await this.transition(id, "ESCALATE_FETCH");
      }
    }

    return { status: "processed", inboundId: id, matched };
  }

  private async persistAndRoute(
    id: string,
    metadata: ReceivedEmailMetadata,
    body: ReceivedEmailBody,
  ): Promise<boolean> {
    await this.deps.db
      .prepare(
        `UPDATE inbound_messages
         SET from_name = ?, body_text = ?, body_html = ?, raw_metadata_json = ?
         WHERE id = ?`,
      )
      .bind(
        metadata.fromName,
        body.text,
        body.html,
        JSON.stringify({ metadata, headers: body.headers }),
        id,
      )
      .run();
    await this.transition(id, "BODY_FETCHED");

    const member = await this.deps.db
      .prepare(`SELECT id FROM members WHERE email = ?`)
      .bind(metadata.from.toLowerCase())
      .first<{ id: string }>();
    const matched = Boolean(member);
    if (member) {
      await this.deps.db
        .prepare(`UPDATE inbound_messages SET match_member_id = ? WHERE id = ?`)
        .bind(member.id, id)
        .run();
      await this.transition(id, "MATCH_SENDER");
    } else {
      await this.transition(id, "MARK_UNMATCHED");
    }

    await this.transition(id, "CLASSIFY");
    await this.transition(id, matched ? "AUTO_HANDLE" : "ROUTE_TO_HUMAN");
    await this.transition(id, "CLOSE");
    return matched;
  }

  private async transition(id: string, event: InboundEvent): Promise<void> {
    const row = await this.deps.db
      .prepare(`SELECT state FROM inbound_messages WHERE id = ?`)
      .bind(id)
      .first<{ state: InboundState }>();
    if (!row) return;
    const result = inboundEmailMachine.next(row.state, event);
    if (!result.allowed) {
      await this.deps.audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "INBOUND_TRANSITION_REJECTED",
        entityType: "INBOUND_MESSAGE",
        entityId: id,
        fromState: row.state,
        toState: row.state,
        reasonCode: result.reasonCode,
        correlationId: null,
        metadata: { event, machine: "inbound-email" },
      });
      return;
    }
    await this.deps.db
      .prepare(`UPDATE inbound_messages SET state = ? WHERE id = ?`)
      .bind(result.toState, id)
      .run();
    await this.deps.audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "INBOUND_TRANSITION",
      entityType: "INBOUND_MESSAGE",
      entityId: id,
      fromState: row.state,
      toState: result.toState,
      reasonCode: result.reasonCode,
      correlationId: null,
      metadata: { event, machine: "inbound-email" },
    });
  }
}
