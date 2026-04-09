# 📊 Coverage Report — Nexus Agents Studio / FATOR X

**Última atualização:** 2026-04-09 (pós sprint #4)
**Foto anterior:** 2026-04-08 (baseline de 6.33% lines)
**Tool:** vitest 3.2.4 + @vitest/coverage-v8

---

## 🎯 Mudança de estado desde 08/04

O relatório anterior listava **15 "top alvos sem cobertura"** — todos services de automação grandes puxando a média pra baixo. **Os 15 agora têm suítes dedicadas em `src/test/`**, mais uma suite cruzada em `src/tests/automation-services.test.ts` (~870 linhas). A base de testes cresceu de ~19 suítes pra 60+ arquivos.

### Status do mapa do tesouro original (2026-04-08)

| # | Service | Linhas | Suite criada | Status |
|---:|---|---:|---|:---:|
| 1 | `retryEngineService.ts` | 356 | `retry-engine.test.ts` | ✅ |
| 2 | `batchProcessorService.ts` | 355 | `batch-processor.test.ts` | ✅ |
| 3 | `connectorRegistryService.ts` | 347 | `connector-registry.test.ts` | ✅ |
| 4 | `credentialVaultService.ts` | 344 | `credential-vault.test.ts` | ✅ |
| 5 | `queueManagerService.ts` | 338 | `queue-manager.test.ts` | ✅ |
| 6 | `notificationEngineService.ts` | 328 | `notification-engine.test.ts` + `notification-and-middleware.test.ts` | ✅ |
| 7 | `cronSchedulerService.ts` | 322 | `cron-scheduler.test.ts` | ✅ |
| 8 | `middlewarePipelineService.ts` | 297 | `middleware-pipeline.test.ts` + `notification-and-middleware.test.ts` | ✅ |
| 9 | `webhookTriggerService.ts` | 275 | `webhook-trigger.test.ts` | ✅ |
| 10 | `agentHandoffService.ts` | 269 | `agent-handoff.test.ts` | ✅ |
| 11 | `costCalculatorService.ts` | 266 | `cost-calculator.test.ts` | ✅ |
| 12 | `executionHistoryService.ts` | 260 | `execution-history.test.ts` | ✅ |
| 13 | `automationTemplateService.ts` | 256 | `automation-template.test.ts` | ✅ |
| 14 | `workflowCheckpointService.ts` | 250 | `workflow-checkpoint.test.ts` | ✅ |
| 15 | `progressiveSkillLoader.ts` | 237 | `progressive-skill-loader.test.ts` | ✅ |

**Total coberto:** ~4.300 linhas dos services críticos de automação. O report anterior estimava que fechar esses 15 tiraria a cobertura de 6.33% pra ~22% — a rerun do `vitest --coverage` vai confirmar o valor, mas o trabalho previsto foi concluído.

Sprint #4 adicionou `agent-routing.test.ts` fechando o último service do domínio routing, e registrou a rota `/routing` no `App.tsx`.

---

## 📈 Inventário atual de suítes

**`src/test/` — 60+ arquivos:**

- **Services (automação — fechado):** `automation-template`, `batch-processor`, `connector-registry`, `credential-vault`, `cron-scheduler`, `execution-history`, `middleware-pipeline`, `notification-engine`, `notification-and-middleware`, `progressive-skill-loader`, `queue-manager`, `retry-engine`, `webhook-trigger`, `workflow-checkpoint`
- **Services (domínio):** `agent-evolution`, `agent-handoff`, `agent-routing`, `bitrix24-webhook`, `billing-service`, `context-tiers`, `cost-calculator`, `extended-services`, `llm-gateway-providers`, `rbac-service`, `security-guards`, `security-service`, `services`, `skills-registry`, `whatsapp-outbound`, `whatsapp-webhook`, `workflows-service`
- **Lib & infra:** `normalize`, `tracing`, `streaming`, `mcp-client`, `rate-limiter`, `hooks`, `network-status`, `use-mobile`, `otel-genai`, `validations`
- **Components & UI:** `accessibility`, `animated-counter`, `app-sidebar`, `design-improvements`, `dialog-validations`, `document-title`, `error-boundary`, `i18n`, `i18n-interpolation`, `metric-card`, `notifications-drawer`, `page-loading`, `real-time-cost-stream`, `sidebar-persistence`, `span-tree-view`, `status-badge`, `template-canvas-preview`, `templates`, `use-unsaved-changes`, `workflow-nodes`, `workflow-tracer`, `oracle-comparison-aggregate`

**`src/tests/` — suítes de integração:**

- `automation-services.test.ts` — smoke test cruzado dos 10 services de automação (~870 linhas)
- `nexus-complete-test-suite.test.ts` — suite agregada (~420 linhas)

---

## 🔴 Novo mapa do tesouro — próximos 15 alvos

Com os services de automação fechados, o gap de cobertura agora está nos **services de domínio que as páginas consomem direto via `supabase.from()`** (conforme `NEXUS-AUDITORIA-FRONTEND-COVERAGE.md`). Ordenados por criticidade e impacto no usuário:

| # | Service | Por que é prioridade |
|---:|---|---|
| 1 | `agentsService.ts` | CRUD central de agentes — base de todo o Agent Builder |
| 2 | `cerebroService.ts` | 8 tabs do Super Cérebro dependem desse service |
| 3 | `datahubService.ts` | 5 bancos Supabase, 508+ tabelas — risco alto sem rede |
| 4 | `memoryService.ts` | Memória cross-session, alimentada pelo ACE (quando existir) |
| 5 | `knowledgeService.ts` | RAG pipeline que alimenta o Oráculo |
| 6 | `monitoringService.ts` | `MonitoringPage` faz 12 chamadas `supabase.from()` direto |
| 7 | `evaluationsService.ts` | Evals alimentam loops de self-evolution |
| 8 | `deploymentsService.ts` | Publicação de agentes — quebra silenciosa cara |
| 9 | `llmGatewayService.ts` | Router multi-provider (14.9% no report anterior → alvo 70%) |
| 10 | `healthAlertsService.ts` | Health monitoring cruzado |
| 11 | `oracleService.ts` | Core do Oráculo multi-LLM |
| 12 | `nlpPipelineService.ts` | Pre-processamento de prompts |
| 13 | `modelRouterService.ts` | Routing por custo/latência |
| 14 | `guardrailsMLService.ts` | Guardrails ML-based |
| 15 | `ragPipelineService.ts` | Hybrid search (pgvector + BM25 + RRF) |

**Estimativa:** 10–15 testes por service, alvo 50–70% lines cada. Fechando os 15, a cobertura global deve sair de ~22% projetado pra ~45–55%.

---

## 🎯 Recomendação

1. **Rerun do `vitest --coverage`** (~10 min) pra capturar o número real pós-sprint. O valor antigo de 6.33% está obsoleto; os thresholds do `vitest.config.ts` (70/70/60) continuam falhando por design até WAVE 3 do backlog fechar.
2. **Agrupamento de domínio:** fechar os serviços em grupos que compartilham mocks (ex: `agentsService` + `cerebroService` + `memoryService` usam a mesma tabela `agents` e `workspace_id` — mocks reutilizáveis).
3. **Paralelizar com wiring de frontend:** cada vez que uma página migra de `supabase.from()` direto pra usar o service (WAVE 4 do `BACKLOG-10-10.md`), já criar/expandir o teste do service no mesmo commit. Commit único = feature + rede de segurança.

---

## 📝 Histórico

| Sprint | Entregas | Data |
|---|---|---|
| #1–#3 | Fechamento dos 15 services do mapa do tesouro original (testes de automação) | 2026-04-01 → 04-08 |
| #4 | `agentRoutingService` + `RoutingConfigPage` + `agent-routing.test.ts` + rota `/routing` registrada no `App.tsx` | 2026-04-09 |
| #5+ | Ver `BACKLOG-10-10.md` (WAVEs 1–7) | — |

---

*Atualizado em 2026-04-09 após fechamento do sprint #4.*
*Fonte de verdade para próximas sprints: `BACKLOG-10-10.md`.*
