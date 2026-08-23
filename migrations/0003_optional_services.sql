-- 0003_optional_services.sql
-- Tables for gifts, calls, and appearance requests.
-- These were not in 0001_initial_schema.sql because Phase 5/8 was
-- sequenced for later. They are added here so the corresponding
-- services and tests can be built without changing existing rows.

CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  occasion TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_cents INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'TRIGGERED',
    'ELIGIBILITY_CHECK',
    'ELIGIBLE',
    'SUGGESTED',
    'HUMAN_APPROVED',
    'PURCHASED',
    'DISPATCHED',
    'DELIVERED',
    'NOT_ELIGIBLE',
    'BUDGET_DENIED',
    'MEMBER_OPTED_OUT',
    'ALTERNATIVE',
    'CANCELLED'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gifts_member ON gifts(member_id);
CREATE INDEX IF NOT EXISTS idx_gifts_state ON gifts(state);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'PROPOSED',
    'POLICY_ALLOWED',
    'POLICY_DENIED',
    'SCHEDULED',
    'DUE',
    'COMPLETED',
    'NO_ANSWER',
    'RESCHEDULED',
    'PERMISSION_REVOKED',
    'MEMBER_CANCELLED',
    'CLOSED'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_calls_member ON calls(member_id);
CREATE INDEX IF NOT EXISTS idx_calls_state ON calls(state);

CREATE TABLE IF NOT EXISTS appearance_requests (
  id TEXT PRIMARY KEY,
  requester_id TEXT,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  location TEXT NOT NULL,
  travel_required INTEGER NOT NULL DEFAULT 0,
  brief TEXT,
  state TEXT NOT NULL CHECK (state IN (
    'REQUESTED',
    'SUITABILITY_REVIEW',
    'SUITABILITY_APPROVED',
    'SUITABILITY_DECLINED',
    'QUOTED',
    'QUOTE_EXPIRED',
    'ACCEPTED',
    'PAYMENT_PENDING',
    'PAYMENT_FAILED',
    'BOOKED',
    'PERFORMED',
    'CUSTOMER_CANCELLED',
    'CLUB_CANCELLED',
    'SAFETY_CANCELLED',
    'REFUND_RESOLUTION',
    'CLOSED'
  )),
  quote_base_cents INTEGER,
  quote_travel_cents INTEGER,
  quote_total_cents INTEGER,
  quote_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appearance_state ON appearance_requests(state);
CREATE INDEX IF NOT EXISTS idx_appearance_member ON appearance_requests(member_id);

-- member_timeline additions: timeline is a generic append-only log
-- per member. We don't need a new table — the existing one already
-- accepts arbitrary event_type strings.

-- Billing tables (Stripe-ready). The application does not take real
-- money until the user explicitly approves paid launch, but the
-- domain tables exist now so the tests can prove the lifecycle.
CREATE TABLE IF NOT EXISTS billing_customers (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_customer_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, provider_customer_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_customer_id TEXT NOT NULL,
  provider_subscription_id TEXT NOT NULL,
  tier_id TEXT NOT NULL REFERENCES membership_tiers(id),
  status TEXT NOT NULL CHECK (status IN (
    'INCOMPLETE',
    'ACTIVE',
    'PAST_DUE',
    'CANCELLED',
    'UNPAID'
  )),
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON subscriptions(member_id);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  customer_id TEXT,
  subscription_id TEXT,
  invoice_id TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events(event_type);

-- Member auth tables.
-- We store only SHA-256(token), not the token itself. The token is
-- shown once when issued and never again.
CREATE TABLE IF NOT EXISTS magic_links (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_magic_links_member ON magic_links(member_id);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON magic_links(expires_at);

CREATE TABLE IF NOT EXISTS member_sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_sessions_member ON member_sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_member_sessions_expires ON member_sessions(expires_at);

-- Account deletion requests.
CREATE TABLE IF NOT EXISTS deletion_requests (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  requested_at TEXT NOT NULL,
  confirmed_at TEXT,
  completed_at TEXT,
  state TEXT NOT NULL CHECK (state IN (
    'PENDING_CONFIRM',
    'CONFIRMED',
    'ACTIVITY_SUSPENDED',
    'FUTURE_JOBS_CANCELLED',
    'PERSONAL_DATA_DELETION',
    'RETENTION_SEPARATED',
    'DELETED',
    'CANCELLED'
  ))
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_member ON deletion_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_state ON deletion_requests(state);

-- Onboarding wizard tables.
CREATE TABLE IF NOT EXISTS onboarding_progress (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS onboarding_step_data (
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (member_id, step)
);
