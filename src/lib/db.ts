import { Pool, type PoolConfig } from 'pg';
import fs from 'fs';
import path from 'path';

// Database connection options, in priority order:
// 1. DATABASE_URL — any PostgreSQL connection string (Neon, self-hosted
//    PostgreSQL, or another hosted provider). Read from the process
//    environment, or from the .env file for non-Next entry points.
// 2. Discrete variables — DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
//    (again environment first, then .env). Set DB_SSL=true for servers
//    that require TLS without a locally trusted CA (most hosted setups
//    simply carry sslmode in DATABASE_URL instead).
// With neither configured, defaults target a local PostgreSQL instance.

function readEnvFile(): Record<string, string> {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return {};
    const values: Record<string, string> = {};
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
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

function getPoolConfig(): PoolConfig {
  const fromFile = readEnvFile();
  const pick = (name: string): string | undefined =>
    process.env[name] || fromFile[name] || undefined;

  const databaseUrl = pick('DATABASE_URL');
  if (databaseUrl) {
    return { connectionString: databaseUrl };
  }

  const config: PoolConfig = {
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

declare global {
  var __dbPool: Pool | undefined;
}

const pool = global.__dbPool || new Pool({
  ...getPoolConfig(),
  max: 10,
  idleTimeoutMillis: 30000,
});

if (process.env.NODE_ENV !== 'production') {
  global.__dbPool = pool;
}

export default pool;
