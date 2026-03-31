import { lazy, Suspense, useEffect, useCallback } from 'react';
import { AgentBuilderLayout } from '@/components/agent-builder/AgentBuilderLayout';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoSave } from '@/hooks/useAutoSave';

// Lazy load — cada módulo é um chunk separado, carregado só quando a tab é ativada
const IdentityModule = lazy(() => import('@/components/agent-builder/modules/IdentityModule').then(m => ({ default: m.IdentityModule })));
const BrainModule = lazy(() => import('@/components/agent-builder/modules/BrainModule').then(m => ({ default: m.BrainModule })));
const MemoryModule = lazy(() => import('@/components/agent-builder/modules/MemoryModule').then(m => ({ default: m.MemoryModule })));
const RAGModule = lazy(() => import('@/components/agent-builder/modules/RAGModule').then(m => ({ default: m.RAGModule })));
const ToolsModule = lazy(() => import('@/components/agent-builder/modules/ToolsModule').then(m => ({ default: m.ToolsModule })));
const PromptModule = lazy(() => import('@/components/agent-builder/modules/PromptModule').then(m => ({ default: m.PromptModule })));
const OrchestrationModule = lazy(() => import('@/components/agent-builder/modules/OrchestrationModule').then(m => ({ default: m.OrchestrationModule })));
const GuardrailsModule = lazy(() => import('@/components/agent-builder/modules/GuardrailsModule').then(m => ({ default: m.GuardrailsModule })));
const TestingModule = lazy(() => import('@/components/agent-builder/modules/TestingModule').then(m => ({ default: m.TestingModule })));
const ObservabilityModule = lazy(() => import('@/components/agent-builder/modules/ObservabilityModule').then(m => ({ default: m.ObservabilityModule })));
const DeployModule = lazy(() => import('@/components/agent-builder/modules/DeployModule').then(m => ({ default: m.DeployModule })));
const BillingModule = lazy(() => import('@/components/agent-builder/modules/BillingModule').then(m => ({ default: m.BillingModule })));
const ReadinessModule = lazy(() => import('@/components/agent-builder/modules/ReadinessModule').then(m => ({ default: m.ReadinessModule })));
const BlueprintModule = lazy(() => import('@/components/agent-builder/modules/BlueprintModule').then(m => ({ default: m.BlueprintModule })));
const SettingsModule = lazy(() => import('@/components/agent-builder/modules/SettingsModule').then(m => ({ default: m.SettingsModule })));
const TeamModule = lazy(() => import('@/components/agent-builder/modules/TeamModule').then(m => ({ default: m.TeamModule })));
const PlaygroundModule = lazy(() => import('@/components/agent-builder/modules/PlaygroundModule').then(m => ({ default: m.PlaygroundModule })));

function ModuleLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-pulse text-muted-foreground text-sm">Carregando módulo...</div>
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
  guardrails: GuardrailsModule,
  testing: TestingModule,
  observability: ObservabilityModule,
  deploy: DeployModule,
  billing: BillingModule,
  readiness: ReadinessModule,
  blueprint: BlueprintModule,
  settings: SettingsModule,
  team: TeamModule,
  playground: PlaygroundModule,
};

function ActiveModule({ tabId }: { tabId: string }) {
  const Module = MODULE_MAP[tabId];
  if (!Module) return null;
  return (
    <Suspense fallback={<ModuleLoading />}>
      <Module />
    </Suspense>
  );
}

export default function AgentBuilder() {
  const activeTab = useAgentBuilderStore((s) => s.activeTab);
  const isDirty = useAgentBuilderStore((s) => s.isDirty);
  const saveAgent = useAgentBuilderStore((s) => s.saveAgent);
  const setCurrentUserId = useAgentBuilderStore((s) => s.setCurrentUserId);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) setCurrentUserId(user.id);
  }, [user?.id, setCurrentUserId]);

  const stableSave = useCallback(() => saveAgent(), [saveAgent]);
  useAutoSave(isDirty, stableSave, 5000);

  return (
    <AgentBuilderLayout>
      <div key={activeTab} className="animate-fade-in">
        <ActiveModule tabId={activeTab} />
      </div>
    </AgentBuilderLayout>
  );
}
