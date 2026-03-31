import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Bot, Plus, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, mission, avatar_emoji, status, model, tags, version, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeCount = agents.filter(a => a.status === 'production' || a.status === 'monitoring').length;
  const draftCount = agents.filter(a => a.status === 'draft').length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Dashboard"
        description="Visão executiva da operação de agentes de IA"
        actions={
          <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
            <Plus className="h-4 w-4" /> Criar agente
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">⚡</div>
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">Bem-vindo ao Nexus Agents Studio!</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Crie, configure, avalie e opere agentes de IA com governança completa. Comece criando seu primeiro agente.
          </p>
          <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
            <Plus className="h-4 w-4" /> Criar seu primeiro agente
          </Button>
          <div className="grid md:grid-cols-3 gap-4 mt-10 w-full max-w-2xl">
            {[
              { emoji: '🧠', title: 'Super Cérebro', desc: 'Memória centralizada para toda a empresa' },
              { emoji: '🔮', title: 'Oráculo', desc: 'Conselho de múltiplas IAs para melhores respostas' },
              { emoji: '🛡️', title: 'Guardrails', desc: 'Segurança e compliance em tempo real' },
            ].map(card => (
              <div key={card.title} className="nexus-card text-center">
                <div className="text-3xl mb-2">{card.emoji}</div>
                <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-1">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="nexus-card text-center">
              <p className="text-2xl font-heading font-bold text-foreground">{agents.length}</p>
              <p className="text-[11px] text-muted-foreground">Total de agentes</p>
            </div>
            <div className="nexus-card text-center">
              <p className="text-2xl font-heading font-bold text-nexus-emerald">{activeCount}</p>
              <p className="text-[11px] text-muted-foreground">Em produção</p>
            </div>
            <div className="nexus-card text-center">
              <p className="text-2xl font-heading font-bold text-nexus-amber">{draftCount}</p>
              <p className="text-[11px] text-muted-foreground">Rascunhos</p>
            </div>
            <div className="nexus-card text-center">
              <p className="text-2xl font-heading font-bold text-muted-foreground">—</p>
              <p className="text-[11px] text-muted-foreground">Dados após deploy</p>
            </div>
          </div>

          <div className="nexus-card">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Agentes recentes</h3>
            <div className="space-y-3">
              {agents.slice(0, 5).map(agent => (
                <div key={agent.id} className="flex items-center justify-between cursor-pointer hover:bg-secondary/30 rounded-lg p-2 -mx-2 transition-colors" onClick={() => navigate(`/builder/${agent.id}`)}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">{agent.avatar_emoji || '🤖'}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                      <p className="text-[11px] text-muted-foreground">{agent.model} • v{agent.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={agent.status || 'draft'} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <InfoHint title="O que são superagentes de IA?">
        Superagentes combinam modelos de linguagem, memória persistente, ferramentas externas e RAG para executar tarefas complexas de forma autônoma. Esta plataforma permite criar, treinar, avaliar e operar esses agentes com governança e observabilidade completas.
      </InfoHint>
    </div>
  );
}
