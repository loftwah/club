-- Issue #10: cancellable Club Meetings that block the
-- member's calendar until they are cancelled.
--
-- A Club Meeting is a real, scheduled calendar block. The
-- service guarantees the meeting is automatically cancelled at
-- the configured time even if the member is not online. The
-- outward-facing calendar entry uses a deliberately ordinary
-- title (e.g. "Club Meeting") and the meeting is associated
-- with exactly one member so the cancellation can target a
-- single .ics invite.
--
-- The meetings table tracks the cancellation idempotency
-- key (calendar_uid), the configured cancellation window, the
-- chapter timezone, and an explicit lifecycle state. The
-- meeting is scheduled against the same events table so the
-- existing safety monitor and the cron-style cancellation
-- pipeline already know how to process it.

CREATE TABLE IF NOT EXISTS club_meetings (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TEXT NOT NULL, -- ISO 8601 UTC
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 720),
  timezone TEXT NOT NULL, -- IANA timezone of the chapter/member
  chapter_id TEXT REFERENCES chapters(id),
  cancellation_window_minutes INTEGER NOT NULL CHECK (cancellation_window_minutes >= 5 AND cancellation_window_minutes <= 24 * 60),
  calendar_uid TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'SCHEDULED',
    'CANCELLING',
    'CANCELLED',
    'CANCELLATION_FAILED',
    'ARCHIVED'
  )),
  cancellation_due_at TEXT NOT NULL,
  cancelled_at TEXT,
  cancellation_reason TEXT,
  last_attempt_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_club_meetings_member ON club_meetings(member_id);
CREATE INDEX IF NOT EXISTS idx_club_meetings_state ON club_meetings(state);
CREATE INDEX IF NOT EXISTS idx_club_meetings_cancellation_due ON club_meetings(cancellation_due_at);

-- Cancellation ledger: a row per cancellation attempt with
-- outcome. The service is idempotent: re-attempts reference the
-- same calendar_uid and never produce duplicate
-- cancellation emails/calendar updates.
CREATE TABLE IF NOT EXISTS club_meeting_cancellations (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES club_meetings(id) ON DELETE CASCADE,
  attempt_at TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('SUCCESS', 'TRANSIENT_FAILURE', 'PERMANENT_FAILURE')),
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_club_meeting_cancellations_meeting
  ON club_meeting_cancellations(meeting_id);
