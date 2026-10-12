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

    // 1. Ambil data proposal beserta estimasi asalnya
    const propRes = await pool.query(`
      SELECT cp.*, pe.maintenance_config, pe.infrastructure_items, pe.billing_summary
      FROM commercial_proposals cp
      LEFT JOIN project_estimates pe ON cp.estimate_id = pe.id
      WHERE cp.id = $1
    `, [proposalId]);

    if (propRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Proposal tidak ditemukan' }, { status: 404 });
    }

    const proposal = propRes.rows[0];
    const terms = Array.isArray(proposal.payment_terms) ? proposal.payment_terms : [];
    const billingMode = proposal.maintenance_billing_mode || 'ALL_IN_PROJECT';

    // GET stays read-only; schedule reconciliation belongs to an explicit write path.
    // 2. Calculate recurring schedule metadata for the response.
    const mntConfig = proposal.maintenance_config || {};
    let durationMonths = parseInt(mntConfig.duration_months || 0, 10);
    const monthlyMaintenanceCost = parseFloat(mntConfig.monthly_cost || 0);

    let monthlyInfraCost = 0;
    if (Array.isArray(proposal.infrastructure_items)) {
      for (const item of proposal.infrastructure_items) {
        if (item.billing_type === 'MONTHLY') {
          monthlyInfraCost += (parseFloat(item.unit_cost || 0) * (parseInt(item.quantity || 1, 10)));
        } else if (item.billing_type === 'YEARLY') {
          monthlyInfraCost += ((parseFloat(item.unit_cost || 0) * (parseInt(item.quantity || 1, 10))) / 12);
        }
      }
    }

    if (durationMonths <= 0 && monthlyInfraCost > 0) {
      durationMonths = 12;
    }

    const marginPct = parseFloat(proposal.margin_percent || 0);
    const multiplier = 1 + (marginPct / 100);
    const billedMonthlyMnt = Math.round(monthlyMaintenanceCost * multiplier);
    const billedMonthlyInfra = Math.round(monthlyInfraCost * multiplier);
    const totalMonthlyBilled = billedMonthlyMnt + billedMonthlyInfra;

    if (billingMode === 'MONTHLY_RETAINER' && durationMonths > 0 && totalMonthlyBilled > 0) {
      const baseDate = new Date(proposal.created_at || new Date());
      baseDate.setMonth(baseDate.getMonth() + 2); // Mulai bulan ke-2 setelah dev

    }

    // 4. Fetch all schedule records
    const res = await pool.query(`
      SELECT pmi.*, u.name as updated_by_name
      FROM payment_milestone_invoices pmi
      LEFT JOIN users u ON pmi.updated_by_user_id = u.id
      WHERE pmi.proposal_id = $1
      ORDER BY 
        CASE WHEN pmi.billing_type = 'milestone' THEN 1 ELSE 2 END ASC,
        pmi.term_index ASC
    `, [proposalId]);

    return NextResponse.json({
      success: true,
      milestones: res.rows.filter(r => r.billing_type === 'milestone'),
      recurring: res.rows.filter(r => r.billing_type === 'recurring_monthly'),
      has_recurring: billingMode === 'MONTHLY_RETAINER' && durationMonths > 0 && totalMonthlyBilled > 0,
      maintenance_billing_mode: billingMode,
      monthly_recurring_rate: totalMonthlyBilled,
      duration_months: durationMonths,
    });
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
        billing_type: updated.billing_type,
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
