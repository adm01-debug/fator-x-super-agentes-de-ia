import { useState } from 'react';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { Button } from '@/components/ui/button';
import { Play, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TestCase } from '@/types/agentTypes';

interface TestExecutionPanelProps {
  testCases: TestCase[];
}

export function TestExecutionPanel({ testCases }: TestExecutionPanelProps) {
  const agent = useAgentBuilderStore((s) => s.agent);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<
    Array<{ input: string; expected: string; actual: string; passed: boolean; latency_ms: number }>
  >([]);

  const handleRun = async () => {
    if (!agent.id) { toast.error('Salve o agente antes de testar'); return; }
    if (testCases.length === 0) { toast.error('Adicione test cases primeiro'); return; }
    setRunning(true);
    setResults([]);
    try {
      const config = agent as unknown as Record<string, unknown>;
      const systemPrompt = (config.system_prompt as string) || `You are ${agent.name}. ${agent.mission}`;
      const model = agent.model || 'claude-haiku-4-5-20251001';

      const { data, error } = await supabase.functions.invoke('test-runner', {
        body: {
          agent_id: agent.id,
          test_cases: testCases.map((tc) => ({ input: tc.input, expected_output: tc.expected_behavior || undefined, tags: tc.tags || [] })),
          model,
          system_prompt: systemPrompt,
        },
      });

      if (error) throw error;

      const batchResults = (data?.results ?? []) as Array<{ input: string; expected: string | null; actual: string | null; latency_ms: number; status: string; error?: string }>;
      const mapped = batchResults.map((r) => ({
        input: r.input,
        expected: r.expected ?? '',
        actual: r.actual ?? r.error ?? '',
        passed: r.status === 'success' && (!r.expected || (r.actual ?? '').toLowerCase().includes(r.expected.toLowerCase().substring(0, 100))),
        latency_ms: r.latency_ms,
      }));

      setResults(mapped);
      const passRate = data?.pass_rate ?? Math.round((mapped.filter((r) => r.passed).length / mapped.length) * 100);
      toast.success(`Testes concluídos: ${passRate}% aprovados (${data?.passed ?? 0}/${data?.total ?? mapped.length}) • Latência média: ${data?.avg_latency_ms ?? 0}ms`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
        <Play className="h-8 w-8 text-primary mx-auto mb-3" />
        <p className="text-sm font-semibold text-foreground mb-1">Executar Suite de Testes</p>
        <p className="text-xs text-muted-foreground mb-4">{testCases.length} test cases • Modelo: {agent.model}</p>
        <Button variant="default" size="sm" onClick={handleRun} disabled={running || testCases.length === 0}>
          {running ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executando ({results.length}/{testCases.length})...</>) : (<><Play className="h-4 w-4 mr-2" /> Executar Testes</>)}
        </Button>
      </div>
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Resultados: {results.filter((r) => r.passed).length}/{results.length} aprovados</p>
          {results.map((r, i) => (
            <div key={i} className={`nexus-card text-xs ${r.passed ? 'border-nexus-emerald/30' : 'border-nexus-rose/30'}`}>
              <div className="flex items-center gap-2 mb-1">
                {r.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-nexus-emerald" /> : <XCircle className="h-3.5 w-3.5 text-nexus-rose" />}
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
