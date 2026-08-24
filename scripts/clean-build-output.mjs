#!/usr/bin/env node
// Remove only generated build output so hashed assets from an older build can
// never be copied into a new Worker deployment or counted by bundle budgets.

import { rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const targets = [resolve(repoRoot, "dist"), resolve(repoRoot, "public/_astro")];

for (const target of targets) {
  const safeTarget =
    (basename(target) === "dist" && dirname(target) === repoRoot) ||
    (basename(target) === "_astro" && dirname(target) === resolve(repoRoot, "public"));
  if (!safeTarget) throw new Error(`Refusing to clean unexpected path: ${target}`);
  rmSync(target, { recursive: true, force: true });
  console.info(`[clean-build-output] removed generated ${target.slice(repoRoot.length + 1)}`);
}
