import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Play, Plus, Trash2, CheckCircle2, XCircle, Eye } from 'lucide-react';
import {
  useEvalDatasets,
  useEvalRuns,
  useEvalResults,
  useCreateEvalDataset,
  useDeleteEvalDataset,
  useRunEval,
  type EvalItem,
} from '@/hooks/useAgentEvals';
import { useWorkspaceId } from '@/hooks/use-data';
import { toast } from 'sonner';

export function EvalsModule() {
  const { id: agentId } = useParams();
  const { data: workspaceId } = useWorkspaceId();
  const { data: datasets = [], isLoading: loadingDs } = useEvalDatasets(agentId);
  const { data: runs = [], isLoading: loadingRuns } = useEvalRuns(agentId);
  const createDs = useCreateEvalDataset();
  const deleteDs = useDeleteEvalDataset();
  const runEval = useRunEval();

  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<EvalItem[]>([{ input: '', expected_output: '' }]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!workspaceId) return toast.error('Workspace não encontrado');
    if (!name.trim()) return toast.error('Informe o nome');
    const valid = items.filter((i) => i.input.trim() && i.expected_output.trim());
    if (valid.length === 0) return toast.error('Adicione ao menos um item válido');
    await createDs.mutateAsync({
      workspace_id: workspaceId,
      agent_id: agentId,
      name: name.trim(),
      description: description.trim(),
      items: valid,
    });
    setOpenCreate(false);
    setName('');
    setDescription('');
    setItems([{ input: '', expected_output: '' }]);
  };

  const handleRun = async (datasetId: string) => {
    if (!agentId) return toast.error('Agente não selecionado');
    await runEval.mutateAsync({ dataset_id: datasetId, agent_id: agentId });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2">🧪 Avaliação de Qualidade</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Crie datasets de teste e meça accuracy, latência e custo do seu agente automaticamente.
        </p>
      </div>

      <Tabs defaultValue="datasets">
        <TabsList>
          <TabsTrigger value="datasets">Datasets</TabsTrigger>
          <TabsTrigger value="runs">Histórico de Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="datasets" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Novo Dataset</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Dataset de Avaliação</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Suporte básico" />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="space-y-3">
                    <Label>Casos de teste</Label>
                    {items.map((item, i) => (
                      <Card key={i}>
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground">Caso #{i + 1}</span>
                            {items.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <Textarea
                            placeholder="Input (pergunta do usuário)"
                            value={item.input}
                            onChange={(e) => {
                              const next = [...items];
                              next[i] = { ...next[i], input: e.target.value };
                              setItems(next);
                            }}
                            rows={2}
                          />
                          <Textarea
                            placeholder="Resposta esperada"
                            value={item.expected_output}
                            onChange={(e) => {
                              const next = [...items];
                              next[i] = { ...next[i], expected_output: e.target.value };
                              setItems(next);
                            }}
                            rows={2}
                          />
                        </CardContent>
                      </Card>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setItems([...items, { input: '', expected_output: '' }])}>
                      <Plus className="h-4 w-4 mr-2" /> Adicionar caso
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
                  <Button onClick={handleCreate} disabled={createDs.isPending}>
                    {createDs.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loadingDs ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : datasets.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
                <div className="text-5xl mb-3">📋</div>
                <p>Nenhum dataset ainda. Crie um para começar.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {datasets.map((ds) => (
                <Card key={ds.id}>
                  <CardContent className="pt-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{ds.name}</div>
                      {ds.description && <div className="text-xs text-muted-foreground truncate">{ds.description}</div>}
                      <div className="text-xs text-muted-foreground mt-1">{ds.items?.length ?? 0} casos de teste</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleRun(ds.id)} disabled={runEval.isPending}>
                        <Play className="h-3 w-3 mr-1" /> Rodar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteDs.mutate(ds.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          {loadingRuns ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : runs.length === 0 ? (
            <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">Nenhuma avaliação ainda.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {runs.map((run) => {
                const passRate = run.total_items > 0 ? (run.passed / run.total_items) * 100 : 0;
                return (
                  <Card key={run.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                              {run.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(run.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
                            <div>
                              <div className="text-muted-foreground">Pass rate</div>
                              <div className={`font-semibold text-base ${passRate >= 70 ? 'text-nexus-emerald' : passRate >= 40 ? 'text-nexus-amber' : 'text-destructive'}`}>
                                {passRate.toFixed(0)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Score médio</div>
                              <div className="font-semibold text-base">{Number(run.avg_score ?? 0).toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Latência</div>
                              <div className="font-semibold text-base">{run.avg_latency_ms}ms</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Custo</div>
                              <div className="font-semibold text-base">${Number(run.total_cost_usd ?? 0).toFixed(4)}</div>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setSelectedRunId(run.id)}>
                          <Eye className="h-3 w-3 mr-1" /> Detalhes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedRunId} onOpenChange={(o) => !o && setSelectedRunId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Avaliação</DialogTitle>
          </DialogHeader>
          <RunDetails runId={selectedRunId} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunDetails({ runId }: { runId: string | null }) {
  const { data: results = [], isLoading } = useEvalResults(runId);
  const [filter, setFilter] = useState<'all' | 'pass' | 'fail'>('all');

  const filtered = useMemo(() => {
    if (filter === 'pass') return results.filter((r) => r.passed);
    if (filter === 'fail') return results.filter((r) => !r.passed);
    return results;
  }, [results, filter]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  if (results.length === 0) return <div className="text-center py-8 text-muted-foreground">Nenhum resultado ainda. Atualize em alguns segundos.</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>Todos ({results.length})</Button>
        <Button size="sm" variant={filter === 'pass' ? 'default' : 'outline'} onClick={() => setFilter('pass')}>Pass ({results.filter((r) => r.passed).length})</Button>
        <Button size="sm" variant={filter === 'fail' ? 'default' : 'outline'} onClick={() => setFilter('fail')}>Fail ({results.filter((r) => !r.passed).length})</Button>
      </div>
      {filtered.map((r) => (
        <Card key={r.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {r.passed ? <CheckCircle2 className="h-4 w-4 text-nexus-emerald" /> : <XCircle className="h-4 w-4 text-destructive" />}
              Caso #{r.item_index + 1} — score {Number(r.score).toFixed(2)} · {r.latency_ms}ms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div><span className="font-semibold">Input:</span> <div className="text-muted-foreground mt-1">{r.input}</div></div>
            {r.expected && <div><span className="font-semibold">Esperado:</span> <div className="text-muted-foreground mt-1">{r.expected}</div></div>}
            {r.actual && <div><span className="font-semibold">Real:</span> <div className="text-muted-foreground mt-1">{r.actual}</div></div>}
            {r.judge_reasoning && <div className="border-l-2 border-primary/40 pl-2"><span className="font-semibold">Juiz:</span> <span className="text-muted-foreground">{r.judge_reasoning}</span></div>}
            {r.error && <div className="text-destructive"><span className="font-semibold">Erro:</span> {r.error}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
