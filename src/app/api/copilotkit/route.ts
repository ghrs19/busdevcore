import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { HermesAgent } from '@/lib/ag-ui/hermes-agent.mjs';

// AG-UI runtime for the Copilot page. The Hermes-backed agent streams the
// `busdev_ai` /v1/responses SSE into AG-UI events; CopilotKit's built-in
// OpenGenerativeUIMiddleware turns `generateSandboxedUi` tool calls into
// activity snapshots the sandboxed-UI renderer draws. Admin-only: the agent
// carries production tool credentials, so no other role (or anonymous caller)
// may reach it.
const runtime = new CopilotRuntime({
  agents: {
    default: new HermesAgent({ agentId: 'default' }),
  },
  openGenerativeUI: true,
});

const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
  endpoint: '/api/copilotkit',
  serviceAdapter: new ExperimentalEmptyAdapter(),
  runtime,
});

async function authorize() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'AI Copilot hanya tersedia untuk Administrator' }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request) {
  const denied = await authorize();
  if (denied) return denied;
  return handleRequest(req);
}

export async function GET(req: Request) {
  const denied = await authorize();
  if (denied) return denied;
  return handleRequest(req);
}
