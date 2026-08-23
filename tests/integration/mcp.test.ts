import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { FakeMiniMax } from "../../src/adapters/minimax-fake";
import { callMcpTool, handleMcpRequest, mcpTools } from "../../src/services/mcp";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const ctx = {
    db: db as unknown as D1Database,
    ai: new FakeMiniMax(),
    actor: "AGENT" as const,
    actorId: "agent_1",
    appBaseUrl: "https://club.loftwah.com",
    fromAddress: "hello@club.loftwah.com",
    clock,
  };
  return { db, ctx };
}

function setupMember(db: MockD1Database) {
  db.insert("chapters", {
    id: "chap_melbourne",
    slug: "melbourne",
    name: "Melbourne",
    status: "ACTIVE",
  });
  db.insert("members", {
    id: "mem_1",
    email: "a@example.com",
    preferred_name: "Alex",
    postal_name: null,
    society_alias: "The Quiet One",
    country: "AU",
    metro_area: "Melbourne",
    chapter_id: "chap_melbourne",
    birthday: null,
    timezone: "Australia/Melbourne",
  });
  db.insert("service_grants", {
    id: "sg_n",
    member_id: "mem_1",
    service: "NEWSLETTER",
    state: "OPTED_IN",
  });
  db.insert("member_facts", {
    id: "fact_pet",
    member_id: "mem_1",
    category: "pet",
    subject: "Frank",
    value_json: JSON.stringify("dog"),
    status: "CONFIRMED",
    source_type: "MEMBER_SELF",
    source_id: null,
    confidence: null,
    do_not_use: 0,
  });
}

describe("MCP — safe capability surface", () => {
  it("lists the canonical tools, none of which are forbidden", () => {
    const tools = mcpTools();
    expect(tools.length).toBeGreaterThan(5);
    for (const t of tools) {
      expect(t.name.startsWith("club.")).toBe(true);
    }
  });

  it("forbidden tools are not invokable", async () => {
    const { ctx } = setup();
    const r = await callMcpTool("execute_arbitrary_sql", {}, ctx);
    expect(r.isError).toBe(true);
  });

  it("get_member_context returns the member, grants, and confirmed facts", async () => {
    const { db, ctx } = setup();
    setupMember(db);
    const r = await callMcpTool("club.get_member_context", { memberId: "mem_1" }, ctx);
    expect(r.isError).toBeFalsy();
    const parsed = JSON.parse(r.content[0]?.text ?? "{}");
    expect(parsed.member.preferred_name).toBe("Alex");
    expect(parsed.grants[0].service).toBe("NEWSLETTER");
    expect(parsed.confirmedFacts[0].subject).toBe("Frank");
  });

  it("propose_member_fact writes a CANDIDATE (not CONFIRMED)", async () => {
    const { db, ctx } = setup();
    setupMember(db);
    const r = await callMcpTool(
      "club.propose_member_fact",
      {
        memberId: "mem_1",
        category: "interest",
        subject: "pottery",
        value: true,
        sourceType: "INBOUND_EMAIL",
        sourceId: null,
      },
      ctx,
    );
    expect(r.isError).toBeFalsy();
    const parsed = JSON.parse(r.content[0]?.text ?? "{}");
    expect(parsed.status).toBe("CANDIDATE");
    const row = db.all("member_facts").find((f) => f.id === parsed.proposedFactId);
    expect(row?.status).toBe("CANDIDATE");
  });

  it("list_locations returns only ACTIVE / REVERIFY_DUE locations in the chapter", async () => {
    const { db, ctx } = setup();
    setupMember(db);
    db.insert("locations", {
      id: "loc_active",
      chapter_id: "chap_melbourne",
      name: "Active Place",
      suburb: null,
      address: null,
      source_url: null,
      location_type: "venue",
      tags_json: null,
      status: "ACTIVE",
    });
    db.insert("locations", {
      id: "loc_retired",
      chapter_id: "chap_melbourne",
      name: "Retired Place",
      suburb: null,
      address: null,
      source_url: null,
      location_type: "venue",
      tags_json: null,
      status: "RETIRED",
    });
    const r = await callMcpTool("club.list_locations", { chapterId: "chap_melbourne" }, ctx);
    const parsed = JSON.parse(r.content[0]?.text ?? "{}");
    expect(parsed.locations.map((l: { id: string }) => l.id)).toEqual(["loc_active"]);
  });

  it("create_operator_task refuses restricted types for AGENT actor", async () => {
    const { db, ctx } = setup();
    setupMember(db);
    const r = await callMcpTool(
      "club.create_operator_task",
      { memberId: "mem_1", taskType: "GIFT_APPROVE" },
      ctx,
    );
    expect(r.isError).toBe(true);
  });

  it("JSON-RPC envelope: initialize returns serverInfo", async () => {
    const { ctx } = setup();
    const r = await handleMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      ctx,
    );
    expect(r.jsonrpc).toBe("2.0");
    expect((r.result as { serverInfo: { name: string } }).serverInfo.name).toBe("social-club");
  });

  it("JSON-RPC envelope: tools/list returns the registered tools", async () => {
    const { ctx } = setup();
    const r = await handleMcpRequest(
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      ctx,
    );
    expect((r.result as { tools: unknown[] }).tools.length).toBeGreaterThan(5);
  });

  it("JSON-RPC envelope: tools/call returns the tool result", async () => {
    const { db, ctx } = setup();
    setupMember(db);
    const r = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "club.get_member_context", arguments: { memberId: "mem_1" } },
      },
      ctx,
    );
    expect((r.result as { content: { text: string }[] }).content[0]?.text).toContain("Alex");
  });

  it("JSON-RPC envelope: invalid request is rejected with code -32600", async () => {
    const { ctx } = setup();
    const r = await handleMcpRequest({ method: "tools/list" }, ctx);
    expect(r.error?.code).toBe(-32600);
  });
});
