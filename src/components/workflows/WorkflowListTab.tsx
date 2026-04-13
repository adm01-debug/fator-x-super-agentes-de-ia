import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GitBranch, ArrowRight, Brain, Search, Shield, CheckCircle,
  Wrench, FileText, Play, Trash2, Loader2,
} from 'lucide-react';
import { InfoHint } from '@/components/shared/InfoHint';

const stepIcons: Record<string, React.ElementType> = {
  Classificar: Brain,
  'Buscar KB': Search,
  Responder: FileText,
  'Escalar se necessário': Shield,
  Registrar: CheckCircle,
  'Novo lead': FileText,
  'Enriquecer perfil': Search,
  'Pesquisar empresa': Search,
  'Gerar email': FileText,
  Enviar: ArrowRight,
  'CRM update': CheckCircle,
  'Receber caso': FileText,
  'Buscar regulamentação': Search,
  'Analisar documentos': Brain,
  'Gerar parecer': FileText,
  'Aprovação humana': Shield,
  Triagem: Brain,
  Diagnóstico: Search,
  'Code analysis': Wrench,
  Solução: FileText,
  Validar: CheckCircle,
  Documentar: FileText,
};

interface Workflow {
  id: string;
  name: string;
  steps: string[];
  status: 'draft' | 'active';
  createdAt: string;
}

interface WorkflowListTabProps {
  workflows: Workflow[];
  executing: string | null;
  onToggleStatus: (id: string) => void;
  onExecute: (wf: Workflow) => void;
  onDelete: (id: string) => void;
}

export function WorkflowListTab({ workflows, executing, onToggleStatus, onExecute, onDelete }: WorkflowListTabProps) {
  return (
    <div className="space-y-4">
      <InfoHint title="Workflows multiagente">
        Workflows permitem orquestrar múltiplos agentes especializados em sequência ou paralelo.
        Defina handoffs, checkpoints humanos e guardrails entre etapas para tarefas complexas.
      </InfoHint>

      <div className="grid gap-4 md:grid-cols-2">
        {workflows.map((wf) => (
          <div key={wf.id} className="nexus-card group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <GitBranch className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{wf.name}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {wf.steps.length} etapas • {wf.createdAt}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge
                  variant="outline"
                  className={`text-[11px] ${wf.status === 'active' ? 'border-nexus-emerald/30 text-nexus-emerald' : 'border-muted-foreground/30'}`}
                >
                  {wf.status === 'active' ? 'Ativo' : 'Rascunho'}
                </Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onToggleStatus(wf.id)}>
                  <Play className="h-3 w-3" />
                </Button>
                <Button
                  size="icon" variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-primary"
                  onClick={() => onExecute(wf)} disabled={executing === wf.id} title="Executar workflow"
                >
                  {executing === wf.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => onDelete(wf.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
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
                      <p className="text-[11px] text-muted-foreground mt-1 text-center max-w-[60px] truncate">{step}</p>
                    </div>
                    {j < wf.steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 mt-[-12px]" />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
