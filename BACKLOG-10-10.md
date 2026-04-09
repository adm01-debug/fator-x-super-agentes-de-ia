# 🎯 Backlog 10/10 — Nexus Agents Studio / FATOR X

**Criado:** 2026-04-09
**Fonte:** Cruzamento dos 4 documentos de auditoria:

- `GAP-ANALYSIS-GITHUB-TOPICS-AGENT-2026-04-05.md` — "o que o mercado tem que não temos"
- `NEXUS-GAP-ANALYSIS-AUTOMATION.md` — retrospectiva dos 10 services de automação já entregues
- `NEXUS-AUDITORIA-FRONTEND-COVERAGE.md` — "o que existe no backend mas o usuário não alcança"
- `COVERAGE-REPORT.md` — "onde a rede de testes está furada"

---

## Filosofia

Os 4 docs respondem perguntas diferentes. Este backlog cruza as respostas e ordena o que sobrou como trabalho real, em **7 WAVEs** por impacto + viabilidade. Cada item tem fonte rastreável e critério de pronto implícito (arquivo concreto a criar/modificar).

**Regra:** não pular WAVE sem fechar a anterior. Puxar de WAVE 7 com WAVE 4 pendente é furar o telhado antes de fechar as janelas.

---

## WAVE 1 — Verdade documental

Commits rápidos, zero risco, desbloqueiam visibilidade do estado real do projeto.

| # | Item | Fonte | Status |
|---:|---|---|:---:|
| 1 | Atualizar `COVERAGE-REPORT.md` (15 alvos antigos fechados, novo top-15) | COVERAGE-REPORT | ✅ |
| 2 | Criar `BACKLOG-10-10.md` (este arquivo) | meta | ✅ |
| 3 | Criar `DESIGN.md` (design tokens, componentes, layouts — referência pra coding agents) | GAP-AGENT P3 #9 | ✅ |

## WAVE 2 — Sprint #4 cleanup (fecha a tampa do routing)

O sprint #4 pushou a rota mas deixou pendências de acesso e polimento.

| # | Item | Fonte | Status |
|---:|---|---|:---:|
| 4 | Item "Routing" no sidebar apontando pra `/routing` (com ícone `Route`) | FRONTEND-COVERAGE | ✅ |
| 5 | Título + breadcrumb consistente na `RoutingConfigPage` | polimento | ✅ |
| 6 | i18n keys PT/EN da `RoutingConfigPage` | FRONTEND-COVERAGE (useI18n) | ✅ |

## WAVE 3 — Testes de domínio (novo mapa do tesouro)

Do "novo top 15 sem cobertura" do COVERAGE-REPORT atualizado. ROI alto: cobertura global sai de ~22% projetado pra ~45–55%.

| # | Item | Fonte | Status |
|---:|---|---|:---:|
| 7 | `src/test/agents-service.test.ts` | COVERAGE-REPORT #1 | ✅ |
| 8 | `src/test/cerebro-service.test.ts` | COVERAGE-REPORT #2 | ✅ |
| 9 | `src/test/datahub-service.test.ts` | COVERAGE-REPORT #3 | ✅ |
| 10 | `src/test/memory-service.test.ts` | COVERAGE-REPORT #4 | ✅ |
| 11 | `src/test/knowledge-service.test.ts` | COVERAGE-REPORT #5 | ✅ |
| 12 | `src/test/monitoring-service.test.ts` | COVERAGE-REPORT #6 | ✅ |
| 13 | `src/test/evaluations-service.test.ts` | COVERAGE-REPORT #7 | ✅ |
| 14 | `src/test/deployments-service.test.ts` | COVERAGE-REPORT #8 | ✅ |
| 15 | `src/test/llm-gateway-service.test.ts` (ampliar) | COVERAGE-REPORT #9 | ✅ |
| 16 | `src/test/oracle-service.test.ts` | COVERAGE-REPORT #11 | ✅ |

## WAVE 4 — Frontend wiring (services ignorados)

Do `NEXUS-AUDITORIA-FRONTEND-COVERAGE.md`: **12/13 services não consumidos pelas páginas** — as pages fazem `supabase.from()` direto. Migrar em ordem do menor risco ao maior. Cada migração vem junto com ampliação do teste do service.

| # | Item | Fonte | Status |
|---:|---|---|:---:|
| 17 | `BillingPage` → `billingService` | FRONTEND-COVERAGE | ✅ |
| 18 | `DeploymentsPage` → `deploymentsService` | FRONTEND-COVERAGE | ✅ |
| 19 | `TeamPage` → `teamsService` | FRONTEND-COVERAGE | ✅ |
| 20 | `EvaluationsPage` → `evaluationsService` | FRONTEND-COVERAGE | ✅ |
| 21 | `MemoryPage` → `memoryService` | FRONTEND-COVERAGE | ✅ |
| 22 | `KnowledgePage` → `knowledgeService` (+ fetch) | FRONTEND-COVERAGE | ✅ |
| 23 | `SuperCerebroPage` tabs → `cerebroService` | FRONTEND-COVERAGE | ✅ |
| 24 | `DataHubPage` → `datahubService` | FRONTEND-COVERAGE | ✅ |
| 25 | `MonitoringPage` → `monitoringService` (12 chamadas a migrar) | FRONTEND-COVERAGE | ✅ |
| 26 | `WorkflowsPage` → `workflowsService` (11 chamadas a migrar) | FRONTEND-COVERAGE | ✅ |
| 27 | `OraclePage` → `oracleService` via `oracleStore` | FRONTEND-COVERAGE | ✅ |
| 28 | `SecurityPage` → `securityService` (page é placeholder de 30L!) | FRONTEND-COVERAGE | ✅ |

## WAVE 5 — UIs faltantes (12 Edge Functions órfãs)

Do `NEXUS-AUDITORIA-FRONTEND-COVERAGE.md`: 12 Edge Functions não têm nenhuma UI. Priorizado pelas 6 de severidade ALTA.

| # | Item | Fonte | Status |
|---:|---|---|:---:|
| 29 | `GuardrailsPanel` no Agent Builder (guardrails-engine) | FRONTEND-COVERAGE #1 | ✅ |
| 30 | Botão "Deep Research" na `OraclePage` (oracle-research) | FRONTEND-COVERAGE #2 | ✅ |
| 31 | `A2APanel` nos Deployments (a2a-server) | FRONTEND-COVERAGE #3 | ✅ |
| 32 | Botão "Conectar Bitrix24" em Settings (bitrix24-oauth) | FRONTEND-COVERAGE #4 | ✅ |
| 33 | Testar chamadas Bitrix24 na `ToolsPage` (bitrix24-api) | FRONTEND-COVERAGE #5 | ✅ |
| 34 | Aba "MCP Server" na `DataHubPage` (datahub-mcp-server) | FRONTEND-COVERAGE #6 | ✅ |
| 35 | Botão "OCR" na `KnowledgePage` (doc-ocr) | FRONTEND-COVERAGE #7 | ✅ |
| 36 | Preview de imagem no Agent Builder (image-analysis) | FRONTEND-COVERAGE #8 | ✅ |
| 37 | Tela de geração de mockup (product-mockup) | FRONTEND-COVERAGE #9 | ✅ |
| 38 | Playground expandido (smolagent-runtime) | FRONTEND-COVERAGE #10 | ✅ |
| 39 | Painel de batch testing (test-runner) | FRONTEND-COVERAGE #11 | ✅ |
| 40 | Wizard de fine-tuning completo (hf-autotrain) | FRONTEND-COVERAGE #12 | ✅ |

## WAVE 6 — Infra connectivity

Do `NEXUS-AUDITORIA-FRONTEND-COVERAGE.md`: 7 módulos de infra existem mas não são acessíveis ao usuário.

| # | Item | Fonte | Status |
|---:|---|---|:---:|
| 41 | `NexusMCPClient` → tela "MCP Servers" em Settings | FRONTEND-COVERAGE | ✅ |
| 42 | `NexusTracer` → aba "Tracing" em `MonitoringPage` | FRONTEND-COVERAGE | ✅ |
| 43 | `useI18n` → seletor de idioma no header + sidebar | FRONTEND-COVERAGE | ✅ |
| 44 | `useNotificationStore` → sino no header com drawer | FRONTEND-COVERAGE | ✅ |
| 45 | `useUIStore` → integrar ao sidebar + modais | FRONTEND-COVERAGE | ✅ |
| 46 | `useDatahubStore` → integrar à `DataHubPage` | FRONTEND-COVERAGE | ✅ |
| 47 | `AccessControl` wrappando botões sensíveis (deploy/delete/etc) | FRONTEND-COVERAGE | ✅ |

## WAVE 7 — Gaps de mercado (diferenciação competitiva)

Do `GAP-ANALYSIS-GITHUB-TOPICS-AGENT-2026-04-05.md`. Cada um é sprint inteiro. Só começar depois que WAVEs 1–6 estejam maduras — senão a casa não está de pé pra diferenciar.

| # | Item | Fonte | Prioridade | Esforço | Status |
|---:|---|---|:---:|:---:|:---:|
| 48 | Streaming SSE nativo (refactor `llm-gateway` + hook React) | GAP-AGENT P0 #5 | 🔴 P0 | Médio | ⬜ |
| 49 | AG-UI Protocol (`@copilotkit/react` + 16 tipos de evento) | GAP-AGENT P0 #1 | 🔴 P0 | Alto | ⬜ |
| 50 | Context Tiers L0/L1/L2 (migration + trigger + RAG refactor) | GAP-AGENT P1 #3 | 🟠 P1 | Médio | ⬜ |
| 51 | Agent Self-Evolution / ACE (`agent_skills` table + Reflector + injection) | GAP-AGENT P1 #4 | 🟠 P1 | Alto | ⬜ |
| 52 | A2UI Generative UI (JSONL renderer + widget library) | GAP-AGENT P2 #2 | 🟡 P2 | Alto | ⬜ |
| 53 | Red Teaming / Prompt Pentesting (Promptfoo integration) | GAP-AGENT P2 #6 | 🟡 P2 | Baixo | ⬜ |
| 54 | AI Sandbox Isolado (containers p/ smolagent) | GAP-AGENT P3 #7 | 🟡 P3 | Médio | ⬜ |
| 55 | Skills Marketplace (buscável, instalável, community) | GAP-AGENT P3 #8 | 🟡 P3 | Alto | ⬜ |
| 56 | OpenTelemetry GenAI completo (conectar `NexusTracer` a collector) | GAP-AGENT P3 #10 | 🟡 P3 | Médio | ⬜ |

---

## Como usar este arquivo

1. Cada item = 1 commit (ou pequeno grupo de commits relacionados)
2. Marcar ✅ em `Status` quando o commit referente mergear em `main`
3. Nova sprint = pegar N itens da próxima WAVE e executar em sequência
4. Ao fechar uma WAVE inteira, anotar a data no "Histórico" abaixo

## Vantagens competitivas preservadas

Do `NEXUS-GAP-ANALYSIS-AUTOMATION.md`, vantagens únicas que **não fazem parte do backlog porque já estão entregues** e devem ser preservadas em qualquer refactor:

- Oráculo Multi-LLM Council (5 modos + chairman synthesis + inline citations)
- DataHub Multi-Database (5 bancos Supabase, 508+ tabelas)
- Integração Bitrix24 + WhatsApp nativa (mercado brasileiro)
- Super Cérebro com 8 tabs especializados
- LGPD Compliance Module
- Cost Calculator (18 modelos, BRL)
- 10 services de automação (cron, webhook, retry, vault, notification, templates, history, connectors, queue, batch)
- Sprint #4: routing unificado (bitrix24/whatsapp/gmail/slack)

---

## Histórico de WAVEs

| WAVE | Items | Início | Fim | Status |
|---|---|---|---|:---:|
| 1 | #1–#3 | 2026-04-09 | 2026-04-09 | ✅ |
| 2 | #4–#6 | 2026-04-09 | 2026-04-09 | ✅ |
| 3 | #7–#16 | 2026-04-09 | 2026-04-09 | ✅ |
| 4 | #17–#28 | 2026-04-09 | 2026-04-09 | ✅ |
| 5 | #29–#40 | 2026-04-09 | 2026-04-09 | ✅ |
| 6 | #41–#47 | 2026-04-09 | 2026-04-09 | ✅ |
| 7 | #48–#56 | — | — | ⬜ |

---

*Gerado a partir do cruzamento dos 4 docs de auditoria em 2026-04-09.*
*Mantido manualmente pela execução dos sprints.*
