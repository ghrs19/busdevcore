#!/usr/bin/env node
/**
 * Initialize migration baseline for production database
 * 
 * SAFE for existing databases:
 * - Creates schema_migrations table if missing
 * - Records existing migrations as applied with current checksums
 * - Enables repeatable migration workflow going forward
 * 
 * Run: node scripts/init-migration-baseline.mjs
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool(
  process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'busdevcore',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
      }
);

function checksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function initBaseline() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if schema_migrations exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'schema_migrations'
      ) as exists
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✓ schema_migrations table already exists');
      const countRes = await client.query('SELECT COUNT(*) as count FROM schema_migrations');
      console.log(`  ${countRes.rows[0].count} migrations already recorded`);
      await client.query('ROLLBACK');
      return;
    }
    
    // Create schema_migrations table
    await client.query(`
      CREATE TABLE schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ Created schema_migrations table');
    
    // Find all migration files
    const migrationsDir = path.join(__dirname, '../src/db/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`\nFound ${files.length} migration files:`);
    
    // Record each migration as applied
    for (const filename of files) {
      const content = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
      const hash = checksum(content);
      
      await client.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
        [filename, hash]
      );
      
      console.log(`  ✓ ${filename} (${hash.substring(0, 12)}...)`);
    }
    
    await client.query('COMMIT');
    console.log(`\n✓ Baseline initialized: ${files.length} migrations recorded`);
    console.log('  Future migrations will now run incrementally');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Baseline initialization failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initBaseline().catch(err => {
  console.error(err);
  process.exit(1);
});
