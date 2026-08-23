-- 0001_initial_schema.sql
-- Initial schema for the Social Club Worker. Built from the conceptual ERD in
-- docs/05_DATA_MODEL_ERD.md. This is the canonical relational source of truth.
--
-- Invariants encoded here:
-- 1. Ordinary events have no attendance state (no `attended`/`checked_in`/
--    `no_show` columns; the state machine in `events.state` does not contain
--    those values either).
-- 2. State transitions are explicit: every important workflow has a state
--    column constrained to the documented state set.
-- 3. Important actions are auditable via audit_log.
-- 4. Side effects are idempotent: jobs and idempotency_records enforce
--    exactly-once business effects.

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Membership
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  preferred_name TEXT,
  postal_name TEXT,
  society_alias TEXT,
  country TEXT,
  metro_area TEXT,
  chapter_id TEXT,
  birthday TEXT, -- ISO 8601 date (year-less is acceptable); null if not given
  timezone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_members_chapter ON members(chapter_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'WAITLIST_ONLY', 'RETIRED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS membership_tiers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL REFERENCES membership_tiers(id),
  state TEXT NOT NULL CHECK (state IN (
    'APPLICANT',
    'EMAIL_VERIFIED',
    'IDENTITY_COMPLETE',
    'CHAPTER_RESOLUTION',
    'TIER_SELECTED',
    'PREFERENCES_COMPLETE',
    'SERVICES_SELECTED',
    'ALIGNMENT_COMPLETE',
    'CONSENTS_COMPLETE',
    'TERMS_ACCEPTED',
    'PAYMENT_PENDING',
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
    'CANCELLED',
    'WAITLIST_ONLY',
    'ABANDONED',
    'NOT_ACTIVATED'
  )),
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memberships_member ON memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_state ON memberships(state);

-- Capability mapping per tier. Used by the policy engine to answer
-- "does this tier enable capability X?" without hard-coding price checks.
-- See docs/06 §7.4 (capability mapping) and MASTER_SPEC §6.5.
CREATE TABLE IF NOT EXISTS tier_capabilities (
  tier_id TEXT NOT NULL REFERENCES membership_tiers(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  PRIMARY KEY (tier_id, capability)
);

-- Service grants control optional services. Tier is the ceiling; service
-- grant is the actual on/off per member. Member opt-out always wins.
-- See MASTER_SPEC §6.4 and §3.15.
CREATE TABLE IF NOT EXISTS service_grants (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN (
    'CORE_MEMBERSHIP',
    'NEWSLETTER',
    'PERSONALISED_MEMORY',
    'CALENDAR_MESSAGES',
    'PHYSICAL_CORRESPONDENCE',
    'GIFTS',
    'CALLS',
    'MANUFACTURED_COMMITMENTS',
    'APPEARANCE_INTEREST'
  )),
  state TEXT NOT NULL CHECK (state IN (
    'AVAILABLE',
    'OPTED_IN',
    'OPTED_OUT',
    'INELIGIBLE',
    'PAUSED',
    'SUSPENDED'
  )),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(member_id, service)
);

CREATE INDEX IF NOT EXISTS idx_service_grants_member ON service_grants(member_id);

-- Member facts. Status CANDIDATE is what AI proposes; CONFIRMED requires
-- deterministic policy. AI may not invent confirmed member facts.
-- See MASTER_SPEC §6.3 and §8.19.
CREATE TABLE IF NOT EXISTS member_facts (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  value_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'CANDIDATE',
    'CONFIRMED',
    'REJECTED',
    'REVOKED'
  )),
  source_type TEXT,
  source_id TEXT,
  confidence REAL,
  do_not_use INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_member_facts_member ON member_facts(member_id);
CREATE INDEX IF NOT EXISTS idx_member_facts_status ON member_facts(status);

-- Member-timeline entries: every important event a member experiences.
-- Birthdays, anniversaries, invitations, cancellations, gifts, calls, etc.
CREATE TABLE IF NOT EXISTS member_timeline (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_timeline_member ON member_timeline(member_id);
CREATE INDEX IF NOT EXISTS idx_member_timeline_occurred_at ON member_timeline(occurred_at);

-- -----------------------------------------------------------------------------
-- Legal / consent
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS legal_documents (
  id TEXT PRIMARY KEY,
  doc_type TEXT NOT NULL,
  version TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(doc_type, version)
);

CREATE TABLE IF NOT EXISTS member_acceptances (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  method TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_acceptances_member ON member_acceptances(member_id);

-- -----------------------------------------------------------------------------
-- Geography
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  chapter_id TEXT REFERENCES chapters(id),
  name TEXT NOT NULL,
  suburb TEXT,
  address TEXT,
  source_url TEXT,
  location_type TEXT,
  tags_json TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'ACTIVE',
    'REVERIFY_DUE',
    'STALE',
    'RETIRED'
  )),
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_locations_chapter ON locations(chapter_id);
CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status);

-- -----------------------------------------------------------------------------
-- Events
-- -----------------------------------------------------------------------------

-- Events are constructed correspondence, not real attendance obligations.
-- There is intentionally no `attended` / `checked_in` / `no_show` column or
-- state value. See AGENTS.md invariants 1-2 and MASTER_SPEC §7.4.
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  title TEXT NOT NULL,
  event_type TEXT,
  start_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  cancellation_due_at TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'DRAFT',
    'VALIDATING',
    'APPROVED',
    'SCHEDULED',
    'INVITATIONS_QUEUED',
    'INVITED',
    'REMINDER_WINDOW',
    'CANCELLATION_QUEUED',
    'CANCELLED',
    'CALENDAR_CANCELLATION_PROCESSED',
    'SEND_FAILURE',
    'CANCELLATION_FAILURE',
    'CRITICAL_OPERATOR_ACTION',
    'ABANDONED',
    'ARCHIVED'
  )),
  description TEXT,
  dress_guidance TEXT,
  created_by_actor TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  cancelled_at TEXT,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_state ON events(state);
CREATE INDEX IF NOT EXISTS idx_events_chapter ON events(chapter_id);
CREATE INDEX IF NOT EXISTS idx_events_cancellation_due ON events(cancellation_due_at);

CREATE TABLE IF NOT EXISTS event_locations (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id),
  PRIMARY KEY (event_id, location_id)
);

CREATE TABLE IF NOT EXISTS event_invitations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  calendar_payload INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, member_id)
);

CREATE TABLE IF NOT EXISTS event_transitions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT NOT NULL,
  reason_code TEXT,
  actor_type TEXT,
  actor_id TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
-- Communications
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS communication_templates (
  id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS communications (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL', 'POSTAL', 'CALENDAR')),
  template_key TEXT,
  state TEXT NOT NULL CHECK (state IN (
    'DRAFT',
    'GENERATED',
    'VALIDATED',
    'SCHEDULED',
    'CANCELLED_BEFORE_SEND',
    'QUEUED',
    'SENT',
    'DELIVERED',
    'BOUNCED',
    'COMPLAINED',
    'TRANSIENT_FAILURE',
    'PERMANENT_FAILURE',
    'REJECTED'
  )),
  related_entity_type TEXT,
  related_entity_id TEXT,
  provider_message_id TEXT,
  provider_event_id TEXT,
  metadata_json TEXT,
  scheduled_at TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_communications_state ON communications(state);
CREATE INDEX IF NOT EXISTS idx_communications_member ON communications(member_id);

-- Inbound messages. Note: the `email.received` webhook is metadata only; the
-- body must be fetched via the Resend Received Emails API and persisted here.
-- See docs/08_RESEND_EMAIL_CALENDAR.md and MASTER_SPEC §9.6.
CREATE TABLE IF NOT EXISTS inbound_messages (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  provider_email_id TEXT,
  from_address TEXT,
  from_name TEXT,
  to_addresses_json TEXT,
  cc_addresses_json TEXT,
  subject TEXT,
  message_id_header TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments_json TEXT,
  raw_metadata_json TEXT,
  signature_verified INTEGER NOT NULL,
  match_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  classification TEXT,
  auto_handled INTEGER NOT NULL DEFAULT 0,
  human_review_required INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL CHECK (state IN (
    'RECEIVED',
    'SIGNATURE_VERIFIED',
    'STORED',
    'FETCHING_BODY',
    'FETCH_FAILED',
    'MATCHED',
    'UNMATCHED',
    'CLASSIFIED',
    'AUTO_HANDLED',
    'HUMAN_REVIEW',
    'SAFE_NO_ACTION',
    'CLOSED',
    'REJECTED',
    'ACKNOWLEDGED_NOOP',
    'QUARANTINED',
    'PERMANENT_FAILURE'
  )),
  received_at TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inbound_messages_state ON inbound_messages(state);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_match ON inbound_messages(match_member_id);

-- -----------------------------------------------------------------------------
-- Waitlist
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  preferred_name TEXT,
  chapter_id TEXT REFERENCES chapters(id),
  metro_area TEXT,
  why_joining_json TEXT,
  source TEXT,
  state TEXT NOT NULL CHECK (state IN (
    'SUBMITTED',
    'VALIDATED',
    'WELCOME_QUEUED',
    'ACTIVE_WAITLIST',
    'RETRY',
    'REJECTED',
    'INVALID_EMAIL',
    'FAILED_PERMANENTLY',
    'CONVERTED',
    'UNSUBSCRIBED',
    'DELETED'
  )),
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_waitlist_state ON waitlist_entries(state);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist_entries(email);

-- -----------------------------------------------------------------------------
-- Milestones / fulfilment
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS milestone_definitions (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  template_key TEXT,
  tier_specific INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS member_milestones (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  triggered_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(member_id, trigger_type, triggered_on)
);

CREATE TABLE IF NOT EXISTS fulfilment_tasks (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN (
    'PRINT_AND_SIGN',
    'POST_ITEM',
    'SELECT_GIFT',
    'PURCHASE_GIFT',
    'MAKE_CALL',
    'REVIEW_CORRESPONDENCE',
    'REVIEW_INBOUND_MESSAGE',
    'APPROVE_EVENT',
    'RESEARCH_EXCEPTION',
    'APPEARANCE_ENQUIRY',
    'PERFORM_APPEARANCE',
    'PRIVACY_REQUEST',
    'CRITICAL_CANCELLATION'
  )),
  state TEXT NOT NULL CHECK (state IN (
    'CREATED',
    'OPERATOR_NOTIFIED',
    'ACKNOWLEDGED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'OVERDUE',
    'ESCALATED',
    'BLOCKED',
    'RESCHEDULED'
  )),
  context_json TEXT,
  deadline TEXT,
  operator_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_fulfilment_tasks_member ON fulfilment_tasks(member_id);
CREATE INDEX IF NOT EXISTS idx_fulfilment_tasks_state ON fulfilment_tasks(state);

-- -----------------------------------------------------------------------------
-- Optional services
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS commitment_scenarios (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  goal TEXT,
  scenario_text TEXT,
  state TEXT NOT NULL CHECK (state IN (
    'REQUESTED',
    'GOAL_CAPTURED',
    'SCENARIO_PROPOSED',
    'CONFIRMED',
    'SCHEDULED',
    'REMINDER_PHASE',
    'PRESSURE_WINDOW',
    'CANCELLATION_QUEUED',
    'OPERATOR_ESCALATION',
    'COMPLETED',
    'ABORTED',
    'DECLINED'
  )),
  confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- -----------------------------------------------------------------------------
-- System: jobs, idempotency, audit
-- -----------------------------------------------------------------------------

-- Jobs are the durable work units enqueued by Cron and other systems.
-- Idempotency is enforced via idempotency_key; the same key is treated as
-- the same business effect regardless of how many times it is delivered.
-- See MASTER_SPEC §5.9, §6.7, §8.5.
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload_version TEXT NOT NULL DEFAULT '1',
  priority INTEGER NOT NULL DEFAULT 100,
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_until TEXT,
  claimed_by TEXT,
  state TEXT NOT NULL CHECK (state IN (
    'AVAILABLE',
    'CLAIMED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'DEAD_LETTER'
  )),
  failure_reason TEXT,
  correlation_id TEXT,
  payload_json TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_available_at ON jobs(available_at);

CREATE TABLE IF NOT EXISTS idempotency_records (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  job_id TEXT REFERENCES jobs(id),
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit log. Important actions are auditable. See MASTER_SPEC §6.8.
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  from_state TEXT,
  to_state TEXT,
  reason_code TEXT,
  correlation_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);

-- AI generation provenance: prompt/version/model/result. Required for
-- traceability. See MASTER_SPEC §10.9.
CREATE TABLE IF NOT EXISTS ai_generations (
  id TEXT PRIMARY KEY,
  prompt_id TEXT,
  prompt_version TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  generation_id TEXT,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  member_fact_ids_json TEXT,
  validation_result TEXT,
  final_action TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_member ON ai_generations(member_id);
