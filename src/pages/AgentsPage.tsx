import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { agents as mockAgents } from "@/lib/mock-data";
import { Plus, Search, ArrowRight, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentBuilderStore } from "@/stores/agentBuilderStore";
import { toast } from "sonner";

export default function AgentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { savedAgents, loadSavedAgents, deleteAgent, setCurrentUserId } = useAgentBuilderStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id);
      loadSavedAgents();
    }
  }, [user?.id, setCurrentUserId, loadSavedAgents]);

  const hasRealAgents = savedAgents.length > 0;

  // Map real agents to display format
  const displayAgents = hasRealAgents
    ? savedAgents.map(a => ({
        id: a.id,
        name: a.name,
        description: a.mission,
        model: a.model,
        persona: a.persona,
        status: a.status,
        emoji: a.avatar_emoji,
        tags: a.tags,
        version: a.version,
        updated_at: a.updated_at,
      }))
    : mockAgents.map(a => ({
        id: a.id,
        name: a.name.split('—')[0].trim(),
        description: a.description,
        model: a.model,
        persona: a.type,
        status: a.status,
        emoji: '🤖',
        tags: a.tags,
        version: 1,
        updated_at: a.updatedAt,
      }));

  const filtered = displayAgents.filter(a => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja realmente excluir este agente?')) return;
    try {
      await deleteAgent(id);
      toast.success('Agente excluído');
    } catch {
      toast.error('Erro ao excluir agente');
    }
  };

  // Stats
  const total = displayAgents.length;
  const production = displayAgents.filter(a => a.status === 'production' || a.status === 'active').length;
  const testing = displayAgents.filter(a => a.status === 'testing').length;
  const draft = displayAgents.filter(a => a.status === 'draft').length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Agents"
        description="Gerencie seus agentes de IA — crie, configure e monitore"
        actions={
          <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
            <Plus className="h-4 w-4" /> Criar agente
          </Button>
        }
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total, color: 'text-foreground' },
          { label: 'Produção', value: production, color: 'text-nexus-emerald' },
          { label: 'Teste', value: testing, color: 'text-nexus-amber' },
          { label: 'Rascunho', value: draft, color: 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="nexus-card text-center py-3">
            <p className={`text-2xl font-heading font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar agentes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-muted-foreground"
        >
          <option value="all">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="testing">Testando</option>
          <option value="production">Produção</option>
          <option value="active">Ativo</option>
          <option value="archived">Arquivado</option>
        </select>
      </div>

      {/* Agent Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((agent, i) => (
          <div
            key={agent.id}
            className="nexus-card cursor-pointer group"
            onClick={() => navigate(`/agents/${agent.id}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
                  {agent.emoji}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{agent.persona} • {agent.model}</p>
                </div>
              </div>
              <StatusBadge status={agent.status} />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{agent.description || 'Sem descrição'}</p>

            <div className="flex gap-1.5 flex-wrap">
              {agent.tags.slice(0, 4).map(tag => (
                <span key={tag} className="nexus-badge-primary">{tag}</span>
              ))}
              {agent.tags.length > 4 && <span className="nexus-badge-primary">+{agent.tags.length - 4}</span>}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground">v{agent.version} • {new Date(agent.updated_at).toLocaleDateString('pt-BR')}</p>
              <div className="flex items-center gap-1">
                {hasRealAgents && (
                  <button
                    onClick={(e) => handleDelete(agent.id, e)}
                    className="p-1 rounded hover:bg-destructive/20 transition-colors opacity-0 group-hover:opacity-100"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                )}
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">🤖</div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum agente encontrado</h2>
          <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro agente para começar</p>
          <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2">
            <Plus className="h-4 w-4" /> Criar agente
          </Button>
        </div>
      )}
    </div>
  );
}
