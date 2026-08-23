# 12. Security, Privacy, Legal and Safety

## 12.1 Member memory UI

Provide:

> **What the Society remembers about me**

Member can view, edit, remove, add, mark do-not-use and understand source.

## 12.2 Data minimisation

Do not gather data with no product purpose. Do not silently enrich members from social media/public data.

## 12.3 Sensitive information

Do not infer sensitive personal categories for personalisation. Voluntary sensitive disclosures require conservative handling.

## 12.4 Member auth

Magic-link/opaque-token flow is suitable:

- short-lived;
- single-use;
- hashed token at rest;
- secure HttpOnly session;
- replay prevention;
- revocation.

Do not add JWT secrets without need.

## 12.5 Admin auth

Must be stronger. Cloudflare Access is a possible option but not locked.

## 12.6 Object-level authorisation

Member A cannot read Member B profile, address, letter, R2 artefact, timeline, gifts or calls.

## 12.7 Webhooks

Verify signature before business processing. Dedupe provider event ID.

## 12.8 Inputs

Protect against XSS, SQL injection, path traversal, malicious email HTML, oversized requests, attachment abuse and prompt injection.

## 12.9 Secrets

Never commit real `.env`, expose provider keys to browser, put secrets into AI context or log complete secrets.

## 12.10 Legal acceptance

Version exact documents. Engineering preserves evidence; engineering does not replace legal advice.

Before real paid launch, obtain appropriate Australian-facing legal review, particularly subscription/refund/privacy/appearance terms.

## 12.11 Consumer rights

Do not assume customers can “sign away everything”. Use clear expectations, explicit consent and appropriate legal language.

## 12.12 Appearance-service disallowed directions

Do not support requests intended to impersonate specific real people without appropriate permission, authorities, medical/professional credentials, financial fraud, evidence fabrication, coercion, harassment/stalking, legal/immigration interference or illegal activity.

Ambiguous requests require human review.

## 12.13 Manufactured commitment safety

No threats, dangerous urgency or pretending somebody is actually travelling. Member can abort.

## 12.14 Deletion

Stop future personalisation/actions immediately, then delete according to retention policy, with terminal `DELETED` state.

## 12.15 Export

Support reasonable member data export.

---
