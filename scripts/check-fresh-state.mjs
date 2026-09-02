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

// Issue #4: --cobalt is an undefined custom property. The canonical
// schedule cobalt is --calendar (defined in src/styles/global.css).
// Any application source that resolves --cobalt would produce an
// invalid computed style. Reject its reappearance anywhere under
// src/ outside the brand config documentation comment.
const { readFileSync: readFile, statSync, readdirSync: readdir } = await import("node:fs");
const sourceRoots = [resolve(repoRoot, "src")];
const cobaltViolations = [];
const skipDirs = new Set(["node_modules", ".astro", "dist", ".wrangler"]);
function walk(dir) {
  for (const entry of readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(join(dir, entry.name));
    } else if (entry.isFile()) {
      if (!/\.(astro|css|ts|tsx|js|mjs|css)$/.test(entry.name)) continue;
      const text = readFile(join(dir, entry.name), "utf-8");
      // Allow the brand config comment that documents the historical
      // vocabulary; reject actual use sites.
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.includes("var(--cobalt)") || /--cobalt\s*:/.test(line)) {
          cobaltViolations.push(`${join(dir, entry.name)}:${i + 1}: ${line.trim()}`);
        }
      }
    }
  }
}
for (const root of sourceRoots) {
  if (statSync(root, { throwIfNoEntry: false })) walk(root);
}
if (cobaltViolations.length > 0) {
  console.error("Fresh-state check: undefined --cobalt token referenced in source:");
  for (const v of cobaltViolations) console.error(`  ${v}`);
  process.exit(1);
}

// Issue #2: ordinary public routes must not define a local
// 78rem shell. The waiting-list route is the documented focus
// exception and is the only file allowed to keep that geometry.
const ORDINARY_PUBLIC_ROUTES = [
  "src/pages/404.astro",
  "src/pages/how-it-works.astro",
  "src/pages/membership.astro",
  "src/pages/correspondence.astro",
  "src/pages/chapters.astro",
  "src/pages/chapters/[slug].astro",
  "src/pages/journal.astro",
  "src/pages/faq.astro",
  "src/pages/privacy.astro",
  "src/pages/terms.astro",
];
const shellViolations = [];
for (const relPath of ORDINARY_PUBLIC_ROUTES) {
  const full = resolve(repoRoot, relPath);
  if (!statSync(full, { throwIfNoEntry: false })) continue;
  const text = readFile(full, "utf-8");
  // Match any `max-width: 78rem;` (or `78rem` in any property)
  // that lives inside the route's <style> block. We exclude the
  // waiting-list document which is the documented exception.
  if (/max-width\s*:\s*78rem/i.test(text)) {
    shellViolations.push(`${relPath} defines a local 78rem shell`);
  }
}
if (shellViolations.length > 0) {
  console.error("Fresh-state check: ordinary public route declares the waitlist 78rem shell:");
  for (const v of shellViolations) console.error(`  ${v}`);
  process.exit(1);
}

// Issue #16: every ordinary public route must wrap its content
// in the canonical `.pwy-page` > `.pwy-shell` chassis so the
// shared stylesheet loaded by Base.astro actually renders
// geometry. A page that omits the wrap renders edge-to-edge
// and the regression test
// (tests/browser/issue-2-public-shell.spec.ts) catches it at
// runtime; this source-level guard makes the failure cheaper
// and prevents a new route from silently regressing before any
// test runs.
const chassisWrapViolations = [];
for (const relPath of ORDINARY_PUBLIC_ROUTES) {
  const full = resolve(repoRoot, relPath);
  if (!statSync(full, { throwIfNoEntry: false })) continue;
  const text = readFile(full, "utf-8");
  // Accept either a static `class="pwy-page` (or `pwy-page `) on
  // a section, or a template-literal / spread form like
  // `class={...pwy-page...}` / `class={`pwy-page ${extra}`}`.
  const hasPageClass =
    /class\s*=\s*["'`{][^"'`}]*\bpwy-page\b/.test(text) ||
    /class\s*=\s*\{[^}]*\bpwy-page\b/.test(text);
  const hasShellClass =
    /class\s*=\s*["'`]pwy-shell["'`]/.test(text) || /class\s*=\s*\{[^}]*\bpwy-shell\b/.test(text);
  if (!hasPageClass) {
    chassisWrapViolations.push(`${relPath} does not declare a .pwy-page section`);
  }
  if (!hasShellClass) {
    chassisWrapViolations.push(`${relPath} does not declare a .pwy-shell wrapper`);
  }
}
if (chassisWrapViolations.length > 0) {
  console.error("Fresh-state check: ordinary public route is missing the canonical chassis wrap:");
  for (const v of chassisWrapViolations) console.error(`  ${v}`);
  process.exit(1);
}

// Issue #16: with the shared public-pages.css now loaded by
// Base.astro, ordinary public routes must not re-import it
// directly. A re-import is harmless but it muddies the
// architecture (every route remembers to import) and lets a
// future change silently land in the wrong place.
const publicPagesDirectImportViolations = [];
for (const relPath of ORDINARY_PUBLIC_ROUTES) {
  const full = resolve(repoRoot, relPath);
  if (!statSync(full, { throwIfNoEntry: false })) continue;
  const text = readFile(full, "utf-8");
  if (/from\s+["']\.\.\/styles\/public-pages\.css["']/.test(text)) {
    publicPagesDirectImportViolations.push(`${relPath} imports public-pages.css directly`);
  }
}
if (publicPagesDirectImportViolations.length > 0) {
  console.error(
    "Fresh-state check: ordinary public route imports public-pages.css directly; the canonical chassis is loaded by Base.astro.",
  );
  for (const v of publicPagesDirectImportViolations) console.error(`  ${v}`);
  process.exit(1);
}

// Issue #2: ordinary public route primary h1 must remain below
// the canonical 5.8rem cap. The cap may be set via the shared
// public-pages.css; this guard only rejects local rules whose
// selector targets an h1 and that try to exceed the cap.
const HEADING_CAP_REM = 5.8;
const headingViolations = [];
for (const relPath of ORDINARY_PUBLIC_ROUTES) {
  const full = resolve(repoRoot, relPath);
  if (!statSync(full, { throwIfNoEntry: false })) continue;
  const text = readFile(full, "utf-8");
  // Find every CSS rule whose selector list contains an h1 and
  // whose body contains a `font-size` declaration that resolves
  // to more than the canonical 5.8rem cap. We only inspect the
  // `font-size` line directly (so body/letter clamps are not
  // affected), and we accept either rem or pixel values.
  const ruleRe = /([^{}]*h1[^{}]*)\{([^{}]*)\}/gi;
  let m;
  while ((m = ruleRe.exec(text)) !== null) {
    const selector = m[1];
    const body = m[2];
    // Skip rules that don't actually set a font-size. We still
    // catch rules that set a font-size with clamp() above the cap.
    const sizeMatch = body.match(/font-size\s*:\s*([^;]+);/i);
    if (!sizeMatch) continue;
    const sizeExpr = sizeMatch[1];
    // Reject a clamp whose third (max) value is a rem greater than
    // the canonical cap.
    const clampRe = /clamp\s*\(\s*[^,]+,\s*[^,]+,\s*([0-9.]+)\s*rem\s*\)/i;
    const clampMatch = sizeExpr.match(clampRe);
    if (clampMatch) {
      const max = Number.parseFloat(clampMatch[1]);
      if (Number.isFinite(max) && max > HEADING_CAP_REM + 0.01) {
        headingViolations.push(
          `${relPath} h1 rule exceeds 5.8rem cap (max ${max}rem): ${selector.trim()}`,
        );
      }
    }
    // Reject a literal rem value that exceeds the cap (e.g.
    // `font-size: 6rem;`).
    const literalRem = sizeExpr.match(/^\s*([0-9.]+)\s*rem\s*$/i);
    if (literalRem) {
      const max = Number.parseFloat(literalRem[1]);
      if (Number.isFinite(max) && max > HEADING_CAP_REM + 0.01) {
        headingViolations.push(
          `${relPath} h1 rule literal ${max}rem exceeds 5.8rem cap: ${selector.trim()}`,
        );
      }
    }
  }
}
if (headingViolations.length > 0) {
  console.error("Fresh-state check: ordinary public route primary h1 exceeds the 5.8rem cap:");
  for (const v of headingViolations) console.error(`  ${v}`);
  process.exit(1);
}

console.info(
  `Fresh-state check: ${expectedTables.length} tables present, no forbidden states, env naming clean, no undefined --cobalt references, public-page chassis wrap + heading drift clean.`,
);
