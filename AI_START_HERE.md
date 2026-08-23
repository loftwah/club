# AI Start Here

Read before modifying code:

1. `PROJECT_BRIEF.md`
2. `AGENTS.md`
3. `MASTER_SPEC.md`
4. `config/ENVIRONMENT.md`
5. `fixtures/acceptance-scenarios.yaml`

Then inspect the repository itself.

Before large changes, internally map:

- current repository structure;
- framework/toolchain;
- Cloudflare/Wrangler configuration;
- database/migrations;
- tests;
- GitHub Actions;
- deployment flow;
- already-satisfied requirements;
- gaps;
- contradictions with invariants;
- provider behaviour requiring current official documentation.

Ask the user only when a material product decision is genuinely unresolved. Do not ask questions that repository inspection, this specification, tests, or current official provider documentation can answer.

For Cloudflare, Resend, MiniMax, Stripe, ThreeUI, MCP libraries and iCalendar semantics: verify current official documentation before coding provider-specific APIs. Keep provider code behind adapters. Do not invent endpoints, headers, payloads or SDK methods.

Do not report completion without implementation, migrations, tests, failure tests, terminal-state coverage and a successful local acceptance run.
