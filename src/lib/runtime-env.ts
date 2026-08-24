import { env as cloudflareEnv } from "cloudflare:workers";
import type { D1Database, Queue, R2Bucket } from "@cloudflare/workers-types";

export interface RuntimeEnv {
  DB: D1Database;
  ARTIFACTS: R2Bucket;
  JOBS: Queue;
  APP_BASE_URL: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  RESEND_WEBHOOK_ID: string;
  RESEND_WEBHOOK_SIGNING_SECRET: string;
  OPERATOR_EMAIL: string;
  MINIMAX_API_KEY: string;
  WAITLIST_RATE_LIMITER: RateLimit;
  MAGIC_LINK_RATE_LIMITER: RateLimit;
}

/** Production uses the Astro 6+ direct Cloudflare binding API. */
export const runtimeEnv = cloudflareEnv as unknown as RuntimeEnv;

/**
 * Endpoint tests may inject fakes through an explicit test-only route-local
 * property. Real Astro locals always fall through to the native binding API.
 */
export function getRuntimeEnv(locals?: unknown): RuntimeEnv {
  if (locals && typeof locals === "object") {
    const testDescriptor = Object.getOwnPropertyDescriptor(locals, "__testRuntimeEnv");
    if (testDescriptor && "value" in testDescriptor && testDescriptor.value) {
      return testDescriptor.value as RuntimeEnv;
    }
  }

  return runtimeEnv;
}
