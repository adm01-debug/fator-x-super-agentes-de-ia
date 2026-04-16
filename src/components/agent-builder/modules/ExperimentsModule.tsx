import { useState } from 'react';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, EmptyState } from '../ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Play, Pause, CheckCircle, Trash2, Trophy, FlaskConical, Activity, DollarSign, Clock, Star } from 'lucide-react';
import {
  useExperiments,
  useExperimentRuns,
  useCreateExperiment,
  useUpdateExperimentStatus,
  useDeclareWinner,
  useDeleteExperiment,
  computeVariantStats,
  type AgentExperiment,
  type ExperimentVariant,
} from '@/hooks/useAgentExperiments';
import { toast } from 'sonner';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  running: { label: 'Executando', className: 'bg-nexus-emerald/10 text-nexus-emerald border-nexus-emerald/30' },
  paused: { label: 'Pausado', className: 'bg-nexus-amber/10 text-nexus-amber border-nexus-amber/30' },
  completed: { label: 'Concluído', className: 'bg-primary/10 text-primary border-primary/30' },
};

export function ExperimentsModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);
  const agentId = agent.id as string | undefined;
  const workspaceId = (agent as unknown as { workspace_id?: string }).workspace_id;

  const { data: experiments = [], isLoading } = useExperiments(agentId);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = experiments.find((e) => e.id === selectedId) ?? experiments[0];

  const handleApplyWinner = (exp: AgentExperiment) => {
    if (!exp.winner) return;
    const cfg = exp.winner === 'a' ? exp.variant_a_config : exp.variant_b_config;
    updateAgent(cfg as Partial<typeof agent>);
    toast.success(`Configuração da Variante ${exp.winner.toUpperCase()} aplicada ao agente`);
  };

  if (!agentId) {
    return (
      <div className="space-y-6">
        <SectionTitle icon="🧪" title="Experimentos A/B" subtitle="Compare duas variantes do agente." />
        <EmptyState
          icon={FlaskConical}
          title="Salve o agente primeiro"
          description="Você precisa salvar o agente antes de criar experimentos."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-start justify-between gap-4 mb-4">
          <SectionTitle
            icon="🧪"
            title="Experimentos A/B"
            subtitle="Compare duas variantes do agente com split de tráfego e métricas."
            badge={<NexusBadge color="blue">{experiments.length} experimentos</NexusBadge>}
          />
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Novo experimento
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : experiments.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="Nenhum experimento ainda"
            description="Crie seu primeiro teste A/B para comparar variantes do agente."
            actionLabel="Criar experimento"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <div className="space-y-2">
            {experiments.map((exp) => {
              const st = STATUS_STYLES[exp.status];
              const isActive = selected?.id === exp.id;
              return (
                <button
                  key={exp.id}
                  onClick={() => setSelectedId(exp.id)}
                  className={`w-full text-left rounded-lg border px-4 py-3 transition-all ${
                    isActive ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{exp.name}</p>
                        <Badge variant="outline" className={`text-[10px] ${st.className}`}>
                          {st.label}
                        </Badge>
                        {exp.winner && (
                          <Badge className="text-[10px] gap-1 bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30">
                            <Trophy className="h-3 w-3" /> Vencedor: {exp.winner.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      {exp.description && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{exp.description}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      Split A {100 - exp.traffic_split}% / B {exp.traffic_split}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <ExperimentDetail experiment={selected} onApplyWinner={handleApplyWinner} />
      )}

      <CreateExperimentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        agentId={agentId}
        workspaceId={workspaceId}
        currentConfig={agent as unknown as Record<string, unknown>}
      />
    </div>
  );
}

function ExperimentDetail({
  experiment,
  onApplyWinner,
}: {
  experiment: AgentExperiment;
  onApplyWinner: (e: AgentExperiment) => void;
}) {
  const { data: runs = [], isLoading } = useExperimentRuns(experiment.id);
  const updateStatus = useUpdateExperimentStatus();
  const declareWinner = useDeclareWinner();
  const del = useDeleteExperiment();

  const statsA = computeVariantStats(runs, 'a');
  const statsB = computeVariantStats(runs, 'b');
  const totalRuns = statsA.runs + statsB.runs;
  const pctA = totalRuns ? (statsA.runs / totalRuns) * 100 : 50;

  const canRun = experiment.status === 'draft' || experiment.status === 'paused';
  const canPause = experiment.status === 'running';
  const canComplete = experiment.status === 'running' || experiment.status === 'paused';

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon="📊" title="Detalhes do Experimento" subtitle={experiment.name} />
        <div className="flex items-center gap-2">
          {canRun && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => updateStatus.mutate({ id: experiment.id, status: 'running', agent_id: experiment.agent_id })}
            >
              <Play className="h-3.5 w-3.5" /> Iniciar
            </Button>
          )}
          {canPause && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => updateStatus.mutate({ id: experiment.id, status: 'paused', agent_id: experiment.agent_id })}
            >
              <Pause className="h-3.5 w-3.5" /> Pausar
            </Button>
          )}
          {canComplete && !experiment.winner && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => updateStatus.mutate({ id: experiment.id, status: 'completed', agent_id: experiment.agent_id })}
            >
              <CheckCircle className="h-3.5 w-3.5" /> Concluir
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm('Remover este experimento?')) del.mutate({ id: experiment.id, agent_id: experiment.agent_id });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Traffic split visualization */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Distribuição de execuções</span>
          <span>{totalRuns} runs totais</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
          <div className="bg-primary transition-all" style={{ width: `${pctA}%` }} />
          <div className="bg-nexus-orange transition-all" style={{ width: `${100 - pctA}%` }} />
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-primary font-medium">A · {statsA.runs} runs</span>
          <span className="text-nexus-orange font-medium">B · {statsB.runs} runs</span>
        </div>
      </div>

      {/* Side-by-side metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VariantPanel
          variant="a"
          label="Variante A (Controle)"
          color="primary"
          stats={statsA}
          totalRuns={totalRuns}
          isWinner={experiment.winner === 'a'}
          experiment={experiment}
          onDeclare={() => declareWinner.mutate({ id: experiment.id, winner: 'a', agent_id: experiment.agent_id })}
          onApply={() => onApplyWinner(experiment)}
        />
        <VariantPanel
          variant="b"
          label="Variante B (Teste)"
          color="nexus-orange"
          stats={statsB}
          totalRuns={totalRuns}
          isWinner={experiment.winner === 'b'}
          experiment={experiment}
          onDeclare={() => declareWinner.mutate({ id: experiment.id, winner: 'b', agent_id: experiment.agent_id })}
          onApply={() => onApplyWinner(experiment)}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </section>
  );
}

function VariantPanel({
  variant,
  label,
  color,
  stats,
  totalRuns,
  isWinner,
  experiment,
  onDeclare,
  onApply,
}: {
  variant: ExperimentVariant;
  label: string;
  color: 'primary' | 'nexus-orange';
  stats: ReturnType<typeof computeVariantStats>;
  totalRuns: number;
  isWinner: boolean;
  experiment: AgentExperiment;
  onDeclare: () => void;
  onApply: () => void;
}) {
  const config = (variant === 'a' ? experiment.variant_a_config : experiment.variant_b_config) as Record<string, unknown>;
  const sharePct = totalRuns > 0 ? (stats.runs / totalRuns) * 100 : 0;

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        isWinner ? 'border-nexus-amber/50 bg-nexus-amber/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-xs font-semibold text-${color}`}>{label}</p>
          {isWinner && (
            <Badge className="mt-1 gap-1 bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30 text-[10px]">
              <Trophy className="h-3 w-3" /> Vencedor
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">{sharePct.toFixed(0)}%</span>
      </div>

      <Progress value={sharePct} className="h-1.5" />

      <div className="grid grid-cols-2 gap-2">
        <Metric icon={<Activity className="h-3.5 w-3.5" />} label="Runs" value={String(stats.runs)} />
        <Metric icon={<Clock className="h-3.5 w-3.5" />} label="Latência" value={`${stats.avgLatency}ms`} />
        <Metric icon={<DollarSign className="h-3.5 w-3.5" />} label="Custo méd." value={`$${stats.avgCost.toFixed(4)}`} />
        <Metric icon={<Star className="h-3.5 w-3.5" />} label="Score méd." value={stats.avgScore ? stats.avgScore.toFixed(2) : '—'} />
      </div>

      {/* Config preview */}
      {Object.keys(config).length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Ver configuração ({Object.keys(config).length} campos)
          </summary>
          <pre className="mt-2 p-2 rounded bg-muted/30 overflow-auto max-h-32 text-[10px]">
            {JSON.stringify(config, null, 2)}
          </pre>
        </details>
      )}

      <div className="flex gap-2 pt-1">
        {!experiment.winner && experiment.status !== 'draft' && stats.runs > 0 && (
          <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={onDeclare}>
            <Trophy className="h-3 w-3" /> Declarar vencedor
          </Button>
        )}
        {isWinner && (
          <Button size="sm" className="flex-1 text-xs gap-1" onClick={onApply}>
            Aplicar ao agente
          </Button>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-2">
      <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-0.5">
        {icon} {label}
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function CreateExperimentDialog({
  open,
  onOpenChange,
  agentId,
  workspaceId,
  currentConfig,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agentId: string;
  workspaceId: string | undefined;
  currentConfig: Record<string, unknown>;
}) {
  const create = useCreateExperiment();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [split, setSplit] = useState(50);
  const [variantField, setVariantField] = useState<'model' | 'system_prompt' | 'temperature'>('model');
  const [valueA, setValueA] = useState('');
  const [valueB, setValueB] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!workspaceId) {
      toast.error('Workspace não encontrado');
      return;
    }
    const a = valueA.trim() || String(currentConfig[variantField] ?? '');
    const b = valueB.trim();
    if (!b) {
      toast.error('Defina um valor para a Variante B');
      return;
    }

    const parseValue = (v: string) =>
      variantField === 'temperature' ? Number(v) : v;

    await create.mutateAsync({
      agent_id: agentId,
      workspace_id: workspaceId,
      name: name.trim(),
      description: description.trim(),
      traffic_split: split,
      variant_a_config: { [variantField]: parseValue(a) },
      variant_b_config: { [variantField]: parseValue(b) },
    });
    setName('');
    setDescription('');
    setValueA('');
    setValueB('');
    setSplit(50);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" /> Novo experimento A/B
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Modelo flash vs pro"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hipótese a ser testada..."
              className="text-sm min-h-[60px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Campo a comparar</Label>
            <Select value={variantField} onValueChange={(v) => setVariantField(v as typeof variantField)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="model">Modelo (model)</SelectItem>
                <SelectItem value="system_prompt">System prompt</SelectItem>
                <SelectItem value="temperature">Temperatura</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-primary">Variante A (controle)</Label>
              {variantField === 'system_prompt' ? (
                <Textarea
                  value={valueA}
                  onChange={(e) => setValueA(e.target.value)}
                  placeholder={String(currentConfig[variantField] ?? '(atual)')}
                  className="text-xs min-h-[80px]"
                />
              ) : (
                <Input
                  value={valueA}
                  onChange={(e) => setValueA(e.target.value)}
                  placeholder={String(currentConfig[variantField] ?? '(atual)')}
                  className="text-sm"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-nexus-orange">Variante B (teste)</Label>
              {variantField === 'system_prompt' ? (
                <Textarea
                  value={valueB}
                  onChange={(e) => setValueB(e.target.value)}
                  placeholder="Novo valor..."
                  className="text-xs min-h-[80px]"
                />
              ) : (
                <Input
                  value={valueB}
                  onChange={(e) => setValueB(e.target.value)}
                  placeholder="Novo valor..."
                  className="text-sm"
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label>Split de tráfego</Label>
              <span className="text-muted-foreground">
                A {100 - split}% / B {split}%
              </span>
            </div>
            <Slider value={[split]} onValueChange={(v) => setSplit(v[0])} min={10} max={90} step={5} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={create.isPending} className="gap-1.5">
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Criar experimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
