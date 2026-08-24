# Frontend platform compatibility matrix

Status date: 2026-08-24. This is the repository-facing record for the staged
platform modernization. Versions below are exact lockfile resolutions unless
the entry is explicitly marked as a range. No UI route, global stylesheet, or
ThreeUI bundler configuration was changed by this work.

## Current proven state

| Area                    | Current/local                                       | Recommended next state                                             | Result and risk                                                                                                                                                               |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node                    | `24.19.0` via `mise.toml`                           | Keep `24.19.0` LTS                                                 | PASS with frozen install and tests under the pinned runtime.                                                                                                                  |
| Node types              | `@types/node 24.13.3` (`^24.13.3`)                  | Keep Node 24 declarations                                          | Aligned with the Node 24 runtime; upgraded in the final runtime wave.                                                                                                         |
| pnpm                    | `11.23.0` via `mise.toml` and `packageManager`      | Keep `11.23.0`                                                     | PASS. `allowBuilds` is the pnpm 11 build-approval map; unlisted build scripts remain denied.                                                                                  |
| React / React DOM       | `19.2.8`                                            | Keep `19.2.x`                                                      | PASS. The package's ThreeUI peer range is `>=18 <20`, so React 19 is within the declared range.                                                                               |
| React types             | `@types/react 19.2.18`, `@types/react-dom 19.2.5`   | Keep matching React 19 types                                       | PASS.                                                                                                                                                                         |
| Astro                   | `5.18.2` (`astro ^5.7.0`)                           | Stay on Astro 5 until the runtime migration is separately approved | Astro 6 was tested and blocked at runtime: `Astro.locals.runtime` was removed. There are about 40 existing consumers, so this cannot be repaired within package/config scope. |
| Astro Cloudflare        | `12.6.13` (`^12.5.0`)                               | Upgrade with Astro 6 only after route/service migration            | Astro 6 requires adapter 13 and a new Worker entrypoint/runtime context. Do not mix the adapter major into the current Astro 5 app.                                           |
| Astro React integration | `4.4.2` (`^4.2.4`)                                  | Upgrade with Astro major                                           | Proven with React 19 and Astro 5.                                                                                                                                             |
| TypeScript              | `5.9.3` (`^5.6.0`)                                  | Reassess `6.0.3` after Astro 6/7 compatibility is proven           | TS 6 was not forced: the Astro 6 blocker is runtime/API migration, not a reason to make an unsupported combined change.                                                       |
| Vite                    | `6.4.3` (direct dev dependency)                     | Keep Vite 6 with Astro 5                                           | Required to avoid Vitest 4 selecting Vite 7 while Astro 5's integration types remain on Vite 6.                                                                               |
| Tailwind CSS            | `4.3.3` plus `@tailwindcss/vite 4.3.3`              | Keep 4.3.x                                                         | PASS. Uses the first-party Vite plugin in `astro.config.mjs`; global CSS remains untouched.                                                                                   |
| Vitest                  | `4.1.11`                                            | Keep 4.1.x                                                         | PASS: Node 24 unit and integration suites pass. Pool migration uses `pool: "forks"`, `maxWorkers: 1`, `isolate: false`.                                                       |
| Wrangler                | `4.125.0`                                           | Keep 4.125.x                                                       | PASS: peers and deploy dry-run pass with current Astro 5 output.                                                                                                              |
| Workers types           | `5.20260823.1`                                      | Keep aligned with Wrangler                                         | PASS. Wrangler 4.125 requires Workers types 5.x.                                                                                                                              |
| Playwright              | `1.62.1`                                            | Keep until a browser-specific need appears                         | Chromium acceptance plus a small targeted WebKit mobile/reduced-motion project.                                                                                               |
| ThreeUI                 | exact `@designcodeio/threeui 0.3.0`                 | Keep exact `0.3.0`                                                 | Its declared peers are React `>=18 <20` and Three `>=0.149 <1`; preserve direct/lazy imports and the intentionally absent ThreeUI bundler config.                             |
| Fontsource              | exact `5.3.0` packages                              | Keep exact with the locked brand                                   | Self-hosted Archivo Variable, Source Serif 4 Variable and Fragment Mono are used by web and copied as deterministic Remotion render assets.                                   |
| Motion                  | exact `13.1.0`                                      | Keep 13.x                                                          | Used only where client interaction adds value; essential content remains semantic and static-capable.                                                                         |
| Remotion                | exact `4.0.516` packages, Zod `4.4.3`               | Keep every package exactly aligned                                 | Stable motion-factory toolchain; `pnpm exec remotion versions` passes. Alpha/canary releases are excluded.                                                                    |
| Lucide                  | exact `@lucide/astro 1.33.0`, `lucide-react 1.33.0` | Keep 1.33.x                                                        | Staged only; no route/UI imports were added.                                                                                                                                  |

## Sequential migration log

Each wave was installed and checked independently. Existing user/parent route
work was preserved. Final typecheck, production build, Wrangler dry-run,
performance budget, 97 unit tests, 104 integration tests, and 36 Chromium
browser tests were green at the production baseline. Targeted WebKit evidence
has since been added without creating a redundant full-browser matrix.

| Wave                     | Outcome              | Checks                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1A package additions     | PASS                 | Frozen install, peers, typecheck, unit/integration, production build, and performance budget passed before later waves.                                                                                                                                                                                                                               |
| React 19                 | PASS                 | React/types upgraded to 19.2.x; frozen install, peers, typecheck, unit (91 tests), integration (91 tests), build, and performance budget passed before concurrent route edits.                                                                                                                                                                        |
| Wrangler 4.125           | PASS                 | Wrangler and Workers types upgraded; frozen install, peers, typecheck, and `wrangler:deploy:dry` passed.                                                                                                                                                                                                                                              |
| Astro 6 investigation    | BLOCKED and reverted | Astro 6.4.8, adapter 13.7.0, and React integration 5.0.7 installed; typecheck/build/dry-run compiled, but workerd route execution failed because Astro 6 removes `Astro.locals.runtime`. A middleware compatibility shim cannot replace the adapter's non-configurable legacy getter. The required route/service migration is intentionally deferred. |
| Vitest 4.1               | PASS                 | Vite 6.4.3 was pinned alongside Vitest 4.1.11; Node 24 unit tests: 16 files / 91 tests; Node 24 integration tests: 19 files / 97 tests.                                                                                                                                                                                                               |
| Node 24 / pnpm 11.23     | PASS                 | `mise install`, frozen install, peers, and unit passed using `mise exec node@24.19.0 pnpm@11.23.0`; integration was green before the parent-owned policy-context edits.                                                                                                                                                                               |
| Final application checks | PASS                 | Canonical acceptance passed before production deployment: 97 unit, 104 integration, and 36 Chromium browser tests. Performance hard limits passed.                                                                                                                                                                                                    |

Astro 7 and TypeScript 6.0.3 were not forced. As of this review, Astro 7
cannot be called compatible with this repository because Astro 6's required
runtime migration is unresolved. The safe proven ceiling is Astro 5.18.2 and
TypeScript 5.9.3. Revisit both only after migrating every `locals.runtime`
consumer and validating the new Cloudflare entrypoint under workerd.

## Safest next sequence

1. Inventory and migrate all `Astro.locals.runtime` consumers to the Astro 6
   Cloudflare context (`Astro.locals.cfContext`, `Astro.request.cf`, and
   `cloudflare:workers` `env` as appropriate), with explicit env typing.
2. Upgrade Astro 5 → 6 with adapter 13 and the documented Worker entrypoint;
   run workerd dev, typecheck, unit/integration, build, deploy dry-run, and
   performance budget.
3. Only after that PASS, investigate Astro 6 → 7 and TypeScript 6.0.3 as
   separate changes. If either fails, retain the newest proven version.

Do not run a blanket major-version update. Preserve the product invariants in
`AGENTS.md`, and finish a release wave with:

```sh
mise run acceptance
```

## Build approvals and useful commands

```sh
mise exec node@24.19.0 pnpm@11.23.0 -- pnpm install --frozen-lockfile
mise exec node@24.19.0 pnpm@11.23.0 -- pnpm peers check
mise exec node@24.19.0 pnpm@11.23.0 -- pnpm run typecheck
mise exec node@24.19.0 pnpm@11.23.0 -- pnpm run test:unit
mise exec node@24.19.0 pnpm@11.23.0 -- pnpm run test:integration
mise exec node@24.19.0 pnpm@11.23.0 -- pnpm run build
mise exec node@24.19.0 pnpm@11.23.0 -- pnpm run perf:budget
```

Known non-blocking warnings include the existing Astro/Cloudflare image
optimization notice and image performance-budget advisory output. The
dependency graph also reports existing deprecation notices for `eslint` and
`tsconfck`.

## Official primary references

- [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Astro 6 migration](https://docs.astro.build/en/guides/upgrade-to/v6/)
- [Astro 7 migration](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [Astro integrations](https://docs.astro.build/en/guides/integrations-guide/)
- [React 19 upgrade guidance](https://react.dev/blog/2024/12/05/react-19)
- [TypeScript releases](https://github.com/microsoft/TypeScript/releases)
- [Tailwind CSS Vite installation](https://tailwindcss.com/docs/installation/using-vite)
- [Motion for React](https://motion.dev/docs/react)
- [Lucide Astro package](https://lucide.dev/guide/packages/lucide-astro)
- [Lucide React package](https://lucide.dev/guide/packages/lucide-react)
- [ThreeUI by Design+Code](https://designcode.io/threeui/)
- [Vitest migration guide](https://vitest.dev/guide/migration.html)
- [Playwright documentation](https://playwright.dev/docs/intro)
- [Wrangler documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [pnpm 11 release notes](https://pnpm.io/blog/releases/11.0)
- [pnpm settings](https://pnpm.io/settings)
