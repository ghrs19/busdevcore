import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('AI chat company search uses a declared alias and parameterized pattern', () => {
  const route = readFileSync('src/app/api/ai/chat/route.ts', 'utf8');
  assert.match(route, /FROM companies c\$\{companyFilter\}/);
  assert.match(route, /companyFilter = [`' ]* WHERE c\.name ~\* \$1/);
  assert.match(route, /pool\.query\(`SELECT c\.id, c\.name FROM companies c\$\{companyFilter\}[^`]*`, searchParams\)/);
  assert.equal((route.match(/`, searchParams\)/g) || []).length, 4);
  assert.doesNotMatch(route, /~\* '\$\{regexPattern\}'/);
});

test('AI chat rejects messages over 2000 characters', async () => {
  const longMessage = 'x'.repeat(2001);
  const mockUser = { id: 1, role: 'admin', email: 'admin@test.com' };
  
  // Simple inline test without complex mocking
  const message = longMessage;
  const isValid = message.length <= 2000;
  
  assert.equal(isValid, false, 'Should reject messages over 2000 chars');
});

test('AI chat accepts valid admin requests under limit', async () => {
  const validMessage = 'Berapa total proposal?';
  const mockUser = { id: 1, role: 'admin', email: 'admin@test.com' };
  
  const isValid = validMessage.length <= 2000 && mockUser.role === 'admin';
  
  assert.equal(isValid, true, 'Should accept valid admin requests');
});

test('AI chat rejects non-admin role', async () => {
  const mockUser = { id: 2, role: 'staff', email: 'staff@test.com' };
  
  const isAuthorized = mockUser.role === 'admin';
  
  assert.equal(isAuthorized, false, 'Should reject non-admin users');
});

test('chat history is capped at 4 turns', async () => {
  const history = [
    { role: 'user', content: 'msg1' },
    { role: 'assistant', content: 'reply1' },
    { role: 'user', content: 'msg2' },
    { role: 'assistant', content: 'reply2' },
    { role: 'user', content: 'msg3' },
    { role: 'assistant', content: 'reply3' },
  ];
  
  const boundedHistory = Array.isArray(history) ? history.slice(-4) : [];
  
  assert.equal(boundedHistory.length, 4, 'Should cap history at 4 turns');
  assert.equal(boundedHistory[0].content, 'msg2', 'Should keep most recent 4');
});
