import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. CRM Pipeline Stats
    const pipelineRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_proposals,
        COUNT(CASE WHEN deal_status = 'won' THEN 1 END)::int as won_count,
        COUNT(CASE WHEN deal_status = 'lost' THEN 1 END)::int as lost_count,
        COUNT(CASE WHEN deal_status IN ('draft', 'sent', 'negotiation') THEN 1 END)::int as active_pipeline_count,
        COALESCE(SUM(CASE WHEN deal_status = 'won' THEN grand_total ELSE 0 END), 0) as total_won_value,
        COALESCE(SUM(CASE WHEN deal_status IN ('draft', 'sent', 'negotiation') THEN grand_total ELSE 0 END), 0) as active_pipeline_value,
        COALESCE(SUM(cogs_amount), 0) as total_cogs_value
      FROM commercial_proposals
      WHERE version = (
        SELECT MAX(cp2.version) 
        FROM commercial_proposals cp2 
        WHERE cp2.proposal_number = commercial_proposals.proposal_number
      )
    `);

    // 2. Cashflow & Invoicing Stats
    const invoiceRes = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_contract_value,
        COALESCE(SUM(CASE WHEN billing_status = 'paid' THEN paid_amount ELSE 0 END), 0) as total_cash_received,
        COALESCE(SUM(CASE WHEN billing_status = 'invoiced' THEN amount ELSE 0 END), 0) as total_pending_receivables,
        COALESCE(SUM(CASE WHEN billing_status = 'overdue' THEN amount ELSE 0 END), 0) as total_overdue_receivables,
        COALESCE(SUM(CASE WHEN billing_status = 'unbilled' THEN amount ELSE 0 END), 0) as total_unbilled_pipeline,
        COUNT(CASE WHEN billing_status = 'paid' THEN 1 END)::int as paid_count,
        COUNT(CASE WHEN billing_status = 'invoiced' THEN 1 END)::int as invoiced_count,
        COUNT(CASE WHEN billing_status = 'overdue' THEN 1 END)::int as overdue_count
      FROM payment_milestone_invoices
    `);

    // 3. Estimates Count
    const estRes = await pool.query(`
      SELECT COUNT(*)::int as total_estimates FROM project_estimates
    `);

    // 4. Recent Deals Won
    const recentWonRes = await pool.query(`
      SELECT cp.id, cp.proposal_number, cp.version, cp.grand_total, cp.updated_at, c.name as company_name, p.name as project_name
      FROM commercial_proposals cp
      JOIN companies c ON cp.company_id = c.id
      JOIN projects p ON cp.project_id = p.id
      WHERE cp.deal_status = 'won'
      ORDER BY cp.updated_at DESC
      LIMIT 5
    `);

    const pipe = pipelineRes.rows[0];
    const inv = invoiceRes.rows[0];
    const totalFinished = (pipe.won_count + pipe.lost_count);
    const winRate = totalFinished > 0 ? ((pipe.won_count / totalFinished) * 100).toFixed(1) : '100.0';

    return NextResponse.json({
      success: true,
      metrics: {
        total_estimates: estRes.rows[0]?.total_estimates || 0,
        total_proposals: pipe.total_proposals,
        active_pipeline_count: pipe.active_pipeline_count,
        active_pipeline_value: pipe.active_pipeline_value,
        won_count: pipe.won_count,
        total_won_value: pipe.total_won_value,
        win_rate: winRate,
        total_cash_received: inv.total_cash_received,
        total_pending_receivables: inv.total_pending_receivables,
        total_overdue_receivables: inv.total_overdue_receivables,
        total_unbilled_pipeline: inv.total_unbilled_pipeline,
        invoiced_count: inv.invoiced_count,
      },
      recent_won: recentWonRes.rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
