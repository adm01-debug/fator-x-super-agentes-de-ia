import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, ToggleField } from '../ui';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import { Activity, Clock, DollarSign, AlertTriangle, CheckCircle, XCircle, Filter, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ExecutionTrace } from '@/types/agentTypes';
import { useState } from 'react';
import { useTracesData } from '@/hooks/useTracesData';

// Real data from Supabase via useTracesData hook — no more mocks!

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  success: { icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Sucesso', className: 'text-nexus-emerald bg-nexus-emerald/10' },
  error: { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Erro', className: 'text-destructive bg-destructive/10' },
  blocked: { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Bloqueado', className: 'text-nexus-orange bg-nexus-orange/10' },
  timeout: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Timeout', className: 'text-nexus-amber bg-nexus-amber/10' },
};

export function ObservabilityModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const tracesData = useTracesData(agent.id);
  const traces = tracesData.traces as unknown as ExecutionTrace[];
  const filtered = statusFilter === 'all' ? traces : traces.filter((t) => t.status === statusFilter);
  const selected = traces.find((t) => t.id === selectedTrace);

  const avgLatency = tracesData.avgLatency;
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
          <AbTestPanel agentId={agent.id as string} currentVersion={agent.system_prompt_version} />
        )}
      </section>

      {/* KPIs */}
      <section>
        <SectionTitle icon="📊" title="Métricas de Performance" subtitle="Resumo das execuções recentes." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricBox icon={<Activity className="h-4 w-4 text-primary" />} label="Execuções" value={String(traces.length)} />
          <MetricBox icon={<CheckCircle className="h-4 w-4 text-nexus-emerald" />} label="Taxa de Sucesso" value={`${successRate}%`} />
          <MetricBox icon={<Clock className="h-4 w-4 text-primary" />} label="Latência Média" value={`${avgLatency}ms`} />
          <MetricBox icon={<DollarSign className="h-4 w-4 text-nexus-orange" />} label="Custo Total" value={`$${totalCost.toFixed(4)}`} />
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
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.className}`}>
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
                      <span className="text-[11px] font-medium text-primary uppercase">{mem.type}</span>
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
                    <div key={i} className={`rounded-lg p-3 ${tc.success ? 'bg-nexus-emerald/5 border border-nexus-emerald/20' : 'bg-destructive/5 border border-destructive/20'}`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-foreground">{tc.tool}</span>
                        <span className={tc.success ? 'text-nexus-emerald' : 'text-destructive'}>
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
                    <div key={i} className="rounded-lg bg-nexus-orange/5 border border-nexus-orange/20 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{gr.id}</span>
                        <span className="text-nexus-orange uppercase text-[11px]">{gr.action}</span>
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
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function AbTestPanel({ agentId }: { agentId: string; currentVersion?: number }) {
  const queryClient = useQueryClient();
  const [testName, setTestName] = useState('');
  const [split, setSplit] = useState('50');
  const [creating, setCreating] = useState(false);

  // Load existing A/B tests
  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['prompt_ab_tests', agentId],
    queryFn: async () => {
      if (!agentId) return [];
      const { data } = await fromTable('prompt_ab_tests').select('*').eq('agent_id', agentId).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!agentId,
  });

  // Load prompt versions for selection
  const { data: versions = [] } = useQuery({
    queryKey: ['prompt_versions_for_ab', agentId],
    queryFn: async () => {
      if (!agentId) return [];
      const { data } = await supabase.from('prompt_versions').select('id, version, change_summary, is_active').eq('agent_id', agentId).order('version', { ascending: false });
      return data ?? [];
    },
    enabled: !!agentId,
  });

  const handleCreate = async () => {
    if (!testName.trim()) { toast.error('Nome é obrigatório'); return; }
    if (versions.length < 2) { toast.error('Precisa de pelo menos 2 versões de prompt'); return; }
    setCreating(true);
    try {
      await fromTable('prompt_ab_tests').insert({
        agent_id: agentId, name: testName.trim(),
        variant_a_prompt_id: versions[0]?.id, variant_b_prompt_id: versions[1]?.id,
        traffic_split: parseFloat(split) / 100, status: 'running',
        started_at: new Date().toISOString(),
      });
      toast.success('Teste A/B criado!');
      setTestName('');
      queryClient.invalidateQueries({ queryKey: ['prompt_ab_tests'] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
    finally { setCreating(false); }
  };

  const handleStop = async (id: string) => {
    await fromTable('prompt_ab_tests').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['prompt_ab_tests'] });
    toast.success('Teste encerrado');
  };

  const handleDelete = async (id: string) => {
    await fromTable('prompt_ab_tests').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['prompt_ab_tests'] });
    toast.success('Teste removido');
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <p className="text-xs font-semibold text-foreground">A/B Testing — Gerenciamento</p>

      {/* Create form */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground">Nome do teste</label>
          <Input value={testName} onChange={e => setTestName(e.target.value)} placeholder="Ex: Teste tom formal vs informal" className="bg-secondary/50 text-xs h-8" />
        </div>
        <div className="w-20">
          <label className="text-[11px] text-muted-foreground">Split A%</label>
          <Input type="number" value={split} onChange={e => setSplit(e.target.value)} min="10" max="90" className="bg-secondary/50 text-xs h-8" />
        </div>
        <Button size="sm" onClick={handleCreate} disabled={creating} className="h-8 text-xs gap-1">
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Criar
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Variante A: v{versions[0]?.version || '?'} ({versions[0]?.change_summary || 'atual'}) •
        Variante B: v{versions[1]?.version || '?'} ({versions[1]?.change_summary || 'anterior'}) •
        {versions.length} versões disponíveis
      </p>

      {/* Existing tests */}
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : tests.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/30">
          {tests.map((t: Record<string, unknown>) => (
            <div key={t.id} className="flex items-center justify-between text-xs py-1">
              <div>
                <span className="font-medium text-foreground">{t.name}</span>
                <span className="text-muted-foreground ml-2">Split: {((t.traffic_split || 0.5) * 100).toFixed(0)}/{(100 - (t.traffic_split || 0.5) * 100).toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={t.status === 'running' ? 'default' : 'outline'} className="text-[11px]">{t.status}</Badge>
                {t.status === 'running' && <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => handleStop(t.id)}>Encerrar</Button>}
                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
