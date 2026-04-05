/**
 * MCP Server Manager — Registrar, conectar e testar MCP servers.
 * Uses fromTable() since mcp_servers is not in generated types.
 */
import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { fromTable } from '@/lib/supabaseExtended';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, RefreshCw, Loader2, Wrench } from 'lucide-react';

interface MCPServer {
  id: string;
  name: string;
  url: string;
  status: string;
  tools_discovered: Array<{ name: string; description: string }>;
  created_at: string;
}

export function MCPServerManager() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadServers(); }, []);

  async function loadServers() {
    try {
      const { data } = await fromTable('mcp_servers').select('*').order('created_at', { ascending: false });
      setServers((data || []) as unknown as MCPServer[]);
    } catch { /* table might not exist yet */ }
    setLoading(false);
  }

  async function addServer() {
    if (!newName || !newUrl) return;
    setAdding(true);
    try {
      await fromTable('mcp_servers').insert({ name: newName, url: newUrl, status: 'disconnected', tools_discovered: [] });
      setNewName('');
      setNewUrl('');
      await loadServers();
    } catch (err) {
      logger.error('Failed to add MCP server:', err);
    }
    setAdding(false);
  }

  async function removeServer(id: string) {
    await fromTable('mcp_servers').delete().eq('id', id);
    await loadServers();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">MCP Servers</h3>
          <Badge variant="outline" className="text-[10px]">{servers.length} registrados</Badge>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome (ex: GitHub)"
          className="bg-secondary/50 border-border/50 text-xs h-8"
        />
        <Input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="URL do MCP server"
          className="bg-secondary/50 border-border/50 text-xs h-8 flex-1"
        />
        <Button onClick={addServer} disabled={adding || !newName || !newUrl} size="sm" className="h-8">
          {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground text-center py-4">Carregando...</div>
      ) : servers.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-8 bg-secondary/30 rounded-lg">
          Nenhum MCP server registrado. Adicione acima para conectar a ferramentas externas.
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map(s => (
            <div key={s.id} className="bg-secondary/30 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                  <Badge variant="outline" className={`text-[10px] ${s.status === 'connected' ? 'border-nexus-emerald text-nexus-emerald' : ''}`}>
                    {s.status}
                  </Badge>
                  {Array.isArray(s.tools_discovered) && s.tools_discovered.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">{s.tools_discovered.length} tools</span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{s.url}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Ação">
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeServer(s.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
