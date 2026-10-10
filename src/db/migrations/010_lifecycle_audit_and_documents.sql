-- Migration 010: Lifecycle Status, Audit Trail Logs, and Derivative Contract Documents

ALTER TABLE commercial_proposals 
ADD COLUMN IF NOT EXISTS deal_status VARCHAR(30) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS lost_reason TEXT,
ADD COLUMN IF NOT EXISTS deal_closed_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

CREATE TABLE IF NOT EXISTS contract_documents (
    id SERIAL PRIMARY KEY,
    proposal_id INT NOT NULL REFERENCES commercial_proposals(id) ON DELETE CASCADE,
    doc_type VARCHAR(30) NOT NULL,
    doc_number VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    term_index INT,
    sign_date DATE NOT NULL,
    amount NUMERIC(15,2),
    status VARCHAR(30) DEFAULT 'draft',
    notes TEXT,
    created_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_docs_proposal ON contract_documents(proposal_id);
