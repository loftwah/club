#!/usr/bin/env node
// Helper: spawn `wrangler dev` as a child process, wait until the
// preview URL is reachable, then keep it running. Used by
// scripts/acceptance.mjs to provide a real local Worker runtime for
// Playwright browser E2E tests.
//
// Usage: node scripts/wrangler-dev.mjs
//   Env: PORT (default 8788), READY_TIMEOUT_MS (default 60000)
//
// Parent orchestrator SIGTERMs this process after the test run.

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const wrangler = resolve(repoRoot, "node_modules/wrangler/bin/wrangler.js");
const port = process.env.PORT ?? "8788";
const timeoutMs = parseInt(process.env.READY_TIMEOUT_MS ?? "60000", 10);

const child = spawn(
  wrangler,
  [
    "dev",
    "--config",
    "dist/server/wrangler.json",
    "--port",
    port,
    "--persist-to",
    ".wrangler/state",
    "--ip",
    "127.0.0.1",
  ],
  { cwd: repoRoot, stdio: ["ignore", "inherit", "inherit"] },
);

const cleanup = () => {
  if (!child.killed) child.kill("SIGTERM");
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

const url = `http://127.0.0.1:${port}/`;
const deadline = Date.now() + timeoutMs;

async function waitForReady() {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.status < 500) return;
    } catch {
      // not yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`wrangler dev did not become ready within ${timeoutMs}ms`);
}

waitForReady()
  .then(() => {
    process.stdout.write(`\n[wrangler-dev] ready at ${url}\n`);
  })
  .catch((err) => {
    process.stderr.write(`[wrangler-dev] ${err.message}\n`);
    cleanup();
    process.exit(1);
  });

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
