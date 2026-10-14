import { Readable } from 'stream';
import pool from '@/lib/db';

// Object storage with two interchangeable drivers, chosen by STORAGE_DRIVER:
//
// - "postgres" (default): files are BYTEA rows in the file_objects table
//   (migration 025) in the same PostgreSQL database as the business data —
//   Neon in production, or any self-hosted PostgreSQL.
// - "minio": files live in an S3-compatible MinIO server configured through
//   the MINIO_* environment variables, for self-hosted deployments that
//   prefer a dedicated object store.
//
// The public API and the /api/files/<objectName> URL shape are identical
// either way, so upload/download routes do not depend on the driver.

export type StorageDriver = 'postgres' | 'minio';

export function storageDriver(): StorageDriver {
  const value = (process.env.STORAGE_DRIVER || 'postgres').trim().toLowerCase();
  if (value === 'postgres' || value === 'minio') return value;
  throw new Error(`Unsupported STORAGE_DRIVER: ${value} (expected "postgres" or "minio")`);
}

export interface FileStat {
  size: number;
  metaData: Record<string, string>;
}

// ---------------------------------------------------------------------------
// PostgreSQL driver
// ---------------------------------------------------------------------------

async function pgUploadFile(objectName: string, buffer: Buffer, contentType: string): Promise<void> {
  await pool.query(
    `INSERT INTO file_objects (object_name, content_type, size, data)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (object_name) DO UPDATE
       SET content_type = EXCLUDED.content_type,
           size = EXCLUDED.size,
           data = EXCLUDED.data,
           updated_at = NOW()`,
    [objectName, contentType || 'application/octet-stream', buffer.length, buffer]
  );
}

async function pgGetFileStream(objectName: string) {
  const result = await pool.query(
    'SELECT data FROM file_objects WHERE object_name = $1',
    [objectName]
  );
  if (!result.rows.length) {
    throw new Error(`File not found: ${objectName}`);
  }
  return Readable.from(result.rows[0].data as Buffer);
}

async function pgGetFileStat(objectName: string): Promise<FileStat> {
  const result = await pool.query(
    'SELECT size, content_type FROM file_objects WHERE object_name = $1',
    [objectName]
  );
  if (!result.rows.length) {
    throw new Error(`File not found: ${objectName}`);
  }
  const row = result.rows[0] as { size: string | number; content_type: string };
  return {
    size: Number(row.size),
    metaData: { 'content-type': row.content_type },
  };
}

async function pgDeleteFile(objectName: string): Promise<void> {
  await pool.query('DELETE FROM file_objects WHERE object_name = $1', [objectName]);
}

// ---------------------------------------------------------------------------
// MinIO driver
// ---------------------------------------------------------------------------

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required storage configuration: ${name}`);
  return value;
}

async function getMinio() {
  const Minio = await import('minio');
  const client = new Minio.Client({
    endPoint: requiredEnv('MINIO_ENDPOINT'),
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: requiredEnv('MINIO_ACCESS_KEY'),
    secretKey: requiredEnv('MINIO_SECRET_KEY'),
  });
  return { client, bucket: requiredEnv('MINIO_BUCKET') };
}

async function minioEnsureBucket(): Promise<void> {
  const { client, bucket } = await getMinio();
  const exists = await client.bucketExists(bucket);
  if (!exists) await client.makeBucket(bucket, 'us-east-1');
}

async function minioUploadFile(objectName: string, buffer: Buffer, contentType: string): Promise<void> {
  const { client, bucket } = await getMinio();
  await minioEnsureBucket();
  await client.putObject(bucket, objectName, buffer, buffer.length, {
    'Content-Type': contentType,
  });
}

async function minioGetFileStream(objectName: string) {
  const { client, bucket } = await getMinio();
  return client.getObject(bucket, objectName);
}

async function minioGetFileStat(objectName: string): Promise<FileStat> {
  const { client, bucket } = await getMinio();
  const stat = await client.statObject(bucket, objectName);
  return {
    size: stat.size,
    metaData: (stat.metaData || {}) as Record<string, string>,
  };
}

async function minioDeleteFile(objectName: string): Promise<void> {
  const { client, bucket } = await getMinio();
  await client.removeObject(bucket, objectName);
}

// ---------------------------------------------------------------------------
// Public API (driver dispatch)
// ---------------------------------------------------------------------------

export async function ensureBucket(): Promise<void> {
  // Only MinIO has a bucket to provision; the PostgreSQL driver relies on
  // the file_objects table created by migration 025.
  if (storageDriver() === 'minio') await minioEnsureBucket();
}

export async function uploadFile(
  objectName: string,
  buffer: Buffer,
  size: number,
  contentType: string
): Promise<string> {
  const storedSize = buffer.length;
  if (size !== storedSize) {
    throw new Error(`Upload size mismatch for ${objectName}: declared ${size}, received ${storedSize}`);
  }
  if (storageDriver() === 'minio') {
    await minioUploadFile(objectName, buffer, contentType);
  } else {
    await pgUploadFile(objectName, buffer, contentType);
  }
  return `/api/files/${encodeURIComponent(objectName)}`;
}

export async function getFileStream(objectName: string) {
  return storageDriver() === 'minio'
    ? minioGetFileStream(objectName)
    : pgGetFileStream(objectName);
}

export async function getFileStat(objectName: string): Promise<FileStat> {
  return storageDriver() === 'minio'
    ? minioGetFileStat(objectName)
    : pgGetFileStat(objectName);
}

export async function deleteFile(objectName: string): Promise<void> {
  if (storageDriver() === 'minio') {
    await minioDeleteFile(objectName);
  } else {
    await pgDeleteFile(objectName);
  }
}
