import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { useAgentWorkflows, useWorkflowRuns, runWorkflow, type AgentWorkflow } from '@/hooks/useAgentWorkflows';
import { useWorkspaceId } from '@/hooks/use-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Save, Play, Trash2, Loader2 } from 'lucide-react';
import { nodeTypes, NODE_PALETTE } from '../orchestrator/nodes/CustomNodes';
import { toast } from 'sonner';
import { SectionTitle } from '../ui';

export function OrchestratorModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const { data: workspaceId } = useWorkspaceId();
  const { workflows, createWorkflow, updateWorkflow, deleteWorkflow } = useAgentWorkflows(agent.id);

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = workflows.data?.find((w) => w.id === activeId);
  const { data: runs } = useWorkflowRuns(activeId || undefined);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [testInput, setTestInput] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (active) {
      setNodes((active.nodes as unknown as Node[]) || []);
      setEdges((active.edges as unknown as Edge[]) || []);
    }
  }, [activeId]);

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);

  const addNode = (type: string) => {
    const id = `${type}_${Date.now()}`;
    const palette = NODE_PALETTE.find((p) => p.type === type);
    setNodes((nds) => [
      ...nds,
      {
        id,
        type,
        position: { x: 100 + nds.length * 60, y: 100 + nds.length * 40 },
        data: { label: palette?.label },
      },
    ]);
  };

  const handleSave = () => {
    if (!active) return;
    updateWorkflow.mutate({ id: active.id, nodes: nodes as any, edges: edges as any });
  };

  const handleRun = async () => {
    if (!active) return;
    setRunning(true);
    try {
      let parsed: any = testInput;
      try { parsed = JSON.parse(testInput); } catch {}
      const result = await runWorkflow(active.id, parsed);
      toast.success('Execução concluída');
      console.log('Workflow result:', result);
    } catch (e: any) {
      toast.error(e.message || 'Falha na execução');
    } finally {
      setRunning(false);
    }
  };

  const handleCreate = () => {
    if (!workspace) return toast.error('Sem workspace ativo');
    const name = prompt('Nome do workflow?');
    if (!name) return;
    createWorkflow.mutate({ name, workspace_id: workspace.id }, {
      onSuccess: (w: any) => setActiveId(w.id),
    });
  };

  if (!agent.id) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Salve o agente primeiro para criar workflows visuais.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle icon="🎨" title="Visual Orchestrator" subtitle="Construa fluxos multi-agente arrastando blocos." />

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar — workflows + palette */}
        <div className="space-y-4">
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold">Workflows</p>
              <Button size="sm" variant="ghost" onClick={handleCreate}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-1 max-h-[180px] overflow-y-auto">
              {workflows.data?.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 text-center">Nenhum workflow</p>
              )}
              {workflows.data?.map((w: AgentWorkflow) => (
                <button
                  key={w.id}
                  onClick={() => setActiveId(w.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between group ${
                    activeId === w.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                >
                  <span className="truncate">{w.name}</span>
                  <Trash2
                    className="h-3 w-3 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Remover?')) deleteWorkflow.mutate(w.id);
                    }}
                  />
                </button>
              ))}
            </div>
          </Card>

          {active && (
            <Card className="p-3">
              <p className="text-xs font-semibold mb-2">Paleta de Nós</p>
              <div className="space-y-1">
                {NODE_PALETTE.map((p) => (
                  <button
                    key={p.type}
                    onClick={() => addNode(p.type)}
                    className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2"
                  >
                    <span>{p.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium">{p.label}</div>
                      <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Canvas */}
        <div className="space-y-3">
          {active ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <Input
                  value={active.name}
                  onChange={(e) => updateWorkflow.mutate({ id: active.id, name: e.target.value })}
                  className="max-w-xs h-8 text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleSave}>
                    <Save className="h-3.5 w-3.5 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" onClick={handleRun} disabled={running}>
                    {running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                    Executar
                  </Button>
                </div>
              </div>

              <div className="h-[480px] rounded-lg border bg-muted/20">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  nodeTypes={nodeTypes}
                  fitView
                >
                  <Background />
                  <Controls />
                  <MiniMap />
                </ReactFlow>
              </div>

              <Card className="p-3">
                <p className="text-xs font-semibold mb-2">Input de Teste (JSON ou texto)</p>
                <Textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  rows={2}
                  className="text-xs font-mono"
                  placeholder='Ex: "Olá" ou {"query":"..."}'
                />
              </Card>

              <Card className="p-3">
                <p className="text-xs font-semibold mb-2">Histórico de Runs ({runs?.length || 0})</p>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {runs?.length === 0 && <p className="text-xs text-muted-foreground">Sem execuções</p>}
                  {runs?.map((r) => (
                    <div key={r.id} className="text-xs flex items-center justify-between p-2 rounded bg-muted/40">
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === 'completed' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>
                          {r.status}
                        </Badge>
                        <span className="text-muted-foreground">{new Date(r.started_at).toLocaleString('pt-BR')}</span>
                      </div>
                      <span className="text-muted-foreground">{r.trace?.length || 0} nós</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <div className="h-[480px] rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-sm">
              Selecione ou crie um workflow para começar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
