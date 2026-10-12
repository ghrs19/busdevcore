import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = await readFile(new URL('./route.ts', import.meta.url), 'utf8');

test('invoice query derives overdue from unpaid due_date and date boundary', () => {
  assert.match(route, /billing_status\s*=\s*'invoiced'[\s\S]*due_date\s*<\s*CURRENT_DATE/);
  assert.match(route, /AS effective_status/);
  assert.match(route, /effective_status/);
  assert.doesNotMatch(route, /pmi\.billing_status\s*=\s*\$\{params\.length\}/);
});

test('invoice API supports parameterized case-insensitive client/project search', () => {
  assert.match(route, /searchParams\.get\('search'\)/);
  assert.match(route, /f\.company_name ILIKE/);
  assert.match(route, /f\.company_name ILIKE/);
  assert.match(route, /params\.push\(`%\$\{search\}%`\)/);
});

test('invoice endpoint returns project groups with per-status and per-model totals', () => {
  for (const field of ['GROUP BY company_id, company_name, project_id, project_name', 'paid_count', 'paid_amount', 'overdue_count', 'invoiced_count', 'unbilled_count', 'milestone_count', 'recurring_count', 'json_agg(json_build_object']) {
    assert.ok(route.includes(field), `expected invoice route to contain ${field}`);
  }
  assert.match(route, /cp2\.proposal_number = cp\.proposal_number/);
  assert.match(route, /WHERE cp\.version = \(SELECT MAX\(cp2\.version\)[\s\S]*OR pmi\.billing_status IN \('invoiced', 'paid'\)/);
  assert.ok(route.includes('${filters}'));
});

test('status filter explicitly handles overdue and excludes paid invoices', () => {
  assert.match(route, /statusFilter\s*===\s*'overdue'/);
  assert.match(route, /pmi\.billing_status\s*=\s*'invoiced'/);
  assert.match(route, /filters \+= ` AND f\.effective_status = \$\$\{params\.length\} `/);
  assert.match(route, /pmi\.billing_status = 'overdue' OR \(pmi\.billing_status = 'invoiced' AND pmi\.due_date < CURRENT_DATE\)/);
  assert.match(route, /ELSE pmi\.billing_status END AS effective_status/);
});
