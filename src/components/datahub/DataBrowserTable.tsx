import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react";
import { InlineEditCell } from "./InlineEditCell";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

interface DataBrowserTableProps {
  columns: Column[];
  data: Array<Record<string, unknown>>;
  displayCol: string;
  selectedIds: Set<string>;
  allSelected: boolean;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  entityId: string;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onSort: (col: string) => void;
  onViewRecord: (id: string) => void;
  onInlineUpdate: (rowId: string, updatedRow: Record<string, unknown>) => void;
}

export function DataBrowserTable({
  columns, data, displayCol, selectedIds, allSelected, sortColumn, sortDirection,
  entityId, onToggleSelectAll, onToggleSelect, onSort, onViewRecord, onInlineUpdate,
}: DataBrowserTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50 sticky top-0 z-10">
            <tr>
              <th className="p-2 w-[36px]">
                <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} aria-label="Selecionar todos" />
              </th>
              {columns.map(col => (
                <th key={col.key} className={`text-left p-2 font-medium text-muted-foreground select-none ${col.width ?? ''} ${col.sortable ? 'cursor-pointer hover:text-foreground' : ''}`}
                  onClick={() => col.sortable && onSort(col.key)}>
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      sortColumn === col.key ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
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
              <tr key={(row.id as string) ?? i} className={`border-t border-border/30 hover:bg-secondary/20 transition-colors ${selectedIds.has(row.id as string) ? 'bg-primary/5' : ''}`}>
                <td className="p-2">
                  <Checkbox checked={selectedIds.has(row.id as string)} onCheckedChange={() => onToggleSelect(row.id as string)} aria-label={`Selecionar ${(row[displayCol] as string) || row.id}`} />
                </td>
                {columns.map(col => (
                  <td key={col.key} className={`p-2 ${col.width ?? ''}`}>
                    <InlineEditCell row={row} col={col} entityId={entityId} onUpdate={onInlineUpdate} />
                  </td>
                ))}
                <td className="p-2">
                  <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => onViewRecord(row.id as string)}>
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
  );
}
