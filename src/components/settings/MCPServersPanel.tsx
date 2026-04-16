/**
 * MCPServersPanel — Manage MCP Server connections.
 * Wires mcpClient + mcpRegistry into Settings.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Server, Plus, Loader2, CheckCircle2, XCircle, Trash2, RefreshCcw, Wrench } from 'lucide-react';
import { registerMCPServer, listMCPServers, removeMCPServer, getAllMCPTools, type MCPServer, type MCPTool } from '@/lib/mcp';
import { toast } from 'sonner';

export function MCPServersPanel() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await listMCPServers();
      setServers(s);
      const t = await getAllMCPTools();
      setTools(t);
    } catch {
      toast.error('Erro ao carregar MCP servers');
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const server = await registerMCPServer({
        server: { url: newUrl, name: newName || new URL(newUrl).hostname, status: 'disconnected', tools: [] },
      });
      setServers(prev => [...prev, server]);
      toast.success(`MCP Server adicionado: ${server.name}`);
      setNewUrl('');
      setNewName('');
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : 'Falha ao conectar'}`);
    }
    setAdding(false);
  };

  const handleRemove = async (url: string) => {
    try {
      await removeMCPServer(url);
      setServers(prev => prev.filter(s => s.url !== url));
      toast.success('Server removido');
    } catch {
      toast.error('Erro ao remover server');
    }
  };

  return (
    <div className="nexus-card space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-nexus-blue/10 flex items-center justify-center">
          <Server className="h-4 w-4 text-nexus-blue" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">MCP Servers</h3>
          <p className="text-[11px] text-muted-foreground">
            Conecte servidores MCP para expandir as capacidades dos agentes
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            <Wrench className="h-3 w-3 mr-1" />{tools.length} tools
          </Badge>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={refresh} disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Add new server */}
      <div className="flex gap-2">
        <Input
          placeholder="Nome do server"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="h-8 text-xs w-1/3"
        />
        <Input
          placeholder="https://mcp-server.example.com"
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          className="h-8 text-xs flex-1"
        />
        <Button size="sm" className="gap-1.5 text-xs shrink-0" onClick={handleAdd} disabled={adding || !newUrl.trim()}>
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Conectar
        </Button>
      </div>

      {/* Server list */}
      {servers.length === 0 ? (
        <div className="text-center py-6">
          <Server className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Nenhum MCP server conectado</p>
          <p className="text-[10px] text-muted-foreground mt-1">Clique em "Atualizar" para descobrir servers existentes</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {servers.map(server => (
            <div key={server.url} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
              {server.status === 'connected' ? (
                <CheckCircle2 className="h-4 w-4 text-nexus-emerald shrink-0" />
              ) : server.status === 'error' ? (
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
              ) : (
                <Server className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{server.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{server.url}</p>
              </div>
              <Badge variant="outline" className="text-[9px]">{server.tools.length} tools</Badge>
              <Badge variant="outline" className={`text-[9px] ${
                server.status === 'connected' ? 'border-nexus-emerald/50 text-nexus-emerald' :
                server.status === 'error' ? 'border-destructive/50 text-destructive' :
                ''
              }`}>{server.status}</Badge>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(server.url)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
