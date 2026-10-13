import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import { validateProposalTransition } from '@/lib/commercial-workflow';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const proposalId = Number.parseInt(id, 10);
  if (!Number.isInteger(proposalId) || proposalId < 1) return NextResponse.json({ success: false, error: 'ID proposal tidak valid' }, { status: 400 });

  let body: { status?: string; lost_reason?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Payload JSON tidak valid.' }, { status: 400 }); }
  const nextStatus = body.status || '';
  if (!['draft', 'sent', 'negotiation', 'won', 'lost'].includes(nextStatus)) return NextResponse.json({ success: false, error: 'Status tidak valid' }, { status: 400 });
  if (['won', 'lost'].includes(nextStatus) && user.role !== 'admin') return NextResponse.json({ success: false, error: 'Hanya admin boleh menutup deal.' }, { status: 403 });
  if (nextStatus === 'lost' && !body.lost_reason?.trim()) return NextResponse.json({ success: false, error: 'Alasan lost wajib diisi.' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM commercial_proposals WHERE id = $1 FOR UPDATE', [proposalId]);
    if (!found.rows.length) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Proposal tidak ditemukan' }, { status: 404 });
    }
    const cur = found.rows[0];
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`proposal-revision:${cur.parent_id || cur.id}`]);
    const latest = await client.query(`SELECT id FROM commercial_proposals WHERE proposal_number = $1 ORDER BY version DESC, id DESC LIMIT 1`, [cur.proposal_number]);
    if (latest.rows[0]?.id !== proposalId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Hanya revisi proposal terbaru yang dapat diubah.' }, { status: 409 });
    }
    const previousStatus = cur.deal_status || 'draft';
    const transitionError = validateProposalTransition(previousStatus, nextStatus);
    if (transitionError) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: transitionError }, { status: 409 });
    }
    const isClosed = nextStatus === 'won' || nextStatus === 'lost';
    const updated = await client.query(`
      UPDATE commercial_proposals
      SET deal_status = $1, lost_reason = $2, deal_closed_at = $3, updated_at = NOW()
      WHERE id = $4 RETURNING *
    `, [nextStatus, nextStatus === 'lost' ? body.lost_reason?.trim() : null, isClosed ? new Date() : null, proposalId]);
    await writeAudit(client, { userId: user.id, entityType: 'commercial_proposal', entityId: proposalId, action: 'STATUS_CHANGE', details: {
      before: { status: previousStatus, lost_reason: cur.lost_reason }, after: { status: nextStatus, lost_reason: nextStatus === 'lost' ? body.lost_reason?.trim() : null },
      proposal_number: cur.proposal_number, version: cur.version,
    } });
    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: `Status deal berhasil diubah menjadi ${nextStatus.toUpperCase()}`, proposal: updated.rows[0] });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Failed to change proposal status:', err);
    return NextResponse.json({ success: false, error: 'Perubahan status gagal; tidak ada perubahan tersimpan.' }, { status: 500 });
  } finally { client.release(); }
}
