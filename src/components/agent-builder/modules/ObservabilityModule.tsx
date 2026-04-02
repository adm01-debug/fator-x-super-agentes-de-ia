import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, ToggleField } from '../ui';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import { Activity, Clock, DollarSign, AlertTriangle, CheckCircle, XCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExecutionTrace } from '@/types/agentTypes';
import { useState } from 'react';

const MOCK_TRACES: ExecutionTrace[] = [
  {
    id: 'trace-001', session_id: 'sess-abc', user_input: 'Qual o status do meu pedido #12345?',
    context_retrieved: [{ source: 'orders_db', chunk: 'Pedido #12345 - Status: Enviado', score: 0.95 }],
    memories_used: [{ type: 'profile', content: 'Cliente VIP, preferência por respostas diretas' }],
    prompt_assembled: 'System: Você é um assistente de atendimento...\nUser: Qual o status do meu pedido #12345?',
    llm_response: 'Seu pedido #12345 foi enviado e está a caminho.',
    tool_calls: [{ tool: 'order_lookup', input: { id: '12345' }, output: { status: 'shipped' }, latency_ms: 120, success: true }],
    guardrails_triggered: [], final_output: 'Seu pedido #12345 foi enviado e está a caminho! 📦',
    total_tokens: 450, total_cost: 0.0023, latency_ms: 1200, status: 'success', created_at: '2026-03-30T10:15:00Z',
  },
  {
    id: 'trace-002', session_id: 'sess-def', user_input: 'Me dê dicas de investimento em cripto',
    context_retrieved: [], memories_used: [],
    prompt_assembled: 'System: Você é um assistente...\nUser: Me dê dicas de investimento em cripto',
    llm_response: '', tool_calls: [],
    guardrails_triggered: [{ id: 'blocked_topic', action: 'block', reason: 'Tópico bloqueado: investimentos financeiros' }],
    final_output: 'Desculpe, não posso fornecer orientações sobre investimentos.',
    total_tokens: 80, total_cost: 0.0004, latency_ms: 350, status: 'blocked', created_at: '2026-03-30T10:18:00Z',
  },
  {
    id: 'trace-003', session_id: 'sess-ghi', user_input: 'Gere um relatório completo de vendas Q1',
    context_retrieved: [
      { source: 'sales_db', chunk: 'Vendas Q1: R$ 2.5M total', score: 0.92 },
      { source: 'analytics', chunk: 'Crescimento 15% YoY', score: 0.88 },
    ],
    memories_used: [{ type: 'procedural', content: 'Template: incluir gráficos e comparativo YoY' }],
    prompt_assembled: 'System: Você é um analista de dados...',
    llm_response: 'Relatório de Vendas Q1 2026...',
    tool_calls: [
      { tool: 'sql_query', input: { query: 'SELECT...' }, output: { rows: 150 }, latency_ms: 800, success: true },
      { tool: 'chart_gen', input: { type: 'bar' }, output: { url: '/chart.png' }, latency_ms: 2100, success: true },
    ],
    guardrails_triggered: [], final_output: 'Relatório de Vendas Q1 2026\n\nTotal: R$ 2.5M...',
    total_tokens: 3200, total_cost: 0.016, latency_ms: 4500, status: 'success', created_at: '2026-03-30T09:45:00Z',
  },
  {
    id: 'trace-004', session_id: 'sess-jkl', user_input: 'Atualize o CRM com os dados do cliente',
    context_retrieved: [], memories_used: [],
    prompt_assembled: 'System: ...',
    llm_response: 'Tentando atualizar...',
    tool_calls: [{ tool: 'crm_update', input: { id: 'c-99' }, output: { error: 'timeout' }, latency_ms: 30000, success: false }],
    guardrails_triggered: [], final_output: 'Não foi possível atualizar o CRM. Tente novamente.',
    total_tokens: 200, total_cost: 0.001, latency_ms: 32000, status: 'error', error_details: 'CRM API timeout after 30s',
    created_at: '2026-03-30T09:30:00Z',
  },
];

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  success: { icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Sucesso', className: 'text-green-500 bg-green-500/10' },
  error: { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Erro', className: 'text-destructive bg-destructive/10' },
  blocked: { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Bloqueado', className: 'text-orange-500 bg-orange-500/10' },
  timeout: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Timeout', className: 'text-yellow-500 bg-yellow-500/10' },
};

export function ObservabilityModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const traces = MOCK_TRACES;
  const filtered = statusFilter === 'all' ? traces : traces.filter((t) => t.status === statusFilter);
  const selected = traces.find((t) => t.id === selectedTrace);

  const avgLatency = Math.round(traces.reduce((s, t) => s + t.latency_ms, 0) / traces.length);
  const totalCost = traces.reduce((s, t) => s + t.total_cost, 0);
  const successRate = Math.round((traces.filter((t) => t.status === 'success').length / traces.length) * 100);

  return (
    <div className="space-y-10">
      {/* Config */}
      <section>
        <SectionTitle
          icon="🔭"
          title="Traces & Observabilidade"
          subtitle="Monitore execuções, analise traces e métricas de performance."
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <ToggleField label="Logging Habilitado" checked={agent.logging_enabled} onCheckedChange={(v) => updateAgent({ logging_enabled: v })} />
          <ToggleField label="Alertas Habilitados" checked={agent.alerting_enabled} onCheckedChange={(v) => updateAgent({ alerting_enabled: v })} />
          <ToggleField label="A/B Testing" checked={agent.ab_testing_enabled} onCheckedChange={(v) => updateAgent({ ab_testing_enabled: v })} />
        </div>

        {/* A/B Test Panel - shown when enabled */}
        {agent.ab_testing_enabled && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground">A/B Testing Ativo</p>
            <p className="text-[10px] text-muted-foreground">
              Quando ativado, o sistema pode rotear tráfego entre duas versões de prompt.
              Crie versões no Prompt Editor e configure o split via tabela prompt_ab_tests.
            </p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Variante A: Prompt atual (v{agent.system_prompt_version})</span>
              <span>•</span>
              <span>Split: 50/50</span>
            </div>
          </div>
        )}
      </section>

      {/* KPIs */}
      <section>
        <SectionTitle icon="📊" title="Métricas de Performance" subtitle="Resumo das execuções recentes." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricBox icon={<Activity className="h-4 w-4 text-primary" />} label="Execuções" value={String(traces.length)} />
          <MetricBox icon={<CheckCircle className="h-4 w-4 text-green-500" />} label="Taxa de Sucesso" value={`${successRate}%`} />
          <MetricBox icon={<Clock className="h-4 w-4 text-blue-500" />} label="Latência Média" value={`${avgLatency}ms`} />
          <MetricBox icon={<DollarSign className="h-4 w-4 text-orange-500" />} label="Custo Total" value={`$${totalCost.toFixed(4)}`} />
        </div>
      </section>

      {/* Trace List */}
      <section>
        <SectionTitle
          icon="📜"
          title="Histórico de Execuções"
          subtitle="Clique em uma execução para ver detalhes."
          badge={<NexusBadge color="blue">{filtered.length} traces</NexusBadge>}
        />
        {/* Filters */}
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {['all', 'success', 'error', 'blocked', 'timeout'].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'Todos' : STATUS_CONFIG[s]?.label ?? s}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((trace) => {
            const sc = STATUS_CONFIG[trace.status];
            const time = new Date(trace.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return (
              <button
                key={trace.id}
                onClick={() => setSelectedTrace(selectedTrace === trace.id ? null : trace.id)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition-all ${
                  selectedTrace === trace.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.className}`}>
                      {sc.icon} {sc.label}
                    </span>
                    <p className="text-sm text-foreground truncate">{trace.user_input}</p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground shrink-0 ml-3">
                    <span>{trace.total_tokens} tok</span>
                    <span>{trace.latency_ms}ms</span>
                    <span>${trace.total_cost.toFixed(4)}</span>
                    <span>{time}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Trace Detail */}
      {selected && (
        <section>
          <SectionTitle icon="🔍" title="Detalhes do Trace" subtitle={selected.id} />
          <div className="space-y-3">
            <CollapsibleCard title="📥 Input do Usuário" defaultOpen>
              <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3">{selected.user_input}</p>
            </CollapsibleCard>

            {selected.context_retrieved.length > 0 && (
              <CollapsibleCard title={`📚 Contexto Recuperado (${selected.context_retrieved.length})`}>
                <div className="space-y-2">
                  {selected.context_retrieved.map((ctx, i) => (
                    <div key={i} className="rounded-lg bg-muted/30 p-3">
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Fonte: {ctx.source}</span>
                        <span>Score: {ctx.score.toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-foreground">{ctx.chunk}</p>
                    </div>
                  ))}
                </div>
              </CollapsibleCard>
            )}

            {selected.memories_used.length > 0 && (
              <CollapsibleCard title={`💾 Memórias Utilizadas (${selected.memories_used.length})`}>
                <div className="space-y-2">
                  {selected.memories_used.map((mem, i) => (
                    <div key={i} className="rounded-lg bg-muted/30 p-3">
                      <span className="text-[10px] font-medium text-primary uppercase">{mem.type}</span>
                      <p className="text-sm text-foreground mt-1">{mem.content}</p>
                    </div>
                  ))}
                </div>
              </CollapsibleCard>
            )}

            {selected.tool_calls.length > 0 && (
              <CollapsibleCard title={`🔧 Chamadas de Ferramentas (${selected.tool_calls.length})`}>
                <div className="space-y-2">
                  {selected.tool_calls.map((tc, i) => (
                    <div key={i} className={`rounded-lg p-3 ${tc.success ? 'bg-green-500/5 border border-green-500/20' : 'bg-destructive/5 border border-destructive/20'}`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-foreground">{tc.tool}</span>
                        <span className={tc.success ? 'text-green-500' : 'text-destructive'}>
                          {tc.success ? '✓' : '✗'} {tc.latency_ms}ms
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Input: {JSON.stringify(tc.input)}</p>
                      <p className="text-[11px] text-muted-foreground">Output: {JSON.stringify(tc.output)}</p>
                    </div>
                  ))}
                </div>
              </CollapsibleCard>
            )}

            {selected.guardrails_triggered.length > 0 && (
              <CollapsibleCard title={`🛡️ Guardrails Acionados (${selected.guardrails_triggered.length})`}>
                <div className="space-y-2">
                  {selected.guardrails_triggered.map((gr, i) => (
                    <div key={i} className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{gr.id}</span>
                        <span className="text-orange-500 uppercase text-[10px]">{gr.action}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{gr.reason}</p>
                    </div>
                  ))}
                </div>
              </CollapsibleCard>
            )}

            <CollapsibleCard title="📤 Output Final">
              <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{selected.final_output}</p>
            </CollapsibleCard>

            {selected.error_details && (
              <CollapsibleCard title="❌ Detalhes do Erro">
                <p className="text-sm text-destructive bg-destructive/5 rounded-lg p-3">{selected.error_details}</p>
              </CollapsibleCard>
            )}

            {/* Summary bar */}
            <div className="flex items-center gap-4 rounded-lg bg-muted/20 border border-border p-3 text-xs text-muted-foreground">
              <span>Tokens: <strong className="text-foreground">{selected.total_tokens}</strong></span>
              <span>Custo: <strong className="text-foreground">${selected.total_cost.toFixed(4)}</strong></span>
              <span>Latência: <strong className="text-foreground">{selected.latency_ms}ms</strong></span>
              <span>Status: <strong className="text-foreground">{STATUS_CONFIG[selected.status].label}</strong></span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function MetricBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
