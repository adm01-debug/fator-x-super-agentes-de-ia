import { AgentBuilderLayout } from '@/components/agent-builder/AgentBuilderLayout';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { IdentityModule } from '@/components/agent-builder/modules/IdentityModule';
import { BrainModule } from '@/components/agent-builder/modules/BrainModule';
import { MemoryModule } from '@/components/agent-builder/modules/MemoryModule';
import { RAGModule } from '@/components/agent-builder/modules/RAGModule';
import { ToolsModule } from '@/components/agent-builder/modules/ToolsModule';
import { PromptModule } from '@/components/agent-builder/modules/PromptModule';
import { OrchestrationModule } from '@/components/agent-builder/modules/OrchestrationModule';

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

function ActiveModule({ tabId }: { tabId: string }) {
  switch (tabId) {
    case 'identity': return <IdentityModule />;
    case 'brain': return <BrainModule />;
    case 'memory': return <MemoryModule />;
    case 'rag': return <RAGModule />;
    case 'tools': return <ToolsModule />;
    case 'prompt': return <PromptModule />;
    case 'orchestration': return <OrchestrationModule />;
    default: return <PlaceholderModule tabId={tabId} />;
  }
}

export default function AgentBuilder() {
  const activeTab = useAgentBuilderStore((s) => s.activeTab);

  return (
    <AgentBuilderLayout>
      <ActiveModule tabId={activeTab} />
    </AgentBuilderLayout>
  );
}
