import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(
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

    // 1. Ambil data proposal
    const propRes = await pool.query(`SELECT id, proposal_number, payment_terms FROM commercial_proposals WHERE id = $1`, [proposalId]);
    if (propRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Proposal tidak ditemukan' }, { status: 404 });
    }

    const proposal = propRes.rows[0];
    const terms = Array.isArray(proposal.payment_terms) ? proposal.payment_terms : [];

    // 2. Sync / ensure milestones exist in payment_milestone_invoices
    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      const termIdx = i + 1;
      await pool.query(`
        INSERT INTO payment_milestone_invoices (
          proposal_id, term_index, milestone_name, percent, amount, trigger_condition
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (proposal_id, term_index) DO UPDATE
        SET milestone_name = EXCLUDED.milestone_name,
            percent = EXCLUDED.percent,
            amount = EXCLUDED.amount,
            trigger_condition = EXCLUDED.trigger_condition
      `, [proposalId, termIdx, term.milestone_name, term.percent, term.amount, term.trigger_condition]);
    }

    // 3. Fetch current status records
    const res = await pool.query(`
      SELECT pmi.*, u.name as updated_by_name
      FROM payment_milestone_invoices pmi
      LEFT JOIN users u ON pmi.updated_by_user_id = u.id
      WHERE pmi.proposal_id = $1
      ORDER BY pmi.term_index ASC
    `, [proposalId]);

    return NextResponse.json({ success: true, milestones: res.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

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
    const {
      milestone_id,
      billing_status,
      invoice_number,
      invoice_date,
      due_date,
      paid_date,
      paid_amount,
      proof_reference,
      notes,
    } = body;

    const validStatuses = ['unbilled', 'invoiced', 'paid', 'overdue'];
    if (billing_status && !validStatuses.includes(billing_status)) {
      return NextResponse.json({ success: false, error: 'Status billing tidak valid' }, { status: 400 });
    }

    const updateRes = await pool.query(`
      UPDATE payment_milestone_invoices
      SET
        billing_status = COALESCE($1, billing_status),
        invoice_number = $2,
        invoice_date = $3,
        due_date = $4,
        paid_date = $5,
        paid_amount = $6,
        proof_reference = $7,
        notes = $8,
        updated_by_user_id = $9,
        updated_at = NOW()
      WHERE id = $10 AND proposal_id = $11
      RETURNING *
    `, [
      billing_status || null,
      invoice_number || null,
      invoice_date || null,
      due_date || null,
      paid_date || null,
      Number(paid_amount) || 0,
      proof_reference || null,
      notes || null,
      user.id,
      milestone_id,
      proposalId,
    ]);

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Milestone invoice tidak ditemukan' }, { status: 404 });
    }

    const updated = updateRes.rows[0];

    // Log Audit
    await logAudit({
      userId: user.id,
      entityType: 'commercial_proposal',
      entityId: proposalId,
      action: 'INVOICE_STATUS_UPDATE',
      details: {
        milestone: updated.milestone_name,
        term_index: updated.term_index,
        billing_status: updated.billing_status,
        invoice_number: updated.invoice_number,
        paid_amount: updated.paid_amount,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Status invoice termin berhasil diperbarui',
      milestone: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
