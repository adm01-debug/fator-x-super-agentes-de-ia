import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Play, Trash2, Network, Loader2, Zap, History } from 'lucide-react';
import { toast } from 'sonner';
import {
  agentGraphService,
  type AgentGraph,
  type GraphExecution,
  type GraphNode,
  type GraphEdge,
} from '@/services/agentGraphService';
import { GraphCanvas } from '@/components/orchestration/GraphCanvas';
import { NodeConfigPanel } from '@/components/orchestration/NodeConfigPanel';
import { listAgentSummaries } from '@/services/agentsService';
import { getWorkspaceId } from '@/lib/agentService';

interface AgentLite {
  id: string;
  name: string;
}

export default function AgentOrchestrationPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [graphs, setGraphs] = useState<AgentGraph[]>([]);
  const [activeGraph, setActiveGraph] = useState<AgentGraph | null>(null);
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<GraphExecution[]>([]);
  const [activeExec, setActiveExec] = useState<GraphExecution | null>(null);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    (async () => {
      const wsId = await getWorkspaceId();
      setWorkspaceId(wsId);
      if (wsId) {
        const [gs, ag] = await Promise.all([
          agentGraphService.listGraphs(wsId),
          listAgentSummaries(),
        ]);
        setGraphs(gs);
        setAgents(ag);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeGraph) agentGraphService.listExecutions(activeGraph.id).then(setExecutions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGraph?.id]);

  const selectedNode = useMemo(
    () => activeGraph?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [activeGraph, selectedNodeId],
  );

  async function handleCreate() {
    if (!workspaceId || !newName.trim()) return;
    try {
      const g = await agentGraphService.createGraph(workspaceId, newName.trim());
      setGraphs([g, ...graphs]);
      setActiveGraph(g);
      setNewName('');
      setCreateOpen(false);
      toast.success('Grafo criado');
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function handleAddNode() {
    if (!activeGraph) return;
    const id = `n_${Date.now()}`;
    const newNode: GraphNode = {
      id,
      label: 'Novo Agente',
      role: '',
      agent_id: null,
      position: { x: 100 + activeGraph.nodes.length * 60, y: 100 + activeGraph.nodes.length * 40 },
    };
    const nodes = [...activeGraph.nodes, newNode];
    const entry_node_id = activeGraph.entry_node_id ?? id;
    setActiveGraph({ ...activeGraph, nodes, entry_node_id });
    await agentGraphService.updateGraph(activeGraph.id, { nodes, entry_node_id });
  }

  async function handleGraphChange(nodes: GraphNode[], edges: GraphEdge[]) {
    if (!activeGraph) return;
    setActiveGraph({ ...activeGraph, nodes, edges });
    await agentGraphService.updateGraph(activeGraph.id, { nodes, edges });
  }

  async function handleNodePatch(patch: Partial<GraphNode>) {
    if (!activeGraph || !selectedNodeId) return;
    const nodes = activeGraph.nodes.map((n) => (n.id === selectedNodeId ? { ...n, ...patch } : n));
    setActiveGraph({ ...activeGraph, nodes });
    await agentGraphService.updateGraph(activeGraph.id, { nodes });
  }

  async function handleNodeDelete() {
    if (!activeGraph || !selectedNodeId) return;
    const nodes = activeGraph.nodes.filter((n) => n.id !== selectedNodeId);
    const edges = activeGraph.edges.filter(
      (e) => e.from !== selectedNodeId && e.to !== selectedNodeId,
    );
    const entry_node_id =
      activeGraph.entry_node_id === selectedNodeId
        ? (nodes[0]?.id ?? null)
        : activeGraph.entry_node_id;
    setActiveGraph({ ...activeGraph, nodes, edges, entry_node_id });
    setSelectedNodeId(null);
    await agentGraphService.updateGraph(activeGraph.id, { nodes, edges, entry_node_id });
  }

  async function handleSetEntry() {
    if (!activeGraph || !selectedNodeId) return;
    setActiveGraph({ ...activeGraph, entry_node_id: selectedNodeId });
    await agentGraphService.updateGraph(activeGraph.id, { entry_node_id: selectedNodeId });
  }

  async function handleDeleteGraph(id: string) {
    if (!confirm('Excluir este grafo?')) return;
    await agentGraphService.deleteGraph(id);
    setGraphs(graphs.filter((g) => g.id !== id));
    if (activeGraph?.id === id) setActiveGraph(null);
  }

  async function handleRun() {
    if (!activeGraph || !input.trim()) return;
    setRunning(true);
    try {
      const res = await agentGraphService.executeGraph(activeGraph.id, input.trim());
      toast.success(`Execução concluída — ${res.steps} passos`);
      const fresh = await agentGraphService.getExecution(res.execution_id);
      setActiveExec(fresh);
      const ex = await agentGraphService.listExecutions(activeGraph.id);
      setExecutions(ex);
    } catch (e) {
      toast.error(e.message || 'Falha na execução');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6 page-enter">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Network className="h-7 w-7 text-primary" /> Orquestração Multi-Agente
          </h1>
          <p className="text-muted-foreground mt-1">
            Construa grafos visuais de agentes (LangGraph-style) com handoffs declarativos.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo grafo
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar grafos */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Grafos ({graphs.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[600px] overflow-y-auto">
            {graphs.length === 0 && (
              <p className="text-xs text-muted-foreground">Crie seu primeiro grafo.</p>
            )}
            {graphs.map((g) => (
              <div
                key={g.id}
                className={`group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer ${activeGraph?.id === g.id ? 'bg-primary/10' : 'hover:bg-muted/40'}`}
                onClick={() => setActiveGraph(g)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).click();
                  }
                }}
              >
                <Network className="h-3.5 w-3.5 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {g.nodes.length} nós · {g.edges.length} edges
                  </p>
                </div>
                <Trash2
                  className="h-3 w-3 opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteGraph(g.id);
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Canvas + execution */}
        <div className="col-span-6 space-y-4">
          {activeGraph ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">{activeGraph.name}</CardTitle>
                  <Button size="sm" variant="outline" onClick={handleAddNode}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar nó
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[480px]">
                    <GraphCanvas
                      nodes={activeGraph.nodes}
                      edges={activeGraph.edges}
                      entryNodeId={activeGraph.entry_node_id}
                      activeNodeId={activeExec?.current_node_id}
                      onChange={handleGraphChange}
                      onSelect={setSelectedNodeId}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" /> Executar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Input inicial para o grafo..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={handleRun}
                    disabled={running || !input.trim() || activeGraph.nodes.length === 0}
                    className="w-full"
                  >
                    {running ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executando...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" /> Executar grafo
                      </>
                    )}
                  </Button>
                  {activeExec?.final_output && (
                    <div className="rounded-md bg-muted/40 p-3 text-xs">
                      <p className="font-semibold mb-1">Resultado final:</p>
                      <p className="whitespace-pre-wrap">{activeExec.final_output}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Selecione ou crie um grafo</p>
            </Card>
          )}
        </div>

        {/* Painel direito */}
        <div className="col-span-3 space-y-4">
          {activeGraph && (
            <NodeConfigPanel
              node={selectedNode}
              agents={agents}
              isEntry={selectedNodeId === activeGraph.entry_node_id}
              onChange={handleNodePatch}
              onDelete={handleNodeDelete}
              onSetEntry={handleSetEntry}
            />
          )}
          {activeGraph && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" /> Execuções
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 max-h-[300px] overflow-y-auto">
                {executions.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma ainda.</p>
                )}
                {executions.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setActiveExec(e)}
                    className="w-full text-left rounded-md hover:bg-muted/40 px-2 py-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={
                          e.status === 'completed'
                            ? 'default'
                            : e.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {e.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {e.trace?.length ?? 0} passos
                      </span>
                    </div>
                    <p className="text-xs truncate mt-1">{e.input}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Trace details */}
      {activeExec && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Trace · {new Date(activeExec.started_at).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeExec.trace?.map((t, i) => (
              <div key={i} className="rounded-md border bg-muted/20 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {i + 1}. {t.agent_name}
                  </span>
                  <span className="text-muted-foreground">
                    {t.latency_ms}ms · {(t.cost_cents / 100).toFixed(4)}¢
                  </span>
                </div>
                <p className="text-muted-foreground">
                  <strong>In:</strong> {t.input.slice(0, 200)}
                  {t.input.length > 200 ? '...' : ''}
                </p>
                <p>
                  <strong>Out:</strong> {t.output.slice(0, 400)}
                  {t.output.length > 400 ? '...' : ''}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo grafo</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome do grafo"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
