import { useState } from "react";
import {
  Loader2,
  Sparkles,
  GitCompare,
  CheckCircle2,
  XCircle,
  Trophy,
  Download,
  DollarSign,
  Hash,
  Gauge,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ORACLE_MODES, ORACLE_PRESETS, type OracleMode, type OracleResult } from "@/stores/oracleStore";

interface ComparisonRun {
  mode: OracleMode;
  preset_id: string;
  result: OracleResult | null;
  error?: string;
  duration_ms: number;
  status: 'pending' | 'running' | 'success' | 'failed';
}

const COMPARISON_MODES: Array<{ mode: OracleMode; preset_id: string }> = [
  { mode: 'council', preset_id: 'executive' },
  { mode: 'researcher', preset_id: 'deep-research' },
  { mode: 'advisor', preset_id: 'decision' },
];

export function OracleComparisonPanel() {
  const [query, setQuery] = useState('');
  const [selectedModes, setSelectedModes] = useState<OracleMode[]>(['council', 'researcher', 'advisor']);
  const [runs, setRuns] = useState<ComparisonRun[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const toggleMode = (mode: OracleMode) => {
    setSelectedModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const handleCompare = async () => {
    if (!query.trim()) {
      toast.error('Digite uma query primeiro');
      return;
    }
    if (selectedModes.length < 2) {
      toast.error('Selecione pelo menos 2 modos');
      return;
    }

    setIsRunning(true);

    const initial: ComparisonRun[] = COMPARISON_MODES
      .filter((c) => selectedModes.includes(c.mode))
      .map((c) => ({
        mode: c.mode,
        preset_id: c.preset_id,
        result: null,
        duration_ms: 0,
        status: 'pending' as const,
      }));
    setRuns(initial);

    // Run sequentially to avoid overloading the orchestrator
    const collected: ComparisonRun[] = [];
    for (const cfg of initial) {
      const start = Date.now();
      const updated = { ...cfg, status: 'running' as const };
      collected.push(updated);
      setRuns([...collected]);

      try {
        const preset = ORACLE_PRESETS.find((p) => p.id === cfg.preset_id) || ORACLE_PRESETS[0];
        const { data, error } = await supabase.functions.invoke('oracle-council', {
          body: {
            query,
            mode: cfg.mode,
            members: preset.members,
            chairman_model: preset.chairman,
            enable_peer_review: preset.enablePeerReview,
            enable_thinking: preset.enableThinking,
            preset_id: preset.id,
          },
        });

        if (error) throw new Error(error.message);

        const idx = collected.findIndex((c) => c.mode === cfg.mode);
        if (idx >= 0) {
          collected[idx] = {
            ...collected[idx],
            result: data as OracleResult,
            duration_ms: Date.now() - start,
            status: 'success',
          };
        }
        setRuns([...collected]);
      } catch (e) {
        const idx = collected.findIndex((c) => c.mode === cfg.mode);
        if (idx >= 0) {
          collected[idx] = {
            ...collected[idx],
            error: e instanceof Error ? e.message : String(e),
            duration_ms: Date.now() - start,
            status: 'failed',
          };
        }
        setRuns([...collected]);
      }
    }

    setIsRunning(false);
    const successCount = collected.filter((c) => c.status === 'success').length;
    if (successCount === collected.length) {
      toast.success(`Comparação completa: ${successCount} modos`);
    } else {
      toast.warning(`${successCount}/${collected.length} modos completaram`);
    }
  };

  // "Winner" = highest confidence_score among successful runs (more meaningful than fastest)
  const successfulRuns = runs.filter((r) => r.status === 'success' && r.result);
  const winnerMode = successfulRuns.length > 0
    ? successfulRuns.reduce((best, r) =>
        (r.result!.confidence_score ?? 0) > (best.result!.confidence_score ?? 0) ? r : best
      ).mode
    : null;

  const aggregate = successfulRuns.reduce(
    (acc, r) => ({
      cost: acc.cost + (r.result?.metrics?.total_cost_usd ?? 0),
      tokens: acc.tokens + (r.result?.metrics?.total_tokens ?? 0),
      avgLatency: acc.avgLatency + r.duration_ms,
    }),
    { cost: 0, tokens: 0, avgLatency: 0 }
  );
  if (successfulRuns.length > 0) {
    aggregate.avgLatency = aggregate.avgLatency / successfulRuns.length;
  }

  const handleExport = () => {
    if (runs.length === 0) {
      toast.error('Nada para exportar');
      return;
    }
    const payload = {
      query,
      timestamp: new Date().toISOString(),
      runs: runs.map((r) => ({
        mode: r.mode,
        preset_id: r.preset_id,
        status: r.status,
        duration_ms: r.duration_ms,
        error: r.error,
        confidence_score: r.result?.confidence_score,
        consensus_degree: r.result?.consensus_degree,
        final_response: r.result?.final_response,
        metrics: r.result?.metrics,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oracle-comparison-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Comparação exportada');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-primary" /> Modo Comparação
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Roda a mesma query em múltiplos modos do Oráculo lado a lado para comparar abordagens. Útil para escolher o modo certo para cada tipo de pergunta.
        </p>
      </div>

      {/* Query input */}
      <div className="nexus-card space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Sua pergunta</Label>
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: Devemos investir mais em redes sociais ou em SEO em 2026?"
            rows={3}
            className="bg-secondary/50 text-sm resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Modos para comparar (mín. 2)</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {COMPARISON_MODES.map((cfg) => {
              const modeInfo = ORACLE_MODES[cfg.mode];
              const checked = selectedModes.includes(cfg.mode);
              return (
                <label
                  key={cfg.mode}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    checked ? 'bg-primary/10 border-primary/40' : 'bg-secondary/30 border-border/30 hover:border-primary/20'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleMode(cfg.mode)}
                    disabled={isRunning}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{modeInfo.icon}</span>
                      <span className="text-xs font-semibold">{modeInfo.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{modeInfo.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleCompare}
            disabled={isRunning || !query.trim() || selectedModes.length < 2}
            className="gap-1.5"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Comparar
          </Button>
        </div>
      </div>

      {/* Summary metrics + export */}
      {successfulRuns.length > 0 && (
        <div className="nexus-card">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Comparação agregada
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-7 gap-1.5 text-xs"
            >
              <Download className="h-3 w-3" /> Exportar JSON
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" /> Custo total
              </div>
              <p className="text-sm font-heading font-bold tabular-nums">
                ${aggregate.cost.toFixed(4)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <Hash className="h-3 w-3" /> Tokens totais
              </div>
              <p className="text-sm font-heading font-bold tabular-nums">
                {aggregate.tokens.toLocaleString()}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <Loader2 className="h-3 w-3" /> Latência média
              </div>
              <p className="text-sm font-heading font-bold tabular-nums">
                {(aggregate.avgLatency / 1000).toFixed(1)}s
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <Trophy className="h-3 w-3 text-nexus-amber" /> Vencedor
              </div>
              <p className="text-sm font-heading font-bold">
                {winnerMode ? ORACLE_MODES[winnerMode].label : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results grid */}
      {runs.length > 0 && (
        <div className={`grid gap-3 ${runs.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {runs.map((run) => {
            const modeInfo = ORACLE_MODES[run.mode];
            const isWinner = winnerMode === run.mode && run.status === 'success';
            return (
              <div
                key={run.mode}
                className={`nexus-card space-y-3 ${
                  isWinner ? 'ring-1 ring-nexus-amber/50' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{modeInfo.icon}</span>
                    <p className="text-xs font-semibold truncate">{modeInfo.label}</p>
                    {isWinner && (
                      <Trophy className="h-3.5 w-3.5 text-nexus-amber shrink-0" />
                    )}
                  </div>
                  {run.status === 'pending' && <Badge variant="outline" className="text-[9px]">Pendente</Badge>}
                  {run.status === 'running' && (
                    <Badge variant="outline" className="text-[9px] gap-1">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" /> Rodando
                    </Badge>
                  )}
                  {run.status === 'success' && (
                    <Badge variant="outline" className="text-[9px] border-nexus-emerald/50 text-nexus-emerald gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {(run.duration_ms / 1000).toFixed(1)}s
                    </Badge>
                  )}
                  {run.status === 'failed' && (
                    <Badge variant="outline" className="text-[9px] border-destructive/50 text-destructive gap-1">
                      <XCircle className="h-2.5 w-2.5" /> Falhou
                    </Badge>
                  )}
                </div>

                {run.status === 'success' && run.result && (
                  <div className="space-y-2">
                    {/* Per-run metrics row */}
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Gauge className="h-2.5 w-2.5" />
                        <span className="tabular-nums text-foreground">
                          {((run.result.confidence_score ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-2.5 w-2.5" />
                        <span className="tabular-nums text-foreground">
                          ${(run.result.metrics?.total_cost_usd ?? 0).toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Hash className="h-2.5 w-2.5" />
                        <span className="tabular-nums text-foreground">
                          {(run.result.metrics?.total_tokens ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-[280px] overflow-y-auto pr-1 pt-2 border-t border-border/30">
                      {run.result.final_response ?? 'Sem resposta'}
                    </div>
                    {(run.result.metrics?.models_used ?? 0) > 0 && (
                      <div className="pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
                        {run.result.metrics.models_used} modelos · consenso {((run.result.consensus_degree ?? 0) * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                )}

                {run.status === 'failed' && (
                  <p className="text-[11px] text-destructive italic">
                    {run.error ?? 'Erro desconhecido'}
                  </p>
                )}

                {run.status === 'pending' && (
                  <p className="text-[11px] text-muted-foreground italic text-center py-6">
                    Aguardando turno...
                  </p>
                )}

                {run.status === 'running' && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
