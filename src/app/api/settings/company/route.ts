import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET() {
  try {
    const res = await pool.query(
      'SELECT * FROM company_settings WHERE id = 1 LIMIT 1'
    );
    if (res.rows.length === 0) {
      return NextResponse.json({
        success: true,
        settings: {
          id: 1,
          company_name: 'PT PENTA CODE DIGITAL',
          tagline: 'Software Development & Digital Solutions • pentacode.id',
          address: 'Graha Pena Lantai 15, Jl. Ahmad Yani No. 88, Surabaya, Jawa Timur - Indonesia',
          email: 'finance@pentacode.id',
          website: 'pentacode.id',
          phone: '+62 812-3456-7890',
          bank_name: 'Bank Central Asia (BCA)',
          bank_account_number: '088-726-1928',
          bank_account_name: 'PT PENTA CODE DIGITAL',
          signer_name: 'Authorized Finance Department',
          signer_role: 'Finance & Accounting Lead',
        },
      });
    }
    return NextResponse.json({ success: true, settings: res.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      company_name,
      tagline,
      address,
      email,
      website,
      phone,
      bank_name,
      bank_account_number,
      bank_account_name,
      signer_name,
      signer_role,
    } = body;

    const res = await pool.query(
      `INSERT INTO company_settings (
        id, company_name, tagline, address, email, website, phone,
        bank_name, bank_account_number, bank_account_name, signer_name, signer_role, updated_at
      ) VALUES (
        1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        tagline = EXCLUDED.tagline,
        address = EXCLUDED.address,
        email = EXCLUDED.email,
        website = EXCLUDED.website,
        phone = EXCLUDED.phone,
        bank_name = EXCLUDED.bank_name,
        bank_account_number = EXCLUDED.bank_account_number,
        bank_account_name = EXCLUDED.bank_account_name,
        signer_name = EXCLUDED.signer_name,
        signer_role = EXCLUDED.signer_role,
        updated_at = NOW()
      RETURNING *`,
      [
        company_name || 'PT PENTA CODE DIGITAL',
        tagline || null,
        address || null,
        email || null,
        website || null,
        phone || null,
        bank_name || null,
        bank_account_number || null,
        bank_account_name || null,
        signer_name || null,
        signer_role || null,
      ]
    );

    return NextResponse.json({ success: true, settings: res.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
