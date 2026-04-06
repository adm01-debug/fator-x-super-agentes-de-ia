import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Play, Trash2, ChevronDown, ChevronRight, Clock, Cpu, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StreamingChat } from '@/components/shared/StreamingChat';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = Record<string, any>;

interface AgentStep { step: number; thought: string; action: string; action_input: string; observation: string; latency_ms?: number; tokens?: number; }
interface AgentResult { answer: string; steps: AgentStep[]; total_steps: number; total_tokens: number; total_cost_usd: number; total_latency_ms: number; }

export default function SmolagentPage() {
  const [task, setTask] = useState('');
  const [model, setModel] = useState('huggingface/Qwen/Qwen3-30B-A3B');
  const [maxSteps, setMaxSteps] = useState(8);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.functions.invoke('smolagent-runtime', { body: { action: 'list_tools' } })
      .then(({ data }) => { if (data?.tools) setTools(data.tools.map((t: AnyData) => t.name)); })
      .catch(() => {});
  }, []);

  const handleRun = async () => {
    if (!task.trim()) { toast.error('Descreva a tarefa'); return; }
    setLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('smolagent-runtime', { body: { action: 'run', task, model, max_steps: maxSteps } });
      if (error) throw error;
      setResult(data as AgentResult);
      toast.success(`Completou em ${data.total_steps} passos`);
    } catch (err: unknown) {
      toast.error('Erro', { description: err instanceof Error ? err.message : 'Erro' });
    } finally { setLoading(false); }
  };

  const toggleStep = (idx: number) => {
    setExpandedSteps(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader title="🤖 Smolagent Runtime" description="Runtime ReAct Agent — Pense, Aja, Observe, Repita" gradient={false} />
      <InfoHint title="O que é o Smolagent?">
        Runtime autônomo baseado no padrão ReAct. Recebe uma tarefa, pensa, executa ferramentas (busca web, edge functions, APIs), observa e repete até a resposta final.
      </InfoHint>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-4">
            <h3 className="font-semibold text-sm">Configuração</h3>
            <div className="space-y-2"><Label>Tarefa</Label><Textarea placeholder="Ex: Pesquise sobre IA generativa e crie um resumo..." value={task} onChange={e => setTask(e.target.value)} rows={5} /></div>
            <div className="space-y-2"><Label>Modelo</Label><Select value={model} onValueChange={setModel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="huggingface/Qwen/Qwen3-30B-A3B">Qwen3 30B (Free)</SelectItem><SelectItem value="huggingface/meta-llama/Llama-4-Scout-17B-16E-Instruct">Llama 4 Scout 17B</SelectItem><SelectItem value="huggingface/mistralai/Mistral-Small-24B-Instruct-2501">Mistral Small 24B</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Max Steps: {maxSteps}</Label><Slider value={[maxSteps]} onValueChange={([v]) => setMaxSteps(v)} min={1} max={20} step={1} /></div>
            <Button onClick={handleRun} disabled={loading} className="w-full">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}{loading ? 'Executando...' : 'Executar'}</Button>
            {result && <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setResult(null)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar</Button>}
          </div>
          {tools.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Tools ({tools.length})</h3>
              <div className="flex flex-wrap gap-1">{tools.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-4" ref={resultRef}>
          {loading && (<div className="flex flex-col items-center justify-center py-20 gap-3"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="text-sm text-muted-foreground animate-pulse">Agente pensando...</p></div>)}
          {result && !loading && (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4"><Label className="text-xs text-primary mb-1 block">Resposta Final</Label><p className="text-sm whitespace-pre-wrap">{result.answer}</p></div>
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg border border-border p-3 text-center"><p className="text-lg font-bold">{result.total_steps}</p><p className="text-[10px] text-muted-foreground">Passos</p></div>
                <div className="rounded-lg border border-border p-3 text-center"><p className="text-lg font-bold">{result.total_tokens?.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Tokens</p></div>
                <div className="rounded-lg border border-border p-3 text-center"><p className="text-lg font-bold">{((result.total_latency_ms || 0) / 1000).toFixed(1)}s</p><p className="text-[10px] text-muted-foreground">Latência</p></div>
                <div className="rounded-lg border border-border p-3 text-center"><p className="text-lg font-bold">${result.total_cost_usd?.toFixed(4)}</p><p className="text-[10px] text-muted-foreground">Custo</p></div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Passos de Execução</Label>
                {result.steps?.map((step, idx) => (
                  <div key={idx} className="rounded-lg border border-border overflow-hidden">
                    <button onClick={() => toggleStep(idx)} className="w-full flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors text-left">
                      <div className="flex items-center gap-2">
                        {expandedSteps.has(idx) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <Badge variant="outline" className="text-[10px]">Step {step.step}</Badge>
                        <span className="text-xs font-medium">{step.action || 'think'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {step.latency_ms && <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{step.latency_ms}ms</span>}
                        {step.tokens && <span className="flex items-center gap-0.5"><Cpu className="h-2.5 w-2.5" />{step.tokens}t</span>}
                      </div>
                    </button>
                    {expandedSteps.has(idx) && (
                      <div className="border-t border-border p-3 bg-muted/20 space-y-2 text-xs">
                        {step.thought && <div><span className="font-semibold text-primary">💭 Thought:</span><pre className="whitespace-pre-wrap mt-1 text-muted-foreground">{step.thought}</pre></div>}
                        {step.action_input && <div><span className="font-semibold text-accent-foreground">⚡ Input:</span><pre className="whitespace-pre-wrap mt-1 text-muted-foreground">{step.action_input}</pre></div>}
                        {step.observation && <div><span className="font-semibold text-secondary-foreground">👁 Observation:</span><pre className="whitespace-pre-wrap mt-1 text-muted-foreground">{step.observation.substring(0, 1000)}</pre></div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {!result && !loading && (<div className="flex flex-col items-center justify-center py-20 text-center"><div className="text-5xl mb-4">🤖</div><h2 className="text-lg font-semibold mb-1">Smolagent Runtime</h2><p className="text-sm text-muted-foreground max-w-md">Descreva uma tarefa e o agente autônomo irá executá-la.</p></div>)}
        </div>
      </div>

      {/* Streaming Chat Mode */}
      <div className="nexus-card p-0 h-[500px]">
        <StreamingChat
          endpoint="/functions/v1/smolagent-runtime"
          placeholder="Converse com o agente autônomo (streaming)..."
          buildBody={(msg) => ({ task: msg, agent_id: 'default', stream: true })}
        />
      </div>
    </div>
  );
}
