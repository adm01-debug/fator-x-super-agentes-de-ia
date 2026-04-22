import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, GitCompare, Eye, GitBranch, Link2 } from "lucide-react";
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
import { TimelinePresetBar } from "@/components/agents/versioning/TimelinePresetBar";
import { TIMELINE_PRESETS, getPresetById, matchesPreset } from "@/components/agents/versioning/timelineFilters";
import {
  TimelineRangeFilter,
  filterByRange,
  parseRange,
  serializeRange,
  type TimelineRange,
} from "@/components/agents/versioning/TimelineRangeFilter";

export default function AgentVersioningPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  // Estado da timeline persistido na URL para que o link possa ser compartilhado
  // ao vivo. Lemos sempre dos searchParams e escrevemos via setSearchParams.
  const selectedId = searchParams.get('sel');
  const aId = searchParams.get('a');
  const bId = searchParams.get('b');
  const modeParam = searchParams.get('mode');
  const mode: 'detail' | 'compare' = modeParam === 'compare' ? 'compare' : 'detail';
  const presetId = searchParams.get('preset') ?? 'all';
  const activePreset = getPresetById(presetId);
  const [newOpen, setNewOpen] = useState(false);
  // Quando vier um ?focus=<id>, destaca a versão por ~3s e remove o param da URL.
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Helpers para atualizar a URL preservando os demais parâmetros.
  const updateParams = (mutate: (p: URLSearchParams) => void, opts?: { replace?: boolean }) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: opts?.replace ?? false });
  };
  const setSelectedId = (vid: string | null) =>
    updateParams((p) => { vid ? p.set('sel', vid) : p.delete('sel'); });
  const setAId = (vid: string | null) =>
    updateParams((p) => { vid ? p.set('a', vid) : p.delete('a'); });
  const setBId = (vid: string | null) =>
    updateParams((p) => { vid ? p.set('b', vid) : p.delete('b'); });
  const setMode = (m: 'detail' | 'compare') =>
    updateParams((p) => { m === 'compare' ? p.set('mode', 'compare') : p.delete('mode'); });
  const setPreset = (pid: string) =>
    updateParams((p) => { pid && pid !== 'all' ? p.set('preset', pid) : p.delete('preset'); });

  // Intervalo (versão ou tempo) também persiste na URL via `range=` para
  // manter o link compartilhável com a mesma "fatia" da timeline.
  const range: TimelineRange = parseRange(searchParams.get('range'));
  const setRange = (r: TimelineRange) =>
    updateParams((p) => {
      const s = serializeRange(r);
      s ? p.set('range', s) : p.delete('range');
    });

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

  // Auto-select latest, and last 2 for compare — só preenche se a URL ainda não trouxer estado.
  useEffect(() => {
    if (versions.length === 0) return;
    // Prioridade 1: ?focus= vindo do Detail page após restore.
    if (focusId && versions.some(v => v.id === focusId)) {
      updateParams((p) => {
        p.set('sel', focusId);
        p.delete('focus');
      }, { replace: true });
      setHighlightId(focusId);
      // Auto-fade do destaque após ~2.8s (cobre 1 ciclo da animação pulse).
      const t = setTimeout(() => setHighlightId(null), 2800);
      return () => clearTimeout(t);
    }
    // Prioridade 2: seleção inicial padrão — só se a URL não trouxer nada.
    if (!selectedId && !aId && !bId) {
      updateParams((p) => {
        p.set('sel', versions[0].id);
        if (versions.length >= 2) {
          p.set('a', versions[1].id);
          p.set('b', versions[0].id);
        }
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, focusId]);

  const selected = useMemo(() => versions.find(v => v.id === selectedId) ?? versions[0] ?? null, [versions, selectedId]);
  const versionA = useMemo(() => versions.find(v => v.id === aId) ?? null, [versions, aId]);
  const versionB = useMemo(() => versions.find(v => v.id === bId) ?? null, [versions, bId]);
  const canCompare = !!versionA && !!versionB && versionA.id !== versionB.id;

  // Aplica o preset de filtro à timeline. Sempre garantimos que a versão
  // atual (índice 0), a selecionada e A/B continuem visíveis para não
  // quebrar a UX de comparação/restore — filtros restringem o ruído, não a navegação.
  const pinnedIds = useMemo(
    () => new Set([versions[0]?.id, selectedId, aId, bId].filter(Boolean) as string[]),
    [versions, selectedId, aId, bId],
  );
  const filteredVersions = useMemo(() => {
    let list = versions;
    if (range.mode !== 'off') {
      list = filterByRange(list, range).filter((v) => true);
      // Mantém pinned (current/sel/A/B) para não quebrar a navegação ativa.
      const pinned = versions.filter((v) => pinnedIds.has(v.id) && !list.some((x) => x.id === v.id));
      list = [...list, ...pinned].sort((a, b) => b.version - a.version);
    }
    if (activePreset.id !== 'all') {
      list = list.filter((v) => pinnedIds.has(v.id) || matchesPreset(v, activePreset));
    }
    return list;
  }, [versions, activePreset, pinnedIds, range]);
  const presetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const preset of TIMELINE_PRESETS) {
      counts[preset.id] = preset.id === 'all'
        ? versions.length
        : versions.filter((v) => matchesPreset(v, preset)).length;
    }
    return counts;
  }, [versions]);

  const current = versions[0] ?? null;
  const nextVersionNumber = (current?.version ?? 0) + 1;

  const restoreMut = useMutation({
    mutationFn: ({ source, options }: { source: AgentVersion; options: RestoreOptions }) =>
      restoreAgentVersion(id!, source, current, options),
    onSuccess: (data) => {
      toast.success(`Versão v${data.version} criada — ${data.change_summary ?? 'restauração'}`);
      queryClient.invalidateQueries({ queryKey: ['agent-versions', id] });
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      // Sincroniza seleção + destaque para que o usuário veja a nova versão imediatamente.
      setSelectedId(data.id);
      setHighlightId(data.id);
      setTimeout(() => setHighlightId(null), 2800);
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
              variant="outline"
              className="gap-1.5"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  toast.success('Link copiado — a mesma visão da timeline será aberta');
                } catch {
                  toast.error('Não foi possível copiar o link');
                }
              }}
              title="Copia a URL atual com a seleção da timeline (versão, A/B e modo)"
            >
              <Link2 className="h-3.5 w-3.5" /> Copiar link
            </Button>
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
            <TimelinePresetBar
              activePresetId={activePreset.id}
              onChange={setPreset}
              counts={presetCounts}
            />
            <VersionTimeline
              versions={filteredVersions}
              selectedId={selectedId}
              selectedAId={aId}
              selectedBId={bId}
              onSelect={(vid) => { setSelectedId(vid); setMode('detail'); }}
              onPickA={(vid) => { setAId(vid); if (bId && vid !== bId) setMode('compare'); }}
              onPickB={(vid) => { setBId(vid); if (aId && vid !== aId) setMode('compare'); }}
              highlightId={highlightId}
            />
            {activePreset.id !== 'all' && filteredVersions.length < versions.length && (
              <p className="text-[10px] text-muted-foreground mt-2 px-1">
                Mostrando {filteredVersions.length} de {versions.length} versões — preset "{activePreset.label}".
              </p>
            )}
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

            {mode === 'detail' && selected && current && (
              <VersionDetailPanel
                version={selected}
                isCurrent={current.id === selected.id}
                currentVersion={current}
                nextVersionNumber={nextVersionNumber}
                restoring={restoreMut.isPending}
                onRestore={(options) => restoreMut.mutate({ source: selected, options })}
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
