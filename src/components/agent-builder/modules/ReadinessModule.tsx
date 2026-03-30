import { useMemo } from 'react';
import { SectionTitle, ProgressBar } from '../ui';
import { NexusRadarChart } from '../ui/NexusRadarChart';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { LIFECYCLE_STAGES } from '@/data/agentBuilderData';
import type { ReadinessScore, ReadinessItem } from '@/types/agentTypes';

function computeReadiness(agent: ReturnType<typeof useAgentBuilderStore.getState>['agent']): ReadinessScore {
  const categories: ReadinessScore['categories'] = {};
  const blockers: string[] = [];
  const recommendations: string[] = [];

  // Identity (max 10)
  const identityItems: ReadinessItem[] = [
    { label: 'Nome definido', passed: !!agent.name, weight: 3, is_blocker: false },
    { label: 'Missão definida', passed: !!agent.mission, weight: 3, is_blocker: false },
    { label: 'Persona selecionada', passed: !!agent.persona, weight: 2, is_blocker: false },
    { label: 'Escopo definido (>50 chars)', passed: agent.scope.length > 50, weight: 2, is_blocker: false },
  ];
  categories.identity = { score: identityItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 10, items: identityItems };
  if (!agent.name) recommendations.push('💡 Defina um nome para o agente');
  if (agent.scope.length <= 50) recommendations.push('💡 Detalhe o escopo do agente (>50 chars) para +2 pontos');

  // Brain (max 12)
  const brainItems: ReadinessItem[] = [
    { label: 'Modelo selecionado', passed: !!agent.model, weight: 5, is_blocker: false },
    { label: 'Fallback configurado', passed: !!agent.model_fallback, weight: 3, is_blocker: false },
    { label: 'Raciocínio definido', passed: !!agent.reasoning, weight: 4, is_blocker: false },
  ];
  categories.brain = { score: brainItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 12, items: brainItems };
  if (!agent.model_fallback) recommendations.push('💡 Configurar modelo fallback aumentaria +3 pontos');

  // Memory (max 12)
  const longTermCount = [agent.memory_episodic, agent.memory_semantic, agent.memory_procedural, agent.memory_profile, agent.memory_shared].filter(Boolean).length;
  const memoryItems: ReadinessItem[] = [
    { label: 'Short-term ativo', passed: agent.memory_short_term, weight: 3, is_blocker: false },
    { label: '≥2 memórias de longo prazo', passed: longTermCount >= 2, weight: 4, is_blocker: false },
    { label: 'Governança configurada', passed: longTermCount > 0, weight: 3, is_blocker: false },
    { label: 'Consolidação definida', passed: !!agent.memory_consolidation, weight: 2, is_blocker: false },
  ];
  categories.memory = { score: memoryItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 12, items: memoryItems };
  if (longTermCount < 2) recommendations.push('💡 Ativar memória episódica ou semântica aumentaria o score em +4');

  // RAG (max 12)
  const ragItems: ReadinessItem[] = [
    { label: 'Arquitetura selecionada', passed: !!agent.rag_architecture, weight: 3, is_blocker: false },
    { label: 'Vector DB selecionado', passed: !!agent.rag_vector_db, weight: 3, is_blocker: false },
    { label: '≥1 fonte de conhecimento', passed: agent.rag_sources.length > 0, weight: 3, is_blocker: false },
    { label: 'Reranker ativo', passed: agent.rag_reranker, weight: 1, is_blocker: false },
    { label: 'Hybrid search ativo', passed: agent.rag_hybrid_search, weight: 2, is_blocker: false },
  ];
  categories.rag = { score: ragItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 12, items: ragItems };

  // Tools (max 8)
  const activeTools = agent.tools.filter(t => t.enabled);
  const toolsItems: ReadinessItem[] = [
    { label: '≥3 ferramentas ativas', passed: activeTools.length >= 3, weight: 3, is_blocker: false },
    { label: 'Governança configurada', passed: activeTools.length > 0, weight: 3, is_blocker: false },
    { label: 'MCP server configurado', passed: agent.mcp_servers.length > 0, weight: 2, is_blocker: false },
  ];
  categories.tools = { score: toolsItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 8, items: toolsItems };

  // Prompt (max 15)
  const promptItems: ReadinessItem[] = [
    { label: 'System prompt >200 chars', passed: agent.system_prompt.length > 200, weight: 5, is_blocker: false },
    { label: '≥2 técnicas de prompt', passed: agent.prompt_techniques.filter(t => t.enabled).length >= 2, weight: 3, is_blocker: false },
    { label: '≥2 few-shot examples', passed: agent.few_shot_examples.length >= 2, weight: 4, is_blocker: false },
    { label: 'Output format definido', passed: !!agent.output_format, weight: 3, is_blocker: false },
  ];
  categories.prompt = { score: promptItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 15, items: promptItems };
  if (agent.system_prompt.length <= 200) recommendations.push('💡 Expandir o system prompt (>200 chars) para +5 pontos');

  // Guardrails (max 15)
  const hasPI = agent.guardrails.some(g => g.name.toLowerCase().includes('injection') && g.enabled);
  const hasPII = agent.guardrails.some(g => g.name.toLowerCase().includes('pii') && g.enabled);
  const activeGuardrails = agent.guardrails.filter(g => g.enabled).length;
  const guardrailItems: ReadinessItem[] = [
    { label: 'Prompt injection ativo', passed: hasPI, weight: 5, is_blocker: true, fix_hint: 'Ative o guardrail Prompt Injection Detection na aba Guardrails' },
    { label: '≥5 guardrails ativos', passed: activeGuardrails >= 5, weight: 4, is_blocker: false },
    { label: 'PII redaction ativo', passed: hasPII, weight: 3, is_blocker: false },
    { label: 'Audit trail ativo', passed: true, weight: 3, is_blocker: false },
  ];
  categories.guardrails = { score: guardrailItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 15, items: guardrailItems };
  if (!hasPI) blockers.push('⛔ Prompt Injection Detection não está ativo');

  // Testing (max 10)
  const testItems: ReadinessItem[] = [
    { label: '≥3 cenários de teste', passed: agent.test_cases.length >= 3, weight: 4, is_blocker: true, fix_hint: 'Crie cenários de teste na aba Avaliação & Testes' },
    { label: '≥1 bateria executada', passed: !!agent.last_test_results, weight: 3, is_blocker: false },
    { label: 'Accuracy >80%', passed: (agent.last_test_results?.accuracy ?? 0) > 80, weight: 3, is_blocker: false },
  ];
  categories.testing = { score: testItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 10, items: testItems };
  if (agent.test_cases.length < 3) blockers.push('⛔ Nenhum cenário de teste criado (mínimo 3)');

  // Observability (max 6)
  const obsItems: ReadinessItem[] = [
    { label: 'Logging ativo', passed: agent.logging_enabled, weight: 3, is_blocker: true, fix_hint: 'Ative logging na aba Traces & Observabilidade' },
    { label: 'Alerting ativo', passed: agent.alerting_enabled, weight: 3, is_blocker: false },
  ];
  categories.observability = { score: obsItems.filter(i => i.passed).reduce((s, i) => s + i.weight, 0), max: 6, items: obsItems };
  if (!agent.logging_enabled) blockers.push('⛔ Logging não está habilitado');

  const total = Object.values(categories).reduce((s, c) => s + c.score, 0);
  const maxTotal = Object.values(categories).reduce((s, c) => s + c.max, 0);
  const pct = Math.round((total / maxTotal) * 100);

  let maturity_level: ReadinessScore['maturity_level'] = 'prototype';
  if (pct >= 80) maturity_level = 'production_ready';
  else if (pct >= 60) maturity_level = 'staging';
  else if (pct >= 40) maturity_level = 'tested';

  return { total: pct, categories, blockers, recommendations, maturity_level };
}

const MATURITY_COLORS: Record<string, string> = {
  prototype: 'hsl(var(--nexus-red))',
  tested: 'hsl(var(--nexus-orange))',
  staging: 'hsl(var(--nexus-yellow))',
  production_ready: 'hsl(var(--nexus-green))',
};

const MATURITY_LABELS: Record<string, string> = {
  prototype: 'Prototype',
  tested: 'Tested',
  staging: 'Staging',
  production_ready: 'Production Ready',
};

export function ReadinessModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const readiness = useMemo(() => computeReadiness(agent), [agent]);

  const radarData = Object.entries(readiness.categories).map(([key, cat]) => ({
    subject: key.charAt(0).toUpperCase() + key.slice(1),
    value: Math.round((cat.score / cat.max) * 100),
    fullMark: 100,
  }));

  return (
    <div className="space-y-8">
      <SectionTitle icon="🏆" title="Score de Prontidão" subtitle="Avaliação completa de produção e maturidade" />

      {/* Score Central */}
      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-border bg-card min-w-[200px]">
          <span
            className="text-6xl font-bold"
            style={{ color: MATURITY_COLORS[readiness.maturity_level] }}
          >
            {readiness.total}
          </span>
          <span className="text-sm text-muted-foreground mt-1">/ 100</span>
          <span
            className="mt-2 px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              background: `${MATURITY_COLORS[readiness.maturity_level]}20`,
              color: MATURITY_COLORS[readiness.maturity_level],
            }}
          >
            {MATURITY_LABELS[readiness.maturity_level]}
          </span>
        </div>
        <div className="flex-1 w-full">
          <NexusRadarChart data={radarData} />
        </div>
      </div>

      {/* Category Breakdown */}
      <SectionTitle icon="📊" title="Score por Categoria" subtitle="Detalhamento do score em cada área" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(readiness.categories).map(([key, cat]) => (
          <div key={key} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold capitalize">{key}</h4>
              <span className="text-sm font-bold text-foreground">{cat.score}/{cat.max}</span>
            </div>
            <ProgressBar value={cat.score} max={cat.max} />
            <div className="space-y-1">
              {cat.items.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <span>{item.passed ? '✅' : '❌'}</span>
                  <span className={item.passed ? 'text-muted-foreground' : 'text-foreground'}>{item.label}</span>
                  {item.is_blocker && !item.passed && (
                    <span className="text-[hsl(var(--nexus-red))] font-semibold">BLOCKER</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Blockers */}
      {readiness.blockers.length > 0 && (
        <>
          <SectionTitle icon="⛔" title="Blockers" subtitle="Itens que impedem deploy em produção" />
          <div className="rounded-xl border border-[hsl(var(--nexus-red))] bg-[hsl(var(--nexus-red))/0.05] p-4 space-y-2">
            {readiness.blockers.map((b, i) => (
              <p key={i} className="text-sm text-[hsl(var(--nexus-red))]">{b}</p>
            ))}
          </div>
        </>
      )}

      {/* Recommendations */}
      {readiness.recommendations.length > 0 && (
        <>
          <SectionTitle icon="💡" title="Recomendações" subtitle="Ações sugeridas para melhorar o score" />
          <div className="rounded-xl border border-[hsl(var(--nexus-yellow))] bg-[hsl(var(--nexus-yellow))/0.05] p-4 space-y-2">
            {readiness.recommendations.map((r, i) => (
              <p key={i} className="text-sm text-[hsl(var(--nexus-yellow))]">{r}</p>
            ))}
          </div>
        </>
      )}

      {/* Lifecycle */}
      <SectionTitle icon="🔄" title="Ciclo de Vida" subtitle="Estágio atual do agente" />
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap gap-2 items-center">
          {LIFECYCLE_STAGES.map((stage, idx) => {
            const isActive = agent.status === stage.id;
            return (
              <div key={stage.id} className="flex items-center gap-1">
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'ring-2 ring-offset-1 ring-offset-background'
                      : 'opacity-50'
                  }`}
                  style={{
                    background: isActive ? `${stage.color}20` : 'transparent',
                    color: stage.color,
                    borderColor: stage.color,
                    border: `1px solid ${isActive ? stage.color : 'hsl(var(--border))'}`,
                    ...(isActive ? { boxShadow: `0 0 12px ${stage.color}30` } : {}),
                  }}
                >
                  {stage.label}
                </div>
                {idx < LIFECYCLE_STAGES.length - 1 && (
                  <span className="text-muted-foreground text-xs">→</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
