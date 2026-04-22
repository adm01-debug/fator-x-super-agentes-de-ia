import { useEffect, Suspense, lazy } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { TABS } from '@/data/agentBuilderData';
import { AgentBuilderLayout } from '@/components/agent-builder/AgentBuilderLayout';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy-load modules for better code splitting
const IdentityModule = lazy(() => import('@/components/agent-builder/modules/IdentityModule').then(m => ({ default: m.IdentityModule })));
const BrainModule = lazy(() => import('@/components/agent-builder/modules/BrainModule').then(m => ({ default: m.BrainModule })));
const MemoryModule = lazy(() => import('@/components/agent-builder/modules/MemoryModule').then(m => ({ default: m.MemoryModule })));
const RAGModule = lazy(() => import('@/components/agent-builder/modules/RAGModule').then(m => ({ default: m.RAGModule })));
const ToolsModule = lazy(() => import('@/components/agent-builder/modules/ToolsModule').then(m => ({ default: m.ToolsModule })));
const PromptModule = lazy(() => import('@/components/agent-builder/modules/PromptModule').then(m => ({ default: m.PromptModule })));
const OrchestrationModule = lazy(() => import('@/components/agent-builder/modules/OrchestrationModule').then(m => ({ default: m.OrchestrationModule })));
const OrchestratorModule = lazy(() => import('@/components/agent-builder/modules/OrchestratorModule').then(m => ({ default: m.OrchestratorModule })));
const GuardrailsModule = lazy(() => import('@/components/agent-builder/modules/GuardrailsModule').then(m => ({ default: m.GuardrailsModule })));
const TestingModule = lazy(() => import('@/components/agent-builder/modules/TestingModule').then(m => ({ default: m.TestingModule })));
const EvalsModule = lazy(() => import('@/components/agent-builder/modules/EvalsModule').then(m => ({ default: m.EvalsModule })));
const ExperimentsModule = lazy(() => import('@/components/agent-builder/modules/ExperimentsModule').then(m => ({ default: m.ExperimentsModule })));
const ObservabilityModule = lazy(() => import('@/components/agent-builder/modules/ObservabilityModule').then(m => ({ default: m.ObservabilityModule })));
const DeployModule = lazy(() => import('@/components/agent-builder/modules/DeployModule').then(m => ({ default: m.DeployModule })));
const BillingModule = lazy(() => import('@/components/agent-builder/modules/BillingModule').then(m => ({ default: m.BillingModule })));
const ReadinessModule = lazy(() => import('@/components/agent-builder/modules/ReadinessModule').then(m => ({ default: m.ReadinessModule })));
const BlueprintModule = lazy(() => import('@/components/agent-builder/modules/BlueprintModule').then(m => ({ default: m.BlueprintModule })));
const SettingsModule = lazy(() => import('@/components/agent-builder/modules/SettingsModule').then(m => ({ default: m.SettingsModule })));

function ModuleSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

const MODULE_MAP: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  identity: IdentityModule,
  brain: BrainModule,
  memory: MemoryModule,
  rag: RAGModule,
  tools: ToolsModule,
  prompt: PromptModule,
  orchestration: OrchestrationModule,
  orchestrator: OrchestratorModule,
  guardrails: GuardrailsModule,
  testing: TestingModule,
  evals: EvalsModule,
  experiments: ExperimentsModule,
  observability: ObservabilityModule,
  deploy: DeployModule,
  billing: BillingModule,
  readiness: ReadinessModule,
  blueprint: BlueprintModule,
  settings: SettingsModule,
};

function ActiveModule({ tabId }: { tabId: string }) {
  const LazyModule = MODULE_MAP[tabId];
  if (LazyModule) return <LazyModule />;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl mb-4">🚧</div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Módulo: {tabId}</h2>
      <p className="text-sm text-muted-foreground">Este módulo será implementado nas próximas etapas.</p>
    </div>
  );
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
      <div key={activeTab} className="animate-page-enter">
        <Suspense fallback={<ModuleSkeleton />}>
          <ActiveModule tabId={activeTab} />
        </Suspense>
      </div>
    </AgentBuilderLayout>
  );
}
