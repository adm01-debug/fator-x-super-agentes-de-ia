import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  TrendingDown,
  CheckCircle2,
  Clock,
  RefreshCw,
  Archive,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  detectKnowledgeDecay,
  archiveDecayedItems,
  type DecayLevel,
  type DecayItem,
} from "@/services/knowledgeDecayService";
import { AccessControl, DangerousActionDialog } from "@/components/rbac";

const LEVEL_CONFIG: Record<DecayLevel, { label: string; color: string; bgClass: string; icon: typeof CheckCircle2 }> = {
  fresh: { label: 'Fresco', color: 'hsl(var(--nexus-emerald))', bgClass: 'bg-nexus-emerald/10 border-nexus-emerald/30', icon: CheckCircle2 },
  review: { label: 'Revisar', color: 'hsl(var(--nexus-yellow))', bgClass: 'bg-nexus-amber/10 border-nexus-amber/30', icon: Clock },
  refresh: { label: 'Atualizar', color: 'hsl(var(--nexus-orange))', bgClass: 'bg-orange-500/10 border-orange-500/30', icon: RefreshCw },
  archive: { label: 'Arquivar', color: 'hsl(var(--nexus-red))', bgClass: 'bg-destructive/10 border-destructive/30', icon: Archive },
};

export function DecayDetectionTab() {
  const queryClient = useQueryClient();
  const [scanLimit, setScanLimit] = useState(200);
  const [filterLevel, setFilterLevel] = useState<DecayLevel | 'all'>('all');

  const { data: report, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['knowledge-decay', scanLimit],
    queryFn: () => detectKnowledgeDecay(scanLimit),
  });

  const filteredItems = report?.items.filter(
    (i) => filterLevel === 'all' || i.level === filterLevel
  ) ?? [];

  const handleArchiveAll = async () => {
    const archiveItems = report?.items.filter((i) => i.level === 'archive') ?? [];
    if (archiveItems.length === 0) return;
    try {
      const count = await archiveDecayedItems(archiveItems.map((i) => i.id));
      toast.success(`${count} memória(s) arquivada(s)`);
      await queryClient.invalidateQueries({ queryKey: ['knowledge-decay'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao arquivar');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-primary" /> Knowledge Decay Detection
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Detecta conhecimento envelhecido ou de baixa relevância. Score combina idade (60%) + baixa importância (40%).
        </p>
      </div>

      {/* Controls */}
      <div className="nexus-card space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Memórias a escanear</Label>
            <span className="text-xs font-mono font-semibold text-primary">{scanLimit}</span>
          </div>
          <Slider
            value={[scanLimit]}
            onValueChange={(v) => setScanLimit(v[0])}
            min={50}
            max={500}
            step={50}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Re-escanear
          </Button>
          {(report?.archive_count ?? 0) > 0 && (
            <AccessControl permission="knowledge.delete">
              <DangerousActionDialog
                trigger={
                  <Button size="sm" variant="destructive" className="gap-1.5">
                    <Archive className="h-3.5 w-3.5" />
                    Arquivar Todos ({report?.archive_count})
                  </Button>
                }
                title="Arquivar memórias decaídas"
                description={
                  <>
                    <p>{report?.archive_count} memórias serão removidas permanentemente da base.</p>
                    <p>Apenas itens marcados como "Arquivar" (score &gt;= 0.75) serão afetados.</p>
                  </>
                }
                action="bulk_delete"
                resourceType="agent_memory_decay"
                resourceName={`${report?.archive_count} memórias`}
                minReasonLength={10}
                requirePassword={true}
                confirmLabel="Arquivar Tudo"
                metadata={{ count: report?.archive_count }}
                onConfirm={handleArchiveAll}
              />
            </AccessControl>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['fresh', 'review', 'refresh', 'archive'] as DecayLevel[]).map((level) => {
          const cfg = LEVEL_CONFIG[level];
          const Icon = cfg.icon;
          const count = level === 'fresh' ? report?.fresh_count :
                        level === 'review' ? report?.review_count :
                        level === 'refresh' ? report?.refresh_count :
                        report?.archive_count;
          return (
            <button
              key={level}
              onClick={() => setFilterLevel(filterLevel === level ? 'all' : level)}
              className={`nexus-card text-center py-4 transition-all hover:scale-105 ${
                filterLevel === level ? 'ring-2 ring-primary' : ''
              }`}
            >
              <Icon className="h-5 w-5 mx-auto mb-1" style={{ color: cfg.color }} />
              <p className="text-xl font-bold mt-1" style={{ color: cfg.color }}>
                {count ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {filterLevel !== 'all' && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Filtrando por: <span className="font-semibold" style={{ color: LEVEL_CONFIG[filterLevel].color }}>{LEVEL_CONFIG[filterLevel].label}</span></span>
          <button onClick={() => setFilterLevel('all')} className="text-primary hover:underline">
            Limpar filtro
          </button>
        </div>
      )}

      {/* Items list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="nexus-card text-center py-12">
          <CheckCircle2 className="h-12 w-12 mx-auto text-nexus-emerald/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {filterLevel === 'all' ? 'Nenhum item para escanear' : `Nenhum item no nível ${LEVEL_CONFIG[filterLevel].label}`}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredItems.map((item: DecayItem) => {
            const cfg = LEVEL_CONFIG[item.level];
            return (
              <div key={item.id} className={`p-3 rounded-lg border ${cfg.bgClass}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[9px]" style={{ borderColor: cfg.color + '80', color: cfg.color }}>
                        {cfg.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {item.age_days.toFixed(0)}d atrás
                      </span>
                      {item.importance != null && (
                        <span className="text-[10px] text-muted-foreground">
                          imp: {(item.importance * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{item.content_preview}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Decay</p>
                    <p className="text-sm font-bold font-mono" style={{ color: cfg.color }}>
                      {(item.decay_score * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic pl-1 border-l-2 border-border/30 ml-1">
                  {item.recommendation}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
