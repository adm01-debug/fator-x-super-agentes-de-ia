
#8 done. Próxima: **#5 A/B Testing real**.

## #5 A/B Testing — Escopo

Sistema de experimentos comparando 2 variantes de agente com split de tráfego e métricas.

**Schema (migration):**
- `agent_experiments`: id, agent_id, name, status (draft/running/paused/completed), variant_a_config (jsonb), variant_b_config (jsonb), traffic_split (int 0-100, % pra B), started_at, ended_at, winner (a/b/null), workspace_id, created_by
- `agent_experiment_runs`: id, experiment_id, variant (a/b), input, output, latency_ms, tokens, cost, score (nullable), feedback (nullable), created_at
- RLS: workspace members podem ver/criar; só admin pausa/completa

**Hook:**
- `src/hooks/useAgentExperiments.ts` — CRUD via supabaseExternal + React Query

**Componente:**
- `src/components/agent-builder/modules/ExperimentsModule.tsx` — nova tab ou painel dentro de Observability
- Lista experimentos do agente
- Wizard "Novo experimento": nome → diff configs (model/prompt/temp) → split slider → start
- Painel ativo: métricas side-by-side (latência média, custo, score) + barra de progresso runs A vs B
- Botão "Declarar vencedor" → aplica config no agente principal

**Edge function (opcional fase 1, fica pra depois):**
- Roteamento real no playground respeitando split — fase 1 usa só registro manual de runs

**Arquivos:**
- migration SQL nova
- criar `src/hooks/useAgentExperiments.ts`
- criar `src/components/agent-builder/modules/ExperimentsModule.tsx`
- editar `src/data/agentBuilderData.ts` — adicionar tab "experiments" ou integrar em existente
- editar `src/pages/AgentBuilder.tsx` (ou onde tabs são roteadas) — registrar módulo

**Validação:** abrir agente → tab Experiments → criar experimento → ver métricas mock + declarar vencedor.

Próximas sem pausar: #6 Cost Predictor → #9 Eval Suite → #10 Visual Orchestrator → #7 Guardrails Library.
