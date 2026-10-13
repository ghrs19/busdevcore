import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = await readFile(new URL('./route.ts', import.meta.url), 'utf8');

test('invoice query derives overdue from unpaid due_date and includes only latest Won schedule plus billed history', () => {
  assert.match(route, /billing_status\s*=\s*'invoiced'[\s\S]*due_date\s*<\s*CURRENT_DATE/);
  assert.match(route, /AS effective_status/);
  assert.match(route, /JOIN latest_won lw ON lw\.proposal_number = cp\.proposal_number/);
  assert.match(route, /WHERE \(lw\.id = cp\.id AND NOT EXISTS/);
  assert.match(route, /history\.billing_type = pmi\.billing_type AND history\.term_index = pmi\.term_index/);
  assert.match(route, /OR pmi\.billing_status IN \('invoiced', 'paid', 'overdue'\)/);
  assert.match(route, /cp\.deal_status = 'won'[\s\S]*MAX\(cp2\.version\)/);
});

test('invoice API supports parameterized case-insensitive client/project search', () => {
  assert.match(route, /searchParams\.get\('search'\)/);
  assert.match(route, /f\.company_name ILIKE/);
  assert.match(route, /f\.project_name ILIKE/);
  assert.match(route, /params\.push\(`%\$\{search\}%`\)/);
});

test('invoice endpoint groups current financial rows and exposes status/model totals', () => {
  for (const field of ['GROUP BY f.company_id, f.company_name, f.project_id, f.project_name', 'paid_count', 'paid_amount', 'overdue_count', 'invoiced_count', 'unbilled_count', 'milestone_count', 'recurring_count', 'json_agg(json_build_object']) {
    assert.ok(route.includes(field), `expected invoice route to contain ${field}`);
  }
  assert.match(route, /GREATEST\(pmi\.amount - COALESCE\(pmi\.paid_amount, 0\), 0\) AS outstanding_amount/);
  assert.match(route, /SUM\(grand_total\).*AS total_contract_value/);
  assert.ok(route.includes('${filters}'));
});

test('status filters are parameterized and overdue state uses shared due-date rule', () => {
  assert.match(route, /statusFilter\s*===\s*'overdue'/);
  assert.match(route, /filters \+= ` AND f\.effective_status = \$\$\{params\.length\}`/);
  assert.match(route, /pmi\.billing_status = 'overdue' OR \(pmi\.billing_status = 'invoiced' AND pmi\.due_date < CURRENT_DATE\)/);
});
