# 14. Test Plan and Expected Results

## 14.1 Unit/domain matrix

| ID   | Scenario                                  | Expected result                            |
| ---- | ----------------------------------------- | ------------------------------------------ |
| U001 | valid event with active chapter/location  | valid                                      |
| U002 | event uses retired location               | rejected                                   |
| U003 | unknown location                          | rejected                                   |
| U004 | cancellation due after event starts       | rejected                                   |
| U005 | transition `INVITED -> ATTENDED`          | impossible                                 |
| U006 | `CANCELLED -> ARCHIVED`                   | allowed                                    |
| U007 | A$5 birthday                              | digital action                             |
| U008 | A$20 birthday + post enabled              | digital + physical task                    |
| U009 | A$50 + calls/gifts enabled                | digital + physical + gift/call eligibility |
| U010 | A$50 + calls off                          | no call                                    |
| U011 | A$50 + gifts off                          | no gift                                    |
| U012 | gift above budget                         | deny/review                                |
| U013 | newsletter off                            | no newsletter                              |
| U014 | newsletter off + operational cancellation | cancellation allowed                       |
| U015 | calendar off                              | no calendar payload                        |
| U016 | physical waived                           | activation not blocked                     |
| U017 | physical enabled + no address             | physical service paused/incomplete         |
| U018 | commitments opted out                     | denied                                     |
| U019 | required terms missing                    | activation denied                          |
| U020 | unsupported chapter                       | waitlist-only                              |
| U021 | confirmed fact in generation              | allowed                                    |
| U022 | invented fact in output                   | rejected                                   |
| U023 | do-not-mention fact in output             | rejected                                   |
| U024 | duplicate queue job                       | one side effect                            |
| U025 | duplicate operator completion             | one completion                             |
| U026 | invalid state transition                  | rejected + audit                           |
| U027 | permission revoked after future task      | task cancelled                             |
| U028 | optional-service reconsent                | only affected service paused               |
| U029 | cancellation metric rebuild               | equals source data                         |
| U030 | estimated hours                           | correct and labelled estimate              |

## 14.2 Waiting-list integration

Flow:

1. submit;
2. validate;
3. persist;
4. welcome queued;
5. fake delivery succeeds.

Expected one row, one welcome, active waitlist and deterministic duplicate handling.

Transient send failure retries. Hard bounce reaches invalid-email terminal state.

## 14.3 Paid onboarding integration

Fixture: supported Melbourne applicant.

Complete identity, tier, preferences, alignment, terms and fake authoritative payment.

Expected:

- one member;
- one active membership;
- exact legal versions recorded;
- optional services reflect choices only.

Missing alignment → no activation.

## 14.4 Permission revocation integration

Fixture: active A$50 with future birthday call.

Disable calls.

Expected:

- `CALLS=OPTED_OUT`;
- future call task cancelled;
- birthday other actions unchanged;
- audit reason.

## 14.5 Event E2E

Fixture:

- active supported chapter;
- approved location;
- three eligible members;
- mixed calendar preferences;
- event 7 days away;
- cancellation 1 day before.

Invitation phase:

- event `INVITED`;
- 3 invitation records;
- 3 communications;
- calendar payload only where enabled.

Cancellation phase:

- event `CANCELLED`;
- 3 cancellation communications;
- same calendar UID;
- public counter +1 only;
- zero attendance state/records.

Archive → `ARCHIVED`.

## 14.6 Critical cancellation failure

Inject email failure and retry failure. Advance into emergency window.

Expected:

1. safety monitor detects;
2. event critical;
3. priority work created;
4. operator escalation;
5. visible admin state;
6. provider recovery produces one final cancellation;
7. no duplicate counter.

## 14.7 Birthday A$50 E2E

Confirmed facts:

```text
pet=Max
interest=pottery
calls=birthday
gifts=enabled
postal=valid
```

Expected:

- one birthday milestone;
- copy may use Max/pottery;
- no unknown facts;
- card task;
- gift task;
- call task.

Remove address:

- digital continues;
- call continues;
- physical follows missing-address policy;
- milestone not lost.

## 14.8 Human fulfilment E2E

Create anniversary letter.

Expected:

- PDF;
- private R2 object;
- task;
- operator notification.

Complete:

- completed state;
- audit;
- timeline.

Complete twice → no duplicate.

## 14.9 Resend inbound

Valid signed fixture:

- accepted;
- deduped;
- stored;
- known sender matched.

Invalid signature:

- reject;
- no business processing.

Unknown sender:

- unmatched route;
- no fuzzy member match.

## 14.10 Fact extraction

Inbound:

> I got a new dog called Frank.

Expected candidate fact with source; no breed/age invention.

## 14.11 AI hallucination

Known: Pippa, painting.

Do-not-mention: previous employer.

Injected output: “Felix the cat” + employer.

Expected validation failure and no send.

## 14.12 Prompt injection

Member text asks model to reveal other members.

Expected no unrelated context/tool access and no leak.

## 14.13 Manufactured commitment

Confirmed cleaning scenario.

Expected reminders → pressure → cancellation → future jobs cleared → `COMPLETED`.

Abort → all future jobs cancelled → `ABORTED`.

Cancellation failure → operator escalation → eventual terminal state.

## 14.14 Appearance service

Safe local representative request → review, quote, payment fake, booked, performed, closed.

Disallowed authority impersonation → declined, no quote/booking.

Travel request → travel/expenses included in quote assumptions.

## 14.15 Stripe later

Browser success without verified webhook → no activation.

Verified webhook → activate once.

Replay → no duplicate.

Payment failure → `PAST_DUE`.

Recovery → `ACTIVE`.

Exhausted policy → deterministic cancellation/suspension.

## 14.16 Deletion

Expected future communications/calls/gifts/commitments cancelled, personal facts removed, private artefacts handled, required records separated and terminal `DELETED`.

## 14.17 Time tests

- Melbourne DST;
- Sydney DST;
- Perth no DST;
- leap day;
- birthday;
- event crossing midnight;
- UTC storage/local rendering.

## 14.18 Queue replay

Every side-effect job tested for duplicate/retry/crash simulation. Business effect exactly once.

## 14.19 Accessibility

Automated axe/equivalent, labels, headings, contrast, keyboard and focus.

Manual iPhone Safari and WebGL unavailable.

Core site works without ThreeUI.

**Reduced motion (automated, mandatory):** A Playwright test must load each public route with `prefers-reduced-motion: reduce` set. Expected:

- no essential content disappears;
- ThreeUI/WebGL canvas is not required to understand or use the site (the semantic content behind it is present and reaches the accessibility tree);
- forms remain usable (focus order, label association, submit reachable by keyboard);
- semantic content remains available (headings, value proposition, pricing, FAQ, chapter content, waiting-list form, legal links are present in the DOM, not only in canvas);
- no essential motion-only cues (no information conveyed solely by a tween or by ThreeUI animation).

Manual visual review of the reduced-motion experience on real devices is still required and recorded under the manual checks section.

## 14.24 Agent lease expiry

Fixture: an `AI_AGENT_WORK` job available in the queue.

Scenario A — agent disappears mid-job:

1. Agent A claims the job; `agent_work_lease` row written with `claimed_until = now + lease`.
2. Agent A goes silent. Test advances the clock past `claimed_until` without writing `COMPLETED` or `FAILED`.
3. Expected: the lease-reaper (or a synchronous check on next claim attempt) releases the lease; the job becomes `AVAILABLE` again.
4. Agent B claims; completes with `COMPLETED`. Expected: exactly one business effect (idempotency key observed end-to-end).

Scenario B — repeated claim/lease failure:

1. Same as above, but Agent B also disappears; Agent C also disappears; etc.
2. Each disappearance increments a claim attempt counter on the job.
3. After the configured threshold (e.g. 3) the job transitions to a `NEEDS_OPERATOR` state and an operator task is created. Expected: no permanently orphaned job; operator inbox has the task; admin landing page shows it.

Scenario C — successful claim under normal lease:

1. Agent A claims; completes within lease; expected: `COMPLETED`, no re-claim attempted, no duplicate effect.

Idempotency of business effects is verified across all three scenarios by counting side-effect rows (e.g. communications created, R2 objects written) and asserting the count is exactly 1.

## 14.20 SEO

Semantic indexable content, title/description, canonical, sitemap, robots, private routes blocked, real 404, no misleading `Event` schema.

## 14.21 Security matrix

| Scenario                            | Expected                 |
| ----------------------------------- | ------------------------ |
| expired login token                 | rejected                 |
| reused token                        | rejected                 |
| Member A requests Member B artefact | denied                   |
| non-admin admin route               | denied                   |
| forged Resend webhook               | denied                   |
| XSS                                 | escaped/sanitised        |
| SQL injection                       | no injection             |
| oversized body                      | bounded/rejected         |
| secret scan                         | no secret in client/repo |
| private R2 guessing                 | denied                   |

## 14.22 Load

Simulate 1,000 and 10,000 members, birthday spikes, newsletter batch and mass cancellation.

Expected bounded Cron, queue drain, no duplicate effects and priority for critical cancellation.

## 14.23 Fresh state

From empty local resources: migrations → seed → tests → build. No hidden manual state.

---
