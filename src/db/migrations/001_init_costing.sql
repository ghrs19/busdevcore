-- Migration 001: Init ERP Costing Schema

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(100),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    service_type_id INTEGER NOT NULL REFERENCES service_types(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_service_code UNIQUE (service_type_id, code)
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    applies_to_category_code VARCHAR(50) NOT NULL DEFAULT 'DEVELOPMENT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_masters (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    default_hourly_rate NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_estimates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    service_type_id INTEGER NOT NULL REFERENCES service_types(id) ON DELETE RESTRICT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    tag_id INTEGER REFERENCES tags(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    rate_snapshots JSONB NOT NULL,
    total_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estimate_modules (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER NOT NULL REFERENCES project_estimates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    total_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estimate_tasks (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES estimate_modules(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    hours_pm NUMERIC(10, 2) NOT NULL DEFAULT 0,
    hours_web_dev NUMERIC(10, 2) NOT NULL DEFAULT 0,
    hours_ui_ux NUMERIC(10, 2) NOT NULL DEFAULT 0,
    hours_qc_doc NUMERIC(10, 2) NOT NULL DEFAULT 0,
    hours_dev_ops NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial master data
INSERT INTO service_types (code, name, is_active) VALUES
    ('IT', 'Information Technology', TRUE),
    ('DIGITAL', 'Digital Marketing & Creative', FALSE)
ON CONFLICT (code) DO UPDATE SET is_active = EXCLUDED.is_active;

-- Categories under IT
INSERT INTO categories (service_type_id, code, name)
SELECT st.id, 'DEVELOPMENT', 'Development'
FROM service_types st WHERE st.code = 'IT'
ON CONFLICT (service_type_id, code) DO NOTHING;

INSERT INTO categories (service_type_id, code, name)
SELECT st.id, 'MAINTENANCE', 'Maintenance'
FROM service_types st WHERE st.code = 'IT'
ON CONFLICT (service_type_id, code) DO NOTHING;

-- Tags (Initial, CR) - applicable only to Development
INSERT INTO tags (code, name, applies_to_category_code) VALUES
    ('INITIAL', 'Initial', 'DEVELOPMENT'),
    ('CR', 'Change Request (CR)', 'DEVELOPMENT')
ON CONFLICT (code) DO NOTHING;

-- RoleMaster with default hourly rates from spreadsheet
INSERT INTO role_masters (code, name, default_hourly_rate) VALUES
    ('PM', 'PM', 39602.00),
    ('WEB_DEV', 'WEB DEV', 39602.00),
    ('UI_UX', 'UI-UX', 33113.00),
    ('QC_DOC', 'QC & DOC', 33101.00),
    ('DEV_OPS', 'DEV OPS', 43760.00)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    default_hourly_rate = EXCLUDED.default_hourly_rate,
    updated_at = NOW();

-- Seed sample company (Djarum) if not exists
INSERT INTO companies (name, email, phone, address) VALUES
    ('PT Djarum', 'contact@djarum.com', '021-1234567', 'Kudus, Jawa Tengah')
ON CONFLICT (name) DO NOTHING;
