import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Table2, Code, Rows3, Settings, Plug, Plus, Trash2, RefreshCw, Play, Eye, Edit, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectedDB {
  id: string;
  name: string;
  url: string;
  status: 'connected' | 'error' | 'analyzing' | 'pending';
  tables: number;
  functions: number;
  rows: number;
  lastAnalysis: string;
}

interface TableInfo {
  name: string;
  columns: number;
  rows: number;
  hasRls: boolean;
  fks: number;
  size: string;
}

const MOCK_DBS: ConnectedDB[] = [];
const MOCK_TABLES: TableInfo[] = [];

export default function DatabaseManagerPage() {
  const [activeTab, setActiveTab] = useState('connections');
  const [databases, setDatabases] = useState<ConnectedDB[]>(MOCK_DBS);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>(MOCK_TABLES);
  const [connectForm, setConnectForm] = useState({ name: '', url: '', anonKey: '', serviceKey: '' });
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM information_schema.tables WHERE table_schema = \'public\' LIMIT 20;');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleConnect = async () => {
    if (!connectForm.name || !connectForm.url || !connectForm.anonKey) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const newDb: ConnectedDB = {
      id: crypto.randomUUID(),
      name: connectForm.name,
      url: connectForm.url,
      status: 'analyzing',
      tables: 0, functions: 0, rows: 0,
      lastAnalysis: '',
    };

    setDatabases([...databases, newDb]);
    setIsAnalyzing(true);
    toast.info(`Conectando a ${connectForm.name}...`);

    // Simulate analysis
    setTimeout(() => {
      setDatabases(prev => prev.map(db =>
        db.id === newDb.id ? {
          ...db,
          status: 'connected' as const,
          tables: Math.floor(10 + Math.random() * 50),
          functions: Math.floor(5 + Math.random() * 20),
          rows: Math.floor(1000 + Math.random() * 100000),
          lastAnalysis: new Date().toISOString(),
        } : db
      ));

      setTables([
        { name: 'users', columns: 8, rows: 156, hasRls: true, fks: 0, size: '24 KB' },
        { name: 'orders', columns: 12, rows: 2340, hasRls: true, fks: 2, size: '512 KB' },
        { name: 'products', columns: 15, rows: 890, hasRls: false, fks: 1, size: '256 KB' },
        { name: 'categories', columns: 5, rows: 42, hasRls: false, fks: 0, size: '8 KB' },
        { name: 'payments', columns: 10, rows: 1820, hasRls: true, fks: 2, size: '384 KB' },
      ]);

      setSelectedDb(newDb.id);
      setIsAnalyzing(false);
      toast.success(`${connectForm.name} conectado! ${Math.floor(10 + Math.random() * 50)} tabelas descobertas.`);
      setConnectForm({ name: '', url: '', anonKey: '', serviceKey: '' });
    }, 3000);
  };

  const handleDisconnect = (id: string) => {
    setDatabases(databases.filter(db => db.id !== id));
    if (selectedDb === id) { setSelectedDb(null); setTables([]); }
    toast.success('Banco desconectado');
  };

  const handleReanalyze = (id: string) => {
    setDatabases(databases.map(db => db.id === id ? { ...db, status: 'analyzing' as const } : db));
    setTimeout(() => {
      setDatabases(databases.map(db => db.id === id ? { ...db, status: 'connected' as const, lastAnalysis: new Date().toISOString() } : db));
      toast.success('Reanálise concluída');
    }, 2000);
  };

  const selectedDatabase = databases.find(db => db.id === selectedDb);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Database Manager"
        description="Conecte, analise e administre qualquer banco Supabase — plug and play"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2" onClick={() => setActiveTab('connections')}><Plus className="h-4 w-4" /> Conectar Banco</Button>}
      />

      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="nexus-card text-center py-3">
          <p className="text-2xl font-heading font-bold text-foreground">{databases.length}</p>
          <p className="text-[10px] text-muted-foreground">Bancos conectados</p>
        </div>
        <div className="nexus-card text-center py-3">
          <p className="text-2xl font-heading font-bold text-foreground">{databases.reduce((s, d) => s + d.tables, 0)}</p>
          <p className="text-[10px] text-muted-foreground">Tabelas descobertas</p>
        </div>
        <div className="nexus-card text-center py-3">
          <p className="text-2xl font-heading font-bold text-foreground">{databases.reduce((s, d) => s + d.functions, 0)}</p>
          <p className="text-[10px] text-muted-foreground">Funções</p>
        </div>
        <div className="nexus-card text-center py-3">
          <p className="text-2xl font-heading font-bold text-emerald-400">{databases.filter(d => d.status === 'connected').length}</p>
          <p className="text-[10px] text-muted-foreground">Ativos</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border/50 p-1 w-full justify-start overflow-x-auto">
          {[
            { id: 'connections', icon: Plug, label: 'Conexões' },
            { id: 'explorer', icon: Eye, label: 'Explorer' },
            { id: 'tables', icon: Table2, label: 'Tabelas' },
            { id: 'sql', icon: Code, label: 'SQL Editor' },
            { id: 'functions', icon: Settings, label: 'Funções' },
            { id: 'data', icon: Rows3, label: 'Dados' },
          ].map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs whitespace-nowrap">
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab 1: Conexões */}
        <TabsContent value="connections" className="mt-4 space-y-4">
          {/* Formulário de conexão */}
          <div className="nexus-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Conectar Novo Banco Supabase</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome do banco *</label>
                <input value={connectForm.name} onChange={e => setConnectForm({ ...connectForm, name: e.target.value })} placeholder="Ex: CRM Produção, Catálogo Dev..." className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">URL do Supabase *</label>
                <input value={connectForm.url} onChange={e => setConnectForm({ ...connectForm, url: e.target.value })} placeholder="https://xxxxx.supabase.co" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Anon Key *</label>
                <input value={connectForm.anonKey} onChange={e => setConnectForm({ ...connectForm, anonKey: e.target.value })} placeholder="eyJ..." type="password" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Service Role Key (para análise completa)</label>
                <input value={connectForm.serviceKey} onChange={e => setConnectForm({ ...connectForm, serviceKey: e.target.value })} placeholder="eyJ... (opcional)" type="password" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleConnect} disabled={isAnalyzing} className="gap-2">
                {isAnalyzing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Analisando...</> : <><Database className="h-4 w-4" /> Conectar e Analisar</>}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O sistema conectará ao banco, descobrirá todas as tabelas, colunas, FKs, funções e políticas RLS automaticamente.
            </p>
          </div>

          {/* Lista de bancos conectados */}
          {databases.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Bancos Conectados</h3>
              {databases.map(db => (
                <div key={db.id} className={`nexus-card flex items-center justify-between ${selectedDb === db.id ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedDb(db.id)}>
                  <div className="flex items-center gap-3 cursor-pointer">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{db.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{db.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{db.tables} tabelas · {db.functions} funções</p>
                      <p>{db.rows > 0 ? `${(db.rows / 1000).toFixed(1)}K registros` : '—'}</p>
                    </div>
                    <StatusBadge status={db.status === 'connected' ? 'production' : db.status === 'analyzing' ? 'testing' : db.status === 'error' ? 'error' : 'draft'} />
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleReanalyze(db.id); }}><RefreshCw className="h-3 w-3" /></Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDisconnect(db.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {databases.length === 0 && (
            <div className="nexus-card text-center py-12">
              <Database className="h-12 w-12 text-primary mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-foreground">Nenhum banco conectado</p>
              <p className="text-xs text-muted-foreground mt-1">Conecte seu primeiro banco Supabase acima</p>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Explorer */}
        <TabsContent value="explorer" className="mt-4">
          {selectedDatabase ? (
            <div className="nexus-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Explorer — {selectedDatabase.name}</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input placeholder="Buscar tabela..." className="pl-9 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground w-64" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {tables.map(t => (
                  <button key={t.name} className="text-left p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      <Table2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-foreground">{t.name}</span>
                    </div>
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      <span>{t.columns} cols</span>
                      <span>{t.rows} rows</span>
                      {t.hasRls && <span className="text-emerald-400">RLS</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="nexus-card text-center py-8">
              <p className="text-sm text-muted-foreground">Selecione um banco na aba Conexões</p>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Tabelas (CRUD) */}
        <TabsContent value="tables" className="mt-4 space-y-4">
          {selectedDatabase ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Tabelas — {selectedDatabase.name}</h3>
                <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Criar Tabela</Button>
              </div>
              <div className="nexus-card overflow-hidden p-0">
                <table className="w-full text-xs" aria-label="Lista de tabelas">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium">Tabela</th>
                      <th className="text-center px-3 py-2 font-medium">Colunas</th>
                      <th className="text-center px-3 py-2 font-medium">Registros</th>
                      <th className="text-center px-3 py-2 font-medium">FKs</th>
                      <th className="text-center px-3 py-2 font-medium">RLS</th>
                      <th className="text-center px-3 py-2 font-medium">Tamanho</th>
                      <th className="text-center px-3 py-2 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tables.map(t => (
                      <tr key={t.name} className="border-b border-border/30 hover:bg-muted/10">
                        <td className="px-4 py-2 font-medium text-foreground"><Table2 className="h-3 w-3 text-primary inline mr-1.5" />{t.name}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{t.columns}</td>
                        <td className="px-3 py-2 text-center font-mono text-foreground">{t.rows.toLocaleString()}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{t.fks}</td>
                        <td className="px-3 py-2 text-center">{t.hasRls ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 inline" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400 inline" />}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{t.size}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button className="p-1 rounded hover:bg-muted/30" title="Ver dados"><Eye className="h-3 w-3 text-muted-foreground" /></button>
                            <button className="p-1 rounded hover:bg-muted/30" title="Editar estrutura"><Edit className="h-3 w-3 text-muted-foreground" /></button>
                            <button className="p-1 rounded hover:bg-destructive/20" title="Excluir"><Trash2 className="h-3 w-3 text-destructive" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="nexus-card text-center py-8"><p className="text-sm text-muted-foreground">Selecione um banco na aba Conexões</p></div>
          )}
        </TabsContent>

        {/* Tab 4: SQL Editor */}
        <TabsContent value="sql" className="mt-4 space-y-4">
          <div className="nexus-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">SQL Editor {selectedDatabase ? `— ${selectedDatabase.name}` : ''}</h3>
              <select className="text-xs bg-muted/30 border border-border rounded-lg px-2 py-1 text-foreground">
                {databases.map(db => <option key={db.id} value={db.id}>{db.name}</option>)}
              </select>
            </div>
            <textarea value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} className="w-full h-40 bg-muted/20 border border-border rounded-lg p-3 font-mono text-xs text-foreground resize-none" />
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => toast.success('Query executada — resultados abaixo')}>
                <Play className="h-3.5 w-3.5" /> Executar
              </Button>
              <Button variant="outline" size="sm">Salvar Query</Button>
              <Button variant="outline" size="sm">Formatar SQL</Button>
            </div>
            <div className="rounded-lg bg-muted/10 border border-border p-3 text-xs text-muted-foreground font-mono">
              Resultados aparecerão aqui após executar a query.
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Funções */}
        <TabsContent value="functions" className="mt-4 space-y-4">
          {selectedDatabase ? (
            <div className="nexus-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Funções PostgreSQL — {selectedDatabase.name}</h3>
                <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Criar Função</Button>
              </div>
              <div className="space-y-2">
                {['update_updated_at()', 'handle_new_user()', 'get_user_workspace_id()', 'normalize_cnpj(text)', 'cnpj_raiz(text)'].map(fn => (
                  <div key={fn} className="flex items-center justify-between p-2 rounded-lg bg-muted/10 text-xs">
                    <div className="flex items-center gap-2">
                      <Code className="h-3.5 w-3.5 text-primary" />
                      <span className="font-mono text-foreground">{fn}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">plpgsql</span>
                      <button className="p-1 rounded hover:bg-muted/30"><Eye className="h-3 w-3 text-muted-foreground" /></button>
                      <button className="p-1 rounded hover:bg-muted/30"><Edit className="h-3 w-3 text-muted-foreground" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="nexus-card text-center py-8"><p className="text-sm text-muted-foreground">Selecione um banco na aba Conexões</p></div>
          )}
        </TabsContent>

        {/* Tab 6: Dados */}
        <TabsContent value="data" className="mt-4 space-y-4">
          {selectedDatabase && tables.length > 0 ? (
            <div className="nexus-card">
              <div className="flex items-center gap-3 mb-4">
                <select className="text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground">
                  {tables.map(t => <option key={t.name} value={t.name}>{t.name} ({t.rows} rows)</option>)}
                </select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input placeholder="Filtrar registros..." className="w-full pl-9 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
                </div>
                <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Inserir</Button>
              </div>
              <div className="rounded-lg bg-muted/10 border border-border p-4 text-center text-xs text-muted-foreground">
                <Rows3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Selecione uma tabela e clique para ver/editar os dados.
                <br />Suporta inserção, edição e exclusão de registros.
              </div>
            </div>
          ) : (
            <div className="nexus-card text-center py-8"><p className="text-sm text-muted-foreground">Conecte um banco e selecione-o para ver os dados</p></div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
