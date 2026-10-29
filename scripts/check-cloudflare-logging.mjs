#!/usr/bin/env node
// Fail closed if Astro's generated production Wrangler configuration loses
// query-string redaction. Production deploys use this generated file, not
// the root source wrangler.jsonc. Never print provider settings or secrets.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedConfigPath = resolve(repoRoot, "dist/server/wrangler.json");

export function assertRedactedCloudflareLogging(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Generated Wrangler configuration is missing or invalid");
  }
  if (config.name !== "social-club") {
    throw new Error("Generated Wrangler configuration targets an unexpected Worker");
  }
  if (config.observability?.enabled !== true) {
    throw new Error("Generated Worker logging must remain deliberately enabled");
  }
  if (config.observability?.redact_query_string !== true) {
    throw new Error(
      "Generated Worker must redact query strings before deployment (auth and deletion links include tokens)",
    );
  }
  return true;
}

export function verifyBuiltLoggingPolicy(path = generatedConfigPath) {
  const contents = readFileSync(path, "utf8");
  return assertRedactedCloudflareLogging(JSON.parse(contents));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    verifyBuiltLoggingPolicy();
    console.info("Cloudflare generated Worker logging policy: PASS (query redaction enabled)");
  } catch {
    console.error(
      "Cloudflare generated Worker logging policy: FAIL. Do not deploy until the generated dist/server/wrangler.json explicitly enables query redaction.",
    );
    process.exitCode = 1;
  }
}
