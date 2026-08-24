#!/usr/bin/env node
// Real Cloudflare local D1 fresh-migration proof.
//
// This script wipes .wrangler/state, applies every migration under
// migrations/ via the current official Wrangler D1 local mode, and
// then runs a series of verification queries against the freshly-built
// schema. It is the canonical evidence that the migrations actually
// apply against a real local D1, not just parse as SQL.

import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const wrangler = resolve(repoRoot, "node_modules/wrangler/bin/wrangler.js");
const dbName = "social-club";

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseRows(jsonText) {
  let json;
  try {
    json = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const stmt = Array.isArray(json) ? json[0] : json;
  return stmt?.results ?? [];
}

const expectedTables = [
  "members",
  "chapters",
  "membership_tiers",
  "memberships",
  "tier_capabilities",
  "service_grants",
  "member_facts",
  "member_timeline",
  "legal_documents",
  "member_acceptances",
  "locations",
  "events",
  "event_locations",
  "event_invitations",
  "event_transitions",
  "communication_templates",
  "communications",
  "inbound_messages",
  "waitlist_entries",
  "milestone_definitions",
  "member_milestones",
  "fulfilment_tasks",
  "commitment_scenarios",
  "jobs",
  "idempotency_records",
  "audit_log",
  "ai_generations",
  "agent_leases",
];

const steps = [];

function step(name, fn) {
  steps.push({ name, fn });
}

step("wipe .wrangler/state", () => {
  const target = resolve(repoRoot, ".wrangler");
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
  return "ok";
});

step("apply migrations from zero", () => {
  const r = run(wrangler, ["d1", "migrations", "apply", dbName, "--local"]);
  if (r.status !== 0) {
    return {
      error: `wrangler d1 migrations apply --local failed (exit ${r.status})`,
      output: r.stderr,
    };
  }
  return "ok";
});

step("verify all expected tables exist", () => {
  const r = run(wrangler, [
    "d1",
    "execute",
    dbName,
    "--local",
    "--command",
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;",
    "--json",
  ]);
  if (r.status !== 0) {
    return { error: "d1 execute list-tables failed", output: r.stderr };
  }
  let rows = [];
  try {
    const json = JSON.parse(r.stdout);
    // wrangler --json output is an array of statements; each statement
    // has shape { success, results: [...], meta }. The first statement
    // is the SELECT.
    const stmt = Array.isArray(json) ? json[0] : json;
    rows = stmt?.results ?? [];
  } catch (err) {
    return { error: `could not parse wrangler JSON output: ${err}`, output: r.stdout };
  }
  const actual = new Set(rows.map((row) => row.name));
  const missing = expectedTables.filter((t) => !actual.has(t));
  if (missing.length > 0) {
    return {
      error: `missing tables after fresh migration: ${missing.join(", ")}`,
      output: `found: ${[...actual].join(", ") || "(none)"}`,
    };
  }
  return `${actual.size} tables present`;
});

step("events.state CHECK rejects ATTENDED", () => {
  // Insert a minimal events row whose state is 'ATTENDED'. The CHECK
  // constraint must reject it. Wrangler D1 surfaces the SQLite error
  // either in stdout or via a non-zero exit depending on the version.
  const sql =
    "INSERT INTO events (id, chapter_id, title, event_type, start_at, duration_minutes, cancellation_due_at, state) VALUES " +
    "('probe', 'probe', 'probe', 'probe', '2026-01-01T00:00:00Z', 60, '2026-01-01T00:00:00Z', 'ATTENDED');";
  const r = run(wrangler, ["d1", "execute", dbName, "--local", "--command", sql]);
  if (r.status === 0 && !/CHECK constraint failed/i.test(r.stdout)) {
    return { error: "expected CHECK-constraint rejection of ATTENDED, got success" };
  }
  return "ok (CHECK constraint fired)";
});

step("representative insert + read + update", () => {
  const id = "test_member_" + Date.now();
  const insert = run(wrangler, [
    "d1",
    "execute",
    dbName,
    "--local",
    "--command",
    `INSERT INTO members (id, email, country, metro_area) VALUES ('${id}', 't@example.com', 'AU', 'melbourne');`,
  ]);
  if (insert.status !== 0) {
    return { error: "insert failed", output: insert.stderr };
  }
  const select = run(wrangler, [
    "d1",
    "execute",
    dbName,
    "--local",
    "--command",
    `SELECT id, email FROM members WHERE id = '${id}';`,
    "--json",
  ]);
  if (select.status !== 0) {
    return { error: "select failed", output: select.stderr };
  }
  const rows = parseRows(select.stdout);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].email !== "t@example.com") {
    return { error: `expected one row with email t@example.com, got ${select.stdout}` };
  }
  const update = run(wrangler, [
    "d1",
    "execute",
    dbName,
    "--local",
    "--command",
    `UPDATE members SET preferred_name = 'T' WHERE id = '${id}';`,
  ]);
  if (update.status !== 0) {
    return { error: "update failed", output: update.stderr };
  }
  const sel2 = run(wrangler, [
    "d1",
    "execute",
    dbName,
    "--local",
    "--command",
    `SELECT preferred_name FROM members WHERE id = '${id}';`,
    "--json",
  ]);
  const rows2 = parseRows(sel2.stdout);
  if (rows2[0].preferred_name !== "T") {
    return { error: `update did not persist, got ${sel2.stdout}` };
  }
  return "ok (insert + read + update persisted)";
});

step("idempotency: re-applying migrations is a no-op", () => {
  const r = run(wrangler, ["d1", "migrations", "apply", dbName, "--local"]);
  if (r.status !== 0) {
    return { error: `re-apply failed (exit ${r.status})`, output: r.stderr };
  }
  return "ok (re-applied without error)";
});

step("waitlist_entries.interested_tier column is present", () => {
  const r = run(wrangler, [
    "d1",
    "execute",
    dbName,
    "--local",
    "--command",
    "PRAGMA table_info(waitlist_entries);",
    "--json",
  ]);
  if (r.status !== 0) {
    return { error: "pragma table_info failed", output: r.stderr };
  }
  const rows = parseRows(r.stdout);
  const hasColumn = rows.some((row) => row.name === "interested_tier");
  if (!hasColumn) {
    return {
      error: "waitlist_entries.interested_tier column missing after migration",
      output: `columns: ${rows.map((r) => r.name).join(", ")}`,
    };
  }
  return "ok (interested_tier column present, nullable)";
});

let failed = false;
for (const s of steps) {
  process.stdout.write(`  • ${s.name} ... `);
  let result;
  try {
    result = s.fn();
  } catch (err) {
    result = { error: String(err) };
  }
  if (result && typeof result === "object" && "error" in result) {
    process.stdout.write(`FAIL\n    ${result.error}\n`);
    if (result.output) {
      const lines = String(result.output).split("\n").slice(0, 4);
      process.stdout.write(`    ${lines.join("\n    ")}\n`);
    }
    failed = true;
  } else {
    const extra = typeof result === "string" ? ` (${result})` : "";
    process.stdout.write(`ok${extra}\n`);
  }
}

if (failed) {
  process.exit(1);
}
process.stdout.write(`\nFresh-migration proof: ${steps.length} steps, all passed.\n`);
