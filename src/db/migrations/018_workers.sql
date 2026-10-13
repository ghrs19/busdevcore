-- Migration 018: Master Data Worker.
-- Workers (name + current hourly rate) are independent of role_masters: a worker is not tied to a role.
-- The role code is chosen per costing entry; estimate rate snapshots keep their own frozen copy.

CREATE TABLE IF NOT EXISTS workers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    hourly_rate NUMERIC(12, 2) NOT NULL CHECK (hourly_rate >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Names are unique case-insensitively so the same person cannot be registered twice.
CREATE UNIQUE INDEX IF NOT EXISTS workers_name_lower_key ON workers (LOWER(name));
