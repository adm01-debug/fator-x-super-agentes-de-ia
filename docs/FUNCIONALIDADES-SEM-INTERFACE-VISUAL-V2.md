# 🕳️ Funcionalidades sem Interface Visual Completa — V2

> **Documento gerado:** 2026-04-21
> **Escopo:** Auditoria atualizada pós-V6 — cruza o estado real do código (`src/services/`, `src/hooks/`, `src/lib/`, `supabase/functions/`) com o consumo real em `src/pages/` e `src/components/`.
> **Metodologia:** grep de imports + invocações `supabase.functions.invoke()` + análise de uso real (não apenas presença em `index.ts`).
> **Versão anterior:** [V1](./FUNCIONALIDADES-SEM-INTERFACE-VISUAL.md) (2026-04-16).

---

## 📊 1. Sumário Executivo

| Camada | Total | Sem UI / Parcial | % Órfão | Δ vs V1 |
|---|---:|---:|---:|---:|
| **Edge Functions** | 63 | 12 | **19%** | ⬇️ -10pp |
| **Services frontend** | 93 | ~25 | **27%** | ⬇️ -9pp |
| **Hooks customizados** | 26 | 0 | **0%** | ⬇️ -19pp ✅ |
| **Stores Zustand** | 6 | 0 | **0%** | ⬇️ -33pp ✅ |
| **Libs de infraestrutura** | 18 | 8 | **44%** | ➡️ +1pp |
| **Páginas placeholder** | 98 | 3 | **3%** | ⬇️ -1pp |

> **Diagnóstico geral:** Capacidade exposta ao usuário evoluiu de **~65% (V1)** para **~75% (V2)**. As maiores conquistas: hooks e stores 100% consumidos. Os maiores débitos remanescentes: integrações externas (Bitrix24/WhatsApp/A2A) e libs de infraestrutura (MCP Registry, Tracing, OTel).

---

## 1️⃣ Edge Functions órfãs (12)

Edge functions presentes em `supabase/functions/` mas **não invocadas** em `src/`.

### 🔴 Severidade ALTA — funcionalidades core sem entrada no frontend (9)

| # | Edge Function | O que faz | UI faltando |
|---|---|---|---|
| 1 | `oracle-council` | Conselho multi-LLM (GPT-5 + Gemini Pro + Claude) | Botão "Conselho" na **OraclePage** |
| 2 | `oracle-research` | Deep Research iterativo multi-step | Modo "Deep Research" na **OraclePage** |
| 3 | `guardrails-engine` | 4 camadas de proteção determinísticas | Painel Guardrails no **AgentBuilder** (só `guardrails-ml` é chamado) |
| 4 | `bitrix24-api` | Proxy autenticado API Bitrix24 | Console em **ToolsPage** ou **IntegrationsPage** |
| 5 | `bitrix24-oauth` | Fluxo OAuth Bitrix24 | Botão "Conectar Bitrix24" em **SettingsPage** |
| 6 | `bitrix24-webhook` | Recebimento eventos Bitrix24 | Console em **RoutingConfigPage** |
| 7 | `whatsapp-webhook` | Inbound WhatsApp | Console de inbound em **DeploymentsPage** |
| 8 | `a2a-server` | Agent-to-Agent Protocol (Cards + Task) | Painel A2A em **DeploymentsPage** |
| 9 | `agent-conversational-builder` | Builder conversacional de agentes via chat | Modo "Chat" no **AgentBuilder** |

### 🟡 Severidade MÉDIA — features sem ponto de entrada (3)

| # | Edge Function | Melhoria sugerida |
|---|---|---|
| 10 | `doc-ocr` | Botão "Extrair texto (OCR)" em **KnowledgePage** |
| 11 | `rag-ingest` | Wizard de ingestão direto em **KnowledgePage** |
| 12 | `text-to-speech` | Player TTS standalone em **AIStudioPage** |

---

## 2️⃣ Services com UI parcial ou ausente (~25)

Agrupados em **5 clusters funcionais**.

### 🔴 Cluster Automação (10) — abas dedicadas faltando

A `AutomationCenterPage` foi expandida em V5/V6 com 9 abas, mas alguns services ainda estão **subutilizados** (chamados em demos isolados, sem CRUD completo na UI):

| Service | Status atual | Falta |
|---|---|---|
| `cronSchedulerService` | Aba "Agendamentos" exibe lista | Editor visual de cron expression |
| `webhookTriggerService` | Aba "Webhooks" lista triggers | Tester inline + replay |
| `retryEngineService` | Usado internamente | Painel de configuração de policies |
| `credentialVaultService` | Aba "Credenciais" lista | Rotação automática + audit trail |
| `notificationEngineService` | Aba "Notificações" exibe canais | Composer de templates multi-canal |
| `automationTemplateService` | Aba "Templates" lista | Marketplace + preview interativo |
| `executionHistoryService` | Aba "Histórico" lista runs | Filtros forenses + replay |
| `queueManagerService` | Aba "Filas" exibe métricas | Pause/resume/retry por job |
| `batchProcessorService` | Aba "Batch" lista jobs | Upload de CSV + preview |
| `connectorRegistryService` | Aba "Conectores" lista | Add custom connector wizard |

### 🔴 Cluster Memória avançada (5) — abas no SuperCerebro

A `SuperCerebroPage` ganhou 3 abas em V5/V6 (`temporal`, `resolution`, `decay`), mas:

| Service | Status | Falta |
|---|---|---|
| `temporalKnowledgeService` | Aba "Temporal" exibe grafo | Time-travel queries + diff visual |
| `entityResolutionService` | Aba "Resolução" lista clusters | Merge wizard manual |
| `knowledgeDecayService` | Aba "Decay" mostra alertas | Configuração de policies de TTL |
| `contextTiersService` | Sem UI | Painel de tiers (hot/warm/cold) |
| `progressiveSkillLoader` | Sem UI | Painel em **SkillsMarketplacePage** |

### 🟡 Cluster A2A & Multimodal (4)

| Service | Função | UI faltando |
|---|---|---|
| `agentCardService` | Geração de Agent Cards (descoberta) | Tab "Agent Card" no **AgentBuilder** |
| `agentHandoffService` | Handoff entre agentes | Visualizador em **WorkflowsPage** |
| `productMockupService` | Geração de mockup de produto | Tela "AI Studio → Mockup" |
| `widgetService` | Widget embarcável | Tela "Widget Builder" com preview |

### 🟡 Cluster Pipelines & Middleware (3)

| Service | Status | Falta |
|---|---|---|
| `middlewarePipelineService` | **0 refs** em `src/` | Console admin de middleware |
| `nlpPipelineService` | Usado em dialog modal | Tela standalone NLP Pipeline |
| `ragPipelineService` | Usado em RAG v2 | Visualizador de etapas (embed → rerank) |

### 🟡 Cluster Observabilidade & Custos (3)

| Service | Status | Falta |
|---|---|---|
| `costCalculatorService` | Usado em backend | Widget standalone de simulação |
| `healthAlertsService` | Usado em monitoring | Painel dedicado de alertas |
| `fineTuningService` | Listagem em FineTuningPage | Wizard completo (HF AutoTrain) |

---

## 3️⃣ Hooks & Stores — ✅ 100% consumidos

**Conquista do V5/V6:** todos os hooks customizados (`useStreaming`, `useRetryAction`, `useWorkflowAutosave`, `useNLPAnalysis`, `usePasswordBreachCheck`) e stores Zustand (`uiStore`, `datahubStore`) estão integrados em pelo menos uma página.

---

## 4️⃣ Libs de infraestrutura sem exposição UI (8)

Libs declaradas mas com **0 ou 1 referência** no código de aplicação.

| Lib | Refs | Capacidade | Onde deveria aparecer |
|---|---:|---|---|
| `lib/ag-ui/` | 0 | Componentes de UI generativa (AGUI Protocol) | Showcase em **AIStudioPage** |
| `lib/tracing/` | 0 | NexusTracer custom | Aba "Tracing" em **MonitoringPage** |
| `lib/otel-genai.ts` | 0 | OpenTelemetry GenAI semantic conventions | Visualizador OTEL em Monitoring |
| `lib/webVitals.ts` | 0 | Métricas RUM (Core Web Vitals) | Dashboard de performance |
| `lib/normalize.ts` | 0 | Utilitário de normalização | (provavelmente removível) |
| `lib/auditService.ts` | 0 | Wrapper antigo de audit | (substituir por service novo) |
| `lib/middlewarePipelineService.ts` | 0 | Pipeline de middleware | Console admin |
| `lib/mcp/` | 1 | MCP Client + Registry (5.800+ servers) | Tela "MCP Servers" em **SettingsPage** |

---

## 5️⃣ Páginas placeholder / incompletas (3)

Páginas que existem mas têm UI mínima vs backend rico disponível.

| Página | Estado atual | Backend disponível |
|---|---|---|
| `RoutingConfigPage` | UI básica de roteamento | 3 services (webhook + routing + handoff) prontos |
| `EmailCalendarTriggersPage` | Listagem estática | `triggerEngineService` suporta CRUD completo |
| `MobileSDKPage` | Apenas documentação estática | SDK gen + QR code + analytics disponíveis |

---

## 6️⃣ Comparativo V1 → V2

| Métrica | V1 (16/04) | V2 (21/04) | Δ |
|---|---:|---:|---|
| Edge Functions órfãs | 13 / 45 (29%) | 12 / 63 (19%) | ⬇️ -10pp |
| Services órfãos | 24 / 67 (36%) | ~25 / 93 (27%) | ⬇️ -9pp |
| Hooks subutilizados | 5 / 26 (19%) | 0 / 26 (0%) | ✅ -19pp |
| Stores parcialmente usados | 2 / 6 (33%) | 0 / 6 (0%) | ✅ -33pp |
| Libs sem exposição | 6 / 14 (43%) | 8 / 18 (44%) | ➡️ +1pp |
| Capacidade total exposta | ~65% | **~75%** | ⬆️ +10pp |

### O que foi resolvido entre V1 → V2

✅ `useStreaming` integrado no **AgentBuilder Playground**
✅ `useWorkflowAutosave` integrado no canvas de **WorkflowsPage**
✅ `useRetryAction` em listas de jobs/runs
✅ `useNLPAnalysis` inline em prompts
✅ `uiStore` + `datahubStore` totalmente integrados
✅ **AutomationCenterPage** ganhou 9 abas (Cron, Webhooks, Vault, Filas, Templates, Histórico, Conectores, Credenciais, Batch)
✅ **SuperCerebroPage** ganhou 3 abas (Temporal, Resolution, Decay)
✅ Botão "Deep Research" parcialmente exposto na **OraclePage**

### Débitos remanescentes (ainda em V2)

❌ Conectividade externa: Bitrix24 (3 funções), WhatsApp inbound, A2A
❌ Lib `mcp/` com 5.800+ servers sem tela de gestão
❌ Tracing customizado (NexusTracer) sem visualizador
❌ Widget Builder embarcável
❌ TTS / OCR / Mockup sem entrada no AI Studio

---

## 7️⃣ Plano sugerido — 4 sprints rumo a 100% UI coverage

### Sprint 1 — Polimento de painéis administrativos
- Completar CRUD nas 9 abas do **AutomationCenter** (editor cron visual, tester de webhook, composer de notificação, merge wizard de credenciais)
- Adicionar `contextTiersService` + `progressiveSkillLoader` em SuperCerebro/Skills
- Estimativa: **5 dias**

### Sprint 2 — Conectividade externa
- Botão "Conectar Bitrix24" + console de webhooks em **SettingsPage**
- Console de inbound WhatsApp em **DeploymentsPage**
- Painel A2A com Agent Cards + handoff visualizer
- Modo "Chat" do `agent-conversational-builder` no **AgentBuilder**
- Estimativa: **7 dias**

### Sprint 3 — Multimodal & Polimento
- AI Studio: TTS player, OCR, Mockup gen, Visual Search inline
- Widget Builder embarcável com preview live
- Botão "Conselho Oracle" exposto na **OraclePage**
- Painel Guardrails completo (engine + ml) no **AgentBuilder**
- Estimativa: **6 dias**

### Sprint 4 — Observabilidade & Infraestrutura
- Tela "MCP Servers" em **SettingsPage** (browse 5.800+ registry, install, test)
- Aba "Tracing" em **MonitoringPage** com NexusTracer + OTel viewer
- Dashboard de Web Vitals (RUM)
- Console de Middleware Pipeline (admin)
- Console NLP/RAG Pipeline standalone
- Estimativa: **6 dias**

**Total estimado:** 24 dias úteis (~5 semanas) para atingir **100% de coverage UI**.

---

## 8️⃣ Impacto esperado pós-plano

| Métrica | Atual (V2) | Pós-plano |
|---|---:|---:|
| Edge Functions com UI | 51/63 (81%) | 63/63 (100%) |
| Services consumidos por páginas | 68/93 (73%) | 93/93 (100%) |
| Libs de infra com tela | 10/18 (56%) | 18/18 (100%) |
| Páginas placeholder | 3/98 (3%) | 0/98 (0%) |
| **Capacidade exposta ao usuário** | **~75%** | **100%** |

---

## 📎 Anexos

- 📄 [V1 — Auditoria original (16/04)](./FUNCIONALIDADES-SEM-INTERFACE-VISUAL.md)
- 📄 [Funcionalidades do Sistema (visão geral)](../FUNCIONALIDADES-DO-SISTEMA.md)
- 📄 [NEXUS-AUDITORIA-FRONTEND-COVERAGE.md](../NEXUS-AUDITORIA-FRONTEND-COVERAGE.md)

---

*Documento gerado a partir de análise cruzada de imports reais em `src/pages/` + `src/components/` vs declarações em `src/services/` (93), `src/hooks/` (26), `src/lib/` (18), `src/stores/` (6) e `supabase/functions/` (63). Estado de referência: pós-V6 (10/10 production-ready).*
