// Magic-link request endpoint.
// POST /api/portal/login
// Body: { email }
// Returns: 200 { ok: true, devUrl?: string } on accept.
// We never reveal whether the email is on a member record (no
// user enumeration). In dev we also surface the link so the
// developer can test the flow without setting up Resend.

import type { APIRoute } from "astro";
import { z } from "zod";
import { MagicLinkService } from "@services/magic-link";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";
import { RealResendAdapter } from "@adapters/resend-real";
import { brand } from "../../../brand/config";

const schema = z.object({
  email: z.string().email().max(200),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  if (!env?.DB) {
    return json({ error: "database not available" }, 500);
  }
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
  // Look up member by email. We never echo whether the email
  // exists; we always return ok: true on a well-formed request.
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const member = await env.DB
    .prepare(`SELECT id, email FROM members WHERE email = ?`)
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
  const isDev = (env.APP_BASE_URL ?? "").includes("localhost") || (env.APP_BASE_URL ?? "").includes("127.0.0.1");
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
<html><body>
<p>Hello,</p>
<p>This is ${escapeHtml(brandName)}. Use the link below to sign in to the member portal. It is single-use and expires in 15 minutes.</p>
<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
<p>If you did not request this link, you can ignore this email.</p>
<p style="font-size:12px;color:#666">${escapeHtml(brandName)}</p>
</body></html>`;
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
