-- Migration 003: Projects Per Company & Multi-Category Costing

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tambah kategori 'INFRASTRUCTURE' di bawah service 'IT'
INSERT INTO categories (service_type_id, code, name)
SELECT st.id, 'INFRASTRUCTURE', 'Infrastructure'
FROM service_types st WHERE st.code = 'IT'
ON CONFLICT (service_type_id, code) DO NOTHING;

-- Tambah tabel pivot estimate_categories
CREATE TABLE IF NOT EXISTS estimate_categories (
    estimate_id INTEGER NOT NULL REFERENCES project_estimates(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (estimate_id, category_id)
);

-- Jadikan category_id nullable di project_estimates agar mendukung multi-kategori murni
ALTER TABLE project_estimates 
ALTER COLUMN category_id DROP NOT NULL;

-- Tambah kolom project_id di project_estimates
ALTER TABLE project_estimates 
ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;

-- Backfill estimate_categories dari data project_estimates yang sudah ada
INSERT INTO estimate_categories (estimate_id, category_id)
SELECT id, category_id FROM project_estimates
WHERE category_id IS NOT NULL
ON CONFLICT (estimate_id, category_id) DO NOTHING;

-- Buat project default untuk perusahaan yang sudah memiliki data estimate
INSERT INTO projects (company_id, name, description)
SELECT DISTINCT c.id, 'Default Project', 'Auto-created default project for existing estimates'
FROM companies c
JOIN project_estimates pe ON pe.company_id = c.id
WHERE NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.company_id = c.id
);

-- Hubungkan estimate lama yang belum punya project_id ke project pertama perusahaan tersebut
UPDATE project_estimates pe
SET project_id = (
    SELECT p.id FROM projects p 
    WHERE p.company_id = pe.company_id 
    ORDER BY p.id ASC 
    LIMIT 1
)
WHERE pe.project_id IS NULL;
