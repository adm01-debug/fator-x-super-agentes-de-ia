import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Plus, GitBranch, ArrowRight, User, Search, Brain, Shield, CheckCircle, Wrench, FileText } from "lucide-react";
import { motion } from "framer-motion";

const templates = [
  { name: 'Atendimento ao Cliente', steps: ['Classificar', 'Buscar KB', 'Responder', 'Escalar se necessário', 'Registrar'] },
  { name: 'Prospecção Outbound', steps: ['Novo lead', 'Enriquecer perfil', 'Pesquisar empresa', 'Gerar email', 'Enviar', 'CRM update'] },
  { name: 'Due Diligence', steps: ['Receber caso', 'Buscar regulamentação', 'Analisar documentos', 'Gerar parecer', 'Aprovação humana'] },
  { name: 'Suporte Técnico L2', steps: ['Triagem', 'Diagnóstico', 'Code analysis', 'Solução', 'Validar', 'Documentar'] },
];

const stepIcons: Record<string, React.ElementType> = {
  Classificar: Brain, 'Buscar KB': Search, Responder: FileText, 'Escalar se necessário': User, Registrar: CheckCircle,
  'Novo lead': User, 'Enriquecer perfil': Search, 'Pesquisar empresa': Search, 'Gerar email': FileText, Enviar: ArrowRight, 'CRM update': CheckCircle,
  'Receber caso': FileText, 'Buscar regulamentação': Search, 'Analisar documentos': Brain, 'Gerar parecer': FileText, 'Aprovação humana': Shield,
  Triagem: Brain, Diagnóstico: Search, 'Code analysis': Wrench, Solução: FileText, Validar: CheckCircle, Documentar: FileText,
};

export default function WorkflowsPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Workflow Studio"
        description="Crie fluxos de orquestração multi-agente e automações complexas"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90"><Plus className="h-4 w-4" /> Novo workflow</Button>}
      />

      <InfoHint title="Workflows multiagente">
        Workflows permitem orquestrar múltiplos agentes especializados em sequência ou paralelo. Defina handoffs, checkpoints humanos e guardrails entre etapas para tarefas complexas.
      </InfoHint>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((wf, i) => (
          <motion.div key={wf.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="nexus-card cursor-pointer">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{wf.name}</h3>
                <p className="text-[11px] text-muted-foreground">{wf.steps.length} etapas</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
              {wf.steps.map((step, j) => {
                const Icon = stepIcons[step] || Brain;
                return (
                  <div key={j} className="flex items-center gap-1.5 shrink-0">
                    <div className="flex flex-col items-center">
                      <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center">
                        <Icon className="h-4 w-4 text-foreground" />
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-1 text-center max-w-[60px] truncate">{step}</p>
                    </div>
                    {j < wf.steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 mt-[-12px]" />}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
