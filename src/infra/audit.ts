// Audit log. Every important action writes one row. The audit log is
// append-only; nothing in the system updates or deletes an audit row.

import type { D1Database } from "@cloudflare/workers-types";
import { newId } from "./ids.js";
import type { Clock } from "./clock.js";

export type ActorType = "MEMBER" | "OPERATOR" | "AGENT" | "SYSTEM";

export interface AuditEvent {
  readonly actorType: ActorType;
  readonly actorId: string | null;
  readonly action: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly fromState?: string | null;
  readonly toState?: string | null;
  readonly reasonCode?: string | null;
  readonly correlationId?: string | null;
  readonly metadata?: Record<string, unknown> | null;
}

export interface AuditWriter {
  record(event: AuditEvent): Promise<void>;
}

export class D1AuditWriter implements AuditWriter {
  constructor(
    private readonly db: D1Database,
    private readonly clock: Clock,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO audit_log (
           id, actor_type, actor_id, action, entity_type, entity_id,
           from_state, to_state, reason_code, correlation_id, metadata_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        newId("aud"),
        event.actorType,
        event.actorId,
        event.action,
        event.entityType,
        event.entityId,
        event.fromState ?? null,
        event.toState ?? null,
        event.reasonCode ?? null,
        event.correlationId ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        this.clock.nowIso(),
      )
      .run();
  }
}

/** In-memory audit writer for tests. */
export class InMemoryAuditWriter implements AuditWriter {
  readonly events: AuditEvent[] = [];
  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}
