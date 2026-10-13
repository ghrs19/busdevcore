import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const typeFilter = searchParams.get('type');
    const search = searchParams.get('search')?.trim();
    const params: unknown[] = [];
    let filters = '';
    if (search) { params.push(`%${search}%`); filters += ` AND (f.company_name ILIKE $${params.length} OR f.project_name ILIKE $${params.length})`; }
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'overdue') filters += ` AND f.effective_status = 'overdue'`;
      else { params.push(statusFilter); filters += ` AND f.effective_status = $${params.length}`; }
    }
    if (typeFilter && typeFilter !== 'all') { params.push(typeFilter); filters += ` AND f.billing_type = $${params.length}`; }

    const projectsRes = await pool.query(`
      WITH latest_won AS (
        SELECT cp.id, cp.proposal_number FROM commercial_proposals cp
        WHERE cp.deal_status = 'won' AND cp.version = (SELECT MAX(cp2.version) FROM commercial_proposals cp2 WHERE cp2.proposal_number = cp.proposal_number)
      ), current_rows AS (
        SELECT pmi.*, cp.proposal_number, cp.version AS proposal_version, cp.company_id, cp.project_id,
          c.name AS company_name, p.name AS project_name,
          CASE WHEN pmi.billing_status = 'paid' THEN 'paid'
               WHEN pmi.billing_status = 'overdue' OR (pmi.billing_status = 'invoiced' AND pmi.due_date < CURRENT_DATE) THEN 'overdue'
               ELSE pmi.billing_status END AS effective_status,
          GREATEST(pmi.amount - COALESCE(pmi.paid_amount, 0), 0) AS outstanding_amount
        FROM payment_milestone_invoices pmi JOIN commercial_proposals cp ON cp.id = pmi.proposal_id
        JOIN companies c ON c.id = cp.company_id JOIN projects p ON p.id = cp.project_id
        JOIN latest_won lw ON lw.proposal_number = cp.proposal_number
        WHERE (lw.id = cp.id AND NOT EXISTS (
          SELECT 1 FROM payment_milestone_invoices history
          JOIN commercial_proposals older ON older.id = history.proposal_id
          WHERE older.proposal_number = cp.proposal_number AND older.id <> cp.id
            AND history.billing_type = pmi.billing_type AND history.term_index = pmi.term_index
            AND history.billing_status IN ('invoiced', 'paid', 'overdue')
        )) OR pmi.billing_status IN ('invoiced', 'paid', 'overdue')
      )
      SELECT f.company_id, f.company_name, f.project_id, f.project_name,
        COUNT(*) AS invoice_count,
        COUNT(*) FILTER (WHERE f.effective_status = 'paid') AS paid_count,
        COALESCE(SUM(CASE WHEN f.effective_status IN ('paid', 'invoiced', 'overdue') THEN COALESCE(f.paid_amount, CASE WHEN f.effective_status = 'paid' THEN f.amount ELSE 0 END) ELSE 0 END), 0) AS paid_amount,
        COUNT(*) FILTER (WHERE f.effective_status = 'invoiced') AS invoiced_count,
        COALESCE(SUM(CASE WHEN f.effective_status = 'invoiced' THEN f.outstanding_amount ELSE 0 END), 0) AS invoiced_amount,
        COUNT(*) FILTER (WHERE f.effective_status = 'overdue') AS overdue_count,
        COALESCE(SUM(CASE WHEN f.effective_status = 'overdue' THEN f.outstanding_amount ELSE 0 END), 0) AS overdue_amount,
        COUNT(*) FILTER (WHERE f.effective_status = 'unbilled') AS unbilled_count,
        COALESCE(SUM(CASE WHEN f.effective_status = 'unbilled' THEN f.amount ELSE 0 END), 0) AS unbilled_amount,
        COUNT(*) FILTER (WHERE f.billing_type = 'milestone') AS milestone_count,
        COALESCE(SUM(CASE WHEN f.billing_type = 'milestone' THEN f.amount ELSE 0 END), 0) AS milestone_amount,
        COUNT(*) FILTER (WHERE f.billing_type = 'recurring_monthly') AS recurring_count,
        COALESCE(SUM(CASE WHEN f.billing_type = 'recurring_monthly' THEN f.amount ELSE 0 END), 0) AS recurring_amount,
        json_agg(json_build_object('id', f.id, 'proposal_id', f.proposal_id, 'proposal_number', f.proposal_number,
          'proposal_version', f.proposal_version, 'billing_type', f.billing_type, 'billing_status', f.billing_status,
          'effective_status', f.effective_status, 'amount', f.amount, 'paid_amount', f.paid_amount,
          'milestone_name', f.milestone_name, 'invoice_number', f.invoice_number, 'due_date', f.due_date,
          'term_index', f.term_index, 'period_month', f.period_month, 'coverage_period', f.coverage_period,
          'trigger_condition', f.trigger_condition, 'percent', f.percent, 'invoice_date', f.invoice_date,
          'paid_date', f.paid_date, 'proof_reference', f.proof_reference, 'notes', f.notes,
          'company_name', f.company_name, 'project_name', f.project_name) ORDER BY f.due_date NULLS LAST, f.id) AS invoices
      FROM current_rows f WHERE TRUE ${filters}
      GROUP BY f.company_id, f.company_name, f.project_id, f.project_name
      ORDER BY f.company_name, f.project_name
    `, params);

    const summaryRes = await pool.query(`
      WITH latest_won AS (
        SELECT cp.id, cp.proposal_number, cp.grand_total FROM commercial_proposals cp
        WHERE cp.deal_status = 'won' AND cp.version = (SELECT MAX(cp2.version) FROM commercial_proposals cp2 WHERE cp2.proposal_number = cp.proposal_number)
      ), current_rows AS (
        SELECT pmi.*, CASE WHEN pmi.billing_status = 'paid' THEN 'paid'
          WHEN pmi.billing_status = 'overdue' OR (pmi.billing_status = 'invoiced' AND pmi.due_date < CURRENT_DATE) THEN 'overdue'
          ELSE pmi.billing_status END AS effective_status,
          GREATEST(pmi.amount - COALESCE(pmi.paid_amount, 0), 0) AS outstanding_amount
        FROM payment_milestone_invoices pmi JOIN commercial_proposals cp ON cp.id = pmi.proposal_id
        JOIN latest_won lw ON lw.proposal_number = cp.proposal_number
        WHERE (lw.id = cp.id AND NOT EXISTS (
          SELECT 1 FROM payment_milestone_invoices history
          JOIN commercial_proposals older ON older.id = history.proposal_id
          WHERE older.proposal_number = cp.proposal_number AND older.id <> cp.id
            AND history.billing_type = pmi.billing_type AND history.term_index = pmi.term_index
            AND history.billing_status IN ('invoiced', 'paid', 'overdue')
        )) OR pmi.billing_status IN ('invoiced', 'paid', 'overdue')
      )
      SELECT COALESCE((SELECT SUM(grand_total) FROM latest_won), 0) AS total_contract_value,
        COALESCE(SUM(CASE WHEN effective_status IN ('paid', 'invoiced', 'overdue') THEN COALESCE(paid_amount, CASE WHEN effective_status = 'paid' THEN amount ELSE 0 END) ELSE 0 END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN effective_status IN ('invoiced', 'overdue') THEN outstanding_amount ELSE 0 END), 0) AS total_invoiced,
        COALESCE(SUM(CASE WHEN effective_status = 'unbilled' THEN amount ELSE 0 END), 0) AS total_unbilled,
        COALESCE(SUM(CASE WHEN billing_type = 'recurring_monthly' AND effective_status != 'paid' THEN outstanding_amount ELSE 0 END), 0) AS total_recurring_pipeline,
        COALESCE(ROUND(AVG(CASE WHEN billing_type = 'recurring_monthly' THEN amount END)), 0) AS mrr_rate
      FROM current_rows
    `);
    return NextResponse.json({ success: true, invoices: projectsRes.rows, summary: summaryRes.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
