import test from 'node:test';
import assert from 'node:assert/strict';
import { EventType } from '@ag-ui/client';
import { HermesAgent, createStreamTranslator } from './hermes-agent.mjs';

const env = { HERMES_API_URL: 'http://busdev_ai:8642/v1', HERMES_API_KEY: 'test-key' };

function sseResponse(events) {
  const body = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function collect(agent, input) {
  const events = [];
  return new Promise((resolve, reject) => {
    agent.run(input).subscribe({
      next: (event) => events.push(event),
      error: reject,
      complete: () => resolve(events),
    });
  });
}

const baseInput = {
  threadId: 'thread-1', runId: 'run-1', messages: [{ id: 'u1', role: 'user', content: 'halo' }],
  state: {}, tools: [], context: [], forwardedProps: {},
};

test('HermesAgent fails closed when the API is not configured', async () => {
  const agent = new HermesAgent({ env: {} });
  await assert.rejects(() => collect(agent, baseInput), /Hermes API is not configured/);
});

test('HermesAgent posts to /v1/responses with bearer auth and streams input', async () => {
  let request;
  const agent = new HermesAgent({
    env,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return sseResponse([
        { type: 'response.created' },
        { type: 'response.output_text.delta', item_id: 'msg_1', delta: 'Hai' },
        { type: 'response.output_text.done', item_id: 'msg_1' },
        { type: 'response.completed' },
      ]);
    },
  });
  const events = await collect(agent, baseInput);
  assert.equal(request.url, 'http://busdev_ai:8642/v1/responses');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.equal(request.options.redirect, 'error');
  const sent = JSON.parse(request.options.body);
  assert.equal(sent.stream, true);
  assert.deepEqual(sent.input, [{ role: 'user', content: 'halo' }]);
  assert.deepEqual(events.map((e) => e.type), [
    EventType.RUN_STARTED,
    EventType.TEXT_MESSAGE_START,
    EventType.TEXT_MESSAGE_CONTENT,
    EventType.TEXT_MESSAGE_END,
    EventType.RUN_FINISHED,
  ]);
  assert.equal(events[2].delta, 'Hai');
});

test('HermesAgent maps a generateSandboxedUi function call to AG-UI tool events', async () => {
  const args = JSON.stringify({ initialHeight: 200, html: '<div>x</div>' });
  const agent = new HermesAgent({
    env,
    fetchImpl: async () => sseResponse([
      { type: 'response.created' },
      { type: 'response.output_item.added', item: { id: 'fc_1', type: 'function_call', name: 'generateSandboxedUi', call_id: 'call_1', arguments: args } },
      { type: 'response.output_item.done', item: { id: 'fc_1', type: 'function_call', name: 'generateSandboxedUi', call_id: 'call_1', arguments: args } },
      { type: 'response.output_item.added', item: { id: 'fco_1', type: 'function_call_output', call_id: 'call_1', output: '{"rendered":true}' } },
      { type: 'response.output_text.delta', item_id: 'msg_1', delta: 'Selesai' },
      { type: 'response.completed' },
    ]),
  });
  const events = await collect(agent, baseInput);
  const types = events.map((e) => e.type);
  assert.deepEqual(types.slice(0, 4), [
    EventType.RUN_STARTED,
    EventType.TOOL_CALL_START,
    EventType.TOOL_CALL_ARGS,
    EventType.TOOL_CALL_END,
  ]);
  const start = events.find((e) => e.type === EventType.TOOL_CALL_START);
  assert.equal(start.toolCallName, 'generateSandboxedUi');
  assert.equal(start.toolCallId, 'call_1');
  const argsEvent = events.find((e) => e.type === EventType.TOOL_CALL_ARGS);
  assert.equal(argsEvent.delta, args);
  const result = events.find((e) => e.type === EventType.TOOL_CALL_RESULT);
  assert.equal(result.toolCallId, 'call_1');
  assert.equal(result.content, '{"rendered":true}');
  // No duplicate tool events for the .added/.done pair.
  assert.equal(types.filter((t) => t === EventType.TOOL_CALL_START).length, 1);
});

test('HermesAgent surfaces a Hermes failure as a safe error', async () => {
  const agent = new HermesAgent({ env, fetchImpl: async () => new Response('', { status: 503 }) });
  await assert.rejects(() => collect(agent, baseInput), /Hermes API returned HTTP 503/);
});

test('createStreamTranslator emits RUN_ERROR for response.failed', () => {
  const t = createStreamTranslator({ threadId: 't', runId: 'r' });
  const events = t.push({ type: 'response.failed', response: { error: { message: 'boom' } } });
  assert.equal(events[0].type, EventType.RUN_ERROR);
  assert.equal(events[0].message, 'boom');
});
