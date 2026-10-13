-- Migration 020: per-category commercial pricing.
-- category_pricing = { "DEVELOPMENT": {cogs, margin_percent, base_price}, "MAINTENANCE": {...}, ... }
-- Legacy columns (cogs_amount, margin_percent, base_price, ...) keep the combined figures so invoices,
-- dashboard and exports continue to work unchanged.
ALTER TABLE commercial_proposals ADD COLUMN IF NOT EXISTS category_pricing JSONB;
