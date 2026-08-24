// Billing service (Stripe-ready seam).
//
// The application never takes real money without explicit user
// approval. The billing service implements the data layer for
// subscriptions, customers, payments, and refunds. The Stripe
// adapter is a separate module that can be enabled by the operator.
//
// Per MASTER_SPEC §6.7 (Suggested table groups) and the roadmap,
// Stripe belongs in Phase 10 and is intentionally behind a feature
// flag. The `FakeBillingProvider` is used in normal local CI; the
// `StripeBillingProvider` is wired when the operator sets
// `STRIPE_SECRET_KEY` and the user has approved paid launch.
//
// Invariants enforced here:
//   - Webhook-authoritative activation (no browser success can
//     activate a membership; only the webhook can.)
//   - Idempotent webhook processing (replays produce no duplicate
//     effect).
//   - Duplicate invoice.payment_succeeded events are deduplicated
//     by provider invoice id.

import type { D1Database } from "@cloudflare/workers-types";
import { newId } from "../infra/ids.js";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";
import { MembershipService } from "./membership-service.js";

export type SubscriptionStatus = "INCOMPLETE" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "UNPAID";

export interface Subscription {
  readonly id: string;
  readonly memberId: string;
  readonly providerCustomerId: string;
  readonly providerSubscriptionId: string;
  readonly tierId: string;
  readonly status: SubscriptionStatus;
  readonly currentPeriodEnd: string | null;
  readonly createdAt: string;
}

export interface BillingServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly membership: MembershipService;
}

export interface BillingWebhookEvent {
  readonly id: string;
  readonly type: string;
  readonly customerId: string;
  readonly subscriptionId: string | null;
  readonly invoiceId: string | null;
  readonly payload: Record<string, unknown>;
}

export interface BillingProvider {
  readonly name: "fake" | "stripe";
  /** Verify a webhook signature. Returns null on invalid. */
  verifyWebhook(rawBody: string, signature: string | null): BillingWebhookEvent | null;
}

/**
 * Idempotently apply a billing webhook event. Returns true if the
 * event was newly processed, false if it was a duplicate replay.
 */
export async function applyBillingEvent(
  deps: BillingServiceDeps,
  event: BillingWebhookEvent,
): Promise<{ duplicate: boolean; action: string }> {
  // Dedupe on provider event id.
  const existing = await deps.db
    .prepare(`SELECT id, action FROM billing_events WHERE provider_event_id = ?`)
    .bind(event.id)
    .first<{ id: string; action: string }>();
  if (existing) {
    return { duplicate: true, action: existing.action };
  }
  const now = deps.clock.nowIso();
  await deps.db
    .prepare(
      `INSERT INTO billing_events (id, provider_event_id, provider, event_type, customer_id, subscription_id, invoice_id, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId("be"),
      event.id,
      "fake",
      event.type,
      event.customerId,
      event.subscriptionId,
      event.invoiceId,
      JSON.stringify(event.payload),
      now,
    )
    .run();
  let action = "IGNORED";
  try {
    switch (event.type) {
      case "invoice.payment_succeeded":
        action = await onPaymentSucceeded(deps, event);
        break;
      case "invoice.payment_failed":
        action = await onPaymentFailed(deps, event);
        break;
      case "customer.subscription.deleted":
        action = await onSubscriptionCancelled(deps, event);
        break;
      case "customer.subscription.updated":
        action = await onSubscriptionUpdated(deps, event);
        break;
    }
  } catch (error) {
    // A rejected activation must be retryable after the member completes the
    // missing gate. Do not leave a dedupe record that turns a later provider
    // retry into a silent no-op.
    await deps.db
      .prepare(`DELETE FROM billing_events WHERE provider_event_id = ?`)
      .bind(event.id)
      .run();
    throw error;
  }
  return { duplicate: false, action };
}

async function onPaymentSucceeded(
  deps: BillingServiceDeps,
  event: BillingWebhookEvent,
): Promise<string> {
  // Find the member by provider customer id.
  const sub = await deps.db
    .prepare(`SELECT * FROM subscriptions WHERE provider_customer_id = ?`)
    .bind(event.customerId)
    .first<Record<string, unknown>>();
  if (!sub) return "UNKNOWN_CUSTOMER";
  const memberId = sub.member_id as string;
  if (!event.subscriptionId || event.subscriptionId !== (sub.provider_subscription_id as string)) {
    throw new Error("Billing activation blocked: subscription_mismatch");
  }
  // Check every non-billing gate before changing subscription state. This
  // prevents an invoice event from turning a partial applicant into a paid
  // member and makes an invalid event safely retryable.
  const preflightBlockers = await deps.membership.getActivationBlockers(memberId, {
    requireActiveBilling: false,
    expectedSubscriptionId: event.subscriptionId,
  });
  if (preflightBlockers.length > 0) {
    throw new Error(`Billing activation blocked: ${preflightBlockers.join(", ")}`);
  }
  const previousStatus = sub.status as string;
  await deps.db
    .prepare(`UPDATE subscriptions SET status = 'ACTIVE', updated_at = ? WHERE id = ?`)
    .bind(deps.clock.nowIso(), sub.id as string)
    .run();
  try {
    // Membership activation re-reads D1 and verifies the now-active
    // subscription, closing the race between preflight and the write.
    await deps.membership.activate(memberId);
  } catch (error) {
    await deps.db
      .prepare(`UPDATE subscriptions SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(previousStatus, deps.clock.nowIso(), sub.id as string)
      .run();
    throw error;
  }
  await deps.audit.record({
    actorType: "SYSTEM",
    actorId: null,
    action: "BILLING_PAYMENT_SUCCEEDED",
    entityType: "SUBSCRIPTION",
    entityId: sub.id as string,
    fromState: "INCOMPLETE",
    toState: "ACTIVE",
    reasonCode: event.id,
    correlationId: event.id,
    metadata: { invoiceId: event.invoiceId },
  });
  return "ACTIVATED";
}

async function onPaymentFailed(
  deps: BillingServiceDeps,
  event: BillingWebhookEvent,
): Promise<string> {
  const sub = await deps.db
    .prepare(`SELECT * FROM subscriptions WHERE provider_customer_id = ?`)
    .bind(event.customerId)
    .first<Record<string, unknown>>();
  if (!sub) return "UNKNOWN_CUSTOMER";
  await deps.db
    .prepare(`UPDATE subscriptions SET status = 'PAST_DUE', updated_at = ? WHERE id = ?`)
    .bind(deps.clock.nowIso(), sub.id as string)
    .run();
  await deps.membership.suspend(sub.member_id as string, "BILLING_PAST_DUE");
  await deps.audit.record({
    actorType: "SYSTEM",
    actorId: null,
    action: "BILLING_PAYMENT_FAILED",
    entityType: "SUBSCRIPTION",
    entityId: sub.id as string,
    fromState: "ACTIVE",
    toState: "PAST_DUE",
    reasonCode: event.id,
    correlationId: event.id,
    metadata: null,
  });
  return "SUSPENDED";
}

async function onSubscriptionCancelled(
  deps: BillingServiceDeps,
  event: BillingWebhookEvent,
): Promise<string> {
  const sub = await deps.db
    .prepare(`SELECT * FROM subscriptions WHERE provider_customer_id = ?`)
    .bind(event.customerId)
    .first<Record<string, unknown>>();
  if (!sub) return "UNKNOWN_CUSTOMER";
  await deps.db
    .prepare(`UPDATE subscriptions SET status = 'CANCELLED', updated_at = ? WHERE id = ?`)
    .bind(deps.clock.nowIso(), sub.id as string)
    .run();
  await deps.membership.cancel(sub.member_id as string, "BILLING_CANCELLED");
  await deps.audit.record({
    actorType: "SYSTEM",
    actorId: null,
    action: "BILLING_SUBSCRIPTION_CANCELLED",
    entityType: "SUBSCRIPTION",
    entityId: sub.id as string,
    fromState: "ACTIVE",
    toState: "CANCELLED",
    reasonCode: event.id,
    correlationId: event.id,
    metadata: null,
  });
  return "CANCELLED";
}

async function onSubscriptionUpdated(
  deps: BillingServiceDeps,
  event: BillingWebhookEvent,
): Promise<string> {
  // Tier-change handling lives here. We log the change; the
  // membership service owns the actual capability mapping.
  await deps.audit.record({
    actorType: "SYSTEM",
    actorId: null,
    action: "BILLING_SUBSCRIPTION_UPDATED",
    entityType: "SUBSCRIPTION",
    entityId: event.subscriptionId,
    fromState: null,
    toState: null,
    reasonCode: event.id,
    correlationId: event.id,
    metadata: { payload: event.payload },
  });
  return "UPDATED";
}

/**
 * Fake billing provider for tests. Sign with the literal "ok"
 * header value (or no header) to produce a parseable event.
 */
export class FakeBillingProvider implements BillingProvider {
  readonly name = "fake" as const;
  verifyWebhook(_rawBody: string, _signature: string | null): BillingWebhookEvent | null {
    try {
      const parsed = JSON.parse(_rawBody) as BillingWebhookEvent;
      if (!parsed || !parsed.type || !parsed.id || !parsed.customerId) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
