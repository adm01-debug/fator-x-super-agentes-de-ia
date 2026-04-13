import { useState, useEffect, useCallback } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, ChevronLeft, Loader2, Download, Filter, Plus,
  Users, Factory, Truck, Package, UserCheck, MessageCircle, Pencil,
  FileJson, Keyboard, Trash2, Database,
} from "lucide-react";
import { DataBrowserFilters, type ActiveFilter } from "./DataBrowserFilters";
import { DataBrowserTable } from "./DataBrowserTable";
import { DataBrowserPagination } from "./DataBrowserPagination";
import { ENTITY_MAPPINGS } from "@/config/datahub-entities";
import {
  ENTITY_DISPLAY_COLUMNS, ENTITY_FILTER_OPTIONS,
  exportToCSV, exportToJSON,
} from "@/config/datahub-columns";
import { RecordDetail } from "./RecordDetail";
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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
    if (selectedIds.size === 0) return;
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
              <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={() => setConfirmDeleteOpen(true)}>
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
        <DataBrowserFilters
          filterOptions={filterOptions}
          filters={filters}
          newFilterCol={newFilterCol}
          newFilterVal={newFilterVal}
          onNewFilterColChange={setNewFilterCol}
          onNewFilterValChange={setNewFilterVal}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          onClearFilters={() => setFilters([])}
        />
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
          <DataBrowserTable
            data={data}
            columns={columns}
            displayCol={displayCol}
            selectedIds={selectedIds}
            allSelected={allSelected}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            entityId={entityId}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onSort={handleSort}
            onInlineUpdate={handleInlineUpdate}
            onViewRecord={fetchRecord}
          />

          <DataBrowserPagination
            page={page}
            pageSize={pageSize}
            total={total}
            dataLength={data.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
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

      {/* Confirm delete dialog */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registros</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedIds.size} registro(s)? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setConfirmDeleteOpen(false); handleBulkDelete(); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
