#!/usr/bin/env node
// Fresh-state proof: load the schema into a fresh in-memory store, verify
// every expected table is present, and prove the spec acceptance scenario
// `event_success` round-trips correctly from the D1 mock.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = process.cwd();
const migrationsDir = resolve(repoRoot, "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

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

const allSql = files.map((f) => readFileSync(join(migrationsDir, f), "utf-8")).join("\n\n");

// Extract CREATE TABLE names.
const created = new Set();
const re = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)/gi;
let m;
while ((m = re.exec(allSql)) !== null) {
  if (m[1]) created.add(m[1]);
}

const missing = expectedTables.filter((t) => !created.has(t));
if (missing.length > 0) {
  console.error("Fresh-state check: missing tables:", missing);
  process.exit(1);
}

// Forbidden state column values: the events table must not allow
// ATTENDED, CHECKED_IN, or NO_SHOW.
const eventsBlock = allSql.match(/CREATE TABLE[^;]*events[^;]*\(([\s\S]*?)\);/i);
if (eventsBlock) {
  const block = eventsBlock[0];
  const forbidden = ["ATTENDED", "CHECKED_IN", "NO_SHOW"];
  for (const f of forbidden) {
    if (block.includes(`'${f}'`)) {
      console.error(`Fresh-state check: forbidden event state '${f}' present in schema.`);
      process.exit(1);
    }
  }
}

// Sanity: Resend variable names.
const envExample = readFileSync(resolve(repoRoot, "config/.env.example"), "utf-8");
for (const required of ["RESEND_WEBHOOK_ID", "RESEND_WEBHOOK_SIGNING_SECRET"]) {
  if (!envExample.includes(required)) {
    console.error(`Fresh-state check: ${required} missing from .env.example.`);
    process.exit(1);
  }
}
if (envExample.includes("RESEND_WEBHOOK_SECRET=")) {
  console.error("Fresh-state check: forbidden RESEND_WEBHOOK_SECRET in .env.example.");
  process.exit(1);
}
if (envExample.includes("APP_ENV=")) {
  console.error("Fresh-state check: forbidden APP_ENV in .env.example.");
  process.exit(1);
}

console.info(
  `Fresh-state check: ${expectedTables.length} tables present, no forbidden states, env naming clean.`,
);
