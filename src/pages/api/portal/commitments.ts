// Manufactured commitment actions for the member portal.
// /api/portal/commitments/{request,abort}

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { CommitmentOwnershipError, CommitmentService } from "@services/commitment-service";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";
import { requireSession } from "../../../lib/portal-auth";
import { isSameOriginMutation, privateTextResponse } from "../../../lib/request-security";

export const POST: APIRoute = async ({ request, locals, url, redirect }) => {
  const env = getRuntimeEnv(locals);
  if (!env?.DB) return privateTextResponse("DB not available", 500);
  const ctx = await requireSession(request, env);
  if (!ctx) return privateTextResponse("Sign in first.", 401);
  if (!isSameOriginMutation(request))
    return privateTextResponse("Cross-origin mutation rejected.", 403);
  const form = await request.formData();
  const action = url.pathname.split("/").pop() ?? "";
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const clock = new SystemClock();
  const cs = new CommitmentService({ db: env.DB, audit, clock });
  if (action === "request") {
    const goal = String(form.get("goal") ?? "").trim();
    const scenario = String(form.get("scenario") ?? "").trim();
    if (!goal) return privateTextResponse("Goal is required.", 400);
    await cs.request({ memberId: ctx.member.id, goal, scenarioText: scenario || goal });
  } else if (action === "abort") {
    const id = String(form.get("id") ?? "");
    if (!id) return privateTextResponse("id required", 400);
    try {
      await cs.abort(id, "MEMBER_ABORTED", ctx.member.id);
    } catch (error) {
      if (
        error instanceof CommitmentOwnershipError ||
        (error instanceof Error && error.message.startsWith("Unknown commitment:"))
      )
        return privateTextResponse("Commitment not found.", 404);
      throw error;
    }
  } else {
    return privateTextResponse("Unknown action", 404);
  }
  return redirect("/portal/commitments/", 303);
};
