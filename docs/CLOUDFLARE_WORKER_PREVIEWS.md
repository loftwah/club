# Cloudflare Worker Previews — Operator Runbook (#19)

> **Status:** operational. Depends on the #18 lab being GO/WITH-GUARDRAILS.

This document is the operator and agent runbook for working with
Cloudflare Worker Previews on the Plans With You Worker (`social-club`).
It assumes the `previews_enabled: true` flag has been set on the
parent Worker (this was done in #18 and is required for any Preview URL
to resolve).

## When to use a Preview

A Preview is a per-branch named Worker deployment that runs the
Preview-override configuration on a `*.workers.dev` URL. Use it when
you need to:

- Demonstrate a feature branch on a real Cloudflare Worker (not just
  the local `wrangler dev`).
- Run a remote smoke test against a real preview URL before merging.
- Exercise Preview-only KV / D1 / R2 resources without writing to
  production state.

Do **not** use a Preview as a substitute for production. The Preview
runs on a subdomain URL (e.g.
`https://<name>-social-club.loftwah.workers.dev`), is not on the
production zone, and does not have the production route.

## Authoritative production deployment path

Production is deployed by **local mise + Wrangler** only:

```sh
mise run deploy-production
```

The mise task runs `mise run acceptance` and then
`wrangler deploy --config dist/server/wrangler.json`. There is no
GitHub Actions, no Cloudflare Workers Builds, and no alternative
automated path. Do not introduce one. Previews are the only other
write path, and they cannot reach production bindings.

## Required safety configuration

The Astro Cloudflare adapter 14.2.3 does not produce a usable
`previews` block on its own. The repo's
`scripts/cf-preview.mjs` generates the override config with explicit
Preview-only KV / D1 / R2 IDs. Do not bypass the script with a
hand-written override unless you have a reason and have also updated
the test that pins the production-identity denylist.

The script refuses to run a mutating subcommand (`create`, `update`,
`smoke`, `delete`) on the `main` or `master` branch. The branch check
is a hard guard, not a warning.

## Preview lifecycle

The normal branch workflow is:

```text
feature branch
  -> mise run cf:preview:create     provision Preview-only KV/D1/R2 + first deployment
  -> ... work, commits ...
  -> mise run cf:preview:update     re-upload the latest build
  -> mise run cf:preview:smoke      HTTP smoke the stable Preview URL
  -> ... more work, more updates ...
  -> merge to main
  -> mise run cf:preview:delete     delete the Preview and clean up Preview-only resources
```

The Preview name is derived from the branch name and prefixed with
`experiment-`. The Preview-only KV / D1 / R2 are named after the
branch and prefixed with the Worker name (`social-club`). The
sanitisation is in `sanitizeBranch()` in
`scripts/cf-preview.mjs`.

## What the scripts do

All Preview subcommands live in `scripts/cf-preview.mjs` and are
exposed as `mise run cf:preview:*` tasks.

| Subcommand | What it does                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`   | Read-only. Prints the derived Preview name and resource names, the current `wrangler preview settings` JSON, and the 15 most recent production deployments.                                                                                             |
| `create`   | Provisions Preview-only KV / D1 / R2 if they do not exist, applies the standard nine Club migrations to the Preview D1, generates an override config, and runs `wrangler preview`. Outputs the Preview identity, stable URL, and deployment ID as JSON. |
| `update`   | Generates the override config and runs `wrangler preview` again for the same branch. The Preview identity is preserved across updates.                                                                                                                  |
| `smoke`    | Resolves the stable Preview URL (via a `wrangler preview` re-run that is a no-op for identity but emits the URL) and curls `/` and `/waiting-list/`. Fails the script if either is not 200.                                                             |
| `delete`   | Calls `wrangler preview delete`, then explicitly deletes the Preview-only KV namespace, D1 database, and R2 bucket (with all objects). Production is never named in the cleanup path.                                                                   |
| `orphans`  | Read-only. Lists every KV / D1 / R2 resource whose name contains `social-club-preview-`. The default action is **report only** — never deletes.                                                                                                         |

## How secrets work

Previews do not receive the production secrets. The override config
in the script does not include any of the six production secret names
(`RESEND_API_KEY`, `RESEND_WEBHOOK_ID`, `RESEND_WEBHOOK_SIGNING_SECRET`,
`RESEND_FROM`, `OPERATOR_EMAIL`, `MINIMAX_API_KEY`). If a Preview
needs a secret, use `wrangler preview secret put --name <name>
<KEY>`. The secret is bound to the Preview, not to the Worker.

Synthetic values only. Never copy a production secret value into a
Preview.

## What data is safe

Each Preview gets:

- A Preview-only KV namespace named
  `social-club-preview-<branch>-session`.
- A Preview-only D1 database named `social-club-preview-<branch>` with
  the standard nine migrations applied.
- A Preview-only R2 bucket named
  `social-club-preview-<branch>-artifacts`.

The Preview is not on the production zone route. The
`APP_BASE_URL` env var is set to `https://preview.example.invalid` so
no app code can accidentally call the production origin.

## How to smoke it

`mise run cf:preview:smoke` curls the stable Preview URL at `/` and
`/waiting-list/`. For a deeper smoke, run a focused Playwright suite
against the stable URL — the worker identifies itself as the
Preview by setting `ENVIRONMENT=preview-<branch>` in the override
config.

## How to delete it

`mise run cf:preview:delete` runs on the branch that owns the
Preview. The script:

1. Calls `wrangler preview delete --name <preview-name>` (this removes
   the branch identity).
2. Deletes the Preview-only KV namespace.
3. Deletes the Preview-only D1 database.
4. Deletes the Preview-only R2 bucket (after deleting every object in
   it, because `wrangler r2 bucket delete` requires the bucket to be
   empty).

The script never touches a resource whose name does not start with
`social-club-preview-<branch>-`. The cleanup is
**ownership-proven by name and branch** — it is not a name-resemblance
delete.

## What cleanup is automatic / manual

- The Preview branch identity is removed by
  `wrangler preview delete`.
- The Preview-only KV / D1 / R2 / secrets are removed by
  `mise run cf:preview:delete`.
- Per-deployment URLs (`https://<deployment-id>-social-club.loftwah.workers.dev`)
  are **not** deleted by `wrangler preview delete`. They continue
  to serve the deployment they were created for, and age out
  according to Cloudflare's preview alias retention. If you need to
  accelerate this, the Cloudflare dashboard can manually remove
  them.

## Production guardrails

| Guard                     | Where                                                                          | What it does                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                    | `scripts/cf-preview.mjs` `ensureNotMain`                                       | `create`, `update`, `smoke`, `delete` refuse to run on `main` or `master`.                                                             |
| Binding denylist          | `scripts/cf-preview.mjs` `findProductionIdentityWarning`                       | Walks both top-level and `previews` blocks of `wrangler.jsonc` and refuses to run if the production D1 / KV / R2 IDs appear in either. |
| Override config generator | `scripts/cf-preview.mjs` `buildOverrideConfig`                                 | The only sanctioned way to write a Preview override config. Always redeclares KV / D1 / R2 with Preview-only IDs.                      |
| Production secrets        | `scripts/cf-preview.mjs` `buildOverrideConfig`                                 | The override does not include any production secret name.                                                                              |
| Cron                      | `wrangler.jsonc` has no `triggers` block; `wrangler preview` does not add one. | The Preview inherits the production trigger state, which is empty.                                                                     |
| Workers Builds            | Disabled (no `wrangler.jsonc` connection, no Cloudflare-side trigger)          | The only path that can write a Preview is `mise run cf:preview:create                                                                  | update`. |
| Routes                    | The override config in `buildOverrideConfig` does not set `routes`.            | The Preview is not on the production zone. The Preview URL is the `workers.dev` subdomain only.                                        |

## Orphan detection

`mise run cf:preview:orphans` reports every KV / D1 / R2 whose name
matches `social-club-preview-*`. It does not delete anything. To clean
an orphan, run `mise run cf:preview:delete` on the branch that owns
it. If the owning branch no longer exists, delete the resource
manually after confirming ownership.

The default orphan action is report. Auto-deletion is intentionally
not implemented until the matching/ownership logic has been proven
safe over several merge cycles.

## Observability

The Preview inherits the production observability settings from
`wrangler.jsonc` (`enabled: true`, `head_sampling_rate: 1`). The
Preview identity is recorded in the deployment metadata and is
visible in the Cloudflare Workers dashboard under the
`social-club` Worker → `Previews` tab.

Do not enable additional always-on logging for a Preview. Reuse the
account-wide observability policy.

## Tests

The pure-function surface of `scripts/cf-preview.mjs` is covered by
`scripts/cf-preview.test.mjs`, which is run as part of `mise run check`
and `mise run test`. The full Preview lifecycle is exercised manually
against a real Cloudflare account, and the evidence is captured in
`docs/CLOUDFLARE_WORKER_PREVIEWS_LAB.md`.
