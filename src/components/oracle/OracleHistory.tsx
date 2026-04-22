import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Trash2, Eye, FileText, Clock, Filter } from 'lucide-react';
import {
  fetchOracleHistory,
  deleteOracleHistory,
  type OracleHistoryEntry,
  type HistoryFilters,
} from '@/lib/oracleHistory';
import { exportToMarkdown, downloadText } from '@/lib/oracleExport';
import { ORACLE_MODES, ORACLE_PRESETS, type OracleMode } from '@/stores/oracleStore';
import { toast } from 'sonner';

interface OracleHistoryProps {
  onReplay?: (entry: OracleHistoryEntry) => void;
}

export function OracleHistory(_props: OracleHistoryProps) {
  const [entries, setEntries] = useState<OracleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchOracleHistory(filters);
    setEntries(data);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
  }, [filters, load]);

  const handleDelete = async (id: string) => {
    if (await deleteOracleHistory(id)) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success('Histórico removido');
    }
  };

  const handleExportMd = (entry: OracleHistoryEntry) => {
    const md = exportToMarkdown(
      entry.query,
      entry.results,
      entry.preset_name || entry.preset_id,
      entry.mode,
      entry.chairman_model || '',
    );
    downloadText(md, `oraculo_${entry.id.slice(0, 8)}.md`);
    toast.success('Markdown exportado!');
  };

  if (loading) {
    return (
      <div className="nexus-card text-center py-8 text-sm text-muted-foreground">
        Carregando histórico...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Histórico ({entries.length})</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowFilters(!showFilters)}
          className="text-xs gap-1"
        >
          <Filter className="h-3.5 w-3.5" /> Filtros
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="overflow-hidden">
          <div className="p-3 rounded-lg bg-secondary/30 border border-border/30 grid grid-cols-3 gap-3">
            <Select
              value={filters.mode || '__all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, mode: v === '__all' ? undefined : (v as OracleMode) }))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all" className="text-xs">
                  Todos os modos
                </SelectItem>
                {Object.entries(ORACLE_MODES).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {v.icon} {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.presetId || '__all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, presetId: v === '__all' ? undefined : v }))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all" className="text-xs">
                  Todos os presets
                </SelectItem>
                {ORACLE_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.icon} {p.name.replace(/^[^\s]+\s/, '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="h-8 text-xs"
              value={filters.dateFrom || ''}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
            />
          </div>
        </div>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="nexus-card text-center py-8 text-sm text-muted-foreground">
          Nenhuma consulta no histórico
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const modeConf = ORACLE_MODES[entry.mode as OracleMode];
            return (
              <div key={entry.id} className="nexus-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground line-clamp-2 font-medium">
                      {entry.query}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[11px]">
                        {modeConf?.icon} {modeConf?.label}
                      </Badge>
                      <Badge variant="outline" className="text-[11px] text-muted-foreground">
                        {entry.preset_name || entry.preset_id}
                      </Badge>
                      {entry.confidence_score != null && (
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${Number(entry.confidence_score) >= 80 ? 'text-nexus-emerald border-nexus-emerald/30' : Number(entry.confidence_score) >= 50 ? 'text-nexus-amber border-nexus-amber/30' : 'text-nexus-rose border-nexus-rose/30'}`}
                        >
                          {entry.confidence_score}%
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleExportMd(entry)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {expandedId === entry.id && (
                  <div className="overflow-hidden mt-3 pt-3 border-t border-border/30">
                    <div className="text-xs text-foreground whitespace-pre-wrap max-h-[300px] overflow-y-auto bg-secondary/30 p-3 rounded-lg">
                      {entry.results?.final_response || 'Sem resposta'}
                    </div>
                    <div className="flex gap-2 mt-2 text-[11px] text-muted-foreground">
                      <span>💰 ${Number(entry.total_cost_usd || 0).toFixed(4)}</span>
                      <span>⏱️ {((entry.total_latency_ms || 0) / 1000).toFixed(1)}s</span>
                      <span>📊 {entry.total_tokens?.toLocaleString()} tokens</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
