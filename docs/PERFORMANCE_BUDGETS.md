# Performance budgets — Plans With You

> **Status:** enforced locally by `pnpm perf:budget`; production telemetry is
> intentionally not enabled. These are guardrails for a calm, correspondence-
> led public site, not a reason to remove useful content from the member
> experience.

## The budgets

`KB` in the checker means KiB (1,024 bytes). Compression figures are measured
from a fresh `dist` directory after the production build.

| Surface                         |                            Aim |                                               Hard limit | Measurement                                                                                                                                               |
| ------------------------------- | -----------------------------: | -------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public route initial JavaScript |                `<100 KiB` gzip |                                           `150 KiB` gzip | Static HTML `<script>` entries plus their static-import closure; supported JSON route manifests are also accepted.                                        |
| Optional signature interaction  | Keep the smallest useful chunk |                                           `500 KiB` gzip | Every client JavaScript asset, including a dynamically loaded signature scene, is checked individually.                                                   |
| Mobile initial transfer         |                   `<1,000 KiB` |                               No automatic hard fail yet | Route entry assets when a static HTML/manifest entry exists. Text uses gzip; images/fonts use raw bytes. Validate on a real mobile profile before launch. |
| One viewport image candidate    |                 `≤350 KiB` raw | Warning by default; `--strict-images` makes it a failure | Each built image file. The implementation should prefer responsive `srcset`/`<picture>` candidates and modern formats.                                    |

The single-file JavaScript ceiling is deliberately strict. It prevents a
ThreeUI or visualisation dependency from becoming a hidden public-route
requirement. A signature scene is optional and must be lazy-loaded; it does
not get to increase the base route budget.

## Core Web Vitals targets

For public routes, the field target is “good” at the 75th percentile on a
representative mobile and desktop population:

| Metric           | Good target | What it protects                                             |
| ---------------- | ----------: | ------------------------------------------------------------ |
| LCP              |    `≤2.5 s` | The main promise is visible quickly.                         |
| INP              |   `≤200 ms` | Menus, forms and correspondence interactions feel immediate. |
| CLS              |     `≤0.10` | Typography and image dimensions do not jump the page.        |
| TTFB             |   `≤800 ms` | Edge/server work leaves time for rendering.                  |
| FCP (diagnostic) |    `≤1.8 s` | The first useful mark arrives promptly.                      |

These are targets rather than a claim about a user's network. Investigate a
route when p75 crosses a target for two measurement periods, or when a release
introduces a clear regression in mobile testing. Do not add a loading screen to
hide a poor LCP.

## Running the check

```sh
pnpm build
pnpm perf:budget
pnpm test:performance
```

The checker prints raw, gzip and Brotli sizes for the largest client assets,
route-entry totals when discoverable, and images above the viewport aim. Its
gzip and Brotli calculations use Node's standard library; Brotli is measured at
quality 4 so the check stays fast enough for local and acceptance runs. Hard
JavaScript decisions use gzip. The optional strict image gate is:

```sh
node scripts/performance/check-bundle-budget.mjs --strict-images
```

The checker exits non-zero for any JavaScript asset above `500 KiB` gzip or any
discoverable route entry above `150 KiB` gzip. Image overages are warnings by
default because archive/editorial imagery is not necessarily a viewport
candidate; a page owner must still provide an appropriately sized candidate.

## What the checker can and cannot know

- It includes JavaScript under `_astro/` and `assets/`, plus JavaScript
  explicitly referenced from static HTML. The Cloudflare worker bundle under
  `_worker.js` is server code and is excluded.
- For a static HTML route, it follows relative static ESM imports to estimate
  the initial JavaScript closure. Dynamic imports remain optional chunks and
  are covered by the single-file ceiling.
- A future `dist/manifest.json` may expose route entries using a simple
  `routes`, `entries` or `entrypoints` object. Values can be asset strings or
  nested arrays/objects, for example:

  ```json
  {
    "routes": {
      "/": ["/_astro/home.js", "/_astro/shared.js"],
      "/journal": ["/_astro/journal.js"]
    }
  }
  ```

- The current Astro Cloudflare SSR output does not emit static HTML route
  files, so an aggregate route-entry total can be unavailable in `dist`. In
  that case the checker still enforces every client file's hard ceiling and
  reports the limitation. Browser testing on a mobile profile remains
  required.
- Compression is not a network waterfall. It does not model TLS, HTTP/2 or
  HTTP/3 framing, cache state, font negotiation, CPU parse/compile time,
  Cloudflare transforms, or a user's radio. Use the browser E2E and field
  strategy alongside this gate.

## Review protocol for an overage

1. Confirm the build was fresh; do not diagnose a stale `dist` or copied
   `public/_astro` asset.
2. Inspect the largest gzip assets and their static import closure.
3. Remove duplicate route imports, move optional scenes behind a user action,
   and replace an unnecessarily broad dependency with a small adapter.
4. Reserve image dimensions in markup and provide a responsive modern-format
   candidate before lowering a budget.
5. Re-run the checker, focused unit tests, mobile browser checks, and the
   canonical acceptance command before deployment.

An exception must be a written, dated decision naming the route, asset,
reason, measured impact and expiry/review date. It must not silently make a
visual dependency part of every public page.
