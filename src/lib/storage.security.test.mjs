import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./storage.ts', import.meta.url), 'utf8');

test('object storage lives in PostgreSQL, not a separate object store service', () => {
  assert.doesNotMatch(source, /minio/i);
  assert.doesNotMatch(source, /MINIO_/);
  assert.doesNotMatch(source, /minioadmin|miniopassword123/);
  assert.match(source, /file_objects/);
  assert.match(source, /@\/lib\/db/);
});

test('storage keeps the public file URL shape and guards upload size integrity', () => {
  assert.match(source, /`\/api\/files\/\$\{encodeURIComponent\(objectName\)\}`/);
  assert.match(source, /size !== storedSize/);
});
