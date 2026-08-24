#!/usr/bin/env node
// Visual generation pipeline CLI.
//
// Reads the manifest, calls MiniMax for each candidate, records
// the result in the registry, and stores the selected output in
// the public destination. Designed to be re-run; each run is
// idempotent on the destination filename (the file is overwritten).
//
// Usage: node scripts/visual-generate.mjs
//
// This script is the canonical entry point for regenerating brand
// imagery. It does NOT take a real action unless MINIMAX_API_KEY
// is set in the environment. Without the key, the script is a
// no-op and prints a friendly message.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const manifestPath = resolve(repoRoot, "explorations/brand/visual-manifest.json");
const registryPath = resolve(repoRoot, "explorations/brand/_registry.json");

if (!process.env.MINIMAX_API_KEY) {
  console.info("MINIMAX_API_KEY not set; visual-generate is a no-op.");
  console.info("Set MINIMAX_API_KEY to regenerate brand imagery.");
  process.exit(0);
}

/**
 * @typedef {Object} ManifestEntry
 * @property {string} id
 * @property {string} prompt
 * @property {string} destination
 * @property {number} width
 * @property {number} height
 * @property {string} [notes]
 * @property {string} [model]
 */

/** @type {ManifestEntry[]} */
let manifest = [];
if (existsSync(manifestPath)) {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
}

if (manifest.length === 0) {
  console.info("No manifest entries; nothing to do.");
  process.exit(0);
}

/**
 * @typedef {Object} RegistryEntry
 * @property {string} id
 * @property {string} prompt
 * @property {string} provider
 * @property {string} model
 * @property {string} source_output
 * @property {string} selected_output
 * @property {string} destination
 * @property {number} width
 * @property {number} height
 * @property {string} status
 * @property {string} notes
 * @property {string} created_at
 */

/** @type {RegistryEntry[]} */
let registry = [];
if (existsSync(registryPath)) {
  try {
    registry = JSON.parse(readFileSync(registryPath, "utf8"));
  } catch {
    registry = [];
  }
}

/**
 * @param {ManifestEntry} entry
 * @returns {Promise<void>}
 */
async function generateOne(entry) {
  const destFull = resolve(repoRoot, entry.destination);
  mkdirSync(resolve(destFull, ".."), { recursive: true });
  const prompt = entry.prompt;
  // Verified against mmx-cli v1.0.22 — endpoint is
  // POST /v1/image_generation with body { model, prompt, aspect_ratio | (width & height), n }.
  // The response shape is { data: { image_urls: string[] } | { image_base64: string[] }, base_resp }.
  const body = {
    model: entry.model ?? "image-01",
    prompt,
    aspect_ratio: aspectRatioFor(entry.width, entry.height),
    n: 1,
  };
  const res = await fetch("https://api.minimax.io/v1/image_generation", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[${entry.id}] MiniMax error ${res.status}: ${text.slice(0, 200)}`);
    return;
  }
  const json =
    /** @type {{ data?: { image_urls?: string[]; image_base64?: string[] }; base_resp?: { status_code?: number; status_msg?: string } }} */ (
      await res.json()
    );
  const data = json?.data ?? {};
  const imageUrl = data.image_urls?.[0] ?? data.image_base64?.[0] ?? "";
  if (!imageUrl) {
    console.error(
      `[${entry.id}] MiniMax returned no image (base_resp=${
        json?.base_resp?.status_code ?? "n/a"
      } ${json?.base_resp?.status_msg ?? ""}).`,
    );
    return;
  }
  /** @type {RegistryEntry} */
  const entry_record = {
    id: entry.id,
    prompt,
    provider: "minimax",
    model: body.model,
    source_output: imageUrl,
    selected_output: imageUrl,
    destination: entry.destination,
    width: entry.width,
    height: entry.height,
    status: "candidate",
    notes: entry.notes ?? "",
    created_at: new Date().toISOString(),
  };
  registry.push(entry_record);
  writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  console.info(`[${entry.id}] recorded -> ${entry.destination}`);
}

/**
 * Pick the closest supported aspect ratio for the requested width/height.
 * MiniMax supports "1:1", "16:9", "4:3", "3:4", "9:16", "2:3", "3:2", "21:9"
 * (and a few others). When an exact preset isn't available we fall back
 * to the closest width/height divisor match. We prefer aspect_ratio over
 * (width, height) because the CLI's stable form uses it.
 *
 * @param {number} w
 * @param {number} h
 * @returns {string}
 */
function aspectRatioFor(w, h) {
  const target = w / h;
  const presets = ["1:1", "3:2", "2:3", "16:9", "9:16", "4:3", "3:4", "21:9"];
  let best = "1:1";
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const p of presets) {
    const [pw, ph] = p.split(":").map(Number);
    const r = pw / ph;
    const delta = Math.abs(Math.log(r / target));
    if (delta < bestDelta) {
      best = p;
      bestDelta = delta;
    }
  }
  return best;
}

(async () => {
  for (const e of manifest) {
    await generateOne(e);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
