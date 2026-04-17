
Sprint 26 (OTel tracing) completo ✅. Score 10/10 mantido. Próximo da fila Continuous Hardening: 🟢 **Sprint 27 — SLO Dashboards & Alerting**.

## Por quê
- Temos traces (Sprint 26), load tests (Sprint 25), visual regression (Sprint 24) — mas **nenhuma view consolidada de saúde do sistema em tempo real**
- SLOs (Service Level Objectives) traduzem métricas brutas em "estamos OK ou não?" para o usuário/admin
- Fecha o ciclo observabilidade: traces (debug) + load (capacidade) + SLO dashboard (saúde contínua)
- Reuso total: dados já existem em `traces`/`spans` tables — só falta agregação + UI

## Plano

**1. SQL — view de agregação (`supabase/migrations/`):**
- View `slo_metrics_hourly` agregando `traces` + `spans` por hora:
  - `success_rate` = traces ok / total
  - `p50_latency_ms`, `p95_latency_ms`, `p99_latency_ms` (via `percentile_cont`)
  - `error_count`, `total_traces`, `total_cost_usd`
  - Particionada por `agent_id` (nullable)
- RPC `get_slo_summary(p_window_hours int)` retorna resumo + targets
- RLS: somente workspace members veem dados do próprio workspace

**2. Targets de SLO (constantes no client):**
- `src/lib/slo/sloTargets.ts`: latência P95 < 2000ms, success rate > 99%, error budget mensal de 0.1%
- Tipo `SLOStatus = 'healthy' | 'warning' | 'breached'` com thresholds

**3. UI — `src/pages/SLODashboard.tsx` (nova rota `/observability/slo`):**
- 4 cards principais (success rate, P95, P99, error budget restante) com semáforo color-coded
- Gráfico recharts: linha temporal P95 das últimas 24h com banda de target
- Tabela: agentes com pior performance (top 5)
- Botão "Refresh" + auto-refresh 60s
- Empty state se sem dados

**4. Sidebar:** adicionar item "SLO Dashboard" sob seção Observability/Admin (ícone `Activity`)

**5. Alerting client-side (lightweight):**
- `src/hooks/useSLOAlerts.ts`: polling RPC a cada 5min, dispara `toast.error` se algum SLO breached
- Hook montado em `App.tsx` (apenas para admin)

**6. `docs/RUNBOOK.md`:** seção "SLO Monitoring"
- Tabela de SLOs com targets
- Como interpretar burn rate
- Resposta a breach

**7. `mem://features/audit-improvements`:** Sprint 27 logged + fila atualizada (Sprint 28 chaos testing, Sprint 29 sintetic monitoring).

## Arquivos
- `supabase/migrations/<timestamp>_slo_view.sql` (view + RPC + RLS)
- `src/lib/slo/sloTargets.ts` (novo)
- `src/lib/slo/sloService.ts` (novo, fetch via RPC)
- `src/pages/SLODashboard.tsx` (nova)
- `src/hooks/useSLOAlerts.ts` (novo)
- `src/components/Sidebar.tsx` (item menu)
- `src/App.tsx` (rota + hook)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Rota `/observability/slo` mostra 4 cards + gráfico com dados reais de `traces`
- Sem dados: empty state com CTA "Execute um agente para gerar métricas"
- SLO breached = card vermelho + toast de alerta para admin
- RPC respeita RLS (workspace isolation)
