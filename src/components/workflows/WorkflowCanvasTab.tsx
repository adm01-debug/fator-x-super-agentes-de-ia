import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { InfoHint } from '@/components/shared/InfoHint';
import { WorkflowCanvas, type CanvasNode, type CanvasEdge } from '@/components/workflows/WorkflowCanvas';
import { WorkflowTemplatesGallery } from '@/components/workflows/WorkflowTemplatesGallery';
import { useWorkflowPersistence } from '@/hooks/use-workflow-persistence';
import { useWorkflowKeyboard } from '@/hooks/useWorkflowKeyboard';
import { useWorkflowAutosave } from '@/hooks/useWorkflowAutosave';
import { Save, FolderOpen, Loader2, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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

export function WorkflowCanvasTab() {
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>(defaultCanvasNodes);
  const [canvasEdges, setCanvasEdges] = useState<CanvasEdge[]>(defaultCanvasEdges);
  const [canvasName, setCanvasName] = useState('Meu Pipeline');
  const persistence = useWorkflowPersistence();

  const handleSave = async () => {
    if (!canvasName.trim()) { toast.error('Nome é obrigatório'); return; }
    const id = await persistence.saveCanvas(canvasName, canvasNodes, canvasEdges, persistence.selectedId);
    if (id) persistence.setSelectedId(id);
  };

  useWorkflowKeyboard({ onSave: handleSave });

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

  return (
    <div className="space-y-4">
      <InfoHint title="Canvas de Orquestração">
        Arraste nodes para posicionar, conecte-os pelo ponto azul à direita. Clique numa linha
        para removê-la. Salve seu pipeline no banco de dados para reutilizá-lo.
      </InfoHint>

      <div className="flex items-center gap-3 flex-wrap">
        <Input value={canvasName} onChange={(e) => setCanvasName(e.target.value)} placeholder="Nome do pipeline" className="max-w-[220px] bg-secondary/50 text-sm" />
        <WorkflowTemplatesGallery />
        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={persistence.saving}>
          {persistence.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {persistence.selectedId ? 'Atualizar' : 'Salvar'}
        </Button>
        {persistence.selectedId && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            {autoSaving ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</>
            ) : autosavedAt ? (
              <><CheckCircle className="h-3 w-3 text-nexus-emerald" /> Auto-salvo {new Date(autosavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
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
                <SelectItem key={wf.id} value={wf.id}>{wf.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {persistence.selectedId && (
          <>
            <Badge variant="outline" className="text-[11px] border-primary/30 text-primary">Salvo no banco</Badge>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Deletar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deletar workflow?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação é irreversível. O workflow será removido permanentemente do banco de dados.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteWorkflow} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deletar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      <WorkflowCanvas />
    </div>
  );
}
