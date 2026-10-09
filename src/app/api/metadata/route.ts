import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [stRes, catRes, tagRes, roleRes] = await Promise.all([
      pool.query('SELECT id, code, name, is_active FROM service_types ORDER BY id ASC'),
      pool.query('SELECT id, service_type_id, code, name FROM categories ORDER BY id ASC'),
      pool.query('SELECT id, code, name, applies_to_category_code FROM tags ORDER BY id ASC'),
      pool.query('SELECT id, code, name, default_hourly_rate, is_active FROM role_masters WHERE is_active = TRUE ORDER BY id ASC'),
    ]);

    return NextResponse.json({
      success: true,
      serviceTypes: stRes.rows,
      categories: catRes.rows,
      tags: tagRes.rows,
      roles: roleRes.rows.map(r => ({
        ...r,
        default_hourly_rate: Number(r.default_hourly_rate),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
