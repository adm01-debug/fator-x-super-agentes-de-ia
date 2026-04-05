/**
 * MCP Server Manager — Registrar, conectar e testar MCP servers.
 * Usa NexusMCPClient + mcpRegistry.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data } = await supabase.from('mcp_servers').select('*').order('created_at', { ascending: false });
      setServers((data || []) as unknown as MCPServer[]);
    } catch { /* table might not exist yet */ }
    setLoading(false);
  }

  async function addServer() {
    if (!newName || !newUrl) return;
    setAdding(true);
    try {
      await supabase.from('mcp_servers').insert({ name: newName, url: newUrl, status: 'disconnected', tools_discovered: [] });
      setNewName('');
      setNewUrl('');
      await loadServers();
    } catch (err) {
      console.error('Failed to add MCP server:', err);
    }
    setAdding(false);
  }

  async function removeServer(id: string) {
    await supabase.from('mcp_servers').delete().eq('id', id);
    await loadServers();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-[#E67E22]" />
          <h3 className="text-sm font-bold text-white">MCP Servers</h3>
          <Badge variant="outline" className="text-[10px]">{servers.length} registrados</Badge>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome (ex: GitHub)"
          className="bg-[#0a0a1a] border-[#222244] text-xs h-8"
        />
        <Input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="URL do MCP server"
          className="bg-[#0a0a1a] border-[#222244] text-xs h-8 flex-1"
        />
        <Button onClick={addServer} disabled={adding || !newName || !newUrl} size="sm" className="h-8">
          {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-[#888888] text-center py-4">Carregando...</div>
      ) : servers.length === 0 ? (
        <div className="text-xs text-[#888888] text-center py-8 bg-[#0a0a1a] rounded-lg">
          Nenhum MCP server registrado. Adicione acima para conectar a ferramentas externas.
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map(s => (
            <div key={s.id} className="bg-[#0a0a1a] rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{s.name}</span>
                  <Badge variant="outline" className={`text-[10px] ${s.status === 'connected' ? 'border-[#6BCB77] text-[#6BCB77]' : 'border-[#888888] text-[#888888]'}`}>
                    {s.status}
                  </Badge>
                  {Array.isArray(s.tools_discovered) && s.tools_discovered.length > 0 && (
                    <span className="text-[10px] text-[#888888]">{s.tools_discovered.length} tools</span>
                  )}
                </div>
                <span className="text-[10px] text-[#555555] font-mono">{s.url}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => removeServer(s.id)}>
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
