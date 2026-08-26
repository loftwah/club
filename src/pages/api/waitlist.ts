// Waiting-list API endpoint.
// POST /api/waitlist
// Body: { email, preferredName?, chapterId? }
// Returns: 202 { ok: true } on success, without exposing record identity.

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { WaitlistService, waitlistSubmissionSchema } from "@services/waitlist";
import { RealResendAdapter } from "@adapters/resend-real";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";
import { isSameOriginMutation } from "../../lib/request-security";

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  if (!env?.DB) {
    return json({ error: "Waitlist requests are temporarily unavailable." }, 500);
  }
  if (!isSameOriginMutation(request))
    return json({ error: "This request could not be accepted." }, 403);
  if (!env?.RESEND_API_KEY || !env?.RESEND_WEBHOOK_SIGNING_SECRET) {
    return json({ error: "Waitlist requests are temporarily unavailable." }, 503);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Please send a valid waitlist request." }, 400);
  }
  const parsed = waitlistSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Please check the details and try again." }, 400);
  }
  const [clientKey, emailKey] = await waitlistRateLimitKeys(request, parsed.data.email);
  const [clientLimit, emailLimit] = await Promise.all([
    env.WAITLIST_RATE_LIMITER.limit({ key: clientKey }),
    env.WAITLIST_RATE_LIMITER.limit({ key: emailKey }),
  ]);
  if (!clientLimit.success || !emailLimit.success) {
    return json({ error: "Too many requests. Please wait a minute and try again." }, 429);
  }
  const resend = new RealResendAdapter({
    apiKey: env.RESEND_API_KEY,
    fetchImpl: fetch,
  });
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const service = new WaitlistService({
    db: env.DB,
    resend,
    audit,
    clock: new SystemClock(),
    appBaseUrl: env.APP_BASE_URL,
    fromAddress: env.RESEND_FROM,
  });
  try {
    await service.submit(parsed.data);
    // A generic accepted response prevents duplicate submissions from
    // revealing an existing waitlist record's identifier or state.
    return json({ ok: true }, 202);
  } catch (err) {
    console.error("waitlist submit failed", err);
    return json({ error: "We couldn’t add you to the list. Please try again." }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function waitlistRateLimitKeys(
  request: Request,
  email: string,
): Promise<[clientKey: string, emailKey: string]> {
  const clientAddress = request.headers.get("cf-connecting-ip")?.trim() || "unknown-client";
  return Promise.all([
    hashedRateLimitKey(`waitlist:client:${clientAddress}`),
    hashedRateLimitKey(`waitlist:email:${email.trim().toLowerCase()}`),
  ]);
}

async function hashedRateLimitKey(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
