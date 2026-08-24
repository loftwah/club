// Preferences actions for the member portal.
// /api/portal/preferences/{identity,grant}

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { MembershipService } from "@services/membership-service";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";
import { requireSession } from "../../../lib/portal-auth";
import { isSameOriginMutation } from "../../../lib/request-security";

const SERVICES = new Set([
  "CORE_MEMBERSHIP",
  "NEWSLETTER",
  "PERSONALISED_MEMORY",
  "CALENDAR_MESSAGES",
  "PHYSICAL_CORRESPONDENCE",
  "GIFTS",
  "CALLS",
  "MANUFACTURED_COMMITMENTS",
  "APPEARANCE_INTEREST",
]);

export const POST: APIRoute = async ({ request, locals, url, redirect }) => {
  const env = getRuntimeEnv(locals);
  if (!env?.DB) return new Response("DB not available", { status: 500 });
  if (!isSameOriginMutation(request))
    return new Response("Cross-origin request rejected.", { status: 403 });
  const ctx = await requireSession(request, env);
  if (!ctx) return new Response("Sign in first.", { status: 401 });
  const form = await request.formData();
  const action = url.pathname.split("/").pop() ?? "";
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  const ms = new MembershipService({ db: env.DB, audit, clock: new SystemClock() });
  if (action === "identity") {
    await ms.setIdentity(ctx.member.id, {
      preferredName: stringOrUndef(form.get("preferredName")),
      postalName: stringOrUndef(form.get("postalName")),
      country: stringOrUndef(form.get("country")),
      metroArea: stringOrUndef(form.get("metroArea")),
      birthday: stringOrUndef(form.get("birthday")),
      timezone: stringOrUndef(form.get("timezone")),
    });
  } else if (action === "grant") {
    const service = String(form.get("service") ?? "");
    const state = String(form.get("state") ?? "");
    if (!SERVICES.has(service) || !state)
      return new Response("Invalid service or state", { status: 400 });
    if (!["OPTED_IN", "OPTED_OUT", "AVAILABLE", "PAUSED", "SUSPENDED"].includes(state)) {
      return new Response("Invalid state", { status: 400 });
    }
    await ms.setServiceGrant(ctx.member.id, service, state as never);
  } else {
    return new Response("Unknown action", { status: 404 });
  }
  return redirect("/portal/preferences/", 303);
};

function stringOrUndef(v: FormDataEntryValue | null): string | undefined {
  if (v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}
