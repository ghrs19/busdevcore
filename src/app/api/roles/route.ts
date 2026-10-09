import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active_only') === 'true';

    const query = activeOnly
      ? 'SELECT id, code, name, default_hourly_rate, is_active, created_at, updated_at FROM role_masters WHERE is_active = TRUE ORDER BY id ASC'
      : 'SELECT id, code, name, default_hourly_rate, is_active, created_at, updated_at FROM role_masters ORDER BY id ASC';

    const res = await pool.query(query);

    return NextResponse.json({
      success: true,
      roles: res.rows.map(r => ({
        ...r,
        default_hourly_rate: Number(r.default_hourly_rate),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, name, default_hourly_rate, is_active } = body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ success: false, error: 'Kode role wajib diisi.' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nama role wajib diisi.' }, { status: 400 });
    }

    const rateNum = Number(default_hourly_rate);
    if (isNaN(rateNum) || rateNum < 0) {
      return NextResponse.json({ success: false, error: 'Hourly rate harus berupa angka >= 0.' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    // Check duplicate code
    const existing = await pool.query('SELECT id FROM role_masters WHERE UPPER(code) = $1', [cleanCode]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ success: false, error: `Role dengan kode '${cleanCode}' sudah terdaftar.` }, { status: 400 });
    }

    const activeFlag = is_active !== undefined ? Boolean(is_active) : true;

    const insertRes = await pool.query(
      `INSERT INTO role_masters (code, name, default_hourly_rate, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, code, name, default_hourly_rate, is_active, created_at, updated_at`,
      [cleanCode, name.trim(), rateNum, activeFlag]
    );

    const created = insertRes.rows[0];

    return NextResponse.json({
      success: true,
      role: {
        ...created,
        default_hourly_rate: Number(created.default_hourly_rate),
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, code, name, default_hourly_rate, is_active } = body;

    let targetId = id ? Number(id) : null;

    if (!targetId && code) {
      const findRes = await pool.query('SELECT id FROM role_masters WHERE UPPER(code) = $1', [String(code).trim().toUpperCase()]);
      if (findRes.rows.length > 0) {
        targetId = findRes.rows[0].id;
      }
    }

    if (!targetId) {
      return NextResponse.json({ success: false, error: 'ID atau kode role wajib disertakan.' }, { status: 400 });
    }

    const checkRes = await pool.query('SELECT id, code, name, default_hourly_rate, is_active FROM role_masters WHERE id = $1', [targetId]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Role tidak ditemukan.' }, { status: 404 });
    }

    const existing = checkRes.rows[0];
    const newName = name !== undefined && typeof name === 'string' && name.trim() ? name.trim() : existing.name;
    const newRate = default_hourly_rate !== undefined && !isNaN(Number(default_hourly_rate)) && Number(default_hourly_rate) >= 0
      ? Number(default_hourly_rate)
      : Number(existing.default_hourly_rate);
    const newActive = is_active !== undefined ? Boolean(is_active) : existing.is_active;

    const updateRes = await pool.query(
      `UPDATE role_masters
       SET name = $1, default_hourly_rate = $2, is_active = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, code, name, default_hourly_rate, is_active, created_at, updated_at`,
      [newName, newRate, newActive, targetId]
    );

    const updated = updateRes.rows[0];

    return NextResponse.json({
      success: true,
      role: {
        ...updated,
        default_hourly_rate: Number(updated.default_hourly_rate),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    const codeParam = searchParams.get('code');

    let bodyData: { id?: number | string; code?: string } = {};
    try {
      bodyData = await req.json();
    } catch {
      // Body is optional if searchParams provided
    }

    const id = idParam || bodyData.id;
    const code = codeParam || bodyData.code;

    let targetId: number | null = id ? Number(id) : null;
    let targetCode: string | null = code ? String(code).trim().toUpperCase() : null;

    if (targetId) {
      const res = await pool.query('SELECT id, code FROM role_masters WHERE id = $1', [targetId]);
      if (res.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Role tidak ditemukan.' }, { status: 404 });
      }
      targetCode = res.rows[0].code;
    } else if (targetCode) {
      const res = await pool.query('SELECT id, code FROM role_masters WHERE UPPER(code) = $1', [targetCode]);
      if (res.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Role tidak ditemukan.' }, { status: 404 });
      }
      targetId = res.rows[0].id;
    } else {
      return NextResponse.json({ success: false, error: 'Parameter id atau code wajib diisi.' }, { status: 400 });
    }

    // Delete role
    await pool.query('DELETE FROM role_masters WHERE id = $1', [targetId]);

    return NextResponse.json({
      success: true,
      message: 'Role berhasil dihapus dari master.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
