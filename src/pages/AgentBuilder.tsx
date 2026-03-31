import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AgentBuilderLayout } from '@/components/agent-builder/AgentBuilderLayout';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { IdentityModule } from '@/components/agent-builder/modules/IdentityModule';
import { BrainModule } from '@/components/agent-builder/modules/BrainModule';
import { MemoryModule } from '@/components/agent-builder/modules/MemoryModule';
import { RAGModule } from '@/components/agent-builder/modules/RAGModule';
import { ToolsModule } from '@/components/agent-builder/modules/ToolsModule';
import { PromptModule } from '@/components/agent-builder/modules/PromptModule';
import { OrchestrationModule } from '@/components/agent-builder/modules/OrchestrationModule';
import { GuardrailsModule } from '@/components/agent-builder/modules/GuardrailsModule';
import { TestingModule } from '@/components/agent-builder/modules/TestingModule';
import { ObservabilityModule } from '@/components/agent-builder/modules/ObservabilityModule';
import { DeployModule } from '@/components/agent-builder/modules/DeployModule';
import { BillingModule } from '@/components/agent-builder/modules/BillingModule';
import { ReadinessModule } from '@/components/agent-builder/modules/ReadinessModule';
import { BlueprintModule } from '@/components/agent-builder/modules/BlueprintModule';
import { SettingsModule } from '@/components/agent-builder/modules/SettingsModule';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

function ActiveModule({ tabId }: { tabId: string }) {
  switch (tabId) {
    case 'identity': return <IdentityModule />;
    case 'brain': return <BrainModule />;
    case 'memory': return <MemoryModule />;
    case 'rag': return <RAGModule />;
    case 'tools': return <ToolsModule />;
    case 'prompt': return <PromptModule />;
    case 'orchestration': return <OrchestrationModule />;
    case 'guardrails': return <GuardrailsModule />;
    case 'testing': return <TestingModule />;
    case 'observability': return <ObservabilityModule />;
    case 'deploy': return <DeployModule />;
    case 'billing': return <BillingModule />;
    case 'readiness': return <ReadinessModule />;
    case 'blueprint': return <BlueprintModule />;
    case 'settings': return <SettingsModule />;
    default: return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Módulo: {tabId}</h2>
        <p className="text-sm text-muted-foreground">Este módulo será implementado nas próximas etapas.</p>
      </div>
    );
  }
}

export default function AgentBuilder() {
  const { id } = useParams();
  const activeTab = useAgentBuilderStore((s) => s.activeTab);
  const isLoading = useAgentBuilderStore((s) => s.isLoading);
  const loadAgentFromDB = useAgentBuilderStore((s) => s.loadAgentFromDB);
  const resetAgent = useAgentBuilderStore((s) => s.resetAgent);

  useEffect(() => {
    if (id) {
      loadAgentFromDB(id);
    } else {
      resetAgent();
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AgentBuilderLayout>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <ActiveModule tabId={activeTab} />
        </motion.div>
      </AnimatePresence>
    </AgentBuilderLayout>
  );
}
