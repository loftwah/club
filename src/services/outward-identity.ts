// Issue #13: outward-facing club identity resolution.
//
// The product name (e.g. "Plans With You") is the platform
// fallback identity. Each chapter can declare its own default
// outward-facing name. A member can also choose a custom
// name. The resolver walks the chain
//   platform -> area default -> member override
// and returns a fully-resolved identity. Commitments snapshot
// the resolved identity so historic artefacts keep their
// original name even if a member later changes their override
// or a chapter's default.

import type { D1Database } from "@cloudflare/workers-types";
import { brand } from "../brand/config.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";

export type IdentitySource = "DEFAULT" | "CURATED" | "GENERATED" | "CUSTOM";

export interface ResolvedIdentity {
  readonly displayName: string;
  readonly source: "PLATFORM" | IdentitySource;
  /** Owner that produced the resolved value. */
  readonly scope: "platform" | "chapter" | "member";
  /** Database id of the chapter or member override, or null. */
  readonly scopeId: string | null;
}

export interface OutwardIdentityServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly platformFallback: string;
}

const RESERVED = new Set<string>([
  "POLICE",
  "AMBULANCE",
  "EMERGENCY",
  "FBI",
  "CIA",
  "GOVERNMENT",
  "TAX",
  "COURT",
  "IMMIGRATION",
  "HOSPITAL",
  "DOCTOR",
  "MEDICAL",
  "BANK",
]);

const MAX_LENGTH = 60;
const MIN_LENGTH = 2;

export class OutwardIdentityService {
  constructor(private readonly deps: OutwardIdentityServiceDeps) {}

  /**
   * Resolve the identity that should appear on a new
   * commitment. The chain is:
   *
   *   member override (status = ACTIVE)
   *     -> chapter default (status = ACTIVE)
   *     -> platform fallback
   */
  async resolveForCommitment(input: {
    memberId: string;
    chapterId: string | null;
  }): Promise<ResolvedIdentity> {
    // 1. Member override wins if present and active.
    const memberRow = await this.deps.db
      .prepare(
        `SELECT id, display_name, source
           FROM member_outward_identities
          WHERE member_id = ? AND status = 'ACTIVE'
          ORDER BY updated_at DESC LIMIT 1`,
      )
      .bind(input.memberId)
      .first<{ id: string; display_name: string; source: IdentitySource }>();
    if (memberRow) {
      return {
        displayName: memberRow.display_name,
        source: memberRow.source,
        scope: "member",
        scopeId: memberRow.id,
      };
    }
    // 2. Chapter default.
    if (input.chapterId) {
      const chapterRow = await this.deps.db
        .prepare(
          `SELECT id, display_name, source
             FROM chapter_outward_identities
            WHERE chapter_id = ? AND status = 'ACTIVE'
            ORDER BY updated_at DESC LIMIT 1`,
        )
        .bind(input.chapterId)
        .first<{ id: string; display_name: string; source: IdentitySource }>();
      if (chapterRow) {
        return {
          displayName: chapterRow.display_name,
          source: chapterRow.source,
          scope: "chapter",
          scopeId: chapterRow.id,
        };
      }
    }
    // 3. Platform fallback.
    return {
      displayName: this.deps.platformFallback,
      source: "PLATFORM",
      scope: "platform",
      scopeId: null,
    };
  }

  /**
   * Set a chapter's default outward-facing club name. Existing
   * historic commitments keep their snapshot so the change only
   * affects future commitments.
   */
  async setChapterDefault(input: {
    chapterId: string;
    displayName: string;
    source: IdentitySource;
    actorId: string;
  }): Promise<void> {
    this.validateDisplayName(input.displayName);
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO chapter_outward_identities
          (id, chapter_id, display_name, status, source, created_at, updated_at)
         VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?)
         ON CONFLICT(chapter_id, display_name) DO UPDATE
           SET status = 'ACTIVE', source = excluded.source, updated_at = excluded.updated_at`,
      )
      .bind(crypto.randomUUID(), input.chapterId, input.displayName, input.source, now, now)
      .run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: input.actorId,
      action: "CHAPTER_OUTWARD_IDENTITY_SET",
      entityType: "CHAPTER",
      entityId: input.chapterId,
      fromState: null,
      toState: "ACTIVE",
      reasonCode: null,
      correlationId: null,
      metadata: { displayName: input.displayName, source: input.source },
    });
  }

  /**
   * Submit a custom member name. Validation is performed
   * up-front; an invalid name is rejected with a structured
   * error.
   */
  async submitMemberCustom(input: {
    memberId: string;
    displayName: string;
    actorId: string;
  }): Promise<{ accepted: true; id: string } | { accepted: false; reason: string }> {
    try {
      this.validateDisplayName(input.displayName);
    } catch (err) {
      return { accepted: false, reason: err instanceof Error ? err.message : "Invalid name" };
    }
    const now = this.deps.clock.nowIso();
    const id = crypto.randomUUID();
    await this.deps.db
      .prepare(
        `INSERT INTO member_outward_identities
          (id, member_id, display_name, status, source, created_at, updated_at)
         VALUES (?, ?, ?, 'ACTIVE', 'CUSTOM', ?, ?)
         ON CONFLICT(member_id, display_name) DO UPDATE
           SET status = 'ACTIVE', source = excluded.source, updated_at = excluded.updated_at`,
      )
      .bind(id, input.memberId, input.displayName, now, now)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: input.actorId,
      action: "MEMBER_OUTWARD_IDENTITY_SET",
      entityType: "MEMBER",
      entityId: input.memberId,
      fromState: null,
      toState: "ACTIVE",
      reasonCode: null,
      correlationId: null,
      metadata: { displayName: input.displayName, identityId: id },
    });
    return { accepted: true, id };
  }

  /**
   * List approved suggestions for a chapter. Curated
   * suggestions are deterministic; runtime AI generation is
   * not required for this issue.
   */
  listSuggestionsForChapter(chapterId: string): ReadonlyArray<string> {
    const suggestions: Record<string, ReadonlyArray<string>> = {
      melbourne: ["The Lyrebird Society", "Southbank Reading Club", "Carlton Letter Writers"],
      sydney: ["The Wattle Club", "Surry Hills Salon", "Paddington Pen Friends"],
      brisbane: ["The Bunya Society", "West End Letter Club"],
      adelaide: ["The Torrens Club", "North Terrace Salon"],
      perth: ["The Swan Society", "Fremantle Letter Club"],
      auckland: ["The Pohutukawa Society", "Wynyard Quarter Salon", "Karangahape Letter Club"],
    };
    return suggestions[chapterId] ?? ["The Quiet Society"];
  }

  static defaultPlatformFallback(): string {
    return brand.name;
  }

  validateDisplayName(name: string): void {
    if (typeof name !== "string") {
      throw new Error("Name must be a string.");
    }
    const trimmed = name.trim();
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      throw new Error(`Name must be ${MIN_LENGTH}-${MAX_LENGTH} characters.`);
    }
    // Reject control characters and the most common markup
    // characters. Apostrophes are allowed; that is the only
    // punctuation reserved for possessives and contractions
    // in natural names.
    for (const ch of trimmed) {
      const code = ch.codePointAt(0) ?? 0;
      if (code < 0x20) {
        throw new Error("Name contains control characters.");
      }
      if (ch === "<" || ch === ">" || ch === '"' || ch === "`" || ch === ";") {
        throw new Error("Name contains markup characters.");
      }
    }
    const upper = trimmed.toUpperCase();
    for (const reserved of RESERVED) {
      if (upper.includes(reserved)) {
        throw new Error(`Name cannot impersonate a high-stakes institution (${reserved}).`);
      }
    }
  }
}
