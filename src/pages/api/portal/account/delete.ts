import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { requireSession } from "../../../../lib/portal-auth";
import { D1AuditWriter } from "../../../../infra/audit";
import { SystemClock } from "../../../../infra/clock";
import { RealResendAdapter } from "../../../../adapters/resend-real";
import { AccountDeletionService } from "../../../../services/account-deletion";
import { isSameOriginMutation } from "../../../../lib/request-security";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const env = getRuntimeEnv(locals);
  if (!env?.DB) return new Response("DB not available", { status: 500 });
  if (!isSameOriginMutation(request))
    return new Response("Cross-origin request rejected.", { status: 403 });

  const ctx = await requireSession(request, env);
  if (!ctx) return new Response("Sign in first.", { status: 401 });
  const form = await request.formData();
  if (form.get("confirm") !== "true") {
    return new Response("Confirm that you understand the account-deletion consequences.", {
      status: 400,
    });
  }

  const clock = new SystemClock();
  const audit = new D1AuditWriter(env.DB, clock);
  const deletion = new AccountDeletionService({ db: env.DB, audit, clock });
  const confirmation = await deletion.begin(ctx.member.id);
  const baseUrl = env.APP_BASE_URL ?? "https://club.loftwah.com";
  const confirmUrl = new URL("/api/portal/account/delete-confirm", baseUrl);
  confirmUrl.searchParams.set("id", confirmation.requestId);
  confirmUrl.searchParams.set("token", confirmation.token);

  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    await deletion.markConfirmationDeliveryFailed(
      ctx.member.id,
      confirmation.requestId,
      "EMAIL_PROVIDER_NOT_CONFIGURED",
    );
    return new Response("Confirmation email is temporarily unavailable. No deletion was started.", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }

  const resend = new RealResendAdapter({ apiKey: env.RESEND_API_KEY, fetchImpl: fetch });
  try {
    await resend.send({
      to: ctx.member.email,
      from: env.RESEND_FROM,
      subject: "Review your account deletion request",
      html: renderConfirmationEmail(confirmUrl.toString(), confirmation.expiresAt),
      text: `Review and confirm your account deletion request within 30 minutes: ${confirmUrl.toString()}`,
      idempotencyKey: `deletion-confirm:${confirmation.requestId}`,
    });
  } catch {
    await deletion.markConfirmationDeliveryFailed(
      ctx.member.id,
      confirmation.requestId,
      "EMAIL_DELIVERY_FAILED",
    );
    return new Response("Confirmation email could not be sent. No deletion was started.", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }

  return redirect("/portal/account/delete/?pending=1", 303);
};

function renderConfirmationEmail(url: string, expiresAt: string): string {
  const safeUrl = escapeHtml(url);
  const safeExpiry = escapeHtml(expiresAt);
  return `<!doctype html><html><body style="margin:0;background:#f3efe5;color:#12110f;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;border:1px solid #12110f;background:#fffdf7"><tr><td style="padding:12px 20px;background:#2447ff;color:white;font-family:monospace;font-size:11px;letter-spacing:1.4px;text-transform:uppercase">Plans With You / Account control</td></tr><tr><td style="padding:30px 24px"><h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:400;font-size:28px">Review account deletion</h1><p style="line-height:1.6">This request has not deleted anything yet. Use the button below, sign in if asked, then review and confirm the consequences.</p><p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;padding:14px 18px;background:#12110f;color:white;text-decoration:none;font-family:monospace;font-size:12px;letter-spacing:1px;text-transform:uppercase">Review deletion request</a></p><p style="color:#69655d;font-size:13px">The link is single-use and expires at ${safeExpiry}. If you did not request this, ignore it.</p></td></tr></table></td></tr></table></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}
