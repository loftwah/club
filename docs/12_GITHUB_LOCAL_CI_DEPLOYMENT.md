# 13. GitHub, Local CI and Deployment

## 13.1 GitHub

Use for source, issues, PRs, review, history, release tags and minimal verification.

## 13.2 Branching

Prefer short-lived `feature/*` / `fix/*` against `main`.

## 13.3 Canonical local commands

Desired interface:

```sh
mise run dev
mise run check
mise run acceptance
mise run deploy:staging
mise run deploy:production
```

## 13.4 Fast check

```text
format
lint
typecheck
unit
```

## 13.5 GitHub Actions

Minimal independent clean verifier only. It calls `mise run acceptance` rather than duplicating business logic in YAML.

## 13.6 Deployment

Initial local explicit production deployment is acceptable:

```text
acceptance
→ clean/config check
→ migration validation
→ wrangler deploy
→ smoke tests
```

## 13.7 Local Cloudflare

Current Cloudflare docs verify local Workers with `workerd`/Miniflare and local D1/R2/Queues simulations.

Official references:

- https://developers.cloudflare.com/workers/local-development/
- https://developers.cloudflare.com/workers/local-development/bindings-per-env/
- https://developers.cloudflare.com/d1/best-practices/local-development/
- https://developers.cloudflare.com/queues/configuration/local-development/
- https://developers.cloudflare.com/workers/wrangler/configuration/

## 13.8 Migrations

Every migration is versioned, fresh-state tested and documents destructive implications.

## 13.9 Observability

Monitor:

- Worker errors;
- queue failures;
- cancellation safety violations;
- Resend failures;
- webhook verification failures;
- overdue human tasks;
- AI validation failures;
- D1/R2 failures;
- Stripe webhook issues later.

## 13.10 Runbooks

Need:

- Resend outage;
- cancellation failure;
- D1 migration failure;
- queue backlog;
- AI outage;
- local agent offline;
- R2 issue;
- compromised key;
- deletion request;
- appearance cancellation;
- Stripe outage later.

---
