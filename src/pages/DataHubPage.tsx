import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { BANK_HEALTH_SCORES } from '@/config/datahub-blacklist';
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
  { name: 'Cliente', icon: '👤', source: 'companies WHERE is_customer=true', records: 55864, crossDb: true, matchKey: 'email + cnpj_raiz' },
  { name: 'Fornecedor', icon: '🏭', source: 'companies WHERE is_supplier=true', records: 754, crossDb: true, matchKey: 'cnpj_raiz (8 dígitos)' },
  { name: 'Transportadora', icon: '🚚', source: 'companies WHERE is_carrier=true', records: 112, crossDb: false, matchKey: 'cnpj_raiz' },
  { name: 'Produto', icon: '📦', source: 'supabase-fuchsia-kite.products', records: 6123, crossDb: true, matchKey: 'product_id' },
  { name: 'Colaborador', icon: '👨‍💼', source: 'gestao_time_promo.colaboradores', records: 53, crossDb: true, matchKey: 'email (NÃO user_id!)' },
  { name: 'Conversa WhatsApp', icon: '💬', source: 'backupgiftstore.messages', records: 8209, crossDb: true, matchKey: 'telefone normalizado' },
  { name: 'Categoria', icon: '📂', source: 'supabase-fuchsia-kite.categories', records: 438, crossDb: false, matchKey: 'id' },
  { name: 'Técnica Gravação', icon: '🎨', source: 'supabase-fuchsia-kite.tecnicas_gravacao', records: 45, crossDb: false, matchKey: 'id' },
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
            { id: 'identity', icon: ExternalLink, label: 'Identity Resolution' },
            { id: 'quality', icon: Zap, label: 'Data Quality' },
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
                {e.matchKey && <p className="text-[9px] text-muted-foreground/70 mb-1">Match: {e.matchKey}</p>}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{e.records.toLocaleString()} registros</span>
                  {e.crossDb && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">Cross-DB</span>}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 5: Identity Resolution */}
        <TabsContent value="identity" className="mt-4 space-y-4">
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Identity Resolution — Cross-Database Matching</h3>
            <p className="text-xs text-muted-foreground mb-4">Resolve "quem é quem" entre os 5 bancos usando email, CNPJ (raiz 8 dígitos) e telefone normalizado.</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Resolvidas', value: 487, color: 'text-emerald-400' },
                { label: 'Pendentes (review)', value: 23, color: 'text-amber-400' },
                { label: 'Irreconciliáveis', value: 8, color: 'text-rose-400' },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-lg bg-muted/20">
                  <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 font-medium">Entidade</th>
                  <th className="text-center py-2 font-medium">Método</th>
                  <th className="text-center py-2 font-medium">Confiança</th>
                  <th className="text-center py-2 font-medium">CRM</th>
                  <th className="text-center py-2 font-medium">Catálogo</th>
                  <th className="text-center py-2 font-medium">WhatsApp</th>
                  <th className="text-center py-2 font-medium">RH</th>
                </tr></thead>
                <tbody>
                  {[
                    { name: 'SPOT Brindes', method: 'cnpj_raiz', conf: 95, crm: true, cat: true, wpp: false, rh: false },
                    { name: 'Asia Import', method: 'cnpj_raiz', conf: 92, crm: true, cat: true, wpp: false, rh: false },
                    { name: 'Joaquim Ataides', method: 'email', conf: 100, crm: true, cat: false, wpp: false, rh: true },
                    { name: 'Sicoob Central', method: 'cnpj_raiz', conf: 88, crm: true, cat: false, wpp: true, rh: false },
                    { name: 'XBZ Brindes', method: 'name_fuzzy', conf: 72, crm: true, cat: true, wpp: false, rh: false },
                  ].map(row => (
                    <tr key={row.name} className="border-b border-border/30">
                      <td className="py-2 text-foreground font-medium">{row.name}</td>
                      <td className="py-2 text-center"><span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">{row.method}</span></td>
                      <td className={`py-2 text-center font-mono ${row.conf >= 90 ? 'text-emerald-400' : row.conf >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>{row.conf}%</td>
                      <td className="py-2 text-center">{row.crm ? '✅' : '—'}</td>
                      <td className="py-2 text-center">{row.cat ? '✅' : '—'}</td>
                      <td className="py-2 text-center">{row.wpp ? '✅' : '—'}</td>
                      <td className="py-2 text-center">{row.rh ? '✅' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-xs text-muted-foreground">
            <strong className="text-foreground">Chaves de matching:</strong> EMAIL (exato) → CNPJ raiz (8 dígitos) → Telefone normalizado → Nome fuzzy (pg_trgm, similarity &gt; 0.8)
          </div>
        </TabsContent>

        {/* Tab 6: Data Quality */}
        <TabsContent value="quality" className="mt-4 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Score Geral', value: '58/100', color: 'text-rose-400' },
              { label: 'Gaps Críticos', value: '8', color: 'text-rose-400' },
              { label: 'Gaps Altos', value: '9', color: 'text-amber-400' },
              { label: 'Gaps Médios', value: '6', color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="nexus-card text-center py-3">
                <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[
              { severity: 'critical', icon: '🔴', items: [
                { desc: '287 empresas multi-role (cliente+fornecedor) — contexto ambíguo', records: 287, fix: 'Entity mapping multi-role' },
                { desc: '97% clientes SEM pessoa de contato (só company_phones)', records: 53694, fix: 'Incluir company_phones/emails no entity mapping' },
                { desc: 'RFM 100% "Hibernating" — scores completamente inúteis', records: 48616, fix: 'Recalcular ou excluir do sync' },
                { desc: 'Tabela sales tem dados FAKE (João Silva, Plano Premium)', records: 18, fix: 'Excluir sales do DataHub (blacklist)' },
                { desc: 'Pipeline sync CRM↔Bitrix24 PARADO (0 interações em 7 dias)', records: 0, fix: 'Reativar pipeline n8n urgente' },
                { desc: 'Filiais como empresas separadas (Sicoob=10+ registros)', records: 0, fix: 'Agrupar por grupo_economico/cnpj_raiz' },
                { desc: 'financeiro_promo HIBERNADO', records: 0, fix: 'Deshibernação no dashboard Supabase' },
                { desc: 'IDs cross-database incompatíveis (CRM user_id=10 ≠ RH bitrix_id=1)', records: 0, fix: 'Identity map por EMAIL (20/21 matcharam)' },
              ]},
              { severity: 'high', icon: '🟡', items: [
                { desc: '2.976 clientes ativos incontactáveis (sem telefone/email/contato)', records: 2976, fix: 'Data enrichment ou flag "incontactável"' },
                { desc: 'Coluna chama "estado" não "uf" — queries de exemplo erradas', records: 0, fix: 'Corrigir queries e entity mappings' },
                { desc: '13.500 clientes sem vendedor atribuído (28%)', records: 13500, fix: 'Atribuição automática ou alerta' },
                { desc: 'Própria empresa no ranking de clientes (#1 SP)', records: 1, fix: 'Filtro para excluir empresa própria' },
                { desc: 'Técnica de gravação requer 3 JOINs (entity mapping complexo)', records: 0, fix: 'Materializar view ou cache' },
                { desc: '53% colaboradores sem CPF', records: 28, fix: 'Compliance — preencher urgente' },
                { desc: 'gestor_id NULL em 100% dos colaboradores', records: 53, fix: 'Mapear hierarquia organizacional' },
                { desc: 'Tabelas de gamificação com dados fake/teste', records: 318, fix: 'Adicionar ao blacklist' },
                { desc: 'CNPJ com 3 formatos no mesmo banco (5.519 sem pontuação)', records: 5519, fix: 'normalize_cnpj() em todas as queries' },
              ]},
              { severity: 'medium', icon: '🟢', items: [
                { desc: '1.383 empresas sem nenhum flag (fantasmas)', records: 1383, fix: 'Classificar ou arquivar' },
                { desc: '1.804 empresas sem razão social', records: 1804, fix: 'Excluir registros vazios' },
                { desc: '241 contatos sem email E sem telefone', records: 241, fix: 'Registros irrecuperáveis — arquivar' },
                { desc: '235 fornecedores sem CNPJ (31% — irreconciliáveis)', records: 235, fix: 'Match por nome fuzzy como fallback' },
                { desc: '96 produtos sem imagem (1.6%)', records: 96, fix: 'Solicitar imagens aos fornecedores' },
                { desc: 'pgvector não instalado nos bancos externos', records: 0, fix: 'Instalar no banco Nexus (não nos externos)' },
              ]},
            ].map(group => (
              <div key={group.severity} className="nexus-card">
                <h3 className="text-sm font-semibold text-foreground mb-2">{group.icon} {group.severity === 'critical' ? 'Crítico' : group.severity === 'high' ? 'Alto' : 'Médio'}</h3>
                <div className="space-y-2">
                  {group.items.map(item => (
                    <div key={item.desc} className="flex items-start justify-between p-2 rounded-lg bg-muted/10 text-xs">
                      <div className="flex-1">
                        <p className="text-foreground">{item.desc}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Fix: {item.fix}</p>
                      </div>
                      <span className="text-muted-foreground shrink-0 ml-2">{item.records > 0 ? `${item.records.toLocaleString()} reg.` : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 7: Sync */}
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
        <TabsContent value="health" className="mt-4 space-y-4">
          <div className="nexus-card text-center py-4">
            <p className="text-3xl font-bold font-mono text-amber-400">58/100</p>
            <p className="text-xs text-muted-foreground">Score geral do ecossistema de dados</p>
          </div>
          <div className="space-y-3">
            {CONNECTIONS.map(conn => {
              const health = BANK_HEALTH_SCORES[conn.name];
              return (
              <div key={conn.id} className="nexus-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{conn.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{conn.display}</p>
                      <p className="text-[10px] text-muted-foreground">{conn.tables} tabelas · {conn.rows > 0 ? `${(conn.rows / 1000).toFixed(0)}K rows` : 'hibernado'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold font-mono ${health?.score >= 80 ? 'text-emerald-400' : health?.score >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {health?.score ?? 0}/100
                    </span>
                    <StatusBadge status={statusColors[conn.status]} />
                  </div>
                </div>
                {health && health.score > 0 && (
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                    <div className="rounded bg-muted/20 p-1.5"><span className="font-mono text-foreground">{health.completude}%</span><br/>Completude</div>
                    <div className="rounded bg-muted/20 p-1.5"><span className={`font-mono ${health.freshness < 70 ? 'text-amber-400' : 'text-foreground'}`}>{health.freshness}%</span><br/>Freshness</div>
                    <div className="rounded bg-muted/20 p-1.5"><span className="font-mono text-foreground">{health.integridade}%</span><br/>Integridade</div>
                    <div className="rounded bg-muted/20 p-1.5"><span className={`font-mono ${health.crossLink < 50 ? 'text-rose-400' : 'text-foreground'}`}>{health.crossLink}%</span><br/>Cross-link</div>
                  </div>
                )}
              </div>
              );
            })}
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
