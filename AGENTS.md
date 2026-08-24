# AGENTS.md

## Product invariants

- Ordinary events are not attended and have no `ATTENDED`, `CHECKED_IN`, or `NO_SHOW` state. Cancellation is successful fulfilment.
- Silence is successful membership. Higher tiers add physical/human intensity, never greater belonging.
- AI may not invent facts or override consent, entitlements, legal gates, budgets, safety, or state machines. D1/runtime owns truth. Optional services require entitlement, permission, and prerequisites; revocation affects future work.
- Workflows terminate or escalate; no silent indefinite `PENDING`. Critical cancellation failures escalate. Side effects are idempotent and auditable.
- Never imply real partnerships, bookings, statistics, or lore as fact.
- Paid membership requires alignment and onboarding. Real payments need approval.

## Locked facts and gates

- Name: **Plans With You**. Tiers/pricing: **Member A$5**, **Corresponding Member A$20**, **Deluxe Member A$50**.
- URL: `https://club.loftwah.com`. Resend: `POST /api/webhooks/resend`, initially `email.received`; use `RESEND_WEBHOOK_ID` and `RESEND_WEBHOOK_SIGNING_SECRET`. Never use `RESEND_WEBHOOK_SECRET` or add `APP_ENV`.
- Cadence policy lives in `src/brand/cadence.ts`; no production Cron Trigger is deployed. Policy is not scheduling.
- ThreeUI means official `@designcodeio/threeui`. Product/design detail is delegated.
- Ask before payments, final legal wording, irreversible purchases, ambiguous destructive migrations, sensitive-data expansion, or undecided commercial pricing.

## Long-running execution

- Work in large coherent batches; integrate, then validate. Use focused checks only to prevent substantial rework.
- Fix root causes together; avoid fix-one/full-suite loops and routine narration.
- Persist decisions. Parallelise independent work, coordinate overlaps, and use adversarial review near completion.
- Inspect rendered pixels. Passing tests or rendering successfully is not commercial acceptance.
- Keep approved 16:9 and 9:16 evergreen creative current; source in Git, heavy outputs in artefact storage.
- Use current Remotion skills/docs. Continue until a true gate.

## Canonical acceptance

Run `mise run acceptance`. Report PASS/FAIL, tests, migrations, provider contracts, manual checks, open questions, and limitations. FAIL is incomplete.
