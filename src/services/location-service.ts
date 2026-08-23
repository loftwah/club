// Location service.
//
// Stores curated locations for chapters. Locations are not invented
// by the model — they are discovered, verified against a source, and
// reviewed before becoming ACTIVE. ACTIVE locations can be used by
// event proposals; STALE / RETIRED locations cannot.
//
// Per MASTER_SPEC §8.7-8.8, event generation cannot use retired
// locations. Location reverification happens on a cron schedule.

import type { D1Database } from "@cloudflare/workers-types";
import { newLocationId } from "../infra/ids.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";

export type LocationStatus = "ACTIVE" | "REVERIFY_DUE" | "STALE" | "RETIRED";

export interface Location {
  readonly id: string;
  readonly chapterId: string | null;
  readonly name: string;
  readonly suburb: string | null;
  readonly address: string | null;
  readonly sourceUrl: string | null;
  readonly locationType: string | null;
  readonly tags: ReadonlyArray<string>;
  readonly status: LocationStatus;
  readonly verifiedAt: string | null;
}

export interface CreateLocationInput {
  readonly chapterId: string;
  readonly name: string;
  readonly suburb?: string;
  readonly address?: string;
  readonly sourceUrl?: string;
  readonly locationType?: string;
  readonly tags?: ReadonlyArray<string>;
}

export interface LocationServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

export class LocationService {
  constructor(private readonly deps: LocationServiceDeps) {}

  /** Propose a location. Initial status is REVERIFY_DUE until reviewed. */
  async propose(input: CreateLocationInput): Promise<Location> {
    const id = newLocationId();
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO locations
          (id, chapter_id, name, suburb, address, source_url, location_type, tags_json, status, verified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REVERIFY_DUE', NULL, ?)`,
      )
      .bind(
        id,
        input.chapterId,
        input.name,
        input.suburb ?? null,
        input.address ?? null,
        input.sourceUrl ?? null,
        input.locationType ?? null,
        input.tags ? JSON.stringify(input.tags) : null,
        now,
      )
      .run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: null,
      action: "LOCATION_PROPOSED",
      entityType: "LOCATION",
      entityId: id,
      fromState: null,
      toState: "REVERIFY_DUE",
      reasonCode: null,
      correlationId: null,
      metadata: { chapterId: input.chapterId, name: input.name, source: input.sourceUrl },
    });
    return (await this.get(id))!;
  }

  async activate(id: string, actorId: string): Promise<Location> {
    const loc = await this.get(id);
    if (!loc) throw new Error(`Unknown location: ${id}`);
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(`UPDATE locations SET status = 'ACTIVE', verified_at = ? WHERE id = ?`)
      .bind(now, id)
      .run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId,
      action: "LOCATION_ACTIVATED",
      entityType: "LOCATION",
      entityId: id,
      fromState: loc.status,
      toState: "ACTIVE",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  async retire(id: string, actorId: string, reason: string): Promise<Location> {
    const loc = await this.get(id);
    if (!loc) throw new Error(`Unknown location: ${id}`);
    await this.deps.db
      .prepare(`UPDATE locations SET status = 'RETIRED' WHERE id = ?`)
      .bind(id)
      .run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId,
      action: "LOCATION_RETIRED",
      entityType: "LOCATION",
      entityId: id,
      fromState: loc.status,
      toState: "RETIRED",
      reasonCode: reason,
      correlationId: null,
      metadata: null,
    });
    return (await this.get(id))!;
  }

  async listForChapter(chapterId: string, status?: LocationStatus): Promise<Location[]> {
    const sql = status
      ? `SELECT * FROM locations WHERE chapter_id = ? AND status = ? ORDER BY name ASC`
      : `SELECT * FROM locations WHERE chapter_id = ? ORDER BY name ASC`;
    const args: unknown[] = status ? [chapterId, status] : [chapterId];
    const rows = await this.deps.db
      .prepare(sql)
      .bind(...args)
      .all();
    return (rows.results ?? []).map((r) => rowToLocation(r as Record<string, unknown>));
  }

  async get(id: string): Promise<Location | null> {
    const row = await this.deps.db.prepare(`SELECT * FROM locations WHERE id = ?`).bind(id).first();
    if (!row) return null;
    return rowToLocation(row as Record<string, unknown>);
  }
}

function rowToLocation(r: Record<string, unknown>): Location {
  return {
    id: r.id as string,
    chapterId: (r.chapter_id as string | null) ?? null,
    name: r.name as string,
    suburb: (r.suburb as string | null) ?? null,
    address: (r.address as string | null) ?? null,
    sourceUrl: (r.source_url as string | null) ?? null,
    locationType: (r.location_type as string | null) ?? null,
    tags: r.tags_json ? (JSON.parse(r.tags_json as string) as string[]) : [],
    status: r.status as LocationStatus,
    verifiedAt: (r.verified_at as string | null) ?? null,
  };
}
