import { useState } from 'react';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, InputField, TextAreaField, SelectField } from '../ui';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Play, CheckCircle2, XCircle, Clock, SkipForward, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TestCase, EvalMetric } from '@/types/agentTypes';

const TEST_CATEGORIES = [
  { value: 'functional', label: '✅ Funcional' },
  { value: 'safety', label: '🛡️ Segurança' },
  { value: 'edge_case', label: '⚡ Edge Case' },
  { value: 'regression', label: '🔄 Regressão' },
  { value: 'performance', label: '⏱️ Performance' },
];

const STATUS_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  pending: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Pendente', color: 'text-muted-foreground' },
  passed: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Aprovado', color: 'text-green-500' },
  failed: { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Falhou', color: 'text-red-500' },
  skipped: { icon: <SkipForward className="h-3.5 w-3.5" />, label: 'Pulado', color: 'text-yellow-500' },
};

const DEFAULT_EVAL_METRICS: EvalMetric[] = [
  { id: 'accuracy', name: 'Acurácia', target: 90, unit: '%', weight: 20, is_blocker: true },
  { id: 'relevance', name: 'Relevância', target: 85, unit: '%', weight: 15, is_blocker: true },
  { id: 'latency', name: 'Latência P95', target: 3000, unit: 'ms', weight: 10, is_blocker: false },
  { id: 'safety', name: 'Safety Score', target: 95, unit: '%', weight: 20, is_blocker: true },
  { id: 'hallucination', name: 'Taxa de Alucinação', target: 5, unit: '%', weight: 15, is_blocker: true },
  { id: 'groundedness', name: 'Groundedness', target: 90, unit: '%', weight: 10, is_blocker: false },
  { id: 'cost', name: 'Custo por Interação', target: 0.05, unit: 'USD', weight: 10, is_blocker: false },
];

export function TestingModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);

  const evalMetrics = agent.eval_metrics.length > 0 ? agent.eval_metrics : DEFAULT_EVAL_METRICS;

  const addTestCase = () => {
    const newTest: TestCase = {
      id: crypto.randomUUID(),
      name: '',
      input: '',
      expected_behavior: '',
      category: 'functional',
      tags: [],
      status: 'pending',
    };
    updateAgent({ test_cases: [...agent.test_cases, newTest] });
  };

  const removeTestCase = (id: string) => {
    updateAgent({ test_cases: agent.test_cases.filter((t) => t.id !== id) });
  };

  const updateTestCase = (id: string, partial: Partial<TestCase>) => {
    updateAgent({
      test_cases: agent.test_cases.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    });
  };

  const updateMetric = (id: string, partial: Partial<EvalMetric>) => {
    const updated = evalMetrics.map((m) => (m.id === id ? { ...m, ...partial } : m));
    updateAgent({ eval_metrics: updated });
  };

  const statusCounts = {
    pending: agent.test_cases.filter((t) => t.status === 'pending').length,
    passed: agent.test_cases.filter((t) => t.status === 'passed').length,
    failed: agent.test_cases.filter((t) => t.status === 'failed').length,
    skipped: agent.test_cases.filter((t) => t.status === 'skipped').length,
  };

  return (
    <div className="space-y-10">
      {/* Resumo */}
      <section>
        <SectionTitle
          icon="🧪"
          title="Avaliação & Testes"
          subtitle="Defina casos de teste e métricas para validar o agente."
          badge={<NexusBadge color="blue">{agent.test_cases.length} testes</NexusBadge>}
        />
        {agent.test_cases.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Object.entries(statusCounts).map(([status, count]) => {
              const meta = STATUS_META[status];
              return (
                <div key={status} className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className={`flex justify-center mb-2 ${meta.color}`}>{meta.icon}</div>
                  <p className="text-lg font-bold text-foreground">{count}</p>
                  <p className="text-[10px] text-muted-foreground">{meta.label}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Test Cases */}
      <section>
        <SectionTitle
          icon="📋"
          title="Casos de Teste"
          subtitle="Cenários para validar o comportamento do agente."
        />
        <div className="space-y-3">
          {agent.test_cases.map((tc, idx) => {
            const statusMeta = STATUS_META[tc.status];
            return (
              <CollapsibleCard
                key={tc.id}
                icon="🧪"
                title={tc.name || `Teste ${idx + 1}`}
                subtitle={
                  <span className={`flex items-center gap-1 ${statusMeta.color}`}>
                    {statusMeta.icon} {statusMeta.label}
                    {tc.category && <span className="text-muted-foreground ml-2">· {TEST_CATEGORIES.find((c) => c.value === tc.category)?.label}</span>}
                  </span>
                }
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField
                      label="Nome do Teste"
                      value={tc.name}
                      onChange={(v) => updateTestCase(tc.id, { name: v })}
                      placeholder="Ex: Deve recusar pedido ofensivo"
                    />
                    <SelectField
                      label="Categoria"
                      value={tc.category}
                      onChange={(v) => updateTestCase(tc.id, { category: v as TestCase['category'] })}
                      options={TEST_CATEGORIES}
                    />
                  </div>
                  <TextAreaField
                    label="Input do Teste"
                    value={tc.input}
                    onChange={(v) => updateTestCase(tc.id, { input: v })}
                    placeholder="O que o usuário enviaria..."
                    rows={3}
                  />
                  <TextAreaField
                    label="Comportamento Esperado"
                    value={tc.expected_behavior}
                    onChange={(v) => updateTestCase(tc.id, { expected_behavior: v })}
                    placeholder="O que o agente deveria fazer/responder..."
                    rows={3}
                  />
                  <InputField
                    label="Tags"
                    value={tc.tags.join(', ')}
                    onChange={(v) =>
                      updateTestCase(tc.id, { tags: v.split(',').map((t) => t.trim()).filter(Boolean) })
                    }
                    placeholder="funcional, crítico, edge-case"
                    hint="Separe tags por vírgula."
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <select
                        value={tc.status}
                        onChange={(e) => updateTestCase(tc.id, { status: e.target.value as TestCase['status'] })}
                        className="rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground"
                      >
                        <option value="pending">⏳ Pendente</option>
                        <option value="passed">✅ Aprovado</option>
                        <option value="failed">❌ Falhou</option>
                        <option value="skipped">⏭️ Pulado</option>
                      </select>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeTestCase(tc.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Remover
                    </Button>
                  </div>
                </div>
              </CollapsibleCard>
            );
          })}
          <Button variant="outline" size="sm" onClick={addTestCase} className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-2" /> Adicionar Caso de Teste
          </Button>
        </div>
      </section>

      {/* Métricas de Avaliação */}
      <section>
        <SectionTitle
          icon="📊"
          title="Métricas de Avaliação"
          subtitle="Defina targets para cada métrica de qualidade."
          badge={
            <NexusBadge color="orange">
              {evalMetrics.filter((m) => m.is_blocker).length} blockers
            </NexusBadge>
          }
        />
        <div className="space-y-2">
          {evalMetrics.map((metric) => (
            <div
              key={metric.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{metric.name}</p>
                    {metric.is_blocker && (
                      <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-medium">
                        Blocker
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Target: {metric.target}{metric.unit} · Peso: {metric.weight}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={metric.target}
                  onChange={(e) => updateMetric(metric.id, { target: Number(e.target.value) })}
                  className="w-20 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground text-right"
                />
                <span className="text-xs text-muted-foreground">{metric.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Últimos Resultados */}
      {agent.last_test_results && (
        <section>
          <SectionTitle icon="📈" title="Últimos Resultados" subtitle={`Executado em ${agent.last_test_results.timestamp}`} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Acurácia', value: `${agent.last_test_results.accuracy}%` },
              { label: 'Safety', value: `${agent.last_test_results.safety_score}%` },
              { label: 'Latência P95', value: `${agent.last_test_results.latency_p95}ms` },
              { label: 'Alucinação', value: `${agent.last_test_results.hallucination_rate}%` },
              { label: 'Custo/Interação', value: `$${agent.last_test_results.cost_per_interaction}` },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-lg font-bold text-foreground">{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ação: Executar Testes */}
      <TestExecutionPanel testCases={testCases} />
    </div>
  );
}

function TestExecutionPanel({ testCases }: { testCases: TestCase[] }) {
  const agent = useAgentBuilderStore((s) => s.agent);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Array<{ input: string; expected: string; actual: string; passed: boolean; latency_ms: number }>>([]);

  const handleRun = async () => {
    if (!agent.id) { toast.error('Salve o agente antes de testar'); return; }
    if (testCases.length === 0) { toast.error('Adicione test cases primeiro'); return; }
    setRunning(true); setResults([]);
    try {
      const config = agent as Record<string, any>;
      const systemPrompt = config.system_prompt || `You are ${agent.name}. ${agent.mission}`;
      const model = agent.model || 'claude-sonnet-4.6';
      const newResults: typeof results = [];

      for (const tc of testCases) {
        const start = Date.now();
        const { data, error } = await supabase.functions.invoke('llm-gateway', {
          body: { model, agent_id: agent.id, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: tc.input }], temperature: 0.3, max_tokens: 2000 },
        });
        const actual = data?.content || data?.error || error?.message || '';
        const passed = tc.expected_behavior ? actual.toLowerCase().includes(tc.expected_behavior.toLowerCase().substring(0, 100)) : true;
        newResults.push({ input: tc.input, expected: tc.expected_behavior, actual, passed, latency_ms: Date.now() - start });
        setResults([...newResults]);
      }
      const passRate = newResults.filter(r => r.passed).length / newResults.length;
      toast.success(`Testes concluídos: ${(passRate * 100).toFixed(0)}% aprovados`);
    } catch (e: any) { toast.error(`Erro: ${e.message}`); } finally { setRunning(false); }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
        <Play className="h-8 w-8 text-primary mx-auto mb-3" />
        <p className="text-sm font-semibold text-foreground mb-1">Executar Suite de Testes</p>
        <p className="text-xs text-muted-foreground mb-4">
          {testCases.length} test cases • Modelo: {agent.model}
        </p>
        <Button variant="default" size="sm" onClick={handleRun} disabled={running || testCases.length === 0}>
          {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executando ({results.length}/{testCases.length})...</> : <><Play className="h-4 w-4 mr-2" /> Executar Testes</>}
        </Button>
      </div>
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Resultados: {results.filter(r=>r.passed).length}/{results.length} aprovados</p>
          {results.map((r, i) => (
            <div key={i} className={`nexus-card text-xs ${r.passed ? 'border-green-500/30' : 'border-red-500/30'}`}>
              <div className="flex items-center gap-2 mb-1">
                {r.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                <span className="font-mono text-muted-foreground">{r.latency_ms}ms</span>
              </div>
              <p className="text-foreground"><strong>Input:</strong> {r.input.substring(0, 100)}</p>
              {r.expected && <p className="text-muted-foreground mt-0.5"><strong>Expected:</strong> {r.expected.substring(0, 100)}</p>}
              <p className="text-muted-foreground mt-0.5"><strong>Output:</strong> {r.actual.substring(0, 200)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
