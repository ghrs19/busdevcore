import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./storage.ts', import.meta.url), 'utf8');

test('storage driver is selectable and defaults to PostgreSQL', () => {
  assert.match(source, /STORAGE_DRIVER/);
  assert.match(source, /'postgres'/);
  assert.match(source, /'minio'/);
  assert.match(source, /Unsupported STORAGE_DRIVER/);
  assert.match(source, /file_objects/);
  assert.match(source, /@\/lib\/db/);
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
