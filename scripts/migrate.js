const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      databaseUrl = trimmed.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
      break;
    }
  }
}

async function runMigration() {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const migrationsDir = path.join(__dirname, '../src/db/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      console.log('Running migration from', file);
      await pool.query(sql);
    }
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
    await pool.end();
  }
}

runMigration();
