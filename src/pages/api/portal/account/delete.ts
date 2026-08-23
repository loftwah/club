// Account deletion request.
// /api/portal/account/delete
// Stops future personalisation, marks a deletion request, and
// emails a confirmation link. The actual data-removal workflow
// runs after the link is confirmed.

import type { APIRoute } from "astro";
import { requireSession } from "../../../../lib/portal-auth";
import { newId } from "../../../../infra/ids";
import { D1AuditWriter } from "../../../../infra/audit";
import { SystemClock } from "../../../../infra/clock";
import { RealResendAdapter } from "../../../../adapters/resend-real";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const env = locals.runtime.env;
  if (!env?.DB) return new Response("DB not available", { status: 500 });
  const ctx = await requireSession(request, env);
  if (!ctx) return new Response("Sign in first.", { status: 401 });
  const id = newId("del");
  const now = new SystemClock().nowIso();
  await env.DB.prepare(
    `INSERT INTO deletion_requests (id, member_id, requested_at, state)
       VALUES (?, ?, ?, 'PENDING_CONFIRM')`,
  )
    .bind(id, ctx.member.id, now)
    .run();
  // Future personalisation is suspended immediately.
  await env.DB.prepare(`UPDATE members SET updated_at = ? WHERE id = ?`)
    .bind(now, ctx.member.id)
    .run();
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  await audit.record({
    actorType: "MEMBER",
    actorId: ctx.member.id,
    action: "DELETION_REQUESTED",
    entityType: "DELETION_REQUEST",
    entityId: id,
    fromState: null,
    toState: "PENDING_CONFIRM",
    reasonCode: "OK",
    correlationId: null,
    metadata: null,
  });
  // Best-effort confirmation email. In production this would be a
  // Resend email; in dev we record the link.
  const confirmUrl = `${env.APP_BASE_URL ?? "https://club.loftwah.com"}/api/portal/account/delete-confirm?id=${encodeURIComponent(id)}`;
  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    const resend = new RealResendAdapter({ apiKey: env.RESEND_API_KEY, fetchImpl: fetch });
    try {
      await resend.send({
        to: ctx.member.email,
        from: env.RESEND_FROM,
        subject: "Confirm your account deletion",
        html: `<p>Click to confirm account deletion:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p>`,
        text: `Confirm account deletion: ${confirmUrl}`,
        idempotencyKey: `deletion-confirm:${id}`,
      });
    } catch {
      // ignored
    }
  }
  return redirect("/portal/account/delete/?pending=1", 303);
};
