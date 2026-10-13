ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS show_marketing_fee_in_client_docs BOOLEAN NOT NULL DEFAULT FALSE;
