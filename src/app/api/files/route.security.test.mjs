import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = await readFile(new URL('./[path]/route.ts', import.meta.url), 'utf8');

test('file download requires an authenticated user and a registered invoice or contract URL', () => {
  assert.match(route, /FROM payment_milestone_invoices[\s\S]*proof_file_url = \$1/);
  assert.match(route, /FROM contract_documents[\s\S]*file_url = \$1/);
  assert.match(route, /if \(!authorized\.rows\.length\)/);
});
