
Sprint 29 (Synthetic Monitoring) completo ✅. Score 10/10 mantido. Próximo da fila Continuous Hardening: 🟢 **Sprint 30 — Cost Anomaly Detection (alertas proativos de custo)**.

## Por quê
- Temos observabilidade completa: traces, SLO, chaos, synthetic — sabemos quando o **sistema** quebra
- **Mas** não sabemos quando o **custo** explode silenciosamente: prompt injection inflando tokens, loop de retry em agente, modelo errado em prod (gpt-5 ao invés de flash-lite)
- Cost anomaly detection = baseline rolling de spend por hora/agente/modelo + detecção estatística (z-score) de outliers + alerta antes da fatura chegar
- Fecha o ciclo FinOps: tracking (já existe via `agent_traces.cost_usd`) + alerting (novo) + budget enforcement (futuro Sprint 31)

## Plano

**1. Migração SQL — `cost_baselines` + `cost_alerts`:**
- `cost_baselines`: id, workspace_id, scope (`workspace`|`agent`|`model`), scope_id (nullable), hour_of_day (0-23), day_of_week (0-6), avg_cost_usd, stddev_cost_usd, sample_count, computed_at — **rolling 14 dias**
- `cost_alerts`: id, workspace_id, scope, scope_id, observed_cost_usd, baseline_cost_usd, z_score, severity (`info`|`warning`|`critical`), triggered_at, acknowledged_at
- RLS: members SELECT, admins UPDATE (acknowledge); INSERT só via SECURITY DEFINER
- Índices: `(workspace_id, triggered_at DESC)` + `(scope, scope_id)`

**2. RPC `compute_cost_baselines()`:**
- Agrega `agent_traces` últimos 14 dias agrupando por (workspace, scope, hour_of_day, day_of_week)
- Calcula avg + stddev — armazena em `cost_baselines` (UPSERT)
- Schedulada via pg_cron 1x/dia (3h da manhã)

**3. RPC `detect_cost_anomalies()`:**
- Pega última hora de spend por workspace/agent/model
- Compara com baseline da mesma hora/dia da semana
- Z-score = (observed - baseline) / stddev; severity: z>2 warning, z>3 critical
- Insere em `cost_alerts` se z>2 e observed > $0.10 (filtro ruído)
- Schedulada via pg_cron a cada 15min

**4. UI — `src/pages/CostAnomaliesPage.tsx` (`/observability/cost-anomalies`):**
- Lista de alertas ativos (não-acknowledged) ordenados por severity
- Card: scope + observed vs baseline + z-score visual + mini-gráfico (custo última 24h)
- Botão "Acknowledge" + "Investigar" (link para traces filtrados)
- Filtro: severity, scope type, período
- Empty state: "Sem anomalias detectadas — custos dentro do esperado ✅"

**5. `src/services/costAnomalyService.ts`:** listAlerts, acknowledgeAlert, getBaselines

**6. Sidebar:** item "Cost Anomalies" sob Observability (ícone `TrendingUp` ou `AlertTriangle`)

**7. Realtime alerts:** subscription em `cost_alerts` INSERT → toast.warning/error global (`CostAnomalyAlertsMounter` em App.tsx)

**8. Widget no Dashboard principal:** card "Anomalias de custo (24h)" com count + link

**9. `docs/RUNBOOK.md`:** seção "Cost Anomaly Detection" — interpretação de z-score, falsos positivos comuns, resposta a alerta crítico

**10. `mem://features/audit-improvements`:** Sprint 30 logged + fila (Sprint 31 budget enforcement, Sprint 32 game days)

## Arquivos
- `supabase/migrations/<ts>_cost_anomaly_detection.sql` (tabelas + RPCs + RLS + cron)
- `src/services/costAnomalyService.ts` (novo)
- `src/pages/CostAnomaliesPage.tsx` (nova)
- `src/components/shared/CostAnomalyAlertsMounter.tsx` (novo)
- `src/components/dashboard/CostAnomalyWidget.tsx` (novo)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota + mounter)
- `src/pages/Dashboard.tsx` (widget — se existir)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Cron 3h roda → `cost_baselines` populado com 14 dias × 24h × 7 dias por scope
- Cron 15min roda → se spend última hora > baseline + 2σ → linha em `cost_alerts`
- UI mostra alerta com z-score e mini-gráfico; acknowledge marca como tratado
- Realtime: novo alerta crítico → toast vermelho global
- Empty state se sem alertas
