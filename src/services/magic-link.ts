// Magic-link authentication.
//
// Per MASTER_SPEC §12.4 the member auth is a short-lived,
// single-use, opaque token delivered by email. We hash the
// token at rest, set a secure HttpOnly session cookie, and
// support replay prevention + revocation.
//
// Implementation notes:
// - We use Web Crypto (`crypto.subtle`) which is available in
//   Cloudflare Workers and in Node 18+.
// - Tokens are 32 bytes of CSPRNG output, base64url-encoded.
// - At rest we store SHA-256(token), not the token itself.
// - Single-use: a successful consumption deletes the row.
// - Expiry: tokens expire at `created_at + ttl`.
// - Replay prevention: hash dedupe is implicit (the row
//   exists or it does not).
// - Revocation: members can request session revocation; the
//   row's `revoked_at` is set, the session is dead.

import type { D1Database } from "@cloudflare/workers-types";
import { newId } from "../infra/ids.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";

export interface MagicLinkRecord {
  readonly id: string;
  readonly memberId: string;
  readonly email: string;
  readonly tokenHash: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly revokedAt: string | null;
}

export interface MemberSession {
  readonly id: string;
  readonly memberId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

export interface MagicLinkServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly ttlMs?: number;
  readonly sessionTtlMs?: number;
  readonly appBaseUrl: string;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class MagicLinkService {
  private readonly ttlMs: number;
  private readonly sessionTtlMs: number;
  constructor(private readonly deps: MagicLinkServiceDeps) {
    this.ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
    this.sessionTtlMs = deps.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  }

  /**
   * Request a magic link. Returns the opaque token (the full
   * URL fragment after `#token=`) which the caller delivers by
   * email. We persist only the hash. The token is shown ONCE.
   */
  async request(input: { memberId: string; email: string; continuePath?: string | null }): Promise<{
    token: string;
    url: string;
    expiresAt: string;
  }> {
    const member = await this.deps.db
      .prepare(`SELECT id, email FROM members WHERE id = ?`)
      .bind(input.memberId)
      .first<{ id: string; email: string }>();
    if (!member) throw new Error("Unknown member");
    if (member.email.toLowerCase() !== input.email.toLowerCase()) {
      throw new Error("Email does not match member record.");
    }
    const id = newId("mlk");
    const token = generateToken();
    const tokenHash = await sha256B64(token);
    const now = this.deps.clock.now();
    const expiresAt = new Date(now.getTime() + this.ttlMs).toISOString();
    await this.deps.db
      .prepare(
        `INSERT INTO magic_links (id, member_id, email, token_hash, created_at, expires_at, consumed_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
      )
      .bind(id, input.memberId, input.email.toLowerCase(), tokenHash, now.toISOString(), expiresAt)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: input.memberId,
      action: "MAGIC_LINK_REQUESTED",
      entityType: "MAGIC_LINK",
      entityId: id,
      fromState: null,
      toState: "ISSUED",
      reasonCode: null,
      correlationId: null,
      metadata: null,
    });
    const query = new URLSearchParams({ token });
    const continuePath = safeInternalPath(input.continuePath);
    if (continuePath) query.set("next", continuePath);
    const url = `${this.deps.appBaseUrl}/portal/auth?${query.toString()}`;
    return { token, url, expiresAt };
  }

  /**
   * Consume a magic link. Returns the session on success. Errors:
   *   - NOT_FOUND
   *   - ALREADY_CONSUMED
   *   - EXPIRED
   *   - REVOKED
   */
  async consume(token: string): Promise<MemberSession> {
    const tokenHash = await sha256B64(token);
    const row = await this.deps.db
      .prepare(`SELECT * FROM magic_links WHERE token_hash = ?`)
      .bind(tokenHash)
      .first<{
        id: string;
        member_id: string;
        token_hash: string;
        created_at: string;
        expires_at: string;
        consumed_at: string | null;
        revoked_at: string | null;
      }>();
    if (!row) throw new MagicLinkError("NOT_FOUND", "Token not recognised.");
    if (row.revoked_at) throw new MagicLinkError("REVOKED", "Token has been revoked.");
    if (row.consumed_at) {
      // Replay attempt. We also revoke the link to be safe and
      // surface the issue to the member on the next attempt.
      await this.deps.db
        .prepare(`UPDATE magic_links SET revoked_at = ? WHERE id = ?`)
        .bind(this.deps.clock.nowIso(), row.id)
        .run();
      await this.deps.audit.record({
        actorType: "MEMBER",
        actorId: row.member_id,
        action: "MAGIC_LINK_REPLAY_DETECTED",
        entityType: "MAGIC_LINK",
        entityId: row.id,
        fromState: "ISSUED",
        toState: "REVOKED",
        reasonCode: "REPLAY",
        correlationId: null,
        metadata: null,
      });
      throw new MagicLinkError("ALREADY_CONSUMED", "Token already used.");
    }
    if (new Date(row.expires_at).getTime() <= this.deps.clock.now().getTime()) {
      throw new MagicLinkError("EXPIRED", "Token has expired.");
    }
    const now = this.deps.clock.now();
    const consumed = await this.deps.db
      .prepare(`UPDATE magic_links SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`)
      .bind(now.toISOString(), row.id)
      .run();
    // The read above and this conditional update can race across requests.
    // Only the request that changes an unconsumed row may mint a session.
    if ((consumed.meta.changes ?? 0) !== 1) {
      throw new MagicLinkError("ALREADY_CONSUMED", "Token already used.");
    }
    // Issue a session.
    const session = await this.issueSession(row.member_id);
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: row.member_id,
      action: "MAGIC_LINK_CONSUMED",
      entityType: "MAGIC_LINK",
      entityId: row.id,
      fromState: "ISSUED",
      toState: "CONSUMED",
      reasonCode: "OK",
      correlationId: null,
      metadata: { sessionId: session.id },
    });
    return session;
  }

  /**
   * Issue a session for a member. Used both by magic-link
   * consume and by tests.
   */
  async issueSession(memberId: string): Promise<MemberSession> {
    const id = newId("ses");
    const now = this.deps.clock.now();
    const expiresAt = new Date(now.getTime() + this.sessionTtlMs).toISOString();
    await this.deps.db
      .prepare(
        `INSERT INTO member_sessions (id, member_id, created_at, expires_at, revoked_at)
         VALUES (?, ?, ?, ?, NULL)`,
      )
      .bind(id, memberId, now.toISOString(), expiresAt)
      .run();
    return {
      id,
      memberId,
      createdAt: now.toISOString(),
      expiresAt,
      revokedAt: null,
    };
  }

  /**
   * Verify a session token. Returns the session or throws. Used by
   * every portal route to gate access.
   */
  async verifySession(sessionId: string): Promise<MemberSession> {
    const row = await this.deps.db
      .prepare(`SELECT * FROM member_sessions WHERE id = ?`)
      .bind(sessionId)
      .first<{
        id: string;
        member_id: string;
        created_at: string;
        expires_at: string;
        revoked_at: string | null;
      }>();
    if (!row) throw new MagicLinkError("NOT_FOUND", "Session not recognised.");
    if (row.revoked_at) throw new MagicLinkError("REVOKED", "Session has been revoked.");
    if (new Date(row.expires_at).getTime() <= this.deps.clock.now().getTime()) {
      throw new MagicLinkError("EXPIRED", "Session has expired.");
    }
    return {
      id: row.id,
      memberId: row.member_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    };
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.deps.db
      .prepare(`UPDATE member_sessions SET revoked_at = ? WHERE id = ?`)
      .bind(this.deps.clock.nowIso(), sessionId)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: null,
      action: "SESSION_REVOKED",
      entityType: "MEMBER_SESSION",
      entityId: sessionId,
      fromState: null,
      toState: "REVOKED",
      reasonCode: reason,
      correlationId: null,
      metadata: null,
    });
  }

  /** Revoke all sessions for a member (used on password-style
   * logout-everywhere flows and on member-initiated security
   * resets). */
  async revokeAllForMember(memberId: string, reason: string): Promise<number> {
    const result = await this.deps.db
      .prepare(
        `UPDATE member_sessions SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL`,
      )
      .bind(this.deps.clock.nowIso(), memberId)
      .run();
    await this.deps.audit.record({
      actorType: "MEMBER",
      actorId: memberId,
      action: "SESSIONS_ALL_REVOKED",
      entityType: "MEMBER_SESSION",
      entityId: null,
      fromState: null,
      toState: "REVOKED",
      reasonCode: reason,
      correlationId: null,
      metadata: { affected: result.meta.changes ?? 0 },
    });
    return result.meta.changes ?? 0;
  }
}

export class MagicLinkError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "EXPIRED" | "ALREADY_CONSUMED" | "REVOKED",
    message: string,
  ) {
    super(message);
    this.name = "MagicLinkError";
  }
}

/** Generate a 32-byte cryptographically random token, base64url. */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 of a string, returned as base64url. */
async function sha256B64(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(digest));
}

/**
 * Cookie helpers. Used by the portal and onboarding routes to set the
 * session cookie. Secure HttpOnly, SameSite=Lax. The root path is required
 * because authenticated applicants continue onboarding at /onboarding/.
 */
export const SESSION_COOKIE = "society_session";

/** Accept only same-origin relative paths for post-authentication handoff. */
export function safeInternalPath(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return null;
  if (candidate.includes("\\") || /[\u0000-\u001f\u007f]/.test(candidate)) return null;
  try {
    const decoded = decodeURIComponent(candidate);
    if (decoded.startsWith("//")) return null;
    const parsed = new URL(candidate, "https://club.loftwah.invalid");
    if (parsed.origin !== "https://club.loftwah.invalid") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function buildSessionCookie(sessionId: string, maxAgeSec: number): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ].join("; ");
}
export function buildClearSessionCookie(path = "/"): string {
  return [
    `${SESSION_COOKIE}=`,
    `Path=${path}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}
