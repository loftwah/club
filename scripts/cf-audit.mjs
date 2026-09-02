#!/usr/bin/env node
// Cloudflare account / resource audit for the Plans With You project.
//
// This script is the boring, read-only, repo-owned version of
// `wrangler whoami` + `wrangler d1 list` + `wrangler kv namespace list` +
// `wrangler r2 bucket list` + the equivalent API calls for routes / cron
// / queues / observability / workers-builds. It prints a human-readable
// summary and writes a machine-readable JSON report to a file.
//
// Default mode: read-only. There is intentionally no `--cleanup` mode.
// Mutation belongs in `cf-preview.mjs` (Preview lifecycle) or in a
// dedicated follow-up, never here.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// ---------- configuration ----------

const ACCOUNT_ID = "1003dc1d93af0ebea56b2f1252f89627";
const ACCOUNT_NAME = "Loftwah";
const API_BASE = "https://api.cloudflare.com/client/v4";
const PRODUCTION_WORKER = "social-club";

// Club-owned resource identifiers. The audit highlights anything else
// that matches the Club naming prefix so it can be triaged.
const CLUB_PREFIX = "social-club";
const PRODUCTION_KNOWN = {
  d1: "22850c0b-b1ac-4f9e-950b-8e8392e02d90",
  kv: "fe39a4b46d554822a48759cb7cb884db",
  r2: "social-club-artifacts",
  queue: "social-club-jobs",
};

// ---------- helpers ----------

// The audit is read-only. There is no intentional fatal-exit path;
// if a section's API call fails it just prints "(failed to ...)" and
// continues.

function info(message) {
  console.info(message);
}

function apiGet(path) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    info(`  (skipped, no CLOUDFLARE_API_TOKEN set: ${path})`);
    return null;
  }
  const result = spawnSync(
    "curl",
    ["-sS", "-H", `Authorization: Bearer ${token}`, `${API_BASE}${path}`],
    { encoding: "utf8", timeout: 30_000 },
  );
  if (result.status !== 0) {
    info(`  (curl failed for ${path}: ${result.stderr})`);
    return null;
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function wranglerList(args) {
  const result = spawnSync("node", ["node_modules/wrangler/bin/wrangler.js", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  return result.stdout;
}

export function parseKvList(text) {
  if (!text) return [];
  const start = text.indexOf("[");
  if (start === -1) return [];
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return [];
  }
}

export function parseR2List(text) {
  if (!text) return [];
  const out = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^name:\s+(.+?)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

export function parseD1List(text) {
  if (!text) return [];
  const start = text.indexOf("[");
  if (start === -1) return [];
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return [];
  }
}

// ---------- sections ----------

function sectionAuth() {
  info("== account ==");
  const out = wranglerList(["whoami"]);
  if (!out) {
    info("  (wrangler whoami failed)");
    return { account: null };
  }
  // The whoami box-drawing layout puts the header on one line and the
  // data on the next. Match the data line, which contains the 32-char
  // account id and the account name.
  const dataLine = out
    .split("\n")
    .map((l) => l)
    .find((l) => /[0-9a-f]{32}/.test(l));
  const accountId = dataLine?.match(/([0-9a-f]{32})/)?.[1] ?? null;
  // Name is the first non-empty token after the box-drawing chars.
  const name =
    dataLine
      ?.replace(/[│┌┐└┘─]/g, " ")
      .split(/\s+/)
      .filter((s) => s && s !== "Account" && s !== "ID" && s !== "Name")
      .find((s) => /^[A-Za-z0-9_-]+$/.test(s)) ?? null;
  info(`  name: ${name ?? "?"}`);
  info(`  id:   ${accountId ?? "?"}`);
  return {
    account: { id: accountId, name },
  };
}

function sectionWorkers() {
  info("== workers ==");
  const data = apiGet(`/accounts/${ACCOUNT_ID}/workers/scripts`);
  if (!data?.success) {
    info("  (failed to list workers)");
    return { workers: [] };
  }
  const scripts = data.result;
  const sorted = [...scripts].sort((a, b) => a.id.localeCompare(b.id));
  info(`  total: ${sorted.length}`);
  for (const s of sorted) {
    const flag =
      s.id === PRODUCTION_WORKER
        ? " ← Club production"
        : s.id.startsWith(`${CLUB_PREFIX}-`)
          ? " ← Club disposable"
          : "";
    info(
      `  - ${s.id} (created ${s.created_on?.slice(0, 10)}, modified ${s.modified_on?.slice(0, 10)})${flag}`,
    );
  }
  return {
    workers: sorted.map((s) => ({ id: s.id, created: s.created_on, modified: s.modified_on })),
  };
}

function sectionD1() {
  info("== d1 databases ==");
  const out = wranglerList(["d1", "list", "--json"]);
  const dbs = parseD1List(out);
  info(`  total: ${dbs.length}`);
  for (const db of dbs) {
    const flag =
      db.uuid === PRODUCTION_KNOWN.d1
        ? " ← Club production"
        : db.name?.startsWith(`${CLUB_PREFIX}-`)
          ? " ← Club disposable/orphan"
          : "";
    info(`  - ${db.name} (${db.uuid})${flag}`);
  }
  return { d1: dbs.map((d) => ({ name: d.name, uuid: d.uuid, version: d.version })) };
}

function sectionKV() {
  info("== kv namespaces ==");
  const out = wranglerList(["kv", "namespace", "list"]);
  const kvs = parseKvList(out);
  info(`  total: ${kvs.length}`);
  for (const kv of kvs) {
    const flag =
      kv.id === PRODUCTION_KNOWN.kv
        ? " ← Club production"
        : kv.title?.startsWith(`${CLUB_PREFIX}-preview-`)
          ? " ← Club preview"
          : "";
    info(`  - ${kv.title} (${kv.id})${flag}`);
  }
  return { kv: kvs.map((k) => ({ id: k.id, title: k.title })) };
}

function sectionR2() {
  info("== r2 buckets ==");
  const out = wranglerList(["r2", "bucket", "list"]);
  const buckets = parseR2List(out);
  info(`  total: ${buckets.length}`);
  for (const b of buckets) {
    const flag =
      b === PRODUCTION_KNOWN.r2
        ? " ← Club production"
        : b.startsWith(`${CLUB_PREFIX}-`)
          ? " ← Club disposable"
          : "";
    info(`  - ${b}${flag}`);
  }
  return { r2: buckets };
}

function sectionSocialClubCron() {
  info("== social-club cron triggers ==");
  const data = apiGet(`/accounts/${ACCOUNT_ID}/workers/scripts/${PRODUCTION_WORKER}/schedules`);
  if (!data?.success) {
    info("  (failed to list cron triggers)");
    return { cron: [] };
  }
  const schedules = data.result?.schedules ?? [];
  info(`  total: ${schedules.length}`);
  for (const s of schedules) {
    info(`  - cron: ${s.cron} (created ${s.created_on})`);
  }
  return { cron: schedules };
}

function sectionSocialClubRoutes() {
  info("== social-club subdomain state ==");
  const data = apiGet(`/accounts/${ACCOUNT_ID}/workers/scripts/${PRODUCTION_WORKER}/subdomain`);
  if (!data?.success) {
    info("  (failed to read subdomain state)");
    return { subdomain: null };
  }
  const { enabled, previews_enabled } = data.result;
  info(`  workers.dev enabled:     ${enabled}`);
  info(`  workers.dev previews:    ${previews_enabled}`);
  return { subdomain: data.result };
}

function sectionQueues() {
  info("== queues ==");
  const data = apiGet(`/accounts/${ACCOUNT_ID}/queues`);
  if (!data?.success) {
    info("  (failed to list queues)");
    return { queues: [] };
  }
  const queues = data.result ?? [];
  info(`  total: ${queues.length}`);
  for (const q of queues) {
    const flag = q.queue_name === PRODUCTION_KNOWN.queue ? " ← Club reserved" : "";
    info(`  - ${q.queue_name} (${q.queue_id})${flag}`);
  }
  return { queues: queues.map((q) => ({ name: q.queue_name, id: q.queue_id })) };
}

function sectionObservability() {
  info("== social-club observability ==");
  const data = apiGet(`/accounts/${ACCOUNT_ID}/workers/scripts/${PRODUCTION_WORKER}/settings`);
  if (!data?.success) {
    info("  (failed to read settings)");
    return { observability: null };
  }
  const obs = data.result?.observability;
  if (!obs) {
    info("  observability: not set on the Worker");
    return { observability: null };
  }
  info(`  enabled:        ${obs.enabled}`);
  info(`  head_sampling:  ${obs.head_sampling_rate}`);
  info(`  redact_qs:      ${obs.redact_query_string}`);
  info(`  logs.enabled:   ${obs.logs?.enabled}`);
  info(`  logs.head_rate: ${obs.logs?.head_sampling_rate}`);
  info(`  traces.enabled: ${obs.traces?.enabled}`);
  return { observability: obs };
}

function sectionWorkersBuilds() {
  info("== workers builds ==");
  const data = apiGet(`/accounts/${ACCOUNT_ID}/workers/builds/triggers`);
  if (!data) {
    info("  (no API response)");
    return { workersBuilds: null };
  }
  if (data.success === false) {
    info(`  workers builds: NOT ENABLED (${data.errors?.[0]?.code ?? "?"})`);
    return { workersBuilds: { enabled: false } };
  }
  info(`  workers builds: ENABLED (triggers configured: ${data.result?.length ?? "?"})`);
  return { workersBuilds: { enabled: true, triggers: data.result } };
}

function sectionFindings() {
  info("== findings ==");
  const findings = [];

  // The audit is read-only; findings are observations, not actions.
  info("");
  info("Read-only by design. For the actionable list see:");
  info("  docs/CLOUDFLARE_OPERATIONS.md");
  info("  docs/CLOUDFLARE_WORKER_PREVIEWS_LAB.md");
  info("  docs/CLOUDFLARE_WORKER_PREVIEWS.md");
  return { findings };
}

// ---------- entrypoint ----------

const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1] ?? "");

if (isDirectRun) {
  info(`Cloudflare audit — ${new Date().toISOString()}`);
  info("");

  const report = {
    timestamp: new Date().toISOString(),
    account: { id: ACCOUNT_ID, name: ACCOUNT_NAME },
    ...sectionAuth(),
    ...sectionWorkers(),
    ...sectionD1(),
    ...sectionKV(),
    ...sectionR2(),
    ...sectionSocialClubCron(),
    ...sectionSocialClubRoutes(),
    ...sectionQueues(),
    ...sectionObservability(),
    ...sectionWorkersBuilds(),
    ...sectionFindings(),
  };

  const outDir = join(repoRoot, "out", "cf-audit");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));
  info("");
  info(`✓ report written to ${outFile}`);
}
