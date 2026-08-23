// Memory actions for the member portal.
// /api/portal/memory/{confirm,reject,revoke,do-not-use,add}
// All require a valid session. All actions are audited.

import type { APIRoute } from "astro";
import { MemberMemoryService } from "@services/member-memory";
import { D1AuditWriter } from "@infra/audit";
import { SystemClock } from "@infra/clock";
import { requireSession } from "../../../lib/portal-auth";

export const POST: APIRoute = async ({ request, locals, url, redirect }) => {
  const env = locals.runtime.env;
  if (!env?.DB) return new Response("DB not available", { status: 500 });
  const ctx = await requireSession(request, env);
  if (!ctx) return new Response("Sign in first.", { status: 401 });
  const form = await request.formData();
  const factId = String(form.get("factId") ?? "");
  const action = url.pathname.split("/").pop() ?? "";
  const mem = new MemberMemoryService({
    db: env.DB,
    audit: new D1AuditWriter(env.DB, new SystemClock()),
    clock: new SystemClock(),
  });
  switch (action) {
    case "confirm":
      if (factId) await mem.confirm({ factId, reason: "MEMBER_CONFIRMED" });
      break;
    case "reject":
      if (factId) await mem.reject({ factId, reason: "MEMBER_REJECTED" });
      break;
    case "revoke":
      if (factId) await mem.revoke({ factId, reason: "MEMBER_REVOKED" });
      break;
    case "do-not-use": {
      if (factId) await mem.setDoNotUse(factId, true, "MEMBER_DNU");
      break;
    }
    case "add": {
      const category = String(form.get("category") ?? "").trim();
      const subject = String(form.get("subject") ?? "").trim();
      const value = String(form.get("value") ?? "").trim();
      if (!category || !subject || !value) {
        return new Response("All fields required", { status: 400 });
      }
      await mem.propose({
        memberId: ctx.member.id,
        category,
        subject,
        value,
        sourceType: "MEMBER_SELF",
        sourceId: null,
      });
      // Self-declared facts are auto-confirmed (deterministic policy
      // for explicit member statements). The member remains the
      // source of truth.
      const last = (await mem.listForMember(ctx.member.id)).find(
        (f) => f.subject === subject && f.category === category,
      );
      if (last) await mem.confirm({ factId: last.id, reason: "MEMBER_SELF" });
      break;
    }
    default:
      return new Response("Unknown action", { status: 404 });
  }
  return redirect("/portal/memory/", 303);
};
