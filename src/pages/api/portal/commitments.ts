// Manufactured commitment actions for the member portal.
// /api/portal/commitments/{request,abort}

import type { APIRoute } from "astro";
import { CommitmentService } from "@services/commitment-service";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";
import { requireSession } from "../../../lib/portal-auth";

export const POST: APIRoute = async ({ request, locals, url, redirect }) => {
  const env = locals.runtime.env;
  if (!env?.DB) return new Response("DB not available", { status: 500 });
  const ctx = await requireSession(request, env);
  if (!ctx) return new Response("Sign in first.", { status: 401 });
  const form = await request.formData();
  const action = url.pathname.split("/").pop() ?? "";
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const clock = new SystemClock();
  const cs = new CommitmentService({ db: env.DB, audit, clock });
  if (action === "request") {
    const goal = String(form.get("goal") ?? "").trim();
    const scenario = String(form.get("scenario") ?? "").trim();
    if (!goal) return new Response("Goal is required.", { status: 400 });
    await cs.request({ memberId: ctx.member.id, goal, scenarioText: scenario || goal });
  } else if (action === "abort") {
    const id = String(form.get("id") ?? "");
    if (!id) return new Response("id required", { status: 400 });
    await cs.abort(id, "MEMBER_ABORTED");
  } else {
    return new Response("Unknown action", { status: 404 });
  }
  return redirect("/portal/commitments/", 303);
};
