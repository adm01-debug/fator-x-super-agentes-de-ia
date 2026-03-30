import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Brain, Clock, Globe, User, Users, Database, Settings } from "lucide-react";
import { motion } from "framer-motion";

const memoryTypes = [
  { icon: Clock, title: 'Short-term / Conversational', desc: 'Memória da conversa atual. Mantém contexto dentro de uma sessão.', retention: 'Duração da sessão', strategy: 'Sliding window', privacy: 'Isolada por sessão', items: ['Última pergunta do usuário', 'Contexto recuperado', 'Resposta anterior'] },
  { icon: Brain, title: 'Episodic Memory', desc: 'Eventos e interações passadas do agente com o usuário ao longo do tempo.', retention: '90 dias', strategy: 'Sumarização progressiva', privacy: 'Por usuário', items: ['Ticket #4521 resolvido em 3 min', 'Usuário reportou bug no módulo X', 'Preferência: respostas em pt-BR'] },
  { icon: Globe, title: 'Semantic Memory', desc: 'Conhecimento geral e fatos aprendidos pelo agente.', retention: 'Permanente', strategy: 'Embedding + dedup', privacy: 'Compartilhada', items: ['API v3 exige header X-Auth', 'Plano Pro inclui 50 agentes', 'Formato de data: DD/MM/YYYY'] },
  { icon: User, title: 'User Profile Memory', desc: 'Preferências e perfil individual de cada usuário.', retention: 'Até remoção', strategy: 'Key-value + embedding', privacy: 'Individual, LGPD', items: ['Nome: João Silva', 'Cargo: CTO', 'Idioma preferido: pt-BR', 'Último acesso: 2h atrás'] },
  { icon: Users, title: 'Team / Shared Memory', desc: 'Contexto compartilhado entre agentes e equipe.', retention: 'Permanente', strategy: 'Curated + auto-sync', privacy: 'Workspace-wide', items: ['Sprint 14: foco em performance', 'Deploy congelado sexta 18h', 'Novo parceiro: AcmeCorp'] },
  { icon: Database, title: 'External Memory Connectors', desc: 'Conexão com sistemas externos de memória e contexto.', retention: 'Definido pela fonte', strategy: 'Sync periódico', privacy: 'Conforme provider', items: ['Redis — cache de sessão', 'Pinecone — embeddings longos', 'PostgreSQL — histórico relacional'] },
];

export default function MemoryPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Memory Studio" description="Configure camadas de memória para seus agentes de IA" />

      <InfoHint title="Por que memória importa?">
        Agentes sem memória tratam cada conversa como nova. Com memória de curto prazo, mantêm contexto na sessão. Com memória de longo prazo (episódica e semântica), aprendem com interações passadas e personalizam respostas.
      </InfoHint>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {memoryTypes.map((mem, i) => (
          <motion.div key={mem.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="nexus-card">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <mem.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{mem.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{mem.desc}</p>

            <div className="space-y-2 mb-4">
              {[
                { label: 'Retenção', value: mem.retention },
                { label: 'Estratégia', value: mem.strategy },
                { label: 'Privacidade', value: mem.privacy },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="text-foreground font-medium">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border/50 pt-3">
              <p className="text-[11px] text-muted-foreground mb-2">Exemplos de itens salvos:</p>
              <div className="space-y-1.5">
                {mem.items.map((item, j) => (
                  <div key={j} className="flex items-start gap-2 text-xs">
                    <span className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span className="text-foreground/80">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
