'use client';

// Chat-page layout adapted from CopilotKit/OpenIntelligentUI (MIT, Atai Barkai).
// Hermes uses a server-side completion bridge, not the repository's AG-UI agent.
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Bot, Plus, Send } from 'lucide-react';
import { Page } from '@/components/ui/Page';

type ToolActivity = { name: string; status: 'running' | 'completed' | 'failed' };
type Message = { id: string; role: 'user' | 'assistant'; content: string; tools?: ToolActivity[] };
const suggestions = ['Ringkas status proposal terbaru', 'Berapa estimasi biaya proyek terbaru?', 'Daftar klien yang tersedia'];

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages, busy]);
  useEffect(() => () => controller.current?.abort(), []);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    if (content.length > 2000) { setError('Pesan maksimal 2000 karakter.'); return; }
    setError('');
    setInput('');
    setBusy(true);
    const history = messages.slice(-4).map(({ role, content }) => ({ role, content }));
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content }]);
    const next = new AbortController();
    controller.current = next;
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, chat_history: history }), signal: next.signal,
      });
      const result = await response.json();
      if (!response.ok || !result.success || typeof result.reply !== 'string') throw new Error(result.error || 'Hermes tidak merespons.');
      const tools = Array.isArray(result.tools) ? result.tools.filter((tool: ToolActivity) => typeof tool.name === 'string' && ['completed', 'failed'].includes(tool.status)).slice(0, 12) : [];
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: result.reply, tools }]);
    } catch (cause) {
      if (!next.signal.aborted) setError(cause instanceof Error ? cause.message : 'Koneksi Hermes gagal.');
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(input); }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      form.current?.requestSubmit();
    }
  }

  return (
    <Page className="copilot-page">
      <section className="copilot-shell" aria-label="BusDevCore AI Copilot">
        <header className="copilot-header">
          <div className="flex items-center gap-3"><Bot aria-hidden className="size-5 text-brand-fg" /><div><h1 className="text-[17px] font-semibold">BusDevCore AI Copilot</h1><p className="text-[12px] text-fg-3">Hermes busdev_ai · tool aktif · khusus admin</p></div></div>
          <button type="button" className="btn-secondary" disabled={busy || messages.length === 0} onClick={() => { setMessages([]); setError(''); setInput(''); }}><Plus className="size-4" aria-hidden /> Percakapan baru</button>
        </header>
        <div className="copilot-thread" role="log" aria-label="Percakapan" aria-live="polite">
          {messages.length === 0 && <div className="copilot-welcome"><Bot className="mx-auto mb-4 size-8 text-brand-fg" aria-hidden /><h2 className="heading-md">Apa yang ingin kamu ketahui?</h2><p className="mt-2 text-[13px] text-fg-3">Tanyakan data BusDevCore. Jawaban dapat keliru; periksa angka penting.</p><div className="copilot-suggestions">{suggestions.map(s => <button type="button" key={s} className="copilot-suggestion" onClick={() => void send(s)} disabled={busy}>{s}</button>)}</div></div>}
          {messages.map(m => <div key={m.id} className={`copilot-message ${m.role === 'user' ? 'copilot-message-user' : ''}`}><span className="block mb-2 text-[11px] font-semibold text-fg-3">{m.role === 'user' ? 'Anda' : 'Hermes'}</span><p className="whitespace-pre-wrap break-words">{m.content}</p>{m.tools?.map((tool, index) => <span key={`${tool.name}-${index}`} className="status-chip mr-2 mt-2">{tool.name} · {tool.status === 'completed' ? 'selesai' : 'gagal'}</span>)}</div>)}
          {busy && <p className="text-[13px] text-fg-3" role="status">Hermes sedang menjawab…</p>}
          <div ref={end} />
        </div>
        <div className="copilot-compose"><form ref={form} onSubmit={submit} className="copilot-form"><label htmlFor="copilot-input" className="sr-only">Pesan untuk AI Copilot</label><textarea id="copilot-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} maxLength={2000} rows={2} placeholder="Tanya tentang proyek, costing, atau proposal…" disabled={busy} /><button type="submit" className="btn-primary btn-icon" aria-label="Kirim pesan" disabled={busy || !input.trim()}><Send className="size-4" aria-hidden /></button></form>{error && <p role="alert" className="mt-2 text-[12px] text-bad">{error}</p>}<p className="mt-2 text-center text-[11px] text-fg-3">Data tersedia sesuai konteks sistem. Hermes memiliki akses tool serta kredensial produksi. Periksa tindakan dan angka penting.</p></div>
      </section>
    </Page>
  );
}
