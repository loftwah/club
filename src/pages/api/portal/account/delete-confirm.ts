import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { requireSession } from "../../../../lib/portal-auth";
import { D1AuditWriter } from "../../../../infra/audit";
import { SystemClock } from "../../../../infra/clock";
import { SESSION_COOKIE } from "../../../../services/magic-link";
import {
  AccountDeletionError,
  AccountDeletionService,
} from "../../../../services/account-deletion";
import { brand } from "../../../../brand/config";
import { isSameOriginMutation } from "../../../../lib/request-security";

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
  "content-type": "text/html; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
};

export const GET: APIRoute = async ({ request, url, locals }) => {
  const env = getRuntimeEnv(locals);
  if (!env?.DB) return new Response("DB not available", { status: 500 });
  const ctx = await requireSession(request, env);
  if (!ctx) return redirectToLogin(url);

  const requestId = url.searchParams.get("id") ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!requestId || !token)
    return messageResponse("Invalid deletion link", "The link is incomplete.", 400);

  const deletion = new AccountDeletionService({
    db: env.DB,
    audit: new D1AuditWriter(env.DB, new SystemClock()),
    clock: new SystemClock(),
  });
  try {
    await deletion.inspect(ctx.member.id, requestId, token);
  } catch (error) {
    return deletionErrorResponse(error);
  }

  return new Response(renderReviewPage(brand.name, requestId, token), {
    status: 200,
    headers: PRIVATE_HEADERS,
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  if (!env?.DB) return new Response("DB not available", { status: 500 });
  if (!isSameOriginMutation(request))
    return new Response("Cross-origin request rejected.", { status: 403 });
  const ctx = await requireSession(request, env);
  if (!ctx) return new Response("Sign in first.", { status: 401 });

  const form = await request.formData();
  const requestId = String(form.get("id") ?? "");
  const token = String(form.get("token") ?? "");
  const confirm = form.get("confirm");
  if (!requestId || !token || confirm !== "DELETE") {
    return new Response("Explicit account-deletion confirmation is required.", { status: 400 });
  }

  const deletion = new AccountDeletionService({
    db: env.DB,
    audit: new D1AuditWriter(env.DB, new SystemClock()),
    clock: new SystemClock(),
  });
  try {
    await deletion.confirmAndDelete(ctx.member.id, requestId, token);
  } catch (error) {
    if (error instanceof AccountDeletionError) return deletionErrorResponse(error);
    return messageResponse(
      "Deletion needs operator attention",
      "The workflow stopped safely and an operator escalation was created. No unfinished work is being hidden.",
      500,
    );
  }

  return new Response(renderCompletedPage(brand.name), {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      "set-cookie": `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    },
  });
};

function renderReviewPage(brandName: string, requestId: string, token: string): string {
  return page(
    "Review account deletion",
    `<p>This page has not changed your account. Confirming will end the membership, cancel future club work, remove personalisation and member-memory data, redact personal content, and revoke every sign-in session.</p><p>Operational, audit, consent or other records that must be retained are separated from the personal profile.</p><form method="post" action="/api/portal/account/delete-confirm"><input type="hidden" name="id" value="${escapeHtml(requestId)}"><input type="hidden" name="token" value="${escapeHtml(token)}"><label style="display:block;margin:24px 0"><input type="checkbox" name="confirm" value="DELETE" required> I understand this cannot be undone.</label><button type="submit">Delete my ${escapeHtml(brandName)} account</button></form><p><a href="/portal/">Keep my account</a></p>`,
  );
}

function renderCompletedPage(brandName: string): string {
  return page(
    "Account deleted",
    `<p>Your ${escapeHtml(brandName)} membership has ended. Personal profile, memory and timeline information was removed or redacted, future work was cancelled, and all sign-in sessions were revoked.</p><p>Records retained for operational, audit, consent or legal reasons are separated from your former profile.</p><p><a href="/">Back to the homepage</a></p>`,
  );
}

function messageResponse(title: string, message: string, status: number): Response {
  return new Response(
    page(title, `<p>${escapeHtml(message)}</p><p><a href="/">Back to the homepage</a></p>`),
    {
      status,
      headers: PRIVATE_HEADERS,
    },
  );
}

function deletionErrorResponse(error: unknown): Response {
  if (!(error instanceof AccountDeletionError)) {
    return messageResponse("Deletion link unavailable", "The request could not be verified.", 400);
  }
  const status = error.code === "NOT_FOUND" || error.code === "NOT_OWNER" ? 404 : 410;
  return messageResponse("Deletion link unavailable", error.message, status);
}

function redirectToLogin(url: URL): Response {
  const login = new URL("/portal/login/", url.origin);
  login.searchParams.set("next", `${url.pathname}${url.search}`);
  return new Response(null, {
    status: 302,
    headers: {
      location: login.toString(),
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;background:#f3efe5;color:#12110f;margin:0;padding:6rem 1.5rem}main{max-width:36rem;margin:auto;border-top:8px solid #2447ff;padding-top:2rem}h1{font-family:Georgia,serif;font-weight:400;font-size:2.5rem;line-height:1.05}p,label{line-height:1.65}button{min-height:48px;border:1px solid #12110f;background:#12110f;color:white;padding:.8rem 1rem;font:700 12px monospace;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}a{color:#1932be}</style></head><body><main><p style="font:700 11px monospace;letter-spacing:.12em;text-transform:uppercase">Plans With You / Account control</p><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`;
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
