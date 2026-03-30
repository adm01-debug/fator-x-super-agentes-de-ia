import { AgentBuilderLayout } from '@/components/agent-builder/AgentBuilderLayout';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';

// Placeholder modules — will be replaced in Etapas 05-18
function PlaceholderModule({ tabId }: { tabId: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl mb-4">🚧</div>
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Módulo: {tabId}
      </h2>
      <p className="text-sm text-muted-foreground">
        Este módulo será implementado nas próximas etapas.
      </p>
    </div>
  );
}

export default function AgentBuilder() {
  const activeTab = useAgentBuilderStore((s) => s.activeTab);

  return (
    <AgentBuilderLayout>
      <PlaceholderModule tabId={activeTab} />
    </AgentBuilderLayout>
  );
}
