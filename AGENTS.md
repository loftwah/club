# AGENTS.md

## Product invariants

1. Ordinary club events are not attended.
2. There is no ordinary event `ATTENDED`, `CHECKED_IN` or `NO_SHOW` state.
3. Event cancellation is intentional successful fulfilment.
4. A member does not need to engage to remain a successful member.
5. Higher tiers add physical/human intensity, not greater belonging.
6. AI may not invent member facts.
7. AI may not override consent, entitlements, legal gates, budgets, safety rules or state machines.
8. Optional services require entitlement + permission + prerequisites.
9. Permission revocation affects already-scheduled future work.
10. Every important workflow reaches a terminal state or explicit human escalation.
11. No silent indefinite `PENDING`.
12. Critical event-cancellation failures escalate.
13. Side effects are idempotent.
14. Do not falsely claim venue partnerships, endorsements or real bookings.
15. Fictional lore does not inflate real member/business statistics.
16. D1/runtime owns truth; AI memory does not.
17. Agents use API/MCP capabilities, not arbitrary database mutation.
18. Important actions are auditable.
19. Paid membership cannot activate before required onboarding/alignment/terms.
20. Do not introduce real attended club events unless the user explicitly changes the invariant.

## Locked technical facts

- URL: `https://club.loftwah.com`
- Resend webhook: `POST /api/webhooks/resend`
- Initial Resend event: `email.received`
- Correct variables: `RESEND_WEBHOOK_ID`, `RESEND_WEBHOOK_SIGNING_SECRET`
- Do not use `RESEND_WEBHOOK_SECRET`.
- Do not add `APP_ENV`.
- MiniMax may be used for development agents and bounded runtime generation.
- ThreeUI means the current Meng To / Design+Code project and official `@designcodeio/threeui` package, not old unrelated similarly named packages.

## Ask before locking

- final club name;
- final tier names;
- final logo/crest;
- palette/fonts;
- tagline;
- exact event cadence/cancellation windows;
- gift budgets;
- call allowances;
- annual billing discounts;
- appearance-service pricing;
- final legal wording;
- destructive ambiguous migrations;
- expansion into sensitive personal data.

## Engineering direction

Prefer TypeScript, pnpm, modular monolith, Cloudflare Workers, D1, R2, Queues, Cron, Wrangler, explicit state machines, provider adapters, idempotency, audit events, deterministic policy, fakes for normal CI and local-first testing.

Avoid microservices without need, raw SQL MCP tools, hidden LLM state, duplicated CI logic in GitHub Actions, direct provider calls from UI, and AI writes directly to confirmed member truth.

## Canonical acceptance

```sh
mise run acceptance
```

Before claiming done, report PASS/FAIL, tests, migrations, provider contracts, manual checks, open questions and limitations. FAIL is not complete.
