import test from 'node:test';
import assert from 'node:assert/strict';
import { executeHermes } from './hermes-agent.mjs';

test('executeHermes sends prompt to VPS Hermes API with bearer auth', async () => {
  let request;
  const reply = await executeHermes('latest proposal?', {
    env: { HERMES_API_URL: 'http://172.18.0.1:8642/v1', HERMES_API_KEY: 'test-key' },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return Response.json({ choices: [{ message: { content: 'Proposal A' } }] });
    },
  });
  assert.equal(reply, 'Proposal A');
  assert.equal(request.url, 'http://172.18.0.1:8642/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(request.options.body), { messages: [{ role: 'user', content: 'latest proposal?' }], stream: false });
});

test('executeHermes fails closed when API configuration is missing', async () => {
  await assert.rejects(() => executeHermes('hello', { env: {}, fetchImpl: async () => assert.fail('must not call') }), /not configured/);
});

test('executeHermes surfaces a safe error on upstream failure', async () => {
  await assert.rejects(() => executeHermes('hello', {
    env: { HERMES_API_URL: 'http://localhost:8642/v1', HERMES_API_KEY: 'test-key' },
    fetchImpl: async () => new Response('', { status: 503 }),
  }), /Hermes API returned HTTP 503/);
});
