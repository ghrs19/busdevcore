import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const post = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
const put = await readFile(new URL('./[id]/route.ts', import.meta.url), 'utf8');

test('proposal POST and PUT persist schedule in transaction', () => {
  for (const source of [post, put]) {
    assert.match(source, /connect\(\)/);
    assert.match(source, /BEGIN/);
    assert.match(source, /COMMIT/);
    assert.match(source, /ROLLBACK/);
    assert.match(source, /payment_milestone_invoices/);
  }
});

test('schedule reconciliation locks rows and protects invoiced or paid terms', () => {
  assert.match(post + put, /FOR UPDATE/);
  assert.match(post + put, /billing_status\s+NOT IN\s*\(\s*'invoiced'\s*,\s*'paid'\s*\)/);
  assert.match(post + put, /ON CONFLICT \(proposal_id, billing_type, term_index\) DO NOTHING/);
});

test('proposal revision rolls back transaction before returning missing proposal', () => {
  const missing = put.indexOf("if (currentRes.rows.length === 0)");
  assert.ok(missing >= 0);
  const branch = put.slice(missing, put.indexOf("const currentProposal", missing));
  assert.match(branch, /ROLLBACK/);
});

test('proposal numbers are serialized per year and month before counting', () => {
  const lock = post.indexOf('pg_advisory_xact_lock');
  const count = post.indexOf('COUNT(DISTINCT proposal_number)');
  assert.ok(lock >= 0 && lock < count);
});

test('proposal revisions lock root before selecting next version', () => {
  const root = put.indexOf('const rootId =');
  const lock = put.indexOf('pg_advisory_xact_lock', root);
  const maxVersion = put.indexOf('MAX(version)', root);
  assert.ok(root >= 0 && lock > root && maxVersion > lock);
});

test('schedule row query sorts by billing type and term index before positional reconciliation', async () => {
  const source = await readFile(new URL('../../../lib/commercial-schedule.ts', import.meta.url), 'utf8');
  assert.match(source, /WHERE proposal_id = \$1\s+ORDER BY billing_type, term_index, id\s+FOR UPDATE/);
});

test('schedule generator keeps source order and skips protected index collisions', () => {
  assert.match(post + put, /MAX\(term_index\)/);
  assert.match(post + put, /nextTermIndex/);
});
