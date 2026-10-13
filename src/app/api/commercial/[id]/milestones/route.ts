import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import { validateBillingTransition, validatePaymentMutation } from '@/lib/commercial-workflow';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const proposalId = parseInt(id, 10);
    if (isNaN(proposalId)) return NextResponse.json({ success: false, error: 'ID proposal tidak valid' }, { status: 400 });
    const propRes = await pool.query(`
      SELECT cp.*, pe.maintenance_config, pe.infrastructure_items, pe.billing_summary
      FROM commercial_proposals cp LEFT JOIN project_estimates pe ON cp.estimate_id = pe.id WHERE cp.id = $1
    `, [proposalId]);
    if (!propRes.rows.length) return NextResponse.json({ success: false, error: 'Proposal tidak ditemukan' }, { status: 404 });
    const proposal = propRes.rows[0];
    const billingMode = proposal.maintenance_billing_mode || 'ALL_IN_PROJECT';
    const mntConfig = proposal.maintenance_config || {};
    let durationMonths = parseInt(mntConfig.duration_months || 0, 10);
    const monthlyMaintenanceCost = parseFloat(mntConfig.monthly_cost || 0);
    let monthlyInfraCost = 0;
    if (Array.isArray(proposal.infrastructure_items)) {
      for (const item of proposal.infrastructure_items) {
        if (item.billing_type === 'MONTHLY') monthlyInfraCost += parseFloat(item.unit_cost || 0) * parseInt(item.quantity || 1, 10);
        else if (item.billing_type === 'YEARLY') monthlyInfraCost += parseFloat(item.unit_cost || 0) * parseInt(item.quantity || 1, 10) / 12;
      }
    }
    if (durationMonths <= 0 && monthlyInfraCost > 0) durationMonths = 12;
    const catPricing = proposal.category_pricing && typeof proposal.category_pricing === 'object' ? proposal.category_pricing : null;
    const marginMnt = parseFloat(catPricing?.MAINTENANCE?.margin_percent ?? proposal.margin_percent ?? 0);
    const marginInfra = parseFloat(catPricing?.INFRASTRUCTURE?.margin_percent ?? proposal.margin_percent ?? 0);
    const totalMonthlyBilled = Math.round(monthlyMaintenanceCost * (1 + marginMnt / 100)) + Math.round(monthlyInfraCost * (1 + marginInfra / 100));
    const res = await pool.query(`
      SELECT pmi.*, u.name as updated_by_name FROM payment_milestone_invoices pmi
      LEFT JOIN users u ON pmi.updated_by_user_id = u.id WHERE pmi.proposal_id = $1
      ORDER BY CASE WHEN pmi.billing_type = 'milestone' THEN 1 ELSE 2 END ASC, pmi.term_index ASC
    `, [proposalId]);
    return NextResponse.json({ success: true, milestones: res.rows.filter(r => r.billing_type === 'milestone'), recurring: res.rows.filter(r => r.billing_type === 'recurring_monthly'), has_recurring: billingMode === 'MONTHLY_RETAINER' && durationMonths > 0 && totalMonthlyBilled > 0, maintenance_billing_mode: billingMode, monthly_recurring_rate: totalMonthlyBilled, duration_months: durationMonths });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const proposalId = Number.parseInt(id, 10);
  if (!Number.isInteger(proposalId) || proposalId < 1) return NextResponse.json({ success: false, error: 'ID proposal tidak valid' }, { status: 400 });
  if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Hanya admin boleh mengubah status dan pembayaran invoice.' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Payload JSON tidak valid.' }, { status: 400 }); }
  const milestoneId = Number(body.milestone_id);
  if (!Number.isInteger(milestoneId) || milestoneId < 1) return NextResponse.json({ success: false, error: 'ID invoice tidak valid.' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(`
      SELECT pmi.*, cp.deal_status, cp.proposal_number, cp.version,
        latest.version AS latest_version, latest.deal_status AS latest_deal_status,
        latest.id AS latest_proposal_id
      FROM payment_milestone_invoices pmi JOIN commercial_proposals cp ON cp.id = pmi.proposal_id
      JOIN LATERAL (SELECT cp2.id, cp2.version, cp2.deal_status FROM commercial_proposals cp2
        WHERE cp2.proposal_number = cp.proposal_number ORDER BY cp2.version DESC, cp2.id DESC LIMIT 1) latest ON TRUE
      WHERE pmi.id = $1 AND pmi.proposal_id = $2 FOR UPDATE OF pmi, cp
    `, [milestoneId, proposalId]);
    if (!found.rows.length) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Milestone invoice tidak ditemukan' }, { status: 404 });
    }
    const current = found.rows[0];
    const isCurrentProposal = Number(current.latest_proposal_id) === proposalId;
    const isIssuedHistory = ['invoiced', 'overdue', 'paid'].includes(current.billing_status);
    if (current.latest_deal_status !== 'won' || (!isCurrentProposal && !isIssuedHistory)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Pembayaran hanya dapat dicatat pada jadwal aktif atau histori invoice terbit dari kontrak Won terbaru.' }, { status: 409 });
    }
    const status = (body.billing_status === undefined ? current.billing_status : body.billing_status) as string;
    const paidAmount = body.paid_amount === undefined ? Number(current.paid_amount || 0) : Number(body.paid_amount);
    const paidDate = body.paid_date === undefined ? current.paid_date : body.paid_date as string | null;
    const invoiceNumber = body.invoice_number === undefined ? current.invoice_number : body.invoice_number as string | null;
    const invoiceDate = body.invoice_date === undefined ? current.invoice_date : body.invoice_date as string | null;
    const dueDate = body.due_date === undefined ? current.due_date : body.due_date as string | null;
    const transitionError = validateBillingTransition(current.billing_status, status);
    const validation = transitionError || validatePaymentMutation({ billingStatus: status, amount: Number(current.amount), paidAmount, paidDate, invoiceNumber, invoiceDate, dueDate });
    if (validation) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: validation }, { status: 400 });
    }
    if (current.billing_status === 'paid' && status !== 'paid') {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Invoice paid bersifat final; koreksi perlu jurnal penyesuaian.' }, { status: 409 });
    }
    const updatedRes = await client.query(`
      UPDATE payment_milestone_invoices SET billing_status = $1, invoice_number = $2, invoice_date = $3,
        due_date = $4, paid_date = $5, paid_amount = $6,
        proof_reference = CASE WHEN $7 THEN $8 ELSE proof_reference END,
        notes = CASE WHEN $9 THEN $10 ELSE notes END,
        updated_by_user_id = $11, updated_at = NOW()
      WHERE id = $12 AND proposal_id = $13 RETURNING *
    `, [status, invoiceNumber, invoiceDate, dueDate, paidDate, paidAmount,
      Object.hasOwn(body, 'proof_reference'), body.proof_reference ?? null,
      Object.hasOwn(body, 'notes'), body.notes ?? null, user.id, milestoneId, proposalId]);
    const updated = updatedRes.rows[0];
    await writeAudit(client, { userId: user.id, entityType: 'commercial_proposal', entityId: proposalId, action: 'INVOICE_STATUS_UPDATE', details: {
      milestone_id: milestoneId,
      before: { status: current.billing_status, amount: current.amount, paid_amount: current.paid_amount, invoice_number: current.invoice_number, invoice_date: current.invoice_date, due_date: current.due_date, paid_date: current.paid_date, proof_reference: current.proof_reference, notes: current.notes },
      after: { status: updated.billing_status, amount: updated.amount, paid_amount: updated.paid_amount, invoice_number: updated.invoice_number, invoice_date: updated.invoice_date, due_date: updated.due_date, paid_date: updated.paid_date, proof_reference: updated.proof_reference, notes: updated.notes },
    } });
    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Status invoice termin berhasil diperbarui', milestone: updated });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Failed to update invoice payment:', err);
    return NextResponse.json({ success: false, error: 'Perubahan pembayaran gagal; tidak ada perubahan tersimpan.' }, { status: 500 });
  } finally { client.release(); }
}
