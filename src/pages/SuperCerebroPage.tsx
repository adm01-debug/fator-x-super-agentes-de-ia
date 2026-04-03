import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain, Search, Network, Loader2, Sparkles, BookOpen, MessageSquare,
  Activity, Users, FlaskConical, AlertTriangle, CheckCircle,
  Clock, Zap, Target, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════
// TAB 1 — VISÃO GERAL (Overview)
// ═══════════════════════════════════════════════════
function OverviewTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['cerebro_stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('cerebro-brain', {
        body: { action: 'stats' },
      });
      if (error) throw error;
      return data;
    },
  });

  const metrics = [
    { label: 'Agentes', value: stats?.agents ?? '—', icon: '🤖', color: 'text-primary' },
    { label: 'Bases de Conhecimento', value: stats?.knowledge_bases ?? '—', icon: '📚', color: 'text-nexus-emerald' },
    { label: 'Chunks RAG', value: stats?.chunks ?? '—', icon: '🧩', color: 'text-cyan-400' },
    { label: 'Memórias', value: stats?.memories ?? '—', icon: '💾', color: 'text-purple-400' },
    { label: 'Ferramentas', value: stats?.tools ?? '—', icon: '🔧', color: 'text-nexus-amber' },
    { label: 'Workflows', value: stats?.workflows ?? '—', icon: '🔄', color: 'text-primary' },
    { label: 'Traces (total)', value: stats?.traces ?? '—', icon: '📊', color: 'text-rose-400' },
    { label: 'Consultas hoje', value: stats?.today_traces ?? '—', icon: '🔍', color: 'text-teal-400' },
  ];

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map(m => (
              <div key={m.label} className="nexus-card text-center py-4">
                <p className="text-2xl mb-1">{m.icon}</p>
                <p className={`text-xl font-heading font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="nexus-card">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" /> Arquitetura de Memória
            </h3>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { icon: '💾', title: 'Memória Semântica', desc: 'Embeddings vetoriais de documentos e conhecimento', status: 'active' },
                { icon: '🕸️', title: 'Grafo de Conhecimento', desc: 'Relações entre agentes, KBs, ferramentas e workflows', status: 'active' },
                { icon: '🔄', title: 'Sync Contínuo', desc: 'Atualização automática via Edge Functions', status: 'active' },
              ].map(l => (
                <div key={l.title} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{l.icon}</span>
                    <span className="text-xs font-semibold text-foreground">{l.title}</span>
                    <Badge variant="outline" className="text-[11px] ml-auto border-nexus-emerald/30 text-nexus-emerald">Ativo</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{l.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TAB 2 — CONSULTAR (Chat/Search)
// ═══════════════════════════════════════════════════
function SearchTab() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('cerebro-query', {
        body: { query, mode: 'chat' },
      });
      if (error) throw error;
      const meta: string[] = [];
      if (data?.facts_loaded > 0) meta.push(`${data.facts_loaded} fatos`);
      if (data?.rag_chunks_used) meta.push(data.rag_reranked ? 'RAG reranked' : 'RAG ativo');
      if (data?.external_facts > 0) meta.push(`${data.external_facts} fatos externos`);
      const metaLine = meta.length > 0 ? `\n\n---\n_${meta.join(' • ')} • Custo: $${data?.cost_usd?.toFixed(6) || '0'}_` : '';
      setSearchResults((data?.response || 'Sem resposta') + metaLine);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro na consulta');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="nexus-card space-y-4">
      <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" /> Consultar o Super Cérebro
      </h3>
      <Textarea
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Pergunte ao Super Cérebro... Ex: Quais são nossos principais fornecedores?"
        className="bg-secondary/50 min-h-[80px] text-sm"
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
      />
      <div className="flex justify-between items-center">
        <p className="text-[11px] text-muted-foreground">Consulta semântica ao conhecimento da empresa (fatos + RAG + bancos externos)</p>
        <Button onClick={handleSearch} disabled={isSearching || !query.trim()} className="nexus-gradient-bg text-primary-foreground gap-2">
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isSearching ? 'Buscando...' : '🧠 Consultar'}
        </Button>
      </div>
      {searchResults && (
        <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
          <p className="text-xs font-semibold text-foreground mb-2">Resposta do Super Cérebro:</p>
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{searchResults}</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TAB 3 — ÁREAS DE CONHECIMENTO
// ═══════════════════════════════════════════════════
const knowledgeAreas = [
  { icon: '📋', title: 'Processos & SOPs', desc: 'Procedimentos operacionais padrão da empresa', domain: 'processos' },
  { icon: '📊', title: 'Relatórios & Dados', desc: 'Relatórios financeiros, KPIs e dashboards', domain: 'dados' },
  { icon: '👥', title: 'RH & Pessoas', desc: 'Políticas de RH, benefícios e cultura', domain: 'rh' },
  { icon: '💰', title: 'Financeiro', desc: 'Orçamentos, projeções e fluxo de caixa', domain: 'financeiro' },
  { icon: '🏭', title: 'Fornecedores', desc: 'Catálogo, preços e avaliações de fornecedores', domain: 'compras' },
  { icon: '🛒', title: 'Produtos & Catálogo', desc: 'Produtos, especificações e preços', domain: 'produtos' },
  { icon: '📞', title: 'Clientes & CRM', desc: 'Base de clientes, histórico e segmentação', domain: 'comercial' },
  { icon: '⚖️', title: 'Jurídico & Compliance', desc: 'Contratos, termos e regulamentações', domain: 'juridico' },
];

function KnowledgeAreasTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {knowledgeAreas.map(area => (
        <div key={area.title} className="nexus-card cursor-pointer hover:border-primary/30 transition-colors">
          <div className="text-3xl mb-3">{area.icon}</div>
          <h3 className="text-sm font-semibold text-foreground">{area.title}</h3>
          <p className="text-[11px] text-muted-foreground mt-1 mb-3">{area.desc}</p>
          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <Badge variant="outline" className="text-[11px]">{area.domain}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TAB 4 — GRAFO DE CONHECIMENTO
// ═══════════════════════════════════════════════════
function KnowledgeGraphTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cerebro_graph'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('cerebro-brain', {
        body: { action: 'knowledge_graph' },
      });
      if (error) throw error;
      return data as { nodes: any[]; edges: any[] };
    },
  });

  const nodesByType = (type: string) => data?.nodes?.filter((n: any) => n.type === type) || [];
  const typeConfig: Record<string, { emoji: string; label: string; color: string }> = {
    agent: { emoji: '🤖', label: 'Agentes', color: 'border-primary/50 bg-primary/5' },
    knowledge_base: { emoji: '📚', label: 'Bases de Conhecimento', color: 'border-nexus-emerald/50 bg-nexus-emerald/5' },
    tool: { emoji: '🔧', label: 'Ferramentas', color: 'border-nexus-amber/50 bg-nexus-amber/5' },
    workflow: { emoji: '🔄', label: 'Workflows', color: 'border-cyan-500/50 bg-cyan-500/5' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" /> Grafo de Conhecimento
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Mapa visual de entidades e suas relações no ecossistema</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(typeConfig).map(([type, cfg]) => (
              <div key={type} className={`nexus-card text-center py-3 border ${cfg.color}`}>
                <p className="text-xl mb-1">{cfg.emoji}</p>
                <p className="text-lg font-bold text-foreground">{nodesByType(type).length}</p>
                <p className="text-[11px] text-muted-foreground">{cfg.label}</p>
              </div>
            ))}
          </div>

          {/* Node lists by type */}
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(typeConfig).map(([type, cfg]) => {
              const nodes = nodesByType(type);
              if (nodes.length === 0) return null;
              return (
                <div key={type} className="nexus-card">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    {cfg.emoji} {cfg.label} ({nodes.length})
                  </h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {nodes.map((n: any) => (
                      <div key={n.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/20">
                        <span className="text-sm">{n.emoji || cfg.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{n.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {n.status && <span className="capitalize">{n.status}</span>}
                            {n.docs != null && ` • ${n.docs} docs`}
                            {n.chunks != null && ` • ${n.chunks} chunks`}
                            {n.toolType && ` • ${n.toolType}`}
                            {n.enabled === false && ' • Desabilitado'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Edges / Relationships */}
          {data?.edges && data.edges.length > 0 && (
            <div className="nexus-card">
              <h4 className="text-xs font-semibold text-foreground mb-3">🔗 Relações ({data.edges.length})</h4>
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                {data.edges.map((e: any, i: number) => {
                  const source = data.nodes?.find((n: any) => n.id === e.source);
                  const target = data.nodes?.find((n: any) => n.id === e.target);
                  return (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="text-foreground font-medium">{source?.label || '?'}</span>
                      <span className="text-primary">→ {e.label} →</span>
                      <span className="text-foreground font-medium">{target?.label || '?'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TAB 5 — SAÚDE DO CONHECIMENTO (Decay + Gaps)
// ═══════════════════════════════════════════════════
function KnowledgeHealthTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cerebro_health'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('cerebro-brain', {
        body: { action: 'knowledge_health' },
      });
      if (error) throw error;
      return data;
    },
  });

  const freshnessIcon = (f: string) => {
    if (f === 'fresh') return <CheckCircle className="h-3.5 w-3.5 text-nexus-emerald" />;
    if (f === 'aging') return <Clock className="h-3.5 w-3.5 text-nexus-amber" />;
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  };

  const freshnessLabel = (f: string) => {
    if (f === 'fresh') return 'Atualizado';
    if (f === 'aging') return 'Envelhecendo';
    return 'Desatualizado';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Saúde do Conhecimento
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Detecção de degradação, gaps e frescor dos dados</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Analisar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="nexus-card text-center py-3">
              <p className="text-lg font-bold text-nexus-emerald">{data.summary?.fresh || 0}</p>
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><CheckCircle className="h-3 w-3" /> Atualizados</p>
            </div>
            <div className="nexus-card text-center py-3">
              <p className="text-lg font-bold text-nexus-amber">{data.summary?.aging || 0}</p>
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Clock className="h-3 w-3" /> Envelhecendo</p>
            </div>
            <div className="nexus-card text-center py-3">
              <p className="text-lg font-bold text-destructive">{data.summary?.stale || 0}</p>
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3" /> Desatualizados</p>
            </div>
            <div className="nexus-card text-center py-3">
              <p className="text-lg font-bold text-primary">{data.chunks?.done || 0}</p>
              <p className="text-[11px] text-muted-foreground">Chunks embeddados</p>
              {(data.chunks?.pending > 0 || data.chunks?.failed > 0) && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {data.chunks.pending > 0 && <span className="text-nexus-amber">{data.chunks.pending} pendentes</span>}
                  {data.chunks.pending > 0 && data.chunks.failed > 0 && ' • '}
                  {data.chunks.failed > 0 && <span className="text-destructive">{data.chunks.failed} falhas</span>}
                </p>
              )}
            </div>
          </div>

          {/* Gaps */}
          {data.gaps?.length > 0 && (
            <div className="nexus-card border-nexus-amber/30">
              <h4 className="text-xs font-semibold text-nexus-amber mb-2 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Gaps Identificados ({data.gaps.length})
              </h4>
              <div className="space-y-1.5">
                {data.gaps.map((g: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 text-nexus-amber mt-0.5 shrink-0" />
                    <span>{g}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items list */}
          <div className="nexus-card">
            <h4 className="text-xs font-semibold text-foreground mb-3">📋 Inventário de Conhecimento ({data.items?.length || 0})</h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {data.items?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/20">
                  {freshnessIcon(item.freshness)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.type === 'knowledge_base' ? '📚 Base de Conhecimento' : '🤖 Agente'}
                      {item.docs != null && ` • ${item.docs} docs`}
                      {item.status && ` • ${item.status}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`text-[11px] ${
                      item.freshness === 'fresh' ? 'border-nexus-emerald/30 text-nexus-emerald' :
                      item.freshness === 'aging' ? 'border-nexus-amber/30 text-nexus-amber' :
                      'border-destructive/30 text-destructive'
                    }`}>{freshnessLabel(item.freshness)}</Badge>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.daysSinceUpdate}d atrás</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TAB 6 — EXTRAÇÃO AUTOMÁTICA (LLM Auto-Extract)
// ═══════════════════════════════════════════════════
function AutoExtractionTab() {
  const [text, setText] = useState('');
  const [extractType, setExtractType] = useState('entities');
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!text.trim()) return;
    setIsExtracting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('cerebro-brain', {
        body: { action: 'auto_extract', text, extract_type: extractType },
      });
      if (error) throw error;
      const meta = data?.cost_usd ? `\n\n---\n_Custo: $${data.cost_usd.toFixed(6)}_` : '';
      setResult((data?.extracted || 'Nenhuma extração') + meta);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro na extração');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Extração Automática via LLM
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Cole um texto e extraia entidades, fatos, regras ou contatos automaticamente</p>
      </div>

      <div className="nexus-card space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-[11px] text-muted-foreground font-medium">Tipo de extração</label>
            <Select value={extractType} onValueChange={setExtractType}>
              <SelectTrigger className="bg-secondary/50 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entities">🏢 Entidades (pessoas, empresas, produtos)</SelectItem>
                <SelectItem value="facts">📊 Fatos e informações</SelectItem>
                <SelectItem value="rules">📋 Regras de negócio</SelectItem>
                <SelectItem value="contacts">📞 Contatos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Cole aqui o texto de um email, documento, ata de reunião, contrato..."
          className="bg-secondary/50 min-h-[120px] text-sm"
        />

        <div className="flex justify-between items-center">
          <p className="text-[11px] text-muted-foreground">{text.length} caracteres</p>
          <Button onClick={handleExtract} disabled={isExtracting || !text.trim()} className="nexus-gradient-bg text-primary-foreground gap-2">
            {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {isExtracting ? 'Extraindo...' : 'Extrair'}
          </Button>
        </div>

        {result && (
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
            <p className="text-xs font-semibold text-foreground mb-2">Resultado da Extração ({extractType}):</p>
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{result}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TAB 7 — ESPECIALISTAS (Expert Discovery)
// ═══════════════════════════════════════════════════
function ExpertDiscoveryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['cerebro_experts'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('cerebro-brain', {
        body: { action: 'expert_discovery' },
      });
      if (error) throw error;
      return data?.experts || [];
    },
  });

  const agents = (data || []).filter((e: any) => e.type === 'agent');
  const humans = (data || []).filter((e: any) => e.type === 'human');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Descoberta de Especialistas
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Descubra quem (agente ou humano) sabe o quê na organização</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* AI Experts */}
          <div className="nexus-card">
            <h4 className="text-xs font-semibold text-foreground mb-3">🤖 Agentes Especialistas ({agents.length})</h4>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {agents.map((expert: any) => (
                <div key={expert.id} className="p-3 rounded-lg bg-secondary/30 border border-border/20">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{expert.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{expert.name}</p>
                      {expert.mission && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{expert.mission}</p>}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {expert.domains?.map((d: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[8px] px-1.5">{d}</Badge>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        {expert.hasRAG && <span className="text-nexus-emerald">📚 RAG</span>}
                        {expert.toolCount > 0 && <span className="text-nexus-amber">🔧 {expert.toolCount}</span>}
                        <span className="capitalize">{expert.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {agents.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum agente criado ainda</p>}
            </div>
          </div>

          {/* Human Experts */}
          <div className="nexus-card">
            <h4 className="text-xs font-semibold text-foreground mb-3">👤 Equipe ({humans.length})</h4>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {humans.map((expert: any) => (
                <div key={expert.id} className="p-3 rounded-lg bg-secondary/30 border border-border/20">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{expert.emoji}</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-foreground">{expert.name}</p>
                      <div className="flex gap-1 mt-1">
                        {expert.domains?.map((d: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[8px] px-1.5 capitalize">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {humans.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro no workspace</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TAB 8 — SANDBOX (Brain Sandbox)
// ═══════════════════════════════════════════════════
function BrainSandboxTab() {
  const [query, setQuery] = useState('');
  const [contextMode, setContextMode] = useState('full');
  const [isTesting, setIsTesting] = useState(false);
  const [results, setResults] = useState<Array<{ mode: string; response: string; context_size: number; cost: number }>>([]);

  const handleTest = async () => {
    if (!query.trim()) return;
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('cerebro-brain', {
        body: { action: 'brain_sandbox', query, context_mode: contextMode },
      });
      if (error) throw error;
      setResults(prev => [...prev, {
        mode: contextMode,
        response: data?.response || 'Sem resposta',
        context_size: data?.context_size || 0,
        cost: data?.cost_usd || 0,
      }]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro no sandbox');
    } finally {
      setIsTesting(false);
    }
  };

  const modeLabels: Record<string, string> = {
    full: '🧠 Contexto Completo (Fatos + RAG)',
    facts_only: '📊 Apenas Fatos',
    rag_only: '📚 Apenas RAG',
    no_context: '🚫 Sem Contexto',
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" /> Brain Sandbox
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Teste como o Super Cérebro responde com diferentes contextos — compare respostas lado a lado</p>
      </div>

      <div className="nexus-card space-y-4">
        <Textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Faça uma pergunta para testar com diferentes contextos..."
          className="bg-secondary/50 min-h-[60px] text-sm"
        />

        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-[11px] text-muted-foreground font-medium">Modo de Contexto</label>
            <Select value={contextMode} onValueChange={setContextMode}>
              <SelectTrigger className="bg-secondary/50 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">🧠 Completo (Fatos + RAG)</SelectItem>
                <SelectItem value="facts_only">📊 Apenas Fatos da plataforma</SelectItem>
                <SelectItem value="rag_only">📚 Apenas RAG / base de docs</SelectItem>
                <SelectItem value="no_context">🚫 Sem contexto (LLM puro)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleTest} disabled={isTesting || !query.trim()} className="nexus-gradient-bg text-primary-foreground gap-2">
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Testar
          </Button>
          {results.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setResults([])} className="text-xs">Limpar</Button>
          )}
        </div>
      </div>

      {/* Results comparison */}
      {results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((r, i) => (
            <div key={i} className="nexus-card">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-[11px]">{modeLabels[r.mode] || r.mode}</Badge>
                <span className="text-[11px] text-muted-foreground">
                  {r.context_size} chars • ${r.cost.toFixed(6)}
                </span>
              </div>
              <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                {r.response}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════
export default function SuperCerebroPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader title="🧠 Super Cérebro" description="Enterprise Memory Layer — Memória centralizada da empresa" />

      <InfoHint title="O que é o Super Cérebro?">
        O Super Cérebro é a camada de memória empresarial que conecta todos os agentes. Ele armazena conhecimento institucional, processos, dados de clientes e fornecedores — permitindo que qualquer agente acesse informações da empresa em tempo real.
      </InfoHint>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="text-xs gap-1.5"><Brain className="h-3.5 w-3.5" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="search" className="text-xs gap-1.5"><Search className="h-3.5 w-3.5" /> Consultar</TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Áreas</TabsTrigger>
          <TabsTrigger value="graph" className="text-xs gap-1.5"><Network className="h-3.5 w-3.5" /> Grafo</TabsTrigger>
          <TabsTrigger value="health" className="text-xs gap-1.5"><Activity className="h-3.5 w-3.5" /> Saúde</TabsTrigger>
          <TabsTrigger value="extract" className="text-xs gap-1.5"><Zap className="h-3.5 w-3.5" /> Extração</TabsTrigger>
          <TabsTrigger value="experts" className="text-xs gap-1.5"><Users className="h-3.5 w-3.5" /> Especialistas</TabsTrigger>
          <TabsTrigger value="sandbox" className="text-xs gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> Sandbox</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="search" className="mt-4"><SearchTab /></TabsContent>
        <TabsContent value="knowledge" className="mt-4"><KnowledgeAreasTab /></TabsContent>
        <TabsContent value="graph" className="mt-4"><KnowledgeGraphTab /></TabsContent>
        <TabsContent value="health" className="mt-4"><KnowledgeHealthTab /></TabsContent>
        <TabsContent value="extract" className="mt-4"><AutoExtractionTab /></TabsContent>
        <TabsContent value="experts" className="mt-4"><ExpertDiscoveryTab /></TabsContent>
        <TabsContent value="sandbox" className="mt-4"><BrainSandboxTab /></TabsContent>
      </Tabs>
    </div>
  );
}
