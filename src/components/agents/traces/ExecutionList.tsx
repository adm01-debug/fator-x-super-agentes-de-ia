import { useMemo, useState, type ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, CheckCircle2, Clock, DollarSign, Filter, Inbox, Play, Search, X, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import type { ExecutionGroup, AgentTraceRow } from '@/services/agentTracesService';
import { highlightMatch, matchesAny } from './highlightMatch';

interface Props {
  executions: ExecutionGroup[];
  selectedId: string | null;
  onSelect: (e: ExecutionGroup) => void;
  onReplay?: (e: ExecutionGroup) => void;
  loading: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  /** Optional renderer that wraps the "Limpar filtros" button (e.g. ConfirmDialog). */
  clearFiltersWrapper?: (button: ReactNode) => ReactNode;
}

/**
 * Builds the searchable corpus for an execution: events, endpoints/URLs from
 * metadata, tags, status messages and IDs. Lowercased once for fast filtering.
 */
function buildHaystacks(group: ExecutionGroup): string[] {
  const out: string[] = [group.session_id];
  for (const t of group.traces) {
    out.push(t.event);
    out.push(t.level);
    const meta = t.metadata as Record<string, unknown> | null;
    if (meta) {
      for (const key of ['endpoint', 'url', 'path', 'route', 'message', 'msg', 'error', 'status']) {
        const v = meta[key];
        if (typeof v === 'string') out.push(v);
        else if (typeof v === 'number') out.push(String(v));
      }
      const tags = meta.tags;
      if (Array.isArray(tags)) {
        for (const tag of tags) if (typeof tag === 'string') out.push(tag);
      }
    }
  }
  return out;
}

/** Picks the most "interesting" trace to surface as a one-line preview. */
function pickPreviewTrace(group: ExecutionGroup, q: string): AgentTraceRow | null {
  if (group.traces.length === 0) return null;
  if (q.trim()) {
    const lower = q.toLowerCase();
    const hit = group.traces.find((t) => {
      const meta = t.metadata as Record<string, unknown> | null;
      const fields = [
        t.event,
        meta?.endpoint, meta?.url, meta?.path, meta?.route,
        meta?.message, meta?.msg, meta?.error,
      ];
      return fields.some((v) => typeof v === 'string' && v.toLowerCase().includes(lower));
    });
    if (hit) return hit;
  }
  // Fallback: prefer first error, then first warning, then first trace.
  return (
    group.traces.find((t) => t.level === 'error') ??
    group.traces.find((t) => t.level === 'warning') ??
    group.traces[0]
  );
}

function previewLine(t: AgentTraceRow): string {
  const meta = t.metadata as Record<string, unknown> | null;
  const endpoint = (meta?.endpoint || meta?.url || meta?.path || meta?.route) as string | undefined;
  const message = (meta?.message || meta?.msg || meta?.error) as string | undefined;
  if (endpoint && message) return `${t.event} · ${endpoint} — ${message}`;
  if (endpoint) return `${t.event} · ${endpoint}`;
  if (message) return `${t.event} — ${message}`;
  return t.event;
}

function previewTags(t: AgentTraceRow): string[] {
  const meta = t.metadata as Record<string, unknown> | null;
  const tags = meta?.tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter((x): x is string => typeof x === 'string').slice(0, 3);
}

export function ExecutionList({ executions, selectedId, onSelect, onReplay, loading, hasActiveFilters, onClearFilters, clearFiltersWrapper }: Props) {
  const [localQuery, setLocalQuery] = useState('');

  const filtered = useMemo(() => {
    const q = localQuery.trim();
    if (!q) return executions;
    return executions.filter((e) => matchesAny(q, buildHaystacks(e)));
  }, [executions, localQuery]);

  if (loading) {
    return (
      <div className="p-3 space-y-2" aria-busy="true" aria-label="Carregando execuções">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    );
  }
  if (executions.length === 0) {
    if (!hasActiveFilters) {
      return (
        <EmptyState
          icon={Inbox}
          illustration="data"
          title="Sem traces ainda"
          description="Quando seus agentes começarem a executar, as sessões aparecerão aqui em tempo real."
        />
      );
    }
    const button = onClearFilters ? (
      <Button onClick={onClearFilters} size="sm" className="gap-1.5">Limpar filtros</Button>
    ) : null;
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in-up" role="status">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center border border-primary/10" aria-hidden>
            <span className="text-3xl">🔍</span>
          </div>
          <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-1.5">Nenhuma execução para esses filtros</h3>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          Ajuste o nível, evento, agente ou janela temporal para ampliar a busca.
        </p>
        {button && (
          <div className="mt-5">
            {clearFiltersWrapper ? clearFiltersWrapper(button) : button}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[640px]">
      {/* Local search bar */}
      <div className="p-2 border-b border-border/40 bg-secondary/20">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden />
          <input
            type="search"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Filtrar por mensagem, endpoint ou tag…"
            aria-label="Filtrar execuções carregadas por mensagem, endpoint ou tag"
            className="w-full h-7 pl-7 pr-7 text-xs rounded-md bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/70"
          />
          {localQuery && (
            <button
              type="button"
              onClick={() => setLocalQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Limpar filtro local"
              title="Limpar"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {localQuery && (
          <p className="mt-1 text-[10px] text-muted-foreground px-0.5" role="status" aria-live="polite">
            {filtered.length} de {executions.length} execuç{executions.length === 1 ? 'ão' : 'ões'}
            {filtered.length === 0 ? ' — nenhuma corresponde' : ''}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center" role="status">
          <Search className="h-6 w-6 text-muted-foreground/50 mb-2" aria-hidden />
          <p className="text-xs font-medium text-foreground">Nenhum match para "{localQuery}"</p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
            Tente outro termo, ou limpe a busca para ver todas as {executions.length} execuções carregadas.
          </p>
          <Button size="sm" variant="outline" className="mt-3 h-7 text-xs" onClick={() => setLocalQuery('')}>
            Limpar busca
          </Button>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <ul className="divide-y divide-border/40" role="listbox" aria-label="Execuções">
            {filtered.map((e) => {
              const active = selectedId === e.session_id;
              const dotColor =
                e.counts.error > 0 ? 'bg-destructive' :
                e.counts.warning > 0 ? 'bg-nexus-amber' : 'bg-nexus-emerald';
              const preview = pickPreviewTrace(e, localQuery);
              const tags = preview ? previewTags(preview) : [];
              return (
                <li key={e.session_id} className="relative group">
                  <button
                    onClick={() => onSelect(e)}
                    aria-selected={active}
                    role="option"
                    className={`w-full text-left p-3 transition-colors hover:bg-muted/40 ${
                      active ? 'bg-primary/8 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden />
                        <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[200px]">
                          {e.session_id.startsWith('auto-')
                            ? '∅ sem session'
                            : highlightMatch(e.session_id.slice(0, 18), localQuery)}
                        </span>
                      </div>
                      <span className={`text-[10px] text-muted-foreground shrink-0 ${onReplay ? 'mr-16' : ''}`}>
                        {new Date(e.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {preview && (
                      <p className="text-[11px] text-foreground/85 truncate mb-1.5" title={previewLine(preview)}>
                        {highlightMatch(previewLine(preview), localQuery)}
                      </p>
                    )}

                    {tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mb-1.5">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground font-mono"
                          >
                            #{highlightMatch(tag, localQuery)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Activity className="h-2.5 w-2.5" />{e.traces.length}</span>
                      <span className="flex items-center gap-1 text-nexus-emerald"><CheckCircle2 className="h-2.5 w-2.5" />{e.counts.info}</span>
                      {e.counts.warning > 0 && (
                        <span className="flex items-center gap-1 text-nexus-amber"><AlertTriangle className="h-2.5 w-2.5" />{e.counts.warning}</span>
                      )}
                      {e.counts.error > 0 && (
                        <span className="flex items-center gap-1 text-destructive"><XCircle className="h-2.5 w-2.5" />{e.counts.error}</span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{e.total_ms}ms</span>
                      {e.total_cost > 0 && (
                        <span className="flex items-center gap-1"><DollarSign className="h-2.5 w-2.5" />${e.total_cost.toFixed(4)}</span>
                      )}
                    </div>
                  </button>
                  {onReplay && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(ev) => { ev.stopPropagation(); onSelect(e); onReplay(e); }}
                      className="absolute top-2 right-2 h-6 px-2 text-[10px] gap-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-primary/10 hover:bg-primary/20 text-primary"
                      aria-label={`Replay da execução ${e.session_id}`}
                      title="Reproduzir esta execução passo a passo"
                    >
                      <Play className="h-2.5 w-2.5" /> Replay
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
