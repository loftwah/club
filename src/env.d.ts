/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { D1Database, R2Bucket, Queue } from "@cloudflare/workers-types";

declare global {
  namespace App {
    interface Locals {
      runtime: {
        env: {
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
        };
        ctx: ExecutionContext;
        cf: IncomingRequestCfProperties;
      };
    }
  }
}
