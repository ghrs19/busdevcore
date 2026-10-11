-- Migration 012: Hybrid Billing Schedule (Milestones & Monthly Retainer)
ALTER TABLE payment_milestone_invoices 
  ADD COLUMN IF NOT EXISTS billing_type VARCHAR(30) DEFAULT 'milestone',
  ADD COLUMN IF NOT EXISTS phase VARCHAR(50) DEFAULT 'DEVELOPMENT',
  ADD COLUMN IF NOT EXISTS period_month INT,
  ADD COLUMN IF NOT EXISTS coverage_period VARCHAR(100);

ALTER TABLE payment_milestone_invoices DROP CONSTRAINT IF EXISTS uq_proposal_term;
ALTER TABLE payment_milestone_invoices DROP CONSTRAINT IF EXISTS uq_proposal_billing_schedule;
ALTER TABLE payment_milestone_invoices ADD CONSTRAINT uq_proposal_billing_schedule UNIQUE(proposal_id, billing_type, term_index);

CREATE INDEX IF NOT EXISTS idx_milestone_invoices_type ON payment_milestone_invoices(billing_type);
