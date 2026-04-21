import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, GitCompare, Eye, GitBranch } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";
import {
  getAgentById,
  getAgentVersions,
  restoreAgentVersion,
  type AgentVersion,
  type RestoreOptions,
} from "@/services/agentsService";
import { VersionTimeline } from "@/components/agents/versioning/VersionTimeline";
import { VersionDetailPanel } from "@/components/agents/versioning/VersionDetailPanel";
import { VersionComparePanel } from "@/components/agents/versioning/VersionComparePanel";
import { NewVersionDialog } from "@/components/agents/versioning/NewVersionDialog";

export default function AgentVersioningPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [mode, setMode] = useState<'detail' | 'compare'>('detail');
  const [newOpen, setNewOpen] = useState(false);

  const { data: agent } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => getAgentById(id!),
    enabled: !!id,
  });

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['agent-versions', id],
    queryFn: () => getAgentVersions(id!, 50),
    enabled: !!id,
  });

  // Auto-select latest, and last 2 for compare
  useEffect(() => {
    if (versions.length > 0 && !selectedId) {
      setSelectedId(versions[0].id);
      if (versions.length >= 2) {
        setAId(versions[1].id);
        setBId(versions[0].id);
      }
    }
  }, [versions, selectedId]);

  const selected = useMemo(() => versions.find(v => v.id === selectedId) ?? versions[0] ?? null, [versions, selectedId]);
  const versionA = useMemo(() => versions.find(v => v.id === aId) ?? null, [versions, aId]);
  const versionB = useMemo(() => versions.find(v => v.id === bId) ?? null, [versions, bId]);
  const canCompare = !!versionA && !!versionB && versionA.id !== versionB.id;

  const current = versions[0] ?? null;
  const nextVersionNumber = (current?.version ?? 0) + 1;

  const restoreMut = useMutation({
    mutationFn: ({ source, options }: { source: AgentVersion; options: RestoreOptions }) =>
      restoreAgentVersion(id!, source, current, options),
    onSuccess: (data) => {
      toast.success(`Versão v${data.version} criada — ${data.change_summary ?? 'restauração'}`);
      queryClient.invalidateQueries({ queryKey: ['agent-versions', id] });
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      setSelectedId(data.id);
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao restaurar'),
  });

  const handleDuplicateAsDraft = (v: AgentVersion) => {
    try {
      sessionStorage.setItem(`agent-draft:${id}`, JSON.stringify({
        model: v.model, persona: v.persona, mission: v.mission, config: v.config,
        from_version: v.version,
      }));
    } catch (err) {
      // sessionStorage can fail in private mode — non-fatal
      void err;
    }
    toast.success(`Conteúdo de v${v.version} carregado no Builder`);
    navigate(`/builder/${id}`);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!agent) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">Agente não encontrado.</p>
        <Button onClick={() => navigate('/agents')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title={`Versionamento — ${agent.name}`}
        description="Crie novas versões do prompt e ferramentas com changelog automático e comparação visual."
        backTo={`/agents/${id}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5 nexus-gradient-bg text-primary-foreground hover:opacity-90"
              onClick={() => setNewOpen(true)}
              disabled={!selected}
            >
              <Plus className="h-3.5 w-3.5" /> Nova versão
            </Button>
          </div>
        }
      />

      {versions.length === 0 ? (
        <div className="nexus-card flex flex-col items-center justify-center py-16 text-center">
          <GitBranch className="h-10 w-10 text-muted-foreground/30 mb-3" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground mb-1">Nenhuma versão registrada</h3>
          <p className="text-xs text-muted-foreground mb-4">Crie a primeira versão para começar o histórico.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <VersionTimeline
              versions={versions}
              selectedId={selectedId}
              selectedAId={aId}
              selectedBId={bId}
              onSelect={(vid) => { setSelectedId(vid); setMode('detail'); }}
              onPickA={(vid) => { setAId(vid); if (bId && vid !== bId) setMode('compare'); }}
              onPickB={(vid) => { setBId(vid); if (aId && vid !== aId) setMode('compare'); }}
            />
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-1.5 p-1 bg-secondary/40 rounded-lg w-fit">
              <Button
                size="sm" variant={mode === 'detail' ? 'default' : 'ghost'}
                className="h-7 text-xs gap-1.5"
                onClick={() => setMode('detail')}
              >
                <Eye className="h-3 w-3" /> Detalhe {selected ? `v${selected.version}` : ''}
              </Button>
              <Button
                size="sm" variant={mode === 'compare' ? 'default' : 'ghost'}
                className="h-7 text-xs gap-1.5"
                disabled={!canCompare}
                onClick={() => setMode('compare')}
                title={!canCompare ? 'Selecione duas versões diferentes (A e B) na timeline' : undefined}
              >
                <GitCompare className="h-3 w-3" />
                Comparar {versionA && versionB ? `v${versionA.version} ↔ v${versionB.version}` : ''}
              </Button>
            </div>

            {mode === 'detail' && selected && (
              <VersionDetailPanel
                version={selected}
                isCurrent={versions[0]?.id === selected.id}
                restoring={restoreMut.isPending}
                onRestore={() => restoreMut.mutate(selected)}
                onDuplicate={() => handleDuplicateAsDraft(selected)}
              />
            )}

            {mode === 'compare' && canCompare && versionA && versionB && (
              <VersionComparePanel versionA={versionA} versionB={versionB} />
            )}

            {mode === 'compare' && !canCompare && (
              <div className="nexus-card text-center py-10">
                <GitCompare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" aria-hidden />
                <p className="text-xs text-muted-foreground">
                  Selecione duas versões diferentes (botões A e B na timeline) para comparar.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {selected && (
        <NewVersionDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          agentId={id!}
          baseVersion={selected}
        />
      )}
    </div>
  );
}
