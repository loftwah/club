-- 0005_workflow_integrity.sql
-- Additive hardening for deletion confirmation, durable-job idempotency,
-- and the onboarding tier sentinel required by memberships.tier_id NOT NULL.
-- Existing member and operational rows are preserved.

ALTER TABLE deletion_requests ADD COLUMN confirm_token_hash TEXT;
ALTER TABLE deletion_requests ADD COLUMN confirm_expires_at TEXT;
ALTER TABLE deletion_requests ADD COLUMN last_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deletion_requests_confirm_token
  ON deletion_requests(confirm_token_hash)
  WHERE confirm_token_hash IS NOT NULL;

ALTER TABLE jobs ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency_key
  ON jobs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- This row is an internal relational sentinel, not a fourth product tier.
-- It is never selectable or advertised. It lets a brand-new applicant exist
-- before the explicit tier-selection step without violating the existing
-- memberships.tier_id NOT NULL foreign key.
INSERT OR IGNORE INTO membership_tiers (
  id, slug, display_name, price_cents, currency, created_at
) VALUES (
  'tier_onboarding_unselected',
  '__onboarding_unselected',
  'Onboarding (tier not selected)',
  0,
  'AUD',
  datetime('now')
);
