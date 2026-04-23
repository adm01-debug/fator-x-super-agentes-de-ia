import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, GitCompare, Eye, GitBranch, Link2, Check } from "lucide-react";
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
import { ShareTimelineState } from "@/components/agents/versioning/ShareTimelineState";
import { VersionDetailPanel } from "@/components/agents/versioning/VersionDetailPanel";
import { VersionComparePanel } from "@/components/agents/versioning/VersionComparePanel";
import { NewVersionDialog } from "@/components/agents/versioning/NewVersionDialog";
import { TimelinePresetBar } from "@/components/agents/versioning/TimelinePresetBar";
import { TIMELINE_PRESETS, getPresetById, matchesPreset, getVersionTags, type TimelineTag } from "@/components/agents/versioning/timelineFilters";
import { EventTypeFilter } from "@/components/agents/versioning/EventTypeFilter";
import {
  TimelineRangeFilter,
  filterByRange,
  parseRange,
  serializeRange,
  type TimelineRange,
} from "@/components/agents/versioning/TimelineRangeFilter";
import { loadTimelinePrefs, saveTimelinePrefs } from "@/components/agents/versioning/timelinePrefs";
import { RunFilter } from "@/components/agents/versioning/RunFilter";
import { FilteredEmptyState } from "@/components/agents/versioning/FilteredEmptyState";

export default function AgentVersioningPage() {
  const { id, versionId: pathVersionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  // Compatibilidade: aceita tanto o path-segment moderno (/versions/v/:versionId)
  // quanto o legado (?focus=). O path-segment tem prioridade quando presente.
  const focusId = pathVersionId ?? searchParams.get('focus');

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

  // Filtro multi-tag por tipo de evento — persiste na URL como `types=a,b,c`
  // e aplica AND com o preset ativo (preset filtra "modo de uso", types
  // restringe a categoria de mudança que estou investigando).
  const typesParam = searchParams.get('types') ?? '';
  const activeTypes = useMemo<Set<TimelineTag>>(() => {
    if (!typesParam) return new Set();
    return new Set(
      typesParam.split(',').filter((t): t is TimelineTag =>
        ['prompt', 'tools', 'model', 'guardrails', 'rag', 'rollback', 'failure'].includes(t),
      ),
    );
  }, [typesParam]);
  const toggleType = (tag: TimelineTag) => {
    const next = new Set(activeTypes);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    updateParams((p) => {
      next.size > 0 ? p.set('types', Array.from(next).join(',')) : p.delete('types');
    });
  };
  const clearTypes = () =>
    updateParams((p) => { p.delete('types'); });

  // Intervalo (versão ou tempo) também persiste na URL via `range=` para
  // manter o link compartilhável com a mesma "fatia" da timeline.
  const range: TimelineRange = parseRange(searchParams.get('range'));
  const setRange = (r: TimelineRange) =>
    updateParams((p) => {
      const s = serializeRange(r);
      s ? p.set('range', s) : p.delete('range');
    });
  // Execução (sessão) escolhida — persistida como ?run=<session_id> além do
  // range absoluto. Isso torna o link autoexplicativo ("estou olhando a run X")
  // e permite reidentificar a run mesmo se a janela for ajustada manualmente.
  const runId = searchParams.get('run');
  const setRunAndRange = (r: TimelineRange, rid: string | null) =>
    updateParams((p) => {
      const s = serializeRange(r);
      s ? p.set('range', s) : p.delete('range');
      rid ? p.set('run', rid) : p.delete('run');
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

  // Hidratação dos filtros (preset/range/mode) a partir do localStorage por
  // agente — só aplica quando a URL NÃO traz nenhum desses params, para que
  // links compartilhados sempre vençam preferências locais. Roda uma única vez
  // por agente (chave `id`).
  useEffect(() => {
    if (!id) return;
    const hasUrlFilters =
      searchParams.has('preset') || searchParams.has('range') || searchParams.has('mode');
    if (hasUrlFilters) return;
    const prefs = loadTimelinePrefs(id);
    if (!prefs) return;
    updateParams((p) => {
      if (prefs.preset && prefs.preset !== 'all') p.set('preset', prefs.preset);
      if (prefs.range) p.set('range', prefs.range);
      if (prefs.mode === 'compare') p.set('mode', 'compare');
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Salva preferências sempre que filtros mudam — debounce simples via
  // microtask não é necessário pois `updateParams` é síncrono e o usuário
  // não dispara isso em loop.
  useEffect(() => {
    if (!id) return;
    saveTimelinePrefs(id, {
      preset: presetId,
      range: serializeRange(range) ?? undefined,
      mode,
    });
  }, [id, presetId, mode, searchParams]);

  // Inicialização da URL: roda APENAS na primeira chegada das versões (ou quando
  // muda o `focusId`). Nunca reescreve `sel`/`a`/`b`/`mode` depois disso — assim
  // alternar entre detalhe/comparar ou recarregar a query NÃO muda o que o
  // usuário já tem selecionado/fixado.
  useEffect(() => {
    if (versions.length === 0) return;
    // Prioridade 1: foco vindo via path (/v/:id) ou query (?focus=).
    if (focusId && versions.some(v => v.id === focusId)) {
      if (pathVersionId) {
        const next = new URLSearchParams(searchParams);
        next.set('sel', focusId);
        const qs = next.toString();
        navigate(`/agents/${id}/versions${qs ? `?${qs}` : ''}`, { replace: true });
      } else {
        updateParams((p) => {
          p.set('sel', focusId);
          p.delete('focus');
        }, { replace: true });
      }
      setHighlightId(focusId);
      const t = setTimeout(() => setHighlightId(null), 2800);
      return () => clearTimeout(t);
    }
    // Prioridade 2: seeding inicial — só preenche `sel` se nada estiver setado.
    // NÃO toca em A/B aqui: A/B só são auto-preenchidos quando o usuário entra
    // explicitamente em "comparar" (efeito abaixo). Isso evita que recarregar a
    // lista mude valores que o usuário já consolidou.
    if (!selectedId) {
      updateParams((p) => { p.set('sel', versions[0].id); }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions.length, focusId]);

  // Auto-preenche A/B uma única vez ao entrar em "comparar" — sem sobrescrever
  // escolhas existentes e sem reagir a mudanças posteriores na lista.
  useEffect(() => {
    if (mode !== 'compare') return;
    if (versions.length < 2) return;
    if (aId && bId) return;
    updateParams((p) => {
      if (!aId) p.set('a', versions[1].id);
      if (!bId) p.set('b', versions[0].id);
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, versions.length]);

  // Sanitização defensiva da URL: se `sel`/`a`/`b` apontarem para IDs que não
  // existem (link antigo, versão deletada, ID copiado de outro agente, typo),
  // limpamos o param e caímos no default — sem quebrar a tela. Também rebaixa
  // `mode=compare` para `detail` se A ou B ficarem inválidos. Roda só depois
  // que `versions` carregou; nunca toca em params válidos.
  useEffect(() => {
    if (versions.length === 0) return;
    const validIds = new Set(versions.map((v) => v.id));
    const selInvalid = !!selectedId && !validIds.has(selectedId);
    const aInvalid = !!aId && !validIds.has(aId);
    const bInvalid = !!bId && !validIds.has(bId);
    if (!selInvalid && !aInvalid && !bInvalid) return;
    const stale: string[] = [];
    if (selInvalid) stale.push('seleção');
    if (aInvalid) stale.push('A');
    if (bInvalid) stale.push('B');
    updateParams((p) => {
      if (selInvalid) p.set('sel', versions[0].id);
      if (aInvalid) p.delete('a');
      if (bInvalid) p.delete('b');
      // Se estávamos comparando e A ou B ficou inválido, compare deixa de ter
      // sentido — volta para detalhe até o usuário escolher novo par.
      if ((aInvalid || bInvalid) && mode === 'compare') p.delete('mode');
    }, { replace: true });
    toast.info(
      `Link ajustado — ${stale.join(', ')} apontava${stale.length > 1 ? 'm' : ''} para versões indisponíveis`,
      { duration: 4000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, selectedId, aId, bId]);

  // Resolve seleção/A/B sempre contra a lista COMPLETA, nunca a filtrada — assim
  // mudar preset/intervalo nunca "perde" o que está selecionado. Só caímos no
  // fallback `versions[0]` se realmente não houver `selectedId` na URL.
  const selected = useMemo(
    () => (selectedId ? versions.find(v => v.id === selectedId) ?? null : versions[0] ?? null),
    [versions, selectedId],
  );
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
      list = filterByRange(list, range);
      // Mantém pinned (current/sel/A/B) para não quebrar a navegação ativa.
      const pinned = versions.filter((v) => pinnedIds.has(v.id) && !list.some((x) => x.id === v.id));
      list = [...list, ...pinned].sort((a, b) => b.version - a.version);
    }
    if (activePreset.id !== 'all') {
      list = list.filter((v) => pinnedIds.has(v.id) || matchesPreset(v, activePreset));
    }
    if (activeTypes.size > 0) {
      // AND com preset: a versão precisa ter pelo menos uma das tags ativas
      // (OR entre tags selecionadas — comportamento esperado de chips toggle).
      list = list.filter((v) => {
        if (pinnedIds.has(v.id)) return true;
        const tags = getVersionTags(v);
        for (const t of activeTypes) if (tags.has(t)) return true;
        return false;
      });
    }
    return list;
  }, [versions, activePreset, pinnedIds, range, activeTypes]);
  // Contagens por tag sobre a lista completa (não filtrada) — assim o número
  // ao lado de cada chip mostra "quantas existem", não "quantas restam".
  const typeCounts = useMemo(() => {
    const counts: Partial<Record<TimelineTag, number>> = {};
    for (const v of versions) {
      const tags = getVersionTags(v);
      for (const t of tags) counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [versions]);
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
            <CopyLinkButton />
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
            {/* Filtro multi-tag por tipo de evento — aplica AND com o preset
                e mostra contagem total por tag (não filtrada) para guiar a escolha. */}
            <EventTypeFilter
              active={activeTypes}
              onToggle={toggleType}
              onClear={clearTypes}
              counts={typeCounts}
            />
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Intervalo
              </span>
              <TimelineRangeFilter range={range} onChange={setRange} versions={versions} />
              {/* Filtro por execução: aplica a janela temporal (min/max
                  created_at dos traces) da sessão escolhida ao range geral. */}
              <RunFilter agentId={id!} currentRange={range} activeRunId={runId} onApply={setRunAndRange} />
              {(versionA && versionB) && range.mode !== 'version' && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setRange({
                    mode: 'version',
                    vMin: Math.min(versionA.version, versionB.version),
                    vMax: Math.max(versionA.version, versionB.version),
                  })}
                  title="Filtrar timeline para o intervalo entre A e B"
                >
                  entre A↔B
                </Button>
              )}
            </div>
            {filteredVersions.length === 0 && versions.length > 0 ? (
              // Empty state rico: lista os filtros ativos como "chips clicáveis"
              // que limpam exatamente aquele filtro. Reduz a fricção de "está
              // vazio mas eu não sei o que tirar pra ver de novo".
              <FilteredEmptyState
                totalVersions={versions.length}
                activePresetLabel={activePreset.id !== 'all' ? activePreset.label : null}
                rangeActive={range.mode !== 'off'}
                runId={runId}
                activeTypes={Array.from(activeTypes)}
                onClearPreset={() => setPreset('all')}
                onClearRange={() => setRunAndRange({ mode: 'off' }, null)}
                onClearTypes={clearTypes}
                onClearAll={() => {
                  updateParams((p) => {
                    p.delete('preset');
                    p.delete('range');
                    p.delete('run');
                    p.delete('types');
                  });
                }}
              />
            ) : (
              <VersionTimeline
                versions={filteredVersions}
                selectedId={selectedId}
                selectedAId={aId}
                selectedBId={bId}
                onSelect={(vid) => { setSelectedId(vid); }}
                onPickA={(vid) => { setAId(vid); }}
                onPickB={(vid) => { setBId(vid); }}
                highlightId={highlightId}
                agentId={id!}
              />
            )}
            {(activePreset.id !== 'all' || range.mode !== 'off' || activeTypes.size > 0) && filteredVersions.length > 0 && filteredVersions.length < versions.length && (
              <p className="text-[10px] text-muted-foreground mt-2 px-1">
                Mostrando {filteredVersions.length} de {versions.length} versões
                {activePreset.id !== 'all' && <> · preset "{activePreset.label}"</>}
                {range.mode !== 'off' && <> · intervalo ativo</>}
                {runId && <> · run …{runId.slice(-6)}</>}
                {activeTypes.size > 0 && <> · tipos: {Array.from(activeTypes).join(', ')}</>}.
              </p>
            )}
            {/* Compartilhamento — resumo do estado (sel/A/B/modo/preset) +
                link absoluto + bloco markdown copiável para colar em mensagens. */}
            <div className="mt-4">
              <ShareTimelineState
                agentName={agent.name}
                selected={selected}
                versionA={versionA}
                versionB={versionB}
                mode={mode}
                presetLabel={activePreset.label}
                typesLabels={Array.from(activeTypes)}
                runId={runId}
                rangeLabel={
                  range.mode === 'version' && (range.vMin !== undefined || range.vMax !== undefined)
                    ? `v${range.vMin ?? '…'}–v${range.vMax ?? '…'}`
                    : range.mode === 'time' && range.lastMinutes
                    ? `últimos ${range.lastMinutes}min`
                    : range.mode === 'time' && (range.fromIso || range.toIso)
                    ? 'período custom'
                    : undefined
                }
              />
            </div>
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

/**
 * CopyLinkButton — botão local com estado de "copiado" para a URL atual.
 *
 * Fica no header da página de versionamento. Como TODOS os filtros
 * (sel/a/b/mode/preset/range/types/run) já vivem na URL, copiar
 * `window.location.href` é suficiente para reproduzir a investigação no time.
 *
 * Usar `useSearchParams` como dependência garante re-render — assim o
 * `window.location.href` capturado no handler é sempre o atual.
 */
function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  // Re-render quando os params mudarem (handler pega href fresco).
  useSearchParams();
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('Link copiado — a mesma visão da timeline será aberta');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };
  return (
    <Button
      size="sm"
      variant={copied ? 'default' : 'outline'}
      className={`gap-1.5 ${copied ? 'bg-nexus-emerald/15 text-nexus-emerald hover:bg-nexus-emerald/25 border border-nexus-emerald/40' : ''}`}
      onClick={handleCopy}
      title="Copia a URL atual com TODOS os filtros (versão, A/B, modo, preset, intervalo, tipos, execução)"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? 'Copiado' : 'Copiar link'}
    </Button>
  );
}
