-- 0002_agent_leases.sql
-- Adds the agent_leases table for the local/hosted agent lease primitive.
-- See MASTER_SPEC §8.25 and docs/13_TEST_PLAN.md §14.24.

CREATE TABLE IF NOT EXISTS agent_leases (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  claimed_until TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'RELEASED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_agent_leases_job ON agent_leases(job_id);
CREATE INDEX IF NOT EXISTS idx_agent_leases_state ON agent_leases(state);
CREATE INDEX IF NOT EXISTS idx_agent_leases_claimed_until ON agent_leases(claimed_until);
