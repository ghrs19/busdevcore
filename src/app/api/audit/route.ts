import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let query = `
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    const params: unknown[] = [];

    if (entityType && entityId) {
      query += ` WHERE al.entity_type = $1 AND al.entity_id = $2 `;
      params.push(entityType, parseInt(entityId, 10));
    } else if (entityType) {
      query += ` WHERE al.entity_type = $1 `;
      params.push(entityType);
    }

    query += ` ORDER BY al.id DESC LIMIT $${params.length + 1} `;
    params.push(limit);

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, logs: res.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
