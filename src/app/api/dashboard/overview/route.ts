import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { latestEstimateFilter } from '@/lib/commercial-workflow';

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
      WITH latest_won AS (
        SELECT cp.id, cp.proposal_number FROM commercial_proposals cp WHERE cp.deal_status = 'won'
          AND cp.version = (SELECT MAX(cp2.version) FROM commercial_proposals cp2 WHERE cp2.proposal_number = cp.proposal_number)
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
      SELECT COALESCE(SUM(CASE WHEN effective_status IN ('paid', 'invoiced', 'overdue') THEN COALESCE(paid_amount, CASE WHEN effective_status = 'paid' THEN amount ELSE 0 END) ELSE 0 END), 0) AS total_cash_received,
        COALESCE(SUM(CASE WHEN effective_status = 'invoiced' THEN outstanding_amount ELSE 0 END), 0) AS total_pending_receivables,
        COALESCE(SUM(CASE WHEN effective_status = 'overdue' THEN outstanding_amount ELSE 0 END), 0) AS total_overdue_receivables,
        COALESCE(SUM(CASE WHEN effective_status = 'unbilled' THEN amount ELSE 0 END), 0) AS total_unbilled_pipeline,
        COUNT(*) FILTER (WHERE effective_status = 'paid')::int AS paid_count,
        COUNT(*) FILTER (WHERE effective_status = 'invoiced')::int AS invoiced_count,
        COUNT(*) FILTER (WHERE effective_status = 'overdue')::int AS overdue_count
      FROM current_rows
    `);

    // 3. Estimates Count
    const estRes = await pool.query(`
      SELECT COUNT(*)::int as total_estimates FROM project_estimates e WHERE ${latestEstimateFilter}
    `);

    // 4. Recent Deals Won
    const recentWonRes = await pool.query(`
      SELECT cp.id, cp.proposal_number, cp.version, cp.grand_total, cp.updated_at, c.name as company_name, p.name as project_name
      FROM commercial_proposals cp
      JOIN companies c ON cp.company_id = c.id
      JOIN projects p ON cp.project_id = p.id
      WHERE cp.deal_status = 'won'
        AND cp.version = (SELECT MAX(cp2.version) FROM commercial_proposals cp2 WHERE cp2.proposal_number = cp.proposal_number)
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
