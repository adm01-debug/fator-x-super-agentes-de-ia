import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Plus, FileText, Trash2, Copy, Search, X, Save } from "lucide-react";
import { toast } from "sonner";

interface Prompt {
  id: string; name: string; agent: string; version: string;
  status: 'active' | 'draft'; score: number; updated: string; content: string;
}

const SEED_PROMPTS: Prompt[] = [
  { id: '1', name: 'Suporte Premium L1', agent: 'Atlas', version: 'v2.4', status: 'active', score: 95, updated: '2026-03-28', content: 'Você é um assistente de suporte premium...' },
  { id: '2', name: 'Pesquisador Analítico', agent: 'Scout', version: 'v1.3', status: 'active', score: 88, updated: '2026-03-29', content: 'Você é um pesquisador analítico...' },
  { id: '3', name: 'SDR Outbound Personalizado', agent: 'Cleo', version: 'v1.8', status: 'active', score: 82, updated: '2026-03-30', content: 'Você é um SDR especializado em outbound...' },
  { id: '4', name: 'Compliance Analyst Jurídico', agent: 'Sentinel', version: 'v0.9', status: 'active', score: 96, updated: '2026-03-27', content: 'Você é um analista de compliance...' },
  { id: '5', name: 'Copiloto de Código', agent: 'Nova', version: 'v0.5', status: 'draft', score: 68, updated: '2026-03-30', content: 'Você é um copiloto de código...' },
  { id: '6', name: 'Orquestrador Planner', agent: 'Orchestrator', version: 'v0.1', status: 'draft', score: 45, updated: '2026-03-29', content: 'Você é um orquestrador de agentes...' },
];

export default function PromptsPage() {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<Prompt[]>(SEED_PROMPTS);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft'>('all');
  const [newName, setNewName] = useState('');
  const [newAgent, setNewAgent] = useState('');
  const [newContent, setNewContent] = useState('');

  const filtered = prompts.filter(p =>
    (filterStatus === 'all' || p.status === filterStatus) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.agent.toLowerCase().includes(search.toLowerCase()))
  );

  const createPrompt = useCallback(() => {
    if (!newName.trim()) { toast.error('Nome obrigatório'); return; }
    const p: Prompt = { id: `p-${Date.now()}`, name: newName, agent: newAgent || 'Não atribuído', version: 'v0.1', status: 'draft', score: 0, updated: new Date().toISOString().slice(0, 10), content: newContent || '' };
    setPrompts(prev => [p, ...prev]);
    setShowCreate(false); setNewName(''); setNewAgent(''); setNewContent('');
    toast.success(`Prompt "${newName}" criado`);
  }, [newName, newAgent, newContent]);

  const deletePrompt = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Excluir este prompt?')) return;
    setPrompts(prev => prev.filter(p => p.id !== id));
    toast.info('Prompt excluído');
  }, []);

  const duplicatePrompt = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const original = prompts.find(p => p.id === id);
    if (!original) return;
    const copy: Prompt = { ...original, id: `p-${Date.now()}`, name: `${original.name} (cópia)`, version: 'v0.1', status: 'draft', score: 0, updated: new Date().toISOString().slice(0, 10) };
    setPrompts(prev => [copy, ...prev]);
    toast.success(`Prompt duplicado: "${copy.name}"`);
  }, [prompts]);

  const toggleStatus = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, status: p.status === 'active' ? 'draft' as const : 'active' as const } : p));
    toast.success('Status atualizado');
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Prompt Library" description="Biblioteca de prompts reutilizáveis com versionamento e scoring"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Novo prompt</Button>} />

      <InfoHint title="Versionamento de prompts">
        Cada alteração no prompt cria uma nova versão. Compare versões lado a lado e associe resultados de avaliação.
      </InfoHint>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar prompt ou agente..." className="w-full pl-9 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
        </div>
        {(['all', 'active', 'draft'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs ${filterStatus === s ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground hover:bg-muted/30 border border-transparent'}`}>
            {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Rascunhos'}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} prompts</span>
      </div>

      <div className="nexus-card overflow-hidden p-0">
        <table className="w-full">
          <thead><tr className="border-b border-border/50 text-[11px] text-muted-foreground uppercase tracking-wider">
            <th className="text-left px-5 py-3 font-medium">Prompt</th>
            <th className="text-left px-5 py-3 font-medium">Agente</th>
            <th className="text-left px-5 py-3 font-medium">Versão</th>
            <th className="text-left px-5 py-3 font-medium">Score</th>
            <th className="text-left px-5 py-3 font-medium">Status</th>
            <th className="text-left px-5 py-3 font-medium">Atualizado</th>
            <th className="text-center px-5 py-3 font-medium">Ações</th>
          </tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => navigate(`/prompts/${p.id}`)}>
                <td className="px-5 py-3"><div className="flex items-center gap-2.5"><FileText className="h-4 w-4 text-primary" /><span className="text-sm font-medium text-foreground">{p.name}</span></div></td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{p.agent}</td>
                <td className="px-5 py-3"><span className="text-xs font-mono text-foreground">{p.version}</span></td>
                <td className="px-5 py-3"><span className={`text-sm font-heading font-bold ${p.score >= 85 ? 'text-emerald-400' : p.score >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>{p.score}</span></td>
                <td className="px-5 py-3"><button onClick={e => toggleStatus(p.id, e)}><StatusBadge status={p.status} /></button></td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{p.updated}</td>
                <td className="px-5 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={e => duplicatePrompt(p.id, e)} className="p-1 rounded hover:bg-muted/30" title="Duplicar"><Copy className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    <button onClick={e => deletePrompt(p.id, e)} className="p-1 rounded hover:bg-destructive/20" title="Excluir"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-8 text-xs text-muted-foreground">Nenhum prompt encontrado</div>}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">Novo Prompt</h3><button onClick={() => setShowCreate(false)}><X className="h-4 w-4 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do prompt *" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
              <input value={newAgent} onChange={e => setNewAgent(e.target.value)} placeholder="Agente associado (opcional)" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
              <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Conteúdo inicial do prompt..." className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground h-24 resize-none font-mono" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button size="sm" onClick={createPrompt}><Save className="h-3.5 w-3.5 mr-1" /> Criar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
