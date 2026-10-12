import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = await readFile(new URL('./route.ts', import.meta.url), 'utf8');

test('GET reads schedule without mutating invoice rows', () => {
  const get = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function PATCH'));
  assert.doesNotMatch(get, /\b(?:INSERT INTO|UPDATE payment_milestone_invoices|DELETE FROM)\b/);
});

test('milestone PATCH cannot overwrite proof metadata outside validated upload flow', () => {
  const patch = route.slice(route.indexOf('export async function PATCH'));
  assert.doesNotMatch(patch, /body\.proof_file_(?:url|name)/);
  assert.doesNotMatch(patch, /proof_file_(?:url|name)\s*=\s*COALESCE/);
});
