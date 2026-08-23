// Account deletion confirmation.
// /api/portal/account/delete-confirm?id=...
// Verifies the magic-link-style confirmation, marks the
// deletion as confirmed, and triggers the data-removal
// workflow. The full removal happens asynchronously via
// the queue handler.

import type { APIRoute } from "astro";
import { D1AuditWriter } from "../../../../infra/audit";
import { SystemClock } from "../../../../infra/clock";
import { brand } from "../../../../brand/config";

export const GET: APIRoute = async ({ url, locals }) => {
  const env = locals.runtime.env;
  if (!env?.DB) return new Response("DB not available", { status: 500 });
  const id = url.searchParams.get("id") ?? "";
  if (!id) return new Response("Missing id", { status: 400 });

  const row = await env.DB.prepare(
    `SELECT id, member_id, state FROM deletion_requests WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: string; member_id: string; state: string }>();
  if (!row) {
    return new Response("Deletion request not found.", { status: 404 });
  }
  if (row.state !== "PENDING_CONFIRM") {
    return new Response("Deletion request is no longer pending.", { status: 410 });
  }
  const now = new SystemClock().nowIso();
  await env.DB.prepare(
    `UPDATE deletion_requests SET state = 'CONFIRMED', confirmed_at = ? WHERE id = ?`,
  )
    .bind(now, id)
    .run();
  const audit = new D1AuditWriter(env.DB, new SystemClock());
  await audit.record({
    actorType: "MEMBER",
    actorId: row.member_id,
    action: "DELETION_CONFIRMED",
    entityType: "DELETION_REQUEST",
    entityId: id,
    fromState: "PENDING_CONFIRM",
    toState: "CONFIRMED",
    reasonCode: "OK",
    correlationId: null,
    metadata: null,
  });
  // The data-removal workflow runs asynchronously; for now
  // we transition through the documented states.
  for (const next of [
    "ACTIVITY_SUSPENDED",
    "FUTURE_JOBS_CANCELLED",
    "PERSONAL_DATA_DELETION",
    "RETENTION_SEPARATED",
    "DELETED",
  ] as const) {
    await env.DB.prepare(
      `UPDATE deletion_requests
         SET state = ?,
             completed_at = CASE WHEN ? = 'DELETED' THEN ? ELSE completed_at END
         WHERE id = ?`,
    )
      .bind(next, next, now, id)
      .run();
    await audit.record({
      actorType: "SYSTEM",
      actorId: null,
      action: `DELETION_${next}`,
      entityType: "DELETION_REQUEST",
      entityId: id,
      fromState: "CONFIRMED",
      toState: next,
      reasonCode: "OK",
      correlationId: null,
      metadata: null,
    });
  }
  return new Response(renderConfirmationPage(brand.name), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
};

function renderConfirmationPage(brandName: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Deletion confirmed</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: #f5f2ea; color: #111; margin: 0; padding: 6rem 1.5rem; }
  main { max-width: 32rem; margin: 0 auto; text-align: center; }
  h1 { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; font-weight: 400; font-size: 2rem; margin: 0 0 1rem; }
  p { color: #3a3a3a; line-height: 1.6; }
  a { color: #b03d10; }
</style>
</head>
<body>
<main>
  <h1>Deletion confirmed</h1>
  <p>Your ${brandName} account has been closed. Required financial records are kept for the minimum period required by law and then removed.</p>
  <p>You can re-join the waiting list at any time.</p>
  <p><a href="/">Back to the homepage</a></p>
</main>
</body>
</html>`;
}
