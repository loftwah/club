// Appearance request action for the member portal.
// /api/portal/appearance/request

import type { APIRoute } from "astro";
import { AppearanceService } from "@services/appearance-service";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";
import { requireSession } from "../../../lib/portal-auth";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const env = locals.runtime.env;
  if (!env?.DB) return new Response("DB not available", { status: 500 });
  const ctx = await requireSession(request, env);
  if (!ctx) return new Response("Sign in first.", { status: 401 });
  const form = await request.formData();
  const role = String(form.get("role") ?? "");
  const location = String(form.get("location") ?? "");
  const travel = String(form.get("travel") ?? "false") === "true";
  const brief = String(form.get("brief") ?? "");
  const acknowledged = form.get("acknowledged") === "true";
  if (!acknowledged) {
    return new Response("You must acknowledge the suitability terms.", { status: 400 });
  }
  if (!role || !location || !brief) {
    return new Response("Role, location and brief are required.", { status: 400 });
  }
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const appearance = new AppearanceService({ db: env.DB, audit, clock: new SystemClock() });
  const r = await appearance.request({
    requesterId: null,
    memberId: ctx.member.id,
    role,
    location,
    travelRequired: travel,
    brief,
  });
  // If declined, still show the user a clear page. Otherwise
  // the admin will prepare a quote.
  return redirect(
    r.state === "SUITABILITY_DECLINED" ? "/portal/appearance/?declined=1" : "/portal/appearance/",
    303,
  );
};
