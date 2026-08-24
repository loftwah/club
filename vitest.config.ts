import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@domain": resolve(import.meta.dirname, "src/domain"),
      "@services": resolve(import.meta.dirname, "src/services"),
      "@adapters": resolve(import.meta.dirname, "src/adapters"),
      "@infra": resolve(import.meta.dirname, "src/infra"),
      "@components": resolve(import.meta.dirname, "src/components"),
      "@layouts": resolve(import.meta.dirname, "src/layouts"),
      "@lib": resolve(import.meta.dirname, "src/lib"),
      "cloudflare:workers": resolve(import.meta.dirname, "tests/support/cloudflare-workers.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".wrangler"],
    testTimeout: 10_000,
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
  },
});
