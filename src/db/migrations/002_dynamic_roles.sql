-- Migration 002: Dynamic Role Masters & Tasks Support

ALTER TABLE role_masters 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE estimate_tasks 
ADD COLUMN IF NOT EXISTS role_hours JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill role_hours from existing columns if empty or default
UPDATE estimate_tasks 
SET role_hours = jsonb_build_object(
    'PM', COALESCE(hours_pm, 0),
    'WEB_DEV', COALESCE(hours_web_dev, 0),
    'UI_UX', COALESCE(hours_ui_ux, 0),
    'QC_DOC', COALESCE(hours_qc_doc, 0),
    'DEV_OPS', COALESCE(hours_dev_ops, 0)
)
WHERE role_hours = '{}'::jsonb OR role_hours IS NULL;
