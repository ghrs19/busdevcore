-- Global marketing fee percentage applied to total category base price before discount and PPN.
ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS marketing_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS marketing_fee_categories JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS marketing_fee_mode VARCHAR(24) NOT NULL DEFAULT 'ALL_PROPORTIONAL';
