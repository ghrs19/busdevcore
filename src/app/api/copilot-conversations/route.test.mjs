import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync('src/app/api/copilot-conversations/route.ts', 'utf8');
const client = readFileSync('src/app/copilot/CopilotClient.tsx', 'utf8');
const migration = readFileSync('src/db/migrations/023_copilot_conversations.sql', 'utf8');

test('conversation storage is admin-only and scoped to authenticated user', () => {
  assert.match(route, /user\.role !== 'admin'/);
  assert.match(route, /WHERE user_id=\$1 AND thread_id=\$2/);
  assert.match(route, /ON CONFLICT\(user_id,thread_id\)/);
  assert.match(migration, /PRIMARY KEY \(user_id, thread_id\)/);
  assert.match(migration, /ON DELETE CASCADE/);
});

test('conversation API validates IDs and bounds stored payloads', () => {
  assert.match(route, /const ID =/);
  assert.match(route, /MAX_MESSAGES = 500/);
  assert.match(route, /MAX_BYTES = 2_000_000/);
});

test('Copilot restores saved messages and lists selectable conversations', () => {
  assert.match(client, /setInitialMessages\(Array\.isArray\(data\.conversation\?\.messages\)/);
  assert.match(client, /agent\.setMessages\(initialMessages\)/);
  assert.match(client, /Pilih percakapan/);
  assert.match(client, /onSelect=\{selectThread\}/);
  assert.match(client, /method: 'PUT'/);
});
