# 17. Architecture Decision Records

This file collects material architecture decisions. Each decision is dated and notes the locked facts and the consequences.

---

## ADR-001 — Application stack

**Date:** 2026-08-23 (AEST)
**Status:** Accepted
**Decision drivers:** SEO-first public site; semantic HTML requirement; React islands for interactive components; ThreeUI for premium 3D presentation; single Cloudflare Worker; local-first acceptance under `mise run acceptance`.

### Decision

The application is built as a single Cloudflare Worker with the following stack:

```text
Astro
+ React islands
+ @designcodeio/threeui
+ TypeScript
+ pnpm
+ Cloudflare Workers
+ D1
+ R2
+ Queues
+ Cron
+ Wrangler
```

Astro owns the SEO-first public, member, and admin application shell and the semantic rendering. React is used only where interactive components are warranted (forms with client-side validation, ThreeUI components, the admin dashboard). ThreeUI is used deliberately for premium 3D presentation (membership card, seal, hero atmosphere), not as the foundation of every page.

The Hono framework is **not** introduced by default. Astro/Cloudflare-native request handlers (`src/pages/api/**` and `src/pages/webhooks/**`) are used for ordinary APIs, webhooks, and application endpoints. Hono is permitted in the MCP/API capability layer only if a future implementation note documents (a) the problem it solves, (b) why Astro/Worker routing is insufficient, and (c) why this does not duplicate routing/business logic. Introducing Hono for general routing would create framework soup and is rejected.

### Consequences

- One deployment artifact, one Worker, one set of bindings, one canonical acceptance command.
- Astro SSR on Cloudflare produces the public HTML response; the same Worker also serves API and webhook routes.
- React islands are the boundary for client-side JavaScript. ThreeUI components are React components and are mounted as islands only where their use has been approved.
- The MCP capability surface is implemented using `createMcpHandler` from the Cloudflare Agents SDK (per `docs/20_PROVIDER_VERIFICATION.md` — MCP 2026-07-28 stateless). If Hono is later introduced for the MCP layer, the rationale and the non-overlap with Astro routing must be documented as a follow-up ADR.

### Alternatives considered

- **Next.js on Cloudflare Vite plugin** — heavier, App Router complicates Astro-style islands; rejected.
- **TanStack Start on Cloudflare Vite plugin** — strong, but Astro's content-first model is a better fit for the SEO/accessibility requirements of `docs/03.9`.
- **Pure Hono on Workers with a separate static site** — splits the deployment and complicates local-first acceptance; rejected.
- **Microservice-per-domain (separate Workers per feature)** — explicitly forbidden by the spec ("start as a modular monolith"); rejected.

---

## ADR-002 — Local-first acceptance

**Date:** 2026-08-23 (AEST)
**Status:** Accepted

### Decision

The authoritative local acceptance command is `mise run acceptance`. It runs from a clean local state and exercises, at minimum:

- format check
- lint
- typecheck
- fresh local resource setup (`.wrangler/state/` is recreated; D1 is migrated from zero; R2 and Queues are initialised)
- migrations from zero
- unit tests (Vitest)
- state-machine invariants
- integration tests (D1, Queues, Cron — running against `wrangler dev`/workerd)
- production build
- Wrangler/config validation (`wrangler deploy --dry-run`)
- narrative acceptance for the currently-in-scope acceptance stories

External providers (Resend, MiniMax, Stripe when added) are **faked** in ordinary local acceptance. Provider contract tests, when added, are credentialled and are **not** part of the default `mise run acceptance` run; they live behind a separate task (e.g. `mise run acceptance:contracts`).

GitHub Actions contains a minimal verifier that calls `mise run acceptance`. No business/test logic is duplicated in YAML.

### Consequences

- Acceptance is fast and deterministic; provider outages do not block local development.
- The contract-test split means CI does not require live provider credentials for normal `mise run acceptance`.
- Worker runtime is real (workerd) so D1/R2/Queues behaviour matches production as closely as local simulations allow.

### Implementation notes (Phase 1 follow-through)

The actual Phase 1 acceptance script (`scripts/acceptance.mjs`) executes:

1. `format:check`
2. `lint`
3. `typecheck (astro check)`
4. `typecheck (tsc)`
5. `unit tests` (state machines, policy, idempotency, jobs, agent-lease, fakes)
6. `integration tests` (in-memory D1 mock with the real schema)
7. `static schema check` (parity, forbidden event states, env naming)
8. `production build` (`astro build`)
9. `browser bundle performance budgets` against `dist/client`
10. `wrangler config dry-run` (config validation)
11. `real Cloudflare local D1 fresh-migration proof` (wipes `.wrangler/state`, applies every migration via the current Wrangler CLI, verifies the schema + constraints against the real local D1)
12. `browser E2E` (Playwright against a live `wrangler dev` process — covers public routes, form submission, mobile viewport, reduced motion, accessibility, private-route boundaries, and the no-JS / ThreeUI-fallback path)

CREDENTIALLED contract tests (Resend, MiniMax) live behind `mise run contracts` and are NOT part of the default acceptance run. The Resend contract verifies authentication, webhook-signature round-trip, and the received-email metadata/body HTTP API shape; the MiniMax contract is a future addition.

ThreeUI integration: no public production route imports ThreeUI. A protected
internal bakeoff compares direct-import candidates with semantic HTML/CSS
baselines; `docs/THREEUI_BAKEOFF.md` records the current do-not-ship verdict.
The public bundle therefore carries no Three/WebGL runtime.

Cron schedule: `wrangler.jsonc` intentionally has no `triggers.crons`. Product cadence policy is locked in `src/brand/cadence.ts`; the exact production runtime trigger frequency remains operationally unselected and must not be inferred or deployed as a placeholder.
