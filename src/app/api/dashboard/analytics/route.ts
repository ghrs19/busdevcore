import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Pipeline & Won Summary (Unique latest proposals)
    const pipelineRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_proposals,
        COUNT(CASE WHEN deal_status = 'won' THEN 1 END)::int as won_count,
        COUNT(CASE WHEN deal_status = 'lost' THEN 1 END)::int as lost_count,
        COUNT(CASE WHEN deal_status = 'negotiation' THEN 1 END)::int as negotiation_count,
        COUNT(CASE WHEN deal_status = 'sent' THEN 1 END)::int as sent_count,
        COUNT(CASE WHEN deal_status = 'draft' THEN 1 END)::int as draft_count,
        COALESCE(SUM(CASE WHEN deal_status = 'won' THEN grand_total ELSE 0 END), 0) as total_won_value,
        COALESCE(SUM(CASE WHEN deal_status IN ('draft', 'sent', 'negotiation') THEN grand_total ELSE 0 END), 0) as active_pipeline_value,
        COALESCE(SUM(CASE WHEN deal_status = 'won' THEN cogs_amount ELSE 0 END), 0) as total_won_cogs,
        COALESCE(AVG(CASE WHEN deal_status = 'won' THEN margin_percent ELSE NULL END), 0) as avg_won_margin
      FROM commercial_proposals
      WHERE version = (
        SELECT MAX(cp2.version) 
        FROM commercial_proposals cp2 
        WHERE cp2.proposal_number = commercial_proposals.proposal_number
      )
    `);

    // 2. Cashflow & Billing Health
    const cashflowRes = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_contract_committed,
        COALESCE(SUM(CASE WHEN billing_status = 'paid' THEN paid_amount ELSE 0 END), 0) as total_cash_collected,
        COALESCE(SUM(CASE WHEN billing_status = 'invoiced' THEN amount ELSE 0 END), 0) as total_invoiced_pending,
        COALESCE(SUM(CASE WHEN billing_status = 'overdue' THEN amount ELSE 0 END), 0) as total_overdue_amount,
        COALESCE(SUM(CASE WHEN billing_status = 'unbilled' THEN amount ELSE 0 END), 0) as total_unbilled_schedule,
        COALESCE(SUM(CASE WHEN billing_type = 'recurring_monthly' AND billing_status != 'paid' THEN amount ELSE 0 END), 0) as recurring_annual_pipeline,
        COALESCE(ROUND(AVG(CASE WHEN billing_type = 'recurring_monthly' THEN amount ELSE NULL END)), 0) as current_mrr,
        COUNT(CASE WHEN billing_status = 'paid' THEN 1 END)::int as count_paid,
        COUNT(CASE WHEN billing_status = 'invoiced' THEN 1 END)::int as count_invoiced,
        COUNT(CASE WHEN billing_status = 'overdue' THEN 1 END)::int as count_overdue,
        COUNT(CASE WHEN billing_status = 'unbilled' THEN 1 END)::int as count_unbilled
      FROM payment_milestone_invoices
    `);

    // 3. Costing & Estimation Insights
    const costingStatsRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_estimates,
        COALESCE(SUM(total_hours), 0) as total_manhours_quoted,
        COALESCE(SUM(total_cost), 0) as total_cogs_quoted,
        COALESCE(AVG(total_hours), 0) as avg_manhours_per_project
      FROM project_estimates
    `);

    // 4. Role Hours Breakdown (Top Allocated Roles)
    const roleStatsRes = await pool.query(`
      SELECT 
        rm.name as role_name,
        rm.code as role_code,
        rm.default_hourly_rate,
        COUNT(et.id)::int as task_count,
        COALESCE(SUM(et.hours), 0) as total_allocated_hours
      FROM role_masters rm
      LEFT JOIN estimate_tasks et ON rm.id = et.role_id
      GROUP BY rm.id, rm.name, rm.code, rm.default_hourly_rate
      ORDER BY total_allocated_hours DESC
      LIMIT 6
    `);

    // 5. Top Clients by Contract Value
    const topClientsRes = await pool.query(`
      SELECT 
        c.id,
        c.name as company_name,
        COUNT(DISTINCT cp.proposal_number)::int as total_deals,
        COALESCE(SUM(cp.grand_total), 0) as total_contract_value,
        COALESCE(SUM(CASE WHEN cp.deal_status = 'won' THEN cp.grand_total ELSE 0 END), 0) as won_value
      FROM companies c
      JOIN commercial_proposals cp ON c.id = cp.company_id
      WHERE cp.version = (
        SELECT MAX(cp2.version) 
        FROM commercial_proposals cp2 
        WHERE cp2.proposal_number = cp.proposal_number
      )
      GROUP BY c.id, c.name
      ORDER BY won_value DESC, total_contract_value DESC
      LIMIT 5
    `);

    // 6. Recent Activities from Audit Logs
    const recentAuditRes = await pool.query(`
      SELECT al.*, u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.id DESC
      LIMIT 8
    `);

    const p = pipelineRes.rows[0];
    const c = cashflowRes.rows[0];
    const est = costingStatsRes.rows[0];

    const totalFinishedDeals = p.won_count + p.lost_count;
    const winRate = totalFinishedDeals > 0 ? ((p.won_count / totalFinishedDeals) * 100).toFixed(1) : '100.0';
    const estimatedGrossProfit = Number(p.total_won_value) - Number(p.total_won_cogs);

    return NextResponse.json({
      success: true,
      stats: {
        crm: {
          total_proposals: p.total_proposals,
          won_count: p.won_count,
          lost_count: p.lost_count,
          negotiation_count: p.negotiation_count,
          sent_count: p.sent_count,
          draft_count: p.draft_count,
          total_won_value: p.total_won_value,
          active_pipeline_value: p.active_pipeline_value,
          total_won_cogs: p.total_won_cogs,
          estimated_gross_profit: estimatedGrossProfit,
          avg_won_margin: Number(p.avg_won_margin).toFixed(1),
          win_rate: winRate,
        },
        cashflow: {
          total_contract_committed: c.total_contract_committed,
          total_cash_collected: c.total_cash_collected,
          total_invoiced_pending: c.total_invoiced_pending,
          total_overdue_amount: c.total_overdue_amount,
          total_unbilled_schedule: c.total_unbilled_schedule,
          current_mrr: c.current_mrr,
          recurring_annual_pipeline: c.recurring_annual_pipeline,
          count_paid: c.count_paid,
          count_invoiced: c.count_invoiced,
          count_overdue: c.count_overdue,
          count_unbilled: c.count_unbilled,
        },
        costing: {
          total_estimates: est.total_estimates,
          total_manhours_quoted: est.total_manhours_quoted,
          total_cogs_quoted: est.total_cogs_quoted,
          avg_manhours_per_project: Math.round(Number(est.avg_manhours_per_project)),
        },
      },
      top_roles: roleStatsRes.rows,
      top_clients: topClientsRes.rows,
      recent_activities: recentAuditRes.rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
