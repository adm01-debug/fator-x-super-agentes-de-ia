
#6 done. Próxima: **#9 Eval Suite** — testes automatizados de qualidade.

## #9 Eval Suite

Sistema de avaliação batch: rodar dataset de testes contra agente, calcular métricas (accuracy, latência, custo) e comparar versões.

**Schema (migration):**
- `agent_eval_datasets`: id, agent_id, name, description, items (jsonb array de `{input, expected_output, criteria[]}`), workspace_id, created_by, created_at
- `agent_eval_runs`: id, dataset_id, agent_id, status (queued/running/completed/failed), total_items, passed, failed, avg_latency_ms, total_cost_usd, started_at, completed_at, created_by
- `agent_eval_results`: id, run_id, item_index, input, expected, actual, passed (bool), score (0-1), latency_ms, cost_usd, judge_reasoning, error
- RLS: workspace members

**Hook:**
- `src/hooks/useAgentEvals.ts` — CRUD datasets/runs + queries de resultados

**Edge function:**
- `supabase/functions/agent-eval-runner/index.ts`
- Input: `{ dataset_id, agent_id }`
- Para cada item: chama o agente (via mesma lógica do playground) → usa LLM-as-judge (Gemini Flash) com prompt "compare expected vs actual usando critérios X" → retorna score 0-1 + reasoning
- Persiste em `agent_eval_results` em batch
- Atualiza `agent_eval_runs` ao final com agregados

**Componente:**
- `src/components/agent-builder/modules/EvalsModule.tsx` — nova tab "Avaliação"
- **Datasets**: lista + botão "Novo dataset" (modal com textarea JSON ou builder linha-a-linha de input/expected)
- **Runs**: histórico com status, pass rate, latência média, custo
- **Detalhes do run**: tabela com cada item (input/expected/actual/score/judge reasoning) + filtro pass/fail

**Arquivos:**
- migration SQL nova
- criar `src/hooks/useAgentEvals.ts`
- criar `src/components/agent-builder/modules/EvalsModule.tsx`
- criar `supabase/functions/agent-eval-runner/index.ts`
- editar `src/data/agentBuilderData.ts` — registrar tab "evals"
- editar `src/pages/AgentBuilder.tsx` — rotear módulo

**Validação:** abrir agente → tab Avaliação → criar dataset com 3 itens → rodar → ver pass rate + detalhes por item.

Próximas sem pausar: #10 Visual Orchestrator → #7 Guardrails Library.
