import test from 'node:test';
import assert from 'node:assert/strict';
import { runHermes } from './hermes-run.mjs';

const env = { HERMES_API_URL: 'http://busdev_ai:8642/v1', HERMES_API_KEY: 'test-key' };

test('runHermes reads structured run events and final reply', async () => {
  const requests = [];
  const result = await runHermes('SELECT 1', {
    env,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/runs')) return Response.json({ run_id: 'run_test' }, { status: 202 });
      return new Response('data: {"event":"tool.started","tool":"terminal","preview":"query"}\n\ndata: {"event":"tool.completed","tool":"terminal","preview":"1"}\n\ndata: {"event":"run.completed","output":"1","runtime":{"model":"cx/gpt-6-luna"}}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    },
  });
  assert.equal(result.reply, '1');
  assert.deepEqual(result.tools, [{ name: 'terminal', status: 'completed' }]);
  assert.equal(result.model, 'cx/gpt-6-luna');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-key');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(requests[0].options.body), { input: 'SELECT 1', model: 'hermes-agent' });
});

test('runHermes rejects upstream failure without leaking event content', async () => {
  await assert.rejects(() => runHermes('hello', { env, fetchImpl: async (url) => url.endsWith('/runs') ? Response.json({ run_id: 'run_test' }, { status: 202 }) : new Response('data: {"event":"run.failed","error":"sensitive"}\n\n') }), /Hermes run failed/);
});

test('runHermes stops runs awaiting approval instead of hanging', async () => {
  const calls = [];
  await assert.rejects(() => runHermes('hello', { env, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/runs')) return Response.json({ run_id: 'run_test' }, { status: 202 });
    if (url.endsWith('/events')) return new Response('data: {"event":"approval.request"}\n\n');
    if (url.endsWith('/stop')) return Response.json({ status: 'stopped' });
    assert.fail(`Unexpected URL ${url}`);
  } }), /requires approval/);
  assert.equal(calls.at(-1).url, 'http://busdev_ai:8642/v1/runs/run_test/stop');
  assert.equal(calls.at(-1).options.method, 'POST');
});

test('runHermes stops orphaned run when event stream ends without a terminal event', async () => {
  const calls = [];
  await assert.rejects(() => runHermes('hello', { env, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/runs')) return Response.json({ run_id: 'run_test' }, { status: 202 });
    if (url.endsWith('/events')) return new Response('data: {"event":"message.delta","delta":"hi"}\n\n');
    if (url.endsWith('/stop')) return Response.json({ status: 'stopped' });
    assert.fail(`Unexpected URL ${url}`);
  } }), /ended without reply/);
  assert.equal(calls.at(-1).url, 'http://busdev_ai:8642/v1/runs/run_test/stop');
});

test('runHermes handles split SSE frames and ignores plain commentary', async () => {
  const encoder = new TextEncoder();
  const chunks = ['data: {"event":"message.delta","delta":"partial"}\n\n', 'data: {"event":"run.com', 'pleted","output":"final"}\n\n'];
  const result = await runHermes('hello', { env, fetchImpl: async (url) => url.endsWith('/runs') ? Response.json({ run_id: 'run_test' }, { status: 202 }) : new Response(new ReadableStream({ start(controller) { for (const part of chunks) controller.enqueue(encoder.encode(part)); controller.close(); } })) });
  assert.equal(result.reply, 'final');
  assert.deepEqual(result.tools, []);
});

test('runHermes rejects invalid run ids and missing config', async () => {
  await assert.rejects(() => runHermes('hello', { env: {}, fetchImpl: async () => assert.fail('no request') }), /not configured/);
  await assert.rejects(() => runHermes('hello', { env, fetchImpl: async () => Response.json({ run_id: '../other' }, { status: 202 }) }), /invalid run ID/);
});
