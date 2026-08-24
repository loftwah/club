// Sign out endpoint.
// POST /api/portal/logout
// Revokes the current session and clears the cookie.

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { MagicLinkService, buildClearSessionCookie, SESSION_COOKIE } from "@services/magic-link";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";
import { isSameOriginMutation } from "../../../lib/request-security";

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  if (!env?.DB) {
    return new Response("Database not available", { status: 500 });
  }
  if (!isSameOriginMutation(request))
    return new Response("Cross-origin request rejected.", { status: 403 });
  const cookieHeader = request.headers.get("cookie") ?? "";
  let sessionId: string | null = null;
  for (const part of cookieHeader.split(/;\s*/)) {
    const [k, v] = part.split("=");
    if (k === SESSION_COOKIE && v) sessionId = decodeURIComponent(v);
  }
  if (sessionId) {
    const audit = new D1AuditWriter(env.DB, new SystemClock());
    const service = new MagicLinkService({
      db: env.DB,
      audit,
      clock: new SystemClock(),
      appBaseUrl: env.APP_BASE_URL ?? "https://club.loftwah.com",
    });
    await service.revokeSession(sessionId, "MEMBER_LOGOUT");
  }
  const headers = new Headers({ Location: "/portal/login/" });
  headers.append("Set-Cookie", buildClearSessionCookie("/"));
  // Clear the pre-onboarding cookie scope as well so a session issued by an
  // older deployment cannot survive logout on portal-only paths.
  headers.append("Set-Cookie", buildClearSessionCookie("/portal"));
  return new Response(null, { status: 302, headers });
};
