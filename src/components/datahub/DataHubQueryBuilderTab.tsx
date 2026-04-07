import { useState } from "react";
import { Loader2, Database, Play, Code2, Save, Trash2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const PROJECTS = [
  { value: 'pgxfvjmuubtbowutlide', label: 'bancodadosclientes (CRM)' },
  { value: 'doufsxqlfjyuvxuezpln', label: 'supabase-fuchsia-kite (catálogo)' },
  { value: 'rhqfnvvjdwvnulxybmrk', label: 'backupgiftstore (WhatsApp)' },
  { value: 'hncgwjbzdajfdztqgefe', label: 'gestao_time_promo (HR)' },
  { value: 'xyykivpcdbfukaongpbw', label: 'financeiro_promo' },
];

const QUERY_HISTORY_KEY = 'nexus-datahub-query-history';
const HISTORY_MAX = 10;

interface QueryHistoryEntry {
  query: string;
  project: string;
  timestamp: string;
}

function loadHistory(): QueryHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(QUERY_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(items: QueryHistoryEntry[]) {
  try {
    localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_MAX)));
  } catch {
    /* ignore */
  }
}

const SAMPLE_QUERIES: Record<string, string> = {
  pgxfvjmuubtbowutlide:
    'SELECT id, name, estado, is_customer\nFROM companies\nWHERE is_customer = true\nLIMIT 10;',
  doufsxqlfjyuvxuezpln:
    'SELECT id, sku, nome, preco_venda\nFROM produtos\nLIMIT 10;',
  rhqfnvvjdwvnulxybmrk:
    'SELECT phone, name, last_seen\nFROM whatsapp_contacts\nLIMIT 10;',
  hncgwjbzdajfdztqgefe:
    'SELECT user_id, date, hours_worked\nFROM time_entries\nORDER BY date DESC\nLIMIT 10;',
  xyykivpcdbfukaongpbw:
    'SELECT id, description, amount, due_date\nFROM accounts_payable\nLIMIT 10;',
};

interface QueryResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  row_count: number;
  duration_ms: number;
}

export function DataHubQueryBuilderTab() {
  const [project, setProject] = useState(PROJECTS[0].value);
  const [query, setQuery] = useState(SAMPLE_QUERIES[PROJECTS[0].value] ?? '');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QueryHistoryEntry[]>(() => loadHistory());

  const handleRun = async () => {
    if (!query.trim()) {
      toast.error('Digite uma query SQL');
      return;
    }
    setRunning(true);
    setResult(null);
    setError(null);
    const start = Date.now();

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('datahub-query', {
        body: {
          action: 'execute_sql',
          project_ref: project,
          sql: query,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      const result = data as Record<string, unknown>;
      if (result?.error) {
        throw new Error(String(result.error));
      }

      const rows = (result?.rows ?? []) as Array<Record<string, unknown>>;
      const columns = rows.length > 0 ? Object.keys(rows[0]) : (result?.columns as string[] ?? []);

      setResult({
        columns,
        rows,
        row_count: rows.length,
        duration_ms: Date.now() - start,
      });

      // Save to history
      const entry: QueryHistoryEntry = {
        query: query.trim(),
        project,
        timestamp: new Date().toISOString(),
      };
      const next = [entry, ...history.filter((h) => h.query !== entry.query)].slice(0, HISTORY_MAX);
      setHistory(next);
      saveHistory(next);

      toast.success(`${rows.length} linha(s) em ${Date.now() - start}ms`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`Query falhou: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveHistory([]);
    toast.success('Histórico limpo');
  };

  const handleLoadSample = () => {
    const sample = SAMPLE_QUERIES[project];
    if (sample) {
      setQuery(sample);
      toast.info('Query de exemplo carregada');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" /> Query Builder
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Execute SQL diretamente em qualquer um dos 5 bancos do DataHub. Read-only — use com cuidado.
        </p>
      </div>

      <div className="nexus-card space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[260px] space-y-1.5">
            <Label className="text-xs">Banco de dados</Label>
            <Select value={project} onValueChange={(v) => { setProject(v); setQuery(SAMPLE_QUERIES[v] ?? ''); }}>
              <SelectTrigger className="bg-secondary/50 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECTS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center gap-2">
                      <Database className="h-3 w-3" />
                      {p.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handleLoadSample} className="gap-1.5 h-9 text-xs">
            <Save className="h-3.5 w-3.5" /> Exemplo
          </Button>
        </div>

        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={8}
          placeholder="SELECT * FROM ..."
          className="bg-[#0a0a1a] border-[#222244] font-mono text-xs resize-none"
          spellCheck={false}
        />

        <div className="flex justify-between items-center">
          <p className="text-[10px] text-muted-foreground">
            {query.length} caracteres
          </p>
          <Button
            onClick={handleRun}
            disabled={running || !query.trim()}
            className="gap-1.5"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Executar
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="nexus-card border-destructive/50 bg-destructive/10">
          <p className="text-xs font-semibold text-destructive mb-1">Erro de execução</p>
          <p className="text-[11px] text-destructive font-mono whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="nexus-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {result.row_count} linha(s)
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {result.columns.length} colunas
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {result.duration_ms}ms
              </Badge>
            </div>
          </div>

          {result.row_count === 0 ? (
            <p className="text-center py-6 text-xs text-muted-foreground italic">
              Nenhuma linha retornada
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/80 backdrop-blur">
                  <tr>
                    {result.columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left font-semibold text-foreground border-b border-border/30 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/10 hover:bg-secondary/20">
                      {result.columns.map((col) => {
                        const v = row[col];
                        const display = v == null ? <span className="text-muted-foreground italic">null</span> :
                                        typeof v === 'object' ? JSON.stringify(v) :
                                        String(v);
                        return (
                          <td key={col} className="px-3 py-1.5 font-mono text-[11px] max-w-[300px] truncate">
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="nexus-card">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Histórico ({history.length})
            </h4>
            <button
              onClick={handleClearHistory}
              className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1"
            >
              <Trash2 className="h-2.5 w-2.5" /> Limpar
            </button>
          </div>
          <div className="space-y-1">
            {history.map((h, i) => {
              const projLabel = PROJECTS.find((p) => p.value === h.project)?.label.split(' ')[0] ?? h.project;
              return (
                <button
                  key={i}
                  onClick={() => { setProject(h.project); setQuery(h.query); }}
                  className="w-full text-left p-2 rounded bg-secondary/30 border border-border/20 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[9px]">{projLabel}</Badge>
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(h.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <code className="text-[10px] text-muted-foreground line-clamp-1 font-mono block">
                    {h.query.replace(/\s+/g, ' ').slice(0, 80)}
                  </code>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
