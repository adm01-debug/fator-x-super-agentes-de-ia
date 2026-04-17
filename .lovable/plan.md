
#9 done. Próxima: **#10 Visual Orchestrator** — workflow builder visual node-based.

## #10 Visual Orchestrator

Editor visual de fluxos multi-agente com nós conectáveis (drag-and-drop), usando React Flow.

**Schema (migration):**
- `agent_workflows`: id, agent_id, name, description, nodes (jsonb), edges (jsonb), status (draft/active), workspace_id, created_by, created_at, updated_at
- `agent_workflow_runs`: id, workflow_id, status (running/completed/failed), input, output, trace (jsonb), started_at, completed_at, created_by
- RLS: workspace members

**Tipos de nó:**
- `trigger` — entrada do fluxo (input do usuário)
- `agent` — chamada a um agente (config: agent_id)
- `tool` — execução de ferramenta (config: tool_name, params)
- `condition` — branch if/else (config: expression)
- `transform` — transformação de dados (config: code/template)
- `output` — saída final

**Hook:**
- `src/hooks/useAgentWorkflows.ts` — CRUD via supabaseExternal + execução

**Componente:**
- `src/components/agent-builder/modules/OrchestratorModule.tsx` — nova tab "Orquestração"
- Canvas React Flow com paleta lateral de nós arrastáveis
- Painel de propriedades quando nó selecionado
- Botão "Salvar" + "Executar" (com input de teste) + "Histórico de runs"
- Mini-mapa + zoom controls

**Edge function (fase 1 simplificada):**
- `supabase/functions/agent-workflow-runner/index.ts`
- Topological sort dos nós → executa sequencial seguindo edges
- Para cada nó: roda lógica conforme tipo, passa output para próximos
- Persiste trace em `agent_workflow_runs`

**Dependência:**
- `reactflow` (instalar via package.json)

**Arquivos:**
- migration SQL nova
- criar `src/hooks/useAgentWorkflows.ts`
- criar `src/components/agent-builder/modules/OrchestratorModule.tsx`
- criar nodes customizados em `src/components/agent-builder/orchestrator/nodes/`
- criar `supabase/functions/agent-workflow-runner/index.ts`
- editar `src/data/agentBuilderData.ts` — registrar tab "orchestrator"
- editar `src/pages/AgentBuilder.tsx` — rotear módulo

**Validação:** abrir agente → tab Orquestração → arrastar trigger + agent + output → conectar → salvar → executar com input teste → ver trace.

Próxima sem pausar: #7 Guardrails Library (final).
