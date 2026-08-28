-- Issue #12: chapters must carry structured geography so the
-- product is not Australia-only.
--
-- The original schema stored only a chapter slug and a name. A
-- newly configured non-Australian chapter must work without
-- changing chapter-routing business logic, so we add a small
-- set of structured fields. Existing rows are backfilled with
-- sensible Australia defaults so the migration is additive and
-- does not change current behaviour.

ALTER TABLE chapters ADD COLUMN country_code TEXT;
ALTER TABLE chapters ADD COLUMN region TEXT;
ALTER TABLE chapters ADD COLUMN timezone TEXT;
ALTER TABLE chapters ADD COLUMN locale TEXT;
ALTER TABLE chapters ADD COLUMN display_locality TEXT;

-- Best-effort backfill. The existing five Australian chapters
-- are well known; their country is Australia and their timezone
-- matches their capital city. The slug-to-timezone map is
-- authoritative for the seeded fixture; new chapters are
-- expected to provide their own country/timezone.

UPDATE chapters SET
  country_code = 'AU',
  region = CASE slug
    WHEN 'melbourne' THEN 'VIC'
    WHEN 'sydney' THEN 'NSW'
    WHEN 'brisbane' THEN 'QLD'
    WHEN 'adelaide' THEN 'SA'
    WHEN 'perth' THEN 'WA'
    ELSE NULL
  END,
  timezone = CASE slug
    WHEN 'melbourne' THEN 'Australia/Melbourne'
    WHEN 'sydney' THEN 'Australia/Sydney'
    WHEN 'brisbane' THEN 'Australia/Brisbane'
    WHEN 'adelaide' THEN 'Australia/Adelaide'
    WHEN 'perth' THEN 'Australia/Perth'
    ELSE NULL
  END,
  locale = 'en-AU',
  display_locality = name
WHERE country_code IS NULL;

-- Address country formatting is now driven by a structured
-- `country_code` on the member record. The legacy `country`
-- free-text column stays (additive, not destructive) so existing
-- data and queries still resolve.

CREATE INDEX IF NOT EXISTS idx_chapters_country ON chapters(country_code);
