import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runMigrations } = require('./migration-runner.js');

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'));
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
}
function fakeClient(applied = []) {
  return { applied, calls: [], async query(sql, args = []) {
    this.calls.push([sql, args]);
    if (sql.includes('SELECT to_regclass')) return { rows: [{ ledger: this.applied.length ? 'schema_migrations' : null }] };
    if (sql.includes('SELECT EXISTS')) return { rows: [{ has_objects: false }] };
    if (sql.includes('SELECT version, checksum')) return { rows: [...this.applied] };
    if (sql.includes('INSERT INTO schema_migrations')) this.applied.push({ version: args[0], checksum: args[1] });
    return { rows: [] };
  } };
}

test('rejects nonempty database without ledger before creating ledger', async () => {
  const dir = fixture({ '001_a.sql': 'SELECT 1;' });
  const client = fakeClient();
  client.query = async function (sql, args = []) {
    this.calls.push([sql, args]);
    if (sql.includes('SELECT to_regclass')) return { rows: [{ ledger: null }] };
    if (sql.includes('SELECT EXISTS')) return { rows: [{ has_objects: true }] };
    return { rows: [] };
  };
  await assert.rejects(runMigrations(client, dir), /nonempty database.*refusing to run migrations/i);
  assert.equal(client.calls.some(([sql]) => sql.includes('CREATE TABLE IF NOT EXISTS schema_migrations')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('baseline is disabled until complete schema inventory is captured', async () => {
  const dir = fixture({ '001_a.sql': 'SELECT 1;' });
  const client = fakeClient();
  await assert.rejects(runMigrations(client, dir, { baseline: true }), /baseline disabled.*complete verified schema inventory/i);
  assert.equal(client.calls.length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('runs sorted migrations once and records checksums', async () => {
  const dir = fixture({ '002_b.sql': 'SELECT 2;', '001_a.sql': 'SELECT 1;' });
  const client = fakeClient();
  await runMigrations(client, dir);
  assert.deepEqual(client.calls.filter(([sql]) => /^SELECT [12];$/.test(sql)).map(([sql]) => sql), ['SELECT 1;', 'SELECT 2;']);
  assert.equal(client.applied.length, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('skips applied migration but rejects changed checksum', async () => {
  const dir = fixture({ '001_a.sql': 'SELECT 1;' });
  const client = fakeClient();
  await runMigrations(client, dir);
  const applied = client.applied.map(x => ({ ...x }));
  const callsBefore = client.calls.length;
  await runMigrations(fakeClient(applied), dir);
  assert.equal(client.calls.length, callsBefore);
  fs.writeFileSync(path.join(dir, '001_a.sql'), 'SELECT 2;');
  await assert.rejects(runMigrations(fakeClient(applied), dir), /checksum mismatch/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('rolls back failed migration and does not mark it applied', async () => {
  const dir = fixture({ '001_a.sql': 'BROKEN;' });
  const client = fakeClient();
  client.query = async function (sql, args = []) {
    this.calls.push([sql, args]);
    if (sql.includes('SELECT to_regclass')) return { rows: [{ ledger: null }] };
    if (sql.includes('SELECT EXISTS')) return { rows: [{ has_objects: false }] };
    if (sql.includes('SELECT version, checksum')) return { rows: [...this.applied] };
    if (sql === 'BROKEN;') throw new Error('sql failed');
    if (sql.includes('INSERT INTO schema_migrations')) this.applied.push({ version: args[0], checksum: args[1] });
    return { rows: [] };
  };
  await assert.rejects(runMigrations(client, dir), /sql failed/);
  assert.equal(client.applied.length, 0);
  assert.ok(client.calls.some(([sql]) => sql === 'ROLLBACK'));
  fs.rmSync(dir, { recursive: true, force: true });
});
