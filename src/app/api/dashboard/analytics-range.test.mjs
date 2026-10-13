import test from 'node:test';
import assert from 'node:assert/strict';
import { getDashboardRange } from './analytics-range.mjs';
import { readFile } from 'node:fs/promises';

const dashboardSource = await readFile(new URL('./analytics/route.ts', import.meta.url), 'utf8');

test('cashflow metrics only count schedules from latest won proposals', () => {
  const cashflowQuery = dashboardSource.split('// 2. Cashflow & Billing Health')[1]?.split('// 3. Costing & Estimation Insights')[0] || '';
  assert.match(cashflowQuery, /latest_won\s+AS\s*\(/);
  assert.match(cashflowQuery, /cp\.deal_status\s*=\s*'won'/);
  assert.match(cashflowQuery, /JOIN latest_won lw ON lw\.id = pmi\.proposal_id/);
  assert.match(cashflowQuery, /SELECT SUM\(grand_total\) FROM latest_won/);
});

test('accepts supported dashboard ranges and leaves all-time unbounded', () => {
  assert.deepEqual(getDashboardRange('all'), null);
  assert.deepEqual(getDashboardRange('30'), { days: 30 });
  assert.deepEqual(getDashboardRange('90'), { days: 90 });
});

test('falls back to all-time for invalid ranges', () => {
  assert.equal(getDashboardRange('0'), null);
  assert.equal(getDashboardRange('999'), null);
  assert.equal(getDashboardRange(null), null);
});
