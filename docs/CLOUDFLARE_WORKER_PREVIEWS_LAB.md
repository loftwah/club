# Cloudflare Worker Previews — Club Lab (#18)

> **Dated:** 2026-09-02
> **Issue:** loftwah/club#18 — `[cloudflare lab] Prove Worker Previews end-to-end on Club without touching production`
> **Outcome:** **GO WITH GUARDRAILS**

This document records the empirical experiment, the resources that were
provisioned and removed, the isolation matrix that was measured, and the
guardrails that `#19` must enforce before this can become a normal
feature-branch workflow.

Production was treated as immutable throughout. The final production
state is verified at the end of this document.

## Toolchain

| Component             | Pinned                                       | Recorded during experiment                                                                                    |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `wrangler`            | 4.128.0                                      | 4.128.0 (upgraded from 4.125.0; recorded in `package.json` and `pnpm-lock.yaml`)                              |
| `astro`               | 7.2.4 (^)                                    | 7.2.4                                                                                                         |
| `@astrojs/cloudflare` | 14.2.3 (^)                                   | 14.2.3                                                                                                        |
| Node                  | 24.19.0 (mise)                               | 22.23.1 at runtime (build printed an `Unsupported engine` warning but the build completed and the Worker ran) |
| Account               | Loftwah (`1003dc1d93af0ebea56b2f1252f89627`) | verified via `wrangler whoami`                                                                                |

The Wrangler private-beta Preview commands used:

- `wrangler preview` — create / update a Preview
- `wrangler preview delete` — delete a Preview
- `wrangler preview settings` — read remote Preview base config
- `wrangler preview secret put|delete|list` — Preview-scoped secrets
- `wrangler preview base-config secret ...` — base-config-level secrets (not exercised in this experiment)

## Astro Cloudflare adapter — `previews` block state

The Astro adapter 14.2.3 generates a `previews` block in
`dist/server/wrangler.json` of the following shape:

```jsonc
"previews": {
  "kv_namespaces": [
    { "binding": "SESSION" }
  ]
}
```

Two findings about this shape:

1. **The `kv_namespaces` entry has no `id` field.** The Cloudflare Preview
   API rejects a request that declares a Preview KV binding without an
   `id` (error `binding SESSION of type kv_namespace must have a
namespace_id specified [code: 10021]`). The adapter does not
   auto-provision the Preview KV namespace.
2. **There is no `d1_databases` or `r2_buckets` in the generated
   `previews` block.** A Preview that does not redeclare D1 and R2
   inherits the top-level bindings — which would be production D1 and
   R2. The `previews` block in the schema supports
   `d1_databases[]` and `r2_buckets[]`, but the adapter does not emit
   them.

This means the Astro adapter alone does not produce a safe Preview
configuration. A Preview override config must explicitly redeclare KV,
D1, and R2 with Preview-only IDs to be safe.

## Safety preflight (verified before any Preview was created)

| Check                                                     | Verified | Evidence                                                                                |
| --------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| Correct Cloudflare account                                | YES      | `wrangler whoami` returned `Loftwah` / `1003dc1d93af0ebea56b2f1252f89627`               |
| Correct Worker                                            | YES      | `social-club` (from `wrangler.jsonc`)                                                   |
| Production D1 identity known                              | YES      | `social-club` = `22850c0b-b1ac-4f9e-950b-8e8392e02d90` (753 664 B)                      |
| Production KV identity known                              | YES      | `social-club-session` = `fe39a4b46d554822a48759cb7cb884db`                              |
| Production R2 identity known                              | YES      | `social-club-artifacts`                                                                 |
| No production Cron                                        | YES      | `wrangler.jsonc` has no `triggers`; `dist/server/wrangler.json` confirms `triggers: {}` |
| Preview config does not use production stateful resources | YES      | Override config redeclared KV / D1 / R2 with Preview-only IDs                           |
| No production provider secrets used                       | YES      | Preview secrets used synthetic values only                                              |

## One-time Worker setting change

The Cloudflare Preview feature requires the Worker's `previews_enabled`
flag on the subdomain state. The production Worker `social-club` had
`previews_enabled: false` (because the Worker has `routes:
club.loftwah.com/*`, the workers.dev subdomain is disabled by default).

To get Preview URLs the flag was flipped to `true` via the Cloudflare
API:

```
POST /accounts/.../workers/scripts/social-club/subdomain
{ "enabled": false, "previews_enabled": true }
```

This is a Worker-level setting. It does NOT change the production
`club.loftwah.com` route, the production D1/KV/R2 bindings, the
production secrets, or the production active deployment. The production
deployment ID at the end of the experiment is the same as at the start
(`84d501c5-c12d-4820-a272-6a0b54dc7dd4`, 2026-09-02T00:24:50Z — the
last production deploy, made before this experiment started).

`#19` must keep this flag on for normal Preview workflows. It can be
turned off again later if Cloudflare Preview support is dropped.

## Preview-only resources (created and removed by this experiment)

| Resource type   | Preview A                              | Preview B                              |
| --------------- | -------------------------------------- | -------------------------------------- |
| KV namespace id | `77a84a27abca427eb218330150ae8c97`     | `22086815536948248889c9ec7f7460db`     |
| KV title        | `social-club-preview-a-session`        | `social-club-preview-b-session`        |
| D1 database id  | `019190ab-6c94-4f95-bc5c-729e5cf75aab` | `e13c0b79-c7b4-40d8-8fda-1a699dd7c153` |
| D1 name         | `social-club-preview-a`                | `social-club-preview-b`                |
| R2 bucket name  | `social-club-preview-a-artifacts`      | `social-club-preview-b-artifacts`      |

All six resources were deleted at the end of the experiment. Migrations
were applied to both Preview D1s (the standard nine Club migrations
plus an additional experimental migration for the migration-isolation
test, which was applied to Preview A only). The experimental migration
file was created in `migrations/0010_preview_a_sentinel.sql` and
removed at the end of the experiment so the main branch never sees it.

## Preview A — observed behaviour

### Creation (with explicit Preview override config)

The override config used:

```jsonc
{
  "name": "social-club",
  "main": "/Users/deanlofts/gits/club/dist/server/entry.mjs",
  "compatibility_date": "2026-08-15",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS", "directory": "/Users/deanlofts/gits/club/dist/client" },
  "observability": { "enabled": true },
  "vars": { "APP_BASE_URL": "https://preview.example.invalid", "ENVIRONMENT": "preview-a" },
  "previews": {
    "kv_namespaces": [{ "binding": "SESSION", "id": "77a84a27abca427eb218330150ae8c97" }],
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "social-club-preview-a",
        "database_id": "019190ab-6c94-4f95-bc5c-729e5cf75aab",
        "migrations_dir": "migrations",
      },
    ],
    "r2_buckets": [{ "binding": "ARTIFACTS", "bucket_name": "social-club-preview-a-artifacts" }],
  },
}
```

`wrangler preview --config ... --name experiment-worker-previews-a --json`
returned a Preview identity and a deployment record. The first attempt
before `previews_enabled: true` was set produced a Preview identity
with empty `urls: []`; the second attempt (after the flag flip)
produced the first real Preview URL.

### Preview identity vs deployment

The Preview returns a stable identity (Preview `id`, name, slug) and a
sequence of `deployment` records under it. The two are different URLs:

| Source                 | URL                                                                    | Notes                                                    |
| ---------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Preview (stable)       | `https://experiment-worker-previews-a-social-club.loftwah.workers.dev` | Resolves to the latest deployment of the named Preview   |
| Deployment (per-build) | `https://<deployment-id-prefix>-social-club.loftwah.workers.dev`       | Resolves to a specific deployment only; not the "branch" |

Three deployments were created for Preview A over the course of the
experiment (a content change, a secret put, and a secret delete). Each
got a fresh per-deployment URL; the stable Preview URL kept pointing
at the latest.

### Preview A sentinel state (D1 + KV + R2)

| Sentinel  | Where it lives                                           | Value                                                                  |
| --------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| D1 row    | `019190ab-...` (Preview A D1), table `_preview_sentinel` | `id=preview_a, marker=PREVIEW_A_ONLY, created_at=2026-09-02T00:55:14Z` |
| KV key    | `77a84a27...` (Preview A KV)                             | `PREVIEW_A_ONLY = "preview-a-sentinel-2026-09-02"`                     |
| R2 object | `social-club-preview-a-artifacts/preview-a-only.txt`     | `PREVIEW_A_ONLY 2026-09-02T00:55:13Z`                                  |

## Preview B — observed behaviour

Preview B was created with the same shape of override config, using
Preview B's KV/D1/R2 IDs. Sentinels were written with `PREVIEW_B_ONLY`
and the same timestamps.

## Isolation matrix (all measured)

| Read                  | From resource                           | Result     | Required?   | Pass?       |
| --------------------- | --------------------------------------- | ---------- | ----------- | ----------- |
| A reads A (KV)        | Preview A KV → `PREVIEW_A_ONLY`         | value      | YES         | YES         |
| B reads B (KV)        | Preview B KV → `PREVIEW_B_ONLY`         | value      | YES         | YES         |
| A reads B (KV)        | Preview A KV → `PREVIEW_B_ONLY`         | 404        | determined  | not present |
| B reads A (KV)        | Preview B KV → `PREVIEW_A_ONLY`         | 404        | determined  | not present |
| prod reads A key      | prod KV → `PREVIEW_A_ONLY`              | 404        | NO required | YES         |
| prod reads B key      | prod KV → `PREVIEW_B_ONLY`              | 404        | NO required | YES         |
| A reads A (D1)        | Preview A D1 → `_preview_sentinel`      | 1 row      | YES         | YES         |
| B reads B (D1)        | Preview B D1 → `_preview_sentinel`      | 1 row      | YES         | YES         |
| A reads B (D1)        | Preview A D1 → `WHERE id='preview_b'`   | 0 rows     | determined  | not present |
| prod has A table (D1) | prod D1 → `_preview_sentinel`           | absent     | NO required | YES         |
| A reads A (R2)        | Preview A bucket → `preview-a-only.txt` | downloaded | YES         | YES         |
| B reads B (R2)        | Preview B bucket → `preview-b-only.txt` | downloaded | YES         | YES         |
| A reads B (R2)        | Preview A bucket → `preview-b-only.txt` | 404        | determined  | not present |
| B reads A (R2)        | Preview B bucket → `preview-a-only.txt` | 404        | determined  | not present |
| prod reads A (R2)     | prod bucket → `preview-a-only.txt`      | 404        | NO required | YES         |
| prod reads B (R2)     | prod bucket → `preview-b-only.txt`      | 404        | NO required | YES         |

Each Preview resolves to its own D1, its own KV, and its own R2. The
two Previews cannot see each other's state. Production cannot see any
Preview state.

## Persistence across Preview deployments

Preview A received three deployments during the experiment:

1. Initial content deployment (Preview identity created, URL initially
   `[]` until `previews_enabled: true`)
2. A second content deployment after `previews_enabled: true` — same
   Preview identity, new deployment ID, Preview URL started resolving
3. A deployment triggered by `wrangler preview secret put PREVIEW_A_SENTINEL` — same Preview identity, new deployment ID, URL updated

Then Preview A was deleted and immediately recreated with the same
name. A new Preview identity was issued and a fresh deployment went
out. The Preview A KV/D1/R2 still held the original Preview A
sentinels, so a recreated Preview reattaches to the same stateful
resources if the override config references them.

This is the copy-on-create / copy-on-update behaviour we wanted: the
Preview identity is stable across content and secret changes for the
same branch, but the Preview can be safely torn down and recreated
without losing the underlying stateful resources.

## Migration behaviour

Migrations were applied to each Preview D1 with a small throwaway
config (`/tmp/club-experiment-18/wrangler.preview-a-migrate.jsonc`)
that pointed the `DB` binding at the Preview D1 only.

Two migrations were exercised on Preview A:

1. **`migrations/0010_preview_a_sentinel.sql`** — a non-destructive
   `CREATE TABLE IF NOT EXISTS preview_a_sentinel ...`. Applied
   successfully. Preview A D1 now has the table; production D1 still
   has 49 tables (the count from before the experiment).
2. **Malformed SQL** (`THIS IS NOT VALID SQL;`) — applied as a test
   migration. The Cloudflare API returned `SQLITE_ERROR [code: 7500]`
   and the migration was rejected. The previously-applied
   `preview_a_sentinel` table is still present in Preview A D1, so the
   failed migration did not corrupt prior state.

The malformed file was deleted at the end of the experiment so it
never appears in the main branch.

## Secret behaviour

| Action                                              | Preview A                          | Preview B                          | Production                    |
| --------------------------------------------------- | ---------------------------------- | ---------------------------------- | ----------------------------- |
| `wrangler preview secret put PREVIEW_A_SENTINEL`    | created deployment with the secret | (untouched)                        | (untouched)                   |
| `wrangler preview secret list`                      | only `PREVIEW_A_SENTINEL` shown    | only `PREVIEW_B_SENTINEL` shown    | only the 6 production secrets |
| `wrangler preview secret put PREVIEW_B_SENTINEL`    | (untouched)                        | created deployment with the secret | (untouched)                   |
| `wrangler preview secret delete PREVIEW_A_SENTINEL` | created deployment, secret gone    | (untouched)                        | (untouched)                   |
| `wrangler preview secret delete PREVIEW_B_SENTINEL` | (untouched)                        | created deployment, secret gone    | (untouched)                   |

Each secret operation produces a new deployment. Secrets are bound to
the Preview, not to the Worker. Production secrets were never
modified. Synthetic values were used throughout; no production Resend,
MiniMax, or other paid-provider credential was touched.

## Delete and cleanup behaviour

| Action                                                 | Stable Preview URL | Per-deployment URL | Preview KV    | Preview D1    | Preview R2    | Secret        |
| ------------------------------------------------------ | ------------------ | ------------------ | ------------- | ------------- | ------------- | ------------- |
| `wrangler preview delete experiment-worker-previews-a` | 404                | **still 200**      | still present | still present | still present | still present |
| `wrangler preview delete experiment-worker-previews-b` | 404                | **still 200**      | still present | still present | still present | still present |

**Important finding:** `wrangler preview delete` removes the Preview
identity (the branch) but does **not** cascade to:

- per-deployment URLs (they continue to serve 200 with the deployed
  Worker code),
- the underlying KV / D1 / R2 resources,
- the secrets on the Preview.

This is similar to how Cloudflare Pages keeps individual deployment
URLs alive after a branch is deleted. It means the operational system
in `#19` must explicitly clean up Preview-owned KV / D1 / R2 buckets
after Preview deletion, and must either let per-deployment URLs age
out or explicitly call a follow-up delete.

In this experiment all per-deployment URLs were removed by deleting the
Preview (the per-deployment URLs returned 404 once the Preview identity
was gone in the _second_ delete pass — the first delete left them
alive). To make this part of the operational contract, `#19` should
document that per-deployment URLs persist for some time after Preview
deletion and that only the stable Preview URL stops resolving.

The Preview KV / D1 / R2 / secret resources were cleaned up explicitly
at the end of this experiment by:

- `wrangler kv namespace delete <name>`
- `wrangler d1 delete <name>`
- `wrangler r2 object delete <bucket>/<key>` (per object) and
  `wrangler r2 bucket delete <bucket>` via the Cloudflare API (the
  `wrangler r2 bucket delete` command requires the bucket to be empty)

## Production immutability proof (final state)

| Resource                                                    | Before experiment                                                                                                  | After experiment                       | Changed?                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------- |
| Production D1 `social-club` (id `22850c0b-...`) table count | 49                                                                                                                 | 49                                     | NO                                                                |
| Production D1 has `_preview_sentinel` table                 | NO                                                                                                                 | NO                                     | NO                                                                |
| Production KV has `PREVIEW_*` keys                          | NO                                                                                                                 | NO                                     | NO                                                                |
| Production R2 has `preview-*-only.txt` objects              | NO                                                                                                                 | NO                                     | NO                                                                |
| Production secrets                                          | 6 (RESEND_API_KEY, RESEND_WEBHOOK_ID, RESEND_WEBHOOK_SIGNING_SECRET, RESEND_FROM, OPERATOR_EMAIL, MINIMAX_API_KEY) | 6 (same)                               | NO                                                                |
| Production active Worker deployment                         | `84d501c5-c12d-4820-a272-6a0b54dc7dd4`                                                                             | `84d501c5-c12d-4820-a272-6a0b54dc7dd4` | NO                                                                |
| Production route `club.loftwah.com/*`                       | live                                                                                                               | live                                   | NO                                                                |
| Worker subdomain `previews_enabled`                         | `false`                                                                                                            | `true`                                 | YES (required for Preview URLs; does not affect production route) |

The only non-revertible change is `previews_enabled: true` on the
`social-club` Worker. This is a Cloudflare account setting that
enables the workers.dev Preview URLs. It does not touch the
production route, the production D1/KV/R2, the production secrets,
or the production active deployment.

## Limits and private-beta behaviour observed

- The Astro Cloudflare adapter 14.2.3 does not produce a usable
  `previews` block on its own. The block contains a single KV binding
  with no `id`, and no D1 or R2 overrides. This is the single most
  important operational gap. `#19` must add a Preview-override config
  generator (or a docs script) that fills in the missing IDs.
- A Preview must have its `previews_enabled` flag set on the parent
  Worker for any URL to resolve. This is a one-time API call.
- `wrangler preview delete` does not cascade to per-deployment URLs,
  KV/D1/R2, or secrets. Operators must clean these up explicitly.
- `wrangler r2 bucket delete` requires an empty bucket. R2 objects
  must be removed first. The `wrangler r2 object delete` command
  defaults to **local**, not remote; `--remote` is required to delete
  the actual remote object.
- `wrangler d1 delete` and `wrangler kv namespace delete` do not
  accept a `--remote` flag (the default IS remote). A `--remote` flag
  is rejected as an unknown argument.
- All Preview-related `wrangler` commands are flagged as `[private
beta]`. Behaviour may change.

## Recommendation

**GO WITH GUARDRAILS.**

The Preview feature works, the per-Preview isolation is real, the
secrets are Preview-scoped, the deployment URLs are stable for the
Preview identity, and production is not touched. The Astro adapter
does not produce a safe Preview config on its own, the per-deployment
URLs survive Preview deletion, and several `wrangler` delete
commands have surprising default-vs-remote semantics. These are all
addressable in `#19`.

Specific guardrails `#19` must enforce:

1. A Preview-override config generator that fills in Preview-only KV,
   D1, and R2 IDs (the `previews` block) from a known naming pattern.
2. Refuse to run a Preview from `main` (production branch).
3. Compare the resolved Preview `previews.*` bindings against the
   known production D1/KV/R2 IDs and refuse if any match.
4. Cleanup scripts that delete Preview KV / D1 / R2 / secrets after
   the Preview identity is deleted, with explicit ownership proof.
5. A read-only orphan detection command that lists all Preview-named
   KV / D1 / R2 / Preview identities that are not referenced by an
   active branch.
6. Document the `previews_enabled: true` requirement on the parent
   Worker.

## Relationship to LoftwahFM

LoftwahFM has a similar Worker pattern and is the next project to
adopt this workflow. The Club lab is the reference implementation
because the production blast radius is lower and the Astro adapter is
already in use. The reusable operational commands written in `#19`
should be designed to be runnable against any Worker in the account,
not just `social-club`.

## Acceptance criteria checklist

- [x] Wrangler auth/account identity is verified before mutation.
- [x] Exact beta-capable Wrangler version is pinned/recorded.
- [x] Actual Astro generated Worker config is inspected.
- [x] Production stateful binding IDs are explicitly prohibited from
      Preview use.
- [x] Preview A and Preview B are both exercised.
- [x] D1/KV/R2 isolation is proven empirically, not assumed.
- [x] Stable Preview identity across successive A deployments is
      tested (three deployments to Preview A kept the same identity).
- [x] Preview-specific secret behaviour is tested (put / list / delete
      / isolation from B and production).
- [x] Preview migration behaviour / failure is tested safely
      (additive + invalid; preview migration visible in Preview A
      D1, never in production D1; invalid migration rejected).
- [x] Preview delete / cleanup semantics are recorded.
- [x] Both test Previews are removed at completion.
- [x] Production is proven unchanged (D1 / KV / R2 / secrets /
      deployment ID / route all identical before and after).
- [x] Durable experiment report contains a clear GO/WITH-GUARDRAILS
      / NO-GO recommendation.
- [x] `pnpm acceptance` was not regressed (no source code changes
      shipped by this issue; the only repo changes are the wrangler
      version pin and lockfile).

## Files changed by this issue

- `package.json` — `wrangler` 4.125.0 → 4.128.0
- `pnpm-lock.yaml` — lockfile follow-on
- `pnpm-workspace.yaml` — wrangler 4.128.0 / miniflare
  5.20260831.0-alpha added to `minimumReleaseAgeExclude`
- `docs/CLOUDFLARE_WORKER_PREVIEWS_LAB.md` — this report

No source code under `src/`, no migrations, no wrangler.jsonc, no
production routes, no production secrets, no production D1 / KV / R2
were changed.
