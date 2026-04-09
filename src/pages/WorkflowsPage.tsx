import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { InfoHint } from '@/components/shared/InfoHint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  GitBranch,
  ArrowRight,
  Brain,
  Search,
  Shield,
  CheckCircle,
  Wrench,
  FileText,
  Play,
  Trash2,
  LayoutGrid,
  Network,
  Save,
  FolderOpen,
  Loader2,
  Clock,
  Calendar,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WorkflowCanvas,
  type CanvasNode,
  type CanvasEdge,
} from '@/components/workflows/WorkflowCanvas';
import { WorkflowTemplatesGallery } from '@/components/workflows/WorkflowTemplatesGallery';
import { useWorkflowPersistence } from '@/hooks/use-workflow-persistence';
import { useWorkflowKeyboard } from '@/hooks/useWorkflowKeyboard';
import { useWorkflowAutosave } from '@/hooks/useWorkflowAutosave';
import { workflowSchema } from '@/lib/validations/agentSchema';
import {
  listWorkflows as listWorkflowsService,
  saveWorkflow as saveWorkflowService,
  deleteWorkflow as deleteWorkflowService,
  toggleWorkflowStatus,
  executeWorkflow,
  listWorkflowRuns,
} from '@/services/workflowsService';
import {
  createSchedule,
  listSchedules,
  deleteSchedule,
  updateSchedule,
} from '@/services/cronSchedulerService';
import { AccessControl } from '@/components/rbac/AccessControl';

interface Workflow {
  id: string;
  name: string;
  steps: string[];
  status: 'draft' | 'active';
  createdAt: string;
}

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

const defaultTemplates: Workflow[] = [
  {
    id: 't1',
    name: 'Atendimento ao Cliente',
    steps: ['Classificar', 'Buscar KB', 'Responder', 'Escalar se necessário', 'Registrar'],
    status: 'active',
    createdAt: '2026-03-28',
  },
  {
    id: 't2',
    name: 'Prospecção Outbound',
    steps: [
      'Novo lead',
      'Enriquecer perfil',
      'Pesquisar empresa',
      'Gerar email',
      'Enviar',
      'CRM update',
    ],
    status: 'active',
    createdAt: '2026-03-27',
  },
  {
    id: 't3',
    name: 'Due Diligence',
    steps: [
      'Receber caso',
      'Buscar regulamentação',
      'Analisar documentos',
      'Gerar parecer',
      'Aprovação humana',
    ],
    status: 'draft',
    createdAt: '2026-03-26',
  },
  {
    id: 't4',
    name: 'Suporte Técnico L2',
    steps: ['Triagem', 'Diagnóstico', 'Code analysis', 'Solução', 'Validar', 'Documentar'],
    status: 'draft',
    createdAt: '2026-03-25',
  },
];

const defaultCanvasNodes: CanvasNode[] = [
  { id: 'n1', type: 'planner', position: { x: 60, y: 80 }, data: { label: 'Planner' } },
  { id: 'n2', type: 'researcher', position: { x: 300, y: 40 }, data: { label: 'Researcher' } },
  { id: 'n3', type: 'retriever', position: { x: 300, y: 180 }, data: { label: 'Retriever' } },
  { id: 'n4', type: 'critic', position: { x: 540, y: 110 }, data: { label: 'Critic' } },
  { id: 'n5', type: 'executor', position: { x: 760, y: 110 }, data: { label: 'Executor' } },
];

const defaultCanvasEdges: CanvasEdge[] = [
  { id: 'e1', source: 'n1', target: 'n2' },
  { id: 'e2', source: 'n1', target: 'n3' },
  { id: 'e3', source: 'n2', target: 'n4' },
  { id: 'e4', source: 'n3', target: 'n4' },
  { id: 'e5', source: 'n4', target: 'n5' },
];

export default function WorkflowsPage() {
  // Workflows loaded from Supabase
  const queryClient = useQueryClient();
  const { data: workflows = defaultTemplates } = useQuery({
    queryKey: ['workflows_list'],
    queryFn: async () => {
      try {
        const wfs = await listWorkflowsService();
        if (wfs.length === 0) return defaultTemplates;
        return wfs.map((w) => ({
          id: w.id,
          name: w.name,
          steps: w.nodes.map((n) => String(n.data?.label || n.type)),
          status: (w.status as 'draft' | 'active') ?? 'draft',
          createdAt: w.created_at ? new Date(w.created_at).toISOString().split('T')[0] : '',
        }));
      } catch {
        return defaultTemplates;
      }
    },
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSteps, setNewSteps] = useState('');
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>(defaultCanvasNodes);
  const [canvasEdges, setCanvasEdges] = useState<CanvasEdge[]>(defaultCanvasEdges);
  const [canvasName, setCanvasName] = useState('Meu Pipeline');
  const persistence = useWorkflowPersistence();

  const handleSave = async () => {
    if (!canvasName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    const id = await persistence.saveCanvas(
      canvasName,
      canvasNodes,
      canvasEdges,
      persistence.selectedId,
    );
    if (id) persistence.setSelectedId(id);
  };

  // Global keyboard shortcuts: Cmd/Ctrl+S to save
  useWorkflowKeyboard({
    onSave: handleSave,
  });

  // Debounced autosave (3s after last change) — only when an existing
  // workflow is loaded so we don't create accidental drafts
  const { lastSavedAt: autosavedAt, isSaving: autoSaving } = useWorkflowAutosave({
    watchValue: { nodes: canvasNodes, edges: canvasEdges, name: canvasName },
    enabled: !!persistence.selectedId,
    delay: 3000,
    onSave: handleSave,
  });

  const handleLoad = async (workflowId: string) => {
    const data = await persistence.loadCanvas(workflowId);
    if (data) {
      setCanvasNodes(data.nodes);
      setCanvasEdges(data.edges);
      const wf = persistence.workflows.find((w) => w.id === workflowId);
      if (wf) setCanvasName(wf.name);
      persistence.setSelectedId(workflowId);
      toast.success('Canvas carregado!');
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!persistence.selectedId) return;
    const ok = await persistence.deleteCanvas(persistence.selectedId);
    if (ok) {
      setCanvasNodes(defaultCanvasNodes);
      setCanvasEdges(defaultCanvasEdges);
      setCanvasName('Meu Pipeline');
    }
  };

  const handleCreate = async () => {
    const steps = newSteps
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const result = workflowSchema.safeParse({ name: newName, steps });
    if (!result.success) {
      toast.error(result.error.errors[0]?.message || 'Dados inválidos');
      return;
    }
    try {
      await saveWorkflowService({
        name: newName.trim(),
        status: 'draft',
        nodes: steps.map((name, i) => ({
          id: `step_${i}`,
          type: 'executor',
          position: { x: i * 200, y: 100 },
          data: { label: name },
        })),
        edges: steps
          .slice(1)
          .map((_, i) => ({ id: `e_${i}`, source: `step_${i}`, target: `step_${i + 1}` })),
      });
      toast.success('Workflow salvo no banco!');
      setDialogOpen(false);
      setNewName('');
      setNewSteps('');
      queryClient.invalidateQueries({ queryKey: ['workflows_list'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    }
  };

  const handleDelete = async (id: string) => {
    if (id.includes('-')) {
      try {
        await deleteWorkflowService(id);
      } catch {
        /* template, not in DB */
      }
      queryClient.invalidateQueries({ queryKey: ['workflows_list'] });
    }
    toast.success('Workflow removido');
  };

  const handleToggleStatus = async (id: string) => {
    if (id.includes('-')) {
      const wf = workflows.find((w) => w.id === id);
      if (wf) {
        await toggleWorkflowStatus(id, wf.status);
        queryClient.invalidateQueries({ queryKey: ['workflows_list'] });
      }
    }
  };

  const [executing, setExecuting] = useState<string | null>(null);
  const handleExecute = async (wf: Workflow) => {
    setExecuting(wf.id);
    try {
      const result = await executeWorkflow(wf.id, wf.name, wf.steps);
      toast.success(
        `Workflow executado! ${result.stepsExecuted} etapas • $${result.cost.toFixed(4)}`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Estúdio de Workflows"
        description="Crie fluxos de orquestração multi-agente e automações complexas"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <AccessControl permission="workflows.create">
                <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
                  <Plus className="h-4 w-4" /> Novo workflow
                </Button>
              </AccessControl>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Novo Workflow</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Pipeline de Onboarding"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Etapas (separadas por vírgula) *</Label>
                  <Input
                    value={newSteps}
                    onChange={(e) => setNewSteps(e.target.value)}
                    placeholder="Classificar, Processar, Validar, Notificar"
                    className="bg-secondary/50"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Mínimo 2 etapas. Ex: Triagem, Diagnóstico, Solução
                  </p>
                </div>
                <Button
                  onClick={handleCreate}
                  className="w-full nexus-gradient-bg text-primary-foreground"
                >
                  Criar Workflow
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="canvas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="canvas" className="gap-1.5">
            <Network className="h-3.5 w-3.5" /> Canvas Visual
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" /> Lista
          </TabsTrigger>
          <TabsTrigger value="runs" className="gap-1.5">
            <Play className="h-3.5 w-3.5" /> Execuções
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Agendamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="canvas" className="space-y-4">
          <InfoHint title="Canvas de Orquestração">
            Arraste nodes para posicionar, conecte-os pelo ponto azul à direita. Clique numa linha
            para removê-la. Salve seu pipeline no banco de dados para reutilizá-lo.
          </InfoHint>

          {/* Save / Load bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              value={canvasName}
              onChange={(e) => setCanvasName(e.target.value)}
              placeholder="Nome do pipeline"
              className="max-w-[220px] bg-secondary/50 text-sm"
            />
            <WorkflowTemplatesGallery />
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSave}
              disabled={persistence.saving}
            >
              {persistence.saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {persistence.selectedId ? 'Atualizar' : 'Salvar'}
            </Button>
            {persistence.selectedId && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                {autoSaving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                  </>
                ) : autosavedAt ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-nexus-emerald" /> Auto-salvo{' '}
                    {new Date(autosavedAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </>
                ) : (
                  <span className="opacity-50">⌘S salva · auto-save 3s</span>
                )}
              </span>
            )}

            {persistence.workflows.length > 0 && (
              <Select onValueChange={handleLoad} value={persistence.selectedId ?? undefined}>
                <SelectTrigger className="max-w-[220px] text-sm">
                  <FolderOpen className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  <SelectValue placeholder="Carregar workflow..." />
                </SelectTrigger>
                <SelectContent>
                  {persistence.workflows.map((wf) => (
                    <SelectItem key={wf.id} value={wf.id}>
                      {wf.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {persistence.selectedId && (
              <>
                <Badge variant="outline" className="text-[11px] border-primary/30 text-primary">
                  Salvo no banco
                </Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Deletar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Deletar workflow?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação é irreversível. O workflow será removido permanentemente do banco
                        de dados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteWorkflow}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Deletar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>

          <WorkflowCanvas />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
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
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={() => handleToggleStatus(wf.id)}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-primary"
                      onClick={() => handleExecute(wf)}
                      disabled={executing === wf.id}
                      title="Executar workflow"
                    >
                      {executing === wf.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={() => handleDelete(wf.id)}
                    >
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
                          <p className="text-[11px] text-muted-foreground mt-1 text-center max-w-[60px] truncate">
                            {step}
                          </p>
                        </div>
                        {j < wf.steps.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 mt-[-12px]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <WorkflowRunsHistory />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <WorkflowScheduler workflows={workflows as unknown as Array<Record<string, unknown>>} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WorkflowRunsHistory() {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['workflow_runs'],
    queryFn: () => listWorkflowRuns(),
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (runs.length === 0)
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Nenhuma execução registrada. Execute um workflow salvo no banco.
      </div>
    );

  return (
    <div className="space-y-3">
      {runs.map((run) => {
        const wfData = run.workflows as Record<string, unknown> | null;
        return (
          <div key={String(run.id)} className="nexus-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {(wfData?.name as string) || 'Workflow'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {String(run.total_steps)} etapas • {String(run.current_step || 0)} tokens
                  {run.started_at &&
                    ` • ${new Date(String(run.started_at)).toLocaleString('pt-BR')}`}
                </p>
              </div>
              <Badge
                variant={
                  run.status === 'completed'
                    ? 'default'
                    : run.status === 'failed'
                      ? 'destructive'
                      : 'outline'
                }
                className="text-[11px]"
              >
                {String(run.status)}
              </Badge>
            </div>
            {run.error && <p className="text-xs text-destructive mt-2">{String(run.error)}</p>}
          </div>
        );
      })}
    </div>
  );
}

function WorkflowScheduler({ workflows }: { workflows: Array<Record<string, unknown>> }) {
  const queryClient = useQueryClient();
  const { data: schedules = [] } = useQuery({
    queryKey: ['workflow-schedules'],
    queryFn: () => listSchedules(),
  });
  const [selWf, setSelWf] = useState('');
  const [selCron, setSelCron] = useState('daily');

  const cronLabels: Record<string, { label: string; cron: string; next: () => string }> = {
    'every-5m': {
      label: 'A cada 5 min',
      cron: '*/5 * * * *',
      next: () => {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 5);
        return d.toLocaleString('pt-BR');
      },
    },
    hourly: {
      label: 'A cada hora',
      cron: '0 * * * *',
      next: () => {
        const d = new Date();
        d.setHours(d.getHours() + 1, 0);
        return d.toLocaleString('pt-BR');
      },
    },
    daily: {
      label: 'Diariamente (9h)',
      cron: '0 9 * * *',
      next: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0);
        return d.toLocaleString('pt-BR');
      },
    },
    weekly: {
      label: 'Semanal (seg 9h)',
      cron: '0 9 * * 1',
      next: () => {
        const d = new Date();
        d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
        d.setHours(9, 0);
        return d.toLocaleString('pt-BR');
      },
    },
  };

  const handleAdd = async () => {
    if (!selWf) {
      toast.error('Selecione um workflow');
      return;
    }
    const cronInfo = cronLabels[selCron];
    const wf = workflows.find((w) => String(w.id) === selWf);
    try {
      await createSchedule({
        name: `Agendamento: ${String(wf?.name || 'Workflow')}`,
        cron_expression: cronInfo.cron,
        timezone: 'America/Sao_Paulo',
        target_type: 'workflow',
        target_id: selWf,
        target_config: {},
      });
      queryClient.invalidateQueries({ queryKey: ['workflow-schedules'] });
      toast.success('Agendamento criado!');
      setSelWf('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar agendamento');
    }
  };

  const handleToggle = async (id: string, currentlyEnabled: boolean) => {
    try {
      await updateSchedule(id, { status: currentlyEnabled ? 'paused' : 'active' });
      queryClient.invalidateQueries({ queryKey: ['workflow-schedules'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar agendamento');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await deleteSchedule(id);
      queryClient.invalidateQueries({ queryKey: ['workflow-schedules'] });
      toast.success('Agendamento removido');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover agendamento');
    }
  };

  return (
    <div className="space-y-4">
      <InfoHint title="Agendamento de Workflows">
        Configure execuções automáticas de workflows em intervalos regulares. Os agendamentos são
        persistidos no banco de dados e executados pelo serviço de cron.
      </InfoHint>

      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Novo Agendamento
        </h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-[180px]">
            <Label className="text-xs">Workflow</Label>
            <Select value={selWf} onValueChange={setSelWf}>
              <SelectTrigger className="bg-secondary/50">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {workflows.map((wf) => (
                  <SelectItem key={String(wf.id)} value={String(wf.id)}>
                    {String(wf.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[160px]">
            <Label className="text-xs">Frequência</Label>
            <Select value={selCron} onValueChange={setSelCron}>
              <SelectTrigger className="bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(cronLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} className="gap-1.5 nexus-gradient-bg text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Agendar
          </Button>
        </div>
      </div>

      {schedules.length > 0 && (
        <div className="space-y-2">
          {schedules.map((s: Record<string, unknown>) => {
            const isActive = s.status === 'active';
            const wf = workflows.find((w) => String(w.id) === String(s.target_id));
            const nextRun = s.next_run_at
              ? new Date(String(s.next_run_at)).toLocaleString('pt-BR')
              : '—';
            return (
              <div key={String(s.id)} className="nexus-card flex items-center gap-3">
                <Calendar
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {String(s.name || wf?.name || 'Workflow')}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {String(s.cron_expression)} • Próxima: {nextRun}
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={() => handleToggle(String(s.id), isActive)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => handleRemove(String(s.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {schedules.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Nenhum agendamento configurado.
        </div>
      )}
    </div>
  );
}
