import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = await readFile(new URL('./[id]/upload/route.ts', import.meta.url), 'utf8');
const boundedRequest = await readFile(new URL('../../../lib/bounded-request.mjs', import.meta.url), 'utf8');

test('invoice proof upload checks invoice access before accepting file', () => {
  assert.match(route, /SELECT id FROM payment_milestone_invoices WHERE id = \$1/);
  assert.ok(route.indexOf('SELECT id FROM payment_milestone_invoices') < route.indexOf('const boundedRequest'));
});

test('invoice proof upload rejects oversized requests before parsing and validates magic bytes', () => {
  assert.match(route, /readBoundedRequest\(req, MAX_REQUEST_SIZE\)/);
  assert.ok(route.indexOf('const boundedRequest') < route.indexOf('.formData()'));
  assert.match(boundedRequest, /size > limit/);
  assert.match(route, /file\.size > MAX_FILE_SIZE/);
  assert.match(route, /matchesFileSignature/);
  assert.match(route, /await file\.arrayBuffer\(\)/);
});

test('invoice upload errors do not expose storage internals', () => {
  assert.match(route, /error: 'Upload failed'/);
  assert.doesNotMatch(route, /err\.message/);
});

const contractRoute = await readFile(new URL('../commercial/[id]/documents/upload/route.ts', import.meta.url), 'utf8');
test('contract upload validates exact IDs and document ownership before storage upload', () => {
  assert.ok(contractRoute.includes('const proposalId = /^\\d+$/.test(id)'));
  assert.ok(contractRoute.includes('SELECT id FROM contract_documents WHERE id = $1 AND proposal_id = $2'));
  assert.ok(contractRoute.indexOf('documentRes.rows.length === 0') < contractRoute.indexOf('await uploadFile('));
});

test('contract upload caps request and file before buffering and validates magic bytes', () => {
  assert.match(contractRoute, /readBoundedRequest\(req, MAX_REQUEST_SIZE\)/);
  assert.ok(contractRoute.indexOf('const boundedRequest') < contractRoute.indexOf('.formData()'));
  assert.match(contractRoute, /file\.size > MAX_FILE_SIZE/);
  assert.match(contractRoute, /matchesFileSignature/);
  assert.ok(contractRoute.indexOf('file.size > MAX_FILE_SIZE') < contractRoute.indexOf('await file.arrayBuffer()'));
});

test('contract upload errors are generic', () => {
  assert.match(contractRoute, /error: 'Upload failed'/);
  assert.doesNotMatch(contractRoute, /err\.message/);
});
