// Stripe billing webhook (Phase 10, disabled by default).
//
// POST /api/webhooks/billing
// Activates a membership only via webhook-authoritative billing
// success. Browser-side success cannot activate a membership.
// Replays are deduplicated on provider event id.

import type { APIRoute } from "astro";
import { privateTextResponse } from "../../../lib/request-security";

export const POST: APIRoute = async () => {
  return privateTextResponse("Billing webhooks are disabled while paid membership is locked.", 410);
};
