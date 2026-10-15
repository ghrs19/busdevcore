import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./storage.ts', import.meta.url), 'utf8');

test('storage driver is selectable and defaults to PostgreSQL', () => {
  assert.match(source, /STORAGE_DRIVER/);
  assert.match(source, /'postgres'/);
  assert.match(source, /'minio'/);
  assert.match(source, /'gdrive'/);
  assert.match(source, /Unsupported STORAGE_DRIVER/);
  assert.match(source, /file_objects/);
  assert.match(source, /@\/lib\/db/);
});

test('Google Drive driver maps object names through storage_objects and carries no embedded secrets', () => {
  assert.match(source, /GOOGLE_DRIVE_FOLDER_ID/);
  assert.match(source, /storage_objects/);
  assert.match(source, /googleapis\.com\/drive\/v3/);
  assert.match(source, /oauth2\.googleapis\.com\/token/);
  assert.match(source, /GOOGLE_OAUTH_REFRESH_TOKEN/);
  assert.match(source, /GOOGLE_SERVICE_ACCOUNT/);
  assert.doesNotMatch(source, /-----BEGIN/);
  assert.doesNotMatch(source, /ya29\./);
});

test('MinIO driver keeps required env config with no insecure defaults', () => {
  assert.doesNotMatch(source, /minioadmin|miniopassword123/);
  assert.match(source, /MINIO_ENDPOINT/);
  assert.match(source, /MINIO_ACCESS_KEY/);
  assert.match(source, /MINIO_SECRET_KEY/);
  assert.match(source, /MINIO_BUCKET/);
  assert.match(source, /requiredEnv/);
  // MinIO SDK is loaded lazily so PostgreSQL deployments do not need it.
  assert.match(source, /await import\('minio'\)/);
});

test('storage keeps the public file URL shape and guards upload size integrity', () => {
  assert.match(source, /`\/api\/files\/\$\{encodeURIComponent\(objectName\)\}`/);
  assert.match(source, /size !== storedSize/);
});
