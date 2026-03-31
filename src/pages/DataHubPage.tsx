import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Server, Search, Map, RefreshCw, Code, Activity, Shield, Plus, ExternalLink, Zap } from 'lucide-react';
import { toast } from 'sonner';

// Dados reais das conexões (seed)
const CONNECTIONS = [
  { id: '1', name: 'bancodadosclientes', display: 'CRM & Vendas', icon: '📊', color: '#4D96FF', domain: 'clientes', status: 'connected' as const, tables: 100, rows: 524000, latency: 45, desc: '57K empresas, 52K clientes, SINGU, RFM, vendas', topTables: ['companies (57K)', 'customers (52K)', 'company_social_media (99K)', 'interactions (10K)'] },
  { id: '2', name: 'supabase-fuchsia-kite', display: 'Catálogo de Produtos', icon: '📦', color: '#6BCB77', domain: 'produtos', status: 'connected' as const, tables: 115, rows: 380000, latency: 38, desc: '6K produtos, 16K variantes, 46K imagens, kits', topTables: ['product_relationships (107K)', 'product_images (46K)', 'product_tags (23K)', 'products (6K)'] },
  { id: '3', name: 'backupgiftstore', display: 'WhatsApp & Atendimento', icon: '📱', color: '#FF6B6B', domain: 'atendimento', status: 'connected' as const, tables: 79, rows: 9200, latency: 52, desc: '8K mensagens, 783 contatos, filas, SLA', topTables: ['messages (8K)', 'contacts (783)', 'role_permissions (38)', 'permissions (18)'] },
  { id: '4', name: 'gestao_time_promo', display: 'RH & Colaboradores', icon: '👥', color: '#9B59B6', domain: 'rh', status: 'connected' as const, tables: 36, rows: 6000, latency: 41, desc: '53 colaboradores, ponto eletrônico, férias', topTables: ['controle_ponto (579)', 'batidas_ponto (537)', 'colaboradores (53)', 'faltas (85)'] },
  { id: '5', name: 'financeiro_promo', display: 'Financeiro', icon: '💰', color: '#FFD93D', domain: 'financeiro', status: 'hibernated' as const, tables: 0, rows: 0, latency: 0, desc: 'Contas a pagar/receber, fluxo de caixa', topTables: [] },
];

const ENTITIES = [
  { name: 'Cliente', icon: '👤', source: 'bancodadosclientes.companies', records: 52235, crossDb: true },
  { name: 'Fornecedor', icon: '🏭', source: 'bancodadosclientes.suppliers', records: 754, crossDb: true },
  { name: 'Transportadora', icon: '🚚', source: 'bancodadosclientes.carriers', records: 112, crossDb: false },
  { name: 'Produto', icon: '📦', source: 'supabase-fuchsia-kite.products', records: 6123, crossDb: true },
  { name: 'Colaborador', icon: '👨‍💼', source: 'gestao_time_promo.colaboradores', records: 53, crossDb: true },
  { name: 'Conversa WhatsApp', icon: '💬', source: 'backupgiftstore.messages', records: 8209, crossDb: false },
  { name: 'Categoria', icon: '📂', source: 'supabase-fuchsia-kite.categories', records: 438, crossDb: false },
  { name: 'Técnica Gravação', icon: '🎨', source: 'supabase-fuchsia-kite.tecnicas_gravacao', records: 45, crossDb: false },
  { name: 'Grupo Econômico', icon: '🏢', source: 'bancodadosclientes.grupos_economicos', records: 1334, crossDb: false },
  { name: 'Pedido/Venda', icon: '📋', source: 'bancodadosclientes.sales', records: 0, crossDb: false },
  { name: 'Score RFM', icon: '📊', source: 'bancodadosclientes.company_rfm_scores', records: 48616, crossDb: false },
  { name: 'Perfil DISC', icon: '🧠', source: 'bancodadosclientes.disc_profile_config', records: 16, crossDb: false },
];

const statusColors: Record<string, string> = { connected: 'production', disconnected: 'draft', error: 'error', hibernated: 'paused', syncing: 'testing' };

export default function DataHubPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const totalTables = CONNECTIONS.reduce((s, c) => s + c.tables, 0);
  const totalRows = CONNECTIONS.reduce((s, c) => s + c.rows, 0);
  const connectedCount = CONNECTIONS.filter(c => c.status === 'connected').length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="DataHub"
        description="Gestão unificada dos 5 bancos de dados da Promo Brindes — 340+ tabelas, 920K+ registros"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90"><Plus className="h-4 w-4" /> Conectar Banco</Button>}
      />

      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Bancos', value: CONNECTIONS.length, sub: `${connectedCount} ativos` },
          { label: 'Tabelas', value: totalTables, sub: 'mapeadas' },
          { label: 'Registros', value: `${(totalRows / 1000).toFixed(0)}K`, sub: 'total' },
          { label: 'Entidades', value: ENTITIES.length, sub: 'de negócio' },
          { label: 'Latência média', value: `${Math.round(CONNECTIONS.filter(c => c.latency > 0).reduce((s, c) => s + c.latency, 0) / connectedCount)}ms`, sub: 'p50' },
        ].map(kpi => (
          <div key={kpi.label} className="nexus-card text-center py-3">
            <p className="text-2xl font-heading font-bold text-foreground">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground">{kpi.label} · {kpi.sub}</p>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border/50 p-1 w-full justify-start overflow-x-auto">
          {[
            { id: 'overview', icon: Database, label: 'Visão Geral' },
            { id: 'connections', icon: Server, label: 'Conexões' },
            { id: 'explorer', icon: Search, label: 'Explorer' },
            { id: 'entities', icon: Map, label: 'Entidades' },
            { id: 'sync', icon: RefreshCw, label: 'Sync' },
            { id: 'query', icon: Code, label: 'Query Builder' },
            { id: 'health', icon: Activity, label: 'Saúde' },
            { id: 'permissions', icon: Shield, label: 'Permissões' },
          ].map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs whitespace-nowrap">
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab 1: Visão Geral */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {CONNECTIONS.map(conn => (
              <div key={conn.id} className="nexus-card" style={{ borderLeftColor: conn.color, borderLeftWidth: 3 }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{conn.icon}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{conn.display}</h3>
                      <p className="text-[10px] font-mono text-muted-foreground">{conn.name}</p>
                    </div>
                  </div>
                  <StatusBadge status={statusColors[conn.status]} />
                </div>
                <p className="text-xs text-muted-foreground mb-3">{conn.desc}</p>
                <div className="grid grid-cols-3 gap-2 text-center border-t border-border/50 pt-2">
                  <div><p className="text-sm font-bold text-foreground">{conn.tables}</p><p className="text-[10px] text-muted-foreground">tabelas</p></div>
                  <div><p className="text-sm font-bold text-foreground">{conn.rows > 0 ? `${(conn.rows / 1000).toFixed(0)}K` : '—'}</p><p className="text-[10px] text-muted-foreground">registros</p></div>
                  <div><p className="text-sm font-bold text-foreground">{conn.latency > 0 ? `${conn.latency}ms` : '—'}</p><p className="text-[10px] text-muted-foreground">latência</p></div>
                </div>
                {conn.topTables.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground mb-1">Maiores tabelas:</p>
                    <div className="flex flex-wrap gap-1">{conn.topTables.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">{t}</span>)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Conexões */}
        <TabsContent value="connections" className="mt-4 space-y-4">
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Wizard de Nova Conexão</h3>
            <div className="grid grid-cols-5 gap-2 text-center text-xs text-muted-foreground">
              {['1. URL + Keys', '2. Auto-discovery', '3. Categorização', '4. Config Sync', '5. Confirmação'].map((step, i) => (
                <div key={step} className={`py-2 rounded-lg ${i === 0 ? 'bg-primary/10 text-primary font-medium' : 'bg-muted/20'}`}>{step}</div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input placeholder="https://xxxxx.supabase.co" className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
              <Button size="sm">Conectar</Button>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Explorer */}
        <TabsContent value="explorer" className="mt-4">
          <div className="nexus-card">
            <div className="flex items-center gap-3 mb-4">
              <select className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                {CONNECTIONS.filter(c => c.status === 'connected').map(c => <option key={c.id} value={c.name}>{c.icon} {c.display}</option>)}
              </select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input placeholder="Buscar tabela..." className="w-full pl-9 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {['companies', 'customers', 'contacts', 'suppliers', 'carriers', 'interactions', 'sales', 'products'].map(t => (
                <button key={t} className="text-left p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                  <Database className="h-3 w-3 text-primary inline mr-1" />{t}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Entidades */}
        <TabsContent value="entities" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ENTITIES.map(e => (
              <div key={e.name} className="nexus-card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{e.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{e.name}</h3>
                    <p className="text-[10px] font-mono text-muted-foreground">{e.source}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{e.records.toLocaleString()} registros</span>
                  {e.crossDb && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">Cross-DB</span>}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 5: Sync */}
        <TabsContent value="sync" className="mt-4">
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Pipeline de Sincronização → Super Cérebro</h3>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs">
              {['📥 Fonte', '🔍 Filter', '🔄 Transform', '🧮 Embed', '💾 Brain Store'].map((step, i) => (
                <div key={step} className="flex items-center gap-2 shrink-0">
                  <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border whitespace-nowrap">{step}</div>
                  {i < 4 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {ENTITIES.filter(e => e.records > 100).slice(0, 5).map(e => (
                <div key={e.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/10 text-xs">
                  <span className="text-foreground">{e.icon} {e.name}</span>
                  <span className="text-muted-foreground">{e.records.toLocaleString()} registros</span>
                  <Button variant="outline" size="sm" onClick={() => toast.success(`Sync de ${e.name} iniciado`)}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Sync
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 6: Query Builder */}
        <TabsContent value="query" className="mt-4">
          <div className="nexus-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Query Builder</h3>
            <textarea className="w-full h-32 bg-muted/30 border border-border rounded-lg p-3 font-mono text-xs text-foreground resize-none" placeholder="SELECT * FROM companies WHERE status = 'ativo' LIMIT 10;" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => toast.success('Query executada — 10 resultados')}>
                <Zap className="h-3 w-3 mr-1" /> Executar
              </Button>
              <Button variant="outline" size="sm">Salvar Query</Button>
            </div>
          </div>
        </TabsContent>

        {/* Tab 7: Saúde */}
        <TabsContent value="health" className="mt-4">
          <div className="space-y-3">
            {CONNECTIONS.map(conn => (
              <div key={conn.id} className="nexus-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{conn.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{conn.display}</p>
                    <p className="text-[10px] text-muted-foreground">{conn.tables} tabelas · {conn.rows > 0 ? `${(conn.rows / 1000).toFixed(0)}K rows` : 'hibernado'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className={conn.latency > 0 ? (conn.latency < 50 ? 'text-emerald-400' : 'text-amber-400') : 'text-muted-foreground'}>
                    {conn.latency > 0 ? `${conn.latency}ms` : '—'}
                  </span>
                  <StatusBadge status={statusColors[conn.status]} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 8: Permissões */}
        <TabsContent value="permissions" className="mt-4">
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Matriz de Acesso — Agente × Banco</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Agente</th>
                    {CONNECTIONS.filter(c => c.status === 'connected').map(c => (
                      <th key={c.id} className="text-center py-2 px-2 font-medium">{c.icon} {c.display}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['Assistente Comercial', 'Analista de Dados', 'Suporte L1', 'Agente BPM'].map(agent => (
                    <tr key={agent} className="border-b border-border/30">
                      <td className="py-2 pr-4 text-foreground">{agent}</td>
                      {CONNECTIONS.filter(c => c.status === 'connected').map(c => (
                        <td key={c.id} className="text-center py-2 px-2">
                          <select className="bg-muted/30 border border-border rounded px-1.5 py-0.5 text-[10px] text-foreground">
                            <option value="read">Leitura</option>
                            <option value="read_write">Leitura/Escrita</option>
                            <option value="none">Sem acesso</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
