// Server wrapper: the Copilot chat is a client-only widget (CopilotKit reads
// random ids at render time), so rendering is deferred behind Suspense instead
// of prerendering the interactive shell.
import { Suspense } from 'react';
import { CopilotClient } from './CopilotClient';

export default function CopilotPage() {
  return (
    <Suspense fallback={<div className="copilot-page" aria-hidden />}>
      <CopilotClient />
    </Suspense>
  );
}
