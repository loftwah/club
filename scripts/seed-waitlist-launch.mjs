#!/usr/bin/env node
// Production seed for the waitlist-only launch.
//
// Inserts the minimum reference data required for the public site
// and the waitlist form to function correctly:
//
//   - 1 chapter (Melbourne, ACTIVE)
//   - 5 chapters total (Melbourne ACTIVE; Sydney/Brisbane/Adelaide/Perth COMING)
//   - 3 membership tiers (Member, Corresponding Member, Deluxe Member)
//   - Tier capabilities for each tier (event, milestone, etc.)
//
// Idempotent: every insert uses INSERT OR IGNORE so the script
// can be re-run safely. After the seed runs, the waitlist form
// can accept a chapterId, the membership page shows the three
// tiers, and the locked-brand production identity is in place.
//
// Usage:  node scripts/seed-waitlist-launch.mjs
// Env:    --remote flag is forwarded to wrangler when set
//
//   $ node scripts/seed-waitlist-launch.mjs --remote

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const wrangler = resolve(repoRoot, "node_modules/wrangler/bin/wrangler.js");
const dbName = "social-club";
const remoteFlag = process.argv.includes("--remote") ? "--remote" : "--local";

const now = new Date().toISOString();

function runWrangler(args) {
  const result = spawnSync(wrangler, args, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function execSql(sql) {
  const r = runWrangler(["d1", "execute", dbName, remoteFlag, "--command", sql]);
  if (r.status !== 0) {
    console.error("FAILED:", sql.slice(0, 120));
    console.error(r.stderr);
    process.exit(1);
  }
}

const chapters = [
  { id: "chap_melbourne", slug: "melbourne", name: "Melbourne", status: "ACTIVE" },
  { id: "chap_sydney", slug: "sydney", name: "Sydney", status: "COMING" },
  { id: "chap_brisbane", slug: "brisbane", name: "Brisbane", status: "COMING" },
  { id: "chap_adelaide", slug: "adelaide", name: "Adelaide", status: "COMING" },
  { id: "chap_perth", slug: "perth", name: "Perth", status: "COMING" },
];

const tiers = [
  { id: "tier_member", slug: "member", display_name: "Member", price_cents: 500 },
  {
    id: "tier_correspondence",
    slug: "correspondence",
    display_name: "Corresponding Member",
    price_cents: 2000,
  },
  { id: "tier_deluxe", slug: "deluxe", display_name: "Deluxe Member", price_cents: 5000 },
];

const capabilities = {
  tier_member: ["EVENTS", "DIGITAL_BIRTHDAY"],
  tier_correspondence: [
    "EVENTS",
    "DIGITAL_BIRTHDAY",
    "PHYSICAL_CORRESPONDENCE",
    "MILESTONE_ARTEFACT",
  ],
  tier_deluxe: [
    "EVENTS",
    "DIGITAL_BIRTHDAY",
    "PHYSICAL_CORRESPONDENCE",
    "MILESTONE_ARTEFACT",
    "GIFTS",
    "CALLS",
  ],
};

console.info(`Seeding waitlist launch data (${remoteFlag})...`);

// Chapters
for (const c of chapters) {
  execSql(
    `INSERT OR IGNORE INTO chapters (id, slug, name, status, created_at) VALUES ('${c.id}', '${c.slug}', '${c.name}', '${c.status}', '${now}');`,
  );
}
console.info(`  ${chapters.length} chapters`);

// Membership tiers
for (const t of tiers) {
  execSql(
    `INSERT OR IGNORE INTO membership_tiers (id, slug, display_name, price_cents, currency, created_at) VALUES ('${t.id}', '${t.slug}', '${t.display_name}', ${t.price_cents}, 'AUD', '${now}');`,
  );
}
console.info(`  ${tiers.length} membership tiers`);

// Tier capabilities
let capCount = 0;
for (const [tierId, caps] of Object.entries(capabilities)) {
  for (const cap of caps) {
    execSql(
      `INSERT OR IGNORE INTO tier_capabilities (tier_id, capability, enabled) VALUES ('${tierId}', '${cap}', 1);`,
    );
    capCount++;
  }
}
console.info(`  ${capCount} tier capabilities`);

console.info("\nSeed complete.");
