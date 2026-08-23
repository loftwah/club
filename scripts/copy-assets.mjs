#!/usr/bin/env node
// Copy the Astro-emitted hashed client assets from dist/_astro into
// public/_astro so that the wrangler `assets` binding (which points
// at public/) can serve them. Without this copy the homepage CSS/JS
// would 404 in plain-Worker dev (Cloudflare Pages serves them
// automatically; wrangler dev does not).
//
// We use a copy rather than a symlink because the wrangler assets
// uploader does not follow symlinks reliably.

import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = process.cwd();
const src = resolve(repoRoot, "dist/_astro");
const dest = resolve(repoRoot, "public/_astro");

function copyRecursive(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const s = join(from, entry);
    const d = join(to, entry);
    const st = statSync(s);
    if (st.isDirectory()) {
      copyRecursive(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
}

try {
  copyRecursive(src, dest);
  console.info(`[copy-assets] dist/_astro -> public/_astro`);
} catch (err) {
  if (err && err.code === "ENOENT") {
    console.warn(`[copy-assets] no dist/_astro to copy (build may have failed)`);
    process.exit(0);
  }
  throw err;
}
