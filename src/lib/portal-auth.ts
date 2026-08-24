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

export interface OperatorContext extends PortalContext {
  readonly operatorEmail: string;
}

export interface OnboardingContext extends PortalContext {
  readonly membershipState:
    | "APPLICANT"
    | "EMAIL_VERIFIED"
    | "IDENTITY_COMPLETE"
    | "CHAPTER_RESOLUTION"
    | "TIER_SELECTED"
    | "PREFERENCES_COMPLETE"
    | "SERVICES_SELECTED"
    | "ALIGNMENT_COMPLETE"
    | "CONSENTS_COMPLETE"
    | "TERMS_ACCEPTED"
    | "PAYMENT_PENDING";
}

type PortalAuthEnv =
  { DB?: D1Database; APP_BASE_URL?: string; OPERATOR_EMAIL?: string } | undefined;

export async function requireSession(
  request: Request,
  env: PortalAuthEnv,
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
  const member = await env.DB.prepare(`SELECT * FROM members WHERE id = ?`)
    .bind(session.memberId)
    .first<Record<string, unknown>>();
  if (!member) return null;
  return {
    session: { id: session.id, memberId: session.memberId },
    member: rowToMember(member),
  };
}

/**
 * Central operator boundary. Operator access is granted only to the
 * configured operator email after that mailbox has completed the normal
 * magic-link flow. A browser-supplied email or role is never trusted.
 */
export async function requireOperator(
  request: Request,
  env: PortalAuthEnv,
): Promise<OperatorContext | null> {
  const configuredEmail = normalizeEmail(env?.OPERATOR_EMAIL);
  if (!configuredEmail) return null;
  const ctx = await requireSession(request, env);
  if (!ctx || normalizeEmail(ctx.member.email) !== configuredEmail) return null;
  return { ...ctx, operatorEmail: configuredEmail };
}

const ONBOARDING_STATES = new Set<OnboardingContext["membershipState"]>([
  "APPLICANT",
  "EMAIL_VERIFIED",
  "IDENTITY_COMPLETE",
  "CHAPTER_RESOLUTION",
  "TIER_SELECTED",
  "PREFERENCES_COMPLETE",
  "SERVICES_SELECTED",
  "ALIGNMENT_COMPLETE",
  "CONSENTS_COMPLETE",
  "TERMS_ACCEPTED",
  "PAYMENT_PENDING",
]);

/**
 * Bind onboarding to the authenticated member's own membership row. This is
 * deliberately not a "latest applicant" lookup: ownership comes from the
 * cryptographically-random, server-backed session established by magic link.
 */
export async function requireOnboardingSession(
  request: Request,
  env: PortalAuthEnv,
): Promise<OnboardingContext | null> {
  if (!env?.DB) return null;
  const ctx = await requireSession(request, env);
  if (!ctx) return null;
  const membership = await env.DB.prepare(
    `SELECT state FROM memberships WHERE member_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(ctx.member.id)
    .first<{ state: string }>();
  if (
    !membership ||
    !ONBOARDING_STATES.has(membership.state as OnboardingContext["membershipState"])
  ) {
    return null;
  }
  return {
    ...ctx,
    membershipState: membership.state as OnboardingContext["membershipState"],
  };
}

function readSessionCookie(header: string): string | null {
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const separator = p.indexOf("=");
    if (separator < 0) continue;
    const k = p.slice(0, separator).trim();
    const v = p.slice(separator + 1);
    if (k === SESSION_COOKIE && v) {
      try {
        return decodeURIComponent(v);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
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
