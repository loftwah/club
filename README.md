# Social Club — Complete Specification Pack

Generated from scratch: **2026/08/23 15:16 AEST (UTC+10) / 2026/08/23 05:16 UTC**

This pack is the complete current specification for the Social Club project. It supersedes all earlier generated packs.

## Locked facts

- Public application URL: `https://club.loftwah.com`
- Primary runtime: Cloudflare Workers
- Database: D1
- Artefacts: R2
- Durable async work: Cloudflare Queues
- Scheduled discovery: Cloudflare Cron Triggers
- Email: Resend outbound and inbound
- Resend webhook route: `POST https://club.loftwah.com/api/webhooks/resend`
- Initial inbound event: `email.received`
- Correct Resend variable names: `RESEND_WEBHOOK_ID`, `RESEND_WEBHOOK_SIGNING_SECRET`
- AI/media: MiniMax initially, behind provider abstractions
- Three-dimensional components: ThreeUI by Meng To / Design+Code, official package `@designcodeio/threeui`
- Billing: Stripe-ready, but waiting-list-first launch
- Source control: GitHub
- CI: local-first, minimal GitHub Actions
- Ordinary club events are not attended
- Public club name is not final

## Read order for an agent

1. `AI_START_HERE.md`
2. `PROJECT_BRIEF.md`
3. `AGENTS.md`
4. `MASTER_SPEC.md`
5. `config/ENVIRONMENT.md`
6. `fixtures/acceptance-scenarios.yaml`
7. `prompts/MINIMAX_KICKOFF.md`

Use `prompts/MINIMAX_ACCEPTANCE_LOOP.md` repeatedly after implementation passes.

## Source-of-truth order

1. New explicit user instruction
2. `AGENTS.md`
3. `PROJECT_BRIEF.md`
4. `MASTER_SPEC.md`
5. Existing implementation

If a material question remains genuinely ambiguous, ask the user instead of inventing a decision.

## Definition of done

The relevant scope is complete only when the canonical local acceptance command succeeds:

```sh
mise run acceptance
```

If the repository already has an equivalent task runner, preserve one documented canonical local acceptance command. Do not create a GitHub-only build system.
