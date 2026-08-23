# MiniMax Repeatable Acceptance Loop — Complete Current Version

Re-read:

- `AGENTS.md`
- `PROJECT_BRIEF.md`
- `MASTER_SPEC.md`
- `config/ENVIRONMENT.md`
- `fixtures/acceptance-scenarios.yaml`

Inspect the current repository.

Your task is not to add random features. Your task is to prove that the currently intended scope is genuinely complete, find every gap against the specification, fix everything you can safely fix, and stop only when acceptance passes or a real user decision is required.

## 1. Spec-to-code audit

Map each relevant requirement to:

```text
requirement
implementation path
test path
status = PASS | PARTIAL | MISSING | BLOCKED
```

Cover:

- product invariants;
- waitlist;
- onboarding;
- consent;
- entitlements;
- memory;
- chapters/locations;
- ordinary event lifecycle;
- cancellation safety;
- communication lifecycle;
- Resend inbound;
- milestones;
- human tasks;
- AI abstraction;
- API/MCP;
- idempotency;
- audit;
- security/privacy;
- SEO/accessibility;
- local CI.

## 2. State-machine audit

For every implemented state machine:

- states;
- valid transitions;
- invalid transitions;
- terminal states;
- failure states;
- retry paths;
- escalation paths.

Find and fix orphan, unreachable or indefinite pending states.

## 3. Product invariant audit

Prove:

- no ordinary attendance state;
- every invited ordinary event has a cancellation path;
- cancellation does not depend on AI availability;
- member silence is valid;
- AI cannot invent durable member truth;
- optional services obey consent/entitlement;
- permission revocation cancels scheduled future affected work.

## 4. Failure injection

Actively test:

- Resend transient failure;
- Resend permanent failure;
- duplicate/replayed queue job;
- worker crash/retry;
- malformed AI output;
- invented member fact;
- invalid Resend signature;
- duplicate webhook event;
- local/hosted agent disappearing mid-job;
- cancellation failure near deadline;
- missing postal address;
- permission revoked after scheduling;
- unsupported chapter.

Verify expected terminal or escalation state.

## 5. Search for fake completion

Search for:

```text
TODO
FIXME
HACK
TEMP
PLACEHOLDER
NOT_IMPLEMENTED
skipped tests
disabled tests
mock-only production paths
hard-coded fake production metrics
throw new Error
```

Fix, justify as explicitly outside scope, or report as a known limitation. Do not hide blockers.

## 6. Environment audit

The project uses:

```text
RESEND_WEBHOOK_ID
RESEND_WEBHOOK_SIGNING_SECRET
```

Reject stale usage of:

```text
RESEND_WEBHOOK_SECRET
```

Do not add `APP_ENV`.

Never print secret values.

## 7. Provider audit

For every provider-specific integration:

- verify current official docs;
- keep adapter boundary;
- use fake in normal CI;
- add contract/manual verification where required.

ThreeUI must be the current Meng To / Design+Code project, not an unrelated similarly named package.

## 8. Run canonical acceptance

```sh
mise run acceptance
```

If it fails, diagnose, fix and rerun. Continue unless a user decision is genuinely required.

## 9. Fresh-state proof

Acceptance must pass without a hand-edited local database or hidden prior state.

Migrations must apply from zero and fixtures must be deterministic.

## 10. Documentation consistency

If behaviour changed, update spec/state diagrams/tests/decision records. Do not rewrite the spec merely to excuse broken implementation.

## Final output

Only use `ACCEPTANCE: PASS` if the command actually passed.

```text
ACCEPTANCE: PASS

Canonical command:
...

Product invariants:
PASS

Terminal-state audit:
PASS

Failure injection:
PASS

Fresh migrations:
PASS

Unit:
PASS

Integration:
PASS

E2E:
PASS

Accessibility:
PASS / manual checks

Security:
PASS / manual checks

Build:
PASS

Provider contracts:
...

Manual checks:
...

Known limitations outside scope:
...

Open decisions:
NONE
```

If blocked:

```text
ACCEPTANCE: BLOCKED

Question:
...

Why it matters:
...

Options:
1. ...
2. ...

Recommended default:
...
```

Then wait. Do not reassure. Prove.
