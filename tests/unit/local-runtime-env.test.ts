import { mkdtemp, readFile, stat, unlink, writeFile, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { describe, expect, it } from "vitest";
import { createLocalRuntimeEnvFile } from "../../scripts/local-runtime-env.mjs";

describe("local Wrangler runtime env", () => {
  it("copies only allowlisted Worker secrets into a mode-0600 temporary file", async () => {
    const root = await mkdtemp(join(tmpdir(), "pwy-runtime-env-test-"));
    const source = join(root, ".env");
    await writeFile(
      source,
      [
        "RESEND_API_KEY=test-resend",
        "RESEND_FROM=Plans With You <plans@example.com>",
        "OPERATOR_EMAIL=operator@example.com",
        "CF_SECRET_ACCESS_KEY=must-not-copy",
        "ELEVENLABS_API_KEY=must-not-copy",
      ].join("\n"),
      { mode: 0o600 },
    );

    const result = await createLocalRuntimeEnvFile({ source, temporaryRoot: root });
    try {
      expect(result.path).not.toBeNull();
      expect((await stat(result.path!)).mode & 0o777).toBe(0o600);
      const parsed = parseEnv(await readFile(result.path!, "utf8"));
      expect(parsed.RESEND_API_KEY).toBe("test-resend");
      expect(parsed.RESEND_FROM).toBe("Plans With You <plans@example.com>");
      expect(parsed.CF_SECRET_ACCESS_KEY).toBeUndefined();
      expect(parsed.ELEVENLABS_API_KEY).toBeUndefined();
    } finally {
      await result.cleanup();
      await unlink(source);
      await rmdir(root);
    }
  });
});
