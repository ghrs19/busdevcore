import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET() {
  try {
    const res = await pool.query(
      'SELECT id, name, email, phone, address, created_at FROM companies ORDER BY name ASC'
    );
    return NextResponse.json({ success: true, companies: res.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, phone, address } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nama perusahaan wajib diisi.' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const res = await pool.query(
      `INSERT INTO companies (name, email, phone, address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, companies.email),
         phone = COALESCE(EXCLUDED.phone, companies.phone),
         address = COALESCE(EXCLUDED.address, companies.address),
         updated_at = NOW()
       RETURNING id, name, email, phone, address, created_at`,
      [trimmedName, email?.trim() || null, phone?.trim() || null, address?.trim() || null]
    );

    return NextResponse.json({ success: true, company: res.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
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
    const { id, name, email, phone, address } = body;

    if (!id || !name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'ID dan Nama perusahaan wajib diisi.' }, { status: 400 });
    }

    const res = await pool.query(
      `UPDATE companies 
       SET name = $1, email = $2, phone = $3, address = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, email, phone, address, created_at, updated_at`,
      [name.trim(), email?.trim() || null, phone?.trim() || null, address?.trim() || null, id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Perusahaan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, company: res.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
