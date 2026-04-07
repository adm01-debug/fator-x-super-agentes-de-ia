import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, GitMerge, Layers, AlertTriangle, Trash2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  resolveMemoryEntities,
  mergeEntityCluster,
  type EntityCluster,
} from "@/services/entityResolutionService";
import { AccessControl, DangerousActionDialog } from "@/components/rbac";

export function EntityResolutionTab() {
  const queryClient = useQueryClient();
  const [threshold, setThreshold] = useState(0.7);
  const [scanLimit, setScanLimit] = useState(200);
  const [mergingId, setMergingId] = useState<string | null>(null);

  const { data: report, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['entity-resolution', threshold, scanLimit],
    queryFn: () => resolveMemoryEntities(scanLimit, threshold),
  });

  const handleMerge = async (cluster: EntityCluster) => {
    setMergingId(cluster.canonical.id);
    try {
      const deleted = await mergeEntityCluster(cluster);
      toast.success(`${deleted} duplicata(s) removida(s)`);
      await queryClient.invalidateQueries({ queryKey: ['entity-resolution'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao mesclar');
    } finally {
      setMergingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-primary" /> Entity Resolution
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Detecta memórias duplicadas ou near-duplicates usando similaridade Jaccard. Mescle clusters para reduzir ruído na base.
        </p>
      </div>

      {/* Controls */}
      <div className="nexus-card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Limite de similaridade</Label>
              <span className="text-xs font-mono font-semibold text-primary">{threshold.toFixed(2)}</span>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={(v) => setThreshold(v[0])}
              min={0.5}
              max={0.95}
              step={0.05}
              className="cursor-pointer"
            />
            <p className="text-[10px] text-muted-foreground">
              {threshold < 0.6 ? 'Permissivo — pode capturar falsos positivos' :
               threshold < 0.8 ? 'Equilibrado' :
               'Restritivo — apenas duplicatas óbvias'}
            </p>
          </div>
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
              className="cursor-pointer"
            />
            <p className="text-[10px] text-muted-foreground">
              Mais memórias = análise mais completa, porém mais lenta
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            size="sm"
            className="gap-1.5"
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Re-escanear
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="nexus-card text-center py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Escaneadas</p>
          <p className="text-xl font-bold text-primary mt-1">{report?.total_scanned ?? 0}</p>
        </div>
        <div className="nexus-card text-center py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Clusters</p>
          <p className="text-xl font-bold text-nexus-purple mt-1">{report?.cluster_count ?? 0}</p>
        </div>
        <div className="nexus-card text-center py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Duplicatas</p>
          <p className="text-xl font-bold text-nexus-amber mt-1">{report?.duplicates_found ?? 0}</p>
        </div>
      </div>

      {/* Clusters list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (report?.clusters ?? []).length === 0 ? (
        <div className="nexus-card text-center py-12">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma duplicata detectada com este limite</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Tente reduzir o limite de similaridade para capturar duplicatas mais sutis
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(report?.clusters ?? []).map((cluster) => (
            <div key={cluster.canonical.id} className="nexus-card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-nexus-amber" />
                  <div>
                    <p className="text-xs font-semibold">Cluster de {cluster.size} entradas</p>
                    <p className="text-[10px] text-muted-foreground">
                      Similaridade média: {(cluster.avg_similarity * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
                <AccessControl permission="knowledge.delete">
                  <DangerousActionDialog
                    trigger={
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 text-destructive"
                        disabled={mergingId === cluster.canonical.id}
                      >
                        {mergingId === cluster.canonical.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <GitMerge className="h-3 w-3" />
                        )}
                        Mesclar
                      </Button>
                    }
                    title="Mesclar cluster de duplicatas"
                    description={
                      <>
                        <p>Esta ação manterá apenas a entrada canônica (mais longa) e excluirá as {cluster.duplicates.length} duplicatas restantes.</p>
                        <p>Esta operação é irreversível.</p>
                      </>
                    }
                    action="bulk_delete"
                    resourceType="agent_memory_cluster"
                    resourceName={`${cluster.duplicates.length} duplicatas`}
                    minReasonLength={8}
                    confirmLabel="Mesclar Cluster"
                    metadata={{
                      canonical_id: cluster.canonical.id,
                      duplicate_ids: cluster.duplicates.map((d) => d.id),
                      avg_similarity: cluster.avg_similarity,
                    }}
                    onConfirm={async () => {
                      await handleMerge(cluster);
                    }}
                  />
                </AccessControl>
              </div>

              {/* Canonical */}
              <div className="p-3 rounded-lg bg-nexus-emerald/5 border border-nexus-emerald/30">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[9px] border-nexus-emerald/50 text-nexus-emerald">
                    Canônico
                  </Badge>
                  {cluster.canonical.source && (
                    <span className="text-[10px] text-muted-foreground">{cluster.canonical.source}</span>
                  )}
                </div>
                <p className="text-xs text-foreground">{cluster.canonical.content}</p>
              </div>

              {/* Duplicates */}
              <div className="space-y-1.5 pl-4 border-l-2 border-border/30">
                {cluster.duplicates.map((dup) => (
                  <div key={dup.id} className="p-2 rounded bg-secondary/30 border border-border/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Trash2 className="h-2.5 w-2.5 text-destructive" />
                      <Badge variant="outline" className="text-[9px]">Duplicata</Badge>
                      {dup.source && (
                        <span className="text-[10px] text-muted-foreground">{dup.source}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{dup.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
