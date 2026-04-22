import { useEffect, useMemo, useState } from 'react';
import { History, Trash2, Eye, GitCompare, FlaskConical, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { listSavedRuns, deleteRun, subscribeSavedRuns, type SavedTestRun } from '@/services/savedTestRunsStore';
import { SimulationResultDialog } from './SimulationResultDialog';
import { toast } from 'sonner';

interface Props {
  agentId: string;
  agentName: string;
}

function formatCost(v: number): string {
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

function successColor(rate: number): string {
  if (rate >= 90) return 'text-nexus-emerald';
  if (rate >= 70) return 'text-nexus-amber';
  return 'text-destructive';
}

export function SavedTestRunsPanel({ agentId, agentName }: Props) {
  const [runs, setRuns] = useState<SavedTestRun[]>(() => listSavedRuns(agentId));
  const [viewing, setViewing] = useState<SavedTestRun | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    setRuns(listSavedRuns(agentId));
    return subscribeSavedRuns(agentId, () => setRuns(listSavedRuns(agentId)));
  }, [agentId]);

  const compareSelected = useMemo(
    () => compareIds.map((id) => runs.find((r) => r.id === id)).filter(Boolean) as SavedTestRun[],
    [compareIds, runs],
  );

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) {
        toast.info('Selecione no máximo 2 runs para comparar');
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleDelete = (run: SavedTestRun) => {
    if (!confirm(`Excluir "${run.name}"? Essa ação não pode ser desfeita.`)) return;
    deleteRun(agentId, run.id);
    setCompareIds((prev) => prev.filter((x) => x !== run.id));
    toast.success('Run excluído');
  };

  if (runs.length === 0) {
    return (
      <div className="nexus-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-primary" aria-hidden="true" />
            Test Runs salvos
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FlaskConical className="h-8 w-8 text-muted-foreground/50 mb-2" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            Nenhum run salvo ainda. Use <span className="font-medium text-foreground">Simular run</span> e salve o resultado para comparar depois.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="nexus-card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-primary" aria-hidden="true" />
            Test Runs salvos
            <span className="text-xs font-normal text-muted-foreground">({runs.length})</span>
          </h3>
          <div className="flex items-center gap-2">
            {compareIds.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {compareIds.length}/2 selecionados
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              disabled={compareSelected.length !== 2}
              onClick={() => setCompareOpen(true)}
            >
              <GitCompare className="h-3 w-3" /> Comparar
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 sticky top-0">
                <tr className="text-left text-muted-foreground border-b border-border/50">
                  <th scope="col" className="py-2 px-2 font-medium w-8"></th>
                  <th scope="col" className="py-2 px-2 font-medium">Nome</th>
                  <th scope="col" className="py-2 px-2 font-medium">Data</th>
                  <th scope="col" className="py-2 px-2 font-medium text-right">Runs</th>
                  <th scope="col" className="py-2 px-2 font-medium text-right">Sucesso</th>
                  <th scope="col" className="py-2 px-2 font-medium text-right">Latência</th>
                  <th scope="col" className="py-2 px-2 font-medium text-right">Custo</th>
                  <th scope="col" className="py-2 px-2 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const checked = compareIds.includes(run.id);
                  return (
                    <tr key={run.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/20">
                      <td className="py-1.5 px-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCompare(run.id)}
                          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                          aria-label={`Selecionar ${run.name} para comparação`}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-foreground font-medium truncate max-w-[200px]" title={run.name}>
                        {run.name}
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground tabular-nums">
                        {new Date(run.savedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{run.summary.total}</td>
                      <td className={`py-1.5 px-2 text-right tabular-nums font-semibold ${successColor(run.summary.successRate)}`}>
                        {run.summary.successRate.toFixed(0)}%
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{run.summary.avgLatency}ms</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{formatCost(run.summary.totalCost)}</td>
                      <td className="py-1.5 px-2 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => setViewing(run)}
                            className="p-1 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={`Ver detalhes de ${run.name}`}
                            title="Ver detalhes"
                          >
                            <Eye className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(run)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            aria-label={`Excluir ${run.name}`}
                            title="Excluir"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/70 mt-2">
          Marque até 2 runs nas caixas e clique em Comparar para ver as diferenças. Salvos localmente neste navegador.
        </p>
      </div>

      {/* Visualizar detalhes — reusa o diálogo de simulação em modo somente leitura */}
      {viewing && (
        <SimulationResultDialog
          open={!!viewing}
          onOpenChange={(o) => !o && setViewing(null)}
          summary={viewing.summary}
          running={false}
          onRun={() => toast.info('Use “Simular run” no header para nova execução.')}
          agentName={agentName}
          readOnlyTitle={`${viewing.name} · salvo em ${new Date(viewing.savedAt).toLocaleString('pt-BR')}`}
          hideRunControls
        />
      )}

      {/* Comparação lado a lado */}
      {compareSelected.length === 2 && (
        <CompareDialog
          open={compareOpen}
          onOpenChange={setCompareOpen}
          a={compareSelected[0]}
          b={compareSelected[1]}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function CompareDialog({
  open, onOpenChange, a, b,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  a: SavedTestRun;
  b: SavedTestRun;
}) {
  // Garante ordem cronológica: mais antigo (base) → mais recente (atual)
  const [base, current] = a.savedAt < b.savedAt ? [a, b] : [b, a];

  const rows: Array<{ label: string; baseVal: number; currVal: number; format: (v: number) => string; higherIsBetter: boolean; suffix?: string; precision?: number }> = [
    { label: 'Taxa de sucesso', baseVal: base.summary.successRate, currVal: current.summary.successRate, format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true, suffix: 'pp', precision: 2 },
    { label: 'Latência média', baseVal: base.summary.avgLatency, currVal: current.summary.avgLatency, format: (v) => `${Math.round(v)}ms`, higherIsBetter: false, suffix: 'ms' },
    { label: 'p95 latência', baseVal: base.summary.p95Latency, currVal: current.summary.p95Latency, format: (v) => `${Math.round(v)}ms`, higherIsBetter: false, suffix: 'ms' },
    { label: 'Custo total', baseVal: base.summary.totalCost, currVal: current.summary.totalCost, format: formatCost, higherIsBetter: false, suffix: '$', precision: 4 },
    { label: 'Tokens totais', baseVal: base.summary.totalTokens, currVal: current.summary.totalTokens, format: (v) => Math.round(v).toLocaleString('pt-BR'), higherIsBetter: false, suffix: '' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" aria-hidden="true" />
            Comparar Test Runs
          </DialogTitle>
          <DialogDescription>
            Variação calculada de <span className="font-medium text-foreground">{base.name}</span> (base) → <span className="font-medium text-foreground">{current.name}</span> (atual).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <RunMiniCard run={base} label="Base" />
          <RunMiniCard run={current} label="Atual" />
        </div>

        <div className="rounded-lg border border-border/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-secondary/40">
              <tr className="text-left text-muted-foreground border-b border-border/50">
                <th scope="col" className="py-2 px-3 font-medium">Métrica</th>
                <th scope="col" className="py-2 px-3 font-medium text-right">Base</th>
                <th scope="col" className="py-2 px-3 font-medium text-right">Atual</th>
                <th scope="col" className="py-2 px-3 font-medium text-right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSuccessRate = r.label === 'Taxa de sucesso';
                const deltaAbs = r.currVal - r.baseVal;
                // Para taxa de sucesso usamos pp (diferença absoluta). Outros usam % relativo.
                const deltaDisplay = isSuccessRate
                  ? `${deltaAbs >= 0 ? '+' : ''}${deltaAbs.toFixed(2)}pp`
                  : r.baseVal === 0
                    ? deltaAbs === 0 ? '—' : (deltaAbs > 0 ? '+∞' : '-∞')
                    : `${deltaAbs >= 0 ? '+' : ''}${((deltaAbs / r.baseVal) * 100).toFixed(1)}%`;

                const threshold = isSuccessRate ? 0.1 : Math.max(0.01, Math.abs(r.baseVal) * 0.005);
                const isFlat = Math.abs(deltaAbs) < threshold;
                const improved = !isFlat && (r.higherIsBetter ? deltaAbs > 0 : deltaAbs < 0);
                const tone = isFlat ? 'text-muted-foreground' : improved ? 'text-nexus-emerald' : 'text-destructive';
                const Icon = isFlat ? Minus : deltaAbs > 0 ? ArrowUp : ArrowDown;

                return (
                  <tr key={r.label} className="border-b border-border/30 last:border-0">
                    <td className="py-2 px-3 text-foreground">{r.label}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{r.format(r.baseVal)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-foreground font-medium">{r.format(r.currVal)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-semibold ${tone}`}>
                      <span className="inline-flex items-center gap-1 justify-end">
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {deltaDisplay}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunMiniCard({ run, label }: { run: SavedTestRun; label: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold text-foreground truncate" title={run.name}>{run.name}</p>
      <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
        {new Date(run.savedAt).toLocaleString('pt-BR')} · {run.summary.total} runs
      </p>
      {run.prompt && (
        <p className="text-[10px] text-muted-foreground/80 mt-1 truncate font-mono" title={run.prompt}>
          “{run.prompt}”
        </p>
      )}
    </div>
  );
}
