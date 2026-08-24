# 20. Provider Verification Snapshot

Snapshot: **2026/08/24 12:43 AEST (UTC+10) / 2026/08/24 02:43 UTC**.

## MiniMax image endpoint (404 root-cause + fix)

The project's direct adapter and the credentialled contract test
previously called `POST /v1/image/generations` against
`https://api.minimax.io/v1` and got a `404 404 page not found`.

Root cause: the canonical MiniMax image endpoint is
`POST /v1/image_generation` (single underscore, no trailing `s`),
not `/v1/image/generations`. The CLI (`mmx`) uses the correct path
(see `~/.cache/npm/global/lib/node_modules/mmx-cli/dist/sdk.mjs`,
`imageEndpoint(baseUrl)`). The auth and text paths (`/v1/models`,
`/v1/chat/completions`) were always correct.

Request body shape used by both the CLI and the corrected adapter:

```json
{ "model": "image-01", "prompt": "…", "aspect_ratio": "1:1", "n": 1 }
```

(Or `{ width, height }` instead of `aspect_ratio` when explicit
dimensions are required.)

Response body shape:

```json
{
  "data": { "image_urls": ["…"] } | { "image_base64": ["…"] },
  "base_resp": { "status_code": 0, "status_msg": "success" },
  "model": "image-01",
  "id": "…"
}
```

Sources of truth:

- `mmx image generate --help` (live CLI)
- mmx-cli SDK source: `imageEndpoint()` returns `${baseUrl}/v1/image_generation`
- Direct adapter: `src/adapters/minimax-real.ts`
- Contract: `scripts/minimax-contract.mjs`

Verified by `mise run contracts:minimax`:
`auth`, `text-generation`, `image-generation`, `error-behaviour` — all PASS.

## Cloudflare

Verified against current official docs:

- local Worker execution using workerd/Miniflare tooling;
- local D1;
- local R2;
- local Queues;
- remote bindings where supported;
- Wrangler configuration for bindings.

References:

- https://developers.cloudflare.com/workers/local-development/
- https://developers.cloudflare.com/workers/local-development/bindings-per-env/
- https://developers.cloudflare.com/d1/best-practices/local-development/
- https://developers.cloudflare.com/queues/configuration/local-development/
- https://developers.cloudflare.com/workers/wrangler/configuration/

## Resend

Verified:

- webhook management API;
- create returns `id` and `signing_secret`;
- raw-body signature verification;
- current Svix-style verification headers in Resend example;
- inbound `email.received` event.

References:

- https://resend.com/changelog/managing-webhooks-via-api
- https://resend.com/features/inbound
- https://resend.com/blog/inbound-emails

## ThreeUI

Verified official current project:

- https://github.com/MengTo/threeui
- package `@designcodeio/threeui`
- documented `npm install @designcodeio/threeui`

Use this, not old unrelated packages named similarly.

## MiniMax

Current references:

- https://www.minimax.io/models/text
- https://platform.minimax.io/docs/api-reference/api-overview
- https://platform.minimax.io/docs/guides/text-generation

Model names evolve; do not couple domain logic to them.

## Stripe

Not enabled. Verify current official docs when implemented.

## iCalendar

Verify RFC/client behaviour at implementation time; do not rely only on remembered syntax.

## MCP

Snapshot: **2026/08/23 (AEST)**.

Current state per official Cloudflare documentation:

- The latest MCP specification, **MCP 2026-07-28**, is **stateless**. It removes the required `Mcp-Session-Id` handshake and the protocol-session round-trip; each request carries the protocol version, client identity and capabilities it needs.
- Cloudflare recommends `createMcpHandler` (Agents SDK v0.20.0+) for new MCP servers. It is a `fetch` handler that runs in an ordinary Worker — no Durable Object, no per-session state.
- The older `McpAgent` class is **deprecated and feature-frozen** as of Agents SDK v0.20.0. New development should target `createMcpHandler`; existing servers keep working but should migrate.
- For a capability surface that is read-or-compute only (which is what `MASTER_SPEC §10.4` describes), `createMcpHandler` is the correct shape and matches the spec's "no microservice sprawl" direction.

Implication for this project: implement the MCP capability surface using `createMcpHandler` on the same Cloudflare Worker that serves the public site, with capability names exactly as listed in `MASTER_SPEC §10.4` and `§10.5`. Forbidden capabilities (`execute_arbitrary_sql`, `dump_all_members`, `write_unvalidated_member_record`, `send_unvalidated_email`) are enforced by capability registration, not by after-the-fact policy.

Re-verify official docs at implementation time; protocol-level details are expected to keep evolving.

## ThreeUI

Snapshot: **2026/08/23 (AEST)**.

The `@designcodeio/threeui` package (v0.3.0, the current stable at install time) bundles some older shader files that import `sRGBEncoding` and `LinearEncoding` from three.js. These constants were removed in three.js r152. With three.js 0.165.0 (the version resolved in the lockfile), Vite emits a build-time warning for every import of those names.

Historical investigation:

- The warnings come from `node_modules/@designcodeio/threeui/lib-dist/shaders/gallery/Gallery.js` and `.../temple-night/templeNightRenderer.js`. They are bundled by the package's main `index.js` barrel.
- None of the individual components in `package-components/` (the public API) import these constants directly. In particular `EngravedCertificate`, `BookshelfScene`, `KageLandingPage`, `BestsellersBookShowcase`, `SylvaHero`, etc. are clean.
- The build succeeds. The current protected bakeoff uses direct component
  subpath imports, so the stale barrel shaders are not part of a public route.

Current decision: ship no ThreeUI scene publicly. Semantic HTML/CSS is the
production winner; `WovenCloth` remains an internal research lead only. If a
future candidate is independently admitted, it must use a direct import and
prove its runtime against the then-current Three.js version. We will:

- either pin a newer three.js / `@designcodeio/threeui` that has been updated for current three.js,
- or work around via a small Vite plugin that aliases the removed constants to the new color-space strings.

We do not pre-emptively patch threeui's dist files (fragile and upstream-hostile).

## Resend contract tests

The credentialled Resend contract test (`scripts/resend-contract.mjs`) verifies against the live Resend API:

1. Authentication — `GET /domains` succeeds with the configured API key.
2. Webhook signature round-trip — the configured signing secret produces a signature that the documented Svix algorithm accepts.
3. Received email metadata shape — `GET /emails/receiving/{id}` returns the documented fields (id/from/to/subject) when `RESEND_EMAIL_ID` identifies a real received message.
4. Received email body shape — the same call returns `html` and/or `text` when that fixture is available.

It is NOT part of the default `mise run acceptance` run. It is invoked via `mise run contracts` when `RESEND_API_KEY` and `RESEND_WEBHOOK_SIGNING_SECRET` are present. Normal acceptance continues to use the `FakeResend` adapter; this script never prints secret values.

Live result on 2026-08-24: authentication and webhook-signature verification
passed. Metadata/body retrieval was **SKIPPED**, not passed, because neither the
environment nor production D1 contained a safe real received-message ID. To
complete it without inventing evidence, receive a controlled message through
the configured Resend inbound route, set `RESEND_EMAIL_ID` to that message ID,
then run `mise run contracts` and retain the redacted PASS output.
