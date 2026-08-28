-- Issue #13: outward-facing club identity.
--
-- Each chapter can declare its own default outward-facing club
-- name, and a member can override it for their own commitments.
-- The default platform name is the configured product name;
-- it is not stored in the database so the application remains
-- the single source of truth for the platform fallback.

CREATE TABLE IF NOT EXISTS chapter_outward_identities (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RETIRED')) DEFAULT 'ACTIVE',
  source TEXT NOT NULL CHECK (source IN ('DEFAULT', 'CURATED', 'GENERATED', 'CUSTOM')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (chapter_id, display_name)
);

CREATE INDEX IF NOT EXISTS idx_chapter_outward_identities_chapter
  ON chapter_outward_identities(chapter_id);

CREATE TABLE IF NOT EXISTS member_outward_identities (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'RETIRED')) DEFAULT 'ACTIVE',
  source TEXT NOT NULL CHECK (source IN ('DEFAULT', 'CURATED', 'GENERATED', 'CUSTOM')),
  review_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (member_id, display_name)
);

CREATE INDEX IF NOT EXISTS idx_member_outward_identities_member
  ON member_outward_identities(member_id);
