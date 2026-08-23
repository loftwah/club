// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";

// Astro config for the Social Club Worker.
// Hybrid output: most pages are pre-rendered (SEO, public content),
// the API/webhook routes are server-rendered (SSR) on Cloudflare Workers.
//
// See docs/17_ADR_ARCHITECTURE.md for the rationale.

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  integrations: [react()],
  prefetch: {
    defaultStrategy: "hover",
  },
  vite: {
    ssr: {
      // ThreeUI bundles a CSS file that should be loaded once. Marking it
      // external for SSR avoids the bundler trying to inline it into a
      // server-rendered Worker.
      noExternal: ["@designcodeio/threeui"],
    },
    optimizeDeps: {
      // ThreeUI is React-only; allow Vite to pre-bundle it for the client.
      include: ["@designcodeio/threeui", "react", "react-dom"],
    },
  },
});
