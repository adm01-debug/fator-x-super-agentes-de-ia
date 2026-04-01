import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Database, Search, Shield, Activity, FlaskConical, Plus, RefreshCw, AlertTriangle, CheckCircle, Clock, Zap, BookOpen, Network, Eye, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

// Mock data
const MOCK_FACTS = [
  { id: '1', content: 'Cliente é inativado após 180 dias sem interação', domain: 'comercial', confidence: 95, source: 'config_regras_negocio', validated: true, validatedBy: 'Sistema', createdAt: '2026-03-15' },
  { id: '2', content: 'Score de fornecedor: Qualidade 30%, Preço 25%, Prazo 25%, Entrega 20%', domain: 'compras', confidence: 100, source: 'config_regras_negocio', validated: true, validatedBy: 'Sistema', createdAt: '2026-03-15' },
  { id: '3', content: 'Homologação de fornecedor vale 365 dias', domain: 'compras', confidence: 100, source: 'config_regras_negocio', validated: true, validatedBy: 'Sistema', createdAt: '2026-03-15' },
  { id: '4', content: 'Temos 55.864 clientes ativos no CRM', domain: 'comercial', confidence: 88, source: 'auto-calculado', validated: false, validatedBy: '', createdAt: '2026-03-31' },
  { id: '5', content: 'Temos 6.123 produtos no catálogo', domain: 'produtos', confidence: 92, source: 'auto-calculado', validated: true, validatedBy: 'Sistema', createdAt: '2026-03-31' },
  { id: '6', content: 'Clientes VIP preferem embalagem premium', domain: 'comercial', confidence: 78, source: 'episódica', validated: false, validatedBy: '', createdAt: '2026-03-28' },
];

const MOCK_ENTITIES = [
  { id: '1', name: 'Sicoob Central', type: 'company', domain: 'comercial', relationships: 12, lastUpdated: '2026-03-30' },
  { id: '2', name: 'SPOT Brindes', type: 'supplier', domain: 'compras', relationships: 8, lastUpdated: '2026-03-29' },
  { id: '3', name: 'Caneta Crystal', type: 'product', domain: 'produtos', relationships: 15, lastUpdated: '2026-03-31' },
  { id: '4', name: 'Serigrafia', type: 'technique', domain: 'produção', relationships: 45, lastUpdated: '2026-03-28' },
  { id: '5', name: 'Joaquim Ataides', type: 'person', domain: 'rh', relationships: 6, lastUpdated: '2026-03-31' },
];

const DECAY_ITEMS = [
  { label: 'Saudável (< 30 dias)', count: 342, color: 'text-emerald-400', pct: 68 },
  { label: 'Envelhecendo (30-90 dias)', count: 98, color: 'text-amber-400', pct: 20 },
  { label: 'Alertado (90-180 dias)', count: 45, color: 'text-orange-400', pct: 9 },
  { label: 'Expirado (> 180 dias)', count: 17, color: 'text-rose-400', pct: 3 },
];

const ENGINES = [
  { name: 'Temporal Knowledge Graph', icon: '🕐', status: 'active', desc: 'Fatos com valid_from/valid_until' },
  { name: 'Knowledge Decay Detection', icon: '📉', status: 'active', desc: 'Detecta conhecimento envelhecido' },
  { name: 'Entity Resolution', icon: '🔗', status: 'active', desc: 'Match probabilístico cross-database' },
  { name: 'Auto-Extraction LLM', icon: '🤖', status: 'active', desc: 'Extrai fatos de documentos via LLM' },
  { name: 'Expert Discovery', icon: '👤', status: 'active', desc: '"Quem sabe sobre X?"' },
  { name: 'Gap Analysis', icon: '🔍', status: 'active', desc: '"O que não sabemos?"' },
  { name: 'Confidence Scoring', icon: '📊', status: 'active', desc: 'Score de confiança (6 fatores)' },
  { name: 'Brain Learning Loop', icon: '🔄', status: 'active', desc: 'Feedback signals → ajuste de conhecimento' },
  { name: 'Multi-modal', icon: '🖼️', status: 'inactive', desc: 'Imagens, vídeos, áudio' },
  { name: 'Brain Sandbox', icon: '🧪', status: 'active', desc: 'Testar queries antes de deploy' },
];

interface SandboxResult {
  query: string;
  score: number;
  source: string;
  latency: number;
  answer: string;
}

export default function SuperCerebroPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<typeof MOCK_FACTS>([]);
  const [sandboxQueries, setSandboxQueries] = useState('');
  const [sandboxResults, setSandboxResults] = useState<SandboxResult[]>([]);
  const [reviewedFacts, setReviewedFacts] = useState<Set<string>>(new Set());
  const [brainPermissions, setBrainPermissions] = useState<Record<string, string>>({});

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Super Cérebro"
        description="Enterprise Memory Layer — Grafo temporal, fatos institucionais, decay detection e 10 engines de conhecimento"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90"><Plus className="h-4 w-4" /> Ingerir Documento</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Fatos', value: '502', icon: BookOpen, color: 'text-primary' },
          { label: 'Entidades', value: '1.847', icon: Network, color: 'text-emerald-400' },
          { label: 'Coleções', value: '8', icon: Database, color: 'text-amber-400' },
          { label: 'Saúde', value: '87%', icon: Activity, color: 'text-emerald-400' },
          { label: 'Engines', value: '9/10', icon: Zap, color: 'text-primary' },
        ].map(kpi => (
          <div key={kpi.label} className="nexus-card text-center py-3">
            <kpi.icon className={`h-5 w-5 mx-auto mb-1 ${kpi.color}`} />
            <p className="text-2xl font-heading font-bold text-foreground">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border/50 p-1 w-full justify-start overflow-x-auto">
          {[
            { id: 'overview', icon: Brain, label: 'Visão Geral' },
            { id: 'collections', icon: Database, label: 'Coleções' },
            { id: 'graph', icon: Network, label: 'Knowledge Graph' },
            { id: 'facts', icon: BookOpen, label: 'Fatos' },
            { id: 'search', icon: Search, label: 'Busca Unificada' },
            { id: 'permissions', icon: Shield, label: 'Permissões' },
            { id: 'health', icon: Activity, label: 'Health Monitor' },
            { id: 'sandbox', icon: FlaskConical, label: 'Brain Sandbox' },
          ].map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs whitespace-nowrap">
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab 1: Visão Geral */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Engines */}
            <div className="nexus-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">10 Engines do Super Cérebro</h3>
              <div className="space-y-2">
                {ENGINES.map(e => (
                  <div key={e.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/10 text-xs">
                    <div className="flex items-center gap-2">
                      <span>{e.icon}</span>
                      <div>
                        <span className="text-foreground font-medium">{e.name}</span>
                        <p className="text-[10px] text-muted-foreground">{e.desc}</p>
                      </div>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${e.status === 'active' ? 'bg-emerald-400' : 'bg-muted'}`} />
                  </div>
                ))}
              </div>
            </div>
            {/* Decay */}
            <div className="nexus-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Knowledge Decay</h3>
              <div className="space-y-3">
                {DECAY_ITEMS.map(d => (
                  <div key={d.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={d.color}>{d.label}</span>
                      <span className="text-muted-foreground">{d.count} ({d.pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${d.pct}%`, background: d.color.includes('emerald') ? '#6BCB77' : d.color.includes('amber') ? '#FFD93D' : d.color.includes('orange') ? '#E67E22' : '#FF6B6B' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3 text-amber-400" />
                <span>17 fatos expirados precisam de revisão</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Coleções */}
        <TabsContent value="collections" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Políticas Comerciais', docs: 42, chunks: 890, status: 'synced', domain: 'comercial' },
              { name: 'Catálogo de Produtos', docs: 6123, chunks: 24500, status: 'synced', domain: 'produtos' },
              { name: 'Regras de Negócio', docs: 19, chunks: 57, status: 'synced', domain: 'operacional' },
              { name: 'Base Jurídica', docs: 89, chunks: 4210, status: 'syncing', domain: 'legal' },
              { name: 'FAQ Suporte', docs: 156, chunks: 1200, status: 'synced', domain: 'suporte' },
              { name: 'Treinamentos', docs: 23, chunks: 340, status: 'synced', domain: 'rh' },
              { name: 'Histórico de Vendas', docs: 0, chunks: 0, status: 'pending', domain: 'vendas' },
              { name: 'Manuais Técnicos', docs: 34, chunks: 2100, status: 'synced', domain: 'produção' },
            ].map(col => (
              <div key={col.name} className="nexus-card">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground">{col.name}</h4>
                  <StatusBadge status={col.status === 'synced' ? 'production' : col.status === 'syncing' ? 'testing' : 'draft'} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>{col.docs} docs</span>
                  <span>{col.chunks.toLocaleString()} chunks</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary mt-2 inline-block">{col.domain}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Knowledge Graph */}
        <TabsContent value="graph" className="mt-4 space-y-4">
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Entidades do Knowledge Graph</h3>
            <div className="space-y-2">
              {MOCK_ENTITIES.map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/10">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{e.type === 'company' ? '🏢' : e.type === 'supplier' ? '🏭' : e.type === 'product' ? '📦' : e.type === 'technique' ? '🎨' : '👤'}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{e.name}</p>
                      <p className="text-[10px] text-muted-foreground">{e.type} · {e.domain} · {e.relationships} relações</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{e.lastUpdated}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="nexus-card text-center py-8">
            <Network className="h-12 w-12 text-primary mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">Visualização do grafo temporal disponível na v1.1</p>
            <p className="text-[10px] text-muted-foreground mt-1">Cada fato tem valid_from, valid_until e superseded_by</p>
          </div>
        </TabsContent>

        {/* Tab 4: Fatos Institucionais */}
        <TabsContent value="facts" className="mt-4">
          <div className="space-y-2">
            {MOCK_FACTS.map(fact => (
              <div key={fact.id} className="nexus-card flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-foreground">{fact.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{fact.domain}</span>
                    <span className="text-[10px] text-muted-foreground">Fonte: {fact.source}</span>
                    <span className="text-[10px] text-muted-foreground">{fact.createdAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className={`text-xs font-mono ${fact.confidence >= 90 ? 'text-emerald-400' : fact.confidence >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>{fact.confidence}%</span>
                  {fact.validated ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 5: Busca Unificada */}
        <TabsContent value="search" className="mt-4 space-y-4">
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Busca Unificada (Vector + BM25 + Graph + Temporal)</h3>
            <div className="flex gap-2">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar no Super Cérebro..." className="flex-1 bg-muted/30 border border-border rounded-lg px-4 py-2 text-sm text-foreground" />
              <Button onClick={() => {
                if (!searchQuery.trim()) { toast.error('Digite algo para buscar'); return; }
                const results = MOCK_FACTS.filter(f =>
                  f.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  f.domain.toLowerCase().includes(searchQuery.toLowerCase())
                );
                // Also include entity matches
                const entityMatches = MOCK_ENTITIES.filter(e =>
                  e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  e.domain.toLowerCase().includes(searchQuery.toLowerCase())
                );
                setSearchResults(results);
                toast.success(`Busca: "${searchQuery}" — ${results.length} fatos + ${entityMatches.length} entidades encontradas`);
              }}>
                <Search className="h-4 w-4 mr-1" /> Buscar
              </Button>
            </div>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{searchResults.length} resultado(s) para "{searchQuery}":</p>
              {searchResults.map(f => (
                <div key={f.id} className="nexus-card">
                  <p className="text-sm text-foreground">{f.content}</p>
                  <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>Score: 0.92</span>
                    <span>Fonte: {f.source}</span>
                    <span>Confiança: {f.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 6: Permissões */}
        <TabsContent value="permissions" className="mt-4">
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Matriz Agente × Domínio</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 font-medium">Agente</th>
                  {['Comercial', 'Produtos', 'Compras', 'RH', 'Legal', 'Financeiro'].map(d => <th key={d} className="text-center py-2 px-2 font-medium">{d}</th>)}
                </tr></thead>
                <tbody>
                  {['Assistente Comercial', 'Analista de Dados', 'Suporte L1', 'Agente BPM'].map(agent => (
                    <tr key={agent} className="border-b border-border/30">
                      <td className="py-2 text-foreground">{agent}</td>
                      {['Comercial', 'Produtos', 'Compras', 'RH', 'Legal', 'Financeiro'].map(d => (
                        <td key={d} className="text-center py-2 px-2">
                          <select className="bg-muted/30 border border-border rounded px-1 py-0.5 text-[10px] text-foreground">
                            <option>Leitura</option><option>Completo</option><option>Nenhum</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" /> LGPD compliance ativo — dados pessoais mascarados por padrão
            </div>
          </div>
        </TabsContent>

        {/* Tab 7: Health Monitor */}
        <TabsContent value="health" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { label: 'Fatos Saudáveis', value: '342 (68%)', color: 'text-emerald-400', icon: CheckCircle },
              { label: 'Contradições Detectadas', value: '3', color: 'text-rose-400', icon: AlertTriangle },
              { label: 'Gaps de Conhecimento', value: '12', color: 'text-amber-400', icon: Eye },
            ].map(m => (
              <div key={m.label} className="nexus-card text-center py-4">
                <m.icon className={`h-6 w-6 mx-auto mb-2 ${m.color}`} />
                <p className={`text-xl font-bold font-mono ${m.color}`}>{m.value}</p>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Fatos sem consulta há mais de 90 dias</h3>
            <div className="space-y-1 text-xs">
              {['Processo de homologação leva 15 dias úteis', 'Taxa de frete para SP é 3.5%', 'Prazo de entrega padrão é 21 dias'].map(f => (
                <div key={f} className="flex items-center justify-between p-2 rounded-lg bg-muted/10">
                  <span className="text-muted-foreground">{f}</span>
                  <Button variant="outline" size="sm" className="h-6 text-[10px]" disabled={reviewedFacts.has(f)} onClick={() => {
                    setReviewedFacts(prev => new Set([...prev, f]));
                    toast.success(`"${f.slice(0, 40)}..." marcado para revisão`);
                  }}>{reviewedFacts.has(f) ? '✓ Revisado' : 'Revisar'}</Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 8: Brain Sandbox */}
        <TabsContent value="sandbox" className="mt-4 space-y-4">
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Brain Sandbox — Testar antes de deploy</h3>
            <p className="text-xs text-muted-foreground mb-3">Cole perguntas (1 por linha) para testar a qualidade das respostas do Super Cérebro.</p>
            <textarea value={sandboxQueries} onChange={e => setSandboxQueries(e.target.value)} className="w-full h-32 bg-muted/30 border border-border rounded-lg p-3 font-mono text-xs text-foreground resize-none" placeholder={"Qual o prazo de entrega padrão?\nQuem é o melhor fornecedor de canetas?\nQuantos clientes ativos temos em SP?\nQual a regra de inativação de clientes?"} />
            <Button className="mt-2" onClick={() => {
              const queries = sandboxQueries.split('\n').filter(Boolean).slice(0, 10);
              if (queries.length === 0) { toast.error('Digite pelo menos 1 pergunta'); return; }
              const sources = ['fato', 'grafo', 'vector', 'BM25'];
              const results: SandboxResult[] = queries.map(q => {
                const matchedFact = MOCK_FACTS.find(f => f.content.toLowerCase().includes(q.toLowerCase().split(' ').slice(0, 3).join(' ')));
                return {
                  query: q,
                  score: matchedFact ? 85 + Math.floor(Math.random() * 10) : 40 + Math.floor(Math.random() * 30),
                  source: matchedFact ? 'fato' : sources[Math.floor(Math.random() * sources.length)],
                  latency: 50 + Math.floor(Math.random() * 200),
                  answer: matchedFact ? matchedFact.content : `Nenhum fato direto encontrado. Resposta inferida via ${sources[Math.floor(Math.random() * sources.length)]}.`,
                };
              });
              setSandboxResults(results);
              const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
              toast.success(`${results.length} perguntas executadas — score médio: ${avgScore}%`);
            }}>
              <FlaskConical className="h-4 w-4 mr-1" /> Executar Sandbox
            </Button>
          </div>
          {sandboxResults.length > 0 && (
            <div className="nexus-card">
              <h4 className="text-sm font-semibold text-foreground mb-2">Resultados ({sandboxResults.length} perguntas)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 font-medium">Pergunta</th>
                    <th className="text-left py-2 font-medium">Resposta</th>
                    <th className="text-center py-2 font-medium">Score</th>
                    <th className="text-center py-2 font-medium">Fonte</th>
                    <th className="text-center py-2 font-medium">Latência</th>
                  </tr></thead>
                  <tbody>
                    {sandboxResults.map((r, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2 text-foreground max-w-[200px] truncate">{r.query}</td>
                        <td className="py-2 text-muted-foreground max-w-[300px] truncate">{r.answer}</td>
                        <td className={`py-2 text-center font-mono ${r.score >= 80 ? 'text-emerald-400' : r.score >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>{r.score}%</td>
                        <td className="py-2 text-center text-muted-foreground">{r.source}</td>
                        <td className="py-2 text-center text-muted-foreground">{r.latency}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
