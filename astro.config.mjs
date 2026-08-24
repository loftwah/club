// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { sourceFingerprint } from "./scripts/video/shared.mjs";

const creativeSourceFingerprint = await sourceFingerprint();

// Astro config for the Social Club Worker.
// Hybrid output: most pages are pre-rendered (SEO, public content),
// the API/webhook routes are server-rendered (SSR) on Cloudflare Workers.
//
// See docs/17_ADR_ARCHITECTURE.md for the rationale.

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "compile" }),
  integrations: [react()],
  prefetch: {
    defaultStrategy: "hover",
  },
  vite: {
    plugins: [tailwindcss()],
    define: {
      __CREATIVE_SOURCE_FINGERPRINT__: JSON.stringify(creativeSourceFingerprint),
    },
  },
});
