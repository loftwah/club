# 15. Acceptance Contract

## 15.1 Canonical command

```sh
mise run acceptance
```

## 15.2 Required gates

At minimum:

```text
format
lint
typecheck
fresh local resource setup
migrations from zero
unit
state-machine invariants
integration
queues/idempotency
cron
email rendering
AI validation with fakes
security
browser E2E
accessibility automated checks
production build
Wrangler/config validation
narrative acceptance
```

## 15.3 Waiting-list acceptance story

Prove:

1. canonical URL is `club.loftwah.com`;
2. site explains correct premise;
3. waiting-list form works;
4. chapter/location captured;
5. duplicate handled;
6. D1 persistence;
7. welcome email queued/rendered;
8. transient failure retries;
9. unsubscribe works;
10. no fake active paid membership;
11. responsive/accessibility;
12. SEO metadata;
13. private/admin routes protected/not indexed.

## 15.4 Paid-member story

When Stripe exists, prove required alignment/terms, optional-service choices, webhook-authoritative activation, authentication, editable preferences/memory and revocation of future work.

## 15.5 Core event story

Prove verified location, invitation, stable calendar UID, cancellation, archive, counter increment once and no attendance state.

## 15.6 Failure story

Prove cancellation failure is visible, retries, triggers emergency monitor and operator escalation, recovers exactly once and does not duplicate metric.

## 15.7 Birthday story

Prove allowed-fact use, physical/gift/call tasks according to A$50 permissions, operator completion and idempotency. Repeat with calls off and prove no call.

## 15.8 Inbound story

Prove exact variable `RESEND_WEBHOOK_SIGNING_SECRET`, raw-body signature verification, valid acceptance, invalid rejection, duplicate no-op, sender matching and human escalation.

## 15.9 Manufactured commitment story

Prove entitlement, permission, explicit confirmation, reminders, pressure, closure, abort, failure escalation and no dangling scenario.

## 15.9a Agent lease story

Prove lease claim, lease expiry re-availability, repeated failure escalation and exactly-once business effect across agent disappearance (Test 14.24, scenarios A/B/C).

## 15.10 Privacy story

Prove cross-member denial, revocation, protected R2 and terminal deletion.

## 15.11 Completion output

Only report:

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
PASS / manual checks listed

Security:
PASS / manual checks listed

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

If blocked, say `ACCEPTANCE: BLOCKED`, ask the exact question and wait.

---
