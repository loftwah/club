// Stateless MCP endpoint.
// POST /api/mcp
// Body: JSON-RPC 2.0 envelope. Method can be `initialize`,
// `tools/list`, `tools/call`, or `ping`. Per MASTER_SPEC §10.4 and
// docs/20_PROVIDER_VERIFICATION.md the protocol is MCP 2026-07-28.

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { handleMcpRequest } from "@services/mcp";
import { SystemClock } from "@infra/clock";
import { FakeMiniMax } from "@adapters/minimax-fake";
import { RealMiniMaxAdapter } from "@adapters/minimax-real";
import { requireOperator } from "../../lib/portal-auth";
import { isSameOriginMutation, privateJsonResponse } from "../../lib/request-security";

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  const operator = await requireOperator(request, env);
  if (!operator) {
    return privateJsonResponse({ error: "operator authentication required" }, 401);
  }
  if (!isSameOriginMutation(request)) {
    return privateJsonResponse({ error: "cross-origin mutation rejected" }, 403);
  }
  if (!env?.DB) {
    return privateJsonResponse(
      { jsonrpc: "2.0", error: { code: -32603, message: "database not bound" } },
      500,
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJsonResponse(
      { jsonrpc: "2.0", error: { code: -32700, message: "parse error" } },
      400,
    );
  }
  // AI adapter selection:
  //   - When MINIMAX_API_KEY is bound in the Worker env, use the real
  //     HTTP adapter (PROVIDER VERIFIED).
  //   - Otherwise default to the deterministic fake so local dev and
  //     the public Worker remain predictable without secrets.
  const ai = env.MINIMAX_API_KEY
    ? new RealMiniMaxAdapter({ apiKey: env.MINIMAX_API_KEY, fetchImpl: fetch })
    : new FakeMiniMax();
  const ctx = {
    db: env.DB,
    ai,
    actor: "OPERATOR" as const,
    actorId: operator.member.id,
    appBaseUrl: env.APP_BASE_URL ?? "https://club.loftwah.com",
    fromAddress: env.RESEND_FROM ?? "hello@club.loftwah.com",
    clock: new SystemClock(),
  };
  const result = await handleMcpRequest(body, ctx);
  return privateJsonResponse(result, 200);
};
