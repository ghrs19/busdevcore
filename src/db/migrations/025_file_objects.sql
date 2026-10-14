-- Object storage on PostgreSQL (Neon) instead of a separate MinIO service.
-- Uploaded files are small (upload routes enforce a 10 MB cap) and always
-- referenced from business rows (payment_milestone_invoices.proof_file_url,
-- contract_documents.file_url), so keeping the bytes in the same database
-- keeps files transactionally close to the data they belong to and lets one
-- Neon database serve both relational data and file objects.
CREATE TABLE IF NOT EXISTS file_objects (
  object_name TEXT PRIMARY KEY,
  content_type VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
  size BIGINT NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
