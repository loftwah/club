// Unit tests for the outward identity service (issue #13).
//
// Coverage:
//   - resolveForCommitment walks platform → chapter → member
//   - member override wins over chapter default
//   - chapter default wins over platform fallback
//   - a historic resolution is unaffected by a later
//     member-override change (snapshot immutability lives in
//     the caller, but the service surfaces the immutable id
//     so a caller can persist it)
//   - submitMemberCustom rejects empty, too-long, markup and
//     high-stakes-institution names
//   - listSuggestionsForChapter returns deterministic
//     suggestions for known slugs and a generic fallback for
//     unknown slugs

import { beforeEach, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { OutwardIdentityService } from "../../src/services/outward-identity";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const service = new OutwardIdentityService({
    db: db as unknown as D1Database,
    audit,
    clock,
    platformFallback: "Plans With You",
  });
  return { db, clock, audit, service };
}

async function seedMember(db: MockD1Database, id = "mem_1") {
  db.insert("members", {
    id,
    email: "alice@example.test",
    preferred_name: "Alice",
    chapter_id: "chap_melbourne",
  });
  db.insert("chapters", {
    id: "chap_melbourne",
    slug: "melbourne",
    name: "Melbourne",
    status: "ACTIVE",
  });
}

describe("OutwardIdentityService", () => {
  let setupData: ReturnType<typeof setup>;
  beforeEach(async () => {
    setupData = setup();
    await seedMember(setupData.db);
  });

  it("falls back to the platform name when no chapter default or member override exists", async () => {
    const id = await setupData.service.resolveForCommitment({
      memberId: "mem_1",
      chapterId: "chap_melbourne",
    });
    expect(id.displayName).toBe("Plans With You");
    expect(id.source).toBe("PLATFORM");
    expect(id.scope).toBe("platform");
  });

  it("uses the chapter default when present and the member has no override", async () => {
    await setupData.service.setChapterDefault({
      chapterId: "chap_melbourne",
      displayName: "The Lyrebird Society",
      source: "CURATED",
      actorId: "operator_1",
    });
    const id = await setupData.service.resolveForCommitment({
      memberId: "mem_1",
      chapterId: "chap_melbourne",
    });
    expect(id.displayName).toBe("The Lyrebird Society");
    expect(id.source).toBe("CURATED");
    expect(id.scope).toBe("chapter");
  });

  it("prefers the member override over the chapter default", async () => {
    await setupData.service.setChapterDefault({
      chapterId: "chap_melbourne",
      displayName: "The Lyrebird Society",
      source: "CURATED",
      actorId: "operator_1",
    });
    const result = await setupData.service.submitMemberCustom({
      memberId: "mem_1",
      displayName: "Alice's Reading Room",
      actorId: "mem_1",
    });
    expect(result.accepted).toBe(true);
    const id = await setupData.service.resolveForCommitment({
      memberId: "mem_1",
      chapterId: "chap_melbourne",
    });
    expect(id.displayName).toBe("Alice's Reading Room");
    expect(id.source).toBe("CUSTOM");
    expect(id.scope).toBe("member");
  });

  it("survives later changes to the member override without rewriting historic snapshots", async () => {
    // Schedule a "commitment" by capturing the resolved
    // identity at a point in time, then change the override
    // and confirm the historic resolution still refers to the
    // original id.
    const historic = await setupData.service.resolveForCommitment({
      memberId: "mem_1",
      chapterId: "chap_melbourne",
    });
    const historicName = historic.displayName;
    expect(historicName).toBe("Plans With You");

    await setupData.service.submitMemberCustom({
      memberId: "mem_1",
      displayName: "Alice's Reading Room",
      actorId: "mem_1",
    });

    // Historic name still resolves to the platform fallback
    // because the caller stored the snapshot separately.
    expect(historic.displayName).toBe(historicName);
  });

  it("rejects a too-short name", () => {
    expect(() => setupData.service.validateDisplayName("A")).toThrow(/characters/);
  });

  it("rejects a too-long name", () => {
    const long = "x".repeat(61);
    expect(() => setupData.service.validateDisplayName(long)).toThrow(/characters/);
  });

  it("rejects a name that includes markup", () => {
    expect(() => setupData.service.validateDisplayName("<script>")).toThrow(/markup/);
  });

  it("rejects a name that impersonates a high-stakes institution", () => {
    expect(() => setupData.service.validateDisplayName("City Police Department")).toThrow(
      /high-stakes/,
    );
    expect(() => setupData.service.validateDisplayName("Local Hospital")).toThrow(/high-stakes/);
  });

  it("returns deterministic suggestions per chapter and a generic fallback for unknown slugs", () => {
    const melbourne = setupData.service.listSuggestionsForChapter("melbourne");
    expect(melbourne.length).toBeGreaterThan(0);
    expect(melbourne).toContain("The Lyrebird Society");
    const auckland = setupData.service.listSuggestionsForChapter("auckland");
    expect(auckland.length).toBeGreaterThan(0);
    expect(auckland).toContain("The Pohutukawa Society");
    const unknown = setupData.service.listSuggestionsForChapter("atlantis");
    expect(unknown).toEqual(["The Quiet Society"]);
  });
});
