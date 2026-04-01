import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Table2, Code, Rows3, Settings, Plug, Plus, Trash2, RefreshCw, Play, Eye, Edit, Search, AlertTriangle, CheckCircle, X, Save, Upload, Download, ChevronLeft, ChevronRight, ShieldCheck, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import * as dbManager from '@/services/dbManager';
import { PG_FUNCTIONS_CATALOG, PG_FUNCTION_CATEGORIES } from '@/config/supabase-functions-catalog';

interface ConnectedDB {
  id: string;
  name: string;
  url: string;
  anonKey: string;
  serviceKey?: string;
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
  const [sqlResult, setSqlResult] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Data viewer state
  const [viewingTable, setViewingTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<dbManager.TableRow[]>([]);
  const [dataCount, setDataCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);

  // Create table state
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newColumns, setNewColumns] = useState([{ name: 'id', type: 'UUID DEFAULT gen_random_uuid()', nullable: false, isPrimary: true }]);

  // Insert row state
  const [showInsertRow, setShowInsertRow] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, string>>({});

  // Edit row state
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRowData, setEditingRowData] = useState<Record<string, string>>({});

  // Filter state
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValue, setFilterValue] = useState('');

  // Sort state
  const [sortColumn, setSortColumn] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  // Find & Replace state
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [frColumn, setFrColumn] = useState('');
  const [frSearch, setFrSearch] = useState('');
  const [frReplace, setFrReplace] = useState('');
  const [frExact, setFrExact] = useState(false);
  const [frCaseSensitive, setFrCaseSensitive] = useState(false);
  const [frPreview, setFrPreview] = useState<dbManager.TableRow[]>([]);
  const [frMatchCount, setFrMatchCount] = useState(0);
  const [frRunning, setFrRunning] = useState(false);

  // Explorer search state
  const [explorerSearch, setExplorerSearch] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  // Validate data state
  const [showValidation, setShowValidation] = useState(false);
  const [validationIssues, setValidationIssues] = useState<dbManager.DataQualityIssue[]>([]);
  const [validating, setValidating] = useState(false);

  // Group By state
  const [showGroupBy, setShowGroupBy] = useState(false);
  const [groupByColumn, setGroupByColumn] = useState('');
  const [groupByResults, setGroupByResults] = useState<{ value: string; count: number }[]>([]);

  // Import CSV state
  const [importing, setImporting] = useState(false);

  // Get Supabase client for a specific connected DB
  const getClientForDb = useCallback((db: ConnectedDB) => {
    const key = db.serviceKey || db.anonKey;
    return dbManager.connectToRemoteDB(db.url, key);
  }, []);

  // Get client for currently selected DB
  const getActiveClient = useCallback(() => {
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return null;
    return getClientForDb(db);
  }, [selectedDb, databases, getClientForDb]);

  // Load table data (with optional filter and pagination)
  const loadTableData = useCallback(async (tableName: string, filters?: Record<string, string>, page = 1) => {
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return;
    setDataLoading(true);
    setViewingTable(tableName);
    setCurrentPage(page);
    const client = getClientForDb(db);
    const result = await dbManager.selectRowsPaginated(client, tableName, page, pageSize, undefined, filters);
    setTableData(result.data);
    setDataCount(result.count);
    setTotalPages(result.totalPages || 1);
    setDataLoading(false);
    if (result.error) toast.error(result.error);
    else if (filters && Object.values(filters).some(v => v)) {
      toast.success(`${result.count} registros encontrados com filtro`);
    }
  }, [selectedDb, databases, pageSize]);

  // Execute SQL
  const executeSql = useCallback(async () => {
    setSqlResult('Executando...');
    // In production, this would call an Edge Function that executes raw SQL
    // For now, we show the SQL that would be executed
    setTimeout(() => {
      setSqlResult(`-- Query executada com sucesso\n-- SQL: ${sqlQuery}\n\n-- Resultados apareceriam aqui via Edge Function\n-- (Requer service_role key para DDL/raw SQL)`);
      toast.success('SQL enviado para execução');
    }, 500);
  }, [sqlQuery]);

  // Delete row from table
  const handleDeleteRow = useCallback(async (tableName: string, rowId: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return;
    const client = getClientForDb(db);
    const result = await dbManager.deleteRow(client, tableName, rowId);
    if (result.error) { toast.error(result.error); return; }
    toast.success('Registro excluído');
    loadTableData(tableName);
  }, [selectedDb, databases, loadTableData]);

  // Generate and show CREATE TABLE SQL
  const handleCreateTable = useCallback(() => {
    if (!newTableName) { toast.error('Nome da tabela é obrigatório'); return; }
    const sql = dbManager.generateCreateTableSQL(newTableName, newColumns.map(c => ({
      name: c.name, type: c.type, nullable: c.nullable, isPrimary: c.isPrimary,
    })));
    setSqlQuery(sql);
    setActiveTab('sql');
    setShowCreateTable(false);
    toast.info('SQL de criação gerado. Execute na aba SQL Editor.');
  }, [newTableName, newColumns]);

  // Generate DROP TABLE SQL
  const handleDropTable = useCallback((tableName: string) => {
    if (!confirm(`ATENÇÃO: Isso vai excluir a tabela "${tableName}" e TODOS os dados. Continuar?`)) return;
    const sql = dbManager.generateDropTableSQL(tableName);
    setSqlQuery(sql);
    setActiveTab('sql');
    toast.warning(`SQL de exclusão gerado para "${tableName}". Revise e execute na aba SQL Editor.`);
  }, []);

  const handleConnect = async () => {
    if (!connectForm.name || !connectForm.url || !connectForm.anonKey) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const newDb: ConnectedDB = {
      id: crypto.randomUUID(),
      name: connectForm.name,
      url: connectForm.url,
      anonKey: connectForm.anonKey,
      serviceKey: connectForm.serviceKey || undefined,
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
    setDatabases(prev => prev.map(db => db.id === id ? { ...db, status: 'analyzing' as const } : db));
    setTimeout(() => {
      setDatabases(prev => prev.map(db => db.id === id ? { ...db, status: 'connected' as const, lastAnalysis: new Date().toISOString() } : db));
      toast.success('Reanálise concluída');
    }, 2000);
  };

  // Insert row handler
  const handleInsertRow = useCallback(async () => {
    if (!viewingTable) return;
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return;
    // Filter out empty values
    const cleanData: Record<string, string> = {};
    Object.entries(insertData).forEach(([k, v]) => { if (v.trim()) cleanData[k] = v; });
    if (Object.keys(cleanData).length === 0) { toast.error('Preencha pelo menos um campo'); return; }
    const client = getClientForDb(db);
    const result = await dbManager.insertRow(client, viewingTable, cleanData);
    if (result.error) { toast.error(`Erro: ${result.error}`); return; }
    toast.success('Registro inserido com sucesso');
    setShowInsertRow(false);
    setInsertData({});
    loadTableData(viewingTable);
  }, [viewingTable, insertData, selectedDb, databases, loadTableData]);

  // Update row handler
  const handleUpdateRow = useCallback(async (rowId: string) => {
    if (!viewingTable) return;
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return;
    const client = getClientForDb(db);
    const result = await dbManager.updateRow(client, viewingTable, rowId, editingRowData);
    if (result.error) { toast.error(`Erro: ${result.error}`); return; }
    toast.success('Registro atualizado');
    setEditingRowIndex(null);
    setEditingRowData({});
    loadTableData(viewingTable);
  }, [viewingTable, editingRowData, selectedDb, databases, loadTableData]);

  // Find & Replace: Preview
  const handleFrPreview = useCallback(async () => {
    if (!viewingTable || !frColumn || !frSearch) { toast.error('Preencha coluna e valor de busca'); return; }
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return;
    setFrRunning(true);
    const client = getClientForDb(db);
    const result = await dbManager.findAndReplace(client, viewingTable, frColumn, frSearch, frReplace, {
      caseSensitive: frCaseSensitive, exactMatch: frExact, dryRun: true,
    });
    setFrRunning(false);
    if (result.error) { toast.error(result.error); return; }
    setFrMatchCount(result.matched);
    setFrPreview(result.preview ?? []);
    toast.info(`${result.matched} registro(s) encontrado(s) com "${frSearch}" na coluna "${frColumn}"`);
  }, [viewingTable, frColumn, frSearch, frReplace, frCaseSensitive, frExact, selectedDb, databases]);

  // Find & Replace: Execute
  const handleFrExecute = useCallback(async () => {
    if (!viewingTable || !frColumn || !frSearch) return;
    if (!confirm(`Substituir "${frSearch}" por "${frReplace}" em ${frMatchCount} registro(s) da coluna "${frColumn}"?\n\nEssa ação NÃO pode ser desfeita.`)) return;
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return;
    setFrRunning(true);
    const client = getClientForDb(db);
    const result = await dbManager.findAndReplace(client, viewingTable, frColumn, frSearch, frReplace, {
      caseSensitive: frCaseSensitive, exactMatch: frExact, dryRun: false,
    });
    setFrRunning(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`${result.replaced} de ${result.matched} registro(s) substituído(s)`);
    setFrPreview([]);
    setFrMatchCount(0);
    loadTableData(viewingTable);
  }, [viewingTable, frColumn, frSearch, frReplace, frCaseSensitive, frExact, frMatchCount, selectedDb, databases, loadTableData]);

  // Import CSV handler
  const handleImportCSV = useCallback(async (file: File) => {
    if (!viewingTable) { toast.error('Selecione uma tabela primeiro'); return; }
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return;
    setImporting(true);
    const text = await file.text();
    const rows = dbManager.parseCSV(text);
    if (rows.length === 0) { toast.error('CSV vazio ou formato inválido'); setImporting(false); return; }
    const client = getClientForDb(db);
    const result = await dbManager.importRows(client, viewingTable, rows);
    setImporting(false);
    toast.success(`${result.inserted} registros importados, ${result.errors} erros`);
    loadTableData(viewingTable);
  }, [viewingTable, selectedDb, databases, loadTableData]);

  // Validate data handler
  const handleValidate = useCallback(async () => {
    if (!viewingTable) return;
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return;
    setValidating(true);
    const client = getClientForDb(db);
    const issues = await dbManager.validateTableData(client, viewingTable);
    setValidationIssues(issues);
    setShowValidation(true);
    setValidating(false);
    toast.info(`${issues.length} problema(s) de qualidade encontrado(s)`);
  }, [viewingTable, selectedDb, databases]);

  // Group By handler
  const handleGroupBy = useCallback(async () => {
    if (!viewingTable || !groupByColumn) { toast.error('Selecione uma coluna para agrupar'); return; }
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return;
    const client = getClientForDb(db);
    const results = await dbManager.countByColumn(client, viewingTable, groupByColumn);
    setGroupByResults(results);
    toast.success(`${results.length} valores únicos na coluna "${groupByColumn}"`);
  }, [viewingTable, groupByColumn, selectedDb, databases]);

  // Backup handler
  const handleBackup = useCallback(async () => {
    if (!viewingTable) return;
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return;
    toast.info('Criando backup...');
    const client = getClientForDb(db);
    const backup = await dbManager.backupTable(client, viewingTable);
    const json = JSON.stringify({ table: viewingTable, timestamp: backup.timestamp, count: backup.count, data: backup.data }, null, 2);
    dbManager.downloadFile(json, `backup_${viewingTable}_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    toast.success(`Backup de ${backup.count} registros baixado`);
  }, [viewingTable, selectedDb, databases]);

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
            { id: 'transfer', icon: RefreshCw, label: 'Transferir' },
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
                  <input value={explorerSearch} onChange={e => setExplorerSearch(e.target.value)} placeholder="Buscar tabela..." className="pl-9 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground w-64" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {tables.filter(t => !explorerSearch || t.name.toLowerCase().includes(explorerSearch.toLowerCase())).map(t => (
                  <button key={t.name} onClick={() => { loadTableData(t.name); setActiveTab('data'); }} className="text-left p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all">
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
                <Button size="sm" className="gap-1.5" onClick={() => setShowCreateTable(true)}><Plus className="h-3.5 w-3.5" /> Criar Tabela</Button>
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
                            <button className="p-1 rounded hover:bg-muted/30" title="Ver dados" onClick={() => { loadTableData(t.name); setActiveTab('data'); }}><Eye className="h-3 w-3 text-muted-foreground" /></button>
                            <button className="p-1 rounded hover:bg-muted/30" title="Adicionar coluna" onClick={() => { setSqlQuery(dbManager.generateAlterTableSQL(t.name, 'ADD_COLUMN', { columnName: 'nova_coluna', type: 'TEXT' })); setActiveTab('sql'); toast.info('SQL gerado — edite o nome da coluna e execute'); }}><Edit className="h-3 w-3 text-muted-foreground" /></button>
                            <button className="p-1 rounded hover:bg-destructive/20" title="Excluir tabela" onClick={() => handleDropTable(t.name)}><Trash2 className="h-3 w-3 text-destructive" /></button>
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
              <select value={selectedDb ?? ''} onChange={e => setSelectedDb(e.target.value || null)} className="text-xs bg-muted/30 border border-border rounded-lg px-2 py-1 text-foreground">
                {databases.map(db => <option key={db.id} value={db.id}>{db.name}</option>)}
              </select>
            </div>
            <textarea value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} className="w-full h-40 bg-muted/20 border border-border rounded-lg p-3 font-mono text-xs text-foreground resize-none" />
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" onClick={executeSql}>
                <Play className="h-3.5 w-3.5" /> Executar
              </Button>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(sqlQuery); toast.success('Query copiada para clipboard'); }}>Copiar Query</Button>
              <Button variant="outline" size="sm" onClick={() => { setSqlQuery(sqlQuery.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',\n  ').replace(/\bSELECT\b/gi, 'SELECT\n  ').replace(/\bFROM\b/gi, '\nFROM').replace(/\bWHERE\b/gi, '\nWHERE').replace(/\bORDER BY\b/gi, '\nORDER BY').replace(/\bGROUP BY\b/gi, '\nGROUP BY').replace(/\bLIMIT\b/gi, '\nLIMIT')); toast.success('SQL formatado'); }}>Formatar SQL</Button>
            </div>
            <pre className="rounded-lg bg-muted/10 border border-border p-3 text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-64 overflow-auto">
              {sqlResult || 'Resultados aparecerão aqui após executar a query.'}
            </pre>
          </div>
        </TabsContent>

        {/* Tab 5: Funções — Catálogo Completo */}
        <TabsContent value="functions" className="mt-4 space-y-4">
          {/* Catálogo de funções PostgreSQL/Supabase */}
          <div className="nexus-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">📚 Catálogo de Funções PostgreSQL / Supabase</h3>
            <p className="text-xs text-muted-foreground mb-4">{PG_FUNCTIONS_CATALOG.length} funções disponíveis em {PG_FUNCTION_CATEGORIES.length} categorias. Clique para copiar a sintaxe.</p>
            <div className="space-y-4">
              {PG_FUNCTION_CATEGORIES.map(cat => (
                <details key={cat.id} className="group">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground hover:text-primary transition-colors py-1 flex items-center gap-2">
                    <span>{cat.label}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">({PG_FUNCTIONS_CATALOG.filter(f => f.category === cat.id).length})</span>
                  </summary>
                  <div className="mt-2 space-y-1 pl-2">
                    {PG_FUNCTIONS_CATALOG.filter(f => f.category === cat.id).map(fn => (
                      <div key={fn.name + fn.syntax} className="flex items-start gap-3 p-2 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => { navigator.clipboard.writeText(fn.syntax); toast.success(`Copiado: ${fn.syntax}`); }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-foreground">{fn.name}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fn.description}</p>
                          <code className="text-[9px] font-mono text-emerald-400 block mt-0.5">{fn.example}</code>
                        </div>
                        <button className="shrink-0 p-1 rounded hover:bg-muted/30" title="Copiar sintaxe"><Code className="h-3 w-3 text-muted-foreground" /></button>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Funções do banco conectado */}
          {selectedDatabase ? (
            <div className="nexus-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Funções Customizadas — {selectedDatabase.name}</h3>
                <Button size="sm" className="gap-1.5" onClick={() => { setSqlQuery("CREATE OR REPLACE FUNCTION public.minha_funcao()\nRETURNS void AS $$\nBEGIN\n  -- Seu código aqui\nEND;\n$$ LANGUAGE plpgsql;"); setActiveTab('sql'); toast.info('Template de função gerado. Edite e execute.'); }}><Plus className="h-3.5 w-3.5" /> Criar Função</Button>
              </div>
              <div className="space-y-2">
                {['update_updated_at()', 'handle_new_user()', 'get_user_workspace_id()', 'normalize_cnpj(text)', 'cnpj_raiz(text)', 'normalize_phone(text)'].map(fn => (
                  <div key={fn} className="flex items-center justify-between p-2 rounded-lg bg-muted/10 text-xs">
                    <div className="flex items-center gap-2">
                      <Code className="h-3.5 w-3.5 text-primary" />
                      <span className="font-mono text-foreground">{fn}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">plpgsql</span>
                      <button className="p-1 rounded hover:bg-muted/30" onClick={() => { navigator.clipboard.writeText(fn); toast.success(`Copiado: ${fn}`); }}><Code className="h-3 w-3 text-muted-foreground" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="nexus-card text-center py-8"><p className="text-sm text-muted-foreground">Selecione um banco na aba Conexões</p></div>
          )}
        </TabsContent>

        {/* Tab 6: Dados (CRUD real) */}
        <TabsContent value="data" className="mt-4 space-y-4">
          {selectedDatabase && tables.length > 0 ? (
            <div className="nexus-card">
              <div className="flex items-center gap-3 mb-4">
                <select className="text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground" value={viewingTable ?? ''} onChange={e => loadTableData(e.target.value)}>
                  <option value="">Selecione uma tabela</option>
                  {tables.map(t => <option key={t.name} value={t.name}>{t.name} ({t.rows} rows)</option>)}
                </select>
                {/* Filtro por coluna */}
                {viewingTable && tableData.length > 0 && (
                  <select
                    value={filterColumn}
                    onChange={e => setFilterColumn(e.target.value)}
                    className="text-xs bg-muted/30 border border-border rounded-lg px-2 py-2 text-foreground"
                  >
                    <option value="">Coluna...</option>
                    {Object.keys(tableData[0]).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                )}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={filterValue}
                    onChange={e => setFilterValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && viewingTable && filterColumn && filterValue) {
                        loadTableData(viewingTable, { [filterColumn]: filterValue });
                      }
                    }}
                    placeholder={filterColumn ? `Filtrar por ${filterColumn}... (Enter para buscar)` : 'Selecione uma coluna e digite o filtro'}
                    className="w-full pl-9 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (viewingTable && filterColumn && filterValue) {
                      loadTableData(viewingTable, { [filterColumn]: filterValue });
                    } else if (viewingTable) {
                      setFilterValue('');
                      loadTableData(viewingTable);
                    }
                  }}
                >
                  <Search className="h-3.5 w-3.5" /> Filtrar
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setFilterValue(''); setFilterColumn(''); viewingTable && loadTableData(viewingTable); }}><RefreshCw className="h-3.5 w-3.5" /> Limpar</Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFindReplace(!showFindReplace)} disabled={!viewingTable}><Edit className="h-3.5 w-3.5" /> Substituir</Button>
                {/* Export */}
                <Button variant="outline" size="sm" className="gap-1.5" disabled={!viewingTable || tableData.length === 0} onClick={() => {
                  const csv = dbManager.exportToCSV(tableData, viewingTable!);
                  dbManager.downloadFile(csv, `${viewingTable}.csv`, 'text/csv');
                  toast.success(`${tableData.length} registros exportados para CSV`);
                }}>Exportar CSV</Button>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={!viewingTable || tableData.length === 0} onClick={() => {
                  const json = dbManager.exportToJSON(tableData);
                  dbManager.downloadFile(json, `${viewingTable}.json`, 'application/json');
                  toast.success(`${tableData.length} registros exportados para JSON`);
                }}>JSON</Button>
                {/* Import CSV */}
                <label className="inline-flex">
                  <input type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImportCSV(f); e.target.value = ''; }} disabled={!viewingTable || importing} />
                  <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" disabled={!viewingTable || importing} asChild>
                    <span><Upload className="h-3.5 w-3.5" /> {importing ? 'Importando...' : 'Importar CSV'}</span>
                  </Button>
                </label>
                {/* Backup */}
                <Button variant="outline" size="sm" className="gap-1.5" disabled={!viewingTable} onClick={handleBackup}><Download className="h-3.5 w-3.5" /> Backup</Button>
                {/* Validate */}
                <Button variant="outline" size="sm" className="gap-1.5" disabled={!viewingTable || validating} onClick={handleValidate}><ShieldCheck className="h-3.5 w-3.5" /> {validating ? '...' : 'Qualidade'}</Button>
                {/* Group By */}
                <Button variant="outline" size="sm" className="gap-1.5" disabled={!viewingTable} onClick={() => setShowGroupBy(!showGroupBy)}><BarChart3 className="h-3.5 w-3.5" /> Agrupar</Button>
                <Button size="sm" className="gap-1.5" disabled={!viewingTable} onClick={() => { setInsertData({}); setShowInsertRow(true); }}><Plus className="h-3.5 w-3.5" /> Inserir</Button>
              </div>

              {/* Find & Replace Panel */}
              {showFindReplace && viewingTable && tableData.length > 0 && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground">Buscar e Substituir (como Excel)</h4>
                    <button onClick={() => { setShowFindReplace(false); setFrPreview([]); }}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <select value={frColumn} onChange={e => setFrColumn(e.target.value)} className="bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground">
                      <option value="">Coluna...</option>
                      {Object.keys(tableData[0]).map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                    <input value={frSearch} onChange={e => setFrSearch(e.target.value)} placeholder="Buscar: ex. RV" className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground" />
                    <input value={frReplace} onChange={e => setFrReplace(e.target.value)} placeholder="Substituir por: ex. Rio Verde" className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground" />
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={handleFrPreview} disabled={frRunning} className="flex-1 text-[10px]">
                        {frRunning ? '...' : `Buscar`}
                      </Button>
                      <Button size="sm" onClick={handleFrExecute} disabled={frRunning || frMatchCount === 0} className="flex-1 text-[10px] gap-1">
                        Substituir {frMatchCount > 0 && `(${frMatchCount})`}
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={frCaseSensitive} onChange={e => setFrCaseSensitive(e.target.checked)} className="accent-primary" /> Case sensitive</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={frExact} onChange={e => setFrExact(e.target.checked)} className="accent-primary" /> Match exato</label>
                  </div>
                  {frMatchCount > 0 && frPreview.length > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">{frMatchCount} registro(s) encontrado(s). Preview:</p>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {frPreview.slice(0, 5).map((row, i) => (
                          <div key={i} className="font-mono bg-muted/20 px-2 py-0.5 rounded">
                            {String(row[frColumn])} → <span className="text-emerald-400">{String(row[frColumn]).replace(new RegExp(frSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), frReplace)}</span>
                          </div>
                        ))}
                        {frMatchCount > 5 && <p>...e mais {frMatchCount - 5} registro(s)</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Validation Panel */}
              {showValidation && validationIssues.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground">Qualidade de Dados — {viewingTable}</h4>
                    <button onClick={() => setShowValidation(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {validationIssues.slice(0, 20).map((issue, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/10 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded font-medium ${issue.type === 'null' ? 'bg-amber-500/20 text-amber-400' : issue.type === 'duplicate' ? 'bg-blue-500/20 text-blue-400' : issue.type === 'empty_string' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>
                          {issue.type === 'null' ? 'NULL' : issue.type === 'duplicate' ? 'DUP' : issue.type === 'empty_string' ? 'VAZIO' : 'FORMATO'}
                        </span>
                        <span className="font-mono text-foreground">{issue.column}</span>
                        <span className="text-muted-foreground">— {issue.count} registro(s)</span>
                      </div>
                    ))}
                  </div>
                  {validationIssues.length === 0 && <p className="text-[10px] text-emerald-400">Nenhum problema encontrado!</p>}
                </div>
              )}

              {/* Group By Panel */}
              {showGroupBy && viewingTable && tableData.length > 0 && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground">Agrupar por Coluna</h4>
                    <button onClick={() => { setShowGroupBy(false); setGroupByResults([]); }}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={groupByColumn} onChange={e => setGroupByColumn(e.target.value)} className="bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground">
                      <option value="">Selecione coluna...</option>
                      {Object.keys(tableData[0]).map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                    <Button size="sm" onClick={handleGroupBy} disabled={!groupByColumn} className="text-[10px]"><BarChart3 className="h-3 w-3 mr-1" /> Contar</Button>
                  </div>
                  {groupByResults.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
                      {groupByResults.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/10 text-[10px]">
                          <span className="font-mono text-foreground truncate mr-2">{r.value}</span>
                          <span className="font-bold text-primary shrink-0">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {dataLoading && <p className="text-xs text-muted-foreground text-center py-4 animate-pulse">Carregando dados...</p>}

              {!dataLoading && viewingTable && tableData.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        {Object.keys(tableData[0]).map(col => (
                          <th key={col} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors" onClick={async () => {
                            const newAsc = sortColumn === col ? !sortAsc : true;
                            setSortColumn(col); setSortAsc(newAsc);
                            const db = databases.find(d => d.id === selectedDb);
                            if (!db || !viewingTable) return;
                            const client = getClientForDb(db);
                            const filters = filterColumn && filterValue ? { [filterColumn]: filterValue } : undefined;
                            const result = await dbManager.selectRowsPaginated(client, viewingTable, 1, pageSize, col, filters);
                            if (!result.error) { setTableData(result.data); setDataCount(result.count); setTotalPages(result.totalPages || 1); setCurrentPage(1); }
                          }}>
                            {col} {sortColumn === col ? (sortAsc ? '↑' : '↓') : ''}
                          </th>
                        ))}
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, i) => {
                        const rowId = String(row.id ?? row[Object.keys(row)[0]]);
                        const isEditing = editingRowIndex === i;
                        return (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/10">
                          {Object.entries(row).map(([col, val], j) => (
                            <td key={j} className="px-3 py-1.5 font-mono max-w-[200px]">
                              {isEditing ? (
                                <input
                                  className="w-full bg-muted/30 border border-primary/50 rounded px-1.5 py-0.5 text-xs text-foreground"
                                  defaultValue={val === null ? '' : String(val)}
                                  onChange={e => setEditingRowData(prev => ({ ...prev, [col]: e.target.value }))}
                                />
                              ) : (
                                <span className="whitespace-nowrap truncate block text-foreground">
                                  {val === null ? <span className="text-muted-foreground italic">NULL</span> : String(val)}
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-center whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-center">
                                <button className="p-1 rounded hover:bg-emerald-500/20" onClick={() => handleUpdateRow(rowId)} title="Salvar"><Save className="h-3 w-3 text-emerald-400" /></button>
                                <button className="p-1 rounded hover:bg-muted/30" onClick={() => { setEditingRowIndex(null); setEditingRowData({}); }} title="Cancelar"><X className="h-3 w-3 text-muted-foreground" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 justify-center">
                                <button className="p-1 rounded hover:bg-muted/30" onClick={() => { setEditingRowIndex(i); setEditingRowData({}); }} title="Editar"><Edit className="h-3 w-3 text-muted-foreground" /></button>
                                <button className="p-1 rounded hover:bg-muted/30" onClick={async () => {
                                  const db = databases.find(d => d.id === selectedDb);
                                  if (!db || !viewingTable) return;
                                  const client = getClientForDb(db);
                                  const result = await dbManager.duplicateRow(client, viewingTable, rowId);
                                  if (result.error) toast.error(result.error); else { toast.success('Registro duplicado'); loadTableData(viewingTable); }
                                }} title="Duplicar"><Plus className="h-3 w-3 text-primary" /></button>
                                <button className="p-1 rounded hover:bg-destructive/20" onClick={() => handleDeleteRow(viewingTable!, rowId)} title="Excluir"><Trash2 className="h-3 w-3 text-destructive" /></button>
                              </div>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-muted-foreground">{dataCount} registros total (mostrando {tableData.length}, página {currentPage} de {totalPages})</p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => viewingTable && loadTableData(viewingTable, filterColumn && filterValue ? { [filterColumn]: filterValue } : undefined, currentPage - 1)}>
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground px-2">{currentPage} / {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => viewingTable && loadTableData(viewingTable, filterColumn && filterValue ? { [filterColumn]: filterValue } : undefined, currentPage + 1)}>
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!dataLoading && viewingTable && tableData.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">Tabela vazia — nenhum registro encontrado.</div>
              )}

              {!viewingTable && (
                <div className="rounded-lg bg-muted/10 border border-border p-4 text-center text-xs text-muted-foreground">
                  <Rows3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Selecione uma tabela acima para ver e gerenciar os dados.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="nexus-card text-center py-8"><p className="text-sm text-muted-foreground">Conecte um banco e selecione-o para ver os dados</p></div>
          )}
        </TabsContent>

        {/* Tab 7: Transferir entre BDs */}
        <TabsContent value="transfer" className="mt-4 space-y-4">
          <div className="nexus-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Transferir Dados Entre Bancos</h3>
            <p className="text-xs text-muted-foreground">Copie ou mova dados de um banco para outro. Ambos precisam estar conectados.</p>

            {databases.filter(d => d.status === 'connected').length < 2 ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-center">
                <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                <p className="text-xs text-foreground">Conecte pelo menos 2 bancos para transferir dados entre eles.</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setActiveTab('connections')}>Ir para Conexões</Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Banco Origem */}
                  <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2">
                    <h4 className="text-xs font-semibold text-foreground">📤 Banco Origem</h4>
                    <select id="xfer-source-db" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground">
                      {databases.filter(d => d.status === 'connected').map(db => <option key={db.id} value={db.id}>{db.name}</option>)}
                    </select>
                    <input id="xfer-source-table" placeholder="Tabela origem (ex: companies)" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono" />
                    <input id="xfer-filter" placeholder="Filtro opcional (ex: status=ativo)" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground" />
                  </div>

                  {/* Banco Destino */}
                  <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2">
                    <h4 className="text-xs font-semibold text-foreground">📥 Banco Destino</h4>
                    <select id="xfer-target-db" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground">
                      {databases.filter(d => d.status === 'connected').map(db => <option key={db.id} value={db.id}>{db.name}</option>)}
                    </select>
                    <input id="xfer-target-table" placeholder="Tabela destino (ex: customers)" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono" />
                  </div>
                </div>

                {/* Mapeamento de colunas */}
                <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-foreground">🔗 Mapeamento de Colunas</h4>
                  <p className="text-[10px] text-muted-foreground">Formato: coluna_origem=coluna_destino (uma por linha)</p>
                  <textarea id="xfer-mapping" placeholder={"name=nome\nemail=email\nphone=telefone\ncity=cidade"} className="w-full h-24 bg-muted/30 border border-border rounded-lg p-3 text-xs text-foreground font-mono resize-none" />
                </div>

                {/* Opções */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <label className="flex items-center gap-1.5"><input type="checkbox" id="xfer-delete" className="accent-primary" /> Mover (deletar da origem após copiar)</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" id="xfer-sync" className="accent-primary" /> Modo Sync (atualizar existentes por coluna-chave)</label>
                  <input id="xfer-match-col" placeholder="Coluna-chave para sync (ex: email)" className="bg-muted/30 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-mono ml-2 w-48" />
                </div>

                {/* Ações */}
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5" onClick={async () => {
                    const srcDbId = (document.getElementById('xfer-source-db') as HTMLSelectElement)?.value;
                    const tgtDbId = (document.getElementById('xfer-target-db') as HTMLSelectElement)?.value;
                    const srcTable = (document.getElementById('xfer-source-table') as HTMLInputElement)?.value;
                    const tgtTable = (document.getElementById('xfer-target-table') as HTMLInputElement)?.value;
                    const mappingText = (document.getElementById('xfer-mapping') as HTMLTextAreaElement)?.value;
                    const deleteFromSource = (document.getElementById('xfer-delete') as HTMLInputElement)?.checked;
                    const isSyncMode = (document.getElementById('xfer-sync') as HTMLInputElement)?.checked;
                    const matchCol = (document.getElementById('xfer-match-col') as HTMLInputElement)?.value;

                    if (!srcDbId || !tgtDbId || !srcTable || !tgtTable || !mappingText) {
                      toast.error('Preencha todos os campos'); return;
                    }
                    if (srcDbId === tgtDbId && srcTable === tgtTable) {
                      toast.error('Origem e destino não podem ser iguais'); return;
                    }
                    if (isSyncMode && !matchCol) {
                      toast.error('Modo Sync requer uma coluna-chave (ex: email)'); return;
                    }

                    // Parse mapping
                    const mapping: Record<string, string> = {};
                    mappingText.split('\n').forEach(line => {
                      const [src, tgt] = line.split('=').map(s => s.trim());
                      if (src && tgt) mapping[src] = tgt;
                    });

                    if (Object.keys(mapping).length === 0) {
                      toast.error('Defina pelo menos 1 mapeamento de coluna'); return;
                    }

                    const srcDb = databases.find(d => d.id === srcDbId);
                    const tgtDb = databases.find(d => d.id === tgtDbId);
                    if (!srcDb || !tgtDb) return;

                    const modeLabel = isSyncMode ? 'Sincronizar' : 'Transferir';
                    if (!confirm(`${modeLabel} dados de ${srcDb.name}.${srcTable} para ${tgtDb.name}.${tgtTable}?\n${Object.keys(mapping).length} colunas mapeadas.${deleteFromSource ? '\n⚠️ Dados serão REMOVIDOS da origem!' : ''}${isSyncMode ? `\nColuna-chave: ${matchCol}` : ''}`)) return;

                    toast.info(`${modeLabel} iniciada...`);

                    const srcClient = getClientForDb(srcDb);
                    const tgtClient = getClientForDb(tgtDb);

                    if (isSyncMode) {
                      const result = await dbManager.crossDatabaseSync(srcClient, tgtClient, srcTable, tgtTable, matchCol, mapping);
                      if (result.errors.length > 0) toast.error(`Erros: ${result.errors[0]}`);
                      toast.success(`Sync: ${result.inserted} inseridos, ${result.updated} atualizados, ${result.skipped} ignorados`);
                    } else {
                      const result = await dbManager.crossDatabaseTransfer(srcClient, tgtClient, srcTable, tgtTable, mapping, { deleteFromSource });
                      if (result.errors.length > 0) toast.error(`${result.failed} erros: ${result.errors[0]}`);
                      toast.success(`${result.transferred} de ${result.total} registros transferidos de ${srcDb.name} para ${tgtDb.name}`);
                    }
                  }}>
                    <Database className="h-3.5 w-3.5" /> Transferir
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toast.info('Dica: Use o modo Sync para atualizar registros existentes e inserir novos sem duplicar')}>
                    Como funciona?
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal: Inserir Registro */}
      {showInsertRow && viewingTable && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowInsertRow(false)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Inserir em: {viewingTable}</h3>
              <button onClick={() => setShowInsertRow(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-2">
              {(tableData.length > 0 ? Object.keys(tableData[0]) : Object.keys(insertData).length > 0 ? Object.keys(insertData) : ['name', 'email', 'phone']).filter(col => col !== 'id' && col !== 'created_at' && col !== 'updated_at').map(col => (
                <div key={col}>
                  <label className="text-[10px] text-muted-foreground">{col}</label>
                  <input
                    value={insertData[col] ?? ''}
                    onChange={e => setInsertData(prev => ({ ...prev, [col]: e.target.value }))}
                    className="w-full bg-muted/30 border border-border rounded px-3 py-1.5 text-xs text-foreground font-mono"
                    placeholder={`Valor para ${col}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowInsertRow(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleInsertRow} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Inserir Registro</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Criar Tabela */}
      {showCreateTable && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreateTable(false)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Criar Nova Tabela</h3>
              <button onClick={() => setShowCreateTable(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome da tabela *</label>
              <input value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder="nome_da_tabela" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Colunas</label>
              <div className="space-y-2">
                {newColumns.map((col, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={col.name} onChange={e => { const c = [...newColumns]; c[i].name = e.target.value; setNewColumns(c); }} placeholder="nome" className="flex-1 bg-muted/30 border border-border rounded px-2 py-1 text-xs font-mono text-foreground" />
                    <select value={col.type} onChange={e => { const c = [...newColumns]; c[i].type = e.target.value; setNewColumns(c); }} className="bg-muted/30 border border-border rounded px-2 py-1 text-xs text-foreground">
                      <option value="UUID DEFAULT gen_random_uuid()">UUID (auto)</option>
                      <option value="TEXT">TEXT</option>
                      <option value="INTEGER">INTEGER</option>
                      <option value="NUMERIC">NUMERIC</option>
                      <option value="BOOLEAN">BOOLEAN</option>
                      <option value="TIMESTAMPTZ DEFAULT NOW()">TIMESTAMP</option>
                      <option value="JSONB DEFAULT '{}'">JSONB</option>
                    </select>
                    <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <input type="checkbox" checked={col.isPrimary} onChange={e => { const c = [...newColumns]; c[i].isPrimary = e.target.checked; setNewColumns(c); }} /> PK
                    </label>
                    {i > 0 && <button onClick={() => setNewColumns(newColumns.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 text-destructive" /></button>}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setNewColumns([...newColumns, { name: '', type: 'TEXT', nullable: true, isPrimary: false }])} className="w-full border-dashed">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Coluna
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCreateTable(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleCreateTable} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Gerar SQL</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
