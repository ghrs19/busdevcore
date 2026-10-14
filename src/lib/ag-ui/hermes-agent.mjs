// Hermes-backed AG-UI agent.
//
// Bridges the Hermes `busdev_ai` gateway (`POST /v1/responses`, SSE) into the
// AG-UI event contract CopilotKit consumes. The Responses stream emits
// `response.output_item.added/done` items carrying `function_call`
// (name + full arguments + call_id) and `function_call_output` (call_id +
// output), plus `response.output_text.delta/done` for the assistant text.
//
// CopilotKit's runtime wraps this agent with OpenGenerativeUIMiddleware, which
// turns a `generateSandboxedUi` tool call into ACTIVITY_SNAPSHOT/ACTIVITY_DELTA
// events for the sandboxed-UI renderer — so this file only emits the base
// AG-UI events; the activity translation is the runtime's job.

import { AbstractAgent, EventType } from '@ag-ui/client';
import { Observable } from 'rxjs';

const DEFAULT_INSTRUCTIONS = [
  'Kamu adalah BusDevCore AI Copilot, asisten in-app untuk sistem Project Costing ERP.',
  'Jawab ringkas dan akurat dalam Bahasa Indonesia. Gunakan tool bila perlu mengambil data nyata.',
  'Untuk chart, diagram, atau kalkulator interaktif, panggil tool generateSandboxedUi sekali dengan konten lengkap.',
  'Jangan ungkap kredensial, tarif per orang, atau isi audit log.',
].join(' ');

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part && (part.type === 'text' || typeof part.text === 'string'))
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('');
  }
  return '';
}

function toHermesInput(messages) {
  const out = [];
  for (const message of messages ?? []) {
    if (!message || typeof message.role !== 'string') continue;
    if (!['user', 'assistant', 'system'].includes(message.role)) continue;
    const content = textFromContent(message.content);
    if (!content) continue;
    out.push({ role: message.role, content });
  }
  return out;
}

// Parse one SSE frame body (`data: {...}`) and yield AG-UI events. Kept pure so
// it can be unit-tested without a network round trip.
export function createStreamTranslator({ threadId, runId }) {
  let textMessageId = null;
  const seenFunctionCalls = new Set();
  const emitted = [];

  function emit(event) {
    emitted.push(event);
    return event;
  }

  return {
    events: emitted,
    push(data) {
      const type = data?.type;
      if (type === 'response.created') {
        return [emit({ type: EventType.RUN_STARTED, threadId, runId })];
      }
      if (type === 'response.output_item.added' || type === 'response.output_item.done') {
        const item = data.item;
        if (!item || typeof item !== 'object') return [];
        if (item.type === 'function_call') {
          // Hermes delivers the complete arguments in a single frame and repeats
          // the item in `.done` after `.added` — dedupe on the item id.
          if (item.id && seenFunctionCalls.has(item.id)) return [];
          if (item.id) seenFunctionCalls.add(item.id);
          const args = typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments ?? {});
          const events = [
            { type: EventType.TOOL_CALL_START, toolCallId: item.call_id, toolCallName: item.name },
            { type: EventType.TOOL_CALL_ARGS, toolCallId: item.call_id, delta: args },
            { type: EventType.TOOL_CALL_END, toolCallId: item.call_id },
          ];
          events.forEach(emit);
          return events;
        }
        if (item.type === 'function_call_output') {
          const content = typeof item.output === 'string' ? item.output : JSON.stringify(item.output ?? '');
          const event = { type: EventType.TOOL_CALL_RESULT, messageId: `${item.call_id}-result`, toolCallId: item.call_id, content, role: 'tool' };
          return [emit(event)];
        }
        return [];
      }
      if (type === 'response.output_text.delta') {
        const delta = typeof data.delta === 'string' ? data.delta : '';
        if (!delta) return [];
        if (!textMessageId) {
          textMessageId = data.item_id || `msg_${runId}`;
          const start = emit({ type: EventType.TEXT_MESSAGE_START, messageId: textMessageId, role: 'assistant' });
          const event = { type: EventType.TEXT_MESSAGE_CONTENT, messageId: textMessageId, delta };
          return [start, event];
        }
        const event = { type: EventType.TEXT_MESSAGE_CONTENT, messageId: textMessageId, delta };
        return [emit(event)];
      }
      if (type === 'response.output_text.done') {
        if (!textMessageId) return [];
        const event = { type: EventType.TEXT_MESSAGE_END, messageId: textMessageId };
        textMessageId = null;
        return [emit(event)];
      }
      if (type === 'response.failed') {
        const message = data.response?.error?.message || 'Hermes run failed';
        return [emit({ type: EventType.RUN_ERROR, message })];
      }
      if (type === 'response.completed') {
        return [emit({ type: EventType.RUN_FINISHED, threadId, runId })];
      }
      return [];
    },
  };
}

async function* parseSse(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try { yield JSON.parse(payload); } catch { /* ignore malformed frame */ }
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export class HermesAgent extends AbstractAgent {
  constructor(config = {}) {
    super({
      agentId: config.agentId,
      description: config.description ?? 'BusDevCore AI Copilot (Hermes busdev_ai)',
      threadId: config.threadId,
      initialMessages: config.initialMessages,
      initialState: config.initialState,
      debug: config.debug,
    });
    this.env = config.env ?? process.env;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.instructions = config.instructions ?? DEFAULT_INSTRUCTIONS;
  }

  clone() {
    return new HermesAgent({
      agentId: this.agentId,
      description: this.description,
      threadId: this.threadId,
      initialMessages: this.messages,
      initialState: this.state,
      env: this.env,
      fetchImpl: this.fetchImpl,
      instructions: this.instructions,
    });
  }

  run(input) {
    return new Observable((subscriber) => {
      const controller = new AbortController();
      const runId = input?.runId ?? this.threadId ?? 'run';
      const threadId = input?.threadId ?? this.threadId ?? 'thread';
      const translator = createStreamTranslator({ threadId, runId });

      (async () => {
        const base = this.env.HERMES_API_URL?.trim().replace(/\/+$/, '');
        const apiKey = this.env.HERMES_API_KEY;
        if (!base || !apiKey) throw new Error('Hermes API is not configured');
        const messages = toHermesInput(input?.messages ?? this.messages);
        if (messages.length === 0) throw new Error('Hermes agent received no messages');

        const response = await this.fetchImpl(`${base}/responses`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'hermes-agent', input: messages, instructions: this.instructions, stream: true }),
          signal: controller.signal,
          redirect: 'error',
        });
        if (!response.ok || !response.body) {
          throw new Error(`Hermes API returned HTTP ${response.status}`);
        }
        let finished = false;
        for await (const data of parseSse(response.body)) {
          for (const event of translator.push(data)) {
            if (event.type === EventType.RUN_FINISHED) finished = true;
            subscriber.next(event);
          }
        }
        if (!finished) subscriber.next({ type: EventType.RUN_FINISHED, threadId, runId });
        subscriber.complete();
      })().catch((error) => subscriber.error(error));

      return () => controller.abort();
    });
  }
}
