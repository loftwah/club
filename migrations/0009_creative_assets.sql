-- Issues #14 and #15: outward-facing club artwork with a
-- quality/safety approval gate.
--
-- Creative assets live in their own first-class table. Each
-- asset has a source (DEFAULT, CURATED, GENERATED, MEMBER_UPLOAD),
-- a stable storage reference, a placement contract and an
-- approval status. The approval gate is a hard requirement
-- before any non-default asset can become active.

CREATE TABLE IF NOT EXISTS creative_assets (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('PLATFORM', 'CHAPTER', 'MEMBER')),
  scope_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('DEFAULT', 'CURATED', 'GENERATED', 'MEMBER_UPLOAD')),
  display_name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  media_type TEXT NOT NULL,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  approval_status TEXT NOT NULL CHECK (approval_status IN (
    'PENDING', 'ANALYSING', 'APPROVED', 'NEEDS_REVIEW', 'REJECTED'
  )) DEFAULT 'PENDING',
  approval_detail TEXT,
  approval_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_creative_assets_scope ON creative_assets(scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_creative_assets_status ON creative_assets(approval_status);

-- The approval gate records structured check results. Each
-- check has an id, result and detail. Persisting the result
-- gives operators a deterministic record of why an asset was
-- approved or rejected.
CREATE TABLE IF NOT EXISTS creative_asset_checks (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES creative_assets(id) ON DELETE CASCADE,
  approval_version INTEGER NOT NULL,
  check_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('PASS', 'WARN', 'REVIEW', 'REJECT')),
  detail TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_creative_asset_checks_asset
  ON creative_asset_checks(asset_id);

-- A member or chapter can have at most one active asset per
-- scope at a time. The active reference is a foreign key into
-- creative_assets so a retired asset cannot become active.
CREATE TABLE IF NOT EXISTS active_creative_assets (
  scope TEXT NOT NULL CHECK (scope IN ('CHAPTER', 'MEMBER')),
  scope_id TEXT NOT NULL,
  asset_id TEXT NOT NULL REFERENCES creative_assets(id) ON DELETE CASCADE,
  activated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (scope, scope_id)
);
