#!/usr/bin/env node
// Canonical local acceptance. Runs from a clean local state.
//
// The acceptance contract is the union of:
//   - AGENTS.md (invariants)
//   - docs/13_TEST_PLAN.md (test plan)
//   - docs/14_ACCEPTANCE_CONTRACT.md (required gates)
//   - MASTER_SPEC §15 (Acceptance Contract)
//
// Gates executed here:
//   1. format:check
//   2. lint
//   3. typecheck (astro check + tsc)
//   4. unit tests (state machines, policy, idempotency, jobs,
//      agent-lease, fakes)
//   5. integration tests (in-memory D1 mock with the real schema)
//   6. static schema check (parity, forbidden states, env naming)
//   7. production build
//   8. browser bundle performance budgets
//   9. wrangler config dry-run validation
//  10. real Cloudflare local D1 fresh-migration proof
//      (wipes .wrangler/state, applies migrations via Wrangler CLI,
//       verifies schema + constraints, then proves the forbidden
//       event states are rejected at the real local D1 layer)
//  11. browser E2E (Playwright) against a live wrangler dev process
//      (covers public routes, form submission, mobile viewport,
//       reduced motion, axe accessibility, ThreeUI fallback path)
//
// Provider contract tests (Resend, MiniMax) are credentialled and
// live behind `mise run contracts`. They are NOT required for the
// default `mise run acceptance` run.

import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();

const steps = [
  {
    name: "format:check",
    cmd: ["node", "node_modules/prettier/bin/prettier.cjs", "--check", "."],
  },
  {
    name: "lint",
    cmd: ["node", "node_modules/eslint/bin/eslint.js", ".", "--max-warnings=0"],
  },
  {
    name: "typecheck (astro check)",
    cmd: ["node", "node_modules/astro/bin/astro.mjs", "check"],
  },
  {
    name: "typecheck (tsc)",
    cmd: ["node", "node_modules/typescript/bin/tsc", "--noEmit"],
  },
  {
    name: "unit tests",
    cmd: ["node", "node_modules/vitest/vitest.mjs", "run", "tests/unit"],
  },
  {
    name: "integration tests (in-memory D1 mock)",
    cmd: ["node", "node_modules/vitest/vitest.mjs", "run", "tests/integration"],
  },
  {
    name: "static schema check (parity + forbidden states + env naming)",
    cmd: ["node", "scripts/check-fresh-state.mjs"],
  },
  {
    name: "clean generated build output",
    cmd: ["node", "scripts/clean-build-output.mjs"],
  },
  {
    name: "production build (astro build)",
    cmd: ["node", "node_modules/astro/bin/astro.mjs", "build"],
  },
  {
    name: "remove generated build secret copy",
    cmd: ["node", "scripts/secure-build-output.mjs"],
  },
  {
    name: "generate canonical OG / social SVG images",
    cmd: ["node", "scripts/og-generate.mjs"],
  },
  {
    name: "browser bundle performance budgets",
    cmd: ["node", "scripts/performance/check-bundle-budget.mjs"],
  },
  {
    name: "wrangler config validation (dry-run)",
    cmd: ["node", "node_modules/wrangler/bin/wrangler.js", "deploy", "--dry-run", "--outdir=dist"],
  },
  {
    name: "real Cloudflare local D1 fresh-migration proof",
    cmd: ["node", "scripts/check-fresh-migrations.mjs"],
  },
];

let exit = 0;
const startedAt = Date.now();
for (const step of steps) {
  const t0 = Date.now();
  console.info(`\n→ ${step.name}`);
  const result = spawnSync(step.cmd[0], step.cmd.slice(1), {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  if (result.status !== 0) {
    console.error(`✗ ${step.name} failed (${dt}s)`);
    exit = result.status ?? 1;
    break;
  }
  console.info(`✓ ${step.name} (${dt}s)`);
}

if (exit !== 0) {
  const total = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.error(`\nACCEPTANCE: FAIL (after ${total}s)`);
  process.exit(exit);
}

// Browser E2E requires a running wrangler dev process. The current Cloudflare
// adapter serves dist/client through its generated ASSETS configuration. We start it,
// wait for readiness, run Playwright, then stop it.
console.info(`\n→ start wrangler dev for browser E2E`);
const dev = spawn("node", ["scripts/wrangler-dev.mjs"], {
  cwd: repoRoot,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: "8788" },
});

let devReady = false;
dev.stdout.on("data", (chunk) => {
  const s = chunk.toString();
  process.stdout.write(`[wrangler-dev] ${s}`);
  if (s.includes("[wrangler-dev] ready at")) devReady = true;
});
dev.stderr.on("data", (chunk) => {
  process.stderr.write(`[wrangler-dev] ${chunk}`);
});

const readyDeadline = Date.now() + 60_000;
while (!devReady && Date.now() < readyDeadline) {
  try {
    const r = await fetch("http://127.0.0.1:8788/", {
      signal: AbortSignal.timeout(1000),
    });
    if (r.status < 500) {
      devReady = true;
      break;
    }
  } catch {
    // not yet
  }
  await sleep(500);
}
if (!devReady) {
  console.error("✗ wrangler dev did not become ready within 60s");
  dev.kill("SIGTERM");
  process.exit(1);
}
console.info(`✓ wrangler dev ready`);

const e2eCmd = ["node", "node_modules/@playwright/test/cli.js", "test", "--reporter=list"];
console.info(`\n→ browser E2E (Playwright)`);
const e2eStart = Date.now();
const e2e = spawnSync(e2eCmd[0], e2eCmd.slice(1), {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});
const e2eDt = ((Date.now() - e2eStart) / 1000).toFixed(2);
if (e2e.status !== 0) {
  console.error(`✗ browser E2E failed (${e2eDt}s)`);
  dev.kill("SIGTERM");
  process.exit(e2e.status ?? 1);
}
console.info(`✓ browser E2E (${e2eDt}s)`);

dev.kill("SIGTERM");
await sleep(500);

const total = ((Date.now() - startedAt) / 1000).toFixed(2);
console.info(`\nACCEPTANCE: PASS (total ${total}s)`);
process.exit(0);
