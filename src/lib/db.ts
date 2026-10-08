import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('DATABASE_URL=')) {
          return trimmed.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch {
    // fallback
  }
  return 'postgresql://postgres:postgres@localhost:5432/busdevcore';
}

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

const pool = global.__dbPool || new Pool({
  connectionString: getDatabaseUrl(),
  max: 10,
  idleTimeoutMillis: 30000,
});

if (process.env.NODE_ENV !== 'production') {
  global.__dbPool = pool;
}

export default pool;
