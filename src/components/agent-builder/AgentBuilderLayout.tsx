import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { TABS } from '@/data/agentBuilderData';
import { AgentPlayground } from './AgentPlayground';
import { TabNavigation } from './TabNavigation';
import { ReadinessBadge } from './ReadinessBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Save, Plus, Loader2, Check, History } from 'lucide-react';
import { useState } from 'react';
import { VersionDiffDialog } from '@/components/agents/VersionDiffDialog';
import { useAgentVersions } from '@/hooks/useAgentVersions';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  configured: { label: 'Configurado', variant: 'outline' },
  testing: { label: 'Testando', variant: 'outline' },
  staging: { label: 'Staging', variant: 'outline' },
  review: { label: 'Em Revisão', variant: 'outline' },
  production: { label: 'Produção', variant: 'default' },
  monitoring: { label: 'Monitorando', variant: 'default' },
  deprecated: { label: 'Deprecado', variant: 'destructive' },
  archived: { label: 'Arquivado', variant: 'secondary' },
};

interface AgentBuilderLayoutProps {
  children: React.ReactNode;
}

export function AgentBuilderLayout({ children }: AgentBuilderLayoutProps) {
  const { agent, activeTab, isDirty, isSaving, lastSaved, saveAgent, resetAgent, nextTab, prevTab } =
    useAgentBuilderStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { data: versions = [] } = useAgentVersions(agent.id as string | undefined);

  const currentIndex = TABS.findIndex((t) => t.id === activeTab);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === TABS.length - 1;
  const statusInfo = STATUS_LABELS[agent.status] ?? STATUS_LABELS.draft;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ═══ HEADER ═══ */}
      <header
        className="shrink-0 px-5 py-4 flex items-center justify-between border-b"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--nexus-surface-1)) 0%, hsl(var(--background)) 100%)',
          borderColor: 'hsl(var(--nexus-border, var(--border)))',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <h1
            className="text-lg font-bold tracking-tight bg-clip-text text-transparent shrink-0"
            style={{
              backgroundImage: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--nexus-amber)))',
            }}
          >
            ⚡ Fator X
          </h1>
          <span className="text-[11px] text-muted-foreground hidden lg:block">
            Plataforma operacional para agentes de IA
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {agent.name && (
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
              {agent.avatar_emoji} {agent.name}
            </span>
          )}
          <Badge variant={statusInfo.variant} className="text-[11px]">
            {statusInfo.label}
          </Badge>

          <ReadinessBadge />

          {/* Save indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-[80px] justify-end">
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : lastSaved ? (
              <>
                <Check className="h-3 w-3 text-nexus-emerald" />
                <span>Salvo {lastSaved}</span>
              </>
            ) : null}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => saveAgent()}
            disabled={!isDirty || isSaving}
            className={isDirty ? 'animate-pulse border-primary/50' : ''}
            aria-label="Salvar agente"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Salvar</span>
          </Button>

          <Button size="sm" onClick={() => resetAgent()} aria-label="Novo agente">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Novo</span>
          </Button>
        </div>
      </header>

      {/* ═══ TABS ═══ */}
      <TabNavigation />

      {/* ═══ CONTENT ═══ */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1024px] mx-auto px-5 py-6 sm:px-6 sm:py-7">
          {children}
        </div>
      </main>

      {/* ═══ FOOTER NAV ═══ */}
      <footer
        className="shrink-0 sticky bottom-0 px-5 py-3 flex items-center justify-between border-t border-border bg-background"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={prevTab}
          disabled={isFirst}
          aria-label="Tab anterior"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        <span className="text-xs text-muted-foreground font-mono">
          {currentIndex + 1} / {TABS.length}
        </span>

        <Button
          size="sm"
          onClick={nextTab}
          disabled={isLast}
          className="nexus-gradient-bg text-primary-foreground hover:opacity-90"
          aria-label="Próxima tab"
        >
          <span className="hidden sm:inline">Próximo</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </footer>
      <AgentPlayground />
    </div>
  );
}
