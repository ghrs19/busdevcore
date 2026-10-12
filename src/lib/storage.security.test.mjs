import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./storage.ts', import.meta.url), 'utf8');

test('MinIO config has no insecure credential or bucket defaults', () => {
  assert.doesNotMatch(source, /minioadmin|miniopassword123/);
  assert.match(source, /MINIO_ENDPOINT/);
  assert.match(source, /MINIO_ACCESS_KEY/);
  assert.match(source, /MINIO_SECRET_KEY/);
  assert.match(source, /MINIO_BUCKET/);
  assert.match(source, /requiredEnv/);
});
