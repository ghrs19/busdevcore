-- Migration 013: Company Settings (Issuer Profile)
CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL DEFAULT 'PT PENTA CODE DIGITAL',
    tagline VARCHAR(255) DEFAULT 'Software Development & Digital Solutions • pentacode.id',
    address TEXT DEFAULT 'Graha Pena Lantai 15, Jl. Ahmad Yani No. 88, Surabaya, Jawa Timur - Indonesia',
    email VARCHAR(255) DEFAULT 'finance@pentacode.id',
    website VARCHAR(255) DEFAULT 'pentacode.id',
    phone VARCHAR(100) DEFAULT '+62 812-3456-7890',
    bank_name VARCHAR(100) DEFAULT 'Bank Central Asia (BCA)',
    bank_account_number VARCHAR(100) DEFAULT '088-726-1928',
    bank_account_name VARCHAR(255) DEFAULT 'PT PENTA CODE DIGITAL',
    signer_name VARCHAR(255) DEFAULT 'Authorized Finance Department',
    signer_role VARCHAR(255) DEFAULT 'Finance & Accounting Lead',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO company_settings (id, company_name) 
VALUES (1, 'PT PENTA CODE DIGITAL')
ON CONFLICT (id) DO NOTHING;

-- Document attachments for signed files and payment receipts
ALTER TABLE contract_documents
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS file_size INT,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE payment_milestone_invoices
  ADD COLUMN IF NOT EXISTS proof_file_url TEXT,
  ADD COLUMN IF NOT EXISTS proof_file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS proof_file_size INT,
  ADD COLUMN IF NOT EXISTS proof_mime_type VARCHAR(100);
