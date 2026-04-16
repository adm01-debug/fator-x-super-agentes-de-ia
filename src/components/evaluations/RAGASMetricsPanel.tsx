/**
 * RAGASMetricsPanel — Shows RAGAS evaluation metrics for RAG quality.
 * Uses evalEngineService for running evaluations.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Input removed — unused
import { Textarea } from '@/components/ui/textarea';
import { FlaskConical, Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { runRAGASEvaluation, type RAGASResult, type EvalTestCase } from '@/services/evalEngineService';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const METRIC_META: Record<string, { label: string; description: string; color: string }> = {
  faithfulness: { label: 'Factualidade', description: 'Resposta baseada nos contextos?', color: 'text-nexus-blue' },
  answer_relevancy: { label: 'Relevância', description: 'Resposta relevante à pergunta?', color: 'text-nexus-emerald' },
  context_precision: { label: 'Precisão de Contexto', description: 'Contextos relevantes no topo?', color: 'text-nexus-purple' },
  context_recall: { label: 'Recall de Contexto', description: 'Informação necessária coberta?', color: 'text-nexus-amber' },
  answer_correctness: { label: 'Corretude', description: 'Resposta factualmente correta?', color: 'text-primary' },
};

function MetricBar({ value, label, color }: { value: number; label: string; color: string }) {
  const percentage = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="font-medium text-foreground">{label}</span>
        <span className={`font-bold ${color}`}>{percentage}%</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${percentage >= 70 ? 'bg-nexus-emerald' : percentage >= 40 ? 'bg-nexus-amber' : 'bg-destructive'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function RAGASMetricsPanel() {
  const [agentId, setAgentId] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RAGASResult | null>(null);
  const [testInput, setTestInput] = useState('');

  const { data: agents = [] } = useQuery({
    queryKey: ['agents_for_ragas'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, name').order('name');
      return data ?? [];
    },
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces_for_ragas'],
    queryFn: async () => {
      const { data } = await supabase.from('workspaces').select('id');
      return data ?? [];
    },
  });

  const handleRunRAGAS = async () => {
    if (!agentId || !testInput.trim()) {
      toast.error('Selecione um agente e insira ao menos uma pergunta');
      return;
    }
    const wsId = workspaces[0]?.id;
    if (!wsId) { toast.error('Workspace não encontrado'); return; }

    const testCases: EvalTestCase[] = testInput.split('\n').filter(Boolean).map(line => ({
      query: line.trim(),
      answer: '',
      contexts: [],
    }));

    setRunning(true);
    try {
      const res = await runRAGASEvaluation(wsId, agentId, testCases);
      setResult(res.ragas);
      toast.success(`RAGAS concluído: score geral ${(res.ragas.overall_score * 100).toFixed(0)}%`);
    } catch {
      toast.error('Erro ao executar RAGAS. Verifique o edge function eval-engine-v2.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="nexus-card space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-nexus-purple/10 flex items-center justify-center">
          <FlaskConical className="h-4 w-4 text-nexus-purple" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Métricas RAGAS</h3>
          <p className="text-[11px] text-muted-foreground">Avaliação de qualidade RAG (Faithfulness, Relevancy, Precision, Recall)</p>
        </div>
        <Badge variant="outline" className="ml-auto text-[10px]">eval-engine-v2</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground">Agente</label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar agente" /></SelectTrigger>
            <SelectContent>
              {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground">Perguntas de teste (1 por linha)</label>
          <Textarea
            placeholder="Qual o horário de funcionamento?\nComo fazer uma troca?"
            value={testInput}
            onChange={e => setTestInput(e.target.value)}
            className="text-xs min-h-[60px]"
          />
        </div>
      </div>

      <Button size="sm" className="gap-1.5 text-xs" onClick={handleRunRAGAS} disabled={running || !agentId}>
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
        Executar RAGAS
      </Button>

      {result && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className={`text-2xl font-black ${result.overall_score >= 0.7 ? 'text-nexus-emerald' : result.overall_score >= 0.4 ? 'text-nexus-amber' : 'text-destructive'}`}>
              {(result.overall_score * 100).toFixed(0)}%
            </div>
            <div>
              <p className="text-xs font-semibold">Score Geral</p>
              <p className="text-[10px] text-muted-foreground">{result.sample_count} amostra(s) avaliada(s)</p>
            </div>
            {result.overall_score < 0.5 && (
              <Badge variant="destructive" className="text-[10px] gap-1 ml-auto">
                <AlertTriangle className="h-3 w-3" /> Atenção necessária
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            {Object.entries(METRIC_META).map(([key, meta]) => (
              <MetricBar
                key={key}
                value={(result as any)[key] ?? 0}
                label={meta.label}
                color={meta.color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
