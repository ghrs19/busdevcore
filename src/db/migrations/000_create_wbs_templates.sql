-- Migration 000 (sisipan / backfilled prerequisite): Create wbs_templates.
--
-- Kenapa nomor 000?
-- Migrasi 017 meng-UPDATE tabel wbs_templates, tetapi tabel ini tidak pernah
-- dibuat oleh migrasi mana pun (di database lama dibuat manual), sehingga
-- instalasi dari database kosong selalu gagal di 017. Perbaikannya harus
-- tereksekusi SEBELUM 017, dan di dalam aturan migration-runner nomor 000
-- adalah satu-satunya slot yang memungkinkan:
--   * nomor 001-016 sudah terpakai dan runner menolak prefix versi duplikat
--     (dua file "016_*" = error "Duplicate migration version");
--   * sisipan huruf seperti "016b_*" gagal regex nama file runner
--     (/^\d+_[\w.-]+\.sql$/);
--   * mengubah isi 017 akan merusak checksum di ledger database yang sudah
--     menerapkannya.
-- File ini terurut paling awal, jadi instalasi fresh langsung lolos:
-- tabel dibuat di sini, 017 kemudian meng-UPDATE tabel kosong dengan aman.
--
-- Isi SQL identik dengan migrasi 024_create_wbs_templates.sql dan sama-sama
-- IF NOT EXISTS, sehingga:
--   * database existing: file ini teraplikasi sekali sebagai no-op dan
--     tercatat di ledger; 024 tetap tercatat/teraplikasi normal;
--   * database fresh: tabel dibuat di sini, 024 menjadi no-op.
-- Skema mengikuti kontrak src/app/api/templates/route.ts
-- (id, name, category, description, payload, is_active, created_at, updated_at).

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
