'use client';

// Chat-page layout adapted from CopilotKit/OpenIntelligentUI (MIT, Atai Barkai).
// Hermes credentials stay server-side inside the runtime.
import '@copilotkit/react-core/v2/styles.css';
import {
  CopilotKit,
  CopilotChat,
  CopilotChatConfigurationProvider,
  useAgent,
} from '@copilotkit/react-core/v2';
import { Bot, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Page } from '@/components/ui/Page';

type Message = ReturnType<typeof useAgent>['agent']['messages'][number];
type Conversation = { thread_id: string; title: string; messages?: Message[] };

const labels = {
  welcomeMessageText: 'Apa yang ingin kamu ketahui?',
  chatInputPlaceholder: 'Tanya tentang proyek, costing, atau proposal…',
  chatDisclaimerText:
    'Percakapan disimpan untuk akun administrator ini. Hermes memiliki akses tool serta kredensial produksi. Periksa tindakan dan angka penting.',
};

function ThreadChat({ threadId, initialMessages, onNew, onSelect, onSaved, conversations }: {
  threadId: string; initialMessages: Message[]; onNew: () => void;
  onSelect: (id: string) => void; onSaved: () => void; conversations: Conversation[];
}) {
  const { agent } = useAgent({ threadId });
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    ready.current = false;
    agent.setMessages(initialMessages);
    ready.current = true;
  }, [agent, initialMessages, threadId]);

  useEffect(() => {
    if (!ready.current || agent.messages.length === 0) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/copilot-conversations', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId, messages: agent.messages }),
        });
        if (!response.ok) throw new Error('save failed');
        setSaveError(false);
        onSaved();
      } catch { setSaveError(true); }
    }, 700);
  }, [agent.messages, threadId, onSaved]);

  return (
    <>
      <header className="copilot-header">
        <div className="flex items-center gap-3">
          <Bot aria-hidden className="size-5 text-brand-fg" />
          <div>
            <h1 className="text-[17px] font-semibold">BusDevCore AI Copilot</h1>
            <p className="text-[12px] text-fg-3">Hermes busdev_ai · khusus admin · {saveError ? 'gagal menyimpan' : 'autosave aktif'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="copilot-thread-select">
            <span className="sr-only">Pilih percakapan</span>
            <select aria-label="Pilih percakapan" value={threadId} onChange={(e) => onSelect(e.target.value)}>
              {conversations.map((c) => <option key={c.thread_id} value={c.thread_id}>{c.title}</option>)}
              {!conversations.some((c) => c.thread_id === threadId) && <option value={threadId}>Percakapan baru</option>}
            </select>
          </label>
          <button type="button" className="btn-secondary" onClick={onNew}>
            <Plus className="size-4" aria-hidden /> Percakapan baru
          </button>
        </div>
      </header>
      <div className="copilot-chat"><CopilotChat agentId="default" /></div>
    </>
  );
}

export function CopilotClient() {
  const [threadId, setThreadId] = useState('');
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadThread = useCallback(async (id: string) => {
    const response = await fetch(`/api/copilot-conversations?threadId=${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error('Percakapan tidak bisa dimuat.');
    const data = await response.json();
    setThreadId(id);
    setInitialMessages(Array.isArray(data.conversation?.messages) ? data.conversation.messages : []);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/copilot-conversations');
        if (!response.ok) throw new Error('Gagal memuat percakapan.');
        const data = await response.json();
        if (!active) return;
        const list: Conversation[] = data.conversations ?? [];
        setConversations(list);
        if (list.length) await loadThread(list[0].thread_id);
        else setThreadId(crypto.randomUUID());
      } catch (error) {
        if (active) { setLoadError(error instanceof Error ? error.message : 'Gagal memuat percakapan.'); setThreadId(crypto.randomUUID()); }
      } finally { if (active) setLoaded(true); }
    })();
    return () => { active = false; };
  }, [loadThread]);

  const refreshList = useCallback(async () => {
    const response = await fetch('/api/copilot-conversations');
    if (response.ok) setConversations((await response.json()).conversations ?? []);
  }, []);
  const newThread = () => { setInitialMessages([]); setThreadId(crypto.randomUUID()); };
  const selectThread = async (id: string) => {
    try { await loadThread(id); setLoadError(''); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Gagal memuat percakapan.'); }
  };

  return (
    <Page className="copilot-page">
      <section className="copilot-shell" aria-label="BusDevCore AI Copilot">
        {loaded && threadId ? (
          <CopilotKit runtimeUrl="/api/copilotkit" showDevConsole={false} key={threadId}>
            <CopilotChatConfigurationProvider labels={labels} threadId={threadId}>
              {loadError && <p role="alert" className="p-2 text-sm text-red-600">{loadError}</p>}
              <ThreadChat key={threadId} threadId={threadId} initialMessages={initialMessages}
                onNew={newThread} onSelect={selectThread} onSaved={refreshList} conversations={conversations} />
            </CopilotChatConfigurationProvider>
          </CopilotKit>
        ) : <p className="p-6">Memuat percakapan…</p>}
      </section>
    </Page>
  );
}
