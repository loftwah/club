import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { MemberMemoryService, MemberOwnershipError } from "../../src/services/member-memory";
import { CommitmentOwnershipError, CommitmentService } from "../../src/services/commitment-service";
import { POST as mcpPost } from "../../src/pages/api/mcp";
import { POST as cronPost } from "../../src/pages/api/cron/discover";
import { POST as billingPost } from "../../src/pages/api/webhooks/billing";
import { POST as memoryPost } from "../../src/pages/api/portal/memory";
import { isSameOriginMutation } from "../../src/lib/request-security";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  return {
    db,
    memory: new MemberMemoryService({ db: db as unknown as D1Database, audit, clock }),
    commitments: new CommitmentService({ db: db as unknown as D1Database, audit, clock }),
  };
}

function addMember(db: MockD1Database, id: string, email: string, sessionId: string) {
  db.insert("members", {
    id,
    email,
    preferred_name: id,
    postal_name: null,
    society_alias: null,
    country: "AU",
    metro_area: "Melbourne",
    chapter_id: null,
    birthday: null,
    timezone: "Australia/Melbourne",
    created_at: "2026-08-15T10:00:00.000Z",
  });
  db.insert("member_sessions", {
    id: sessionId,
    member_id: id,
    created_at: "2026-08-15T10:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
    revoked_at: null,
  });
}

function routeArgs(request: Request, db: MockD1Database) {
  return {
    request,
    locals: {
      __testRuntimeEnv: { DB: db as unknown as D1Database, OPERATOR_EMAIL: "operator@example.com" },
    },
    url: new URL(request.url),
    redirect: (location: string, status = 302) =>
      new Response(null, { status, headers: { location } }),
  } as never;
}

describe("security remediation service ownership", () => {
  it("rejects every member-memory mutation across member boundaries", async () => {
    const { db, memory } = setup();
    addMember(db, "mem_alice", "alice@example.com", "ses_alice");
    addMember(db, "mem_bob", "bob@example.com", "ses_bob");
    const fact = await memory.propose({
      memberId: "mem_bob",
      category: "interest",
      subject: "Rex",
      value: "cats",
      sourceType: "MEMBER_SELF",
      sourceId: null,
    });

    await expect(
      memory.confirm({ factId: fact.id, reason: "x", memberId: "mem_alice" }),
    ).rejects.toBeInstanceOf(MemberOwnershipError);
    await expect(
      memory.reject({ factId: fact.id, reason: "x", memberId: "mem_alice" }),
    ).rejects.toBeInstanceOf(MemberOwnershipError);
    await expect(
      memory.revoke({ factId: fact.id, reason: "x", memberId: "mem_alice" }),
    ).rejects.toBeInstanceOf(MemberOwnershipError);
    await expect(memory.setDoNotUse(fact.id, true, "x", "mem_alice")).rejects.toBeInstanceOf(
      MemberOwnershipError,
    );
    expect((await memory.get(fact.id))?.status).toBe("CANDIDATE");
    expect((await memory.get(fact.id))?.doNotUse).toBe(false);
  });

  it("rejects commitment abort across member boundaries", async () => {
    const { db, commitments } = setup();
    addMember(db, "mem_alice", "alice@example.com", "ses_alice");
    addMember(db, "mem_bob", "bob@example.com", "ses_bob");
    db.insert("commitment_scenarios", {
      id: "commitment_bob",
      member_id: "mem_bob",
      goal: "read",
      scenario_text: "read",
      state: "REQUESTED",
      confirmed_at: null,
      created_at: "2026-08-15T10:00:00.000Z",
      completed_at: null,
    });

    await expect(commitments.abort("commitment_bob", "x", "mem_alice")).rejects.toBeInstanceOf(
      CommitmentOwnershipError,
    );
    expect((await commitments.get("commitment_bob"))?.state).toBe("REQUESTED");
  });
});

describe("security remediation HTTP boundaries", () => {
  it("uses same-origin signals as a fail-closed browser mutation guard", () => {
    expect(
      isSameOriginMutation(
        new Request("https://club.loftwah.com/api/portal/memory/confirm", {
          method: "POST",
          headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOriginMutation(
        new Request("https://club.loftwah.com/api/portal/memory/confirm", {
          method: "POST",
          headers: { origin: "https://club.loftwah.com", "sec-fetch-site": "same-origin" },
        }),
      ),
    ).toBe(true);
    expect(
      isSameOriginMutation(new Request("https://club.loftwah.com/api/mcp", { method: "POST" })),
    ).toBe(true);
  });

  it("fails closed for anonymous MCP and manual cron requests", async () => {
    const { db } = setup();
    const mcp = await mcpPost(
      routeArgs(
        new Request("https://club.loftwah.com/api/mcp", { method: "POST", body: "{}" }),
        db,
      ),
    );
    expect(mcp.status).toBe(401);
    expect(mcp.headers.get("cache-control")).toContain("no-store");
    expect(mcp.headers.get("x-robots-tag")).toContain("noindex");

    const cron = await cronPost(
      routeArgs(new Request("https://club.loftwah.com/api/cron/discover", { method: "POST" }), db),
    );
    expect(cron.status).toBe(401);
    expect(cron.headers.get("content-type")).toContain("application/json");
  });

  it("keeps the locked billing webhook inert", async () => {
    const response = await billingPost(
      routeArgs(
        new Request("https://club.loftwah.com/api/webhooks/billing", {
          method: "POST",
          body: "{}",
        }),
        new MockD1Database(),
      ),
    );
    expect(response.status).toBe(410);
    expect(await response.text()).toContain("disabled");
  });

  it("rejects an authenticated member trying to mutate another member's fact", async () => {
    const { db } = setup();
    addMember(db, "mem_alice", "alice@example.com", "ses_alice");
    addMember(db, "mem_bob", "bob@example.com", "ses_bob");
    db.insert("member_facts", {
      id: "fact_bob",
      member_id: "mem_bob",
      category: "interest",
      subject: "Rex",
      value_json: JSON.stringify("cats"),
      status: "CANDIDATE",
      source_type: "MEMBER_SELF",
      source_id: null,
      confidence: null,
      do_not_use: 0,
      created_at: "2026-08-15T10:00:00.000Z",
      updated_at: "2026-08-15T10:00:00.000Z",
    });
    const body = new URLSearchParams({ factId: "fact_bob" });
    const request = new Request("https://club.loftwah.com/api/portal/memory/confirm", {
      method: "POST",
      headers: {
        cookie: "society_session=ses_alice",
        origin: "https://club.loftwah.com",
      },
      body,
    });
    const response = await memoryPost(routeArgs(request, db));
    expect(response.status).toBe(404);
    expect((db.all("member_facts")[0] as { status: string }).status).toBe("CANDIDATE");
  });
});
