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

console.log('Connecting to postgres...');
const pool = new Pool({ connectionString: databaseUrl });
pool.query('SELECT NOW() as now, current_database() as db', (err, res) => {
  if (err) {
    console.error('Connection error:', err);
    process.exit(1);
  }
  console.log('Connected successfully!');
  console.log('Result:', res.rows[0]);
  pool.end();
});
