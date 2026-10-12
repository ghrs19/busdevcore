-- Migration 015: Idempotent estimate creation requests
CREATE TABLE IF NOT EXISTS estimate_idempotency_keys (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(255) NOT NULL,
  request_fingerprint CHAR(64) NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  estimate_id INTEGER REFERENCES project_estimates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, idempotency_key)
);
