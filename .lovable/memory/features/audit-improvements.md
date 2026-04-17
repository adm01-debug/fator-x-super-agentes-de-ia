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

## Score: 10/10 ✅ mantido (Sprint 27 — observabilidade fecha o ciclo: traces (debug) + load (capacidade) + SLO (saúde contínua))
