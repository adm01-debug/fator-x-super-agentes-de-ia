import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { agents } from "@/lib/mock-data";
import { Bot, Plus, Search, Filter, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";

export default function AgentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const filtered = agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.tags.some(t => t.includes(search.toLowerCase())));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Agents"
        description="Gerencie seus agentes de IA — crie, configure e monitore"
        actions={
          <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
            <Plus className="h-4 w-4" /> Criar agente
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar agentes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((agent, i) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="nexus-card cursor-pointer group"
            onClick={() => navigate(`/agents/${agent.id}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{agent.name.split('—')[0].trim()}</h3>
                  <p className="text-[11px] text-muted-foreground">{agent.type} • {agent.model}</p>
                </div>
              </div>
              <StatusBadge status={agent.status} />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{agent.description}</p>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-border/50 pt-3">
              <div>
                <p className="text-lg font-heading font-bold text-foreground">{agent.sessions24h.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Sessões 24h</p>
              </div>
              <div>
                <p className="text-lg font-heading font-bold text-foreground">{agent.successRate > 0 ? `${agent.successRate}%` : '—'}</p>
                <p className="text-[10px] text-muted-foreground">Sucesso</p>
              </div>
              <div>
                <p className="text-lg font-heading font-bold text-foreground">{agent.costToday > 0 ? `R$${agent.costToday.toFixed(0)}` : '—'}</p>
                <p className="text-[10px] text-muted-foreground">Custo hoje</p>
              </div>
            </div>
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {agent.tags.map(tag => (
                <span key={tag} className="nexus-badge-primary">{tag}</span>
              ))}
              <StatusBadge status={agent.maturity} />
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground">{agent.owner}</p>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
