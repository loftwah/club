# Frontend platform compatibility matrix

Status date: 2026-08-24. Versions are exact lockfile resolutions unless a
range is shown. The Astro runtime migration is complete and proven locally;
production verification remains part of the release procedure.

## Proven stack

| Area              | Version                       | Status and evidence                                                                                                                    |
| ----------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Node              | `24.19.0`                     | Pinned by `mise.toml`; frozen install and checks pass.                                                                                 |
| pnpm              | `11.23.0`                     | Pinned by `mise.toml` and `packageManager`.                                                                                            |
| Astro             | `7.2.4` (`^7.2.4`)            | Migrated from `Astro.locals.runtime` to direct typed `cloudflare:workers` bindings. Typecheck, build and workerd route execution pass. |
| Astro Cloudflare  | `14.2.3` (`^14.2.3`)          | Produces the Worker entrypoint and generated Wrangler configuration used by local workerd and deployment.                              |
| Astro React       | `6.0.4` (`^6.0.4`)            | Proven with React 19.                                                                                                                  |
| React / React DOM | `19.2.8`                      | Within ThreeUI's declared React peer range.                                                                                            |
| TypeScript        | `5.9.3` (`^5.6.0`)            | Typecheck passes; a TypeScript major upgrade is not coupled to this migration.                                                         |
| Vite              | `8.2.2`                       | Resolved with Astro 7; production build passes.                                                                                        |
| Tailwind CSS      | `4.3.3`                       | First-party Vite plugin; existing global CSS retained.                                                                                 |
| Vitest            | `4.1.11`                      | Unit and integration suites run on Node 24.                                                                                            |
| Wrangler          | `4.125.0`                     | Generated-config workerd execution and deploy dry-run pass.                                                                            |
| Workers types     | `5.20260823.1`                | Aligned with Wrangler 4.125.                                                                                                           |
| Playwright        | `1.62.1`                      | Chromium acceptance plus targeted WebKit mobile/reduced-motion coverage.                                                               |
| ThreeUI           | `@designcodeio/threeui 0.3.0` | Evaluated only in the protected internal bakeoff; the public winner is CSS/SVG.                                                        |
| Motion            | `13.1.0`                      | Used selectively; essential content remains semantic and static-capable.                                                               |
| Remotion          | `4.0.516`                     | Every Remotion package is exactly aligned; `remotion versions` passes.                                                                 |

## Completed migration

Astro 7 removed the legacy adapter runtime surface used by the application.
Runtime truth now comes from typed `env` bindings imported from
`cloudflare:workers`, with a test-only injection seam. All Worker start and
deploy commands point at `dist/server/wrangler.json` explicitly, so clearing
`.wrangler` state cannot silently fall back to the repository root config.
The production build removes Astro's generated `dist/server/.dev.vars` copy
before artifacts can be retained or deployed.

Required release checks are:

```sh
pnpm install --frozen-lockfile
pnpm peers check
pnpm typecheck
pnpm build
test ! -e dist/server/.dev.vars
pnpm wrangler:deploy:dry
mise run acceptance
```

The production deploy is complete only after encoded operator-route probes,
security-header checks, D1 migration verification and schedule inspection pass
against `https://club.loftwah.com`.

## Change policy

- Keep Astro, its Cloudflare adapter and React integration within a tested
  compatibility wave; do not blanket-upgrade majors.
- Keep all Remotion packages on one exact stable version.
- Re-run workerd browser checks whenever adapter output or Wrangler changes.
- Preserve `AGENTS.md` product invariants and finish every release with
  `mise run acceptance`.

## Official references

- [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Astro 7 migration](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [React 19](https://react.dev/blog/2024/12/05/react-19)
- [Vitest migration guide](https://vitest.dev/guide/migration.html)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- [ThreeUI by Design+Code](https://designcode.io/threeui/)
