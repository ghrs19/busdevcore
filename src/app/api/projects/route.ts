import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('company_id');

    let query = `
      SELECT 
        p.id,
        p.company_id,
        c.name as company_name,
        p.name,
        p.description,
        p.created_at,
        p.updated_at
      FROM projects p
      JOIN companies c ON p.company_id = c.id
    `;
    const params: unknown[] = [];

    if (companyId) {
      const parsedCompanyId = parseInt(companyId, 10);
      if (!isNaN(parsedCompanyId)) {
        query += ' WHERE p.company_id = $1';
        params.push(parsedCompanyId);
      }
    }

    query += ' ORDER BY p.name ASC, p.id ASC';

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, projects: res.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company_id, name, description } = body;

    if (!company_id) {
      return NextResponse.json(
        { success: false, error: 'Perusahaan (company_id) wajib dipilih.' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Nama project wajib diisi.' },
        { status: 400 }
      );
    }

    const companyCheck = await pool.query('SELECT id, name FROM companies WHERE id = $1', [company_id]);
    if (companyCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Perusahaan tidak ditemukan.' },
        { status: 404 }
      );
    }

    const insertRes = await pool.query(
      `INSERT INTO projects (company_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, company_id, name, description, created_at, updated_at`,
      [company_id, name.trim(), description?.trim() || null]
    );

    return NextResponse.json(
      {
        success: true,
        project: {
          ...insertRes.rows[0],
          company_name: companyCheck.rows[0].name,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
