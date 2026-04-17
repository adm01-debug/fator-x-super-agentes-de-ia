import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Beaker, Play, Pause, Trash2, Trophy, Plus, Activity, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { useWorkspaceId } from '@/hooks/use-data';
import { promptExperimentService, type PromptExperiment, type ExperimentStats } from '@/services/promptExperimentService';
import { CreateExperimentDialog } from '@/components/prompts/CreateExperimentDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  running: 'default',
  paused: 'secondary',
  completed: 'secondary',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  running: 'Rodando',
  paused: 'Pausado',
  completed: 'Concluído',
};

export default function PromptExperimentsPage() {
  const { data: workspaceId } = useWorkspaceId();
  const workspace = workspaceId ? { id: workspaceId } : null;
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: experiments = [], isLoading } = useQuery({
    queryKey: ['prompt_experiments', workspace?.id],
    queryFn: () => promptExperimentService.list(workspace!.id),
    enabled: !!workspace?.id,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PromptExperiment['status'] }) =>
      promptExperimentService.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prompt_experiments', workspace?.id] });
      toast.success('Status atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => promptExperimentService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prompt_experiments', workspace?.id] });
      toast.success('Experimento removido');
    },
  });

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="A/B Testing de Prompts"
        description="Compare versões de prompts em produção com split traffic determinístico, significância estatística (z-test) e promoção automática do vencedor."
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={!workspace}>
            <Plus className="h-4 w-4 mr-2" />Novo experimento
          </Button>
        }
      />

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Carregando…</CardContent></Card>
      ) : experiments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Beaker className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <div className="text-sm text-muted-foreground">Nenhum experimento ainda. Crie seu primeiro A/B test.</div>
            <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Criar experimento</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {experiments.map((exp) => (
            <ExperimentCard
              key={exp.id}
              experiment={exp}
              onOpen={() => setSelectedId(exp.id)}
              onToggle={() => setStatus.mutate({ id: exp.id, status: exp.status === 'running' ? 'paused' : 'running' })}
              onDelete={() => { if (confirm('Remover experimento?')) remove.mutate(exp.id); }}
            />
          ))}
        </div>
      )}

      {workspace && (
        <CreateExperimentDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          workspaceId={workspace.id}
        />
      )}

      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes do experimento</DialogTitle></DialogHeader>
          {selectedId && <ExperimentDetail experimentId={selectedId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExperimentCard({
  experiment,
  onOpen,
  onToggle,
  onDelete,
}: { experiment: PromptExperiment; onOpen: () => void; onToggle: () => void; onDelete: () => void }) {
  const { data: stats } = useQuery({
    queryKey: ['prompt_experiment_stats', experiment.id, experiment.status],
    queryFn: () => promptExperimentService.getStats(experiment.id),
    refetchInterval: experiment.status === 'running' ? 8000 : false,
  });

  const totalRuns = (stats?.variant_a.runs ?? 0) + (stats?.variant_b.runs ?? 0);

  return (
    <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={onOpen}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base truncate flex items-center gap-2">
              {experiment.name}
              {experiment.winner && <Trophy className="h-4 w-4 text-nexus-green shrink-0" />}
            </CardTitle>
            <div className="text-xs text-muted-foreground line-clamp-1">{experiment.description || 'Sem descrição'}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Badge variant={STATUS_VARIANT[experiment.status]}>{STATUS_LABEL[experiment.status]}</Badge>
            {experiment.status !== 'completed' && (
              <Button size="icon" variant="ghost" onClick={onToggle}>
                {experiment.status === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <Metric label="Métrica" value={experiment.success_metric} />
          <Metric label="Split" value={`${experiment.traffic_split}/${100 - experiment.traffic_split}`} />
          <Metric label="Runs" value={totalRuns.toLocaleString('pt-BR')} />
          <Metric label="p-value" value={stats ? stats.p_value.toFixed(3) : '—'} highlight={stats?.significant} />
          <Metric label="Vencedor" value={experiment.winner ? experiment.winner.toUpperCase() : (stats?.significant ? `${stats.winner_candidate.toUpperCase()} ✓` : '—')} highlight={!!experiment.winner} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-nexus-green' : ''}`}>{value}</div>
    </div>
  );
}

function ExperimentDetail({ experimentId }: { experimentId: string }) {
  const qc = useQueryClient();
  const { data: experiment } = useQuery({
    queryKey: ['prompt_experiment', experimentId],
    queryFn: () => promptExperimentService.get(experimentId),
  });
  const { data: stats } = useQuery({
    queryKey: ['prompt_experiment_stats', experimentId],
    queryFn: () => promptExperimentService.getStats(experimentId),
    refetchInterval: 5000,
  });
  const { data: runs = [] } = useQuery({
    queryKey: ['prompt_experiment_runs', experimentId],
    queryFn: () => promptExperimentService.listRuns(experimentId, 100),
    refetchInterval: 8000,
  });

  const promote = useMutation({
    mutationFn: (winner: 'a' | 'b') => promptExperimentService.promoteWinner(experimentId, winner),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prompt_experiment', experimentId] });
      qc.invalidateQueries({ queryKey: ['prompt_experiments'] });
      toast.success('Vencedor promovido!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const simulate = useMutation({
    mutationFn: async () => {
      // Simula 50 runs para demo (25 por variante com leve vantagem para B)
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        const variant: 'a' | 'b' = Math.random() < 0.5 ? 'a' : 'b';
        promises.push(promptExperimentService.recordRun({
          experiment_id: experimentId,
          variant,
          latency_ms: Math.floor(700 + Math.random() * 400 + (variant === 'b' ? 80 : 0)),
          cost_cents: Number((0.4 + Math.random() * 0.3 + (variant === 'b' ? 0.1 : 0)).toFixed(4)),
          quality_score: Number((0.6 + Math.random() * 0.3 + (variant === 'b' ? 0.08 : 0)).toFixed(3)),
          success: Math.random() < (variant === 'b' ? 0.92 : 0.85),
        }));
      }
      await Promise.all(promises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prompt_experiment_runs', experimentId] });
      qc.invalidateQueries({ queryKey: ['prompt_experiment_stats', experimentId] });
      toast.success('50 runs simulados');
    },
  });

  const guardrailsOk = useMemo(() => {
    if (!stats || !experiment) return false;
    const a = stats.variant_a, b = stats.variant_b;
    const winner = stats.winner_candidate === 'a' ? a : b;
    const loser = stats.winner_candidate === 'a' ? b : a;
    if (winner.runs < 50 || loser.runs < 50) return false;
    const costInc = loser.avg_cost_cents > 0 ? ((winner.avg_cost_cents - loser.avg_cost_cents) / loser.avg_cost_cents) * 100 : 0;
    const latInc = winner.avg_latency_ms - loser.avg_latency_ms;
    return costInc <= experiment.guardrails.max_cost_increase_pct
      && latInc <= experiment.guardrails.max_latency_increase_ms
      && winner.avg_quality >= experiment.guardrails.min_quality;
  }, [stats, experiment]);

  if (!experiment) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;

  const canPromote = stats?.significant && guardrailsOk && experiment.status !== 'completed';

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Visão geral</TabsTrigger>
        <TabsTrigger value="runs">Runs ({runs.length})</TabsTrigger>
        <TabsTrigger value="config">Configuração</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        {stats && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-sm font-semibold">
                    Significância: p={stats.p_value.toFixed(4)} {stats.significant ? '✓ significativo' : '— ainda não'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    n={stats.variant_a.runs + stats.variant_b.runs} · z={stats.z_score.toFixed(2)} · winner candidato: {stats.winner_candidate.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => simulate.mutate()} loading={simulate.isPending}>
                  Simular 50 runs
                </Button>
                <Button
                  onClick={() => stats && promote.mutate(stats.winner_candidate)}
                  disabled={!canPromote}
                  loading={promote.isPending}
                >
                  <Zap className="h-4 w-4 mr-2" />Promover {stats.winner_candidate.toUpperCase()}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <VariantCard label={experiment.variant_a_label} variant="a" stats={stats.variant_a} winner={experiment.winner === 'a' || stats.winner_candidate === 'a'} />
            <VariantCard label={experiment.variant_b_label} variant="b" stats={stats.variant_b} winner={experiment.winner === 'b' || stats.winner_candidate === 'b'} />
          </div>
        )}
      </TabsContent>

      <TabsContent value="runs">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Latência</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Qualidade</TableHead>
                  <TableHead>Sucesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem runs ainda</TableCell></TableRow>
                ) : runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{format(new Date(r.created_at), 'dd/MM HH:mm:ss', { locale: ptBR })}</TableCell>
                    <TableCell><Badge variant="outline">{r.variant.toUpperCase()}</Badge></TableCell>
                    <TableCell>{r.latency_ms}ms</TableCell>
                    <TableCell>${Number(r.cost_cents).toFixed(4)}</TableCell>
                    <TableCell>{r.quality_score != null ? Number(r.quality_score).toFixed(2) : '—'}</TableCell>
                    <TableCell>{r.success ? '✓' : '✗'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="config">
        <Card>
          <CardContent className="p-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Métrica:</span> <b>{experiment.success_metric}</b></div>
              <div><span className="text-muted-foreground">Split:</span> <b>{experiment.traffic_split}/{100 - experiment.traffic_split}</b></div>
              <div><span className="text-muted-foreground">Status:</span> <b>{STATUS_LABEL[experiment.status]}</b></div>
              <div><span className="text-muted-foreground">Criado:</span> <b>{format(new Date(experiment.created_at), 'dd/MM/yyyy', { locale: ptBR })}</b></div>
            </div>
            <div className="pt-2 border-t">
              <div className="text-xs font-semibold mb-2">Guardrails</div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><span className="text-muted-foreground">Custo máx:</span> +{experiment.guardrails.max_cost_increase_pct}%</div>
                <div><span className="text-muted-foreground">Latência máx:</span> +{experiment.guardrails.max_latency_increase_ms}ms</div>
                <div><span className="text-muted-foreground">Qualidade mín:</span> {experiment.guardrails.min_quality}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function VariantCard({ label, variant, stats, winner }: { label: string; variant: 'a' | 'b'; stats: ExperimentStats['variant_a']; winner: boolean }) {
  return (
    <Card className={winner ? 'border-nexus-green/40 shadow-[0_0_20px_hsl(var(--nexus-green)/0.12)]' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Badge>{variant.toUpperCase()}</Badge>{label}
          {winner && <Trophy className="h-4 w-4 text-nexus-green ml-auto" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Runs" value={stats.runs} />
          <Metric label="Sucesso" value={`${(stats.success_rate * 100).toFixed(1)}%`} />
          <Metric label="Latência" value={`${Math.round(stats.avg_latency_ms)}ms`} />
          <Metric label="Custo médio" value={`$${Number(stats.avg_cost_cents).toFixed(4)}`} />
        </div>
        <div>
          <div className="flex justify-between mb-1"><span>Qualidade</span><span className="font-semibold">{(stats.avg_quality * 100).toFixed(0)}%</span></div>
          <Progress value={stats.avg_quality * 100} />
        </div>
      </CardContent>
    </Card>
  );
}
