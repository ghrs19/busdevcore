import { Readable } from 'stream';
import pool from '@/lib/db';

// Object storage backed by PostgreSQL (Neon in production).
// Files are stored as BYTEA rows in the file_objects table (migration 025),
// keyed by the server-generated object names the upload routes already use.
// Public URL shape is unchanged: /api/files/<objectName>.

export async function ensureBucket(): Promise<void> {
  // Kept for API compatibility: there is no bucket to provision, the
  // file_objects table is created by migration instead.
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
  await pool.query(
    `INSERT INTO file_objects (object_name, content_type, size, data)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (object_name) DO UPDATE
       SET content_type = EXCLUDED.content_type,
           size = EXCLUDED.size,
           data = EXCLUDED.data,
           updated_at = NOW()`,
    [objectName, contentType || 'application/octet-stream', storedSize, buffer]
  );
  return `/api/files/${encodeURIComponent(objectName)}`;
}

export async function getFileStream(objectName: string) {
  const result = await pool.query(
    'SELECT data FROM file_objects WHERE object_name = $1',
    [objectName]
  );
  if (!result.rows.length) {
    throw new Error(`File not found: ${objectName}`);
  }
  return Readable.from(result.rows[0].data as Buffer);
}

export async function getFileStat(objectName: string) {
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
    metaData: { 'content-type': row.content_type } as Record<string, string>,
  };
}

export async function deleteFile(objectName: string) {
  await pool.query('DELETE FROM file_objects WHERE object_name = $1', [objectName]);
}
