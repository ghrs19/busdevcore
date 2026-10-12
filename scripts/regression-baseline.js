#!/usr/bin/env node
const { Pool } = require('pg');
const connectionString = process.argv[2] || process.env.DATABASE_URL || (process.env.PGHOST && `postgresql://${process.env.PGUSER || ''}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || ''}`);
if (!connectionString) throw new Error('DATABASE_URL or PGHOST/PGDATABASE is required');
const checks = {
  orphan_estimates: `SELECT count(*)::int AS count FROM project_estimates e LEFT JOIN companies c ON c.id=e.company_id LEFT JOIN projects p ON p.id=e.project_id WHERE c.id IS NULL OR (e.project_id IS NOT NULL AND p.id IS NULL)`,
  orphan_proposals: `SELECT count(*)::int AS count FROM commercial_proposals cp LEFT JOIN companies c ON c.id=cp.company_id LEFT JOIN projects p ON p.id=cp.project_id LEFT JOIN project_estimates e ON e.id=cp.estimate_id WHERE c.id IS NULL OR p.id IS NULL OR e.id IS NULL`,
  duplicate_proposal_numbers: `SELECT count(*)::int AS count FROM (SELECT proposal_number FROM commercial_proposals GROUP BY proposal_number HAVING count(*)>1) x`,
  invalid_milestone_totals: `SELECT count(*)::int AS count FROM (SELECT proposal_id FROM payment_milestone_invoices GROUP BY proposal_id HAVING abs(coalesce(sum(percent),0)-100)>.01) x`,
  unknown_proposal_statuses: `SELECT count(*)::int AS count FROM commercial_proposals WHERE coalesce(deal_status,'draft') NOT IN ('draft','sent','negotiation','won','lost')`,
};
(async () => {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = {};
    for (const [name, sql] of Object.entries(checks)) result[name] = (await pool.query(sql)).rows[0].count;
    console.log(JSON.stringify({ readOnly: true, checks: result }, null, 2));
  } finally { await pool.end(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
