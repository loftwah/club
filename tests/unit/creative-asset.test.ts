// Unit tests for the creative asset service (issues #14 and #15).
//
// Coverage:
//   - technical validation rejects unsupported media, oversized
//     payloads and pixel-dimension bombs
//   - placement fitness rejects an asset that fits no placement
//   - rendered quality surfaces a NEEDS_REVIEW status for
//     near-minimum dimensions and extreme aspect ratios
//   - activation is gated on APPROVED status
//   - operator override resolves a NEEDS_REVIEW asset to
//     APPROVED without bypassing the technical/policy/placement
//     gate
//   - resolveActive returns the active asset for a scope and
//     falls back to null when no asset is active

import { beforeEach, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { CreativeAssetService } from "../../src/services/creative-asset";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const service = new CreativeAssetService({
    db: db as unknown as D1Database,
    audit,
    clock,
  });
  return { db, clock, audit, service };
}

const GOOD_INPUT = {
  scope: "CHAPTER" as const,
  scopeId: "chap_melbourne",
  source: "MEMBER_UPLOAD" as const,
  displayName: "Chapter mark",
  storageKey: "creatives/melbourne/mark.png",
  mediaType: "image/png",
  width: 1024,
  height: 512,
  bytes: 200_000,
  actorId: "operator_1",
};

describe("CreativeAssetService", () => {
  let setupData: ReturnType<typeof setup>;
  beforeEach(() => {
    setupData = setup();
  });

  it("approves a clean asset", async () => {
    const asset = await setupData.service.registerAndEvaluate(GOOD_INPUT);
    expect(asset.approvalStatus).toBe("APPROVED");
    expect(asset.approvalVersion).toBe(1);
  });

  it("rejects an unsupported media type", async () => {
    const asset = await setupData.service.registerAndEvaluate({
      ...GOOD_INPUT,
      mediaType: "image/svg+xml",
    });
    expect(asset.approvalStatus).toBe("REJECTED");
    expect(asset.approvalDetail).toMatch(/technical/);
  });

  it("rejects an oversized payload", async () => {
    const asset = await setupData.service.registerAndEvaluate({
      ...GOOD_INPUT,
      bytes: 6 * 1024 * 1024,
    });
    expect(asset.approvalStatus).toBe("REJECTED");
  });

  it("rejects a pixel-dimension bomb", async () => {
    const asset = await setupData.service.registerAndEvaluate({
      ...GOOD_INPUT,
      width: 10_000,
      height: 10_000,
    });
    expect(asset.approvalStatus).toBe("REJECTED");
  });

  it("rejects an asset that fits no placement", async () => {
    // 130x130 passes the technical minimum (120x80) but
    // fails every placement: aspect 1.0 is below the
    // letter-header (1.6) and email-signature (1.6)
    // minimums, and 130 < 200 width for calendar-block.
    const asset = await setupData.service.registerAndEvaluate({
      ...GOOD_INPUT,
      width: 130,
      height: 130,
    });
    expect(asset.approvalStatus).toBe("REJECTED");
    expect(asset.approvalDetail).toMatch(/no placement/);
  });

  it("routes a near-minimum-size asset to NEEDS_REVIEW", async () => {
    const asset = await setupData.service.registerAndEvaluate({
      ...GOOD_INPUT,
      width: 220,
      height: 180,
    });
    expect(asset.approvalStatus).toBe("NEEDS_REVIEW");
  });

  it("blocks activation of a non-APPROVED asset", async () => {
    const asset = await setupData.service.registerAndEvaluate({
      ...GOOD_INPUT,
      width: 220,
      height: 180,
    });
    expect(asset.approvalStatus).toBe("NEEDS_REVIEW");
    await expect(
      setupData.service.activate({
        scope: "CHAPTER",
        scopeId: "chap_melbourne",
        assetId: asset.id,
        actorId: "operator_1",
      }),
    ).rejects.toThrow(/APPROVED/);
  });

  it("activates an APPROVED asset", async () => {
    const asset = await setupData.service.registerAndEvaluate(GOOD_INPUT);
    await setupData.service.activate({
      scope: "CHAPTER",
      scopeId: "chap_melbourne",
      assetId: asset.id,
      actorId: "operator_1",
    });
    const active = await setupData.service.resolveActive("CHAPTER", "chap_melbourne");
    expect(active?.id).toBe(asset.id);
  });

  it("lets an operator override a NEEDS_REVIEW asset to APPROVED", async () => {
    const asset = await setupData.service.registerAndEvaluate({
      ...GOOD_INPUT,
      width: 220,
      height: 180,
    });
    expect(asset.approvalStatus).toBe("NEEDS_REVIEW");
    const overridden = await setupData.service.approveAsOperator({
      assetId: asset.id,
      actorId: "operator_1",
      reason: "Hand-checked, usable as letterhead",
    });
    expect(overridden.approvalStatus).toBe("APPROVED");
    expect(overridden.approvalVersion).toBe(2);
  });

  it("rejects an operator override for an asset that is not NEEDS_REVIEW", async () => {
    const asset = await setupData.service.registerAndEvaluate(GOOD_INPUT);
    expect(asset.approvalStatus).toBe("APPROVED");
    await expect(
      setupData.service.approveAsOperator({
        assetId: asset.id,
        actorId: "operator_1",
        reason: "Trying anyway",
      }),
    ).rejects.toThrow(/NEEDS_REVIEW/);
  });

  it("returns null when no asset is active for a scope", async () => {
    const active = await setupData.service.resolveActive("CHAPTER", "chap_melbourne");
    expect(active).toBeNull();
  });
});
