
Sprint 28 (Chaos Engineering) completo ✅. Score 10/10 mantido. Próximo da fila Continuous Hardening: 🟢 **Sprint 29 — Synthetic Monitoring (canary checks 24/7)**.

## Por quê
- Temos chaos (validamos resposta a falhas), SLO (medimos saúde quando há tráfego) e load tests (validamos sob carga sintética em CI)
- **Mas**: se ninguém usar o sistema por 1 hora e ele quebrar, ninguém sabe até o primeiro usuário real reclamar
- Synthetic monitoring = pings periódicos automáticos simulando jornada crítica do usuário (ex: "fazer 1 chamada ao llm-gateway"); registra latência+sucesso e dispara alerta se cair
- Fecha o ciclo: chaos (proativo) + SLO (reativo a tráfego real) + synthetic (reativo 24/7 mesmo sem tráfego)

## Plano

**1. Migração SQL — `synthetic_checks` + `synthetic_results`:**
- `synthetic_checks`: id, workspace_id, name, target (`llm-gateway` | `agent-workflow-runner` | `health`), interval_minutes (5–60), enabled, expected_status_max_ms, created_by, created_at
- `synthetic_results`: id, check_id, ran_at, success bool, latency_ms, status_code, error_message
- RLS: members SELECT, admins CRUD em checks; members SELECT em results (filtrado via check_id)
- Índices: `(check_id, ran_at DESC)` para query de histórico

**2. Edge function `synthetic-runner` (cron):**
- Schedule via pg_cron a cada 1min; lê checks `enabled=true` cujo `last_run_at + interval ≤ now()`
- Para cada check: chama target (HEAD/POST mínimo), mede latência, insere `synthetic_results`
- Se falha 3x consecutivas → insere alerta (reusa toast via realtime ou cria `synthetic_alerts`)

**3. UI — `src/pages/SyntheticMonitoringPage.tsx` (`/observability/synthetic`):**
- Lista de checks com sparkline (últimas 60 execuções), uptime % 24h, P95
- Form criar: target, intervalo, threshold latência
- Botão "Executar agora" (dispara edge function on-demand)
- Histórico expandível por check

**4. `src/services/syntheticService.ts`:** CRUD + fetch results agregados

**5. Sidebar:** item "Synthetic Monitoring" sob Operações (ícone `Radar` ou `Activity`)

**6. Realtime alerts:** subscription em `synthetic_results` com `success=false` → toast.error global (mountado em App.tsx via novo `SyntheticAlertsMounter`)

**7. `docs/RUNBOOK.md`:** seção "Synthetic Monitoring" — checks recomendados, troubleshooting de falhas, política de threshold

**8. `mem://features/audit-improvements`:** Sprint 29 logged + fila (Sprint 30 game days, Sprint 31 cost anomaly detection)

## Arquivos
- `supabase/migrations/<ts>_synthetic_monitoring.sql`
- `supabase/functions/synthetic-runner/index.ts` (novo)
- `src/services/syntheticService.ts` (novo)
- `src/pages/SyntheticMonitoringPage.tsx` (nova)
- `src/components/shared/SyntheticAlertsMounter.tsx` (novo)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota + mounter)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Criar check `llm-gateway @ 5min` → após 5min, primeira linha em `synthetic_results`
- Sparkline mostra histórico, uptime % calculado corretamente
- Forçar falha (chaos error_500 ativo) → 3 falhas consecutivas → toast global de alerta
- Disable check = cron pula
