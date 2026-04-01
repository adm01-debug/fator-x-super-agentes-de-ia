import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Plus, Search, Filter, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
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

export default function AgentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchAgents = async () => {
      setLoading(true);
      let query = supabase
        .from("agents")
        .select("*")
        .order("updated_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "draft" | "configured" | "testing" | "staging" | "review" | "production" | "monitoring" | "deprecated" | "archived");
      }

      const { data, error } = await query;
      if (!error && data) setAgents(data);
      setLoading(false);
    };
    fetchAgents();
  }, [user, statusFilter]);

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const getConfig = (agent: AgentRow) => {
    const config = agent.config as Record<string, any> | null;
    return config ?? {};
  };

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

      {loading ? (
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {search || statusFilter !== "all" ? "Nenhum agente encontrado" : "Nenhum agente ainda"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {search || statusFilter !== "all" ? "Tente ajustar os filtros." : "Crie seu primeiro agente para começar."}
          </p>
          {!search && statusFilter === "all" && (
            <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2">
              <Plus className="h-4 w-4" /> Criar agente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent, i) => {
            const config = getConfig(agent);
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="nexus-card cursor-pointer group"
                onClick={() => navigate(`/builder/${agent.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                      {agent.avatar_emoji || "🤖"}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {config.type || agent.persona} • {agent.model}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={agent.status || "draft"} />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                  {agent.mission || config.description || "Sem descrição"}
                </p>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {(agent.tags ?? []).map(tag => (
                    <span key={tag} className="nexus-badge-primary">{tag}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <p className="text-[11px] text-muted-foreground">
                    v{agent.version} • {new Date(agent.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
