import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const proposalId = parseInt(id, 10);
    if (isNaN(proposalId)) {
      return NextResponse.json({ success: false, error: 'ID proposal tidak valid' }, { status: 400 });
    }

    const body = await req.json();
    const { status, lost_reason } = body;

    const validStatuses = ['draft', 'sent', 'negotiation', 'won', 'lost'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Status tidak valid' }, { status: 400 });
    }

    // Ambil data proposal saat ini
    const curRes = await pool.query('SELECT * FROM commercial_proposals WHERE id = $1', [proposalId]);
    if (curRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Proposal tidak ditemukan' }, { status: 404 });
    }
    const cur = curRes.rows[0];
    const prevStatus = cur.deal_status || 'draft';

    const isClosed = status === 'won' || status === 'lost';
    const closedAt = isClosed ? new Date() : null;

    const updateRes = await pool.query(`
      UPDATE commercial_proposals
      SET 
        deal_status = $1,
        lost_reason = $2,
        deal_closed_at = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [status, status === 'lost' ? (lost_reason || null) : null, closedAt, proposalId]);

    // Audit log
    await logAudit({
      userId: user.id,
      entityType: 'commercial_proposal',
      entityId: proposalId,
      action: 'STATUS_CHANGE',
      details: {
        from: prevStatus,
        to: status,
        lost_reason: status === 'lost' ? lost_reason : undefined,
        proposal_number: cur.proposal_number,
        version: cur.version,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Status deal berhasil diubah menjadi ${status.toUpperCase()}`,
      proposal: updateRes.rows[0],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
