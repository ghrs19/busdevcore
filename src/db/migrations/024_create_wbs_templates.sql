-- Migration 024: Create wbs_templates (WBS Costing Templates master data).
--
-- Tabel ini dipakai sejak fitur Master Data WBS Templates
-- (src/app/api/templates/route.ts: SELECT/INSERT/UPDATE/DELETE atas kolom
-- id, name, category, description, payload, is_active, created_at, updated_at)
-- dan direferensikan oleh migrasi 017 (UPDATE payload untuk rename kode role
-- QC_DOC -> QC_DOCS dan DEV_OPS -> DEVOPS), tetapi tidak pernah dibuat oleh
-- migrasi mana pun — di database lama tabel ini dibuat manual di luar migrasi.
--
-- CREATE TABLE IF NOT EXISTS: database yang tabelnya sudah ada (dibuat
-- manual) tidak berubah dan tidak error; database yang belum punya tabelnya
-- kini mendapatkannya secara resmi lewat migrasi.
--
-- Catatan urutan: file ini sendiri berada SETELAH 017, jadi untuk instalasi
-- dari database kosong, pembuatan tabel yang efektif terjadi lebih awal di
-- migrasi sisipan 000_create_wbs_templates.sql (SQL identik, sama-sama
-- IF NOT EXISTS). File 024 ini adalah registrasi kanonisnya untuk database
-- existing/baseline: di sana ia teraplikasi sebagai no-op dan tercatat di
-- ledger schema_migrations. Kedua jalur membuat skema yang sama persis.

CREATE TABLE IF NOT EXISTS wbs_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pola baca API templates: filter per category dan is_active, urut per id.
CREATE INDEX IF NOT EXISTS idx_wbs_templates_category_active
    ON wbs_templates (category, is_active);
