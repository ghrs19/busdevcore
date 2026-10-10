-- 009_commercial_proposal_versioning.sql
-- Add versioning and revision tracking to commercial_proposals

ALTER TABLE commercial_proposals
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES commercial_proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revision_notes TEXT;

-- Drop single unique constraint on proposal_number and replace with (proposal_number, version)
ALTER TABLE commercial_proposals
  DROP CONSTRAINT IF EXISTS commercial_proposals_proposal_number_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commercial_proposals_number_version_key'
  ) THEN
    ALTER TABLE commercial_proposals
      ADD CONSTRAINT commercial_proposals_number_version_key UNIQUE (proposal_number, version);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_commercial_proposals_parent_id ON commercial_proposals(parent_id);
CREATE INDEX IF NOT EXISTS idx_commercial_proposals_version ON commercial_proposals(version);
