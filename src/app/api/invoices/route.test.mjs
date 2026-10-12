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
  assert.match(route, /c\.name ILIKE/);
  assert.match(route, /p\.name ILIKE/);
  assert.match(route, /params\.push\(`%\$\{search\}%`\)/);
});

test('status filter explicitly handles overdue and excludes paid invoices', () => {
  assert.match(route, /statusFilter\s*===\s*'overdue'/);
  assert.match(route, /pmi\.billing_status\s*=\s*'invoiced'/);
  assert.match(route, /pmi\.billing_status = \$\$\{params\.length\}/);
  assert.match(route, /ELSE pmi\.billing_status END AS effective_status/);
});
