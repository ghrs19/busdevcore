export async function runHermes(input, { env = process.env, fetchImpl = fetch } = {}) {
  const base = env.HERMES_API_URL?.trim().replace(/\/+$/, '');
  if (!base || !env.HERMES_API_KEY) throw new Error('Hermes API is not configured');
  const headers = { Authorization: `Bearer ${env.HERMES_API_KEY}`, 'Content-Type': 'application/json' };
  const signal = AbortSignal.timeout(120_000);
  const request = { headers, signal, redirect: 'error' };
  const admitted = await fetchImpl(`${base}/runs`, {
    ...request, method: 'POST', body: JSON.stringify({ input, model: 'hermes-agent' }),
  });
  if (admitted.status !== 202) throw new Error(`Hermes run returned HTTP ${admitted.status}`);
  const id = (await admitted.json()).run_id;
  if (typeof id !== 'string' || !/^run_[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('Hermes returned invalid run ID');
  const stream = await fetchImpl(`${base}/runs/${id}/events`, request);
  if (!stream.ok || !stream.body) throw new Error(`Hermes event stream returned HTTP ${stream.status}`);
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  const tools = [];
  let completed = false;
  let buffer = '';
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 1024 * 1024) throw new Error('Hermes event stream exceeded limit');
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n');
        if (!data) continue;
        let event;
        try { event = JSON.parse(data); } catch { throw new Error('Hermes returned invalid event'); }
        if (event.event === 'approval.request') throw new Error('Hermes run requires approval; action was stopped');
        if (event.event === 'tool.started' && typeof event.tool === 'string') tools.push({ name: event.tool, status: 'running' });
        if (event.event === 'tool.completed' && typeof event.tool === 'string') {
          const tool = tools.findLast(item => item.name === event.tool && item.status === 'running');
          if (tool) tool.status = event.error ? 'failed' : 'completed';
        }
        if (event.event === 'run.completed') {
          if (typeof event.output !== 'string') throw new Error('Hermes returned empty reply');
          completed = true;
          return { reply: event.output, tools, model: event.runtime?.model || '' };
        }
        if (event.event === 'run.failed' || event.event === 'run.cancelled' || event.event === 'run.interrupted') throw new Error('Hermes run failed');
      }
    }
    throw new Error('Hermes run ended without reply');
  } finally {
    await reader.cancel().catch(() => {});
    if (!completed) await fetchImpl(`${base}/runs/${id}/stop`, { ...request, method: 'POST', signal: AbortSignal.timeout(5000) }).catch(() => {});
  }
}
