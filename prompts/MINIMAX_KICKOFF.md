# MiniMax Kickoff Prompt — Complete Current Version

You are the primary implementation agent for this repository.

This repository contains a complete current product specification. Treat it as durable project memory.

## First: read everything

Before writing code, read in full:

- `AI_START_HERE.md`
- `PROJECT_BRIEF.md`
- `AGENTS.md`
- `MASTER_SPEC.md`
- `config/ENVIRONMENT.md`
- `fixtures/acceptance-scenarios.yaml`

Then inspect the existing repository.

Do not rely on an old chat or previous generated pack.

## Current facts already decided

- Public app: `https://club.loftwah.com`
- Cloudflare Workers runtime
- D1
- R2
- Queues
- Cron
- Wrangler
- Resend outbound + inbound
- Resend webhook route: `POST https://club.loftwah.com/api/webhooks/resend`
- Initial Resend webhook event: `email.received`
- Correct Resend env names: `RESEND_WEBHOOK_ID`, `RESEND_WEBHOOK_SIGNING_SECRET`
- The real local environment is reported to already contain the Resend webhook ID/signing secret; do not create a duplicate blindly
- MiniMax is the initial AI/media provider
- MiniMax may be used inside the application for bounded runtime generation
- ThreeUI means the current Meng To / Design+Code project and official `@designcodeio/threeui` package
- Stripe is anticipated but first launch is waiting-list-first
- GitHub is source control
- CI is local-first
- GitHub Actions should be minimal
- API/MCP agent operation is required
- ordinary club events are not attended
- A$5/A$20/A$50 pricing structure is current
- onboarding/preferences/alignment/terms precede paid activation

Do not introduce `RESEND_WEBHOOK_SECRET`.

Do not introduce `APP_ENV`.

## Critical product invariant

If you build an ordinary event attendance/RSVP/check-in flow, you have misunderstood the product.

Ordinary event lifecycle is intended to end in cancellation.

## Phase 1 — repository audit

Before large changes, report:

1. repo structure;
2. framework/package/toolchain;
3. Cloudflare/Wrangler configuration;
4. migrations/data model;
5. tests;
6. CI;
7. deployment setup;
8. specification requirements already satisfied;
9. missing requirements;
10. contradictions;
11. blocking user decisions;
12. current-provider documentation that must be checked.

If a material user decision blocks work, ask it now and stop before silently choosing it.

Do not ask questions the repo/spec/tests/current official docs can answer.

## Phase 2 — establish local acceptance

Create/repair one canonical local command:

```sh
mise run acceptance
```

If the repository already has an approved equivalent task runner, preserve one documented top-level equivalent and explain.

GitHub Actions must invoke the local gate rather than duplicate the build/test system.

## Phase 3 — durable foundations

Prioritise foundations that prevent rewrites:

- migrations;
- D1 schema;
- domain state machines;
- entitlement/policy engine;
- service grants;
- onboarding/consent;
- waitlist;
- chapters/locations;
- communications;
- jobs/idempotency;
- audit;
- provider interfaces;
- local test infrastructure.

Start as a modular monolith unless repo inspection gives a compelling reason otherwise.

## Phase 4 — naming and brand approval

The public name and identity are not final.

Generate:

- at least 20 credible club names;
- 3–5 finalists;
- rationale;
- likely SEO/business-name collision observations;
- domain options;
- crest/identity potential.

Use MiniMax for visual/logo/seal explorations where useful.

Present final name, palette, typography and mark direction to me for approval.

Do not silently lock the brand.

## Phase 5 — waiting-list public site

Build an exceptionally polished, SEO-first, responsive and accessible public site.

Use semantic DOM content first.

Use ThreeUI intentionally for premium 3D enhancement. Verify its current official package/repo before installation.

Core content must work without WebGL.

Implement the relevant public experience from `MASTER_SPEC.md`, including:

- proposition;
- cancelled-event metric presentation;
- how it works;
- invitation/cancellation example;
- A$5/A$20/A$50 tier preview;
- physical artefacts;
- birthdays/personal care;
- chapters;
- lore/journal;
- FAQ;
- waiting list;
- SEO;
- accessibility.

Do not fabricate real member numbers or partnerships.

## Phase 6 — Resend

Use exact current environment names:

```text
RESEND_API_KEY
RESEND_WEBHOOK_ID
RESEND_WEBHOOK_SIGNING_SECRET
RESEND_FROM
OPERATOR_EMAIL
```

Implement:

- outbound adapter;
- waitlist welcome;
- inbound route;
- raw-body webhook signature verification;
- webhook dedupe;
- inbound persistence;
- known/unknown sender handling;
- classification scaffold;
- operator escalation.

Before provider-specific code, verify current official Resend docs.

Do not create a duplicate webhook merely because a creation command exists in the spec. First inspect the environment/config/provider state.

## Phase 7 — AI runtime

Implement provider abstraction.

MiniMax may handle:

- text generation;
- image generation;
- classification;
- extraction.

Domain logic decides what work exists. AI does not decide truth, entitlement or consent.

Use structured outputs and validators.

## Phase 8 — API/MCP

Expose safe capability-oriented tools.

Do not expose arbitrary SQL or broad raw member dumps.

All writes pass through domain policy and audit.

## Phase 9 — tests

Implement all tests relevant to current scope from `MASTER_SPEC.md`.

Use provider fakes in normal local CI.

Use credentialed contract tests separately where useful.

Do not fake implementation merely to make tests green.

## Provider uncertainty / pseudocode rule

If a provider/API detail is uncertain:

1. check current official documentation;
2. keep domain interface separate;
3. use pseudocode only until exact provider behaviour is verified;
4. do not invent API syntax;
5. ask me only if a product decision is required.

## Confusion rule

If, after reading everything, two materially different interpretations remain, ask me.

Do not guess.

## Completion

Do not stop because the homepage looks good.

Run:

```sh
mise run acceptance
```

Keep fixing until it passes or a real user decision blocks you.

Final report:

```text
ACCEPTANCE: PASS / BLOCKED / FAIL

Canonical command:
...

Implemented:
...

Tests:
...

Migrations:
...

Provider contracts verified:
...

Manual checks:
...

Open decisions:
...

Known limitations:
...
```

PASS means the relevant scope is actually proven.
