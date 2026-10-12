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

    let query = `
      SELECT 
        pmi.*,
        CASE WHEN pmi.billing_status = 'invoiced' AND pmi.due_date < CURRENT_DATE THEN 'overdue' ELSE pmi.billing_status END AS effective_status,

        cp.proposal_number,
        cp.version as proposal_version,
        c.name as company_name,
        p.name as project_name
      FROM payment_milestone_invoices pmi
      JOIN commercial_proposals cp ON pmi.proposal_id = cp.id
      JOIN companies c ON cp.company_id = c.id
      JOIN projects p ON cp.project_id = p.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'overdue') {
        query += ` AND pmi.billing_status = 'invoiced' AND pmi.due_date < CURRENT_DATE `;
      } else {
        params.push(statusFilter);
        query += ` AND pmi.billing_status = $${params.length} `;
      }
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (c.name ILIKE $${params.length} OR p.name ILIKE $${params.length}) `;
    }

    if (typeFilter && typeFilter !== 'all') {
      params.push(typeFilter);
      query += ` AND pmi.billing_type = $${params.length} `;
    }

    query += ` ORDER BY 
      CASE WHEN pmi.billing_type = 'milestone' THEN 1 ELSE 2 END ASC,
      pmi.due_date ASC NULLS LAST, 
      pmi.id ASC `;

    const res = await pool.query(query, params);

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
      invoices: res.rows,
      summary: summaryRes.rows[0],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
