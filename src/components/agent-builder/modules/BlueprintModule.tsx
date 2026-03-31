import { useState } from 'react';
import { SectionTitle, CodeBlock } from '../ui';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { toast } from 'sonner';

export function BlueprintModule() {
  const { agent, exportJSON, exportMarkdown, getCompleteness } = useAgentBuilderStore();
  const [showFormat, setShowFormat] = useState<'json' | 'markdown'>('json');

  const summaryCards = [
    { label: 'Nome', value: `${agent.avatar_emoji} ${agent.name || '(sem nome)'}` },
    { label: 'Modelo', value: agent.model },
    { label: 'Memórias Ativas', value: [agent.memory_short_term && 'ST', agent.memory_episodic && 'Ep', agent.memory_semantic && 'Sem', agent.memory_procedural && 'Proc', agent.memory_profile && 'Prof', agent.memory_shared && 'Org'].filter(Boolean).join(', ') || 'Nenhuma' },
    { label: 'Ferramentas', value: `${agent.tools.filter(t => t.enabled).length} ativas` },
    { label: 'RAG', value: `${agent.rag_architecture} + ${agent.rag_vector_db}` },
    { label: 'Guardrails', value: `${agent.guardrails.filter(g => g.enabled).length} ativos` },
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

  // Readiness checklist (9 items per spec)
  const checks = [
    { label: 'Nome definido', ok: !!agent.name },
    { label: 'Missão clara', ok: !!agent.mission },
    { label: 'Modelo selecionado', ok: !!agent.model },
    { label: 'Pelo menos 1 tipo de memória ativo', ok: agent.memory_short_term || agent.memory_episodic || agent.memory_semantic },
    { label: 'RAG configurado', ok: !!agent.rag_architecture && !!agent.rag_vector_db },
    { label: 'System prompt escrito (>50 chars)', ok: agent.system_prompt.length > 50 },
    { label: 'Pelo menos 5 guardrails ativos', ok: agent.guardrails.filter(g => g.enabled).length >= 5 },
    { label: 'Pelo menos 3 cenários de teste', ok: agent.test_cases.length >= 3 },
    { label: 'Ambiente de deploy definido', ok: !!agent.deploy_environment },
  ];

  const completeness = getCompleteness();

  return (
    <div className="space-y-8">
      <SectionTitle icon="📋" title="Blueprint & Export" subtitle="Resumo completo e exportação do agente" />

      {/* Barra de Completude */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Completude do Agente</span>
          <span className={`text-lg font-bold font-mono ${completeness >= 80 ? 'text-emerald-400' : completeness >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
            {completeness}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${completeness}%`,
              background: completeness >= 80 ? '#6BCB77' : completeness >= 50 ? '#FFD93D' : '#FF6B6B',
            }}
          />
        </div>
      </div>

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
      <SectionTitle icon="📦" title="Exportação" subtitle="Exporte a configuração completa do agente" />
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setShowFormat('json')}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${
              showFormat === 'json' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            JSON
          </button>
          <button
            onClick={() => setShowFormat('markdown')}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${
              showFormat === 'markdown' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Markdown
          </button>
        </div>

        <div className="max-h-96 overflow-auto">
          <CodeBlock code={showFormat === 'json' ? json : markdown} language={showFormat === 'json' ? 'json' : 'markdown'} />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleCopy(showFormat === 'json' ? json : markdown, showFormat.toUpperCase())}
            className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80 transition-all"
          >
            📋 Copiar {showFormat.toUpperCase()}
          </button>
          <button
            onClick={() =>
              handleDownload(
                showFormat === 'json' ? json : markdown,
                `${agent.name || 'agent'}.${showFormat === 'json' ? 'json' : 'md'}`,
                showFormat === 'json' ? 'application/json' : 'text/markdown'
              )
            }
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-all"
          >
            💾 Baixar .{showFormat === 'json' ? 'json' : 'md'}
          </button>
        </div>
      </div>

      {/* Readiness Checklist */}
      <SectionTitle icon="✅" title="Checklist de Prontidão" subtitle="Resumo rápido dos itens essenciais" />
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-3 text-sm">
            <span className={`text-lg ${check.ok ? '' : 'opacity-50'}`}>{check.ok ? '✅' : '❌'}</span>
            <span className={check.ok ? 'text-muted-foreground' : 'text-foreground'}>{check.label}</span>
          </div>
        ))}
        <div className="pt-2 border-t border-border mt-2">
          <p className="text-sm text-muted-foreground">
            {checks.filter(c => c.ok).length}/{checks.length} itens concluídos
          </p>
        </div>
      </div>
    </div>
  );
}
