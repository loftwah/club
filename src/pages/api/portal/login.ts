// Magic-link request endpoint.
// POST /api/portal/login
// Body: { email }
// Returns: 200 { ok: true, devUrl?: string } on accept.
// We never reveal whether the email is on a member record (no
// user enumeration). In dev we also surface the link so the
// developer can test the flow without setting up Resend.

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { z } from "zod";
import { MagicLinkService, safeInternalPath } from "@services/magic-link";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";
import { RealResendAdapter } from "@adapters/resend-real";
import { brand } from "../../../brand/config";
import { isSameOriginMutation } from "../../../lib/request-security";

const schema = z.object({
  email: z.email().max(200),
  next: z.string().max(512).optional(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  if (!env?.DB) {
    return json({ error: "database not available" }, 500);
  }
  if (!isSameOriginMutation(request)) return json({ error: "cross-origin request rejected" }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid email" }, 400);
  }
  const rateLimitKey = await hashedRateLimitKey(parsed.data.email);
  const rateLimit = await env.MAGIC_LINK_RATE_LIMITER.limit({ key: rateLimitKey });
  if (!rateLimit.success) {
    return json({ error: "Too many sign-in requests. Please wait a minute and try again." }, 429);
  }
  // Look up member by email. We never echo whether the email
  // exists; we always return ok: true on a well-formed request.
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const member = await env.DB.prepare(`SELECT id, email FROM members WHERE email = ?`)
    .bind(parsed.data.email.toLowerCase())
    .first<{ id: string; email: string }>();
  if (!member) {
    await audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: "MAGIC_LINK_REQUEST_UNKNOWN_EMAIL",
      entityType: "MAGIC_LINK",
      entityId: null,
      fromState: null,
      toState: "ISSUED",
      reasonCode: "UNKNOWN_EMAIL",
      correlationId: null,
      metadata: { email: parsed.data.email.toLowerCase() },
    });
    return json({ ok: true }, 200);
  }
  const service = new MagicLinkService({
    db: env.DB,
    audit,
    clock: new SystemClock(),
    appBaseUrl: env.APP_BASE_URL ?? "https://club.loftwah.com",
  });
  const issued = await service.request({
    memberId: member.id,
    email: member.email,
    continuePath: safeInternalPath(parsed.data.next),
  });
  // Best-effort email send. Failure to send is recorded but
  // does not affect the user-visible response.
  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    const resend = new RealResendAdapter({
      apiKey: env.RESEND_API_KEY,
      fetchImpl: fetch,
    });
    try {
      await resend.send({
        to: parsed.data.email,
        from: env.RESEND_FROM,
        subject: `Your ${brand.name} sign-in link`,
        html: renderMagicLinkEmail(issued.url, brand.name),
        text: renderMagicLinkText(issued.url, brand.name),
        idempotencyKey: `magic-link:${issued.token}`,
      });
    } catch (err) {
      await audit.record({
        actorType: "SYSTEM",
        actorId: null,
        action: "MAGIC_LINK_SEND_FAILED",
        entityType: "MAGIC_LINK",
        entityId: null,
        fromState: "ISSUED",
        toState: "SEND_FAILED",
        reasonCode: String(err),
        correlationId: null,
        metadata: null,
      });
    }
  }
  // Surface the dev URL only when the local dev env flag is set.
  // NEVER in production. The Resend path is the production path.
  const isDev =
    (env.APP_BASE_URL ?? "").includes("localhost") ||
    (env.APP_BASE_URL ?? "").includes("127.0.0.1");
  return json({ ok: true, devUrl: isDev ? issued.url : undefined }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderMagicLinkEmail(url: string, brandName: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Your sign-in link</title></head>
<body style="margin:0;background:#f5f1e7;color:#12110f;font-family:Arial,sans-serif;line-height:1.55;">
<div style="display:none;max-height:0;overflow:hidden;">A single-use sign-in link for ${escapeHtml(brandName)}.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1e7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #12110f;background:#fbf9f3;">
<tr><td style="padding:12px 20px;background:#2447ff;color:white;font-family:monospace;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;">${escapeHtml(brandName)} / Member access</td></tr>
<tr><td style="padding:40px 32px;"><p style="margin:0 0 18px;font-family:Georgia,serif;font-size:20px;">Hello,</p>
<h1 style="margin:0 0 22px;font-size:38px;line-height:1;letter-spacing:-1.5px;">Your portal is one click away.</h1>
<p style="margin:0 0 24px;">This link is single-use and expires in 15 minutes.</p>
<p style="margin:0 0 28px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 18px;background:#12110f;color:white;text-decoration:none;font-family:monospace;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Sign in to the member portal</a></p>
<p style="margin:0;color:#69655d;font-size:13px;overflow-wrap:anywhere;">If the button does not work, copy this address:<br><a href="${escapeHtml(url)}" style="color:#1932be;">${escapeHtml(url)}</a></p>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #d5cfc1;color:#69655d;font-size:11px;">If you did not request this link, ignore this email. No password has changed.</td></tr>
</table></td></tr></table></body></html>`;
}

function renderMagicLinkText(url: string, brandName: string): string {
  return `Hello,\n\nThis is ${brandName}. Use the link below to sign in to the member portal. It is single-use and expires in 15 minutes.\n\n${url}\n\nIf you did not request this link, you can ignore this email.\n\n${brandName}\n`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function hashedRateLimitKey(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(`magic-link:${email.trim().toLowerCase()}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
