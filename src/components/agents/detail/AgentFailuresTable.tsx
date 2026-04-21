import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, XCircle, Search, Bell, Activity, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { getAgentFailures, type FailureRecord } from '@/services/agentsService';

interface Props {
  agentId: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const CATEGORY_STYLES: Record<string, { color: string; bg: string; border: string; Icon: typeof AlertCircle; label: string }> = {
  critical: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', Icon: XCircle, label: 'Crítico' },
  error:    { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', Icon: XCircle, label: 'Erro' },
  high:     { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', Icon: AlertCircle, label: 'Alto' },
  warning:  { color: 'text-nexus-amber', bg: 'bg-nexus-amber/10', border: 'border-nexus-amber/30', Icon: AlertTriangle, label: 'Aviso' },
  warn:     { color: 'text-nexus-amber', bg: 'bg-nexus-amber/10', border: 'border-nexus-amber/30', Icon: AlertTriangle, label: 'Aviso' },
  medium:   { color: 'text-nexus-amber', bg: 'bg-nexus-amber/10', border: 'border-nexus-amber/30', Icon: AlertTriangle, label: 'Médio' },
  low:      { color: 'text-muted-foreground', bg: 'bg-secondary/60', border: 'border-border/50', Icon: AlertCircle, label: 'Baixo' },
  info:     { color: 'text-muted-foreground', bg: 'bg-secondary/60', border: 'border-border/50', Icon: AlertCircle, label: 'Info' },
};

function styleFor(category: string) {
  return CATEGORY_STYLES[category.toLowerCase()] ?? CATEGORY_STYLES.info;
}

export function AgentFailuresTable({ agentId }: Props) {
  const { data: failures = [], isLoading } = useQuery({
    queryKey: ['agent_failures', agentId],
    queryFn: () => getAgentFailures(agentId, 200),
  });

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'alert' | 'trace'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);

  const categories = useMemo(() => {
    const set = new Set<string>();
    failures.forEach((f) => set.add(f.category.toLowerCase()));
    return Array.from(set).sort();
  }, [failures]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return failures.filter((f) => {
      if (sourceFilter !== 'all' && f.source !== sourceFilter) return false;
      if (categoryFilter !== 'all' && f.category.toLowerCase() !== categoryFilter) return false;
      if (statusFilter === 'unresolved' && (f.source !== 'alert' || f.is_resolved)) return false;
      if (statusFilter === 'resolved' && (f.source !== 'alert' || !f.is_resolved)) return false;
      if (q && !`${f.message} ${f.event ?? ''} ${f.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [failures, search, sourceFilter, categoryFilter, statusFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const counts = useMemo(() => {
    let critical = 0, errors = 0, warnings = 0, unresolved = 0;
    failures.forEach((f) => {
      const c = f.category.toLowerCase();
      if (c === 'critical') critical += 1;
      else if (c === 'error' || c === 'high') errors += 1;
      else if (c === 'warning' || c === 'warn' || c === 'medium') warnings += 1;
      if (f.source === 'alert' && !f.is_resolved) unresolved += 1;
    });
    return { critical, errors, warnings, unresolved };
  }, [failures]);

  const hasFilters = !!search || sourceFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all';
  const resetFilters = () => {
    setSearch(''); setSourceFilter('all'); setCategoryFilter('all'); setStatusFilter('all'); setPage(0);
  };

  return (
    <div className="nexus-card" role="region" aria-label="Tabela de falhas e erros">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground">Falhas e erros</h3>
          <p className="text-[11px] text-muted-foreground">
            Consolida alerts e traces com nível de erro/aviso · {total} resultado{total !== 1 ? 's' : ''} de {failures.length}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SummaryChip label="Críticos" value={counts.critical} className="text-destructive bg-destructive/10 border-destructive/30" />
          <SummaryChip label="Erros" value={counts.errors} className="text-destructive bg-destructive/10 border-destructive/30" />
          <SummaryChip label="Avisos" value={counts.warnings} className="text-nexus-amber bg-nexus-amber/10 border-nexus-amber/30" />
          <SummaryChip label="Não resolvidos" value={counts.unresolved} className="text-foreground bg-secondary/60 border-border/50" />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <div className="relative flex-1 min-w-[180px] max-w-[320px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Buscar mensagem, evento ou categoria…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="h-8 text-xs pl-8"
            aria-label="Buscar falhas"
          />
        </div>
        <Select value={sourceFilter} onValueChange={(v: 'all' | 'alert' | 'trace') => { setSourceFilter(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fontes</SelectItem>
            <SelectItem value="alert">Alerts</SelectItem>
            <SelectItem value="trace">Traces</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{styleFor(c).label} ({c})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v: 'all' | 'unresolved' | 'resolved') => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="unresolved">Não resolvidos</SelectItem>
            <SelectItem value="resolved">Resolvidos</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>Limpar</Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : pageRows.length === 0 ? (
        <div className="text-center py-10 text-xs text-muted-foreground">
          {failures.length === 0 ? 'Nenhuma falha registrada para este agente.' : 'Nenhum resultado para os filtros aplicados.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/50">
                <th className="py-2 px-2 font-medium">Categoria</th>
                <th className="py-2 px-2 font-medium">Fonte</th>
                <th className="py-2 px-2 font-medium">Mensagem</th>
                <th className="py-2 px-2 font-medium">Status</th>
                <th className="py-2 px-2 font-medium text-right">Quando</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((f) => <FailureRow key={f.id} failure={f} />)}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-muted-foreground">
              Mostrando {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, total)} de {total.toLocaleString('pt-BR')}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Por página:</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                <SelectTrigger className="h-7 w-[65px] text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Anterior</Button>
            <span className="text-[11px] text-muted-foreground px-2 min-w-[60px] text-center font-mono">{safePage + 1} / {totalPages}</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryChip({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold border px-2 py-0.5 rounded-full ${className}`}>
      <span className="tabular-nums">{value}</span>
      <span className="font-medium opacity-80">{label}</span>
    </span>
  );
}

function FailureRow({ failure }: { failure: FailureRecord }) {
  const style = styleFor(failure.category);
  const SourceIcon = failure.source === 'alert' ? Bell : Activity;
  const when = new Date(failure.created_at);
  const whenLabel = when.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <tr className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
      <td className="py-2 px-2">
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold border px-2 py-0.5 rounded-full ${style.color} ${style.bg} ${style.border}`}>
          <style.Icon className="h-3 w-3" />
          {style.label}
        </span>
      </td>
      <td className="py-2 px-2">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <SourceIcon className="h-3 w-3" />
          {failure.source === 'alert' ? 'Alert' : 'Trace'}
        </span>
      </td>
      <td className="py-2 px-2 max-w-[420px]">
        <p className="text-foreground truncate" title={failure.message}>{failure.message}</p>
        {failure.event && failure.source === 'trace' && (
          <p className="text-[10px] text-muted-foreground font-mono truncate">evento: {failure.event}</p>
        )}
      </td>
      <td className="py-2 px-2">
        {failure.source === 'alert' ? (
          failure.is_resolved
            ? <span className="text-[10px] text-nexus-emerald font-semibold">Resolvido</span>
            : <span className="text-[10px] text-destructive font-semibold">Aberto</span>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground font-mono">{whenLabel}</td>
    </tr>
  );
}
