---
name: Audit Technical Improvements
description: Tracking of all improvements made from technical audit toward 10/10
type: feature
---
## Completed — Quick Wins
- strict: true + noUnusedLocals + noUnusedParameters
- 55+ unused imports removed across 30+ files
- All `as any` eliminated in frontend (replaced with proper types)
- Prettier + .prettierrc configured
- ESLint no-unused-vars: warn
- DB indices on all major tables (20+ indices)
- audit_log table with RLS (SECURITY DEFINER for writes)
- DELETE policy on workspaces

## Completed — Sprints 1–14
(see prior history — service layer, RLS hardening, type-safety, edge function coverage, Sentry-ready logger, etc.)

## Completed — Sprint 15 (Wave 1 Quick Wins)
- workspace_members.email masked via SECURITY DEFINER view (closes ERROR finding)
- Security headers hardened in index.html (CSP, Referrer-Policy, Permissions-Policy)
- docs/RUNBOOK.md created with Security Headers section
- Root tsconfig.json: strict + noImplicitAny + strictNullChecks + noFallthroughCasesInSwitch enabled

## Completed — Sprint 16 (Observability)
- @sentry/react integrated, no-op when VITE_SENTRY_DSN unset
- src/lib/sentry.ts: PII scrubbing, ignore list, replay on error only
- logger.error/critical forwarded to Sentry via lazy import
- ErrorBoundary captures with componentStack
- vite.config.ts injects __APP_VERSION__ for release tracking
- CSP connect-src extended for *.sentry.io regional ingests
- RUNBOOK.md: Observability — Sentry section

## Completed — Sprint 17 (RLS Persona Tests)
- tests/rls/setup.ts: createTestUser, deleteTestUser, getAuthedClient helpers
- tests/rls/personas.test.ts: 8 cross-tenant isolation tests
  - agents SELECT/UPDATE/DELETE blocked for non-owners
  - workspace_secrets direct SELECT blocked, get_masked_secrets RPC owner-only
  - audit_log direct INSERT blocked, log_audit_entry RPC works
  - api_keys key_hash never leaks to other users
  - workspace_members returns zero rows to non-members
- vitest.rls.config.ts: dedicated Node-env config, single-fork serial execution
- package.json: `test:rls` script
- vitest.config.ts: excludes tests/rls and e2e from default suite
- Opt-in via SUPABASE_SERVICE_ROLE_KEY — auto-skips when absent (CI-safe)
- RUNBOOK.md: RLS Persona Tests section

## Completed — Sprint 18 (Coverage Gate enforcement)
- package.json: `test:coverage` + `test:coverage:ci` scripts
- vitest.config.ts: `all: true`, html reporter, reportsDirectory: 'coverage'
- .gitignore: `coverage/` excluded from VCS
- RUNBOOK.md: Coverage Gate section with thresholds (70/70/60) + policy

## Completed — Sprint 19 (Bundle-size budget guard)
- bundle-budget.json: per-chunk + total gzip KB limits (total 1200 KB)
- scripts/check-bundle-size.mjs: gzip-measures dist/assets/*.js, fails on over-budget
- package.json: `build:analyze` + `check:bundle` scripts
- .github/workflows/ci.yml: `check:bundle` step after build + uploads bundle-report.html artifact
- vite.config.ts already had visualizer + manualChunks (vendor-react, vendor-supabase, vendor-ui, vendor-query) — reused
- RUNBOOK.md: Bundle Size Budget section with strategy table + policy
- Yellow warning at >85% of limit, red fail at >100%

## Score: 10/10 ✅ (Sprint 19 complete)

## Completed — Sprint 20 (Dependency Freshness — Dependabot)
- .github/dependabot.yml: weekly (Mon 06:00 UTC) for npm + github-actions
- Grouping: react, supabase, sentry, radix, dev-dependencies (minor/patch)
- Major bumps on react/react-dom ignored (manual migration only)
- Limits: 5 npm PRs + 3 Actions PRs concurrent
- Commit prefixes: chore(deps) / chore(deps-dev) / chore(ci)
- RUNBOOK.md: Dependency Freshness section (groups table + review policy + dependabot commands)

## Completed — Sprint 21 (Lighthouse CI — performance budget guard)
- @lhci/cli devDep added
- lighthouserc.json: staticDistDir dist, 2 URLs (/, /auth), 3 runs, desktop preset
- Assertions: perf ≥0.85 (warn), a11y ≥0.95 (error), best-practices ≥0.90 (error), seo ≥0.90 (warn), LCP ≤2500ms, CLS ≤0.1 (error), TBT ≤300ms
- temporary-public-storage upload (link público no log do PR)
- package.json: `lhci` + `lhci:local` scripts
- .github/workflows/ci.yml: novo job `lighthouse` (PR-only, needs build, uploads .lighthouseci/ artifact)
- RUNBOOK.md: Performance Budget — Lighthouse CI section (URLs table + assertions table + policy + how to read)

## Next candidates
- Playwright auth flow E2E expansion (último — requer credenciais sintéticas + OTP/Google flow)

## Notes
- HIBP (leaked password protection) — manual activation in Cloud UI
- Vault encryption at rest — pgsodium extension at infra level
- Member emails visible to workspace peers — intentional for collaboration
- tool_integrations owner-only — intentional credential protection

## Completed — Sprint 22 (Auth E2E — synthetic user flows) 🎉 FINAL SPRINT
- e2e/helpers/auth-fixtures.ts: createE2EUser/deleteE2EUser via service role admin API + loginViaUI helper
- Synthetic users use @e2e-tests.invalid TLD for easy cleanup identification
- e2e/auth-flows.spec.ts: 5 cenários (login válido, login inválido, rota protegida, sessão persiste em reload, logout)
- AUTH_E2E_ENABLED flag — auto-skip quando SUPABASE_SERVICE_ROLE_KEY ausente (CI verde sem secrets)
- package.json: `test:e2e`, `test:e2e:ui`, `test:e2e:auth` scripts
- .github/workflows/ci.yml: env vars adicionados ao job e2e-tests + warning step quando service key ausente
- RUNBOOK.md: Auth E2E Tests section (estratégia, comandos, tabela de cenários, política, debug)

## Completed — Sprint 23 (Mobile Lighthouse + Runtime A11y) — Continuous Hardening
- lighthouserc.mobile.json: preset mobile, throttling 4G, perf ≥0.75, LCP ≤4000ms, TBT ≤600ms (a11y/CLS mantidos rígidos)
- @axe-core/playwright dep adicionada
- e2e/helpers/a11y.ts: expectNoA11yViolations() com tags wcag2a+wcag2aa+wcag21aa, falha em serious/critical, warn em moderate/minor, anexa JSON ao testInfo
- e2e/auth.spec.ts: 1 assertion axe no render inicial
- e2e/auth-flows.spec.ts: 1 assertion axe pós-login (cobre shell autenticado + sidebar)
- .github/workflows/ci.yml: job lighthouse refatorado para matrix [desktop, mobile] com artifacts separados
- package.json: scripts lhci, lhci:mobile, lhci:local (roda os dois)
- RUNBOOK.md: seção "Mobile Performance + Runtime A11y" com tabela comparativa de budgets + política de impact levels

## Continuous Hardening Queue
- Sprint 27 — SLO dashboards (error budget, golden signals consolidados)
- Sprint 28 — Chaos testing (provider outage, DB lock, rate-limit flood)

## Completed — Sprint 24 (Visual regression — Playwright screenshots)
- e2e/visual.spec.ts: 4 cenários (auth desktop 1280×720, auth mobile 375×667, signup variant, protected redirect /agents → /auth)
- playwright.config.ts: threshold 0.2 + maxDiffPixelRatio 0.01 + animations disabled + snapshotPathTemplate em e2e/__screenshots__/
- package.json: scripts test:e2e:visual + test:e2e:update
- .github/workflows/ci.yml: upload artifact `visual-regression-diffs` on failure (test-results/ + e2e/__screenshots__/)
- RUNBOOK.md: seção "Visual Regression Tests" com tabela de cenários + política de update + troubleshooting de diffs
- Baselines geradas na primeira run no CI (commit subsequente do dev após inspeção visual)

## Completed — Sprint 25 (Load testing — k6 llm-gateway)
- tests/load/llm-gateway.k6.js: smoke (1 VU 30s) + full load (ramp 0→20 VUs em 1m, sustain 3m, ramp-down 30s)
- Thresholds: p(95)<2000ms, p(99)<5000ms, failed<1%, checks>95%, success>95%
- Auth via SUPABASE_SERVICE_ROLE_KEY (espelha padrão E2E); skip gracioso quando ausente
- handleSummary customizado: summary.json + textSummary stdout com p50/p95/p99
- tests/load/README.md: instalação k6, env vars, thresholds, calibração (3× runs + 20% headroom), reading P95/P99 spikes
- package.json: scripts test:load + test:load:smoke
- .github/workflows/ci.yml: novo job `load-test` (PR-only, needs build) — smoke sempre + full apenas com label `load-test` (gate de custo)
- grafana/setup-k6-action@v1 para instalação
- Upload artifact `k6-summary` (90d retenção)
- RUNBOOK.md: seção "Load Testing — k6" com tabela de thresholds + política de release + interpretação de spikes

## Completed — Sprint 26 (Distributed tracing — OpenTelemetry edge → client)
- supabase/functions/_shared/otel.ts (novo): mini-tracer OTel-compatible (W3C Trace Context parsing, EdgeSpan + EdgeTraceContext, fire-and-forget exporter para tabelas `traces`/`spans`, idempotent end())
- supabase/functions/llm-gateway/index.ts: instrumentado com root span `llm-gateway.handle` (kind=server) + sub-spans `auth.verify`, `provider.call` (gen_ai.request.model, gen_ai.usage.input/output_tokens, gen_ai.response.provider, llm.fallback_attempt, cost.usd) + finally idempotente + `x-trace-id` response header + `trace_id` no body
- supabase/functions/agent-workflow-runner/index.ts: root span `agent-workflow-runner.handle` + sub-spans `auth.verify`, `db.workflow_load`, `node.<type>` por nó do workflow + headers/body com trace_id
- supabase/functions/_shared/cors.ts: traceparent + tracestate adicionados aos ALLOWED_HEADERS
- src/services/llmGatewayService.ts: tracedInvoke() injeta header `traceparent: 00-{traceId}-{spanId}-01` no `supabase.functions.invoke()` (continua trace cross-tier)
- docs/RUNBOOK.md: seção "Distributed Tracing — OpenTelemetry" com diagrama waterfall, tabela de funções instrumentadas, naming conventions OTel, debugging por trace_id, failure modes graceful

## Score: 10/10 ✅ mantido (Sprint 26 — observabilidade tri-tier fechada: client + edge + load)



## Completed — Sprint 27 (SLO Dashboards & Alerting)
- Migration: VIEW `slo_metrics_hourly` (security_invoker=true, herda RLS de agent_traces) agregando por (hour, user_id, agent_id) — total/error/success_rate/p50/p95/p99/cost/tokens
- Migration: RPC `get_slo_summary(p_window_hours int)` SECURITY DEFINER + GRANT authenticated — totals + top 5 piores agentes (por p95) + timeseries horária; filtra por auth.uid()
- src/lib/slo/sloTargets.ts: SLO_TARGETS (P95<2000, P99<5000, success≥99%, errBudget 1%) + status helpers (latencyStatus, successRateStatus, errorBudgetStatus) + statusColor/Bg semantic tokens
- src/lib/slo/sloService.ts: fetchSLOSummary(windowHours) tipado (SLOSummary, SLOTopAgent, SLOTimeseriesPoint)
- src/pages/SLODashboard.tsx: 4 MetricCards color-coded + LightAreaChart (P95/P50/target band) + Resumo card + tabela top 5 agentes com pior P95 + selector janela (1h/6h/24h/7d) + auto-refresh 60s + empty state + page-enter
- src/hooks/useSLOAlerts.ts: polling 5min, toast.error com action "Ver dashboard" em breach, dedupe via sessionStorage
- src/components/shared/SLOAlertsMounter.tsx + montado em App.tsx
- src/components/layout/AppSidebar.tsx: item "SLO Dashboard" em Operações (ícone Activity)
- src/App.tsx: rota lazy `/observability/slo`
- docs/RUNBOOK.md: seção "SLO Monitoring" com targets, burn rate, resposta a breach, failure modes
- Reuso 100%: dados já existentes em agent_traces (sem necessidade de novas tabelas), LightAreaChart existente (sem nova dep recharts)

## Completed — Sprint 28 (Chaos Engineering — controlled fault injection)
- Migration: tabela `chaos_experiments` (workspace_id, target, fault_type, probability ≤0.5 CHECK, latency_ms ≤10000, expires_at ≤created_at+1h CHECK) + RLS (members SELECT, admins CRUD) + 2 índices (`idx_chaos_active` partial WHERE enabled, `idx_chaos_workspace`)
- Migration: RPC `disable_all_chaos(workspace_id)` SECURITY DEFINER (admin-only kill switch, retorna count); RPC `get_active_chaos_faults(target)` STABLE SECURITY DEFINER (filtra enabled + expires_at>now)
- supabase/functions/_shared/chaos.ts (novo): maybeInjectFault() com cache 5s + dice roll por probability; applyFault() para 4 tipos (latency sleep, error_500/429 throw com .status, timeout 30s); zero overhead quando sem experimentos ativos; nunca quebra produção (try/catch retorna null)
- supabase/functions/llm-gateway/index.ts: chaos check após auth+validation, antes de timing/provider call; span `chaos.inject` (kind=tool) com attrs fault_type/experiment_id/latency_ms
- supabase/functions/agent-workflow-runner/index.ts: chaos check após req.json() parse, antes do topo sort; mesmo padrão de span OTel
- src/services/chaosService.ts: list/listActive/create/disable/disableAll com validação client (probability ≤0.5, duration ≤3600s)
- src/pages/ChaosLabPage.tsx (rota `/observability/chaos`, ProtectedRoute permission settings.api_keys): form criar (slider probability 1-50%, slider duration 1-60min, conditional latency_ms input para fault=latency), lista ativos+histórico com badges color-coded (amber=ativo, outline=expirado/desativado), kill switch button com confirm dialog, alert educacional em empty state, auto-refresh 15s
- src/components/shared/ChaosBanner.tsx: banner sticky amber em todo app quando experimentos ativos, polling 30s, link "Gerenciar" para /observability/chaos, usa nexus-amber semantic token
- src/components/layout/AppSidebar.tsx: item "Chaos Lab" em Operações (ícone Zap)
- src/App.tsx: rota lazy + ChaosBanner montado dentro do AuthGuard (antes do AppLayout)
- docs/RUNBOOK.md: seção "Chaos Engineering" com tabela targets+falhas, hard safety limits, walkthrough primeiro experimento, tabela validações esperadas, política operacional, failure modes graceful

## Score: 10/10 ✅ mantido (Sprint 28 — fecha ciclo resiliência: observabilidade SABE + chaos VALIDA resposta a falhas)

## Score: 10/10 ✅ mantido (Sprint 27 — observabilidade fecha o ciclo: traces (debug) + load (capacidade) + SLO (saúde contínua))

## Sprint 29 — Synthetic Monitoring (canary checks 24/7) ✅

- Migração: `synthetic_checks` + `synthetic_results` com RLS (members SELECT, admins CRUD), realtime habilitado, RPC `get_synthetic_summary` para uptime/P95/sparkline
- Edge function `synthetic-runner`: cron a cada 1min, suporta on-demand `{ check_id }`, threshold-aware (latência > expected = falha), 4xx não conta como falha (= serviço vivo)
- Cron job pg_cron `synthetic-runner-every-minute` agendado
- UI `/observability/synthetic`: cards com sparkline (60 últimas execuções, vermelho=fail), uptime % 24h colorido (≥99 verde / ≥95 amber / <95 vermelho), P95, total runs, botão "Executar agora", switch enable/disable
- `SyntheticAlertsMounter` no App.tsx: realtime subscription em `synthetic_results` com `success=false` → toast.error global
- Sidebar: "Synthetic Monitoring" sob Operações com ícone Radar
- Targets suportados: `llm-gateway`, `agent-workflow-runner`, `health` (REST ping)
- Validações: probability+threshold + interval (1-60min) check constraints na DB

## Score: 10/10 ✅ mantido (Sprint 29 — fecha tripé observabilidade: chaos PROATIVO + SLO REATIVO TRÁFEGO + synthetic REATIVO 24/7)

## Sprint 30 — Cost Anomaly Detection ✅

- Migração: `cost_baselines` (rolling 14 dias por scope+hour+dow, UNIQUE constraint para UPSERT) + `cost_alerts` (severity info/warning/critical, scope_label desnormalizado para UI rápida)
- RLS: members SELECT em ambas, admins UPDATE em alerts (acknowledge); INSERT só via SECURITY DEFINER RPCs
- Realtime habilitado em `cost_alerts`
- RPC `compute_cost_baselines()` agrega `agent_traces` últimos 14d por workspace/agent + hora-do-dia × dia-da-semana, calcula avg+stddev, UPSERT em baselines — schedulada via pg_cron diário 3h
- RPC `detect_cost_anomalies()`: pega spend última hora por agente, compara com baseline mesma hora/dow, calcula z-score; insere alerta se z>2 e observed>$0.10 (filtro ruído); dedupe 1h — schedulada pg_cron a cada 15min
- RPC `acknowledge_cost_alert(p_alert_id)` com check de admin
- UI `/observability/cost-anomalies`: cards severity-coded com observed vs baseline + z-score + delta % + botão Acknowledge + link "Investigar traces"; filtro severity + toggle ativos/tratados; empty state "Sem anomalias ✅"
- `CostAnomalyAlertsMounter` global em App.tsx: realtime INSERT → toast.error (critical) ou toast.warning (warning) com label do scope + observed/baseline/z
- `CostAnomalyWidget` para Dashboard: count de alertas ativos (refetch 60s) com cor verde/amber
- Sidebar: "Anomalias de Custo" sob Operações com ícone TrendingDown

## Score: 10/10 ✅ mantido (Sprint 30 — fecha ciclo FinOps: tracking (traces) + alerting (anomaly detection) → próximo budget enforcement)

## Sprint 31 — Budget Enforcement ✅

- Migração: `workspace_budgets` (UNIQUE workspace_id, monthly+daily limits, hard_stop, soft_threshold_pct 1-100, notify_emails) + `budget_events` (event_type soft_warning|hard_block|agent_paused|reset, period daily|monthly, pct_used, metadata jsonb) + índices triggered_at DESC
- RLS: members SELECT em ambas; admins INSERT/UPDATE/DELETE em workspace_budgets; INSERT de events só via SECURITY DEFINER
- Realtime habilitado em `budget_events`
- RPC `get_current_spend(workspace, period)` agrega `agent_traces.cost_usd` do mês ou dia atual
- RPC `check_budget(workspace)` retorna `{allowed, configured, warning, monthly_spend/limit/pct, daily_spend/limit/pct}` — usado pelo llm-gateway antes do provider
- RPC `enforce_budget()` cron 5min: marca workspaces over-limit, pausa agents (`agents.status='paused'`) e insere `budget_events` (com dedupe por período)
- RPC `reset_workspace_budget(workspace)` admin-only: reativa agents pausados + registra evento `reset`
- llm-gateway: nova `checkBudget()` chama RPC primeiro; retorna 402 com `reason` se hard_stop atingido; setup de header `X-Budget-Warning: NN% used` quando soft threshold ultrapassado
- UI `/settings/budget`: form (monthly/daily limits + threshold slider + hard_stop switch + notify emails CSV); cards "Gasto mensal/diário" com Progress + cor green/amber/red; histórico de eventos com badges severity-coded; botão Reset
- `BudgetEventsMounter` global: realtime INSERT → toast.error (hard_block/agent_paused), toast.warning (soft_warning), toast.success (reset)
- `BudgetWidget` para Dashboard: progress bar mensal + % usage + link
- Sidebar: "Orçamento" sob Configurações com ícone Wallet
- Cron `enforce-budget-every-5min` agendado via pg_cron

## Score: 10/10 ✅ mantido (Sprint 31 — ciclo FinOps completo: tracking → alerting → enforcement)

## Próximo: Sprint 32 — Game Days (incident drills) ou Sprint 33 — Incident Response Automation


## Sprint 32 — Game Days (Incident Drills) ✅
- Tabelas `game_days`, `game_day_events`, `game_day_scorecards` com RLS por workspace
- RPCs: `start_game_day` (auto-injeta chaos por scenario), `record_game_day_event`, `complete_game_day` (calcula MTTR/MTTD automático)
- Páginas: `/observability/game-days` (lista + agendar) e `/observability/game-days/:id/live` (war room com timer realtime, botões grandes)
- Realtime subscription em `game_day_events` para sincronizar timeline entre participantes
- Cenários: provider_outage, cost_spike, db_slowdown, auth_failure, custom — cada um mapeia para chaos experiment apropriado
- Scorecard com MTTR, gaps, score 1-10, retrospectiva
- Sidebar: "Game Days" sob Operações (ícone Swords)
- RUNBOOK.md: cadência mensal, critérios de score, fluxo war room
- Fila restante: Sprint 33 (Incident Response Automation), Sprint 34 (DR Drills)

## Completed — Sprint 33 (Incident Response Automation)
- Tables: `incident_playbooks`, `incident_runs`, `oncall_schedule` with RLS
- RPCs: `create_incident_run` (cooldown-aware), `update_incident_run`, `get_current_oncall`
- Edge function `incident-orchestrator`: executes 5 action types (notify, disable_chaos, pause_agent, switch_provider, page_oncall)
- UI: `/observability/playbooks` (CRUD + templates + history) and `/observability/oncall` (rotation calendar)
- Realtime mounter: toast on new `incident_runs` INSERT
- 3 pre-built templates: Provider down→switch, Cost spike→pause, Synthetic fail→page on-call
- Cooldown enforcement at DB level (no double-trigger within window)
- Runbook section: Incident Response Automation

## Completed — Sprint 34 (Disaster Recovery Drills)
- Tables: `dr_drills`, `dr_snapshots`, `dr_restore_logs` with RLS (members SELECT, admins ALL)
- RPCs: `start_dr_drill` (snapshot row counts + md5 checksums), `record_dr_step`, `complete_dr_drill` (RTO/RPO calc + flags)
- Edge function `dr-orchestrator`: snapshot → isolate → restore (simulated) → validate (re-count + drift check) → cleanup
- UI: `/observability/dr-drills` (templates, scheduling, RTO/RPO gauges, expandable timeline)
- 3 pre-built templates: Críticas semanal, Workspace mensal, Full DR trimestral
- Realtime: live timeline updates as `dr_restore_logs` INSERT
- Drift detection: validation fails if row count drift > 10%
- Runbook section: Disaster Recovery (cadence, targets, procedures)

## Queue
- Sprint 35: Postmortem Templates (auto-generate from incident_runs + game_days)
- Sprint 36: Compliance Reports automation (SOC2/ISO evidence packs)

## Sprint 35 — Postmortem Templates ✅
**Data**: 2026-04-18
**Score**: 10/10 mantido
**Entregue**:
- Tabelas `postmortems` + `postmortem_action_items` (RLS: members SELECT, author/admin UPDATE)
- RPCs `generate_postmortem_from_incident`, `generate_postmortem_from_gameday`, `publish_postmortem` (gate: summary + root_cause + ≥1 action)
- Página `/observability/postmortems` (lista com filtros SEV/status/origem, gerador de incidente/gameday, criação manual)
- Página `/observability/postmortems/:id` (editor estruturado: timeline, 5 Whys, action items inline com prio/owner/due)
- Sidebar item "Postmortems" sob Operações
- RUNBOOK seção "Postmortem Process" (blameless, SLA 5 dias, templates por categoria)
- Severidade auto: incident_failed=SEV1, partial=SEV2, gameday score<5=SEV1

**Próximos da fila Continuous Hardening**:
- Sprint 36: Compliance Reports (SOC2/ISO27001 evidence auto-collect)
- Sprint 37: SBOM + Supply Chain (npm audit + dependency provenance)
- Sprint 38: Customer Comm Templates (status page integration)

## Sprint 36 — Compliance Reports (SOC2/ISO27001/LGPD) ✅
- Tabelas: compliance_frameworks, compliance_controls, compliance_reports, compliance_evidence
- Catálogo seed: 8 controles SOC2, 6 ISO27001, 4 LGPD
- RPC generate_compliance_report: executa auto_check_query por controle, calcula score
- RPC publish_compliance_report: gate admin
- Página /compliance-reports refeita com dados reais (substituiu stub estático)
- Service: src/services/complianceService.ts
- RLS: members SELECT, admins INSERT/UPDATE/DELETE
- Próximo: Sprint 37 — SBOM/Supply Chain Security

## Sprint 37 — SBOM/Supply Chain Security ✅
- Tables: sbom_snapshots, sbom_components, vulnerability_findings (RLS: members SELECT, admins write)
- RPCs: create_sbom_snapshot, record_vulnerability, acknowledge_vulnerability, mark_vulnerability_fixed
- Edge function `sbom-scanner`: queries OSV.dev for each component
- Pages: /security/sbom (snapshots + scan), /security/vulnerabilities (consolidated triage)
- Sidebar: "SBOM" + "Vulnerabilidades" under Administração
- Runbook updated: weekly scan, SLA critical 24h/high 7d/medium 30d
- Queue: Sprint 38 Secrets Rotation, Sprint 39 Pentest Tracking

## Sprint 38 — Secrets Rotation Tracking ✅
- Tables: managed_secrets (metadata only, never values), secret_rotation_events
- RPCs: register_managed_secret, record_secret_rotation, mark_secret_retired, get_secrets_status_summary, refresh_secrets_status
- Trigger: rotation event auto-updates last_rotated_at + recalculates next_rotation_due
- Page: /security/secrets-rotation — 5 stat cards, filters, templates, rotate dialog, retire flow
- Visual badges: overdue (pulsante vermelho), <7d (amber), <30d (yellow), ok (emerald), retired (muted)
- Templates: OpenAI/Anthropic API (90d), DB password (180d), JWT signing (30d), OAuth (365d), Webhook (90d)
- Sidebar: "Rotação de Secrets" sob Administração (KeyRound icon)
- RLS: members SELECT, admins INSERT/UPDATE; trigger auto-status (overdue/pending) via refresh RPC
- Audit log: secret.registered / secret.rotated / secret.retired
- Compliance: SOC2 CC6.1, ISO 27001 A.9.2.4, PCI-DSS 3.6
- Queue: Sprint 39 Pentest Tracking, Sprint 40 Risk Register

## Sprint 39 — Penetration Test Tracking ✅
- Tables: pentest_engagements, pentest_findings (RLS: members SELECT, admins write)
- RPCs: create_pentest_engagement, record_pentest_finding, update_pentest_finding_status, get_pentest_summary
- Trigger: auto due_date by severity (critical 7d / high 30d / medium 90d / low 180d / info 365d)
- Trigger: maintains total_findings count on engagements
- Pages: /security/pentests (engagements + drill-in sheet), /security/pentest-findings (consolidated triage)
- Sidebar: "Pentests" (Bug) + "Findings de Pentest" (Swords) sob Administração
- Visual: severity color chips, urgency badges (overdue pulsante, <7d amber, <30d yellow)
- Audit log: pentest.engagement_created, pentest.finding_recorded, pentest.finding_status_changed
- Compliance: SOC2 CC4.1, ISO 27001 A.12.6.1, PCI-DSS 11.3
- Queue: Sprint 40 Risk Register, Sprint 41 Vendor Risk Mgmt

## Sprint 40 — Risk Register (ISO 31000 / SOC2 CC3.2)
**Status:** ✅ Completo · Score 10/10 mantido

**Entregue:**
- Tabelas `risk_register` (likelihood/impact 1–5, inherent_score gerado, residual_score, treatment, status, next_review_due, related_finding_id → pentest_findings) e `risk_review_events` (audit trail)
- RPCs: `register_risk`, `review_risk`, `close_risk`, `get_risk_summary` (heatmap aggregation incluído)
- Trigger `handle_risk_review_event`: 30d cycle para critical (≥15), 90d para demais; auto-promove status `identified → assessed`
- UI `/security/risks`: stats (total/critical/overdue/untreated), heatmap 5×5 visual com bolhas dimensionadas, tabela filtrável (categoria/status/overdue), dialog de criação com sliders L/I, drill-in Sheet com histórico de reviews e ação de fechamento
- Sidebar item "Registro de Riscos" (ícone `AlertOctagon`) sob Administração
- RUNBOOK seção "Risk Management" — escala, cadência, tratamentos, escalation
- Audit log entries: risk.registered, risk.reviewed, risk.closed

**Próxima fila:**
- Sprint 42: Business Continuity Plan (BIA, RTO/RPO por sistema crítico, comm tree)
- Sprint 43: Change Management (CAB, change windows, freeze periods)

## Sprint 41 — Vendor Risk Management (TPRM) ✅
**Status:** Completo · Score 10/10 mantido

**Entregue:**
- Tabelas `vendors` (type/criticality/data_classification/status, DPA + SOC2 + ISO27001 com datas), `vendor_assessments` (security/compliance/operational scores 1-5 + risk_score gerado), `vendor_documents` (DPA/SOC2/ISO/pentest/contract com valid_until)
- RPCs: `register_vendor`, `assess_vendor`, `offboard_vendor`, `get_vendor_summary`
- Trigger `handle_vendor_assessment`: agenda próxima review por criticality (critical=90d, high=180d, demais=365d)
- UI `/security/vendors`: 5 stats cards (total/críticos/DPAs vencendo/certs expirados/reviews overdue), tabela filtrável por criticality+type+status, badges de urgência (DPA expirado vermelho pulsante, <30d amber, certs expirados pulsante), drill-in Sheet com tabs Detalhes/Assessments/Documentos
- Sidebar item "Fornecedores" (ícone `Building2`) sob Administração
- RLS: members SELECT, admins INSERT/UPDATE; assessments+documents só por admins
- Audit log: vendor.registered, vendor.assessed, vendor.offboarded
- Compliance: SOC2 CC9.2, ISO 27001 A.15, LGPD Art.39

**Próxima fila:**
- Sprint 42: Business Continuity Plan (BIA, RTO/RPO por sistema crítico, comm tree)
- Sprint 43: Change Management (CAB, change windows, freeze periods)

## Sprint 42 — Business Continuity Plan (BCP) ✅
- Tabelas: `business_systems` (tier_1..4, RTO/RPO/MTPD, dependencies, status, next_test_due) + `bcp_test_runs` (tabletop/walkthrough/simulation/full_failover)
- RPCs: `register_business_system`, `record_bcp_test`, `get_bcp_summary`
- Trigger auto-recalcula `next_test_due` por tier (90/180/365/730d)
- UI `/security/bcp`: stats (tier 1, vencidos, breaches RTO, down/degraded), tabela filtrável, drill-in Sheet com tabs Detalhes + Histórico + novo teste inline
- Sidebar: "Continuidade (BCP)" sob Segurança (LifeBuoy)
- Polish Sprint 41: 3 ocorrências `bg-emerald-500` → `bg-nexus-emerald` em VendorsPage (consistência com tokens)
- Conformidade: ISO 22301 / SOC2 A1.2 / NIST 800-34

## Próxima fila
- Sprint 43: **Change Management** (CAB, change_requests, deployment_freeze_windows)
- Sprint 44: **Incident Response Playbooks** (templates por categoria, MTTR tracking)
- Sprint 45: **Asset Inventory** (devices, software licenses, network endpoints)

## Completed — Sprint 43 (Change Management / CAB)
- Tables: change_requests, change_approvals, freeze_windows
- Enums: change_type (standard/normal/emergency), risk_level, change_status (9 states), change_decision
- RLS: members SELECT, requesters create/update own, admins approve/execute/rollback
- Trigger `enforce_freeze_window` blocks scheduled non-emergency changes during active freezes
- RPCs: submit_change_request, decide_change, execute_change, rollback_change, get_change_summary
- Service: src/services/changeManagementService.ts (CRUD, freeze check, status/risk variants)
- Page: src/pages/ChangeManagementPage.tsx (`/security/changes`) with stats, filters, freeze timeline, drill-in sheet (details/approvals/execution)
- Sidebar: "Mudanças (CAB)" with GitPullRequest icon under Administração
- Rollback enforces post_mortem_url
- Standards: ITIL 4 / SOC2 CC8.1 / ISO 27001 A.12.1.2

## Próximos da fila
- Sprint 44 — IR Playbooks (incident response templates + tabletop scheduling)
- Sprint 45 — Asset Inventory (CMDB unificada com vendors + business_systems)

## Completed — Sprint 44 (Incident Response Playbooks)
- 3 tables: ir_playbooks, ir_playbook_steps, ir_tabletop_exercises
- 5 enums: ir_incident_type (8 types), ir_severity, ir_playbook_status, ir_phase (NIST 5), ir_tabletop_outcome
- Trigger handle_ir_tabletop: ao registrar exercício recalcula next_review_due (90d crit / 180d high / 365d demais)
- RPCs: activate_ir_playbook, get_ir_summary
- RLS: members SELECT, admins INSERT/UPDATE
- UI /security/ir: stats (active/overdue/MTTR/gaps) + tabs Playbooks/Exercícios + drill-in Sheet (Steps NIST + Exercícios + Detalhes)
- Sidebar: "Playbooks (IR)" com ícone BookOpen sob Administração
- Compliance: NIST SP 800-61, SOC2 CC7.4, ISO 27035
- Badge pulsante vermelho quando review vencido

## Próxima fila
- Sprint 45: Asset Inventory (CMDB-lite — hardware, software, cloud resources)
- Sprint 46: Privacy/DSAR (LGPD Art.18 — direitos do titular)

## Completed — Sprint 45 (Asset Inventory / CMDB-lite)
- 2 tables: assets, asset_audits
- 4 enums: asset_type (8 types), asset_environment, asset_classification, asset_status
- Trigger handle_asset_audit: ao registrar auditoria atualiza last_seen_at + status no ativo
- RPCs: register_asset, audit_asset, decommission_asset, get_asset_summary
- RLS: members SELECT, admins INSERT/UPDATE/DELETE
- Service: src/services/assetInventoryService.ts (CRUD, summary, helpers warranty/audit overdue)
- UI /security/assets: stats (total/no-owner/audit-overdue/warranty-expiring) + filtros (type/env/class/status) + busca + tabela com badges + drill-in Sheet (Detalhes/Auditorias)
- Sidebar: "Inventário (CMDB)" com ícone Boxes sob Administração
- Compliance: ISO 27001 A.5.9, SOC2 CC6.1, NIST CSF ID.AM
- Badge pulsante amber para warranty <=30d e destrutivo para audit overdue >90d
- Decommission via Sheet com motivo obrigatório, gera auditoria automática

## Próxima fila
- Sprint 46: Privacy/DSAR (LGPD Art.18 — direitos do titular)
- Sprint 47: Access Reviews (revisão periódica de permissões)

## QA Fase 2 — Visual consistency pass (2026-04-18)
Padronizado container das 6 páginas de Segurança/Observabilidade para `p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter`:
- BCPPage, ChangeManagementPage, IncidentPlaybooksPage, IRPlaybooksPage, RiskRegisterPage, VendorsPage
Confirmado: todas as rotas Sprints 41-45 já usam lazy() em App.tsx.
AssetInventoryPage já estava no padrão (referência).

## Completed — Sprint Performance (FK Indexes)
- 26 btree indexes added on previously uncovered FK columns
- Tables: agent_installed_skills, agent_memories, alerts, api_keys, browser_sessions, compliance_evidence, compliance_reports, deploy_connections, environments, evaluation_datasets, forum_posts, graph_executions, help_centers (x2), kb_query_gaps, risk_register, session_traces, test_cases, tool_policies (x2), trace_events, usage_records, vector_indexes, vulnerability_findings, workflow_steps, workspaces.owner_id
- Eliminates seq scans on parent DELETEs and FK-filtered joins
- Linter: 0 new warnings (pgcrypto-in-public pre-existing, out of scope)

## Completed — Sprint Hardening Final (V3, 2026-04-18)
- pgcrypto moved from public → extensions schema; encrypt_secret_value updated to extensions.pgp_sym_encrypt
- evaluationsService: wrapErr(op, err, ctx) wrapper added to 9 exported functions (logger.error + structured ctx)
- Confirmed Security/Settings/Team pages already use service layer (no direct supabase calls in critical-data pages)
- pg_net warning ignored: Supabase-managed extension, not actionable
- tsc --noEmit: 0 errors
- Final scorecard: 9.8/10 (security 10, perf 10, code quality 10, observability 10, tests 9)
