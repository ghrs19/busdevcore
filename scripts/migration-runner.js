const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

async function runMigrations(client, migrationsDir, options = {}) {
  if (options.baseline) throw new Error('Baseline disabled until a complete verified schema inventory is captured');

  const { rows: [{ ledger }] } = await client.query("SELECT to_regclass('public.schema_migrations') AS ledger");
  if (!ledger) {
    const { rows: [{ has_objects: hasObjects }] } = await client.query(`SELECT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    ) AS has_objects`);
    if (hasObjects) throw new Error('Nonempty database has no schema_migrations ledger; refusing to run migrations');
  }

  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await client.query('SELECT pg_advisory_lock($1)', [724193821]);
  try {
    const files = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort();
    if (files.some(file => !/^\d+_[\w.-]+\.sql$/.test(file))) throw new Error('Migration filenames must start with a numeric version');
    for (let i = 1; i < files.length; i++) {
      if (files[i].slice(0, files[i].indexOf('_')) === files[i - 1].slice(0, files[i - 1].indexOf('_'))) {
        throw new Error(`Duplicate migration version: ${files[i]}`);
      }
    }
    const { rows } = await client.query('SELECT version, checksum FROM schema_migrations');
    const applied = new Map(rows.map(row => [row.version, row.checksum]));
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      if (applied.has(file)) {
        if (applied.get(file) !== checksum) throw new Error(`Migration checksum mismatch: ${file}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [724193821]);
  }
}

module.exports = { runMigrations };
