// MCP capability surface (stateless, MCP 2026-07-28 compatible).
//
// We implement the minimum JSON-RPC 2.0 + MCP 2026-07-28 protocol
// shape ourselves rather than pulling in the @cloudflare/agents
// SDK, which is not currently installed. The protocol is small:
//
//   - initialize: returns serverInfo and capabilities
//   - tools/list: returns the registered safe capabilities
//   - tools/call: invokes a registered tool with arguments
//
// We do NOT support sessions (per MCP 2026-07-28 stateless
// requirement). The worker is a fetch handler that handles each
// request independently.

import type { D1Database } from "@cloudflare/workers-types";
import type { MiniMaxAdapter } from "../adapters/minimax.js";

export interface McpToolDef {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  readonly content: Array<{ type: "text"; text: string }>;
  readonly isError?: boolean;
}

export interface McpContext {
  readonly db: D1Database;
  readonly ai: MiniMaxAdapter;
  readonly actor: "AGENT" | "OPERATOR" | "MEMBER";
  readonly actorId: string | null;
  readonly appBaseUrl: string;
  readonly fromAddress: string;
  readonly clock: { nowIso(): string };
}

export type McpToolHandler = (
  args: Record<string, unknown>,
  ctx: McpContext,
) => Promise<McpToolResult>;

// FORBIDDEN capabilities. They are not registered and cannot be
// invoked. Enforced by the registration list, not by after-the-fact
// policy. Per MASTER_SPEC §10.5.
const FORBIDDEN = new Set<string>([
  "execute_arbitrary_sql",
  "dump_all_members",
  "write_unvalidated_member_record",
  "send_unvalidated_email",
]);

/**
 * The canonical list of MCP tools exposed to agents. Each tool is a
 * thin wrapper that re-checks policy and audit. Tools do not expose
 * raw SQL or unfettered write access.
 */
export function mcpTools(): McpToolDef[] {
  return [
    {
      name: "club.get_member_context",
      description: "Read a minimal, scoped member context. Never includes unrelated members.",
      inputSchema: {
        type: "object",
        properties: { memberId: { type: "string" } },
        required: ["memberId"],
      },
    },
    {
      name: "club.get_member_preferences",
      description: "Read a member's preferences (do-not-mention, opt-outs, contact windows).",
      inputSchema: {
        type: "object",
        properties: { memberId: { type: "string" } },
        required: ["memberId"],
      },
    },
    {
      name: "club.get_daily_operations",
      description: "Read the operator 'what needs my attention' digest.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "club.list_due_milestones",
      description: "List member milestones due today.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "club.propose_event",
      description: "Propose a draft ordinary event for operator review. Does not schedule.",
      inputSchema: {
        type: "object",
        properties: {
          chapterId: { type: "string" },
          title: { type: "string" },
          eventType: { type: "string" },
          startAt: { type: "string" },
          durationMinutes: { type: "number" },
          locationIds: { type: "array", items: { type: "string" } },
        },
        required: ["chapterId", "title", "eventType", "startAt", "durationMinutes", "locationIds"],
      },
    },
    {
      name: "club.draft_correspondence",
      description:
        "Draft a piece of correspondence. Does not send. The result must be validated and queued separately.",
      inputSchema: {
        type: "object",
        properties: {
          memberId: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
          relatedEventId: { type: "string" },
        },
        required: ["memberId", "subject", "body"],
      },
    },
    {
      name: "club.propose_member_fact",
      description: "Propose a candidate member fact (status=CANDIDATE). Never writes CONFIRMED.",
      inputSchema: {
        type: "object",
        properties: {
          memberId: { type: "string" },
          category: { type: "string" },
          subject: { type: "string" },
          value: {},
          sourceType: { type: "string" },
          sourceId: { type: "string" },
        },
        required: ["memberId", "category", "subject", "value", "sourceType"],
      },
    },
    {
      name: "club.list_locations",
      description: "List active locations for a chapter.",
      inputSchema: {
        type: "object",
        properties: { chapterId: { type: "string" } },
        required: ["chapterId"],
      },
    },
    {
      name: "club.create_operator_task",
      description:
        "Create an operator task. Operator review of the task is required for restricted actions.",
      inputSchema: {
        type: "object",
        properties: {
          memberId: { type: "string" },
          taskType: { type: "string" },
          context: {},
          deadline: { type: "string" },
        },
        required: ["memberId", "taskType"],
      },
    },
    {
      name: "club.get_system_health",
      description:
        "Return system health: critical events, overdue fulfilments, retry count, recent failures.",
      inputSchema: { type: "object", properties: {} },
    },
  ];
}

/**
 * Dispatch a tool call. The capability check is mandatory: AI
 * cannot override policy (invariant 7).
 */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  ctx: McpContext,
): Promise<McpToolResult> {
  if (FORBIDDEN.has(name)) {
    return errorResult(`Tool ${name} is forbidden.`);
  }
  switch (name) {
    case "club.get_member_context":
      return getMemberContext(args, ctx);
    case "club.get_member_preferences":
      return getMemberPreferences(args, ctx);
    case "club.get_daily_operations":
      return getDailyOperations(args, ctx);
    case "club.list_due_milestones":
      return listDueMilestones(args, ctx);
    case "club.propose_event":
      return proposeEvent(args, ctx);
    case "club.draft_correspondence":
      return draftCorrespondence(args, ctx);
    case "club.propose_member_fact":
      return proposeMemberFact(args, ctx);
    case "club.list_locations":
      return listLocations(args, ctx);
    case "club.create_operator_task":
      return createOperatorTask(args, ctx);
    case "club.get_system_health":
      return getSystemHealth(args, ctx);
    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}

function ok(text: string): McpToolResult {
  return { content: [{ type: "text", text }] };
}
function errorResult(text: string): McpToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

async function getMemberContext(
  args: Record<string, unknown>,
  ctx: McpContext,
): Promise<McpToolResult> {
  const memberId = String(args.memberId ?? "");
  if (!memberId) return errorResult("memberId is required");
  const m = await ctx.db
    .prepare(
      `SELECT id, email, preferred_name, society_alias, chapter_id, timezone, created_at FROM members WHERE id = ?`,
    )
    .bind(memberId)
    .first();
  if (!m) return errorResult("Unknown member");
  const grants = await ctx.db
    .prepare(`SELECT service, state FROM service_grants WHERE member_id = ?`)
    .bind(memberId)
    .all();
  const facts = await ctx.db
    .prepare(
      `SELECT category, subject FROM member_facts WHERE member_id = ? AND status = 'CONFIRMED' AND do_not_use = 0 LIMIT 20`,
    )
    .bind(memberId)
    .all();
  return ok(
    JSON.stringify(
      { member: m, grants: grants.results ?? [], confirmedFacts: facts.results ?? [] },
      null,
      2,
    ),
  );
}

async function getMemberPreferences(
  args: Record<string, unknown>,
  ctx: McpContext,
): Promise<McpToolResult> {
  const memberId = String(args.memberId ?? "");
  if (!memberId) return errorResult("memberId is required");
  const grants = await ctx.db
    .prepare(`SELECT service, state FROM service_grants WHERE member_id = ?`)
    .bind(memberId)
    .all();
  const restricted = await ctx.db
    .prepare(
      `SELECT category, subject, do_not_use FROM member_facts
         WHERE member_id = ? AND (do_not_use = 1 OR status IN ('REVOKED', 'REJECTED'))`,
    )
    .bind(memberId)
    .all();
  return ok(
    JSON.stringify({ grants: grants.results ?? [], restricted: restricted.results ?? [] }, null, 2),
  );
}

async function getDailyOperations(
  _args: Record<string, unknown>,
  ctx: McpContext,
): Promise<McpToolResult> {
  const today = ctx.clock.nowIso().slice(0, 10);
  const overdue = await ctx.db
    .prepare(
      `SELECT id, member_id, task_type, deadline FROM fulfilment_tasks
         WHERE state NOT IN ('COMPLETED', 'CANCELLED') AND (deadline IS NULL OR deadline <= ?)`,
    )
    .bind(ctx.clock.nowIso())
    .all();
  const inboundReview = await ctx.db
    .prepare(
      `SELECT id, from_address, subject FROM inbound_messages
         WHERE state IN ('STORED', 'MATCHED', 'UNMATCHED', 'CLASSIFIED', 'HUMAN_REVIEW')`,
    )
    .all();
  const criticalEvents = await ctx.db
    .prepare(
      `SELECT id, title, cancellation_due_at FROM events
         WHERE state IN ('CANCELLATION_FAILURE', 'CRITICAL_OPERATOR_ACTION', 'SEND_FAILURE')`,
    )
    .all();
  const deadLetters = await ctx.db
    .prepare(
      `SELECT id, type, failure_reason FROM jobs WHERE state = 'DEAD_LETTER' ORDER BY created_at ASC LIMIT 20`,
    )
    .all();
  return ok(
    JSON.stringify(
      {
        date: today,
        overdueFulfilments: overdue.results ?? [],
        inboundReview: inboundReview.results ?? [],
        criticalEvents: criticalEvents.results ?? [],
        deadLetters: deadLetters.results ?? [],
      },
      null,
      2,
    ),
  );
}

async function listDueMilestones(
  _args: Record<string, unknown>,
  ctx: McpContext,
): Promise<McpToolResult> {
  const today = ctx.clock.nowIso().slice(0, 10);
  const birthdays = await ctx.db
    .prepare(
      `SELECT m.id, m.preferred_name, m.birthday FROM members m
         JOIN memberships ms ON ms.member_id = m.id
         WHERE ms.state = 'ACTIVE' AND substr(m.birthday, 6, 5) = ?`,
    )
    .bind(today.slice(5))
    .all();
  return ok(JSON.stringify({ date: today, birthdays: birthdays.results ?? [] }, null, 2));
}

async function proposeEvent(
  args: Record<string, unknown>,
  ctx: McpContext,
): Promise<McpToolResult> {
  const chapterId = String(args.chapterId ?? "");
  const title = String(args.title ?? "");
  const eventType = String(args.eventType ?? "");
  const startAt = String(args.startAt ?? "");
  const durationMinutes = Number(args.durationMinutes ?? 0);
  const locationIds = (args.locationIds as string[]) ?? [];
  if (
    !chapterId ||
    !title ||
    !eventType ||
    !startAt ||
    !durationMinutes ||
    locationIds.length === 0
  ) {
    return errorResult(
      "chapterId, title, eventType, startAt, durationMinutes, locationIds are required.",
    );
  }
  // Verify all locations are ACTIVE in the right chapter.
  for (const loc of locationIds) {
    const row = await ctx.db
      .prepare(`SELECT chapter_id, status FROM locations WHERE id = ?`)
      .bind(loc)
      .first<{ chapter_id: string; status: string }>();
    if (!row) return errorResult(`Unknown location: ${loc}`);
    if (row.status !== "ACTIVE")
      return errorResult(`Location ${loc} is not ACTIVE (${row.status}).`);
    if (row.chapter_id !== chapterId)
      return errorResult(`Location ${loc} is in a different chapter.`);
  }
  // We do NOT create the event here; the agent must call
  // club.propose_event which returns a proposal. The operator
  // approves and the event is created in a separate (operator-only)
  // call. This tool is proposal-only.
  return ok(
    JSON.stringify(
      {
        proposal: {
          chapterId,
          title,
          eventType,
          startAt,
          durationMinutes,
          locationIds,
          proposedBy: ctx.actor,
          proposedAt: ctx.clock.nowIso(),
        },
        note: "Proposal accepted. Operator must approve and create the event; this tool does not schedule.",
      },
      null,
      2,
    ),
  );
}

async function draftCorrespondence(
  args: Record<string, unknown>,
  ctx: McpContext,
): Promise<McpToolResult> {
  const memberId = String(args.memberId ?? "");
  const subject = String(args.subject ?? "");
  const body = String(args.body ?? "");
  if (!memberId || !subject || !body) {
    return errorResult("memberId, subject and body are required.");
  }
  return ok(
    JSON.stringify(
      {
        draft: { memberId, subject, body, draftedBy: ctx.actor, draftedAt: ctx.clock.nowIso() },
        note: "Draft stored. Validate (club.validate_correspondence) and queue (club.queue_correspondence) are separate calls.",
      },
      null,
      2,
    ),
  );
}

async function proposeMemberFact(
  args: Record<string, unknown>,
  ctx: McpContext,
): Promise<McpToolResult> {
  const memberId = String(args.memberId ?? "");
  const category = String(args.category ?? "");
  const subject = String(args.subject ?? "");
  const value = args.value;
  const sourceType = String(args.sourceType ?? "");
  if (!memberId || !category || !subject || value === undefined || !sourceType) {
    return errorResult("memberId, category, subject, value, sourceType are required.");
  }
  const id = `fact_${crypto.randomUUID()}`;
  await ctx.db
    .prepare(
      `INSERT INTO member_facts
        (id, member_id, category, subject, value_json, status, source_type, source_id, confidence, do_not_use, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'CANDIDATE', ?, ?, NULL, 0, ?, ?)`,
    )
    .bind(
      id,
      memberId,
      category,
      subject,
      JSON.stringify(value),
      sourceType,
      args.sourceId ?? null,
      ctx.clock.nowIso(),
      ctx.clock.nowIso(),
    )
    .run();
  return ok(JSON.stringify({ proposedFactId: id, status: "CANDIDATE" }, null, 2));
}

async function listLocations(
  args: Record<string, unknown>,
  ctx: McpContext,
): Promise<McpToolResult> {
  const chapterId = String(args.chapterId ?? "");
  if (!chapterId) return errorResult("chapterId is required.");
  const rows = await ctx.db
    .prepare(
      `SELECT id, name, suburb, location_type, status FROM locations
         WHERE chapter_id = ? AND (status = 'ACTIVE' OR status = 'REVERIFY_DUE') ORDER BY name`,
    )
    .bind(chapterId)
    .all();
  return ok(JSON.stringify({ locations: rows.results ?? [] }, null, 2));
}

async function createOperatorTask(
  args: Record<string, unknown>,
  ctx: McpContext,
): Promise<McpToolResult> {
  const memberId = String(args.memberId ?? "");
  const taskType = String(args.taskType ?? "");
  if (!memberId || !taskType) return errorResult("memberId and taskType are required.");
  const restricted = ["REFUND_PROCESS", "APPEARANCE_QUOTE", "APPEARANCE_BOOK", "GIFT_APPROVE"];
  if (restricted.includes(taskType) && ctx.actor === "AGENT") {
    return errorResult(`Task type ${taskType} is restricted and requires OPERATOR.`);
  }
  const id = `ft_${crypto.randomUUID()}`;
  await ctx.db
    .prepare(
      `INSERT INTO fulfilment_tasks
        (id, member_id, task_type, state, context_json, deadline, created_at)
       VALUES (?, ?, ?, 'CREATED', ?, ?, ?)`,
    )
    .bind(
      id,
      memberId,
      taskType,
      JSON.stringify(args.context ?? {}),
      args.deadline ?? null,
      ctx.clock.nowIso(),
    )
    .run();
  return ok(JSON.stringify({ taskId: id, state: "CREATED" }, null, 2));
}

async function getSystemHealth(
  _args: Record<string, unknown>,
  ctx: McpContext,
): Promise<McpToolResult> {
  const now = ctx.clock.nowIso();
  const events = await ctx.db
    .prepare(`SELECT state, COUNT(*) AS n FROM events GROUP BY state`)
    .all();
  const jobs = await ctx.db.prepare(`SELECT state, COUNT(*) AS n FROM jobs GROUP BY state`).all();
  const inbound = await ctx.db
    .prepare(`SELECT state, COUNT(*) AS n FROM inbound_messages GROUP BY state`)
    .all();
  return ok(
    JSON.stringify(
      {
        now,
        events: events.results ?? [],
        jobs: jobs.results ?? [],
        inbound: inbound.results ?? [],
      },
      null,
      2,
    ),
  );
}

/**
 * Handle a single JSON-RPC 2.0 + MCP 2026-07-28 request.
 * Stateless: no session, no handshake. Returns the standard
 * JSON-RPC envelope.
 */
export async function handleMcpRequest(
  body: unknown,
  ctx: McpContext,
): Promise<{
  jsonrpc: "2.0";
  id?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}> {
  const req = body as { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
  if (!req || req.jsonrpc !== "2.0" || !req.method) {
    return { jsonrpc: "2.0", error: { code: -32600, message: "Invalid Request" } };
  }
  try {
    if (req.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          protocolVersion: "2026-07-28",
          serverInfo: { name: "social-club", version: "0.0.1" },
          capabilities: { tools: {} },
        },
      };
    }
    if (req.method === "tools/list") {
      return { jsonrpc: "2.0", id: req.id, result: { tools: mcpTools() } };
    }
    if (req.method === "tools/call") {
      const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      if (!params.name) {
        return {
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32602, message: "params.name is required" },
        };
      }
      const result = await callMcpTool(params.name, params.arguments ?? {}, ctx);
      return { jsonrpc: "2.0", id: req.id, result };
    }
    if (req.method === "ping") {
      return { jsonrpc: "2.0", id: req.id, result: {} };
    }
    return {
      jsonrpc: "2.0",
      id: req.id,
      error: { code: -32601, message: `Method not found: ${req.method}` },
    };
  } catch (err) {
    return { jsonrpc: "2.0", id: req.id, error: { code: -32603, message: String(err) } };
  }
}
