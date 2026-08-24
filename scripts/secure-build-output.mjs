#!/usr/bin/env node
// Astro's Cloudflare build may copy local development variables beside the
// generated Worker. They are unnecessary for deploy/dev because Wrangler
// loads the root ignored environment file itself. Remove the generated copy
// so build output never becomes a second secret store.

import { lstat, rm } from "node:fs/promises";
import { resolve } from "node:path";

const target = resolve("dist/server/.dev.vars");
const allowed = resolve("dist/server/.dev.vars");
if (target !== allowed) throw new Error("Refusing to clean an unexpected build secret path.");

try {
  const info = await lstat(target);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error("Refusing to clean a non-regular build secret path.");
  }
  await rm(target);
  console.info("[secure-build-output] removed generated dist/server/.dev.vars");
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    console.info("[secure-build-output] no generated build secret file present");
  } else {
    throw error;
  }
}
