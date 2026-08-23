// Sign out endpoint.
// POST /api/portal/logout
// Revokes the current session and clears the cookie.

import type { APIRoute } from "astro";
import { MagicLinkService, buildClearSessionCookie, SESSION_COOKIE } from "@services/magic-link";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const env = locals.runtime.env;
  if (!env?.DB) {
    return new Response("Database not available", { status: 500 });
  }
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
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/portal/login/",
      "Set-Cookie": buildClearSessionCookie(),
    },
  });
};
