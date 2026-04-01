import { useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Shield, Plus, Trash2, Edit, X, Save, AlertTriangle, CheckCircle, Search } from "lucide-react";
import { toast } from "sonner";

// ═══ TYPES ═══

interface Guardrail {
  id: string;
  name: string;
  type: 'input' | 'output' | 'access' | 'operational';
  description: string;
  severity: 'block' | 'warn' | 'log';
  enabled: boolean;
  triggersToday: number;
  blockRate: number;
  assignedAgents: string[];
}

// ═══ SEED DATA ═══

const DEFAULT_GUARDRAILS: Guardrail[] = [
  { id: 'g1', name: 'Prompt Injection Detection', type: 'input', description: 'Detecta tentativas de manipulação do prompt do sistema', severity: 'block', enabled: true, triggersToday: 12, blockRate: 98.5, assignedAgents: ['Assistente Comercial', 'Suporte L1'] },
  { id: 'g2', name: 'PII Redaction', type: 'input', description: 'Mascara dados pessoais sensíveis (CPF, email, telefone) antes do processamento', severity: 'block', enabled: true, triggersToday: 45, blockRate: 100, assignedAgents: ['Todos'] },
  { id: 'g3', name: 'Toxicity Filter', type: 'output', description: 'Filtra respostas com conteúdo tóxico, ofensivo ou inadequado', severity: 'block', enabled: true, triggersToday: 3, blockRate: 99.2, assignedAgents: ['Suporte L1', 'Atendimento WhatsApp'] },
  { id: 'g4', name: 'Hallucination Detection', type: 'output', description: 'Detecta informações fabricadas sem base nos dados do RAG', severity: 'warn', enabled: true, triggersToday: 8, blockRate: 87, assignedAgents: ['Analista de Dados'] },
  { id: 'g5', name: 'Token Budget Limit', type: 'operational', description: 'Limita custo por sessão (max tokens por interação)', severity: 'block', enabled: true, triggersToday: 2, blockRate: 100, assignedAgents: ['Todos'] },
  { id: 'g6', name: 'Human-in-the-Loop Gate', type: 'access', description: 'Requer aprovação humana para ações de alto impacto (delete, deploy)', severity: 'block', enabled: false, triggersToday: 0, blockRate: 0, assignedAgents: [] },
  { id: 'g7', name: 'Rate Limiting', type: 'operational', description: 'Limita requisições por minuto por agente', severity: 'warn', enabled: true, triggersToday: 15, blockRate: 95, assignedAgents: ['Todos'] },
  { id: 'g8', name: 'Bias Detection', type: 'output', description: 'Detecta viés em respostas (gênero, raça, idade)', severity: 'warn', enabled: false, triggersToday: 0, blockRate: 0, assignedAgents: [] },
];

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  input: { label: 'Input', color: 'bg-blue-500/20 text-blue-400' },
  output: { label: 'Output', color: 'bg-purple-500/20 text-purple-400' },
  access: { label: 'Acesso', color: 'bg-amber-500/20 text-amber-400' },
  operational: { label: 'Operacional', color: 'bg-emerald-500/20 text-emerald-400' },
};

const SEVERITY_OPTIONS = [
  { value: 'block', label: 'Bloquear', color: 'text-rose-400' },
  { value: 'warn', label: 'Alertar', color: 'text-amber-400' },
  { value: 'log', label: 'Registrar', color: 'text-muted-foreground' },
];

const AVAILABLE_AGENTS = ['Assistente Comercial', 'Analista de Dados', 'Suporte L1', 'Atendimento WhatsApp', 'Agente BPM', 'Todos'];

// ═══ MAIN PAGE ═══

export default function SecurityPage() {
  const [guardrails, setGuardrails] = useState<Guardrail[]>(DEFAULT_GUARDRAILS);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // New guardrail form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Guardrail['type']>('input');
  const [newDesc, setNewDesc] = useState('');
  const [newSeverity, setNewSeverity] = useState<Guardrail['severity']>('warn');

  const createGuardrail = useCallback(() => {
    if (!newName.trim()) { toast.error('Nome é obrigatório'); return; }
    const g: Guardrail = {
      id: `g-${Date.now()}`, name: newName, type: newType, description: newDesc,
      severity: newSeverity, enabled: true, triggersToday: 0, blockRate: 0, assignedAgents: [],
    };
    setGuardrails(prev => [...prev, g]);
    toast.success(`Guardrail "${newName}" criado`);
    setShowCreate(false);
    setNewName(''); setNewDesc('');
  }, [newName, newType, newDesc, newSeverity]);

  const deleteGuardrail = useCallback((id: string) => {
    if (!confirm('Excluir este guardrail?')) return;
    setGuardrails(prev => prev.filter(g => g.id !== id));
    toast.info('Guardrail excluído');
  }, []);

  const toggleGuardrail = useCallback((id: string) => {
    setGuardrails(prev => prev.map(g => g.id === id ? { ...g, enabled: !g.enabled } : g));
  }, []);

  const updateSeverity = useCallback((id: string, severity: Guardrail['severity']) => {
    setGuardrails(prev => prev.map(g => g.id === id ? { ...g, severity } : g));
    toast.success('Severidade atualizada');
  }, []);

  const assignAgent = useCallback((guardrailId: string, agent: string) => {
    setGuardrails(prev => prev.map(g => {
      if (g.id !== guardrailId) return g;
      const agents = g.assignedAgents.includes(agent)
        ? g.assignedAgents.filter(a => a !== agent)
        : [...g.assignedAgents, agent];
      return { ...g, assignedAgents: agents };
    }));
  }, []);

  const filtered = guardrails.filter(g =>
    (filterType === 'all' || g.type === filterType) &&
    (!searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const enabledCount = guardrails.filter(g => g.enabled).length;
  const totalTriggers = guardrails.reduce((s, g) => s + g.triggersToday, 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Security & Guardrails"
        description="Políticas de segurança, moderação, compliance e governança dos agentes"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Nova política</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Guardrails ativos', value: `${enabledCount}/${guardrails.length}`, color: 'text-emerald-400' },
          { label: 'Triggers hoje', value: String(totalTriggers), color: 'text-amber-400' },
          { label: 'Block rate médio', value: `${guardrails.length > 0 ? Math.round(guardrails.filter(g => g.enabled).reduce((s, g) => s + g.blockRate, 0) / Math.max(enabledCount, 1)) : 0}%`, color: 'text-foreground' },
          { label: 'Agentes protegidos', value: String(new Set(guardrails.flatMap(g => g.assignedAgents)).size), color: 'text-primary' },
        ].map(kpi => (
          <div key={kpi.label} className="nexus-card text-center py-3">
            <p className={`text-2xl font-heading font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar guardrail..." className="w-full pl-9 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground">
          <option value="all">Todos os tipos</option>
          <option value="input">Input</option>
          <option value="output">Output</option>
          <option value="access">Acesso</option>
          <option value="operational">Operacional</option>
        </select>
      </div>

      {/* Guardrails grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(g => {
          const typeInfo = TYPE_LABELS[g.type];
          const isEditing = editingId === g.id;
          return (
            <div key={g.id} className={`nexus-card transition-all ${!g.enabled ? 'opacity-50' : ''} ${isEditing ? 'ring-2 ring-primary' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{g.name}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeInfo.color}`}>{typeInfo.label}</span>
                  </div>
                </div>
                <Switch checked={g.enabled} onCheckedChange={() => toggleGuardrail(g.id)} />
              </div>
              <p className="text-xs text-muted-foreground mb-3">{g.description}</p>

              {/* Severity */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-muted-foreground">Severidade:</span>
                <select value={g.severity} onChange={e => updateSeverity(g.id, e.target.value as Guardrail['severity'])} className="bg-muted/30 border border-border rounded px-2 py-0.5 text-[10px] text-foreground">
                  {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* Assigned agents */}
              {isEditing ? (
                <div className="space-y-1 mb-3">
                  <p className="text-[10px] font-semibold text-foreground">Atribuir a agentes:</p>
                  <div className="flex flex-wrap gap-1">
                    {AVAILABLE_AGENTS.map(agent => (
                      <button key={agent} onClick={() => assignAgent(g.id, agent)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${g.assignedAgents.includes(agent) ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted/20 text-muted-foreground border-border hover:bg-muted/40'}`}>
                        {g.assignedAgents.includes(agent) ? '✓ ' : ''}{agent}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                g.assignedAgents.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {g.assignedAgents.map(a => <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground">{a}</span>)}
                  </div>
                )
              )}

              {/* Stats + Actions */}
              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <div className="flex gap-4 text-xs">
                  <span className="text-muted-foreground">{g.triggersToday} triggers</span>
                  <span className="text-emerald-400">{g.blockRate}% block rate</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingId(isEditing ? null : g.id)} className="p-1 rounded hover:bg-muted/30"><Edit className="h-3 w-3 text-muted-foreground" /></button>
                  <button onClick={() => deleteGuardrail(g.id)} className="p-1 rounded hover:bg-destructive/20"><Trash2 className="h-3 w-3 text-destructive" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Criar Guardrail</h3>
              <button onClick={() => setShowCreate(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground">Nome *</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Rate Limiting por IP" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1" /></div>
              <div><label className="text-xs text-muted-foreground">Tipo</label>
                <select value={newType} onChange={e => setNewType(e.target.value as Guardrail['type'])} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1">
                  <option value="input">Input Validation</option>
                  <option value="output">Output Safety</option>
                  <option value="access">Access Control</option>
                  <option value="operational">Operational</option>
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Descrição</label><textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="O que este guardrail faz..." className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1 h-20 resize-none" /></div>
              <div><label className="text-xs text-muted-foreground">Severidade</label>
                <select value={newSeverity} onChange={e => setNewSeverity(e.target.value as Guardrail['severity'])} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1">
                  {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button size="sm" onClick={createGuardrail} className="gap-1"><Save className="h-3.5 w-3.5" /> Criar Guardrail</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
