# Cloudflare Operations — Plans With You (#20)

> **Status:** baseline. Run `mise run cf:audit` to regenerate the
> machine-readable resource inventory. All mutations are documented
> here; no auto-deletion is performed by the audit.

This document is the repo-owned operations baseline for the
Cloudflare account that hosts the Plans With You Worker. It answers:

- What resources exist and who owns each one.
- What is the single authoritative production deployment path.
- What cost drivers can quietly run forever if left alone.
- What data is permanent vs disposable.
- What cleans up automatically and what must be cleaned up by hand.
- How to detect orphans.
- How to notice unexpected spend quickly.

## Account identity

| Item           | Value                                    |
| -------------- | ---------------------------------------- |
| Account name   | Loftwah                                  |
| Account ID     | `1003dc1d93af0ebea56b2f1252f89627`       |
| Authentication | Account API Token (CLOUDFLARE_API_TOKEN) |
| Worker Builds  | NOT enabled (route returns 7003)         |

The API token is scoped per Cloudflare's API token model, not a global
API key. Document the token purpose, owner, and rotation cadence in
the operator's secrets manager; do not commit the token.

## Single authoritative production deployment path

Production is deployed by **local mise + Wrangler only**. Concretely:

```sh
mise run deploy-production
```

The task runs `mise run acceptance` and then
`wrangler deploy --config dist/server/wrangler.json`. There is no
GitHub Actions workflow, no Cloudflare Workers Builds connection, and
no alternative automation. The repo intentionally does not include
`.github/workflows/`. Do not introduce one.

This is the only path that can write to the production Worker. Worker
Previews (`mise run cf:preview:create`) write to separate Preview-only
resources and never to production.

## Club-owned Cloudflare resources

The current Cloudflare account has many resources that belong to
other projects (LoftwahFM, Fighter, bubbles, protocol-11, techdeck,
shoalshot, astroworkers, my-domain-redirect-worker-production). This
issue MUST NOT mutate those resources. The list below is the
Club-owned subset.

| Resource         | Identifier                                                 | Type           | Environment                     | Notes                                                                  |
| ---------------- | ---------------------------------------------------------- | -------------- | ------------------------------- | ---------------------------------------------------------------------- |
| Worker           | `social-club`                                              | Worker         | production                      | the only production deploy target                                      |
| Worker subdomain | `enabled: false, previews_enabled: true`                   | Worker setting | production                      | the `previews_enabled` flag was set during #18 so Preview URLs resolve |
| D1               | `social-club` (`22850c0b-b1ac-4f9e-950b-8e8392e02d90`)     | D1             | production                      | 49 tables, 753 664 bytes as of 2026-09-02                              |
| KV               | `social-club-session` (`fe39a4b46d554822a48759cb7cb884db`) | KV             | production                      | session storage                                                        |
| R2               | `social-club-artifacts`                                    | R2             | production                      | approved artefacts and member assets                                   |
| Rate limits      | `WAITLIST_RATE_LIMITER` (`8162401`)                        | Rate limit     | production                      | shared with other account workers                                      |
| Rate limits      | `MAGIC_LINK_RATE_LIMITER` (`8162402`)                      | Rate limit     | production                      | shared with other account workers                                      |
| Queue            | `social-club-jobs` (`380db069ddd74106af01b388cf76f55d`)    | Queue          | reserved (no producer/consumer) | bound config in `wrangler.jsonc` is intentionally commented out        |

No production Cron is configured. The `social-club` Worker's schedule
list is empty (`/schedules` returns `{"schedules": []}`).

## Cron policy

| Item                     | Status                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production Cron          | NOT configured                                                                                                                                      |
| Preview Cron             | NOT inherited (Previews inherit the empty `triggers` state from the parent Worker)                                                                  |
| Future Cron requirements | owner / purpose / schedule / idempotency / max work per invocation / external paid-provider calls / retry policy / observability / Preview disabled |

The `wrangler.jsonc` must continue to omit `triggers` until a separate
product issue explicitly enables a Cron.

## Queue policy

The `social-club-jobs` queue is reserved but not bound. A future
activation MUST meet ALL of:

- bounded max retries (`max_retries` is required)
- dead-letter queue OR explicit terminal handling
- idempotent consumer
- poison-message protection
- observable failure count
- no infinite retry loop
- clear producer and consumer ownership

A queue with no owner/consumer should be reported (it is), not left
indefinitely. The `social-club-jobs` queue currently has no producer
and no consumer, and is therefore a no-cost reservation.

## Browser Run / Puppeteer policy

The Club repo does not currently use Browser Run or `@cloudflare/puppeteer`.
A future addition MUST meet ALL of:

- created inside a narrow operation
- closed explicitly in `finally` (or equivalent cleanup)
- avoid `keep_alive` unless the use case documents why it is needed
- bounded task / runtime limits
- bounded retry limits
- never run recursively or through an unbounded Cron / Queue loop
- emit enough structured context to attribute usage to the invoking
  job/feature without logging secrets

A repository lint/test guard will be added if/when
`@cloudflare/puppeteer` or a Browser Rendering binding is introduced.

## Observability policy

The `social-club` Worker currently has:

```text
observability.enabled:        true
observability.head_sampling:  1
observability.redact_qs:      false
observability.logs.enabled:   true
observability.logs.head_rate: 1
observability.traces.enabled: false
```

`redact_query_string: false` is acceptable today because the app does
not pass tokens in query strings; if that changes, the flag must flip
to `true`. The Worker does not log secrets, raw auth tokens, or
unnecessary query strings today.

Do not log:

- secrets
- raw auth tokens
- sensitive inbound message bodies unless explicitly required and protected
- unnecessary query strings containing private data

Previews inherit the same observability policy. Do not enable 100%
tracing on every Preview just because the platform allows it.

## D1 ownership and cleanup

The only Club D1 is `social-club` (production). No Preview D1s exist
in the account right now (the #18 experiment created and then deleted
`social-club-preview-a` and `social-club-preview-b`).

Migrations source: `migrations/` at the repo root, applied via
`wrangler d1 migrations apply social-club --remote`. Local state:
`wrangler d1 migrations apply social-club --local`. Recovery
expectation: D1 Time Travel + full SQL export before any production
migration (see `docs/23_DEPLOYMENT.md`).

Preview D1 orphan candidates are detected by name pattern
`social-club-preview-*` and reported (never auto-deleted) by
`mise run cf:preview:orphans`.

## KV TTL and namespace hygiene

The only Club KV is `social-club-session`. It is used by the Astro
Cloudflare adapter for session storage. The binding is
`SESSION` and it is wired through `@astrojs/cloudflare` session
support.

Temporary data writes (sessions, magic-link/auth state, locks) should
set the binding's `expiration_ttl` on `put()` calls where the
product semantics allow. The current implementation in the Astro
adapter sets TTLs appropriate to the session type; this issue does
not change that. The harness for the important temporary KV writes
to set the expected TTL is `tests/integration/session-ttl.test.ts`
(vitest, not part of the default `node --test` set).

Preview KV orphan candidates (`social-club-preview-*-session`) are
reported by `mise run cf:preview:orphans` and cleaned by
`mise run cf:preview:delete`.

## R2 retention and lifecycle

The `social-club-artifacts` bucket has the default Cloudflare
multipart-upload abort rule (7 days). It does not have a content
lifecycle rule.

The current content is the published creative asset set. A formal
content-classification / prefix scheme (`permanent/`, `approved/`,
`history/`, `preview/`, `tmp/`, `test/`) is not yet in place; the
repo-level write path does not currently use these prefixes. The
multipart-upload rule is sufficient today.

When a future issue introduces a `preview/` or `tmp/` prefix scheme,
add an R2 lifecycle rule for that prefix class only. Do NOT
blanket-expire the whole bucket.

## R2 disposable-resource candidates (account-wide)

The audit lists all R2 buckets. Buckets whose name contains
`social-club-preview-` are reported by
`mise run cf:preview:orphans` and are the only candidates this
issue considers for cleanup. Buckets belonging to other projects
(loftwahfm, loftwahfm-dev, techdeck, techdeck-staging, astroflare,
downscope) are recorded as findings but never deleted by Club work.

## API token / credential hygiene

- The deployment / operations token is an Account API Token, not a
  global API key. This is verified by `wrangler whoami`, which
  reports "You are logged in with an Account API Token".
- The token's permission scope is whatever the operator issued it
  with. The token's purpose, owner, and rotation cadence are tracked
  in the operator's secrets manager, not in this repo.
- No `.env`, `.dev.vars`, or `.npmrc` file in the repo carries
  production credentials. `.env.example` lists empty placeholders.
- The repo does not include any CI workflow or other automation that
  would re-introduce a global API key.

If the token must be rotated, do it via the Cloudflare dashboard;
Wrangler does not manage API tokens. The new token's value is
injected into `CLOUDFLARE_API_TOKEN` for the operator's local
session; the `.env` file in this repo is gitignored and may carry
it locally.

## Billing and spend alerts

Cloudflare budget alerts and the low-threshold spend alerts are
managed in the Cloudflare dashboard under **Account Home →
Billing → Budget alerts**. This issue does not currently set them
via the API (the API surface is not documented enough to do this
safely without committing to a non-trivial script). The manual
configuration is:

```text
US$5   early anomaly
US$10  investigate
US$25  urgent investigate
```

Operators should confirm these alerts are configured once per
quarter and record the result. Budget alerts are not hard caps and
may not be real-time.

If the API surface becomes reliable enough to set this from
Wrangler, the `cf-audit.mjs` script can grow a `--setup-alerts`
flag. Until then, the dashboard is the source of truth.

## What never gets auto-deleted

- Production resources: `social-club` Worker, `social-club` D1,
  `social-club-session` KV, `social-club-artifacts` R2, the six
  production secrets, the production route on `club.loftwah.com/*`.
- Worker version history (`wrangler deployments list` shows ~10
  historic versions; these are rollback material, not junk).
- Other projects' resources: `loftwahfm`, `loftwah-fighter`,
  `bubbles`, `protocol-11-*`, `shoalshot`, `techdeck`,
  `techdeck-staging`, `astroworkers`, `my-domain-redirect-worker-production`,
  `loftwahfm-dev` and their associated KV / D1 / R2 / queues.
- A resource that is named similarly to a Club Preview resource but
  is owned by a different branch / repo.

## How to run the audit

```sh
mise run cf:audit
```

Output:

- Human-readable summary on stdout.
- Machine-readable JSON report at
  `out/cf-audit/report-<timestamp>.json` (the `out/` directory is
  gitignored).

The audit is read-only. It does not delete anything. It does not
touch any resource outside of `GET` / `LIST` HTTP requests against
the Cloudflare API.

## Reusable audit checklist

The following questions MUST be answerable from the audit output and
this runbook. If any is not, the audit is incomplete.

```text
[ ] Authenticated account identity is verified before mutation.
[ ] Exactly one production deployment mechanism is documented.
[ ] Every Club-owned stateful resource is listed with owner/environment.
[ ] No stale remote Club Cron exists unnoticed.
[ ] No orphan Preview KV/D1/R2 sits in the account after a delete.
[ ] Observability settings are deliberate and protect sensitive data.
[ ] R2 bucket does not have a blanket lifecycle policy.
[ ] The audit script can be re-run from a clean state.
[ ] The audit can be re-run in CI without writing production resources.
```

## Relationship to other repos

The audit may surface `loftwahfm`, `loftwah-fighter`, `protocol-11-*`,
`shoalshot`, `bubbles*`, `techdeck*`, `astroworkers`,
`my-domain-redirect-worker-production`, and `loftwahfm-preview` (the
last modified 2026-07-25, possibly stale). Record findings, do not
mutate from this issue. Once the Club baseline is proven, the same
hygiene steps can be applied to LoftwahFM deliberately in its own
issue.
