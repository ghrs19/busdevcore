const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { runMigrations } = require('./migration-runner');

// Connection options mirror src/lib/db.ts: DATABASE_URL (any PostgreSQL,
// e.g. Neon or self-hosted) wins; otherwise discrete DB_HOST / DB_PORT /
// DB_NAME / DB_USER / DB_PASSWORD variables are used, each read from the
// process environment first and then from the .env file. DB_SSL=true
// enables TLS for the discrete-variable form.
function readEnvFile() {
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
    const values = {};
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.substring(0, eq).trim();
      const value = trimmed.substring(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key) values[key] = value;
    }
    return values;
  } catch {
    return {};
  }
}

function getPoolConfig() {
  const fromFile = readEnvFile();
  const pick = (name) => process.env[name] || fromFile[name] || undefined;

  const databaseUrl = pick('DATABASE_URL');
  if (databaseUrl) return { connectionString: databaseUrl };

  const config = {
    host: pick('DB_HOST') || 'localhost',
    port: parseInt(pick('DB_PORT') || '5432', 10),
    database: pick('DB_NAME') || 'busdevcore',
    user: pick('DB_USER') || 'postgres',
    password: pick('DB_PASSWORD') || 'postgres',
  };
  if ((pick('DB_SSL') || '').toLowerCase() === 'true') {
    config.ssl = { rejectUnauthorized: false };
  }
  return config;
}

async function runMigration() {
  const pool = new Pool(getPoolConfig());
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(__dirname, '../src/db/migrations');
    await runMigrations(client, migrationsDir, { baseline: process.argv.includes('--baseline') });
    console.log('Migrations executed successfully!');

    // Verify tables
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables in database:');
    res.rows.forEach(r => console.log(' -', r.table_name));

    // Verify seeded roles
    const roles = await pool.query('SELECT code, name, default_hourly_rate FROM role_masters ORDER BY id');
    console.log('Role masters:');
    roles.rows.forEach(r => console.log(`   ${r.code} (${r.name}): Rp ${r.default_hourly_rate}`));

    // Verify service types & categories
    const st = await pool.query('SELECT code, name, is_active FROM service_types ORDER BY id');
    console.log('Service types:');
    st.rows.forEach(r => console.log(`   ${r.code}: active=${r.is_active}`));

    const cats = await pool.query('SELECT c.code, c.name, s.code as service_type FROM categories c JOIN service_types s ON c.service_type_id = s.id');
    console.log('Categories:');
    cats.rows.forEach(r => console.log(`   ${r.code} under ${r.service_type}`));

    const tags = await pool.query('SELECT code, name, applies_to_category_code FROM tags');
    console.log('Tags:');
    tags.rows.forEach(r => console.log(`   ${r.code} -> applies to ${r.applies_to_category_code}`));

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
