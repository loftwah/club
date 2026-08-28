// POST /api/club-meetings — schedule a new Club Meeting for the
// authenticated member.
//
// Body fields (all required):
//   title               — one of "Club Meeting" | "Member Session" | "Scheduled Appointment"
//   startAt             — ISO 8601 UTC start time
//   durationMinutes     — 1..720
//   timezone            — IANA timezone of the chapter/member
//   cancellationWindowMinutes — 5..1440 (default 30)
//
// On success returns 200 with the new Club Meeting JSON.
// On validation failure returns 400 with the error message.

import type { APIRoute } from "astro";
import { z } from "zod";
import { requireSession } from "@lib/portal-auth";
import { runtimeEnv } from "@lib/runtime-env";
import {
  ClubMeetingService,
  ClubMeetingService as Service,
} from "../../services/club-meeting-service";
import { SystemClock } from "../../infra/clock";
import { D1AuditWriter } from "../../infra/audit";

const RequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().max(2000).optional(),
  startAt: z.string().min(10),
  durationMinutes: z.coerce.number().int().min(1).max(720),
  timezone: z.string().min(2),
  cancellationWindowMinutes: z.coerce
    .number()
    .int()
    .min(5)
    .max(60 * 24)
    .optional(),
});

export const POST: APIRoute = async (ctx) => {
  const env = runtimeEnv;
  const session = await requireSession(ctx.request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const member = session;
  let body: unknown;
  try {
    body = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  const clock = new SystemClock();
  const audit = new D1AuditWriter(env.DB, clock);
  const service: ClubMeetingService = new Service({
    db: env.DB,
    audit,
    clock,
    appBaseUrl: env.APP_BASE_URL,
  });
  try {
    const meeting = await service.schedule({
      memberId: member.member.id,
      memberEmail: member.member.email,
      memberName: member.member.preferredName ?? member.member.email,
      ...parsed.data,
    });
    return new Response(JSON.stringify(meeting), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Schedule failed" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
};
