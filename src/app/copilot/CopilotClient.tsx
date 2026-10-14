'use client';

// Chat-page layout adapted from CopilotKit/OpenIntelligentUI (MIT, Atai Barkai).
// The page talks to the BusDevCore AG-UI runtime at /api/copilotkit, which is
// backed by the Hermes `busdev_ai` agent. Generative UI (sandboxed charts and
// dashboards) is drawn by CopilotKit's built-in open-generative-UI renderer;
// Hermes credentials stay server-side inside the runtime.
import '@copilotkit/react-core/v2/styles.css';
import {
  CopilotKit,
  CopilotChat,
  CopilotChatConfigurationProvider,
  useAgent,
} from '@copilotkit/react-core/v2';
import { Bot, Plus } from 'lucide-react';
import { Page } from '@/components/ui/Page';

const labels = {
  welcomeMessageText: 'Apa yang ingin kamu ketahui?',
  chatInputPlaceholder: 'Tanya tentang proyek, costing, atau proposal…',
  chatDisclaimerText:
    'Data tersedia sesuai konteks sistem. Hermes memiliki akses tool serta kredensial produksi. Periksa tindakan dan angka penting.',
};

function CopilotHeader() {
  const { agent } = useAgent();
  return (
    <header className="copilot-header">
      <div className="flex items-center gap-3">
        <Bot aria-hidden className="size-5 text-brand-fg" />
        <div>
          <h1 className="text-[17px] font-semibold">BusDevCore AI Copilot</h1>
          <p className="text-[12px] text-fg-3">Hermes busdev_ai · tool aktif · khusus admin</p>
        </div>
      </div>
      <button
        type="button"
        className="btn-secondary"
        disabled={agent.isRunning || agent.messages.length === 0}
        onClick={() => agent.setMessages([])}
      >
        <Plus className="size-4" aria-hidden /> Percakapan baru
      </button>
    </header>
  );
}

export function CopilotClient() {
  return (
    <Page className="copilot-page">
      <section className="copilot-shell" aria-label="BusDevCore AI Copilot">
        <CopilotKit runtimeUrl="/api/copilotkit" showDevConsole={false}>
          <CopilotChatConfigurationProvider labels={labels}>
            <CopilotHeader />
            <div className="copilot-chat">
              <CopilotChat agentId="default" />
            </div>
          </CopilotChatConfigurationProvider>
        </CopilotKit>
      </section>
    </Page>
  );
}
