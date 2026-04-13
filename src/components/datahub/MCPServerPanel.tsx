import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Server, Copy, Play, Loader2 } from 'lucide-react';
import { invokeDatahubMCPTool } from '@/services/datahubService';
import { toast } from 'sonner';

const mcpTools = [
  { name: 'search_entities', desc: 'Busca entidades por nome, tipo ou filtro' },
  { name: 'get_entity_detail', desc: 'Detalhe completo de uma entidade' },
  { name: 'run_query', desc: 'Executa query SQL no DataHub' },
  { name: 'get_schema', desc: 'Schema de uma tabela' },
  { name: 'get_stats', desc: 'Estatisticas gerais do DataHub' },
  { name: 'cross_reference', desc: 'Referencia cruzada entre bancos' },
];

export function MCPServerPanel() {
  const [testing, setTesting] = useState(false);
  const [mcpResult, setMcpResult] = useState<Record<string, unknown> | null>(null);
  const [testTool, setTestTool] = useState('search_entities');
  const [testQuery, setTestQuery] = useState('');
  const mcpUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datahub-mcp-server`;

  const handleTest = async () => {
    setTesting(true);
    setMcpResult(null);
    try {
      const args = testQuery.trim() ? JSON.parse(testQuery) : {};
      const data = await invokeDatahubMCPTool(testTool, args);
      setMcpResult(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao executar MCP tool');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="nexus-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-heading font-semibold text-foreground">DataHub MCP Server</h3>
            <p className="text-[11px] text-muted-foreground">Exponha o DataHub como MCP Server para Claude Desktop, VS Code ou qualquer cliente MCP.</p>
          </div>
        </div>
        <div className="bg-secondary/30 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-foreground">Endpoint MCP</p>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(mcpUrl); toast.success('URL copiada!'); }}>
              <Copy className="h-3 w-3" /> Copiar
            </Button>
          </div>
          <code className="text-[11px] text-muted-foreground font-mono break-all">{mcpUrl}</code>
        </div>
      </div>

      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-3">MCP Tools ({mcpTools.length})</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
          {mcpTools.map((t) => (
            <div key={t.name} className="p-3 rounded-lg bg-secondary/20 border border-border/30">
              <p className="text-xs font-medium text-foreground font-mono">{t.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Testar MCP Tool</h3>
        <div className="grid md:grid-cols-3 gap-3 mb-3">
          <div>
            <label htmlFor="mcp-tool-select" className="text-[11px] text-muted-foreground">Tool</label>
            <select id="mcp-tool-select" value={testTool} onChange={(e) => setTestTool(e.target.value)} className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs">
              {mcpTools.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="mcp-params-input" className="text-[11px] text-muted-foreground">Parametros (JSON)</label>
            <Input id="mcp-params-input" value={testQuery} onChange={(e) => setTestQuery(e.target.value)} placeholder='{"entity_type": "Clientes", "query": "..."}' className="bg-secondary/50 text-xs font-mono" />
          </div>
        </div>
        <Button size="sm" onClick={handleTest} disabled={testing} className="gap-1.5">
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Executar
        </Button>
        {mcpResult && (
          <div className="mt-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
            <pre className="text-[11px] text-muted-foreground overflow-auto max-h-[250px] font-mono">{JSON.stringify(mcpResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
