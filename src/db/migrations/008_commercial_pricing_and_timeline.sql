-- 008_commercial_pricing_and_timeline.sql
-- Add timeline_config to project_estimates and create commercial_proposals table

ALTER TABLE project_estimates
  ADD COLUMN IF NOT EXISTS timeline_config JSONB;

CREATE TABLE IF NOT EXISTS commercial_proposals (
  id SERIAL PRIMARY KEY,
  proposal_number VARCHAR(100) UNIQUE NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_id INTEGER NOT NULL REFERENCES project_estimates(id) ON DELETE RESTRICT,
  cogs_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  margin_percent NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  base_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE',
  discount_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  subtotal_after_discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_tax_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  timeline_config JSONB,
  payment_terms JSONB,
  validity_days INTEGER NOT NULL DEFAULT 30,
  notes TEXT,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_proposals_project_id ON commercial_proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_commercial_proposals_company_id ON commercial_proposals(company_id);
CREATE INDEX IF NOT EXISTS idx_commercial_proposals_estimate_id ON commercial_proposals(estimate_id);
