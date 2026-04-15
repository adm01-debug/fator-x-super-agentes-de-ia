import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Link2,
  Search,
  Database,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabaseExternal } from "@/integrations/supabase/externalClient";

interface EntityMatch {
  source_db: string;
  source_id: string;
  source_table: string;
  matched_value: string;
  confidence: number;
  fields: Record<string, unknown>;
}

interface IdentityResolutionResult {
  query: string;
  query_type: 'cnpj' | 'cpf' | 'email' | 'phone' | 'name';
  matches: EntityMatch[];
  total_matches: number;
  databases_searched: number;
}

const QUERY_TYPES = [
  { value: 'auto', label: '🔍 Auto-detectar' },
  { value: 'cnpj', label: '🏢 CNPJ' },
  { value: 'cpf', label: '👤 CPF' },
  { value: 'email', label: '✉️ Email' },
  { value: 'phone', label: '📞 Telefone' },
  { value: 'name', label: '📝 Nome' },
];

const DB_LABELS: Record<string, { label: string; color: string }> = {
  bancodadosclientes: { label: 'CRM', color: 'hsl(var(--nexus-blue))' },
  'supabase-fuchsia-kite': { label: 'Catálogo', color: 'hsl(var(--nexus-purple))' },
  backupgiftstore: { label: 'WhatsApp', color: 'hsl(var(--nexus-emerald))' },
  gestao_time_promo: { label: 'HR', color: 'hsl(var(--nexus-yellow))' },
  financeiro_promo: { label: 'Financeiro', color: 'hsl(var(--nexus-orange))' },
};

function detectQueryType(q: string): 'cnpj' | 'cpf' | 'email' | 'phone' | 'name' {
  const stripped = q.replace(/[\s.\-/()]/g, '');
  if (/^\d{14}$/.test(stripped)) return 'cnpj';
  if (/^\d{11}$/.test(stripped)) return 'cpf';
  if (/@/.test(q)) return 'email';
  if (/^\+?\d{10,15}$/.test(stripped)) return 'phone';
  return 'name';
}

export function DataHubIdentityResolutionTab() {
  const [query, setQuery] = useState('');
  const [queryType, setQueryType] = useState('auto');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [submittedType, setSubmittedType] = useState<string>('auto');

  const { data: result, isLoading } = useQuery({
    queryKey: ['identity-resolution', submittedQuery, submittedType],
    queryFn: async (): Promise<IdentityResolutionResult> => {
      if (!submittedQuery.trim()) {
        return { query: '', query_type: 'name', matches: [], total_matches: 0, databases_searched: 0 };
      }

      const detectedType = submittedType === 'auto' ? detectQueryType(submittedQuery) : (submittedType as IdentityResolutionResult['query_type']);

      try {
        const { data, error } = await supabase.functions.invoke('datahub-query', {
          body: {
            action: 'identity_resolution',
            query: submittedQuery.trim(),
            query_type: detectedType,
          },
        });

        if (error) throw new Error(error.message);

        const r = data as Record<string, unknown>;
        return {
          query: submittedQuery,
          query_type: detectedType,
          matches: (r?.matches ?? []) as EntityMatch[],
          total_matches: typeof r?.total_matches === 'number' ? r.total_matches : 0,
          databases_searched: typeof r?.databases_searched === 'number' ? r.databases_searched : 5,
        };
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha na resolução');
        throw e;
      }
    },
    enabled: !!submittedQuery,
  });

  const handleSearch = () => {
    if (!query.trim()) {
      toast.error('Digite um valor para buscar');
      return;
    }
    setSubmittedQuery(query.trim());
    setSubmittedType(queryType);
  };

  const groupedByDb: Record<string, EntityMatch[]> = {};
  for (const m of result?.matches ?? []) {
    if (!groupedByDb[m.source_db]) groupedByDb[m.source_db] = [];
    groupedByDb[m.source_db].push(m);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" /> Identity Resolution
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Encontre a mesma entidade (cliente, fornecedor, contato) em todos os 5 bancos do DataHub. Auto-detecta CNPJ, CPF, email, telefone ou nome.
        </p>
      </div>

      {/* Search bar */}
      <div className="nexus-card space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[260px] space-y-1.5">
            <Label className="text-xs">Valor para buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder="CNPJ, CPF, email, telefone ou nome..."
                className="pl-9 bg-secondary/50"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={queryType} onValueChange={setQueryType}>
              <SelectTrigger className="bg-secondary/50 text-xs w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUERY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSearch} disabled={isLoading || !query.trim()} className="gap-1.5">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Resolver
          </Button>
        </div>
        {queryType === 'auto' && query && (
          <p className="text-[10px] text-muted-foreground">
            Auto-detectado: <span className="font-mono text-primary">{detectQueryType(query)}</span>
          </p>
        )}
      </div>

      {/* Stats */}
      {result && submittedQuery && (
        <div className="grid grid-cols-3 gap-3">
          <div className="nexus-card text-center py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Matches</p>
            <p className="text-xl font-bold text-primary mt-1">{result.total_matches}</p>
          </div>
          <div className="nexus-card text-center py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bancos</p>
            <p className="text-xl font-bold text-nexus-emerald mt-1">{Object.keys(groupedByDb).length}/{result.databases_searched}</p>
          </div>
          <div className="nexus-card text-center py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo</p>
            <p className="text-sm font-semibold text-nexus-purple mt-1">{result.query_type}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : result && result.total_matches === 0 && submittedQuery ? (
        <div className="nexus-card text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum match encontrado para "<span className="font-mono">{submittedQuery}</span>"
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Tente usar nome parcial ou outro identificador
          </p>
        </div>
      ) : result && result.total_matches > 0 ? (
        <div className="space-y-3">
          {Object.entries(groupedByDb).map(([db, matches]) => {
            const dbCfg = DB_LABELS[db] ?? { label: db, color: 'hsl(var(--muted-foreground))' };
            return (
              <div key={db} className="nexus-card">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/30">
                  <Database className="h-4 w-4" style={{ color: dbCfg.color }} />
                  <p className="text-xs font-semibold">{dbCfg.label}</p>
                  <code className="text-[9px] text-muted-foreground font-mono">{db}</code>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {matches.length} match(es)
                  </Badge>
                </div>
                <div className="space-y-2">
                  {matches.map((m, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-secondary/30 border border-border/20">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <CheckCircle2 className="h-3 w-3 text-nexus-emerald shrink-0" />
                          <span className="text-xs font-mono text-foreground truncate">{m.matched_value}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[9px] shrink-0"
                          style={{
                            borderColor: m.confidence >= 0.9 ? 'hsl(var(--nexus-emerald) / 0.5)' :
                                         m.confidence >= 0.7 ? 'hsl(var(--nexus-yellow) / 0.5)' :
                                         'hsl(var(--nexus-orange) / 0.5)',
                            color: m.confidence >= 0.9 ? 'hsl(var(--nexus-emerald))' :
                                   m.confidence >= 0.7 ? 'hsl(var(--nexus-yellow))' :
                                   'hsl(var(--nexus-orange))',
                          }}
                        >
                          {(m.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                        <span className="font-mono">{m.source_table}</span>
                        <ArrowRight className="h-2.5 w-2.5" />
                        <code>{m.source_id}</code>
                      </div>
                      {Object.keys(m.fields).length > 0 && (
                        <div className="grid grid-cols-2 gap-1 mt-2 pt-2 border-t border-border/20">
                          {Object.entries(m.fields).slice(0, 4).map(([k, v]) => (
                            <div key={k} className="text-[10px]">
                              <span className="text-muted-foreground">{k}:</span>{' '}
                              <span className="text-foreground font-mono">
                                {v == null ? 'null' : String(v).slice(0, 30)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="nexus-card text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto opacity-30 mb-3" />
          <p className="text-sm">Digite um identificador acima para começar</p>
        </div>
      )}
    </div>
  );
}
