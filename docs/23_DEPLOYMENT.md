# Production Deployment Plan — Plans With You

> **Status:** release runbook. Production deployment requires explicit
> user authorisation, a green `mise run acceptance`, a pre-migration D1
> export/bookmark, and successful smoke checks.

---

## 1. Domain and DNS

Production domain: `https://club.loftwah.com`

DNS expectations (already configured by the user):

- `A` / `AAAA` record for `club.loftwah.com` pointing at the
  Cloudflare Worker route.
- `CNAME` for `www.club.loftwah.com` (optional, redirect to
  apex).
- DNSSEC optional.
- `TXT` record for Resend DKIM under
  `resend._domainkey.club.loftwah.com`.
- `TXT` record for SPF: `v=spf1 include:resend.com -all`.

---

## 2. Worker bindings

The Worker requires the following bindings (declared in
`wrangler.jsonc`):

| Binding                   | Type          | Notes                                        |
| ------------------------- | ------------- | -------------------------------------------- |
| `DB`                      | D1            | The membership database. Migrations applied. |
| `ARTIFACTS`               | R2            | The artefacts bucket. Holds media + backups. |
| `ASSETS`                  | Static assets | The Astro-emitted static files (public/).    |
| `WAITLIST_RATE_LIMITER`   | Rate limit    | Three waitlist writes per key/minute.        |
| `MAGIC_LINK_RATE_LIMITER` | Rate limit    | Three magic-link writes per key/minute.      |

`JOBS` is intentionally not bound yet: the runtime has no Queue producer
or consumer export. Durable work remains in the audited D1 job table.

Worker environment variables (vars, not secrets):

- `APP_BASE_URL` — `https://club.loftwah.com`

Worker secrets (encrypted, set via `wrangler secret put`):

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_ID`
- `RESEND_WEBHOOK_SIGNING_SECRET`
- `RESEND_FROM`
- `OPERATOR_EMAIL`
- `MINIMAX_API_KEY`

---

## 3. Cron schedule

No Cron Trigger is configured in `wrangler.jsonc`. Product cadence and
cancellation policy are locked in `src/brand/cadence.ts`; those rules are not
an active production schedule:

- **Invitation frequency:** 1–2 constructed events per member per
  month.
- **Invitation lead time:** 7–21 days before the constructed event.
- **Default cancellation window:** 12–36 hours before the event.
- **Cancellation styles:** Merciful (48–72h), Traditional
  (12–36h), Last Minute (2–8h). New members default to Traditional.
- **Never** cancel after the event has begun.

To set the production cadence in a per-environment override:

```jsonc
// wrangler.production.jsonc
{
  "triggers": {
    "crons": ["0 */6 * * *"], // placeholder; set per AGENTS.md
  },
}
```

The remaining operational gate is the exact runtime trigger frequency and
deployment of that trigger. Do not deploy the placeholder above or silently
derive a trigger from the product cadence policy.

## 3.1 Staging decision

There is no isolated Cloudflare staging environment. `mise run deploy-staging`
fails closed so an agent cannot accidentally point a “staging” deploy at
production D1, R2, routes, or rate-limit namespaces.

A second Worker without isolated bindings would provide false confidence; a
fully isolated copy would add ongoing migrations, secrets, provider fixtures,
DNS, and drift management. That cost is not justified while the production
surface is a Stripe-disabled waitlist with strong local workerd/D1/browser
acceptance. Re-evaluate staging before enabling real payments, production Cron,
Queues, or materially risky migrations. At that point provision a separate
Worker, D1 database, R2 bucket/prefix, rate-limit namespaces, secrets, hostname,
and test accounts—never aliases to production resources.

---

## 4. Migration plan

1. Confirm the canonical acceptance is green locally:
   `mise run acceptance`.
2. Confirm the live provider contracts pass:
   `mise run contracts` and `mise run contracts:minimax`.
3. Capture a D1 Time Travel bookmark and full remote SQL export.
4. Apply D1 migrations to production:
   `npx wrangler d1 migrations apply social-club --remote`.
5. Confirm the schema matches the local D1 schema.
6. Confirm the constraints (no `ATTENDED`, `CHECKED_IN`,
   `NO_SHOW`) are in place.

---

## 5. Smoke test script

After deployment, run the following:

```sh
# 1. The homepage is reachable.
curl -fsS https://club.loftwah.com/ -o /dev/null -w "%{http_code}\n"
# expected: 200

# 2. Anonymous MCP access fails closed.
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST https://club.loftwah.com/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
# expected: 401

# 3. The waitlist page renders without creating production data.
curl -fsS -o /dev/null -w "%{http_code}\n" \
  https://club.loftwah.com/waiting-list/
# expected: 200

# 4. Anonymous cron access fails closed.
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST https://club.loftwah.com/api/cron/discover \
  -H "content-type: application/json" \
  -d '{}'
# expected: 401

# 5. Billing stays intentionally disabled.
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST https://club.loftwah.com/api/webhooks/billing \
  -H "content-type: application/json" \
  -d '{}'
# expected: 410

# 6. The OG card renders.
curl -fsS -o /dev/null -w "%{http_code}\n" \
  https://club.loftwah.com/og/default.svg
# expected: 200
```

If any of these fail, do not declare deploy successful. See the
runbook for diagnosis.

---

## 6. Rollback

Each Wrangler deploy is recorded as a version in Cloudflare. To
roll back:

1. Open the Cloudflare dashboard → Workers & Pages → the Worker.
2. Click the **Deployments** tab.
3. Locate the previous successful version.
4. Click **Promote to active**.
5. Re-run the smoke test script.
6. Run `mise run contracts` and `mise run contracts:minimax` from
   the operator machine to confirm the live providers are still
   reachable.

---

## 7. Secret checklist

Before the first production deploy, confirm the following secrets
are set on the production environment:

```sh
# Set each secret with:
#   npx wrangler secret put <NAME>
# Then verify with:
npx wrangler secret list
```

Expected:

- [ ] `RESEND_API_KEY`
- [ ] `RESEND_WEBHOOK_ID`
- [ ] `RESEND_WEBHOOK_SIGNING_SECRET`
- [ ] `RESEND_FROM`
- [ ] `OPERATOR_EMAIL`
- [ ] `MINIMAX_API_KEY`

The `CF_*` secrets are not Worker secrets; they are the operator's
own Cloudflare API tokens used for R2 administration and are not
required by the Worker at runtime.

---

## 8. Database integrity check

After migrations are applied to production D1, run:

```sh
npx wrangler d1 execute social-club --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Confirm the expected tables exist:

- `agent_leases`
- `ai_generations`
- `appearance_requests`
- `audit_log`
- `billing_customers`
- `billing_events`
- `calls`
- `chapters`
- `communications`
- `communication_templates`
- `commitment_scenarios`
- `deletion_requests`
- `event_invitations`
- `event_locations`
- `event_transitions`
- `events`
- `fulfilment_tasks`
- `gifts`
- `idempotency_records`
- `inbound_messages`
- `jobs`
- `legal_documents`
- `locations`
- `magic_links`
- `member_acceptances`
- `member_facts`
- `member_milestones`
- `member_sessions`
- `member_timeline`
- `members`
- `membership_tiers`
- `memberships`
- `milestone_definitions`
- `onboarding_progress`
- `onboarding_step_data`
- `service_grants`
- `subscriptions`
- `tier_capabilities`
- `waitlist_entries`

`d1_migrations` is Wrangler's migration ledger. There must be no ordinary-event
attendance table and no ordinary-event `ATTENDED`, `CHECKED_IN`, or `NO_SHOW`
state. The authoritative automated parity check is `scripts/check-fresh-state.mjs`.

---

## 9. DNS expectations for inbound mail

The Resend inbound webhook is bound to
`https://club.loftwah.com/api/webhooks/resend`. The MX records for
`club.loftwah.com` (and any subdomain we use) must point at
Resend's inbound servers:

- Priority 10: `feedback-smtp.ap-northeast-1.amazonses.com`
- Priority 20: `feedback-smtp.ap-northeast-2.amazonses.com`

(Resend publishes the exact list. Confirm with the current Resend
documentation at deploy time.)

The webhook is configured in the Resend dashboard to receive
`email.received` events.

---

## 10. What is NOT in this deploy

These are explicitly user-gated and are not performed here:

- Real Stripe activation. The build uses fake/test billing.
  Production Stripe requires the user to create a Stripe account
  and provide the live keys.
- Legal review and approval of the published terms and privacy
  policy.
- Real paid membership and Stripe activation.

The system is otherwise launch-ready.
