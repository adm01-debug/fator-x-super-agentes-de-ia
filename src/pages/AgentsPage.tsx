import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { QuickActionsBar } from "@/components/shared/QuickActionsBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Plus, Search, Filter, ArrowRight, Loader2, BookOpen, GitBranch, Activity, Star, Copy, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AgentRow = Tables<"agents">;

// ═══ Favorites (localStorage) ═══
const FAV_KEY = "nexus-fav-agents";
function getFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
}
function toggleFavorite(id: string): string[] {
  const prev = getFavorites();
  const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}

export default function AgentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [favorites, setFavorites] = useState<string[]>(getFavorites);
  const [cloning, setCloning] = useState<string | null>(null);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("agents")
        .select("*")
        .order("updated_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleToggleFav = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites(toggleFavorite(id));
  }, []);

  const handleClone = useCallback(async (e: React.MouseEvent, agent: AgentRow) => {
    e.stopPropagation();
    setCloning(agent.id);
    try {
      const { id, created_at, updated_at, ...rest } = agent;
      const { error } = await supabase.from('agents').insert({
        ...rest,
        name: `${agent.name} (cópia)`,
        status: 'draft' as const,
        version: 1,
      }).select('id').single();
      if (error) throw error;
      toast.success('Agente clonado!');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao clonar');
    } finally {
      setCloning(null);
    }
  }, [queryClient]);

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  // Sort: favorites first, then by updated_at
  const sorted = [...filtered].sort((a, b) => {
    const aFav = favorites.includes(a.id) ? 1 : 0;
    const bFav = favorites.includes(b.id) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    return 0; // keep existing order (already sorted by updated_at)
  });

  const getConfig = (agent: AgentRow) => {
    const config = agent.config as Record<string, any> | null;
    return config ?? {};
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Agents"
        description="Gerencie seus agentes de IA — crie, configure e monitore"
        actions={
          <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
            <Plus className="h-4 w-4" /> Criar agente
          </Button>
        }
      />

      <QuickActionsBar actions={[
        { label: 'Knowledge', icon: BookOpen, path: '/knowledge' },
        { label: 'Workflows', icon: GitBranch, path: '/workflows' },
        { label: 'Monitoring', icon: Activity, path: '/monitoring' },
      ]} />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar agentes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-secondary/50 border-border/50">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="configured">Configurado</SelectItem>
            <SelectItem value="testing">Testando</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="production">Produção</SelectItem>
            <SelectItem value="archived">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !user ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Faça login para ver seus agentes</h2>
          <p className="text-sm text-muted-foreground mb-4">Seus agentes são salvos na nuvem e vinculados à sua conta.</p>
          <Button onClick={() => navigate("/auth")} className="nexus-gradient-bg text-primary-foreground">
            Entrar
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {search || statusFilter !== "all" ? (
            <>
              <Search className="h-10 w-10 text-muted-foreground/50 mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum agente encontrado</h2>
              <p className="text-sm text-muted-foreground mb-4">Tente ajustar os filtros ou o termo de busca.</p>
            </>
          ) : (
            <>
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Nenhum agente ainda</h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Crie seu primeiro agente e comece a explorar o poder dos superagentes de IA.
              </p>
              <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2">
                <Plus className="h-4 w-4" /> Criar agente
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          {sorted.map((agent) => {
            const config = getConfig(agent);
            const isFav = favorites.includes(agent.id);
            return (
              <div
                key={agent.id}
                className="nexus-card nexus-card-interactive cursor-pointer group"
                onClick={() => navigate(`/builder/${agent.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                        {agent.avatar_emoji || "🤖"}
                      </div>
                      <span
                        className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                          agent.status === 'production' || agent.status === 'monitoring'
                            ? 'bg-nexus-emerald animate-glow-pulse'
                            : agent.status === 'deprecated' || agent.status === 'archived'
                            ? 'bg-destructive'
                            : agent.status === 'draft'
                            ? 'bg-muted-foreground/40'
                            : 'bg-nexus-amber'
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {config.type || agent.persona} • {agent.model}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleClone(e, agent)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary/50 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Clonar agente"
                      disabled={cloning === agent.id}
                    >
                      {cloning === agent.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={(e) => handleToggleFav(e, agent.id)}
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                        isFav 
                          ? 'text-nexus-amber hover:bg-nexus-amber/10' 
                          : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary/50 opacity-0 group-hover:opacity-100'
                      }`}
                      aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                      <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                    <StatusBadge status={agent.status || "draft"} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {agent.mission || config.description || "Sem descrição"}
                </p>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {(agent.tags ?? []).slice(0, 3).map(tag => (
                    <span key={tag} className="nexus-badge-primary">{tag}</span>
                  ))}
                  {(agent.tags ?? []).length > 3 && (
                    <span className="nexus-badge-muted">+{(agent.tags ?? []).length - 3}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <p className="text-[11px] text-muted-foreground">
                    v{agent.version} • {new Date(agent.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
