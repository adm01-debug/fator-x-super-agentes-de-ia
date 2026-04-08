import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Database, FileText, Layers, Clock } from "lucide-react";
import { getKnowledgeAreaStats } from "@/services/cerebroService";

interface AreaMeta {
  icon: string;
  title: string;
  desc: string;
  domain: string;
  color: string;
}

const KNOWLEDGE_AREAS: AreaMeta[] = [
  { icon: '📋', title: 'Processos & SOPs', desc: 'Procedimentos operacionais padrão da empresa', domain: 'processos', color: 'hsl(var(--nexus-blue))' },
  { icon: '📊', title: 'Relatórios & Dados', desc: 'Relatórios financeiros, KPIs e dashboards', domain: 'dados', color: 'hsl(var(--nexus-purple))' },
  { icon: '👥', title: 'RH & Pessoas', desc: 'Políticas de RH, benefícios e cultura', domain: 'rh', color: 'hsl(var(--nexus-emerald))' },
  { icon: '💰', title: 'Financeiro', desc: 'Orçamentos, projeções e fluxo de caixa', domain: 'financeiro', color: 'hsl(var(--nexus-yellow))' },
  { icon: '🏭', title: 'Fornecedores', desc: 'Catálogo, preços e avaliações de fornecedores', domain: 'compras', color: 'hsl(var(--nexus-orange))' },
  { icon: '🛒', title: 'Produtos & Catálogo', desc: 'Produtos, especificações e preços', domain: 'produtos', color: 'hsl(var(--nexus-red))' },
  { icon: '📞', title: 'Clientes & CRM', desc: 'Base de clientes, histórico e segmentação', domain: 'comercial', color: 'hsl(var(--nexus-cyan))' },
  { icon: '⚖️', title: 'Jurídico & Compliance', desc: 'Contratos, termos e regulamentações', domain: 'juridico', color: 'hsl(var(--nexus-purple))' },
];

function formatRelative(iso: string | null): string {
  if (!iso) return 'sem dados';
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return `${days}d atrás`;
  if (days < 30) return `${Math.floor(days / 7)}sem atrás`;
  if (days < 365) return `${Math.floor(days / 30)}mês atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

export function KnowledgeAreasTab() {
  const { data: stats, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['knowledge-area-stats'],
    queryFn: getKnowledgeAreaStats,
    staleTime: 5 * 60 * 1000,
  });

  const totals = stats
    ? Object.values(stats).reduce(
        (acc, s) => ({
          documents: acc.documents + s.documents,
          chunks: acc.chunks + s.chunks,
          knowledge_bases: acc.knowledge_bases + s.knowledge_bases,
        }),
        { documents: 0, chunks: 0, knowledge_bases: 0 }
      )
    : { documents: 0, chunks: 0, knowledge_bases: 0 };

  return (
    <div className="space-y-4">
      {/* Top stats bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-secondary/30 border border-border/30 flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Bases:</span>
            <span className="text-sm font-semibold">{totals.knowledge_bases}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-secondary/30 border border-border/30 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-nexus-emerald" />
            <span className="text-xs text-muted-foreground">Documentos:</span>
            <span className="text-sm font-semibold">{totals.documents}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-secondary/30 border border-border/30 flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-nexus-purple" />
            <span className="text-xs text-muted-foreground">Chunks:</span>
            <span className="text-sm font-semibold">{totals.chunks}</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-8 gap-1.5"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>

      {/* Area cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {KNOWLEDGE_AREAS.map((area) => {
            const s = stats?.[area.domain];
            const populated = (s?.documents ?? 0) > 0 || (s?.knowledge_bases ?? 0) > 0;
            return (
              <div
                key={area.title}
                className="nexus-card cursor-pointer hover:border-primary/30 transition-colors"
                style={{ borderLeftColor: area.color, borderLeftWidth: '3px' }}
              >
                <div className="text-3xl mb-3">{area.icon}</div>
                <h3 className="text-sm font-semibold text-foreground">{area.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-1 mb-3 line-clamp-2">{area.desc}</p>

                <div className="grid grid-cols-3 gap-1 mb-3 text-center">
                  <div className="p-1.5 rounded bg-secondary/30">
                    <p className="text-[10px] text-muted-foreground">KBs</p>
                    <p className="text-sm font-bold" style={{ color: area.color }}>
                      {s?.knowledge_bases ?? 0}
                    </p>
                  </div>
                  <div className="p-1.5 rounded bg-secondary/30">
                    <p className="text-[10px] text-muted-foreground">Docs</p>
                    <p className="text-sm font-bold" style={{ color: area.color }}>
                      {s?.documents ?? 0}
                    </p>
                  </div>
                  <div className="p-1.5 rounded bg-secondary/30">
                    <p className="text-[10px] text-muted-foreground">Chunks</p>
                    <p className="text-sm font-bold" style={{ color: area.color }}>
                      {s?.chunks ?? 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <Badge variant="outline" className="text-[11px]">{area.domain}</Badge>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {formatRelative(s?.last_updated_at ?? null)}
                  </div>
                </div>
                {!populated && (
                  <p className="text-[10px] text-muted-foreground/70 italic mt-2 text-center">
                    Vazio — adicione bases marcadas com este domínio
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
