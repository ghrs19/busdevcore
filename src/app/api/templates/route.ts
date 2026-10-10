import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';

const forbidden = { error: 'Hanya Administrator yang memiliki akses ke modul ini.' };
async function adminOnly() { return (await currentUser())?.role === 'admin'; }

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('active_only') === 'true';

    let query = 'SELECT id, name, category, description, payload, is_active, created_at, updated_at FROM wbs_templates';
    const conditions: string[] = [];
    const values: any[] = [];

    if (category) {
      values.push(category.toUpperCase());
      conditions.push(`category = $${values.length}`);
    }

    if (activeOnly) {
      conditions.push('is_active = TRUE');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY id ASC';

    const res = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      templates: res.rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!await adminOnly()) return NextResponse.json(forbidden, { status: 403 });
  try {
    const body = await req.json();
    const { name, category, description, payload, is_active } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nama template wajib diisi.' }, { status: 400 });
    }

    if (!category || typeof category !== 'string' || !category.trim()) {
      return NextResponse.json({ success: false, error: 'Kategori template wajib diisi (DEVELOPMENT/MAINTENANCE/INFRASTRUCTURE/OPERATION).' }, { status: 400 });
    }

    if (payload === undefined || payload === null) {
      return NextResponse.json({ success: false, error: 'Payload data template wajib diisi.' }, { status: 400 });
    }

    const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const activeFlag = is_active !== undefined ? Boolean(is_active) : true;

    const res = await pool.query(
      `INSERT INTO wbs_templates (name, category, description, payload, is_active)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id, name, category, description, payload, is_active, created_at, updated_at`,
      [name.trim(), category.trim().toUpperCase(), description?.trim() || null, payloadJson, activeFlag]
    );

    return NextResponse.json({ success: true, template: res.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!await adminOnly()) return NextResponse.json(forbidden, { status: 403 });
  try {
    const body = await req.json();
    const { id, name, category, description, payload, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID template wajib diisi.' }, { status: 400 });
    }

    const check = await pool.query('SELECT * FROM wbs_templates WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Template tidak ditemukan.' }, { status: 404 });
    }

    const existing = check.rows[0];
    const newName = name !== undefined && String(name).trim() ? String(name).trim() : existing.name;
    const newCategory = category !== undefined && String(category).trim() ? String(category).trim().toUpperCase() : existing.category;
    const newDesc = description !== undefined ? (description ? String(description).trim() : null) : existing.description;
    const newActive = is_active !== undefined ? Boolean(is_active) : existing.is_active;
    const newPayload = payload !== undefined
      ? (typeof payload === 'string' ? payload : JSON.stringify(payload))
      : JSON.stringify(existing.payload);

    const res = await pool.query(
      `UPDATE wbs_templates
       SET name = $1, category = $2, description = $3, payload = $4::jsonb, is_active = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id, name, category, description, payload, is_active, created_at, updated_at`,
      [newName, newCategory, newDesc, newPayload, newActive, id]
    );

    return NextResponse.json({ success: true, template: res.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!await adminOnly()) return NextResponse.json(forbidden, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');

    let bodyData: { id?: number | string } = {};
    try {
      bodyData = await req.json();
    } catch {
      // Body is optional
    }

    const id = idParam || bodyData.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Parameter id wajib disertakan.' }, { status: 400 });
    }

    await pool.query('DELETE FROM wbs_templates WHERE id = $1', [Number(id)]);

    return NextResponse.json({ success: true, message: 'Template berhasil dihapus.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
