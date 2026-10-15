-- Mapping table for external object-storage drivers (e.g. Google Drive).
-- The postgres storage driver keeps file bytes inside file_objects, but
-- external drivers keep bytes outside the database; this table records
-- which external object belongs to each server-generated object name so
-- uploads, downloads, stats, and deletes can find it again.
CREATE TABLE IF NOT EXISTS storage_objects (
  object_name TEXT NOT NULL,
  driver VARCHAR(50) NOT NULL,
  external_id TEXT NOT NULL,
  content_type VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
  size BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (object_name, driver)
);

CREATE INDEX IF NOT EXISTS idx_storage_objects_external
  ON storage_objects (driver, external_id);
