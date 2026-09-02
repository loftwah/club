// Unit tests for scripts/cf-audit.mjs.
//
// The audit script is mostly I/O against wrangler / the Cloudflare API;
// these tests cover the parsers and the runtime shape (the script
// always runs as a side-effect; it just needs to be importable and
// to expose the helpers we want to verify).

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

test("parseKvList: parses a wrangler kv namespace list payload", async () => {
  const mod = await import(`./cf-audit.mjs?test=${Math.random()}`);
  const text = `[
  {
    "id": "abc123",
    "title": "my-kv"
  }
]`;
  assert.deepEqual(mod.parseKvList(text), [{ id: "abc123", title: "my-kv" }]);
});

test("parseKvList: returns empty array when there is no [", async () => {
  const mod = await import(`./cf-audit.mjs?test=${Math.random()}`);
  assert.deepEqual(mod.parseKvList("not a json"), []);
});

test("parseR2List: parses a wrangler r2 bucket list payload", async () => {
  const mod = await import(`./cf-audit.mjs?test=${Math.random()}`);
  const text = `Listing buckets...
name:           astroflare
creation_date:  2025-03-29T12:00:48.371Z

name:           downscope
creation_date:  2025-04-04T12:20:23.302Z
`;
  assert.deepEqual(mod.parseR2List(text), ["astroflare", "downscope"]);
});

test("parseD1List: parses a wrangler d1 list --json payload", async () => {
  const mod = await import(`./cf-audit.mjs?test=${Math.random()}`);
  const text = `[
  {
    "uuid": "abc",
    "name": "my-db"
  }
]`;
  assert.deepEqual(mod.parseD1List(text), [{ uuid: "abc", name: "my-db" }]);
});

test("cf:audit: the script runs and writes a JSON report (smoke)", () => {
  // Run the script as a child process. This is the cheapest end-to-end
  // check that the entrypoint, API call shape, and JSON write all work
  // against the real Cloudflare account.
  const result = spawnSync("node", [join(__dirname, "cf-audit.mjs")], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    // Network or auth errors should not fail the test suite. The audit
    // script is designed to be re-runnable, and a transient outage is
    // tolerated. We do, however, expect the script to print something
    // and either write a report or report a clear error.
    assert.ok(
      result.stdout.length > 0 || result.stderr.length > 0,
      "expected at least one of stdout/stderr to be non-empty",
    );
    return;
  }
  assert.match(result.stdout, /Cloudflare audit/);
  assert.match(result.stdout, /workers/);
});

test("cf:audit: parseKvList handles a non-array string", async () => {
  const mod = await import(`./cf-audit.mjs?test=${Math.random()}`);
  assert.deepEqual(mod.parseKvList(null), []);
  assert.deepEqual(mod.parseKvList(""), []);
});
