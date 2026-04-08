/**
 * DataHubExplorerTab — Nexus Agents Studio (improvement #5)
 *
 * Interactive data explorer for the 5 external Supabase databases via the
 * datahub-query Edge Function. Lets the user pick an entity, paginate
 * through real rows, sort columns client-side, search free-text,
 * and export results as CSV.
 *
 * Uses the existing queryEntity() service — no new backend needed.
 * RLS-respecting (entity mappings live in datahub-entities config).
 */
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Database, Search, Loader2, Download, ArrowUp, ArrowDown, ArrowUpDown,
  ChevronLeft, ChevronRight, Eye, RefreshCw, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ENTITY_LIST } from "@/config/datahub-entities";
import { queryEntity, getEntityDetail } from "@/services/datahubService";
import { toast } from "sonner";

interface Row {
  id?: string | number;
  [key: string]: unknown;
}

const PAGE_SIZE = 25;

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

function downloadCsv(rows: Row[], columns: string[], filename: string) {
  const escape = (val: unknown) => {
    if (val == null) return "";
    const s = typeof val === "object" ? JSON.stringify(val) : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    columns.join(","),
    ...rows.map((r) => columns.map((c) => escape(r[c])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataHubExplorerTab() {
  const [entityKey, setEntityKey] = useState<string>(ENTITY_LIST[0]?.key ?? "cliente");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fullDetail, setFullDetail] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["datahub_explorer", entityKey],
    queryFn: () => queryEntity(entityKey, undefined, 200),
    staleTime: 60_000,
  });

  // The Edge Function returns either { data: [...] } or { rows: [...] } or
  // a bare array. Normalise to a Row[].
  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const d = data as { data?: unknown; rows?: unknown };
    const candidate = d.data ?? d.rows ?? data;
    if (Array.isArray(candidate)) return candidate as Row[];
    return [];
  }, [data]);

  // Compute columns from union of keys (max 12 to keep table readable)
  const columns = useMemo(() => {
    const keySet = new Set<string>();
    rows.slice(0, 50).forEach((r) => Object.keys(r).forEach((k) => keySet.add(k)));
    const ordered = Array.from(keySet);
    // Move 'id', 'name', 'nome' to the front if present
    const priority = ["id", "name", "nome", "razao_social", "email"];
    ordered.sort((a, b) => {
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });
    return ordered.slice(0, 12);
  }, [rows]);

  // Search + sort + paginate
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = q
      ? rows.filter((r) =>
          Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q))
        )
      : rows;
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const comp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === "asc" ? comp : -comp;
      });
    }
    return result;
  }, [rows, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (col: string) => {
    if (sortKey === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir("asc");
    }
  };

  const handleEntityChange = (key: string) => {
    setEntityKey(key);
    setSearch("");
    setSortKey(null);
    setPage(0);
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("Nada para exportar");
      return;
    }
    downloadCsv(filtered, columns, `${entityKey}-${Date.now()}.csv`);
    toast.success(`${filtered.length} linhas exportadas`);
  };

  const openDetail = useCallback(async (row: Row) => {
    setDetailRow(row);
    setFullDetail(null);
    if (row.id == null) return;
    setDetailLoading(true);
    try {
      const full = await getEntityDetail(entityKey, String(row.id));
      setFullDetail(full as Record<string, unknown>);
    } catch (e) {
      toast.error(`Falha ao carregar detalhe: ${e instanceof Error ? e.message : 'erro'}`);
    } finally {
      setDetailLoading(false);
    }
  }, [entityKey]);

  return (
    <div className="space-y-4">
      {/* Header / controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Database className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-heading font-semibold text-foreground">Data Explorer</h3>
          <Badge variant="outline" className="text-[10px]">
            {filtered.length} {filtered.length === 1 ? 'linha' : 'linhas'}
          </Badge>
        </div>

        <Select value={entityKey} onValueChange={handleEntityChange}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_LIST.map((e) => (
              <SelectItem key={e.key} value={e.key} className="text-xs">
                {e.icon} {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Filtrar..."
            className="h-8 pl-7 text-xs w-[200px] bg-secondary/40"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-8 gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="h-8 gap-1.5 text-xs"
        >
          <Download className="h-3 w-3" /> CSV
        </Button>
      </div>

      {/* Table */}
      <div className="nexus-card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-sm font-semibold text-destructive">Erro ao carregar dados</p>
            <p className="text-[11px] text-muted-foreground mt-1">{error instanceof Error ? error.message : String(error)}</p>
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Database className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">Nenhuma linha</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {search ? 'Nenhum resultado para o filtro' : 'Tabela vazia ou entidade sem dados'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/30 border-b border-border/40">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort(col)}
                    >
                      <div className="flex items-center gap-1">
                        {col}
                        {sortKey === col ? (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => (
                  <tr
                    key={(row.id as string | number) ?? idx}
                    className="border-b border-border/20 hover:bg-secondary/20 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-1.5 text-foreground tabular-nums" title={formatValue(row[col])}>
                        {formatValue(row[col])}
                      </td>
                    ))}
                    <td className="px-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => openDetail(row)}
                        aria-label="Ver detalhes"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Página {page + 1} de {totalPages} · {filtered.length} {filtered.length === 1 ? 'linha' : 'linhas'}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setDetailRow(null)}
        >
          <div
            className="nexus-card max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-heading font-semibold text-foreground">Detalhes do registro</h4>
              <Button variant="ghost" size="sm" onClick={() => setDetailRow(null)} className="h-7 text-xs">
                Fechar
              </Button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <pre className="text-[11px] text-foreground bg-secondary/30 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(fullDetail ?? detailRow, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DataHubExplorerTab;
