import { useState } from 'react';
import { SectionTitle, CodeBlock } from '../ui';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { useAgentVersions } from '@/hooks/useAgentVersions';
import { VersionDiffDialog } from '@/components/agents/VersionDiffDialog';
import { Button } from '@/components/ui/button';
import { GitCompare, History } from 'lucide-react';
import { toast } from 'sonner';

export function BlueprintModule() {
  const { agent, exportJSON, exportMarkdown } = useAgentBuilderStore();
  const [showFormat, setShowFormat] = useState<'json' | 'markdown'>('json');
  const [historyOpen, setHistoryOpen] = useState(false);
  const { data: versions = [] } = useAgentVersions(agent.id as string | undefined);

  const summaryCards = [
    { label: 'Nome', value: `${agent.avatar_emoji} ${agent.name || '(sem nome)'}` },
    { label: 'Modelo', value: agent.model },
    {
      label: 'Memórias Ativas',
      value:
        [
          agent.memory_short_term && 'ST',
          agent.memory_episodic && 'Ep',
          agent.memory_semantic && 'Sem',
          agent.memory_procedural && 'Proc',
          agent.memory_profile && 'Prof',
          agent.memory_shared && 'Org',
        ]
          .filter(Boolean)
          .join(', ') || 'Nenhuma',
    },
    { label: 'Ferramentas', value: `${agent.tools.filter((t) => t.enabled).length} ativas` },
    { label: 'RAG', value: `${agent.rag_architecture} + ${agent.rag_vector_db}` },
    { label: 'Guardrails', value: `${agent.guardrails.filter((g) => g.enabled).length} ativos` },
    { label: 'Orquestração', value: agent.orchestration_pattern },
    { label: 'Deploy', value: agent.deploy_environment },
    { label: 'Status', value: agent.status },
  ];

  const markdown = exportMarkdown();
  const json = exportJSON();

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filename} baixado!`);
  };

  // Readiness checklist (simplified)
  const checks = [
    { label: 'Nome e missão definidos', ok: !!agent.name && !!agent.mission },
    { label: 'System prompt configurado', ok: agent.system_prompt.length > 50 },
    { label: 'Modelo selecionado', ok: !!agent.model },
    { label: 'Ferramentas configuradas', ok: agent.tools.filter((t) => t.enabled).length > 0 },
    { label: 'Guardrails ativos', ok: agent.guardrails.filter((g) => g.enabled).length > 0 },
    { label: 'Cenários de teste criados', ok: agent.test_cases.length > 0 },
    { label: 'Logging habilitado', ok: agent.logging_enabled },
    {
      label: 'Canal de deploy configurado',
      ok: agent.deploy_channels.filter((c) => c.enabled).length > 0,
    },
  ];

  return (
    <div className="space-y-8">
      <SectionTitle
        icon="📋"
        title="Blueprint & Export"
        subtitle="Resumo completo e exportação do agente"
      />

      {/* Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className="text-sm font-semibold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Export */}
      <SectionTitle
        icon="📦"
        title="Exportação"
        subtitle="Exporte a configuração completa do agente"
      />
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setShowFormat('json')}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${
              showFormat === 'json'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            JSON
          </button>
          <button
            onClick={() => setShowFormat('markdown')}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${
              showFormat === 'markdown'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Markdown
          </button>
        </div>

        <div className="max-h-96 overflow-auto">
          <CodeBlock
            code={showFormat === 'json' ? json : markdown}
            language={showFormat === 'json' ? 'json' : 'markdown'}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              handleCopy(showFormat === 'json' ? json : markdown, showFormat.toUpperCase())
            }
            className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80 transition-all"
          >
            📋 Copiar {showFormat.toUpperCase()}
          </button>
          <button
            onClick={() =>
              handleDownload(
                showFormat === 'json' ? json : markdown,
                `${agent.name || 'agent'}.${showFormat === 'json' ? 'json' : 'md'}`,
                showFormat === 'json' ? 'application/json' : 'text/markdown',
              )
            }
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-all"
          >
            💾 Baixar .{showFormat === 'json' ? 'json' : 'md'}
          </button>
        </div>
      </div>

      {/* Readiness Checklist */}
      <SectionTitle
        icon="✅"
        title="Checklist de Prontidão"
        subtitle="Resumo rápido dos itens essenciais"
      />
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-3 text-sm">
            <span className={`text-lg ${check.ok ? '' : 'opacity-50'}`}>
              {check.ok ? '✅' : '❌'}
            </span>
            <span className={check.ok ? 'text-muted-foreground' : 'text-foreground'}>
              {check.label}
            </span>
          </div>
        ))}
        <div className="pt-2 border-t border-border mt-2">
          <p className="text-sm text-muted-foreground">
            {checks.filter((c) => c.ok).length}/{checks.length} itens concluídos
          </p>
        </div>
      </div>

      {/* Versions Timeline */}
      {agent.id && versions.length > 0 && (
        <>
          <SectionTitle
            icon="🕒"
            title="Histórico de Versões"
            subtitle={`${versions.length} versões salvas`}
          />
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <History className="h-4 w-4" />
                Últimas alterações
              </div>
              {versions.length >= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setHistoryOpen(true)}
                  className="gap-1.5 h-7 text-xs"
                >
                  <GitCompare className="h-3 w-3" />
                  Comparar versões
                </Button>
              )}
            </div>
            <div className="space-y-1.5 max-h-64 overflow-auto">
              {versions.slice(0, 10).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded-md hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-semibold text-foreground shrink-0">
                      v{v.version}
                    </span>
                    <span className="text-muted-foreground truncate">{v.model || '—'}</span>
                    {v.change_summary && (
                      <span className="text-muted-foreground truncate">· {v.change_summary}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {new Date(v.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <VersionDiffDialog
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            versions={
              versions as unknown as React.ComponentProps<typeof VersionDiffDialog>['versions']
            }
            agentId={agent.id as string | undefined}
          />
        </>
      )}
    </div>
  );
}
