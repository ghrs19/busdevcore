export async function executeHermes(prompt, { env = process.env, fetchImpl = fetch } = {}) {
  const baseUrl = env.HERMES_API_URL?.trim().replace(/\/+$/, '');
  const apiKey = env.HERMES_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('Hermes API is not configured');

  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], stream: false }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Hermes API returned HTTP ${response.status}`);

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Hermes API returned an empty reply');
  return content;
}
