# 8. Functions and Mechanisms

## 8.1 Central policy engine

Concept:

```ts
type PolicyDecision = {
  allowed: boolean
  reason: string
  evidence: string[]
}

canPerform(memberId, capability, context): PolicyDecision
```

Inputs:

- membership state;
- tier entitlement;
- service grant;
- explicit preference;
- current consent;
- prerequisites;
- budget;
- safety rule;
- state transition;
- idempotency/duplicate status.

AI cannot override this result.

## 8.2 Entitlements

Bad:

```ts
if (price === 50) enableCalls();
```

Good:

```text
entitlement(tier_id, CALLS)
```

## 8.3 Activation evaluator pseudocode

```text
evaluateActivation(application):
  if unsupported chapter:
      return WAITLIST_ONLY

  blockers = missing identity/tier/preferences/alignment/consent/terms/payment

  if blockers:
      return ONBOARDING_INCOMPLETE(blockers)

  return READY_TO_ACTIVATE
```

## 8.4 Scheduled work

```text
scheduled(now):
  page birthdays due
  page anniversaries due
  page invitations due
  page reminders due
  page cancellations due
  page event safety checks
  page overdue fulfilment
  page chapter maintenance
  enqueue bounded jobs
```

## 8.5 Job envelope

```text
job_id
type
entity
payload_version
attempt
idempotency_key
priority
available_at
```

## 8.6 Member context

```text
buildMemberContext(member, purpose):
  minimum identity
  relevant preferences
  permitted confirmed facts
  restrictions/do-not-mention
  small relevant timeline slice
  prior related correspondence if needed
  no unrelated members
```

## 8.7 Location knowledge base

Store:

- canonical name;
- chapter;
- suburb/area;
- address where appropriate;
- source/URL;
- type;
- tags;
- verification date;
- status.

Status:

```text
ACTIVE
REVERIFY_DUE
STALE
RETIRED
```

Event generation cannot use retired locations.

## 8.8 Location research

```text
AI discovers candidate
→ verify source/status/address
→ normalise
→ tag
→ review/confidence
→ ACTIVE
```

Do not let a model hallucinate local geography as durable truth.

## 8.9 Event proposal

Inputs:

- chapter;
- approved locations;
- member preference cohort;
- season/date range;
- recent event history;
- diversity rules;
- brand voice.

Structured output example:

```json
{
  "title": "...",
  "chapterId": "...",
  "eventType": "gallery",
  "startAt": "...",
  "durationMinutes": 120,
  "cancellationDueAt": "...",
  "locationIds": ["..."],
  "description": "...",
  "dressGuidance": null,
  "claims": []
}
```

Validate locations, dates, cancellation safety, geography, claims, schema and no attendance requirement.

Invalid output retries a bounded number, then human review or abandon.

## 8.10 Invitation

```text
scheduled event
→ eligible members
→ preference/policy check
→ invitation record
→ correspondence
→ calendar payload if opted in
→ queue send
```

No RSVP required.

## 8.11 Cancellation

```text
cancellation due
→ validate state
→ CANCELLATION_QUEUED
→ generate or choose deterministic content
→ validate
→ queue email/calendar cancellation
→ CANCELLED at defined authoritative point
→ record recipient outcomes
→ update derived metrics
→ archive later
```

## 8.12 Cancellation does not depend on AI

If MiniMax unavailable, use deterministic safe cancellation content. Core cancellation must continue.

## 8.13 Event safety monitor

```text
for events inside emergency window:
  if not safely cancelled:
      mark CRITICAL
      enqueue priority cancellation
      notify human operator
```

## 8.14 Public cancellation counter

Derived from real D1 records. Cache allowed only if rebuildable.

Estimated attendance hours avoided can be:

```text
SUM(event duration × real invited member count)
```

Label as estimate.

## 8.15 Birthday

```text
birthday due
→ idempotent milestone
→ policy per tier/preferences
→ independent actions
```

A$5: digital.

A$20: digital + physical task if permitted.

A$50: digital + physical + gift eligibility + call eligibility.

One failed channel must not erase the whole milestone.

## 8.16 Human fulfilment

```text
create task
→ render artefact
→ store private R2
→ operator email/admin
→ acknowledge
→ complete/reschedule/block/cancel
→ audit
→ member timeline
```

Completion is idempotent.

## 8.17 Gift

```text
occasion
→ entitlement
→ member permission
→ exclusions
→ budget
→ history
→ AI suggestions
→ human approval
→ purchase
→ dispatch
→ outcome
```

AI should not independently make expensive purchases.

## 8.18 Call briefing

Include only:

- member identity;
- tenure;
- purpose;
- relevant confirmed facts;
- related prior contact;
- do-not-mention;
- allowed time window.

## 8.19 Member fact extraction

Example:

> I got a new dog called Frank.

AI may propose:

```text
category=pet
subject=Frank
value=dog
source=inbound message
```

Do not infer breed/age.

Whether simple explicit verified-member statements auto-confirm is deterministic policy, not model judgement.

## 8.20 Correspondence validation

Before send validate:

- allowed facts;
- do-not-mention;
- correct member/event;
- no fake partnership;
- channel permission;
- legal/footer requirements;
- no attendance implication.

## 8.21 Manufactured commitment mechanism

```text
request
→ goal
→ proposed scenario
→ explicit confirm
→ schedule reminders
→ pressure window
→ cancellation/closure
→ clear all future jobs
→ COMPLETED
```

Abort stops future work and closes scenario.

Automatic closure failure creates critical human task.

## 8.22 Appearance service mechanism

```text
request
→ suitability
→ role/boundaries
→ location/travel
→ quote
→ acceptance
→ payment
→ briefing
→ perform/cancel
→ closure/refund
```

## 8.23 Deletion

Immediately suspend future personalisation/communications before asynchronous deletion proceeds.

## 8.24 Operator digest

Include:

- birthdays;
- anniversaries;
- letters/cards;
- gifts;
- calls;
- appearance enquiries;
- inbound review;
- critical failures;
- overdue work.

If none: **No intervention required.**

## 8.25 Agent work lease

```text
AVAILABLE
→ CLAIMED until expiry
→ COMPLETED | FAILED
```

Agent disappears → lease expires → job available again.

---
