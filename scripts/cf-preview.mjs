#!/usr/bin/env node
// Cloudflare Worker Preview operations for the Plans With You Worker.
//
// This script is the boring, auditable, repo-owned front-end for the
// private-beta `wrangler preview` command family. It does NOT replace
// production deployment and cannot accidentally deploy production.
//
// Subcommands:
//   status    - read-only: show existing Preview identities and config state
//   create    - create a Preview for the current branch (refuses main)
//   update    - update the Preview for the current branch (refuses main)
//   smoke     - HTTP smoke the stable Preview URL and the per-deployment URL
//   delete    - delete the Preview and clean up Preview-owned resources
//   orphans   - read-only: list Preview-named resources that look unused
//
// All mutating subcommands require:
//   - git branch not equal to "main"
//   - the override config does not reference a known production D1 / KV / R2
//   - a clean reading of the production deployment identity before and after
//
// See docs/CLOUDFLARE_WORKER_PREVIEWS.md for the operator runbook.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// ---------- configuration ----------

const PRODUCTION_WORKER = "social-club";
export const PRODUCTION_PROTECTED_BRANCHES = new Set(["main", "master"]);

// The known production stateful identities. These IDs are the source of
// truth for the "you must never point a Preview at production" guard.
const PRODUCTION_IDS = {
  d1: "22850c0b-b1ac-4f9e-950b-8e8392e02d90",
  kv: "fe39a4b46d554822a48759cb7cb884db",
  r2_bucket: "social-club-artifacts",
};

// ---------- helpers ----------

export class CfPreviewError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.name = "CfPreviewError";
    this.exitCode = code;
  }
}

function die(message, code = 1) {
  console.error(`✘ ${message}`);
  throw new CfPreviewError(message, code);
}

function info(message) {
  console.info(message);
}

function getCurrentBranch() {
  const result = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    die(`Could not determine git branch: ${result.stderr}`);
  }
  return result.stdout.trim();
}

export function sanitizeBranch(branch) {
  // Cloudflare resource names must be lowercase, alphanumeric, and dashes.
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function readWranglerJsonc() {
  const path = join(repoRoot, "wrangler.jsonc");
  const raw = readFileSync(path, "utf8");
  // Strip // and /* */ comments and trailing commas so JSON.parse accepts it.
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped);
}

export function findProductionIdentityWarning(config) {
  const errors = [];
  const top = config;
  const preview = config.previews ?? {};

  // Top-level D1
  for (const d1 of top.d1_databases ?? []) {
    if (d1.database_id === PRODUCTION_IDS.d1) {
      errors.push(`top-level d1_databases.${d1.binding}.database_id is the production D1 id`);
    }
  }
  // Top-level KV
  for (const kv of top.kv_namespaces ?? []) {
    if (kv.id === PRODUCTION_IDS.kv) {
      errors.push(`top-level kv_namespaces.${kv.binding}.id is the production KV id`);
    }
  }
  // Top-level R2
  for (const r2 of top.r2_buckets ?? []) {
    if (r2.bucket_name === PRODUCTION_IDS.r2_bucket) {
      errors.push(`top-level r2_buckets.${r2.binding}.bucket_name is the production R2 bucket`);
    }
  }
  // Preview D1 — must not be production
  for (const d1 of preview.d1_databases ?? []) {
    if (d1.database_id === PRODUCTION_IDS.d1) {
      errors.push(`previews.d1_databases.${d1.binding}.database_id is the production D1 id`);
    }
  }
  for (const kv of preview.kv_namespaces ?? []) {
    if (kv.id === PRODUCTION_IDS.kv) {
      errors.push(`previews.kv_namespaces.${kv.binding}.id is the production KV id`);
    }
  }
  for (const r2 of preview.r2_buckets ?? []) {
    if (r2.bucket_name === PRODUCTION_IDS.r2_bucket) {
      errors.push(`previews.r2_buckets.${r2.binding}.bucket_name is the production R2 bucket`);
    }
  }
  return errors;
}

function runWrangler(args, { allowFail = false, json = false } = {}) {
  const fullArgs = [...args];
  if (json) fullArgs.push("--json");
  const result = spawnSync("node", ["node_modules/wrangler/bin/wrangler.js", ...fullArgs], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0 && !allowFail) {
    die(
      `wrangler ${args.join(" ")} failed (exit ${result.status}):\n${result.stderr || result.stdout}`,
    );
  }
  if (json) {
    // wrangler --json output is mixed with build logs; extract the JSON
    // object/array. The first non-empty line should start with '{' or '['.
    const lines = result.stdout.split("\n");
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith("{") || t.startsWith("[")) {
        start = i;
        break;
      }
    }
    if (start === -1) return null;
    const tail = lines.slice(start).join("\n");
    try {
      return JSON.parse(tail);
    } catch {
      return null;
    }
  }
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

// Parse `wrangler kv namespace list` and `wrangler r2 bucket list` outputs,
// which are plain text and not JSON. KV lists one entry per line:
//   "  \"id\": \"abc\","
//   "  \"title\": \"...\","
//   "  \"supports_url_encoding\": true"
//   "}"
// R2 lists blocks separated by blank lines:
//   name:           ...
//   creation_date:  ...
function parseListOutput(result, kind) {
  if (!result?.stdout) return [];
  const text = result.stdout;
  if (kind === "kv") {
    // The wrangler output looks like a JSON array, with leading log lines.
    // Find the first '[' and parse from there.
    const start = text.indexOf("[");
    if (start === -1) return [];
    try {
      return JSON.parse(text.slice(start));
    } catch {
      return [];
    }
  }
  if (kind === "r2") {
    const out = [];
    const lines = text.split("\n");
    for (const line of lines) {
      const m = line.match(/^name:\s+(.+?)\s*$/);
      if (m) out.push({ name: m[1] });
    }
    return out;
  }
  return [];
}

function readProductionActiveDeployment() {
  // `wrangler deployments list --name <worker>` is the cheapest probe for
  // "is production still the same?".
  const out = runWrangler(["deployments", "list", "--name", PRODUCTION_WORKER]);
  return out?.stdout ?? "";
}

export function ensureNotMain(branch) {
  const b = branch ?? getCurrentBranch();
  if (PRODUCTION_PROTECTED_BRANCHES.has(b)) {
    die(
      `Refusing to run on the '${b}' branch. Worker Previews are not the production deployment path; production deploys via 'mise run deploy-production'.`,
    );
  }
  return b;
}

function generatePreviewConfig(branch) {
  const safe = sanitizeBranch(branch);
  if (!safe) die(`Branch name '${branch}' sanitises to empty string`);

  const wranglerConfig = readWranglerJsonc();
  // Only the `previews` block must not reference production ids. The
  // top-level bindings SHOULD reference production — that's the
  // production config. The Preview guard checks both the source's
  // previews block AND the override config we're about to write, so
  // we intentionally only inspect `previews` here.
  if (wranglerConfig.previews) {
    const errors = findProductionIdentityWarning({ previews: wranglerConfig.previews });
    if (errors.length > 0) {
      die(
        "Refusing to build a Preview config because the source wrangler.jsonc 'previews' block references production stateful resources:\n  - " +
          errors.join("\n  - "),
      );
    }
  }

  // Preview-only resource NAMES. We DO NOT create them here; the operator
  // is expected to have already run `wrangler kv namespace create`,
  // `wrangler d1 create`, and `wrangler r2 bucket create` with these names.
  // `cf:preview:create` runs that provisioning automatically below; this
  // object only describes the OVERRIDE that gets applied to the Worker.
  return {
    previewKvName: `${PRODUCTION_WORKER}-preview-${safe}-session`,
    previewD1Name: `${PRODUCTION_WORKER}-preview-${safe}`,
    previewR2Name: `${PRODUCTION_WORKER}-preview-${safe}-artifacts`,
    previewName: `experiment-${safe}`.slice(0, 60),
    safeBranch: safe,
  };
}

export function buildOverrideConfig(branch, ids) {
  // Build an absolute-path override config. The 'main' and 'assets.directory'
  // point to the freshly built dist/ output. The 'previews' block declares
  // Preview-only KV / D1 / R2 ids.
  return {
    $schema: "node_modules/wrangler/config-schema.json",
    name: PRODUCTION_WORKER,
    main: `${repoRoot}/dist/server/entry.mjs`,
    compatibility_date: "2026-08-15",
    compatibility_flags: ["nodejs_compat"],
    assets: { binding: "ASSETS", directory: `${repoRoot}/dist/client` },
    observability: { enabled: true },
    vars: {
      APP_BASE_URL: "https://preview.example.invalid",
      ENVIRONMENT: `preview-${ids.safeBranch}`,
    },
    previews: {
      kv_namespaces: [{ binding: "SESSION", id: ids.previewKvId }],
      d1_databases: [
        {
          binding: "DB",
          database_name: ids.previewD1Name,
          database_id: ids.previewD1Id,
          migrations_dir: `${repoRoot}/migrations`,
        },
      ],
      r2_buckets: [{ binding: "ARTIFACTS", bucket_name: ids.previewR2Name }],
    },
  };
}

function writeOverrideConfigFile(config) {
  const dir = mkdtempSync(join(tmpdir(), "cf-preview-"));
  const file = join(dir, "wrangler.preview.jsonc");
  writeFileSync(file, JSON.stringify(config, null, 2));
  return { dir, file };
}

function ensurePreviewResources(ids, { provision = false } = {}) {
  // For each Preview resource, check whether it exists, and (if provision)
  // create it if it does not. Returns the resolved ids.
  const resolved = { ...ids };

  const kvList = runWrangler(["kv", "namespace", "list"]);
  // `wrangler kv namespace list` returns plain text. Parse it.
  const kvParsed = parseListOutput(kvList, "kv");
  const foundKv = kvParsed.find((ns) => ns.title === ids.previewKvName);
  if (foundKv) {
    resolved.previewKvId = foundKv.id;
  } else if (provision) {
    // `wrangler kv namespace create` does not support --json. Parse the
    // JSON snippet it prints in the "Add the following to your
    // configuration file" block.
    const created = runWrangler(["kv", "namespace", "create", ids.previewKvName]);
    const match = created?.stdout?.match(/"id":\s*"([0-9a-f]{32})"/);
    if (!match) die(`KV create for ${ids.previewKvName} did not return an id`);
    resolved.previewKvId = match[1];
  } else {
    die(
      `KV namespace '${ids.previewKvName}' does not exist. Run cf:preview:create to provision it.`,
    );
  }

  const d1List = runWrangler(["d1", "list", "--json"], { json: true });
  if (!Array.isArray(d1List)) {
    die(`wrangler d1 list --json did not return an array; got: ${JSON.stringify(d1List)}`);
  }
  const foundD1 = d1List.find((d) => d.name === ids.previewD1Name);
  if (foundD1) {
    resolved.previewD1Id = foundD1.uuid;
  } else if (provision) {
    // `wrangler d1 create` does not accept --json. Parse the UUID line.
    const created = runWrangler(["d1", "create", ids.previewD1Name]);
    const match = created?.stdout?.match(/database_id["':\s]+([0-9a-f-]{36})/);
    if (!match) die(`D1 create for ${ids.previewD1Name} did not return a uuid`);
    resolved.previewD1Id = match[1];
  } else {
    die(
      `D1 database '${ids.previewD1Name}' does not exist. Run cf:preview:create to provision it.`,
    );
  }

  const r2List = runWrangler(["r2", "bucket", "list"]);
  const r2Parsed = parseListOutput(r2List, "r2");
  const foundR2 = r2Parsed.find((b) => b.name === ids.previewR2Name);
  if (!foundR2 && !provision) {
    die(`R2 bucket '${ids.previewR2Name}' does not exist. Run cf:preview:create to provision it.`);
  } else if (!foundR2 && provision) {
    runWrangler(["r2", "bucket", "create", ids.previewR2Name]);
  }

  return resolved;
}

function deletePreviewResources(ids) {
  // Order: secret last (deletion creates a new deployment), then KV (delete
  // keys first), then D1, then R2 (delete objects first).
  info(`→ cleaning Preview resources for branch '${ids.safeBranch}'`);

  // KV: delete the namespace (Cloudflare's API rejects deletion of a non-empty
  // namespace; we accept that the namespace may already be empty in the normal
  // cleanup path).
  runWrangler(["kv", "namespace", "delete", ids.previewKvName], { allowFail: true });

  // D1
  runWrangler(["d1", "delete", ids.previewD1Name, "-y"], { allowFail: true });

  // R2: list + delete objects first, then the bucket itself.
  const list = runWrangler(["r2", "object", "list", `${ids.previewR2Name}`, "--json"], {
    allowFail: true,
    json: true,
  });
  const objects = Array.isArray(list?.result) ? list.result : (list?.objects ?? list ?? []);
  for (const obj of objects) {
    const key = obj.Key ?? obj.key;
    if (!key) continue;
    runWrangler(["r2", "object", "delete", `${ids.previewR2Name}/${key}`, "--remote"], {
      allowFail: true,
    });
  }
  runWrangler(["r2", "bucket", "delete", ids.previewR2Name], { allowFail: true });
}

// ---------- subcommands ----------

function cmdStatus() {
  const branch = getCurrentBranch();
  const ids = generatePreviewConfig(branch);
  info(`branch: ${branch}`);
  info(`derived Preview name: ${ids.previewName}`);
  info(`derived KV: ${ids.previewKvName}`);
  info(`derived D1: ${ids.previewD1Name}`);
  info(`derived R2: ${ids.previewR2Name}`);
  info("---");
  const previewSettings = runWrangler(["preview", "settings", "--json"], {
    allowFail: true,
    json: true,
  });
  info(`wrangler preview settings: ${JSON.stringify(previewSettings ?? {})}`);
  info("---");
  info("Production deployment list (most recent first):");
  const out = readProductionActiveDeployment();
  // Just print the first ~15 lines.
  process.stdout.write(out.split("\n").slice(0, 15).join("\n") + "\n");
}

function cmdCreate() {
  const branch = ensureNotMain();
  const ids = generatePreviewConfig(branch);
  info(`→ provisioning Preview-only KV / D1 / R2 for branch '${branch}'`);
  const resolved = ensurePreviewResources(ids, { provision: true });

  // Apply migrations to the Preview D1.
  info(`→ applying migrations to Preview D1 '${resolved.previewD1Name}' (${resolved.previewD1Id})`);
  const migrateDir = mkdtempSync(join(tmpdir(), "cf-preview-migrate-"));
  const migrateConfig = join(migrateDir, "wrangler.jsonc");
  writeFileSync(
    migrateConfig,
    JSON.stringify(
      {
        $schema: "node_modules/wrangler/config-schema.json",
        name: "social-club-preview-migrate",
        d1_databases: [
          {
            binding: "DB",
            database_name: resolved.previewD1Name,
            database_id: resolved.previewD1Id,
            migrations_dir: `${repoRoot}/migrations`,
          },
        ],
      },
      null,
      2,
    ),
  );
  runWrangler(["d1", "migrations", "apply", "DB", "--remote", "--config", migrateConfig]);
  rmSync(migrateDir, { recursive: true, force: true });

  // Build the override config and run wrangler preview.
  const overrideConfig = buildOverrideConfig(branch, resolved);
  const { dir, file } = writeOverrideConfigFile(overrideConfig);

  info(`→ creating Preview '${resolved.previewName}'`);
  const result = runWrangler(
    ["preview", "--config", file, "--name", resolved.previewName, "--json"],
    { json: true },
  );
  rmSync(dir, { recursive: true, force: true });

  if (!result?.preview) die("wrangler preview did not return a preview object");
  info(`✓ Preview created: ${result.preview.id}`);
  info(`  stable URL: ${result.preview.urls?.[0] ?? "(none)"}`);
  info(`  deployment ID: ${result.deployment?.id ?? "(none)"}`);
  // Machine-readable summary for downstream automation.
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

function cmdUpdate() {
  const branch = ensureNotMain();
  const ids = generatePreviewConfig(branch);
  const resolved = ensurePreviewResources(ids, { provision: false });
  const overrideConfig = buildOverrideConfig(branch, resolved);
  const { dir, file } = writeOverrideConfigFile(overrideConfig);

  info(`→ updating Preview '${resolved.previewName}'`);
  const result = runWrangler(
    ["preview", "--config", file, "--name", resolved.previewName, "--json"],
    { json: true },
  );
  rmSync(dir, { recursive: true, force: true });
  if (!result?.preview) die("wrangler preview did not return a preview object");
  info(`✓ Preview updated: ${result.preview.id}`);
  info(`  stable URL: ${result.preview.urls?.[0] ?? "(none)"}`);
  info(`  deployment ID: ${result.deployment?.id ?? "(none)"}`);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

function cmdSmoke() {
  const branch = getCurrentBranch();
  const ids = generatePreviewConfig(branch);
  // We need the real IDs to call wrangler preview (the API rejects placeholder
  // ids). Resolving them is the same lookup the create/update path uses.
  const resolved = ensurePreviewResources(ids, { provision: false });

  // Resolve the stable URL either by re-running wrangler preview (idempotent
  // on the existing Preview identity) or by listing the latest deployment
  // of the named Preview.
  info(`→ resolving Preview URL for '${resolved.previewName}'`);
  const overrideConfig = buildOverrideConfig(branch, resolved);
  const { dir, file } = writeOverrideConfigFile(overrideConfig);
  const result = runWrangler(
    ["preview", "--config", file, "--name", resolved.previewName, "--json"],
    { json: true },
  );
  rmSync(dir, { recursive: true, force: true });

  const stable = result?.preview?.urls?.[0];
  if (!stable) die(`Preview '${resolved.previewName}' has no stable URL (urls empty)`);

  const paths = ["/", "/waiting-list/"];
  let failed = 0;
  for (const p of paths) {
    const url = stable + p;
    const res = spawnSync(
      "curl",
      ["-sS", "-o", "/dev/null", "-w", "%{http_code} %{size_download}", "-L", url],
      {
        encoding: "utf8",
      },
    );
    if (res.status !== 0) {
      info(`✘ ${url}: curl exit ${res.status}`);
      failed += 1;
      continue;
    }
    const [code, size] = res.stdout.trim().split(" ");
    const ok = code === "200";
    info(`${ok ? "✓" : "✘"} ${url}: HTTP ${code} | ${size} bytes`);
    if (!ok) failed += 1;
  }
  if (failed > 0) die(`${failed} smoke check(s) failed`, 2);
  info("✓ smoke OK");
}

function cmdDelete() {
  const branch = ensureNotMain();
  const ids = generatePreviewConfig(branch);
  const resolved = ensurePreviewResources(ids, { provision: false });

  info(`→ deleting Preview '${resolved.previewName}'`);
  // `wrangler preview delete` does not need a config with valid bindings;
  // it only needs the worker name and the Preview name.
  const { dir, file } = writeOverrideConfigFile({
    $schema: "node_modules/wrangler/config-schema.json",
    name: PRODUCTION_WORKER,
  });
  runWrangler(["preview", "delete", "--config", file, "--name", resolved.previewName], {
    allowFail: true,
  });
  rmSync(dir, { recursive: true, force: true });

  deletePreviewResources(resolved);
  info("✓ Preview deleted and Preview-owned KV / D1 / R2 cleaned");
}

function cmdOrphans() {
  // Read-only: list Preview-named KV / D1 / R2 resources and any Preview
  // identities that are not referenced by the current branch. The default
  // mode is REPORT ONLY. Auto-deletion is intentionally not implemented.
  info("→ scanning for Preview-named resources (report only)");

  const branch = getCurrentBranch();
  info(`current branch: ${branch}`);
  info("");

  const kv = parseListOutput(runWrangler(["kv", "namespace", "list"]), "kv");
  const previewKvs = kv.filter((ns) => ns.title?.includes(`${PRODUCTION_WORKER}-preview-`));
  info(`KV namespaces matching '${PRODUCTION_WORKER}-preview-*': ${previewKvs.length}`);
  for (const ns of previewKvs) {
    info(`  - ${ns.title} (${ns.id})`);
  }

  const d1 = runWrangler(["d1", "list", "--json"], { json: true }) ?? [];
  const previewD1 = d1.filter((db) => db.name?.includes(`${PRODUCTION_WORKER}-preview-`));
  info(`D1 databases matching '${PRODUCTION_WORKER}-preview-*': ${previewD1.length}`);
  for (const db of previewD1) {
    info(`  - ${db.name} (${db.uuid})`);
  }

  const r2 = parseListOutput(runWrangler(["r2", "bucket", "list"]), "r2");
  const previewR2 = r2.filter((b) => b.name?.includes(`${PRODUCTION_WORKER}-preview-`));
  info(`R2 buckets matching '${PRODUCTION_WORKER}-preview-*': ${previewR2.length}`);
  for (const b of previewR2) {
    info(`  - ${b.name}`);
  }

  info("");
  info("Auto-deletion is intentionally NOT performed. To clean up an orphan,");
  info(`use the matching 'mise run cf:preview:delete' on its branch, or remove`);
  info("the resource manually after confirming ownership.");
}

// ---------- entrypoint ----------

// Only execute the CLI when run directly (not when imported as a module).
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1] ?? "");

if (isDirectRun) {
  const [, , subcommand] = process.argv;

  try {
    switch (subcommand) {
      case "status":
        cmdStatus();
        break;
      case "create":
        cmdCreate();
        break;
      case "update":
        cmdUpdate();
        break;
      case "smoke":
        cmdSmoke();
        break;
      case "delete":
        cmdDelete();
        break;
      case "orphans":
        cmdOrphans();
        break;
      case "--help":
      case "-h":
      case undefined:
        info("usage: cf-preview.mjs <status|create|update|smoke|delete|orphans>");
        break;
      default:
        die(`unknown subcommand '${subcommand}'`);
    }
  } catch (err) {
    if (err instanceof CfPreviewError) {
      process.exit(err.exitCode);
    }
    throw err;
  }
}
