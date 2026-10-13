-- Migration 017: role codes for person-based rate snapshots.
-- Role master and people are independent: role_masters only supplies the selectable role codes.
-- Codes follow the staff rate table: WEB_DEV, QC_DOCS, FULL_DEV, UI_UX, MOB_DEV, DEVOPS (+ PM kept).

-- 1. Rename legacy codes in place (keeps ids and any references stable).
UPDATE role_masters SET code = 'QC_DOCS', name = 'QC & DOCS', updated_at = NOW() WHERE code = 'QC_DOC';
UPDATE role_masters SET code = 'DEVOPS', name = 'DEVOPS', updated_at = NOW() WHERE code = 'DEV_OPS';

-- 2. Add the new codes (default_hourly_rate is a required legacy column; real rates live per person).
INSERT INTO role_masters (code, name, default_hourly_rate, is_active) VALUES
  ('FULL_DEV', 'FULL DEV', 0, TRUE),
  ('MOB_DEV', 'MOB DEV', 0, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 3. WBS templates store hours keyed by role code: follow the renames so they keep resolving.
UPDATE wbs_templates
SET payload = REPLACE(REPLACE(payload::text, '"QC_DOC"', '"QC_DOCS"'), '"DEV_OPS"', '"DEVOPS"')::jsonb
WHERE payload::text LIKE '%"QC_DOC"%' OR payload::text LIKE '%"DEV_OPS"%';
