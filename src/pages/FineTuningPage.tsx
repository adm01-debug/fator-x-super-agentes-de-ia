import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Database, Play, Loader2, CheckCircle, RefreshCw, Download, Cpu, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = Record<string, any>;

function useFineTuning() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnyData | null>(null);

  const invoke = async (body: AnyData) => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('hf-autotrain', { body });
      if (error) throw error;
      setResult(data);
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro', { description: msg });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { loading, result, invoke };
}

export default function FineTuningPage() {
  const [activeTab, setActiveTab] = useState('dataset');
  const { loading, result, invoke } = useFineTuning();

  // Dataset config
  const [agentId, setAgentId] = useState('');
  const [source, setSource] = useState<'traces' | 'test_cases' | 'custom'>('traces');
  const [minQuality, setMinQuality] = useState(3);
  const [maxSamples, setMaxSamples] = useState(1000);
  const [taskType, setTaskType] = useState<'text-generation' | 'text-classification' | 'embedding'>('text-generation');

  // Training config
  const [baseModel, setBaseModel] = useState('meta-llama/Llama-3.2-1B');
  const [epochs, setEpochs] = useState(3);
  const [learningRate, setLearningRate] = useState(0.0002);
  const [repoName, setRepoName] = useState('');

  // Job tracking
  const [jobId, setJobId] = useState('');

  const { data: agents = [] } = useQuery({
    queryKey: ['agents_finetune'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, name, avatar_emoji').order('name');
      return data ?? [];
    },
  });

  const handlePrepareDataset = async () => {
    if (!agentId) { toast.error('Selecione um agente'); return; }
    const data = await invoke({
      action: 'prepare_dataset',
      agent_id: agentId,
      dataset_config: { source, min_quality_score: minQuality, max_samples: maxSamples, task_type: taskType },
    });
    if (data) toast.success(`Dataset preparado: ${data.samples_count || 0} amostras`);
  };

  const handleStartTraining = async () => {
    const data = await invoke({
      action: 'start_training',
      training_config: { base_model: baseModel, task: taskType, epochs, learning_rate: learningRate, repo_name: repoName || undefined },
    });
    if (data?.job_id) {
      setJobId(data.job_id);
      toast.success(`Training iniciado! Job ID: ${data.job_id}`);
    }
  };

  const handleCheckStatus = async () => {
    if (!jobId) { toast.error('Informe o Job ID'); return; }
    await invoke({ action: 'check_status', job_id: jobId });
  };

  const handleListModels = async () => {
    await invoke({ action: 'list_models' });
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader title="🧬 Fine-tuning" description="Treine modelos customizados com dados dos seus agentes via HuggingFace AutoTrain" />

      <InfoHint title="Como funciona?">
        O Fine-tuning permite treinar modelos de linguagem usando os dados reais dos seus agentes (traces, test cases). O pipeline: 1) Prepare o dataset → 2) Configure o training → 3) Inicie o job → 4) Acompanhe o progresso. Os modelos são publicados no HuggingFace Hub.
      </InfoHint>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="dataset" className="text-xs gap-1.5"><Database className="h-3.5 w-3.5" /> Dataset</TabsTrigger>
          <TabsTrigger value="train" className="text-xs gap-1.5"><Cpu className="h-3.5 w-3.5" /> Training</TabsTrigger>
          <TabsTrigger value="status" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Status & Modelos</TabsTrigger>
        </TabsList>

        {/* ═══ DATASET TAB ═══ */}
        <TabsContent value="dataset" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4 rounded-lg border border-border p-4">
              <h3 className="font-semibold text-sm">Configurar Dataset</h3>
              <div className="space-y-2">
                <Label>Agente</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
                  <SelectContent>
                    {agents.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.avatar_emoji} {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fonte dos Dados</Label>
                <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="traces">📊 Traces do agente</SelectItem>
                    <SelectItem value="test_cases">🧪 Test Cases</SelectItem>
                    <SelectItem value="custom">📁 Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Task Type</Label>
                <Select value={taskType} onValueChange={(v) => setTaskType(v as typeof taskType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text-generation">Text Generation</SelectItem>
                    <SelectItem value="text-classification">Text Classification</SelectItem>
                    <SelectItem value="embedding">Embedding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Qualidade Mínima: {minQuality}/5</Label>
                <Slider value={[minQuality]} onValueChange={([v]) => setMinQuality(v)} min={0} max={5} step={0.5} />
              </div>
              <div className="space-y-2">
                <Label>Max Amostras: {maxSamples}</Label>
                <Slider value={[maxSamples]} onValueChange={([v]) => setMaxSamples(v)} min={10} max={10000} step={10} />
              </div>
              <Button onClick={handlePrepareDataset} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                Preparar Dataset
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 min-h-[300px]">
              <Label className="text-xs text-muted-foreground">Resultado</Label>
              {loading && <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
              {result && !loading && (
                <pre className="text-xs whitespace-pre-wrap mt-2 bg-background p-3 rounded border max-h-[350px] overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
              {!result && !loading && <p className="text-sm text-muted-foreground text-center mt-16">Configure e prepare o dataset</p>}
            </div>
          </div>
        </TabsContent>

        {/* ═══ TRAINING TAB ═══ */}
        <TabsContent value="train" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4 rounded-lg border border-border p-4">
              <h3 className="font-semibold text-sm">Configurar Training</h3>
              <div className="space-y-2">
                <Label>Base Model</Label>
                <Select value={baseModel} onValueChange={setBaseModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta-llama/Llama-3.2-1B">Llama 3.2 1B</SelectItem>
                    <SelectItem value="meta-llama/Llama-3.2-3B">Llama 3.2 3B</SelectItem>
                    <SelectItem value="Qwen/Qwen2.5-1.5B">Qwen 2.5 1.5B</SelectItem>
                    <SelectItem value="google/gemma-2-2b">Gemma 2 2B</SelectItem>
                    <SelectItem value="mistralai/Mistral-7B-v0.3">Mistral 7B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Epochs: {epochs}</Label>
                <Slider value={[epochs]} onValueChange={([v]) => setEpochs(v)} min={1} max={20} step={1} />
              </div>
              <div className="space-y-2">
                <Label>Learning Rate: {learningRate}</Label>
                <Slider value={[learningRate * 10000]} onValueChange={([v]) => setLearningRate(v / 10000)} min={1} max={100} step={1} />
              </div>
              <div className="space-y-2">
                <Label>Repository Name (HF Hub)</Label>
                <Input placeholder="my-finetuned-model" value={repoName} onChange={e => setRepoName(e.target.value)} />
              </div>
              <Button onClick={handleStartTraining} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Iniciar Training
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 min-h-[300px]">
              <Label className="text-xs text-muted-foreground">Resultado</Label>
              {loading && <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
              {result && !loading && (
                <div className="space-y-3 mt-2">
                  {result.job_id && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Job ID: {result.job_id}</span>
                    </div>
                  )}
                  <pre className="text-xs whitespace-pre-wrap bg-background p-3 rounded border max-h-[300px] overflow-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
              {!result && !loading && <p className="text-sm text-muted-foreground text-center mt-16">Configure e inicie o training</p>}
            </div>
          </div>
        </TabsContent>

        {/* ═══ STATUS TAB ═══ */}
        <TabsContent value="status" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4 rounded-lg border border-border p-4">
              <h3 className="font-semibold text-sm">Verificar Status do Job</h3>
              <div className="space-y-2">
                <Label>Job ID</Label>
                <Input placeholder="ID do job de treinamento" value={jobId} onChange={e => setJobId(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCheckStatus} disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Verificar Status
                </Button>
                <Button onClick={handleListModels} disabled={loading} variant="outline">
                  <Download className="h-4 w-4 mr-1" /> Listar Modelos
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 min-h-[200px]">
              <Label className="text-xs text-muted-foreground">Resultado</Label>
              {loading && <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
              {result && !loading && (
                <div className="mt-2">
                  {result.status && (
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant={result.status === 'completed' ? 'default' : 'secondary'}>{result.status}</Badge>
                      {result.progress && <span className="text-sm text-muted-foreground">{result.progress}%</span>}
                    </div>
                  )}
                  {result.models && Array.isArray(result.models) && (
                    <div className="space-y-2">
                      {result.models.map((m: AnyData, i: number) => (
                        <div key={i} className="p-2 rounded bg-background border text-sm flex items-center justify-between">
                          <span>{m.name || m.id}</span>
                          <Badge variant="outline" className="text-xs">{m.task || 'model'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <pre className="text-xs whitespace-pre-wrap bg-background p-3 rounded border mt-2 max-h-[250px] overflow-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
              {!result && !loading && <p className="text-sm text-muted-foreground text-center mt-8">Informe o Job ID para verificar</p>}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
