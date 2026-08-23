// Portal auth helper.
//
// Every portal route calls `requireSession(request, env)` to
// gate access. The helper reads the session cookie from the
// request, verifies the session against D1, and returns the
// session + member record.

import type { D1Database } from "@cloudflare/workers-types";
import { MagicLinkService, SESSION_COOKIE, MagicLinkError } from "@services/magic-link";
import { SystemClock } from "@infra/clock";
import { D1AuditWriter } from "@infra/audit";
import type { Member } from "@services/membership-service";

export interface PortalContext {
  readonly session: { id: string; memberId: string };
  readonly member: Member;
}

export async function requireSession(
  request: Request,
  env: { DB?: D1Database; APP_BASE_URL?: string } | undefined,
): Promise<PortalContext | null> {
  if (!env?.DB) return null;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionId = readSessionCookie(cookieHeader);
  if (!sessionId) return null;
  const service = new MagicLinkService({
    db: env.DB,
    audit: new D1AuditWriter(env.DB, new SystemClock()),
    clock: new SystemClock(),
    appBaseUrl: env.APP_BASE_URL ?? "https://club.loftwah.com",
  });
  let session;
  try {
    session = await service.verifySession(sessionId);
  } catch (err) {
    if (err instanceof MagicLinkError) {
      return null;
    }
    throw err;
  }
  const member = await env.DB
    .prepare(`SELECT * FROM members WHERE id = ?`)
    .bind(session.memberId)
    .first<Record<string, unknown>>();
  if (!member) return null;
  return {
    session: { id: session.id, memberId: session.memberId },
    member: rowToMember(member),
  };
}

function readSessionCookie(header: string): string | null {
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === SESSION_COOKIE && v) return decodeURIComponent(v);
  }
  return null;
}

function rowToMember(r: Record<string, unknown>): Member {
  return {
    id: r.id as string,
    email: r.email as string,
    preferredName: (r.preferred_name as string | null) ?? null,
    postalName: (r.postal_name as string | null) ?? null,
    societyAlias: (r.society_alias as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    metroArea: (r.metro_area as string | null) ?? null,
    chapterId: (r.chapter_id as string | null) ?? null,
    birthday: (r.birthday as string | null) ?? null,
    timezone: (r.timezone as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}
