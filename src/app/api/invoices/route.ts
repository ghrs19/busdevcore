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
    const statusFilter = searchParams.get('status');
    const typeFilter = searchParams.get('type'); // 'all', 'milestone', 'recurring_monthly'
    const search = searchParams.get('search')?.trim();

    const params: unknown[] = [];
    let filters = '';
    if (search) {
      params.push(`%${search}%`);
      filters += ` AND (f.company_name ILIKE $${params.length} OR f.project_name ILIKE $${params.length}) `;
    }
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'overdue') {
        filters += ` AND f.effective_status = 'overdue' `;
      } else {
        params.push(statusFilter);
        filters += ` AND f.effective_status = $${params.length} `;
      }
    }
    if (typeFilter && typeFilter !== 'all') {
      params.push(typeFilter);
      filters += ` AND f.billing_type = $${params.length} `;
    }

    const projectFilter = filters
      ? `WHERE EXISTS (SELECT 1 FROM current_rows f WHERE f.company_id = current_rows.company_id AND f.project_id = current_rows.project_id ${filters})`
      : '';

    const projectsRes = await pool.query(`
      WITH current_rows AS (
        SELECT pmi.*, cp.proposal_number, cp.version AS proposal_version,
          c.id AS company_id, c.name AS company_name, p.id AS project_id, p.name AS project_name,
          CASE WHEN pmi.billing_status = 'overdue' OR (pmi.billing_status = 'invoiced' AND pmi.due_date < CURRENT_DATE) THEN 'overdue' ELSE pmi.billing_status END AS effective_status
        FROM payment_milestone_invoices pmi
        JOIN commercial_proposals cp ON pmi.proposal_id = cp.id
        JOIN companies c ON cp.company_id = c.id
        JOIN projects p ON cp.project_id = p.id
        WHERE cp.version = (SELECT MAX(cp2.version) FROM commercial_proposals cp2 WHERE cp2.proposal_number = cp.proposal_number)
           OR pmi.billing_status IN ('invoiced', 'paid')
      )
      SELECT company_id, company_name, project_id, project_name,
        COUNT(*) AS invoice_count,
        COUNT(*) FILTER (WHERE effective_status = 'paid') AS paid_count,
        COALESCE(SUM(CASE WHEN effective_status = 'paid' THEN COALESCE(paid_amount, amount) ELSE 0 END), 0) AS paid_amount,
        COUNT(*) FILTER (WHERE effective_status = 'invoiced') AS invoiced_count,
        COALESCE(SUM(CASE WHEN effective_status = 'invoiced' THEN amount ELSE 0 END), 0) AS invoiced_amount,
        COUNT(*) FILTER (WHERE effective_status = 'overdue') AS overdue_count,
        COALESCE(SUM(CASE WHEN effective_status = 'overdue' THEN amount ELSE 0 END), 0) AS overdue_amount,
        COUNT(*) FILTER (WHERE effective_status = 'unbilled') AS unbilled_count,
        COALESCE(SUM(CASE WHEN effective_status = 'unbilled' THEN amount ELSE 0 END), 0) AS unbilled_amount,
        COUNT(*) FILTER (WHERE billing_type = 'milestone') AS milestone_count,
        COALESCE(SUM(CASE WHEN billing_type = 'milestone' THEN amount ELSE 0 END), 0) AS milestone_amount,
        COUNT(*) FILTER (WHERE billing_type = 'recurring_monthly') AS recurring_count,
        COALESCE(SUM(CASE WHEN billing_type = 'recurring_monthly' THEN amount ELSE 0 END), 0) AS recurring_amount,
        json_agg(json_build_object('id', id, 'proposal_id', proposal_id, 'proposal_number', proposal_number,
          'proposal_version', proposal_version, 'billing_type', billing_type, 'billing_status', billing_status,
          'effective_status', effective_status, 'amount', amount, 'paid_amount', paid_amount,
          'milestone_name', milestone_name, 'invoice_number', invoice_number, 'due_date', due_date,
          'term_index', term_index, 'period_month', period_month, 'coverage_period', coverage_period,
          'trigger_condition', trigger_condition, 'percent', percent, 'invoice_date', invoice_date,
          'paid_date', paid_date, 'proof_reference', proof_reference, 'notes', notes,
          'company_name', company_name, 'project_name', project_name) ORDER BY due_date NULLS LAST, id) AS invoices
      FROM current_rows
      ${projectFilter}
      GROUP BY company_id, company_name, project_id, project_name
      ORDER BY company_name, project_name
    `, params);

    // Summary calculations with MRR
    const summaryRes = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_contract_value,
        COALESCE(SUM(CASE WHEN billing_status = 'paid' THEN paid_amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN billing_status = 'invoiced' THEN amount ELSE 0 END), 0) as total_invoiced,
        COALESCE(SUM(CASE WHEN billing_status = 'unbilled' THEN amount ELSE 0 END), 0) as total_unbilled,
        COALESCE(SUM(CASE WHEN billing_type = 'recurring_monthly' AND billing_status != 'paid' THEN amount ELSE 0 END), 0) as total_recurring_pipeline,
        COALESCE(ROUND(AVG(CASE WHEN billing_type = 'recurring_monthly' THEN amount ELSE NULL END)), 0) as mrr_rate
      FROM payment_milestone_invoices
    `);

    return NextResponse.json({
      success: true,
      invoices: projectsRes.rows,
      summary: summaryRes.rows[0],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
