// Memory actions for the member portal.
// /api/portal/memory/{confirm,reject,revoke,do-not-use,add}
// All require a valid session. All actions are audited.

import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import { MemberMemoryService, MemberOwnershipError } from "@services/member-memory";
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
  const factId = String(form.get("factId") ?? "");
  const action = url.pathname.split("/").pop() ?? "";
  const mem = new MemberMemoryService({
    db: env.DB,
    audit: new D1AuditWriter(env.DB, new SystemClock()),
    clock: new SystemClock(),
  });
  try {
    switch (action) {
      case "confirm":
        if (!factId) return privateTextResponse("factId required", 400);
        await mem.confirm({ factId, reason: "MEMBER_CONFIRMED", memberId: ctx.member.id });
        break;
      case "reject":
        if (!factId) return privateTextResponse("factId required", 400);
        await mem.reject({ factId, reason: "MEMBER_REJECTED", memberId: ctx.member.id });
        break;
      case "revoke":
        if (!factId) return privateTextResponse("factId required", 400);
        await mem.revoke({ factId, reason: "MEMBER_REVOKED", memberId: ctx.member.id });
        break;
      case "do-not-use": {
        if (!factId) return privateTextResponse("factId required", 400);
        await mem.setDoNotUse(factId, true, "MEMBER_DNU", ctx.member.id);
        break;
      }
      case "add": {
        const category = String(form.get("category") ?? "").trim();
        const subject = String(form.get("subject") ?? "").trim();
        const value = String(form.get("value") ?? "").trim();
        if (!category || !subject || !value) {
          return privateTextResponse("All fields required", 400);
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
        if (last)
          await mem.confirm({ factId: last.id, reason: "MEMBER_SELF", memberId: ctx.member.id });
        break;
      }
      default:
        return privateTextResponse("Unknown action", 404);
    }
  } catch (error) {
    if (
      error instanceof MemberOwnershipError ||
      (error instanceof Error && error.message.startsWith("Unknown fact:"))
    )
      return privateTextResponse("Fact not found.", 404);
    throw error;
  }
  return redirect("/portal/memory/", 303);
};
