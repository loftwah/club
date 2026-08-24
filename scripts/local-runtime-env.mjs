import { lstat, mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";

/** Secrets that are intentionally available to the local Worker runtime. */
export const LOCAL_RUNTIME_SECRET_KEYS = Object.freeze([
  "RESEND_API_KEY",
  "RESEND_FROM",
  "RESEND_WEBHOOK_ID",
  "RESEND_WEBHOOK_SIGNING_SECRET",
  "OPERATOR_EMAIL",
  "MINIMAX_API_KEY",
]);

/**
 * Create a least-privilege Wrangler env file outside the repository. R2,
 * Cloudflare and generation-only credentials in the source file are never
 * copied into the Worker runtime. The caller must invoke cleanup.
 */
export async function createLocalRuntimeEnvFile({
  source = resolve(".env"),
  temporaryRoot = tmpdir(),
} = {}) {
  let sourceInfo;
  try {
    sourceInfo = await lstat(source);
  } catch (error) {
    if (error?.code === "ENOENT") return emptyResult();
    throw error;
  }
  if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
    throw new Error("Local runtime env source must be a regular file, not a symlink.");
  }

  const parsed = parseEnv(await readFile(source, "utf8"));
  const entries = LOCAL_RUNTIME_SECRET_KEYS.flatMap((key) =>
    typeof parsed[key] === "string" && parsed[key].length > 0 ? [[key, parsed[key]]] : [],
  );
  if (entries.length === 0) return emptyResult();

  const directory = await mkdtemp(join(temporaryRoot, "pwy-wrangler-env-"));
  const path = join(directory, "runtime.env");
  const contents = `${entries.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n")}\n`;
  await writeFile(path, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });

  let cleaned = false;
  return {
    path,
    keys: entries.map(([key]) => key),
    async cleanup() {
      if (cleaned) return;
      cleaned = true;
      await unlink(path).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
      await rmdir(directory).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
    },
  };
}

function emptyResult() {
  return { path: null, keys: [], cleanup: async () => {} };
}
