// Stateless MCP endpoint.
// POST /api/mcp
// Body: JSON-RPC 2.0 envelope. Method can be `initialize`,
// `tools/list`, `tools/call`, or `ping`. Per MASTER_SPEC §10.4 and
// docs/20_PROVIDER_VERIFICATION.md the protocol is MCP 2026-07-28.

import type { APIRoute } from "astro";
import { handleMcpRequest } from "@services/mcp";
import { SystemClock } from "@infra/clock";
import { FakeMiniMax } from "@adapters/minimax-fake";

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  if (!env?.DB) {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "database not bound" } }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "parse error" } }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }
  // The MCP endpoint in the public Worker uses a deterministic fake
  // for AI. The real adapter would be wired here when runtime AI
  // is enabled.
  const ctx = {
    db: env.DB,
    ai: new FakeMiniMax(),
    actor: "AGENT" as const,
    actorId: null,
    appBaseUrl: env.APP_BASE_URL ?? "https://club.loftwah.com",
    fromAddress: env.RESEND_FROM ?? "hello@club.loftwah.com",
    clock: new SystemClock(),
  };
  const result = await handleMcpRequest(body, ctx);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
