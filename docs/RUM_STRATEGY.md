# Real-user performance measurement strategy — Plans With You

> **Decision:** no browser telemetry is shipped by this programme. A RUM
> provider, beacon, custom endpoint or analytics event requires an explicit
> consent, privacy and legal decision first. The site must remain useful when
> JavaScript, cookies and measurement are unavailable.

## Why this is staged

Plans With You serves correspondence and membership information, including
protected member and operator surfaces. A performance measurement tool can be
privacy-conscious without being automatically approved for this product. The
current priority is to make the site fast and prove it with local and browser
checks; measurement comes after its data flow, scope and retention are agreed.

The initial baseline is therefore:

- `pnpm perf:budget` for deterministic build output;
- Playwright mobile/desktop checks, including reduced motion and accessibility;
- browser performance entries during local and pre-release smoke checks;
- Cloudflare Worker request/error metrics in the operator dashboard, without
  adding member-level product events.

## Cloudflare option, pending approval

Cloudflare Web Analytics is the preferred candidate for a later public-route
RUM trial because Cloudflare documents it as privacy-first and says its Web
Analytics product does not collect or use visitors' personal data. The RUM
beacon is based on browser Performance APIs and reports Core Web Vitals. The
beacon documentation also says it does not use cookies, localStorage,
sessionStorage, IP address or IndexedDB in the browser.

Those statements do not remove the need for a product/legal review. Cloudflare
documents that the service receives normal HTTP source-IP information and
discards it at the nearest edge, and that the beacon can include referrer,
landing path and navigation/resource timing. The team must confirm processor
terms, Australian Privacy Act obligations, any EU/UK handling, region and
retention expectations, CSP changes, and the wording/placement of notice or
consent before enabling it.

Primary Cloudflare references (checked 24 August 2026):

- [Cloudflare Web Analytics overview](https://developers.cloudflare.com/web-analytics/about/)
- [RUM beacon and privacy information](https://developers.cloudflare.com/speed/observatory/rum-beacon/)
- [Web Analytics data origin and collection](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/)
- [Web Analytics setup and disable options](https://developers.cloudflare.com/web-analytics/get-started/)
- [Cloudflare Web Analytics rules](https://developers.cloudflare.com/web-analytics/configuration-options/rules/)
- [Workers metrics and Analytics Engine](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)

## Proposed gates and rollout

### Stage 0 — now: no collection

Keep the build checker and browser checks as the release gates. Do not add a
beacon script, third-party analytics dependency, `sendBeacon` call or RUM
endpoint. Do not place performance data in D1, R2, AI memory, audit logs or
member records.

### Stage 1 — operator visibility

Use Cloudflare's aggregate Worker metrics for request counts, success/error
rates and runtime health. Keep those metrics at the infrastructure level. Do
not build custom member or campaign tracking on top of them. The operator can
compare deploy timestamps with the performance budget and smoke-test results.

### Stage 2 — public-only RUM trial, if approved

After an explicit decision, enable Cloudflare Web Analytics only for public
routes such as `/`, `/how-it-works`, `/membership`, `/chapters`, `/journal`,
`/correspondence` and `/faq`. Prefer manual installation with a reviewed
snippet so the consent and route scope are visible in the repository. Do not
enable automatic edge injection until the same review approves it.

Never measure `/portal`, `/admin`, onboarding, magic-link pages, API routes,
or pages containing member-specific data. Do not include email addresses,
member IDs, invitation tokens, form values or free-form correspondence in any
URL or custom dimension. Keep query strings out of measurement. If consent is
required for a visitor, no beacon is requested before consent; refusal must
not block navigation, forms or the waiting list.

The review record must name the data controller/processor roles, purpose,
lawful basis or consent path, notice copy, retention, access, deletion/subject
rights process, regional handling, CSP allowlist and an owner for disabling the
beacon. Revoke the beacon quickly if the provider contract, policy or scope
changes.

### Stage 3 — custom metrics only if necessary

If aggregate Web Analytics cannot answer a genuine performance question,
consider a narrowly scoped Cloudflare Analytics Engine dataset. Cloudflare
documents non-blocking writes and custom/high-cardinality dimensions, but that
power creates a larger data-governance surface. A custom dataset needs its own
schema, retention, access controls, route allowlist, redaction tests and legal
approval. It must never become a second member-truth store or an AI memory.

## What to monitor

For approved public RUM, use the same field targets as
[the performance budgets](./PERFORMANCE_BUDGETS.md): LCP ≤2.5s, INP ≤200ms,
CLS ≤0.10, TTFB ≤800ms and FCP ≤1.8s. Review p75 by route, viewport class and
release window; investigate sustained misses rather than reacting to a single
visitor. Keep route names coarse and allowlisted. Report only aggregate
performance findings in release notes and do not infer member facts from
traffic or engagement.

The absence of RUM data is not evidence that a member did or did not engage.
That distinction is part of the product invariants and must remain true in
dashboards, AI prompts and operator decisions.
