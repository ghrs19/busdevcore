import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const forbidden = { success: false, error: 'Hanya Administrator yang dapat mengelola Master Worker.' };
const MAX_RATE = 100_000_000;

type WorkerRow = { id: number; name: string; hourly_rate: string; is_active: boolean; created_at: string; updated_at: string };
const toWorker = (r: WorkerRow) => ({ ...r, hourly_rate: Number(r.hourly_rate) });

function validate(body: unknown): { ok: true; name: string; rate: number } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : '';
  const rate = typeof b.hourly_rate === 'number' ? b.hourly_rate : Number(b.hourly_rate);
  if (!name) return { ok: false, error: 'Nama worker wajib diisi.' };
  if (name.length > 100) return { ok: false, error: 'Nama worker maksimal 100 karakter.' };
  if (!Number.isFinite(rate) || rate < 0 || rate > MAX_RATE) return { ok: false, error: 'Rate per jam harus angka 0 sampai 100.000.000.' };
  return { ok: true, name, rate };
}

// Any signed-in user can read (the costing form needs the list); only admins can change it.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const activeOnly = new URL(req.url).searchParams.get('active_only') === 'true';
  const { rows } = await pool.query(
    `SELECT id, name, hourly_rate, is_active, created_at, updated_at FROM workers
     ${activeOnly ? 'WHERE is_active = TRUE' : ''} ORDER BY LOWER(name) ASC`
  );
  return NextResponse.json({ success: true, workers: rows.map(toWorker) });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json(forbidden, { status: 403 });
  const parsed = validate(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  try {
    const { rows } = await pool.query(
      `INSERT INTO workers (name, hourly_rate) VALUES ($1, $2)
       RETURNING id, name, hourly_rate, is_active, created_at, updated_at`,
      [parsed.name, parsed.rate]
    );
    await logAudit({ userId: user.id, entityType: 'worker', entityId: rows[0].id, action: 'CREATE', details: { name: parsed.name } });
    return NextResponse.json({ success: true, worker: toWorker(rows[0]) }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === '23505') {
      return NextResponse.json({ success: false, error: 'Worker dengan nama itu sudah terdaftar.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Gagal menyimpan worker.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json(forbidden, { status: 403 });
  const body = await req.json().catch(() => null);
  const id = Number((body as { id?: unknown })?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ success: false, error: 'ID worker tidak valid.' }, { status: 400 });
  const parsed = validate(body);
  if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  const isActive = (body as { is_active?: unknown }).is_active === undefined ? null : Boolean((body as { is_active?: unknown }).is_active);
  try {
    const { rows } = await pool.query(
      `UPDATE workers SET name = $1, hourly_rate = $2, is_active = COALESCE($3, is_active), updated_at = NOW()
       WHERE id = $4 RETURNING id, name, hourly_rate, is_active, created_at, updated_at`,
      [parsed.name, parsed.rate, isActive, id]
    );
    if (!rows[0]) return NextResponse.json({ success: false, error: 'Worker tidak ditemukan.' }, { status: 404 });
    await logAudit({ userId: user.id, entityType: 'worker', entityId: id, action: 'UPDATE', details: { name: parsed.name } });
    return NextResponse.json({ success: true, worker: toWorker(rows[0]) });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === '23505') {
      return NextResponse.json({ success: false, error: 'Worker dengan nama itu sudah terdaftar.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Gagal menyimpan worker.' }, { status: 500 });
  }
}

// Estimates keep their own frozen snapshot, so deleting a worker never changes existing costings.
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json(forbidden, { status: 403 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ success: false, error: 'ID worker tidak valid.' }, { status: 400 });
  const res = await pool.query('DELETE FROM workers WHERE id = $1 RETURNING name', [id]);
  if (!res.rowCount) return NextResponse.json({ success: false, error: 'Worker tidak ditemukan.' }, { status: 404 });
  await logAudit({ userId: user.id, entityType: 'worker', entityId: id, action: 'DELETE', details: { name: res.rows[0].name } });
  return NextResponse.json({ success: true });
}
