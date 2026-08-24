# Operator Runbook — Plans With You

> **Version:** 0.9 · 2026-08-24
> **Audience:** the operator (Dean Lofts, in the current build) and any
> future operator responsible for day-to-day running of the membership.
> **Status:** production-ready. This runbook assumes the system is
> deployed and that the canonical acceptance (`mise run acceptance`)
> is green.

This runbook covers the small, ordinary failures and the small,
extraordinary ones. It is not exhaustive. When in doubt, slow down,
look at the data, and act.

---

## 1. Normal daily operation

Every weekday morning, the operator should:

1. Open `/admin/` — "What needs my attention?"
2. Triage anything in the **Today** list.
3. If nothing is listed, the page will say "No intervention required."
   That is the expected default state.
4. Open `/admin/operations/` for the full operations digest.
5. Skim the System counts: dangerous events, retried emails, overdue
   fulfilments, dead-letter jobs, inbound review.

**Healthy state:** all system counts zero or low, "Today" empty or
showing only routine items.

**Schedule:** 5–10 minutes on most days. The cadence is set by the
operator's appetite, not by the system.

---

## 2. Email failure

Symptoms:

- "Retried emails" count above 0 on `/admin/`.
- Members report not receiving an expected letter.
- A Resend webhook log entry shows a `email.bounced`,
  `email.complained`, or `email.failed` event.

What to do:

1. Open `/admin/operations/` and read the retried-email list.
2. Open the Resend dashboard at
   <https://resend.com/emails> and locate the failed send.
3. Identify the failure reason:
   - **Hard bounce** — invalid address. Pause the member's outbound
     mail and ask the member for a corrected address.
   - **Soft bounce** — temporary failure (mailbox full, server
     unavailable). The system will retry. If it has retried past
     the threshold, the job moves to DEAD_LETTER. Open
     `/admin/tasks/` and either retry or cancel the dead-letter job.
   - **Spam complaint** — pause the member's newsletter and any
     promotional sends. Do not mark the membership as cancelled.
4. Record the outcome in the member's audit log via the portal
   (the operator can append notes on behalf of the member).

Do not retry a hard bounce.

---

## 3. MiniMax outage

Symptoms:

- The MiniMax contract test (`mise run contracts:minimax`) reports
  failure.
- AI-generated letters are not producing output.
- The correspondence validator is rejecting letters because the
  upstream text generation is failing.

What to do:

1. Run `mise run contracts:minimax` to confirm the outage.
2. Inspect the MiniMax status page or your own dashboard. If the
   MiniMax API is down, queued personalisation jobs will fail.
3. The system is designed to **fall back** to deterministic templates
   for cancellations. Personal invitations and birthdays that depend
   on AI text will queue, fail, and surface in dead-letter.
4. Triage `/admin/tasks/` and either:
   - Wait for the outage to clear (the job queue retries
     automatically), or
   - For each queued AI letter, manually draft a deterministic
     version and queue it directly.
5. Do not invent facts. Use only the member's confirmed facts.

When the outage is over, run `mise run contracts:minimax` again. The
queue resumes automatically.

---

## 4. Cancellation emergency

The cancellation emergency state is the most serious state in the
system. It means an event's scheduled start is approaching and the
authoritative cancellation has not been sent.

Symptoms:

- "Dangerous uncancelled events" count above 0 on `/admin/`.
- An email subject line starting with `[CRITICAL: cancellation
overdue]`.

What to do:

1. Open `/admin/operations/` and click the dangerous event.
2. Read the event details. The deterministic cancellation copy is
   already prepared. The action link in the critical operator email
   sends it.
3. Click the action link. The cancellation sends immediately.
4. Confirm the cancellation log entry appears in the audit log.
5. If the action link fails (provider outage), manually send the
   cancellation from `/admin/events/` using the prepared copy. The
   system will retry the calendar update asynchronously.

This must be resolved before the event's scheduled start. The system
will not let the event go live without an authoritative cancellation.

---

## 5. Overdue physical task

Symptoms:

- A fulfilment task in the **POSTAL** or **GIFT** channel has
  passed its deadline and the state is not COMPLETED.

What to do:

1. Open `/admin/tasks/` and locate the overdue task.
2. Check the context: which member, which occasion, what was the
   budget.
3. If the task is still in scope, perform it or delegate it.
4. If the task is no longer in scope (e.g. a birthday that has
   passed), mark it CANCELLED with a reason.
5. Audit log entries are written automatically.

---

## 6. Bounced member email

Covered in section 2. The difference: this is the inbound side
rather than the outbound side.

Symptoms:

- An inbound message in `/admin/inbound/` is marked FAILED or
  UNKNOWN_SENDER.

What to do:

1. Read the message.
2. If the sender is a known member but the email address is new,
   reconcile the address on the member record.
3. If the sender is unknown, store the message in the inbound
   review queue and decide whether to follow up.

---

## 7. Gift issue

Symptoms:

- A gift task in `/admin/tasks/` is in RETRY or DEAD_LETTER.
- The member reports a problem with a gift.

What to do:

1. Open the task and read the AI suggestion, the budget, and the
   occasion.
2. If the gift has already been sent, contact the member
   (correspondence channel) to acknowledge and offer a replacement
   or refund.
3. If the gift has not been sent, cancel the original task and
   re-issue with a different suggestion.
4. Record the resolution in the audit log.

---

## 8. Call issue

Symptoms:

- A call task in `/admin/tasks/` is overdue or the member has
  reported a problem.

What to do:

1. If the call has already happened, contact the member (email) to
   acknowledge and, if appropriate, schedule a follow-up call.
2. If the call has not happened, reschedule within the member's
   specified window.
3. If the member has revoked call consent, mark the call service
   grant as OPTED_OUT and cancel any future scheduled calls.

---

## 9. Inbound member concern

Symptoms:

- An inbound message marked CLASSIFIED or HUMAN_REVIEW.

What to do:

1. Read the message and the classification reason.
2. Reply by email from the operator inbox.
3. If the message is a complaint, escalate to a private thread
   and follow up by phone (if calls are enabled) or by letter (if
   physical correspondence is enabled).
4. Record the resolution.

---

## 10. Privacy request

A privacy request is a member exercising their right to access,
correct, or delete their personal information.

What to do:

1. Verify the requester is the member (reply to the email on file
   or use the magic-link sign-in flow).
2. For an access request: generate a JSON export from the member
   portal and email it securely.
3. For a correction request: update the relevant fact via the
   portal, with audit log.
4. For a deletion request: confirm the request via the
   double-confirmation email, then trigger the data-removal
   workflow from `/portal/account/delete/`.
5. Required records (financial) are kept for the minimum period
   required by law.

---

## 11. Deletion

A deletion request removes the member's personal data subject to
legitimate retention requirements.

What to do:

1. Confirm the request via the double-confirmation email.
2. The data-removal workflow:
   - Marks the membership as CANCELLED.
   - Removes confirmed facts.
   - Removes correspondence content (kept as a record-of-send
     entry, with content redacted).
   - Removes postal address.
   - Removes service grants.
   - Retains financial records for the minimum period required by
     law.
3. Send a confirmation email when the workflow completes.

---

## 12. Stripe issue (later)

When Stripe is enabled, expect:

- Failed payments → membership moves to PAST_DUE.
- Disputes → operator notification, escalated to a private thread.
- Refunds → operator action via Stripe dashboard, with audit log
  entry.

The current build uses fake billing. Do not enable real Stripe
without explicit user authorisation.

---

## 13. Provider secret rotation

The following secrets are bound to the Worker environment:

- `RESEND_API_KEY` — rotate via the Resend dashboard. Update the
  secret binding. Run `mise run contracts` to confirm the new key.
- `RESEND_WEBHOOK_SIGNING_SECRET` — rotate via the Resend webhook
  settings. The previous secret continues to be accepted for a
  grace period; update the binding during that window.
- `MINIMAX_API_KEY` — rotate via the MiniMax dashboard. Update
  the secret binding. Run `mise run contracts:minimax` to confirm.
- `CF_API_TOKEN`, `CF_ACCESS_KEY_ID`, `CF_SECRET_ACCESS_KEY` —
  rotate via the Cloudflare dashboard.

After any rotation, run:

```sh
mise run acceptance
mise run contracts
mise run contracts:minimax
```

All three must be green before the rotation is considered
complete.

---

## 14. Deployment rollback

Deployment is via Wrangler. Each environment has a stable version
in Cloudflare. To roll back:

1. Open the Cloudflare dashboard → Workers → the Worker.
2. Locate the previous deployment.
3. Promote it to active.
4. Run the smoke test script:
   - `curl https://club.loftwah.com/` returns 200.
   - `curl https://club.loftwah.com/api/mcp -X POST -H
'content-type: application/json' -d
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'`
     returns 401. Authenticated operator access is tested separately and must
     never be replaced by an anonymous smoke request.
5. Run `mise run contracts` and `mise run contracts:minimax` from
   the operator machine to confirm the live providers are still
   working.
6. Notify the user that the rollback has been performed.

---

## 15. Daily checklist

A copy of this is at the top of `/admin/`. Use it.

- [ ] Open `/admin/`. "What needs my attention?" — triage any
      items.
- [ ] Open `/admin/operations/`. Skim the system counts.
- [ ] Open `/admin/inbound/`. Triage any messages in HUMAN_REVIEW.
- [ ] Open `/admin/tasks/`. Triage any RETRY or DEAD_LETTER.
- [ ] Skim `/admin/events/`. Confirm no dangerous uncancelled
      events.
- [ ] If anything is in any danger state, address it before
      closing the day.
