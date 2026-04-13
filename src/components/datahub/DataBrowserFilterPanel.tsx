import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Plus, X } from "lucide-react";

interface ActiveFilter {
  column: string;
  operator: string;
  value: string;
  label: string;
}

interface FilterOption {
  column: string;
  label: string;
  type?: string;
  options?: Array<{ value: string; label: string }>;
}

interface DataBrowserFilterPanelProps {
  filters: ActiveFilter[];
  filterOptions: FilterOption[];
  onAddFilter: (column: string, value: string) => void;
  onRemoveFilter: (index: number) => void;
  onClearFilters: () => void;
}

export function DataBrowserFilterPanel({
  filters, filterOptions, onAddFilter, onRemoveFilter, onClearFilters,
}: DataBrowserFilterPanelProps) {
  const [newFilterCol, setNewFilterCol] = useState<string>('');
  const [newFilterVal, setNewFilterVal] = useState<string>('');

  const addFilter = () => {
    if (!newFilterCol || !newFilterVal) return;
    onAddFilter(newFilterCol, newFilterVal);
    setNewFilterCol('');
    setNewFilterVal('');
  };

  return (
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
              <button onClick={() => onRemoveFilter(i)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          <Button size="sm" variant="ghost" className="h-5 text-[11px] text-destructive" onClick={onClearFilters}>
            Limpar tudo
          </Button>
        </div>
      )}
    </div>
  );
}
