import { useState } from "react";
import {
  Loader2,
  Sparkles,
  GitCompare,
  CheckCircle2,
  XCircle,
  Trophy,
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

  // Find the "winner" by shortest finished response (proxy for confidence/certainty)
  const successfulRuns = runs.filter((r) => r.status === 'success');
  const fastestId = successfulRuns.length > 0
    ? successfulRuns.reduce((min, r) => (r.duration_ms < min.duration_ms ? r : min)).mode
    : null;

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

      {/* Results grid */}
      {runs.length > 0 && (
        <div className={`grid gap-3 ${runs.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {runs.map((run) => {
            const modeInfo = ORACLE_MODES[run.mode];
            const isFastest = fastestId === run.mode && run.status === 'success';
            return (
              <div
                key={run.mode}
                className={`nexus-card space-y-3 ${
                  isFastest ? 'ring-1 ring-nexus-amber/50' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{modeInfo.icon}</span>
                    <p className="text-xs font-semibold truncate">{modeInfo.label}</p>
                    {isFastest && (
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
                    <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto pr-1">
                      {(run.result as any).synthesis ?? (run.result as any).summary ?? 'Sem síntese'}
                    </div>
                    {((run.result as any).responses?.length ?? 0) > 0 && (
                      <div className="pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
                        {(run.result as any).responses.length} modelos consultados
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
