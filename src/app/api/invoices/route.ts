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

    let query = `
      SELECT 
        pmi.*,
        cp.proposal_number,
        cp.version as proposal_version,
        c.name as company_name,
        p.name as project_name
      FROM payment_milestone_invoices pmi
      JOIN commercial_proposals cp ON pmi.proposal_id = cp.id
      JOIN companies c ON cp.company_id = c.id
      JOIN projects p ON cp.project_id = p.id
    `;
    const params: unknown[] = [];

    if (statusFilter && statusFilter !== 'all') {
      query += ` WHERE pmi.billing_status = $1 `;
      params.push(statusFilter);
    }

    query += ` ORDER BY pmi.due_date ASC NULLS LAST, pmi.id DESC `;

    const res = await pool.query(query, params);

    // Summary calculations
    const summaryRes = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_contract_value,
        COALESCE(SUM(CASE WHEN billing_status = 'paid' THEN paid_amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN billing_status = 'invoiced' THEN amount ELSE 0 END), 0) as total_invoiced,
        COALESCE(SUM(CASE WHEN billing_status = 'unbilled' THEN amount ELSE 0 END), 0) as total_unbilled
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
