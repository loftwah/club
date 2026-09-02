// Unit tests for scripts/cf-preview.mjs.
//
// The script is a thin front-end over `wrangler preview` and `git rev-parse`
// with one large pure-function surface (branch sanitisation, prod-identity
// detection, override-config construction). These tests cover the pure
// functions and the production-binding denylist guard. The full lifecycle
// is exercised manually against a real Cloudflare account (see
// docs/CLOUDFLARE_WORKER_PREVIEWS.md and the #18 lab report).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  sanitizeBranch,
  findProductionIdentityWarning,
  buildOverrideConfig,
  ensureNotMain,
  PRODUCTION_PROTECTED_BRANCHES,
  CfPreviewError,
} from "./cf-preview.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

test("sanitizeBranch: replaces non-alphanumeric with dashes, lowercases, trims", () => {
  assert.equal(sanitizeBranch("feature/awesome-thing_WIP-1"), "feature-awesome-thing-wip-1");
});

test("sanitizeBranch: collapses runs of dashes", () => {
  assert.equal(sanitizeBranch("a___b---c"), "a-b-c");
});

test("sanitizeBranch: strips leading and trailing dashes", () => {
  assert.equal(sanitizeBranch("/leading-and-trailing/"), "leading-and-trailing");
});

test("sanitizeBranch: truncates to 50 chars", () => {
  const long = "a".repeat(80);
  const result = sanitizeBranch(long);
  assert.equal(result.length, 50);
});

test("sanitizeBranch: returns empty string for purely-special input", () => {
  assert.equal(sanitizeBranch("///"), "");
});

test("findProductionIdentityWarning: detects production D1 id at top level", () => {
  const cfg = {
    d1_databases: [{ binding: "DB", database_id: "22850c0b-b1ac-4f9e-950b-8e8392e02d90" }],
  };
  const result = findProductionIdentityWarning(cfg);
  assert.equal(result.length, 1);
  assert.match(result[0], /production D1 id/);
});

test("findProductionIdentityWarning: detects production KV id at top level", () => {
  const cfg = {
    kv_namespaces: [{ binding: "SESSION", id: "fe39a4b46d554822a48759cb7cb884db" }],
  };
  const result = findProductionIdentityWarning(cfg);
  assert.equal(result.length, 1);
  assert.match(result[0], /production KV id/);
});

test("findProductionIdentityWarning: detects production R2 bucket at top level", () => {
  const cfg = {
    r2_buckets: [{ binding: "ARTIFACTS", bucket_name: "social-club-artifacts" }],
  };
  const result = findProductionIdentityWarning(cfg);
  assert.equal(result.length, 1);
  assert.match(result[0], /production R2 bucket/);
});

test("findProductionIdentityWarning: detects production D1 id in previews block", () => {
  const cfg = {
    previews: {
      d1_databases: [{ binding: "DB", database_id: "22850c0b-b1ac-4f9e-950b-8e8392e02d90" }],
    },
  };
  const result = findProductionIdentityWarning(cfg);
  assert.equal(result.length, 1);
  assert.match(result[0], /production D1 id/);
});

test("findProductionIdentityWarning: detects production KV id in previews block", () => {
  const cfg = {
    previews: {
      kv_namespaces: [{ binding: "SESSION", id: "fe39a4b46d554822a48759cb7cb884db" }],
    },
  };
  const result = findProductionIdentityWarning(cfg);
  assert.equal(result.length, 1);
  assert.match(result[0], /production KV id/);
});

test("findProductionIdentityWarning: detects production R2 bucket in previews block", () => {
  const cfg = {
    previews: {
      r2_buckets: [{ binding: "ARTIFACTS", bucket_name: "social-club-artifacts" }],
    },
  };
  const result = findProductionIdentityWarning(cfg);
  assert.equal(result.length, 1);
  assert.match(result[0], /production R2 bucket/);
});

test("findProductionIdentityWarning: returns empty for non-production ids", () => {
  const cfg = {
    d1_databases: [{ binding: "DB", database_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }],
    kv_namespaces: [{ binding: "SESSION", id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    r2_buckets: [{ binding: "ARTIFACTS", bucket_name: "my-preview-bucket" }],
  };
  assert.deepEqual(findProductionIdentityWarning(cfg), []);
});

test("buildOverrideConfig: emits correct shape with Preview-only ids", () => {
  const ids = {
    safeBranch: "feature-foo",
    previewKvId: "kv-123",
    previewD1Id: "d1-456",
    previewD1Name: "social-club-preview-feature-foo",
    previewR2Name: "social-club-preview-feature-foo-artifacts",
    previewKvName: "social-club-preview-feature-foo-session",
    previewName: "experiment-feature-foo",
  };
  const result = buildOverrideConfig("feature/foo", ids);
  assert.equal(result.name, "social-club");
  assert.equal(result.compatibility_date, "2026-08-15");
  assert.deepEqual(result.compatibility_flags, ["nodejs_compat"]);
  assert.equal(result.assets.binding, "ASSETS");
  assert.equal(result.previews.kv_namespaces[0].binding, "SESSION");
  assert.equal(result.previews.kv_namespaces[0].id, "kv-123");
  assert.equal(result.previews.d1_databases[0].database_id, "d1-456");
  assert.equal(
    result.previews.r2_buckets[0].bucket_name,
    "social-club-preview-feature-foo-artifacts",
  );
  assert.equal(result.vars.ENVIRONMENT, "preview-feature-foo");
  // The override must NOT carry a production route. Cloudflare Preview URLs
  // come from the workers.dev subdomain, not the zone route.
  assert.equal(result.routes, undefined);
});

test("buildOverrideConfig: does not include production route even when the branch name has dashes", () => {
  const ids = {
    safeBranch: "fix-12",
    previewKvId: "k",
    previewD1Id: "d",
    previewD1Name: "p",
    previewR2Name: "p-artifacts",
    previewKvName: "p-session",
    previewName: "experiment-fix-12",
  };
  const result = buildOverrideConfig("fix-12", ids);
  assert.equal(result.routes, undefined);
  assert.equal(result.vars.APP_BASE_URL, "https://preview.example.invalid");
});

test("PRODUCTION_PROTECTED_BRANCHES includes main and master", () => {
  assert.ok(PRODUCTION_PROTECTED_BRANCHES.has("main"));
  assert.ok(PRODUCTION_PROTECTED_BRANCHES.has("master"));
});

test("ensureNotMain: throws CfPreviewError on the main branch", () => {
  assert.throws(
    () => ensureNotMain("main"),
    (err) => err instanceof CfPreviewError && /main/i.test(err.message),
  );
});

test("ensureNotMain: throws CfPreviewError on the master branch", () => {
  assert.throws(
    () => ensureNotMain("master"),
    (err) => err instanceof CfPreviewError && /master/i.test(err.message),
  );
});

test("ensureNotMain: returns the branch name on a non-protected branch", () => {
  assert.equal(ensureNotMain("feature/awesome"), "feature/awesome");
  assert.equal(ensureNotMain("fix-12"), "fix-12");
});

test("repo wrangler.jsonc: the previews block does not reference production D1/KV/R2", () => {
  // Sanity check on the live source-of-truth. The top-level bindings
  // SHOULD reference production (that's how production deploys); the
  // Preview guard is only about the `previews` block. We extract the
  // previews block and verify the production guard fires correctly.
  const raw = readFileSync(join(repoRoot, "wrangler.jsonc"), "utf8");
  const cfg = JSON.parse(
    raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/,(\s*[}\]])/g, "$1"),
  );
  // Top-level bindings (production) reference production IDs. This is correct.
  const topLevel = findProductionIdentityWarning(cfg);
  assert.ok(
    topLevel.length >= 1,
    "top-level bindings should reference production ids (this is the production config)",
  );

  // If a `previews` block exists, it must NOT reference production ids.
  if (cfg.previews) {
    const previewOnly = { previews: cfg.previews };
    const result = findProductionIdentityWarning(previewOnly);
    assert.deepEqual(
      result,
      [],
      `wrangler.jsonc previews block must not reference production ids, got: ${JSON.stringify(result)}`,
    );
  }
});
