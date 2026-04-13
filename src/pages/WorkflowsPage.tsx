import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Play, LayoutGrid, Network, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { workflowSchema } from '@/lib/validations/agentSchema';
import {
  listWorkflows as listWorkflowsService,
  saveWorkflow as saveWorkflowService,
  deleteWorkflow as deleteWorkflowService,
  toggleWorkflowStatus,
  executeWorkflow,
} from '@/services/workflowsService';
import { AccessControl } from '@/components/rbac/AccessControl';
import { WorkflowCanvasTab } from '@/components/workflows/WorkflowCanvasTab';
import { WorkflowListTab } from '@/components/workflows/WorkflowListTab';
import { WorkflowRunsHistory } from '@/components/workflows/WorkflowRunsHistory';
import { WorkflowSchedulerTab } from '@/components/workflows/WorkflowSchedulerTab';

interface Workflow {
  id: string;
  name: string;
  steps: string[];
  status: 'draft' | 'active';
  createdAt: string;
}

const defaultTemplates: Workflow[] = [
  { id: 't1', name: 'Atendimento ao Cliente', steps: ['Classificar', 'Buscar KB', 'Responder', 'Escalar se necessário', 'Registrar'], status: 'active', createdAt: '2026-03-28' },
  { id: 't2', name: 'Prospecção Outbound', steps: ['Novo lead', 'Enriquecer perfil', 'Pesquisar empresa', 'Gerar email', 'Enviar', 'CRM update'], status: 'active', createdAt: '2026-03-27' },
  { id: 't3', name: 'Due Diligence', steps: ['Receber caso', 'Buscar regulamentação', 'Analisar documentos', 'Gerar parecer', 'Aprovação humana'], status: 'draft', createdAt: '2026-03-26' },
  { id: 't4', name: 'Suporte Técnico L2', steps: ['Triagem', 'Diagnóstico', 'Code analysis', 'Solução', 'Validar', 'Documentar'], status: 'draft', createdAt: '2026-03-25' },
];

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const { data: workflows = defaultTemplates } = useQuery({
    queryKey: ['workflows_list'],
    queryFn: async () => {
      try {
        const wfs = await listWorkflowsService();
        if (wfs.length === 0) return defaultTemplates;
        return wfs.map((w) => ({
          id: w.id, name: w.name,
          steps: w.nodes.map((n) => String(n.data?.label || n.type)),
          status: (w.status as 'draft' | 'active') ?? 'draft',
          createdAt: w.created_at ? new Date(w.created_at).toISOString().split('T')[0] : '',
        }));
      } catch { return defaultTemplates; }
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSteps, setNewSteps] = useState('');
  const [executing, setExecuting] = useState<string | null>(null);

  const handleCreate = async () => {
    const steps = newSteps.split(',').map((s) => s.trim()).filter(Boolean);
    const result = workflowSchema.safeParse({ name: newName, steps });
    if (!result.success) { toast.error(result.error.errors[0]?.message || 'Dados inválidos'); return; }
    try {
      await saveWorkflowService({
        name: newName.trim(), status: 'draft',
        nodes: steps.map((name, i) => ({ id: `step_${i}`, type: 'executor', position: { x: i * 200, y: 100 }, data: { label: name } })),
        edges: steps.slice(1).map((_, i) => ({ id: `e_${i}`, source: `step_${i}`, target: `step_${i + 1}` })),
      });
      toast.success('Workflow salvo no banco!');
      setDialogOpen(false); setNewName(''); setNewSteps('');
      queryClient.invalidateQueries({ queryKey: ['workflows_list'] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro inesperado'); }
  };

  const handleDelete = async (id: string) => {
    if (id.includes('-')) { try { await deleteWorkflowService(id); } catch { /* template */ } queryClient.invalidateQueries({ queryKey: ['workflows_list'] }); }
    toast.success('Workflow removido');
  };

  const handleToggleStatus = async (id: string) => {
    if (id.includes('-')) {
      const wf = workflows.find((w) => w.id === id);
      if (wf) { await toggleWorkflowStatus(id, wf.status); queryClient.invalidateQueries({ queryKey: ['workflows_list'] }); }
    }
  };

  const handleExecute = async (wf: Workflow) => {
    setExecuting(wf.id);
    try {
      const result = await executeWorkflow(wf.id, wf.name, wf.steps);
      toast.success(`Workflow executado! ${result.stepsExecuted} etapas • $${result.cost.toFixed(4)}`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro inesperado'); }
    finally { setExecuting(null); }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader title="Estúdio de Workflows" description="Crie fluxos de orquestração multi-agente e automações complexas"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <AccessControl permission="workflows.create">
                <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90"><Plus className="h-4 w-4" /> Novo workflow</Button>
              </AccessControl>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader><DialogTitle>Novo Workflow</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Pipeline de Onboarding" className="bg-secondary/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Etapas (separadas por vírgula) *</Label>
                  <Input value={newSteps} onChange={(e) => setNewSteps(e.target.value)} placeholder="Classificar, Processar, Validar, Notificar" className="bg-secondary/50" />
                  <p className="text-[11px] text-muted-foreground">Mínimo 2 etapas. Ex: Triagem, Diagnóstico, Solução</p>
                </div>
                <Button onClick={handleCreate} className="w-full nexus-gradient-bg text-primary-foreground">Criar Workflow</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="canvas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="canvas" className="gap-1.5"><Network className="h-3.5 w-3.5" /> Canvas Visual</TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Lista</TabsTrigger>
          <TabsTrigger value="runs" className="gap-1.5"><Play className="h-3.5 w-3.5" /> Execuções</TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Agendamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="canvas"><WorkflowCanvasTab /></TabsContent>
        <TabsContent value="list">
          <WorkflowListTab workflows={workflows} executing={executing} onToggleStatus={handleToggleStatus} onExecute={handleExecute} onDelete={handleDelete} />
        </TabsContent>
        <TabsContent value="runs"><WorkflowRunsHistory /></TabsContent>
        <TabsContent value="schedule">
          <WorkflowSchedulerTab workflows={workflows.map(w => ({ id: w.id, name: w.name }))} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
