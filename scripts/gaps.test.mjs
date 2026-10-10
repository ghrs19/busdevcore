import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = new URL('../src/', import.meta.url).pathname;
test('print uses billing summary contract', () => {
  const page = readFileSync(`${base}/app/estimates/[id]/print/page.tsx`, 'utf8');
  assert.match(page, /billing_summary\?\.total_one_time/);
  assert.match(page, /billing_summary\?\.total_monthly_recurring/);
});
test('maintenance revision accepts form payload and legacy payload', async () => {
  const { maintenanceRevisionInput } = await import(`${base}/lib/revision-input.ts`);
  assert.deepEqual(maintenanceRevisionInput({ maintenance_config: { duration_months: 6, tasks: [{ name: 'Support', role_hours: { PM: 2 } }] } }), { duration_months: 6, tasks: [{ name: 'Support', role_hours: { PM: 2 } }] });
  assert.deepEqual(maintenanceRevisionInput({ maintenance_tasks: [{ name: 'Legacy' }], maintenance_duration_months: 3 }), { duration_months: 3, tasks: [{ name: 'Legacy' }] });
  assert.deepEqual(maintenanceRevisionInput({ maintenance_config: null }), { duration_months: 12, tasks: [] });
});
test('estimate creation rejects project from another company', () => {
  const route = readFileSync(`${base}/app/api/estimates/route.ts`, 'utf8');
  assert.match(route, /WHERE id = \$1 AND company_id = \$2/);
  assert.match(route, /Project tidak ditemukan untuk perusahaan ini/);
});
test('database migration enforces project-company pair', () => {
  const sql = readFileSync(`${base}/db/migrations/005_project_company_integrity.sql`, 'utf8');
  assert.match(sql, /FOREIGN KEY \(project_id, company_id\) REFERENCES projects\(id, company_id\)/);
});
test('AI fallback is labeled in API and UI', () => {
  const api = readFileSync(`${base}/app/api/ai/draft-costing/route.ts`, 'utf8');
  const page = readFileSync(`${base}/app/estimates/new/page.tsx`, 'utf8');
  assert.match(api, /source = 'fallback'/);
  assert.match(api, /\n      source,\n      draft:/);
  assert.match(page, /result.source === 'fallback'/);
});
test('AI uploads reject oversized, too many, and wrong extensions', async () => {
  const { validateDraftUploads, parseDraftFormData, MAX_DRAFT_BODY_BYTES } = await import(`${base}/lib/draft-upload.ts`);
  assert.equal(validateDraftUploads([{ name: 'a.pdf', size: 1024 }]), null);
  assert.match(validateDraftUploads([{ name: 'a.pdf', size: 11 * 1024 * 1024 }]), /10 MB/);
  assert.match(validateDraftUploads(Array.from({ length: 6 }, (_, i) => ({ name: `${i}.pdf`, size: 1 }))), /5/);
  assert.match(validateDraftUploads([{ name: 'a.exe', size: 1 }]), /format/i);
  const request = new Request('http://localhost/', { method: 'POST', headers: { 'content-length': String(MAX_DRAFT_BODY_BYTES + 1) }, body: 'oversized' });
  await assert.rejects(parseDraftFormData(request), RangeError);
  const valid = new FormData(); valid.set('prompt', 'hello');
  const parsed = await parseDraftFormData(new Request('http://localhost/', { method: 'POST', body: valid }));
  assert.equal(parsed.get('prompt'), 'hello');
});
