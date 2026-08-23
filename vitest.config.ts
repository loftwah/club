import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@domain": resolve(__dirname, "src/domain"),
      "@services": resolve(__dirname, "src/services"),
      "@adapters": resolve(__dirname, "src/adapters"),
      "@infra": resolve(__dirname, "src/infra"),
      "@components": resolve(__dirname, "src/components"),
      "@layouts": resolve(__dirname, "src/layouts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".wrangler"],
    testTimeout: 10_000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
