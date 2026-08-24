-- Migration 0004: waitlist tier interest
--
-- Capture the tier a visitor expressed interest in from the public
-- tier CTAs (Member / Corresponding Member / Deluxe Member) on the
-- waitlist flow. Nullable so existing rows are preserved untouched.
--
-- This is the waitlist-only launch schema. Paid activation is still
-- gated by Stripe (disabled in production). Storing the expressed
-- interest lets the operator prioritise outreach by tier when
-- activation opens, and lets the welcome email acknowledge what the
-- visitor asked for.

ALTER TABLE waitlist_entries ADD COLUMN interested_tier TEXT
  CHECK (interested_tier IS NULL OR interested_tier IN (
    'Member',
    'Corresponding Member',
    'Deluxe Member'
  ));

CREATE INDEX IF NOT EXISTS idx_waitlist_interested_tier
  ON waitlist_entries(interested_tier);
