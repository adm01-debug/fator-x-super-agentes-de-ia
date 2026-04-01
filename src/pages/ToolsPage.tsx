import { useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Search, Globe, Code, Database, Users, Mail, Calendar, MessageSquare, FileText, Webhook, Plug, UserCheck, Plus, Trash2, X, Save, Play, Settings } from "lucide-react";
import { toast } from "sonner";

interface Tool {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: string;
  enabled: boolean;
  rateLimit: number;
  callsToday: number;
  lastUsed: string;
  assignedAgents: string[];
}

const SEED_TOOLS: Tool[] = [
  { id: 't1', name: 'Web Search', type: 'data', description: 'Busca na internet via Google/Bing', icon: '🔍', enabled: true, rateLimit: 100, callsToday: 45, lastUsed: '2 min atrás', assignedAgents: ['Assistente Comercial'] },
  { id: 't2', name: 'Supabase Query', type: 'data', description: 'Query SQL em bancos Supabase conectados', icon: '🗃️', enabled: true, rateLimit: 500, callsToday: 230, lastUsed: '1 min atrás', assignedAgents: ['Analista de Dados', 'Assistente Comercial'] },
  { id: 't3', name: 'Email Sender', type: 'action', description: 'Enviar emails via SMTP ou API', icon: '📧', enabled: false, rateLimit: 50, callsToday: 0, lastUsed: 'Nunca', assignedAgents: [] },
  { id: 't4', name: 'Slack Messenger', type: 'action', description: 'Enviar mensagens para canais Slack', icon: '💬', enabled: true, rateLimit: 200, callsToday: 12, lastUsed: '15 min atrás', assignedAgents: ['Suporte L1'] },
  { id: 't5', name: 'Calendar', type: 'action', description: 'Criar/consultar eventos no Google Calendar', icon: '📅', enabled: false, rateLimit: 100, callsToday: 0, lastUsed: 'Nunca', assignedAgents: [] },
  { id: 't6', name: 'Code Executor', type: 'compute', description: 'Executar Python/JS em sandbox seguro', icon: '💻', enabled: true, rateLimit: 30, callsToday: 8, lastUsed: '30 min atrás', assignedAgents: ['Analista de Dados'] },
  { id: 't7', name: 'PDF Parser', type: 'data', description: 'Extrair texto e tabelas de PDFs', icon: '📄', enabled: true, rateLimit: 50, callsToday: 3, lastUsed: '1h atrás', assignedAgents: ['Assistente Comercial'] },
  { id: 't8', name: 'Bitrix24 CRM', type: 'integration', description: 'CRUD de leads, deals, contacts no Bitrix', icon: '🏢', enabled: true, rateLimit: 200, callsToday: 67, lastUsed: '5 min atrás', assignedAgents: ['Assistente Comercial', 'Agente BPM'] },
  { id: 't9', name: 'WhatsApp API', type: 'integration', description: 'Enviar/receber mensagens WhatsApp', icon: '📱', enabled: true, rateLimit: 300, callsToday: 156, lastUsed: '30s atrás', assignedAgents: ['Atendimento WhatsApp'] },
  { id: 't10', name: 'Image Generator', type: 'compute', description: 'Gerar imagens via DALL-E ou Midjourney', icon: '🎨', enabled: false, rateLimit: 10, callsToday: 0, lastUsed: 'Nunca', assignedAgents: [] },
];

const AGENTS = ['Assistente Comercial', 'Analista de Dados', 'Suporte L1', 'Atendimento WhatsApp', 'Agente BPM'];
const TYPES = [{ id: 'all', label: 'Todos' }, { id: 'data', label: 'Dados' }, { id: 'action', label: 'Ação' }, { id: 'compute', label: 'Compute' }, { id: 'integration', label: 'Integração' }];

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>(SEED_TOOLS);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('data');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('🔧');

  const filtered = tools.filter(t =>
    (filterType === 'all' || t.type === filterType) &&
    (!search || t.name.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleTool = useCallback((id: string) => {
    setTools(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  }, []);

  const deleteTool = useCallback((id: string) => {
    if (!confirm('Excluir esta ferramenta?')) return;
    setTools(prev => prev.filter(t => t.id !== id));
    toast.info('Ferramenta excluída');
  }, []);

  const updateRateLimit = useCallback((id: string, limit: number) => {
    setTools(prev => prev.map(t => t.id === id ? { ...t, rateLimit: limit } : t));
  }, []);

  const assignAgent = useCallback((toolId: string, agent: string) => {
    setTools(prev => prev.map(t => {
      if (t.id !== toolId) return t;
      const agents = t.assignedAgents.includes(agent) ? t.assignedAgents.filter(a => a !== agent) : [...t.assignedAgents, agent];
      return { ...t, assignedAgents: agents };
    }));
  }, []);

  const createTool = useCallback(() => {
    if (!newName.trim()) { toast.error('Nome obrigatório'); return; }
    setTools(prev => [...prev, { id: `t-${Date.now()}`, name: newName, type: newType, description: newDesc, icon: newIcon, enabled: true, rateLimit: 100, callsToday: 0, lastUsed: 'Nunca', assignedAgents: [] }]);
    setShowCreate(false); setNewName(''); setNewDesc('');
    toast.success(`Ferramenta "${newName}" criada`);
  }, [newName, newType, newDesc, newIcon]);

  const testTool = useCallback((id: string) => {
    const tool = tools.find(t => t.id === id);
    if (!tool) return;
    toast.info(`Testando ${tool.name}...`);
    setTimeout(() => toast.success(`${tool.name}: Teste OK — 200ms`), 1000 + Math.random() * 1000);
  }, [tools]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Tools & Integrations" description="Gerencie ferramentas e integrações que os agentes podem usar"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Nova ferramenta</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Habilitadas', value: tools.filter(t => t.enabled).length, color: 'text-emerald-400' },
          { label: 'Calls hoje', value: tools.reduce((s, t) => s + t.callsToday, 0), color: 'text-foreground' },
          { label: 'Tipos', value: new Set(tools.map(t => t.type)).size, color: 'text-primary' },
          { label: 'Agentes usando', value: new Set(tools.flatMap(t => t.assignedAgents)).size, color: 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="nexus-card text-center py-3">
            <p className={`text-2xl font-heading font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ferramenta..." className="w-full pl-9 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="flex gap-1">
          {TYPES.map(tp => (
            <button key={tp.id} onClick={() => setFilterType(tp.id)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filterType === tp.id ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground hover:bg-muted/30 border border-transparent'}`}>{tp.label}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(t => {
          const isEditing = editingId === t.id;
          return (
            <div key={t.id} className={`nexus-card ${!t.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{t.icon}</span>
                  <div><h3 className="text-sm font-semibold text-foreground">{t.name}</h3><p className="text-[10px] text-muted-foreground">{t.type}</p></div>
                </div>
                <Switch checked={t.enabled} onCheckedChange={() => toggleTool(t.id)} />
              </div>
              <p className="text-xs text-muted-foreground mb-2">{t.description}</p>
              <div className="flex gap-3 text-[10px] text-muted-foreground mb-2">
                <span>{t.callsToday} calls hoje</span>
                <span>Limite: {t.rateLimit}/min</span>
                <span>{t.lastUsed}</span>
              </div>
              {t.assignedAgents.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">{t.assignedAgents.map(a => <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground">{a}</span>)}</div>
              )}
              {isEditing && (
                <div className="border-t border-border pt-2 mt-2 space-y-2">
                  <div><label className="text-[10px] text-muted-foreground">Rate Limit (/min)</label>
                    <input type="number" value={t.rateLimit} onChange={e => updateRateLimit(t.id, Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded px-2 py-1 text-xs text-foreground font-mono mt-1" />
                  </div>
                  <div><p className="text-[10px] font-semibold text-foreground mb-1">Atribuir a agentes:</p>
                    <div className="flex flex-wrap gap-1">
                      {AGENTS.map(a => (
                        <button key={a} onClick={() => assignAgent(t.id, a)} className={`text-[10px] px-2 py-0.5 rounded border ${t.assignedAgents.includes(a) ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground border-border hover:bg-muted/30'}`}>{t.assignedAgents.includes(a) ? '✓ ' : ''}{a}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-1 mt-2 pt-2 border-t border-border/50">
                <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7" onClick={() => testTool(t.id)}><Play className="h-3 w-3 mr-1" /> Testar</Button>
                <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7" onClick={() => setEditingId(isEditing ? null : t.id)}><Settings className="h-3 w-3 mr-1" /> Config</Button>
                <button onClick={() => deleteTool(t.id)} className="p-1 rounded hover:bg-destructive/20"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">Nova Ferramenta</h3><button onClick={() => setShowCreate(false)}><X className="h-4 w-4 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input value={newIcon} onChange={e => setNewIcon(e.target.value)} className="w-14 bg-muted/30 border border-border rounded-lg px-2 py-2 text-center text-lg" maxLength={2} />
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome da ferramenta" className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground">
                <option value="data">Dados</option><option value="action">Ação</option><option value="compute">Compute</option><option value="integration">Integração</option>
              </select>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descrição..." className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground h-16 resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button size="sm" onClick={createTool}><Save className="h-3.5 w-3.5 mr-1" /> Criar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
