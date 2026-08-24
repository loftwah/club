# Security review

Reviewed: 2026-08-24  
Scope: Worker route boundaries, inbound-email adapter, Creative Library/R2 publishing, production dependencies, and local secret hygiene.

## Disposition

All release-blocking findings are remediated and covered by focused checks.

| Severity | Finding                                                                                                                        | Resolution                                                                                                                                                                                                                                       | Evidence                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Critical | Percent-encoded `/admin` and `/internal` paths could reach Astro after bypassing the middleware's literal pathname checks.     | Middleware now repeatedly decodes and conservatively normalises path separators and dot segments before applying fail-closed operator gates. Malformed, residual-encoded, or control-character paths return 400.                                 | Browser cases cover `%61dmin`, `%2561dmin`, and `%69nternal`; all pass under workerd.                                        |
| High     | Astro 5 and production transitive packages had published high-severity advisories.                                             | Migrated to Astro 7 and the current Cloudflare/React adapters, including the direct `cloudflare:workers` binding API.                                                                                                                            | `pnpm audit --prod`: 0 critical, high, moderate, low, or informational findings across 492 production/optional dependencies. |
| High     | R2 publishing trusted a broad environment and unchecked local paths.                                                           | Publisher requires the exact account R2 HTTPS endpoint, passes a minimal child-process environment, rejects symlinks/non-canonical files, and verifies every artifact against the render manifest hash.                                          | Video pipeline unit tests plus source review.                                                                                |
| High     | Video approval could be asserted by an unrelated or stale review file.                                                         | Approval requires review pass 2, exact source fingerprint, all four reviewed asset IDs, and an explicit `Decision: APPROVED`.                                                                                                                    | Approval parser unit tests and fail-closed CLI validation.                                                                   |
| Medium   | Provider-supplied Resend attachment URLs created a latent SSRF and unbounded-memory path if attachment retrieval were enabled. | Attachment downloads are restricted to explicitly allowlisted HTTPS origins, credentials and redirects are rejected, a 15-second timeout is applied, and a 25 MiB limit is enforced before and after decoding. Cross-origin rejection is tested. | `tests/unit/resend-real-security.test.ts`.                                                                                   |
| Medium   | Public responses lacked a consistent browser-security baseline.                                                                | Middleware now applies CSP framing/object/form restrictions, Permissions Policy, strict referrer policy, MIME sniffing protection, and legacy frame denial.                                                                                      | Browser header assertion passes under workerd.                                                                               |
| Low      | Local `.env` permissions allowed group/world reads.                                                                            | Mode changed to owner read/write only (`0600`). The file remains ignored and is never bundled intentionally.                                                                                                                                     | Local file-mode check.                                                                                                       |

## Boundaries retained

- Operator and internal surfaces remain private and `no-store`; loopback-only laboratories stay convenient locally.
- The Worker receives only declared Cloudflare bindings and configured runtime secrets. The ElevenLabs key is generation-time only and has no application reference.
- Resend continues to verify the raw Svix body with `RESEND_WEBHOOK_SIGNING_SECRET`; no incorrect `RESEND_WEBHOOK_SECRET` alias exists.
- D1 remains the source of truth. No review action introduced direct AI database writes or weakened member ownership checks.

## Residual operational notes

- A future Resend attachment rollout must first verify and explicitly add the provider's current download origin; cross-origin URLs fail closed by design.
- CSP is deliberately a baseline policy rather than a script/style nonce rollout. Tightening `script-src`, `style-src`, and connection destinations should be handled as a separately tested change.
- Production verification must repeat the encoded-route probes and header checks after deployment.
