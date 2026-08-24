// Resend inbound webhook endpoint.
// POST /api/webhooks/resend
//
// Verifies the raw-body signature using RESEND_WEBHOOK_SIGNING_SECRET,
// dedupes on the Svix event id, persists metadata, then fetches the
// body via the Resend Received Emails API. See MASTER_SPEC §9.6.

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { InboundEmailService } from "@services/inbound-email";
import { RealResendAdapter } from "@adapters/resend-real";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  if (!env?.DB) {
    return new Response("database binding not available", { status: 500 });
  }
  if (!env?.RESEND_API_KEY || !env?.RESEND_WEBHOOK_SIGNING_SECRET) {
    return new Response("resend not configured", { status: 503 });
  }

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;

  const resend = new RealResendAdapter({
    apiKey: env.RESEND_API_KEY,
    fetchImpl: fetch,
  });
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const service = new InboundEmailService({
    db: env.DB,
    resend,
    audit,
    clock: new SystemClock(),
    signingSecret: env.RESEND_WEBHOOK_SIGNING_SECRET,
  });

  const result = await service.handleRaw(rawBody, headers);

  if (result.status === "rejected") {
    return new Response(result.reason, { status: 400 });
  }
  if (result.status === "ignored") {
    return new Response(result.reason, { status: 202 });
  }
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
