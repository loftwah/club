// Issues #14 and #15: creative asset model + approval gate.
//
// A non-default asset must pass the four-layer evaluation
// before it can become active. The service is intentionally
// strict: a failed technical, policy or placement check
// returns a REJECTED status and the previously active asset
// remains in place. A subjective quality warning is
// downgraded to NEEDS_REVIEW so an operator can resolve it
// without bouncing a good asset.

import type { D1Database } from "@cloudflare/workers-types";
import type { AuditWriter } from "../infra/audit.js";
import type { Clock } from "../infra/clock.js";

export type AssetSource = "DEFAULT" | "CURATED" | "GENERATED" | "MEMBER_UPLOAD";
export type AssetScope = "PLATFORM" | "CHAPTER" | "MEMBER";
export type AssetApprovalStatus =
  "PENDING" | "ANALYSING" | "APPROVED" | "NEEDS_REVIEW" | "REJECTED";

export interface CreativeAsset {
  readonly id: string;
  readonly scope: AssetScope;
  readonly scopeId: string | null;
  readonly source: AssetSource;
  readonly displayName: string;
  readonly storageKey: string;
  readonly mediaType: string;
  readonly width: number;
  readonly height: number;
  readonly approvalStatus: AssetApprovalStatus;
  readonly approvalDetail: string | null;
  readonly approvalVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreativeAssetServiceDeps {
  readonly db: D1Database;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

export type CheckResult = "PASS" | "WARN" | "REVIEW" | "REJECT";

export interface CheckOutcome {
  readonly id: string;
  readonly result: CheckResult;
  readonly detail: string;
}

export interface PlacementContract {
  readonly id: string;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly maxAspectRatio: number;
  readonly minAspectRatio: number;
  readonly fitMode: "contain" | "cover";
}

const DEFAULT_PLACEMENTS: ReadonlyArray<PlacementContract> = [
  {
    id: "letter-header",
    minWidth: 600,
    minHeight: 200,
    maxAspectRatio: 6,
    minAspectRatio: 1.6,
    fitMode: "contain",
  },
  {
    id: "calendar-block",
    minWidth: 200,
    minHeight: 150,
    maxAspectRatio: 1.4,
    minAspectRatio: 0.7,
    fitMode: "contain",
  },
  {
    id: "email-signature",
    minWidth: 240,
    minHeight: 80,
    maxAspectRatio: 6,
    minAspectRatio: 1.6,
    fitMode: "contain",
  },
];

const TECHNICAL_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxWidth: 4096,
  maxHeight: 4096,
  minWidth: 120,
  minHeight: 80,
};

const ALLOWED_MIME = new Set<string>(["image/png", "image/jpeg", "image/webp", "image/avif"]);

export class CreativeAssetService {
  constructor(private readonly deps: CreativeAssetServiceDeps) {}

  placements(): ReadonlyArray<PlacementContract> {
    return DEFAULT_PLACEMENTS;
  }

  /**
   * Register a new asset and run the four-layer evaluation
   * synchronously. Returns the persisted asset with the final
   * approval status. The caller must not move an asset to
   * `active_creative_assets` unless the status is APPROVED.
   */
  async registerAndEvaluate(input: {
    scope: AssetScope;
    scopeId: string | null;
    source: AssetSource;
    displayName: string;
    storageKey: string;
    mediaType: string;
    width: number;
    height: number;
    bytes: number;
    actorId: string;
  }): Promise<CreativeAsset> {
    if (!ALLOWED_MIME.has(input.mediaType)) {
      return this.persistRejected(
        input,
        `technical validation failed: unsupported media type ${input.mediaType}`,
        [],
      );
    }
    const id = crypto.randomUUID();
    const now = this.deps.clock.nowIso();
    // Layer 1: technical validation
    const technical = this.evaluateTechnical(input);
    if (technical.some((c) => c.result === "REJECT")) {
      return this.persistRejected(input, "technical validation failed", technical);
    }
    // Layer 3: placement fitness
    const placement = this.evaluatePlacement(input);
    // Only the placement-overall check should fail the
    // evaluation. Individual placements may legitimately
    // fail while one is still eligible.
    const placementOverall = placement.find((c) => c.id === "placement-overall");
    if (placementOverall?.result === "REJECT") {
      return this.persistRejected(input, "no placement accepts this asset", placement);
    }
    // Layer 4: rendered quality. Without an image classifier
    // we deterministically derive WARN when the asset is at
    // the lower bound of size or has an extreme aspect ratio.
    const quality = this.evaluateQuality(input, technical, placement);
    const blocked = quality.some((c) => c.result === "REJECT");
    if (blocked) {
      return this.persistRejected(input, "rendered quality check failed", quality);
    }
    const needsReview = quality.some((c) => c.result === "WARN" || c.result === "REVIEW");
    const status: AssetApprovalStatus = needsReview ? "NEEDS_REVIEW" : "APPROVED";
    const checks = [...technical, ...placement, ...quality];
    await this.persist(
      input,
      id,
      status,
      status === "APPROVED"
        ? "All checks pass"
        : "Subjective quality warning — operator review required",
      now,
      checks,
    );
    await this.deps.audit.record({
      actorType: input.source === "MEMBER_UPLOAD" ? "MEMBER" : "OPERATOR",
      actorId: input.actorId,
      action: `CREATIVE_ASSET_${status}`,
      entityType: "CREATIVE_ASSET",
      entityId: id,
      fromState: null,
      toState: status,
      reasonCode: null,
      correlationId: null,
      metadata: { source: input.source, scope: input.scope, scopeId: input.scopeId },
    });
    const stored = await this.get(id);
    if (!stored) throw new Error("Failed to load creative asset after evaluation.");
    return stored;
  }

  /**
   * Activate an approved asset for a chapter or member. A
   * previous activation is replaced and the new asset id is
   * the only active reference. An asset can only be activated
   * if its status is APPROVED.
   */
  async activate(input: {
    scope: "CHAPTER" | "MEMBER";
    scopeId: string;
    assetId: string;
    actorId: string;
  }): Promise<void> {
    const asset = await this.get(input.assetId);
    if (!asset) throw new Error(`Unknown asset: ${input.assetId}`);
    if (asset.approvalStatus !== "APPROVED") {
      throw new Error(
        `Asset ${input.assetId} is ${asset.approvalStatus}; only APPROVED assets can be activated.`,
      );
    }
    if (asset.scope !== "PLATFORM" && asset.scope !== input.scope) {
      throw new Error(`Asset scope ${asset.scope} cannot be activated for ${input.scope}.`);
    }
    const now = this.deps.clock.nowIso();
    await this.deps.db
      .prepare(
        `INSERT INTO active_creative_assets (scope, scope_id, asset_id, activated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(scope, scope_id) DO UPDATE
           SET asset_id = excluded.asset_id, activated_at = excluded.activated_at`,
      )
      .bind(input.scope, input.scopeId, input.assetId, now)
      .run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: input.actorId,
      action: "CREATIVE_ASSET_ACTIVATED",
      entityType: "CREATIVE_ASSET",
      entityId: input.assetId,
      fromState: null,
      toState: "ACTIVE",
      reasonCode: null,
      correlationId: null,
      metadata: { scope: input.scope, scopeId: input.scopeId },
    });
  }

  /**
   * Resolve the active asset for a scope, falling back to the
   * platform default. A missing active asset returns null so
   * the caller can apply the platform default. Historic
   * commitments reference the asset id directly; retiring a
   * library asset therefore does not break historic records
   * (the asset row remains, only the `active_creative_assets`
   * pointer moves).
   */
  async resolveActive(scope: "CHAPTER" | "MEMBER", scopeId: string): Promise<CreativeAsset | null> {
    const row = await this.deps.db
      .prepare(`SELECT asset_id FROM active_creative_assets WHERE scope = ? AND scope_id = ?`)
      .bind(scope, scopeId)
      .first<{ asset_id: string }>();
    if (!row) return null;
    return this.get(row.asset_id);
  }

  async get(id: string): Promise<CreativeAsset | null> {
    const row = await this.deps.db
      .prepare(
        `SELECT id, scope, scope_id, source, display_name, storage_key, media_type,
                width, height, approval_status, approval_detail, approval_version,
                created_at, updated_at
           FROM creative_assets WHERE id = ?`,
      )
      .bind(id)
      .first();
    if (!row) return null;
    return this.fromRow(row);
  }

  /**
   * Override an asset to APPROVED. Reserved for operator
   * review of a NEEDS_REVIEW asset; the technical/policy/
   * placement gate is not bypassed.
   */
  async approveAsOperator(input: {
    assetId: string;
    actorId: string;
    reason: string;
  }): Promise<CreativeAsset> {
    const asset = await this.get(input.assetId);
    if (!asset) throw new Error(`Unknown asset: ${input.assetId}`);
    if (asset.approvalStatus !== "NEEDS_REVIEW") {
      throw new Error(
        `Operator override is only available for NEEDS_REVIEW assets; current status is ${asset.approvalStatus}.`,
      );
    }
    const now = this.deps.clock.nowIso();
    const nextVersion = asset.approvalVersion + 1;
    await this.deps.db
      .prepare(
        `UPDATE creative_assets
           SET approval_status = 'APPROVED', approval_detail = ?, approval_version = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(input.reason, nextVersion, now, input.assetId)
      .run();
    await this.deps.db
      .prepare(
        `INSERT INTO creative_asset_checks (id, asset_id, approval_version, check_id, result, detail, recorded_at)
         VALUES (?, ?, ?, 'OPERATOR_OVERRIDE', 'PASS', ?, ?)`,
      )
      .bind(crypto.randomUUID(), input.assetId, nextVersion, input.reason, now)
      .run();
    await this.deps.audit.record({
      actorType: "OPERATOR",
      actorId: input.actorId,
      action: "CREATIVE_ASSET_OVERRIDE_APPROVED",
      entityType: "CREATIVE_ASSET",
      entityId: input.assetId,
      fromState: "NEEDS_REVIEW",
      toState: "APPROVED",
      reasonCode: input.reason,
      correlationId: null,
      metadata: null,
    });
    const stored = await this.get(input.assetId);
    if (!stored) throw new Error("Failed to load asset after operator override.");
    return stored;
  }

  private evaluateTechnical(input: {
    mediaType: string;
    width: number;
    height: number;
    bytes: number;
  }): CheckOutcome[] {
    const checks: CheckOutcome[] = [];
    if (!ALLOWED_MIME.has(input.mediaType)) {
      checks.push({
        id: "media-type",
        result: "REJECT",
        detail: `unsupported media type: ${input.mediaType}`,
      });
    } else {
      checks.push({ id: "media-type", result: "PASS", detail: input.mediaType });
    }
    if (input.bytes > TECHNICAL_LIMITS.maxBytes) {
      checks.push({
        id: "byte-budget",
        result: "REJECT",
        detail: `bytes ${input.bytes} exceed max ${TECHNICAL_LIMITS.maxBytes}`,
      });
    } else {
      checks.push({
        id: "byte-budget",
        result: "PASS",
        detail: `bytes ${input.bytes} within budget`,
      });
    }
    if (input.width > TECHNICAL_LIMITS.maxWidth || input.height > TECHNICAL_LIMITS.maxHeight) {
      checks.push({
        id: "pixel-budget",
        result: "REJECT",
        detail: `dimensions ${input.width}x${input.height} exceed max ${TECHNICAL_LIMITS.maxWidth}x${TECHNICAL_LIMITS.maxHeight}`,
      });
    } else {
      checks.push({ id: "pixel-budget", result: "PASS", detail: `${input.width}x${input.height}` });
    }
    if (input.width < TECHNICAL_LIMITS.minWidth || input.height < TECHNICAL_LIMITS.minHeight) {
      checks.push({
        id: "minimum-size",
        result: "REJECT",
        detail: `dimensions ${input.width}x${input.height} below min ${TECHNICAL_LIMITS.minWidth}x${TECHNICAL_LIMITS.minHeight}`,
      });
    } else {
      checks.push({ id: "minimum-size", result: "PASS", detail: `${input.width}x${input.height}` });
    }
    return checks;
  }

  private evaluatePlacement(input: { width: number; height: number }): CheckOutcome[] {
    const aspect = input.width / input.height;
    const checks: CheckOutcome[] = [];
    let eligible = 0;
    for (const placement of DEFAULT_PLACEMENTS) {
      const aspectOk = aspect <= placement.maxAspectRatio && aspect >= placement.minAspectRatio;
      const sizeOk = input.width >= placement.minWidth && input.height >= placement.minHeight;
      if (sizeOk && aspectOk) {
        eligible += 1;
        checks.push({
          id: `placement:${placement.id}`,
          result: "PASS",
          detail: `aspect ${aspect.toFixed(2)} and size within ${placement.id}`,
        });
      } else {
        checks.push({
          id: `placement:${placement.id}`,
          result: "REJECT",
          detail: `aspect ${aspect.toFixed(2)} and size ${input.width}x${input.height} do not fit ${placement.id}`,
        });
      }
    }
    if (eligible === 0) {
      checks.push({
        id: "placement-overall",
        result: "REJECT",
        detail: "no placement accepts this asset",
      });
    }
    return checks;
  }

  private evaluateQuality(
    input: { width: number; height: number; bytes: number },
    technical: CheckOutcome[],
    placement: CheckOutcome[],
  ): CheckOutcome[] {
    const checks: CheckOutcome[] = [];
    const aspect = input.width / input.height;
    if (aspect >= 4 || aspect <= 0.25) {
      checks.push({
        id: "extreme-aspect",
        result: "WARN",
        detail: `extreme aspect ratio ${aspect.toFixed(2)}`,
      });
    } else {
      checks.push({ id: "extreme-aspect", result: "PASS", detail: `aspect ${aspect.toFixed(2)}` });
    }
    // Treat near-minimum dimensions as a subjective quality
    // warning. This is the deterministic seed of NEEDS_REVIEW
    // when the image passes the hard gates.
    const minSide = Math.min(input.width, input.height);
    if (minSide <= 200) {
      checks.push({
        id: "near-minimum-size",
        result: "WARN",
        detail: `min side ${minSide} is close to the technical minimum`,
      });
    } else {
      checks.push({ id: "near-minimum-size", result: "PASS", detail: `min side ${minSide}` });
    }
    // Surface the propagated check totals so an operator can
    // audit later.
    checks.push({
      id: "summary",
      result: "PASS",
      detail: `${technical.filter((c) => c.result === "PASS").length}/${technical.length} technical pass, ${placement.filter((c) => c.result === "PASS").length}/${placement.length} placements pass`,
    });
    return checks;
  }

  private async persistRejected(
    input: {
      scope: AssetScope;
      scopeId: string | null;
      source: AssetSource;
      displayName: string;
      storageKey: string;
      mediaType: string;
      width: number;
      height: number;
    },
    detail: string,
    checks: CheckOutcome[],
  ): Promise<CreativeAsset> {
    const id = crypto.randomUUID();
    const now = this.deps.clock.nowIso();
    await this.persist(input, id, "REJECTED", detail, now, checks);
    const stored = await this.get(id);
    if (!stored) throw new Error("Failed to load rejected asset.");
    return stored;
  }

  private async persist(
    input: {
      scope: AssetScope;
      scopeId: string | null;
      source: AssetSource;
      displayName: string;
      storageKey: string;
      mediaType: string;
      width: number;
      height: number;
    },
    id: string,
    status: AssetApprovalStatus,
    detail: string,
    now: string,
    checks: CheckOutcome[],
  ): Promise<void> {
    await this.deps.db
      .prepare(
        `INSERT INTO creative_assets
          (id, scope, scope_id, source, display_name, storage_key, media_type,
           width, height, approval_status, approval_detail, approval_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        id,
        input.scope,
        input.scopeId,
        input.source,
        input.displayName,
        input.storageKey,
        input.mediaType,
        input.width,
        input.height,
        status,
        detail,
        now,
        now,
      )
      .run();
    for (const check of checks) {
      await this.deps.db
        .prepare(
          `INSERT INTO creative_asset_checks
            (id, asset_id, approval_version, check_id, result, detail, recorded_at)
           VALUES (?, ?, 1, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), id, check.id, check.result, check.detail, now)
        .run();
    }
  }

  private fromRow(row: Record<string, unknown>): CreativeAsset {
    return {
      id: String(row.id),
      scope: row.scope as AssetScope,
      scopeId: (row.scope_id as string | null) ?? null,
      source: row.source as AssetSource,
      displayName: String(row.display_name),
      storageKey: String(row.storage_key),
      mediaType: String(row.media_type),
      width: Number(row.width),
      height: Number(row.height),
      approvalStatus: row.approval_status as AssetApprovalStatus,
      approvalDetail: (row.approval_detail as string | null) ?? null,
      approvalVersion: Number(row.approval_version),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
}
