
Próximo da fila: **#7 A/B Testing de Prompts em Produção** (P2, esforço médio).

Estado atual: `prompt_versions` existe mas sem split traffic ao vivo, sem significância estatística, sem auto-promote.

## Plano

**Backend (migration):**
1. Tabela `prompt_experiments`: id, agent_id, name, status (draft/running/paused/completed), variant_a_version_id, variant_b_version_id, traffic_split (0-100, default 50), success_metric (quality/latency/cost), guardrails jsonb (max_cost_increase_pct, max_latency_increase_ms, min_quality), started_at, ended_at, winner, created_by, created_at. RLS por workspace.
2. Tabela `prompt_experiment_runs`: id, experiment_id, variant ('a'|'b'), prompt_version_id, latency_ms, cost_cents, quality_score (0-1), success bool, trace_id, created_at. RLS read via experiment.
3. RPC `assign_variant(experiment_id)`: retorna 'a' ou 'b' com base em hash determinístico + traffic_split.
4. RPC `compute_experiment_stats(experiment_id)`: retorna conversion rate, avg latency/cost por variante, tamanho amostral, **z-test** de significância (p-value), winner candidato.
5. RPC `promote_winner(experiment_id)`: marca completed, ativa variant winner em `prompt_versions`.

**Service `promptExperimentService.ts`:**
- listExperiments, createExperiment, getExperiment, recordRun, getStats, pause/resume, promoteWinner, deleteExperiment.

**Frontend — nova `PromptExperimentsPage.tsx` em `/prompts/experiments`:**
- Lista de experimentos (status badge, agente, métrica primária, p-value, winner).
- Wizard de criação: escolher agente → 2 versões para A/B → split (slider 50/50 default) → guardrails → métrica primária.
- Detalhe do experimento: gráfico de runs ao longo do tempo, comparativo A vs B (latency/cost/quality), barra de significância estatística com indicador "✓ significativo" quando p<0.05 e n≥100, botão "Promover vencedor" (habilitado só se significativo + guardrails OK).
- Aba "Runs" com tabela detalhada.

**Integração:**
- Adicionar rota `/prompts/experiments` no `App.tsx`.
- Adicionar item no menu lateral de Prompts.
- Botão "Criar A/B test" na `PromptsPage` selecionando 2 versões.

**Validação:** `tsc` clean, criar experimento → simular runs → ver p-value → promover.

**Arquivos:**
- migration (2 tabelas + 3 RPCs)
- `src/services/promptExperimentService.ts` (novo)
- `src/pages/PromptExperimentsPage.tsx` (novo)
- `src/components/prompts/CreateExperimentDialog.tsx` (novo)
- `src/App.tsx` (rota)
- `src/components/layout/AppSidebar.tsx` (item menu, se aplicável)
