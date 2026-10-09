-- Migration 004: Separated WBS Categories (Development, Maintenance, Infrastructure) & Full Snapshot

ALTER TABLE project_estimates
ADD COLUMN IF NOT EXISTS maintenance_config JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS infrastructure_items JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS billing_summary JSONB DEFAULT NULL;
