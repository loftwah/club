// Stripe billing webhook (Phase 10, disabled by default).
//
// POST /api/webhooks/billing
// Activates a membership only via webhook-authoritative billing
// success. Browser-side success cannot activate a membership.
// Replays are deduplicated on provider event id.

import type { APIRoute } from "astro";
import { applyBillingEvent, FakeBillingProvider } from "@services/billing-service";
import { MembershipService } from "@services/membership-service";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  if (!env?.DB) {
    return new Response("database binding not available", { status: 500 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  // Provider is a thin seam. In production a real Stripe provider
  // verifies HMAC against STRIPE_WEBHOOK_SECRET. Until Stripe is
  // enabled, the fake accepts any well-formed JSON body.
  const provider = new FakeBillingProvider();
  const event = provider.verifyWebhook(rawBody, signature);
  if (!event) {
    return new Response("invalid webhook", { status: 400 });
  }
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const clock = new SystemClock();
  const membership = new MembershipService({ db: env.DB, audit, clock });
  const result = await applyBillingEvent({ db: env.DB, audit, clock, membership }, event);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
