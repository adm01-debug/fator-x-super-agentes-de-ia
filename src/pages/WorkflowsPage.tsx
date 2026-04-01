import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, GitBranch, ArrowRight, Brain, Search, Shield, CheckCircle, Wrench, FileText, Play, Trash2, LayoutGrid, Network, Save, FolderOpen, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { WorkflowCanvas, type CanvasNode, type CanvasEdge } from "@/components/workflows/WorkflowCanvas";
import { useWorkflowPersistence } from "@/hooks/use-workflow-persistence";

interface Workflow {
  id: string;
  name: string;
  steps: string[];
  status: 'draft' | 'active';
  createdAt: string;
}

const stepIcons: Record<string, React.ElementType> = {
  Classificar: Brain, 'Buscar KB': Search, Responder: FileText, 'Escalar se necessário': Shield, Registrar: CheckCircle,
  'Novo lead': FileText, 'Enriquecer perfil': Search, 'Pesquisar empresa': Search, 'Gerar email': FileText, Enviar: ArrowRight, 'CRM update': CheckCircle,
  'Receber caso': FileText, 'Buscar regulamentação': Search, 'Analisar documentos': Brain, 'Gerar parecer': FileText, 'Aprovação humana': Shield,
  Triagem: Brain, Diagnóstico: Search, 'Code analysis': Wrench, Solução: FileText, Validar: CheckCircle, Documentar: FileText,
};

const defaultTemplates: Workflow[] = [
  { id: 't1', name: 'Atendimento ao Cliente', steps: ['Classificar', 'Buscar KB', 'Responder', 'Escalar se necessário', 'Registrar'], status: 'active', createdAt: '2026-03-28' },
  { id: 't2', name: 'Prospecção Outbound', steps: ['Novo lead', 'Enriquecer perfil', 'Pesquisar empresa', 'Gerar email', 'Enviar', 'CRM update'], status: 'active', createdAt: '2026-03-27' },
  { id: 't3', name: 'Due Diligence', steps: ['Receber caso', 'Buscar regulamentação', 'Analisar documentos', 'Gerar parecer', 'Aprovação humana'], status: 'draft', createdAt: '2026-03-26' },
  { id: 't4', name: 'Suporte Técnico L2', steps: ['Triagem', 'Diagnóstico', 'Code analysis', 'Solução', 'Validar', 'Documentar'], status: 'draft', createdAt: '2026-03-25' },
];

const defaultCanvasNodes: CanvasNode[] = [
  { id: 'n1', type: 'planner', label: 'Planner', x: 60, y: 80 },
  { id: 'n2', type: 'researcher', label: 'Researcher', x: 300, y: 40 },
  { id: 'n3', type: 'retriever', label: 'Retriever', x: 300, y: 180 },
  { id: 'n4', type: 'critic', label: 'Critic', x: 540, y: 110 },
  { id: 'n5', type: 'executor', label: 'Executor', x: 760, y: 110 },
];

const defaultCanvasEdges: CanvasEdge[] = [
  { from: 'n1', to: 'n2' },
  { from: 'n1', to: 'n3' },
  { from: 'n2', to: 'n4' },
  { from: 'n3', to: 'n4' },
  { from: 'n4', to: 'n5' },
];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>(defaultTemplates);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSteps, setNewSteps] = useState('');
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>(defaultCanvasNodes);
  const [canvasEdges, setCanvasEdges] = useState<CanvasEdge[]>(defaultCanvasEdges);
  const [canvasName, setCanvasName] = useState('Meu Pipeline');
  const persistence = useWorkflowPersistence();

  const handleSave = async () => {
    if (!canvasName.trim()) { toast.error('Nome é obrigatório'); return; }
    const id = await persistence.saveCanvas(canvasName, canvasNodes, canvasEdges, persistence.selectedId);
    if (id) persistence.setSelectedId(id);
  };

  const handleLoad = (workflowId: string) => {
    const data = persistence.loadCanvas(workflowId);
    if (data) {
      setCanvasNodes(data.nodes);
      setCanvasEdges(data.edges);
      const wf = persistence.workflows.find(w => w.id === workflowId);
      if (wf) setCanvasName(wf.name);
      persistence.setSelectedId(workflowId);
      toast.success('Canvas carregado!');
    }
  };

  const handleCreate = () => {
    if (!newName.trim()) { toast.error('Nome é obrigatório'); return; }
    const steps = newSteps.split(',').map(s => s.trim()).filter(Boolean);
    if (steps.length < 2) { toast.error('Adicione pelo menos 2 etapas separadas por vírgula'); return; }
    setWorkflows(prev => [{
      id: Date.now().toString(),
      name: newName.trim(),
      steps,
      status: 'draft',
      createdAt: new Date().toISOString().split('T')[0],
    }, ...prev]);
    toast.success('Workflow criado!');
    setDialogOpen(false);
    setNewName(''); setNewSteps('');
  };

  const handleDelete = (id: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== id));
    toast.success('Workflow removido');
  };

  const handleToggleStatus = (id: string) => {
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, status: w.status === 'active' ? 'draft' : 'active' } : w));
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Workflow Studio"
        description="Crie fluxos de orquestração multi-agente e automações complexas"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90"><Plus className="h-4 w-4" /> Novo workflow</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader><DialogTitle>Novo Workflow</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Pipeline de Onboarding" className="bg-secondary/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Etapas (separadas por vírgula) *</Label>
                  <Input value={newSteps} onChange={e => setNewSteps(e.target.value)} placeholder="Classificar, Processar, Validar, Notificar" className="bg-secondary/50" />
                  <p className="text-[10px] text-muted-foreground">Mínimo 2 etapas. Ex: Triagem, Diagnóstico, Solução</p>
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
        </TabsList>

        <TabsContent value="canvas" className="space-y-4">
          <InfoHint title="Canvas de Orquestração">
            Arraste nodes para posicionar, conecte-os pelo ponto azul à direita. Clique numa linha para removê-la. Salve seu pipeline no banco de dados para reutilizá-lo.
          </InfoHint>

          {/* Save / Load bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              value={canvasName}
              onChange={e => setCanvasName(e.target.value)}
              placeholder="Nome do pipeline"
              className="max-w-[220px] bg-secondary/50 text-sm"
            />
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={persistence.saving}>
              {persistence.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {persistence.selectedId ? 'Atualizar' : 'Salvar'}
            </Button>

            {persistence.workflows.length > 0 && (
              <Select onValueChange={handleLoad} value={persistence.selectedId ?? undefined}>
                <SelectTrigger className="max-w-[220px] text-sm">
                  <FolderOpen className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  <SelectValue placeholder="Carregar workflow..." />
                </SelectTrigger>
                <SelectContent>
                  {persistence.workflows.map(wf => (
                    <SelectItem key={wf.id} value={wf.id}>{wf.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {persistence.selectedId && (
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                Salvo no banco
              </Badge>
            )}
          </div>

          <WorkflowCanvas nodes={canvasNodes} edges={canvasEdges} onNodesChange={setCanvasNodes} onEdgesChange={setCanvasEdges} />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <InfoHint title="Workflows multiagente">
            Workflows permitem orquestrar múltiplos agentes especializados em sequência ou paralelo. Defina handoffs, checkpoints humanos e guardrails entre etapas para tarefas complexas.
          </InfoHint>

          <div className="grid gap-4 md:grid-cols-2">
            <AnimatePresence>
              {workflows.map((wf, i) => (
                <motion.div key={wf.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ delay: i * 0.06 }} className="nexus-card group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <GitBranch className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{wf.name}</h3>
                        <p className="text-[11px] text-muted-foreground">{wf.steps.length} etapas • {wf.createdAt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={`text-[9px] ${wf.status === 'active' ? 'border-emerald-500/30 text-emerald-400' : 'border-muted-foreground/30'}`}>
                        {wf.status === 'active' ? 'Ativo' : 'Rascunho'}
                      </Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleToggleStatus(wf.id)}>
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDelete(wf.id)}>
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
                            <p className="text-[9px] text-muted-foreground mt-1 text-center max-w-[60px] truncate">{step}</p>
                          </div>
                          {j < wf.steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 mt-[-12px]" />}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
