// Waiting-list API endpoint.
// POST /api/waitlist
// Body: { email, preferredName?, chapterId? }
// Returns: 201 { id, state } on success, 400 on validation, 500 on internal.

import type { APIRoute } from "astro";
import { z } from "zod";
import { WaitlistService, waitlistSubmissionSchema } from "@services/waitlist";
import { RealResendAdapter } from "@adapters/resend-real";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  if (!env?.DB) {
    return json({ error: "database binding not available" }, 500);
  }
  if (!env?.RESEND_API_KEY || !env?.RESEND_WEBHOOK_SIGNING_SECRET) {
    return json({ error: "email provider not configured" }, 503);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const parsed = waitlistSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: zodErrorMessage(parsed.error) }, 400);
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
    const entry = await service.submit(parsed.data);
    return json({ id: entry.id, state: entry.state }, 201);
  } catch (err) {
    console.error("waitlist submit failed", err);
    return json({ error: "internal error" }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function zodErrorMessage(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}
