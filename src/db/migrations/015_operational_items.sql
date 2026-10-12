-- Store operational WBS items with the other estimate JSONB snapshots.
ALTER TABLE project_estimates
  ADD COLUMN IF NOT EXISTS operational_items JSONB;
