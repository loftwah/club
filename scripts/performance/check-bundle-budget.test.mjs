import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BUDGETS, checkBundleBudget, formatBytes, measureFile } from "./check-bundle-budget.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "plans-with-you-perf-"));
  mkdirSync(join(root, "_astro"), { recursive: true });
  return root;
}

test("measures raw, gzip, and brotli bytes", () => {
  const root = fixture();
  try {
    const path = join(root, "_astro", "main.js");
    writeFileSync(path, "export const answer = 42;\n");
    const measured = measureFile(path);
    assert.equal(measured.rawBytes, 26);
    assert.ok(measured.gzipBytes < measured.rawBytes + 32);
    assert.ok(measured.brotliBytes < measured.rawBytes + 32);
    assert.equal(formatBytes(BUDGETS.singleJsHardGzipBytes), "500 KiB");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("follows static imports for an HTML initial entry", () => {
  const root = fixture();
  try {
    writeFileSync(
      join(root, "index.html"),
      '<script type="module" src="/_astro/main.js"></script>',
    );
    writeFileSync(join(root, "_astro", "main.js"), 'import "./shared.js";\nexport {};');
    writeFileSync(join(root, "_astro", "shared.js"), "export const shared = true;\n");
    const report = checkBundleBudget(root);
    assert.equal(report.failures.length, 0);
    assert.equal(report.routes.length, 1);
    assert.equal(report.routes[0].route, "/");
    assert.equal(report.routes[0].paths.length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails a single client asset over the hard gzip ceiling", () => {
  const root = fixture();
  try {
    // A deterministic pseudo-random buffer does not collapse under gzip.
    const bytes = randomBytes(BUDGETS.singleJsHardGzipBytes + 64 * 1024);
    writeFileSync(join(root, "_astro", "signature.js"), bytes);
    const report = checkBundleBudget(root);
    assert.equal(report.oversizedJavaScript.length, 1);
    assert.equal(report.failures.length, 1);
    assert.match(report.failures[0], /signature\.js/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
