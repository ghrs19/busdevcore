import { Readable } from 'stream';
import pool from '@/lib/db';

// Object storage with three interchangeable drivers, chosen by STORAGE_DRIVER:
//
// - "postgres" (default): files are BYTEA rows in the file_objects table
//   (migration 025) in the same PostgreSQL database as the business data —
//   Neon in production, or any self-hosted PostgreSQL.
// - "minio": files live in an S3-compatible MinIO server configured through
//   the MINIO_* environment variables, for self-hosted deployments that
//   prefer a dedicated object store.
// - "gdrive": files live in a Google Drive folder via the Drive API v3.
//   Object names are mapped to Drive file IDs in storage_objects
//   (migration 026); files are never shared publicly — downloads always
//   stream through this app after the usual authorization checks.
//
// The public API and the /api/files/<objectName> URL shape are identical
// either way, so upload/download routes do not depend on the driver.

export type StorageDriver = 'postgres' | 'minio' | 'gdrive';

export function storageDriver(): StorageDriver {
  const value = (process.env.STORAGE_DRIVER || 'postgres').trim().toLowerCase();
  if (value === 'postgres' || value === 'minio' || value === 'gdrive') return value;
  throw new Error(`Unsupported STORAGE_DRIVER: ${value} (expected "postgres", "minio", or "gdrive")`);
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
// Google Drive driver
// ---------------------------------------------------------------------------

const GDRIVE_API = 'https://www.googleapis.com/drive/v3';
const GDRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

let gdriveTokenCache: { token: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function serviceAccountFromEnv(): { email: string; privateKey: string } {
  const jsonText = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
    ? Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8')
    : process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonText) {
    const parsed = JSON.parse(jsonText) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must contain client_email and private_key');
    }
    return { email: parsed.client_email, privateKey: parsed.private_key };
  }
  return {
    email: requiredEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    privateKey: requiredEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n'),
  };
}

async function gdriveAccessToken(): Promise<string> {
  if (gdriveTokenCache && gdriveTokenCache.expiresAt > Date.now() + 30_000) {
    return gdriveTokenCache.token;
  }

  let body: URLSearchParams;
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    // Act as a real user account (files are owned by, and count against the
    // quota of, that account). Best fit for personal Google accounts.
    body = new URLSearchParams({
      client_id: requiredEnv('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    });
  } else {
    // Service account via JWT bearer grant. GOOGLE_DRIVE_IMPERSONATE_EMAIL
    // optionally impersonates a Workspace user through domain-wide
    // delegation — required when files must be owned by a user in a Shared
    // Drive / Workspace setup instead of the service account.
    const { createSign } = await import('node:crypto');
    const { email, privateKey } = serviceAccountFromEnv();
    const now = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = {
      iss: email,
      scope: GDRIVE_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    };
    if (process.env.GOOGLE_DRIVE_IMPERSONATE_EMAIL) {
      claims.sub = process.env.GOOGLE_DRIVE_IMPERSONATE_EMAIL;
    }
    const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url');
    body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    });
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(`Google Drive authorization failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
  const data = (await response.json()) as { access_token: string; expires_in?: number };
  gdriveTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return gdriveTokenCache.token;
}

async function gdriveFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await gdriveAccessToken();
  const response = await fetch(path, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  return response;
}

async function gdriveEnsureOk(response: Response, action: string): Promise<void> {
  if (!response.ok) {
    throw new Error(`Google Drive ${action} failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
}

async function gdriveFindFileId(objectName: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT external_id FROM storage_objects WHERE object_name = $1 AND driver = 'gdrive'`,
    [objectName]
  );
  return result.rows.length ? (result.rows[0].external_id as string) : null;
}

async function gdriveRemember(objectName: string, fileId: string, contentType: string, size: number): Promise<void> {
  await pool.query(
    `INSERT INTO storage_objects (object_name, driver, external_id, content_type, size)
     VALUES ($1, 'gdrive', $2, $3, $4)
     ON CONFLICT (object_name, driver) DO UPDATE
       SET external_id = EXCLUDED.external_id,
           content_type = EXCLUDED.content_type,
           size = EXCLUDED.size,
           updated_at = NOW()`,
    [objectName, fileId, contentType || 'application/octet-stream', size]
  );
}

async function gdriveForget(objectName: string): Promise<void> {
  await pool.query(
    `DELETE FROM storage_objects WHERE object_name = $1 AND driver = 'gdrive'`,
    [objectName]
  );
}

async function gdriveUploadFile(objectName: string, buffer: Buffer, contentType: string): Promise<void> {
  const mime = contentType || 'application/octet-stream';
  const existingId = await gdriveFindFileId(objectName);

  if (!existingId) {
    await gdriveCreateFile(objectName, buffer, mime);
    return;
  }

  const response = await gdriveFetch(`${GDRIVE_UPLOAD_API}/files/${existingId}?uploadType=media&supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { 'Content-Type': mime },
    body: new Uint8Array(buffer),
  });
  if (response.status === 404) {
    // Mapping pointed at a file deleted outside the app; recreate it.
    await gdriveCreateFile(objectName, buffer, mime);
    return;
  }
  await gdriveEnsureOk(response, 'upload (update)');
  await gdriveRemember(objectName, existingId, mime, buffer.length);
}

// Object names use '/' as a path separator (e.g.
// "payments/PT Example/inv_1_..._proof.pdf"). In Drive these segments
// become REAL folders under the configured root folder, so the Drive
// UI mirrors the object-name structure; the postgres and minio drivers
// keep the flat namespace semantics they already have.
const gdriveFolderCache = new Map<string, string>();

function gdriveEscapeQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function gdriveFindOrCreateFolder(parentId: string, name: string): Promise<string> {
  const cacheKey = `${parentId}\n${name}`;
  const cached = gdriveFolderCache.get(cacheKey);
  if (cached) return cached;

  const query = [
    `name = '${gdriveEscapeQueryValue(name)}'`,
    `'${parentId}' in parents`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    'trashed = false',
  ].join(' and ');
  const listUrl =
    `${GDRIVE_API}/files?q=${encodeURIComponent(query)}` +
    '&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives';
  const listResponse = await gdriveFetch(listUrl);
  await gdriveEnsureOk(listResponse, 'folder lookup');
  const listed = (await listResponse.json()) as { files?: Array<{ id: string }> };
  let folderId = listed.files?.[0]?.id;

  if (!folderId) {
    const createResponse = await gdriveFetch(`${GDRIVE_API}/files?supportsAllDrives=true&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    });
    await gdriveEnsureOk(createResponse, 'folder create');
    folderId = ((await createResponse.json()) as { id: string }).id;
  }

  gdriveFolderCache.set(cacheKey, folderId);
  return folderId;
}

async function gdriveResolveParent(objectName: string): Promise<{ parentId: string; fileName: string }> {
  const segments = objectName.split('/').filter((segment) => segment.length > 0);
  const fileName = segments.length > 0 ? segments[segments.length - 1] : objectName;
  let parentId = requiredEnv('GOOGLE_DRIVE_FOLDER_ID');
  for (const segment of segments.slice(0, -1)) {
    parentId = await gdriveFindOrCreateFolder(parentId, segment);
  }
  return { parentId, fileName };
}

async function gdriveCreateFile(objectName: string, buffer: Buffer, mime: string): Promise<string> {
  const { parentId, fileName } = await gdriveResolveParent(objectName);
  const boundary = `busdevcore-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({ name: fileName, parents: [parentId], mimeType: mime });
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
    'utf8'
  );
  const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const response = await gdriveFetch(`${GDRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id&supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: new Uint8Array(Buffer.concat([head, buffer, tail])),
  });
  await gdriveEnsureOk(response, 'upload (create)');
  const created = (await response.json()) as { id: string };
  await gdriveRemember(objectName, created.id, mime, buffer.length);
  return created.id;
}

async function gdriveRequireFileId(objectName: string): Promise<string> {
  const fileId = await gdriveFindFileId(objectName);
  if (!fileId) throw new Error(`File not found: ${objectName}`);
  return fileId;
}

async function gdriveGetFileStream(objectName: string) {
  const fileId = await gdriveRequireFileId(objectName);
  const response = await gdriveFetch(`${GDRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`);
  await gdriveEnsureOk(response, 'download');
  if (!response.body) throw new Error(`File not found: ${objectName}`);
  return Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
}

async function gdriveGetFileStat(objectName: string): Promise<FileStat> {
  const fileId = await gdriveRequireFileId(objectName);
  const response = await gdriveFetch(`${GDRIVE_API}/files/${fileId}?fields=id,name,mimeType,size&supportsAllDrives=true`);
  await gdriveEnsureOk(response, 'stat');
  const meta = (await response.json()) as { mimeType?: string; size?: string };
  return {
    size: Number(meta.size ?? 0),
    metaData: { 'content-type': meta.mimeType || 'application/octet-stream' },
  };
}

async function gdriveDeleteFile(objectName: string): Promise<void> {
  const fileId = await gdriveFindFileId(objectName);
  if (fileId) {
    // Move to trash instead of a permanent DELETE: permanently deleting a
    // file inside a Shared Drive requires the drive-Manager (organizer)
    // role, which the service account intentionally does not need for
    // uploads/downloads. Trashed files stop being served immediately and
    // can still be recovered from Drive for a grace period.
    const response = await gdriveFetch(`${GDRIVE_API}/files/${fileId}?supportsAllDrives=true`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
    if (response.status !== 404) await gdriveEnsureOk(response, 'delete (trash)');
  }
  await gdriveForget(objectName);
}

// ---------------------------------------------------------------------------
// Public API (driver dispatch)
// ---------------------------------------------------------------------------

export async function ensureBucket(): Promise<void> {
  // Only MinIO has a bucket to provision. The PostgreSQL driver relies on
  // the file_objects table (migration 025); the Google Drive driver relies
  // on the target folder having been created and shared beforehand.
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
  const driver = storageDriver();
  if (driver === 'minio') {
    await minioUploadFile(objectName, buffer, contentType);
  } else if (driver === 'gdrive') {
    await gdriveUploadFile(objectName, buffer, contentType);
  } else {
    await pgUploadFile(objectName, buffer, contentType);
  }
  return `/api/files/${encodeURIComponent(objectName)}`;
}

export async function getFileStream(objectName: string) {
  const driver = storageDriver();
  if (driver === 'minio') return minioGetFileStream(objectName);
  if (driver === 'gdrive') return gdriveGetFileStream(objectName);
  return pgGetFileStream(objectName);
}

export async function getFileStat(objectName: string): Promise<FileStat> {
  const driver = storageDriver();
  if (driver === 'minio') return minioGetFileStat(objectName);
  if (driver === 'gdrive') return gdriveGetFileStat(objectName);
  return pgGetFileStat(objectName);
}

export async function deleteFile(objectName: string): Promise<void> {
  const driver = storageDriver();
  if (driver === 'minio') {
    await minioDeleteFile(objectName);
  } else if (driver === 'gdrive') {
    await gdriveDeleteFile(objectName);
  } else {
    await pgDeleteFile(objectName);
  }
}
