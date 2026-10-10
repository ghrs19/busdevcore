-- Migration 011: Payment Milestone & Invoice Tracker

CREATE TABLE IF NOT EXISTS payment_milestone_invoices (
    id SERIAL PRIMARY KEY,
    proposal_id INT NOT NULL REFERENCES commercial_proposals(id) ON DELETE CASCADE,
    term_index INT NOT NULL,
    milestone_name VARCHAR(255) NOT NULL,
    percent NUMERIC(5,2) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    trigger_condition TEXT,
    billing_status VARCHAR(30) DEFAULT 'unbilled', -- "unbilled", "invoiced", "paid", "overdue"
    invoice_number VARCHAR(100),
    invoice_date DATE,
    due_date DATE,
    paid_date DATE,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    proof_reference TEXT,
    notes TEXT,
    updated_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_proposal_term UNIQUE(proposal_id, term_index)
);

CREATE INDEX IF NOT EXISTS idx_milestone_invoices_proposal ON payment_milestone_invoices(proposal_id);
CREATE INDEX IF NOT EXISTS idx_milestone_invoices_status ON payment_milestone_invoices(billing_status);
