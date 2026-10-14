import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync('src/app/api/copilotkit/route.ts', 'utf8');
const agent = readFileSync('src/lib/ag-ui/hermes-agent.mjs', 'utf8');

test('AG-UI runtime endpoint is admin-only', () => {
  assert.match(route, /currentUser\(\)/);
  assert.match(route, /status: 401/);
  assert.match(route, /user\.role !== 'admin'/);
  assert.match(route, /status: 403/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function GET/);
});

test('AG-UI runtime wires the Hermes-backed agent and enables generative UI', () => {
  assert.match(route, /new HermesAgent\(/);
  assert.match(route, /openGenerativeUI: true/);
  assert.match(route, /ExperimentalEmptyAdapter/);
  assert.match(route, /copilotRuntimeNextJSAppRouterEndpoint/);
  assert.match(route, /endpoint: '\/api\/copilotkit'/);
});

test('runtime route never exposes Hermes credentials to the client', () => {
  assert.doesNotMatch(route, /HERMES_API_KEY\s*[:=]\s*['"`]/);
  assert.doesNotMatch(agent, /NEXT_PUBLIC_/);
});

test('AG-UI runtime keeps the tool name CopilotKit middleware expects', () => {
  assert.match(agent, /generateSandboxedUi/);
});
