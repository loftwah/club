# 20. Provider Verification Snapshot

Snapshot: **2026/08/23 15:16 AEST (UTC+10) / 2026/08/23 05:16 UTC**.

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

Investigation:

- The warnings come from `node_modules/@designcodeio/threeui/lib-dist/shaders/gallery/Gallery.js` and `.../temple-night/templeNightRenderer.js`. They are bundled by the package's main `index.js` barrel.
- None of the individual components in `package-components/` (the public API) import these constants directly. In particular `EngravedCertificate`, `BookshelfScene`, `KageLandingPage`, `BestsellersBookShowcase`, `SylvaHero`, etc. are clean.
- The build succeeds; the warnings are build-time noise. The components we use (the `SocietySeal` island, based on the `EngravedCertificate` family) do not exercise the offending code paths at runtime.

Decision (Phase 1): ship the current ThreeUI version with the build-time warnings noted. The warnings are non-blocking in practice. If we later use a ThreeUI component that does exercise the broken shader files at runtime, we will:

- either pin a newer three.js / `@designcodeio/threeui` that has been updated for current three.js,
- or work around via a small Vite plugin that aliases the removed constants to the new color-space strings.

We do not pre-emptively patch threeui's dist files (fragile and upstream-hostile).

## Resend contract tests

The credentialled Resend contract test (`scripts/resend-contract.mjs`) verifies against the live Resend API:

1. Authentication — `GET /domains` succeeds with the configured API key.
2. Webhook signature round-trip — the configured signing secret produces a signature that the documented Svix algorithm accepts.
3. Received email metadata shape — `GET /emails/receiving/{id}` returns the documented fields (id/from/to/subject).
4. Received email body shape — same call returns `html` and/or `text`.

It is NOT part of the default `mise run acceptance` run. It is invoked via `mise run contracts` when `RESEND_API_KEY` and `RESEND_WEBHOOK_SIGNING_SECRET` are present. Normal acceptance continues to use the `FakeResend` adapter; this script never prints secret values.
