// Playwright config for browser E2E. The acceptance script:
//   1. builds the Worker (astro build)
//   2. starts wrangler dev on port 8788
//   3. runs Playwright against it
//   4. stops wrangler dev
//
// We do not run a separate dev server from Playwright because the
// canonical local run is `wrangler dev` (workerd, the real runtime).

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8788",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
