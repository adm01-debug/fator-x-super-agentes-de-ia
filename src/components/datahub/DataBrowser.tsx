import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, ChevronLeft, ChevronRight, Loader2, Eye, Database,
  ArrowUpDown, ArrowUp, ArrowDown, Download, Filter, X, Plus,
  Users, Factory, Truck, Package, UserCheck, MessageCircle, Pencil,
  FileJson, ChevronsLeft, ChevronsRight, Keyboard, Trash2,
} from "lucide-react";
import { ENTITY_MAPPINGS } from "@/config/datahub-entities";
import {
  ENTITY_DISPLAY_COLUMNS, ENTITY_FILTER_OPTIONS,
  exportToCSV, exportToJSON,
} from "@/config/datahub-columns";
import { RecordDetail } from "./RecordDetail";
import { InlineEditCell } from "./InlineEditCell";
import { BulkEditDialog } from "./BulkEditDialog";
import { CreateRecordDialog } from "./CreateRecordDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ENTITY_ICONS: Record<string, React.ElementType> = {
  cliente: Users, fornecedor: Factory, transportadora: Truck,
  produto: Package, colaborador: UserCheck, conversa_whatsapp: MessageCircle,
};

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

interface ActiveFilter {
  column: string;
  operator: string;
  value: string;
  label: string;
}

export function DataBrowser({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const mapping = ENTITY_MAPPINGS[entityId];
  const columns = ENTITY_DISPLAY_COLUMNS[entityId] ?? [
    { key: mapping?.primary.display_column ?? 'id', label: 'Nome', sortable: true },
  ];
  const filterOptions = ENTITY_FILTER_OPTIONS[entityId] ?? [];

  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [newFilterCol, setNewFilterCol] = useState<string>('');
  const [newFilterVal, setNewFilterVal] = useState<string>('');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        action: 'query_entity',
        entity: entityId,
        search: debouncedSearch,
        page,
        page_size: pageSize,
      };
      if (sortColumn) {
        body.sort_column = sortColumn;
        body.sort_direction = sortDirection;
      }
      if (filters.length > 0) {
        body.filters = filters.map(f => ({
          column: f.column,
          operator: f.operator,
          value: f.value,
        }));
      }
      const { data: result, error } = await supabase.functions.invoke('datahub-query', { body });
      if (error) throw error;
      setData(result.data ?? []);
      setTotal(result.total ?? 0);
    } catch (e: unknown) {
      toast.error(`Erro ao buscar dados: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [entityId, debouncedSearch, page, pageSize, sortColumn, sortDirection, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page on search/filter change
  useEffect(() => { setPage(0); }, [debouncedSearch, filters, pageSize]);

  // Clear selection on page/filter change
  useEffect(() => { setSelectedIds(new Set()); }, [page, debouncedSearch, filters]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' && page < totalPages - 1) { e.preventDefault(); setPage(p => p + 1); }
      if (e.key === 'ArrowLeft' && page > 0) { e.preventDefault(); setPage(p => p - 1); }
      if (e.key === 'Escape') { e.preventDefault(); if (selectedRecord) { setSelectedRecord(null); setEnrichedData(null); } else { onClose(); } }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [page, selectedRecord, onClose]);

  const fetchRecord = async (recordId: string) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('datahub-query', {
        body: { action: 'query_entity', entity: entityId, record_id: recordId },
      });
      if (error) throw error;
      setSelectedRecord(result.record);
      setEnrichedData({ enriched: result.enriched, cross_db: result.cross_db });
    } catch (e: unknown) {
      toast.error(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
    setPage(0);
  };

  const addFilter = () => {
    if (!newFilterCol || !newFilterVal) return;
    const opt = filterOptions.find(f => f.column === newFilterCol);
    const operator = opt?.type === 'boolean' ? 'eq' : (opt?.type === 'select' ? 'eq' : 'ilike');
    const value = operator === 'ilike' ? `%${newFilterVal}%` : newFilterVal;
    setFilters(prev => [...prev, {
      column: newFilterCol,
      operator,
      value,
      label: `${opt?.label ?? newFilterCol}: ${newFilterVal}`,
    }]);
    setNewFilterCol('');
    setNewFilterVal('');
  };

  const removeFilter = (index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  const handleExportCSV = () => {
    exportToCSV(data, columns, entityId);
    toast.success(`${data.length} registros exportados para CSV`);
  };

  const handleExportJSON = () => {
    exportToJSON(data, columns, entityId);
    toast.success(`${data.length} registros exportados para JSON`);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.size} registro(s)? Esta ação não pode ser desfeita.`)) return;
    try {
      let deleted = 0;
      for (const id of selectedIds) {
        const { data: result, error } = await supabase.functions.invoke('datahub-query', {
          body: { action: 'delete_record', entity: entityId, record_id: id },
        });
        if (error) throw new Error(error.message);
        if (result?.error) throw new Error(result.error);
        deleted++;
      }
      toast.success(`${deleted} registro(s) excluído(s)`);
      setSelectedIds(new Set());
      fetchData();
    } catch (e: unknown) {
      toast.error(`Erro ao excluir: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Inline edit: update row in local state
  const handleInlineUpdate = (rowId: string, updatedRow: Record<string, unknown>) => {
    setData(prev => prev.map(r => r.id === rowId ? updatedRow : r));
  };

  // Selection helpers
  const allSelected = data.length > 0 && data.every(r => selectedIds.has(r.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedRecords = data.filter(r => selectedIds.has(r.id));

  const totalPages = Math.ceil(total / pageSize);
  const Icon = ENTITY_ICONS[entityId] ?? Database;
  const displayCol = mapping?.primary.display_column ?? 'id';

  return (
    <div className="nexus-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={onClose}><ChevronLeft className="h-4 w-4" /></Button>
          <Icon className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-heading font-bold text-foreground">{mapping?.name ?? entityId}</h3>
          <Badge variant="secondary" className="text-[11px]">{total.toLocaleString()} registros</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5 text-xs nexus-gradient-bg text-primary-foreground" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo {mapping?.name}
          </Button>
          {someSelected && (
            <>
              <Button size="sm" variant="default" className="gap-1.5 text-xs" onClick={() => setBulkEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Editar {selectedIds.size}
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={handleBulkDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                Excluir {selectedIds.size}
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowFilters(v => !v)}>
            <Filter className="h-3.5 w-3.5" />
            Filtros {filters.length > 0 && <Badge variant="default" className="text-[11px] h-4 ml-1">{filters.length}</Badge>}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExportCSV} disabled={!data.length}>
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar dados visíveis como CSV</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExportJSON} disabled={!data.length}>
                  <FileJson className="h-3.5 w-3.5" /> JSON
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar dados visíveis como JSON</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar por ${displayCol}...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 bg-secondary/30"
          />
          {searchTerm && debouncedSearch !== searchTerm && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Keyboard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">← → navegar · Esc voltar</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>← → Páginas · Esc Fechar</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="rounded-lg bg-secondary/20 border border-border/30 p-3 space-y-3 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={newFilterCol} onValueChange={setNewFilterCol}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Coluna..." /></SelectTrigger>
              <SelectContent>
                {filterOptions.map(opt => (
                  <SelectItem key={opt.column} value={opt.column}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {newFilterCol && (() => {
              const opt = filterOptions.find(f => f.column === newFilterCol);
              if (opt?.type === 'select') {
                return (
                  <Select value={newFilterVal} onValueChange={setNewFilterVal}>
                    <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Valor..." /></SelectTrigger>
                    <SelectContent>
                      {opt.options?.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }
              if (opt?.type === 'boolean') {
                return (
                  <Select value={newFilterVal} onValueChange={setNewFilterVal}>
                    <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Não</SelectItem>
                    </SelectContent>
                  </Select>
                );
              }
              return (
                <Input
                  placeholder="Valor..."
                  value={newFilterVal}
                  onChange={e => setNewFilterVal(e.target.value)}
                  className="w-[180px] h-8 text-xs"
                  onKeyDown={e => e.key === 'Enter' && addFilter()}
                />
              );
            })()}

            <Button size="sm" variant="default" className="h-8 gap-1 text-xs" onClick={addFilter} disabled={!newFilterCol || !newFilterVal}>
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>

          {filters.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {filters.map((f, i) => (
                <Badge key={i} variant="secondary" className="text-[11px] gap-1 pr-1">
                  {f.label}
                  <button onClick={() => removeFilter(i)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              <Button size="sm" variant="ghost" className="h-5 text-[11px] text-destructive" onClick={() => setFilters([])}>
                Limpar tudo
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Hint for inline editing */}
      {!loading && data.length > 0 && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Pencil className="h-3 w-3" /> Duplo clique em uma célula para editar inline · Use checkboxes para edição em massa
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50 sticky top-0 z-10">
                  <tr>
                    <th className="p-2 w-[36px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Selecionar todos"
                      />
                    </th>
                    {columns.map(col => (
                      <th
                        key={col.key}
                        className={`text-left p-2 font-medium text-muted-foreground select-none ${col.width ?? ''} ${col.sortable ? 'cursor-pointer hover:text-foreground' : ''}`}
                        onClick={() => col.sortable && handleSort(col.key)}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {col.sortable && (
                            sortColumn === col.key ? (
                              sortDirection === 'asc'
                                ? <ArrowUp className="h-3 w-3 text-primary" />
                                : <ArrowDown className="h-3 w-3 text-primary" />
                            ) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="text-left p-2 font-medium text-muted-foreground w-[60px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr
                      key={row.id ?? i}
                      className={`border-t border-border/30 hover:bg-secondary/20 transition-colors ${
                        selectedIds.has(row.id) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="p-2">
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={() => toggleSelect(row.id)}
                          aria-label={`Selecionar ${row[displayCol] || row.id}`}
                        />
                      </td>
                      {columns.map(col => (
                        <td key={col.key} className={`p-2 ${col.width ?? ''}`}>
                          <InlineEditCell
                            row={row}
                            col={col}
                            entityId={entityId}
                            onUpdate={handleInlineUpdate}
                          />
                        </td>
                      ))}
                      <td className="p-2">
                        <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => fetchRecord(row.id)}>
                          <Eye className="h-3 w-3" /> Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr><td colSpan={columns.length + 2} className="p-8 text-center text-muted-foreground">Nenhum registro encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <p className="text-[11px] text-muted-foreground">
                Mostrando {data.length > 0 ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, total)} de {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Por página:</span>
                <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                  <SelectTrigger className="h-7 w-[65px] text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(0)}>
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] text-muted-foreground px-2 min-w-[60px] text-center">
                {page + 1} / {totalPages || 1}
              </span>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Record detail */}
      {selectedRecord && (
        <RecordDetail
          record={selectedRecord}
          enrichedData={enrichedData}
          entityId={entityId}
          onClose={() => { setSelectedRecord(null); setEnrichedData(null); }}
        />
      )}

      {/* Bulk edit dialog */}
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        entityId={entityId}
        selectedRecords={selectedRecords}
        columns={columns}
        displayColumn={displayCol}
        onSuccess={() => {
          setSelectedIds(new Set());
          fetchData();
        }}
      />

      {/* Create record dialog */}
      <CreateRecordDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        entityId={entityId}
        entityName={mapping?.name ?? entityId}
        onSuccess={fetchData}
      />
    </div>
  );
}
