
Próximo da fila: **#10 Multi-Agent Orchestration Visual (LangGraph-style)** (P1, último item da fila para chegar em 10/10).

Estado atual: agentes existem isolados, sem grafo visual de orquestração, sem handoffs declarativos, sem visualização de fluxo multi-agente em runtime.

## Plano

**Backend (migration):**
1. Tabela `agent_graphs`: id, workspace_id, name, description, nodes jsonb [{id, agent_id, role, position{x,y}}], edges jsonb [{from, to, condition}], entry_node_id, created_by, created_at, updated_at. RLS por workspace.
2. Tabela `graph_executions`: id, graph_id, user_id, input text, status (running/completed/failed), current_node_id, trace jsonb [{node_id, agent_id, input, output, latency_ms, ts}], final_output text, total_cost_cents, started_at, ended_at. RLS por user_id.

**Edge function `graph-execute`:**
- Recebe `{graph_id, input}` → carrega grafo → executa BFS a partir do entry_node:
  - Para cada nó: chama LLM (Lovable AI Gemini 2.5 Flash) com persona do agente + input do nó pai
  - Avalia edges condicionais (LLM decide próximo nó quando há múltiplos)
  - Persiste cada step no trace
- Para em nó terminal (sem edges) ou max 15 nós.

**Service `agentGraphService.ts`:**
- listGraphs, createGraph, updateGraph, deleteGraph, getGraph, executeGraph, listExecutions, getExecution.

**Frontend — nova `AgentOrchestrationPage.tsx` em `/orchestration`:**
- Lista de grafos (cards com preview).
- Editor visual usando **@xyflow/react** (já instalado provavelmente — verificar): canvas com drag-drop de agentes, conexões entre nós, painel lateral para configurar nó (qual agente, role, condição da edge).
- Painel de execução: input + botão "▶ Executar" → visualização ao vivo dos nós sendo ativados (highlight + latência por nó) → resultado final.
- Histórico de execuções com replay no canvas.

**Integração:**
- Rota `/orchestration` em `App.tsx`.
- Item no sidebar (ícone `Network` ou `GitBranch`).

**Validação:** `tsc` clean, criar grafo de 3 agentes (researcher → writer → reviewer) → executar → ver trace visual.

**Arquivos:**
- migration (2 tabelas)
- `supabase/functions/graph-execute/index.ts` (novo)
- `src/services/agentGraphService.ts` (novo)
- `src/pages/AgentOrchestrationPage.tsx` (novo)
- `src/components/orchestration/GraphCanvas.tsx` (novo, usa @xyflow/react)
- `src/components/orchestration/NodeConfigPanel.tsx` (novo)
- `src/App.tsx` (rota)
- `src/components/layout/AppSidebar.tsx` (item menu)

**Nota:** Se @xyflow/react não estiver instalado, será adicionado. Esta é a peça final para fechar o ciclo de "Studio de Agentes" — junto com Voice (#8), Browser (#9), Code (#5), Marketplace (#6), A/B Test (#7), atinge paridade competitiva com LangSmith/AgentOps.
