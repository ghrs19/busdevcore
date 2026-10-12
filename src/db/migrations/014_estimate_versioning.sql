-- Add the estimate revision fields already consumed by the API.
ALTER TABLE project_estimates
  ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES project_estimates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_project_estimates_parent_id ON project_estimates(parent_id);
CREATE INDEX IF NOT EXISTS idx_project_estimates_version ON project_estimates(version);
